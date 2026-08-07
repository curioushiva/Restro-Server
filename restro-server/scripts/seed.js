/**
 * Bulk-populates the committed seed cache while a WAF token is alive.
 *
 * Swiggy's aws-waf-token expires within minutes, so it is not usable as a
 * long-lived server credential. It IS long enough to harvest a batch of menus
 * in one go, which is what this script does. Commit the resulting seed/ dir and
 * every deploy ships with working data.
 *
 *   1. Open swiggy.com, DevTools > Application > Cookies > aws-waf-token
 *   2. SWIGGY_WAF_TOKEN="<value>" node scripts/seed.js [lat] [lng] [limit]
 *   3. git add seed && git commit
 */
require("dotenv").config();
const fetch = require("cross-fetch");
const cache = require("../utils/cache");

const TOKEN = process.env.SWIGGY_WAF_TOKEN;
const [lat = "12.9716", lng = "77.5946", limit = "25"] = process.argv.slice(2);

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const headers = {
  "Content-Type": "application/json",
  "User-Agent": UA,
  ...(TOKEN ? { Cookie: `aws-waf-token=${TOKEN}` } : {}),
};

const get = async (url) => {
  const response = await fetch(url, { headers });
  const body = await response.text();
  if (!response.ok) throw new Error(`status ${response.status}`);
  if (!body) throw new Error(`empty body (status ${response.status}) — token dead?`);
  return body;
};

(async () => {
  if (!TOKEN) {
    console.error("SWIGGY_WAF_TOKEN is required. See the header of this file.");
    process.exit(1);
  }

  const listUrl = `${process.env.SWIGGY_RESTAURANT_API}?lat=${lat}&lng=${lng}&page_type=DESKTOP_WEB_LISTING`;
  console.log(`Fetching restaurant list for ${lat},${lng} ...`);
  const listBody = await get(listUrl);
  cache.writeSeed(
    `restaurants:${Number(lat).toFixed(2)}:${Number(lng).toFixed(2)}:DESKTOP_WEB_LISTING`,
    listBody
  );

  const ids = [
    ...new Set(
      (JSON.parse(listBody).data?.cards || [])
        .flatMap(
          (c) => c.card?.card?.gridElements?.infoWithStyle?.restaurants || []
        )
        .map((r) => r.info?.id)
        .filter(Boolean)
    ),
  ].slice(0, Number(limit));

  console.log(`Seeding ${ids.length} menus ...`);
  let ok = 0;
  for (const id of ids) {
    const url = `${process.env.SWIGGY_MENU_API}?page-type=REGULAR_MENU&complete-menu=true&lat=${lat}&lng=${lng}&restaurantId=${id}&submitAction=ENTER`;
    try {
      cache.writeSeed(`menu:${id}`, await get(url));
      ok++;
      console.log(`  ok   ${id}`);
    } catch (error) {
      console.error(`  FAIL ${id}: ${error.message}`);
      if (error.message.includes("token dead")) {
        console.error("\nToken expired mid-run. Grab a fresh one and re-run.");
        break;
      }
    }
  }

  const menus = cache.buildManifest();
  console.log(`\nSeeded ${ok}/${ids.length} menus. Pile now holds ${menus.length}.`);
  console.log("Commit the seed/ directory to make this survive deploys.");
})();
