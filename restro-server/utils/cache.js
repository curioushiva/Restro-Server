const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const zlib = require("zlib");

// Responses are cached so that an upstream failure (an expired WAF token, a
// Swiggy outage) degrades into stale data instead of an error. Disk survives
// restarts within an instance; the memory layer avoids re-reading hot entries.
// Two tiers: CACHE_DIR is written at runtime but Render's disk is wiped on
// every deploy and spin-down, so SEED_DIR holds committed entries that ship
// with the repo and are always present on a cold boot. Seed is read-only.
const CACHE_DIR = process.env.CACHE_DIR || path.join(__dirname, "..", ".cache");
const SEED_DIR = process.env.SEED_DIR || path.join(__dirname, "..", "seed");
const FRESH_MS = Number(process.env.CACHE_TTL_MS) || 6 * 60 * 60 * 1000;
const MAX_MEM_ENTRIES = 8;

const mem = new Map();

// Menus are large and highly repetitive JSON; gzip keeps the committed seed
// directory to roughly an eighth of its raw size.
const nameFor = (key) =>
  crypto.createHash("sha1").update(key).digest("hex") + ".json.gz";

const readEntry = (file) =>
  JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString("utf8"));

const writeEntry = (file, entry) =>
  fs.writeFileSync(file, zlib.gzipSync(Buffer.from(JSON.stringify(entry))));

const fileFor = (key) => path.join(CACHE_DIR, nameFor(key));
const seedFileFor = (key) => path.join(SEED_DIR, nameFor(key));

const touch = (key, entry) => {
  mem.delete(key);
  mem.set(key, entry);
  while (mem.size > MAX_MEM_ENTRIES) mem.delete(mem.keys().next().value);
};

// Returns { body, ageMs, fresh } or null. Never throws — a broken cache must
// not take down a request that could still be served live.
const read = (key) => {
  const hit = mem.get(key);
  if (hit) {
    touch(key, hit);
    const ageMs = Date.now() - hit.storedAt;
    return { body: hit.body, ageMs, fresh: ageMs < FRESH_MS };
  }

  for (const file of [fileFor(key), seedFileFor(key)]) {
    try {
      const { storedAt, body } = readEntry(file);
      touch(key, { storedAt, body });
      const ageMs = Date.now() - storedAt;
      return { body, ageMs, fresh: ageMs < FRESH_MS };
    } catch {
      /* try the next tier */
    }
  }
  return null;
};

const write = (key, body) => {
  const storedAt = Date.now();
  touch(key, { storedAt, body });
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    // Write then rename so a crash mid-write cannot leave a truncated entry.
    const tmp = fileFor(key) + ".tmp";
    writeEntry(tmp, { storedAt, body });
    fs.renameSync(tmp, fileFor(key));
  } catch (error) {
    console.error("Cache write failed:", error.message);
  }
};

const countJson = (dir) => {
  try {
    return fs.readdirSync(dir).filter((f) => f.endsWith(".json.gz")).length;
  } catch {
    return 0;
  }
};

const stats = () => ({
  memoryEntries: mem.size,
  diskEntries: countJson(CACHE_DIR),
  seedEntries: countJson(SEED_DIR),
  freshMs: FRESH_MS,
});

// Used by the seeding script to write straight into the committed tier.
const writeSeed = (key, body) => {
  fs.mkdirSync(SEED_DIR, { recursive: true });
  writeEntry(seedFileFor(key), { storedAt: Date.now(), body });
};

// ---------------------------------------------------------------------------
// Seed manifest
//
// Seed files are named by a hash of their key, so the directory alone cannot
// say which menus it holds. The manifest lists them, which is what lets an
// unknown restaurant fall back to a real menu instead of an error.
// ---------------------------------------------------------------------------
const MANIFEST = path.join(SEED_DIR, "manifest.json");

let manifestCache = null;

const listSeedMenus = () => {
  if (manifestCache) return manifestCache;
  try {
    manifestCache = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
  } catch {
    manifestCache = [];
  }
  return manifestCache;
};

// Deterministic pick: the same restaurantId always maps to the same stand-in
// menu, so a page does not change contents on every refresh.
const pickSeedMenu = (seed) => {
  const menus = listSeedMenus();
  if (!menus.length) return null;

  const digest = crypto.createHash("sha1").update(String(seed)).digest();
  const entry = menus[digest.readUInt32BE(0) % menus.length];
  try {
    return { ...entry, body: readEntry(path.join(SEED_DIR, entry.file)).body };
  } catch {
    return null;
  }
};

// Rebuilds manifest.json by reading every seed entry. Menus identify
// themselves through a Restaurant card carrying an id and name.
const buildManifest = () => {
  const menus = [];
  for (const file of fs.readdirSync(SEED_DIR)) {
    if (!file.endsWith(".json.gz")) continue;
    try {
      const { body } = readEntry(path.join(SEED_DIR, file));
      const info = (JSON.parse(body).data?.cards || [])
        .map((c) => c.card?.card?.info)
        .find((i) => i?.id && i?.name);
      if (info) menus.push({ file, id: String(info.id), name: info.name });
    } catch {
      /* skip unreadable entries */
    }
  }
  menus.sort((a, b) => a.id.localeCompare(b.id));
  fs.writeFileSync(MANIFEST, JSON.stringify(menus, null, 2));
  manifestCache = menus;
  return menus;
};

module.exports = {
  read,
  write,
  writeSeed,
  stats,
  listSeedMenus,
  pickSeedMenu,
  buildManifest,
};
