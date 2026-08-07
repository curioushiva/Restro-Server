const fetch = require("cross-fetch");
const cache = require("../utils/cache");

// Load env variables
const SWIGGY_RESTAURANT_API = process.env.SWIGGY_RESTAURANT_API;
const SWIGGY_MENU_API = process.env.SWIGGY_MENU_API;
const SWIGGY_LOC_API = process.env.SWIGGY_LOC_API;
const SWIGGY_GEO_API = process.env.SWIGGY_GEO_API;

// Swiggy fronts /dapi/menu/pl with AWS WAF, which silently answers 202 with an
// empty body unless a valid aws-waf-token is present. The token is issued to a
// browser session and expires, so it lives in the environment rather than here.
const SWIGGY_WAF_TOKEN = process.env.SWIGGY_WAF_TOKEN;

const swiggyCookie = () =>
  SWIGGY_WAF_TOKEN ? { Cookie: `aws-waf-token=${SWIGGY_WAF_TOKEN}` } : {};

// Last upstream outcome per endpoint, surfaced by /api/status so an expired
// token is visible without digging through logs.
const upstreamState = {};

const recordUpstream = (name, ok, detail) => {
  upstreamState[name] = { ok, detail, at: new Date().toISOString() };
};

// Fetch through the cache: fresh cache wins, then live, then stale cache.
// The response body is always exactly what Swiggy returns, so callers cannot
// tell the difference; freshness is reported in X-Cache / X-Cache-Age instead.
const serveCached = async (res, { name, key, url, headers, fallbackSeed }) => {
  const cached = cache.read(key);

  if (cached && cached.fresh) {
    res.set({ "X-Cache": "HIT", "X-Cache-Age": String(cached.ageMs) });
    return res.type("json").send(cached.body);
  }

  try {
    const response = await fetch(url, { headers });
    if (!response.ok) throw new Error(`upstream status ${response.status}`);

    // AWS WAF answers 202 with an empty body rather than an error status, so
    // response.ok is true while there is nothing to parse.
    const body = await response.text();
    if (!body) throw new Error(`empty body (status ${response.status})`);

    JSON.parse(body); // reject truncated/HTML responses before caching them
    cache.write(key, body);
    recordUpstream(name, true, `${response.status}`);
    res.set("X-Cache", "MISS");
    return res.type("json").send(body);
  } catch (error) {
    recordUpstream(name, false, error.message);
    console.error(`${name} upstream failed:`, error.message);

    if (cached) {
      console.error(`${name}: serving stale cache (${cached.ageMs}ms old)`);
      res.set({ "X-Cache": "STALE", "X-Cache-Age": String(cached.ageMs) });
      return res.type("json").send(cached.body);
    }

    // Nothing real to serve. Rather than leave the page empty, stand in a
    // menu from the seed pile. It belongs to a different restaurant, so the
    // response is flagged and the real identity is passed back for the UI to
    // label — callers must not present this as the requested restaurant.
    if (fallbackSeed) {
      const stand = cache.pickSeedMenu(fallbackSeed);
      if (stand) {
        console.error(`${name}: no data for ${fallbackSeed}, standing in ${stand.id}`);
        res.set({
          "X-Cache": "FALLBACK",
          "X-Fallback-Restaurant-Id": stand.id,
          "X-Fallback-Restaurant-Name": encodeURIComponent(stand.name),
        });
        return res.type("json").send(stand.body);
      }
    }

    return res.status(502).json({
      error: "Upstream unavailable and nothing cached",
      detail: error.message,
      hint:
        name === "menu" && !SWIGGY_WAF_TOKEN
          ? "SWIGGY_WAF_TOKEN is not set"
          : name === "menu"
          ? "SWIGGY_WAF_TOKEN may have expired — refresh it"
          : undefined,
    });
  }
};

// Initial endpoint (test)
const initialData = (req, res) => {
  res.json({
    message:
      "Welcome to Restro Server",
  });
};

// Restaurants data
const restaurantsData = async (req, res) => {
  const { lat, lng, page_type } = req.query;
  if (!lat || !lng) {
    return res.status(400).json({ error: "lat and lng are required" });
  }

  const type = page_type || "DESKTOP_WEB_LISTING";
  const url = `${SWIGGY_RESTAURANT_API}?lat=${lat}&lng=${lng}&page_type=${type}`;

  // Coordinates are rounded into ~1km buckets so nearby users share a cache
  // entry instead of each minting their own.
  const bucket = (v) => Number(v).toFixed(2);

  return serveCached(res, {
    name: "restaurants",
    key: `restaurants:${bucket(lat)}:${bucket(lng)}:${type}`,
    url,
    headers: {
      "Content-Type": "application/json",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36",
      ...swiggyCookie(),
    },
  });
};

// Menu data
const menuData = async (req, res) => {
  const {
    "page-type": page_type = "REGULAR_MENU",
    "complete-menu": complete_menu = true,
    lat,
    lng,
    restaurantId,
    submitAction = "ENTER",
  } = req.query;

  if (!restaurantId) {
    return res.status(400).json({ error: "restaurantId is required" });
  }

  const url = `${SWIGGY_MENU_API}?page-type=${page_type}&complete-menu=${complete_menu}&lat=${lat}&lng=${lng}&restaurantId=${restaurantId}&submitAction=${submitAction}`;

  // Keyed on restaurantId alone: a menu is the same regardless of which
  // coordinates the caller happened to look it up from.
  return serveCached(res, {
    name: "menu",
    key: `menu:${restaurantId}`,
    fallbackSeed: restaurantId,
    url,
    headers: {
      "Content-Type": "application/json",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      ...swiggyCookie(),
    },
  });
};

// Operational status: is the WAF token still working, and what is cached?
const statusData = (req, res) => {
  res.json({
    wafTokenConfigured: Boolean(SWIGGY_WAF_TOKEN),
    upstream: upstreamState,
    cache: cache.stats(),
  });
};

// Place autocomplete
const placeAutocomplete = async (req, res) => {
  const { input } = req.query;

  if (!input || input.trim() === "") {
    return res.json({ data: [] });
  }

  try {
    const response = await fetch(SWIGGY_LOC_API, {
      method: "POST", 
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0",
        "origin": "https://www.swiggy.com",
        "referer": "https://www.swiggy.com/search"
      },
      body: JSON.stringify({
        input: input,
        types: []
      })
    });

    if (!response.ok) {
      throw new Error(`Failed: ${response.status}`);
    }

    const data = await response.json();
    res.json(data);

  } catch (error) {
    console.error("Autocomplete API Error:", error.message);
    res.status(500).json({ error: error.message });
  }
};

// Place geo details
const geoData = async (req, res) => {
  const { place_id } = req.query;

  if (!place_id) {
    return res.json({ data: [] });
  }

  try {
    const response = await fetch(SWIGGY_GEO_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0",
        "origin": "https://www.swiggy.com",
        "referer": "https://www.swiggy.com/order-online-near-me"
      },
      body: JSON.stringify({
        place_id: place_id
      })
    });

    if (!response.ok) {
      throw new Error(`Failed: ${response.status}`);
    }

    const data = await response.json();
    res.json(data);

  } catch (error) {
    console.error("Geo API Error:", error.message);
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  initialData,
  restaurantsData,
  menuData,
  placeAutocomplete,
  geoData,
  statusData,
};
