# 🍽️ Restro Server  

A minimal **Node.js + Express** backend powering the Restro App. Inspired by [`Mr Chetan Nadda’s FoodFire Server`](https://github.com/chetannada/FoodFire-Server), extended with **location autocomplete**, **geo lookup**, and a cached menu layer.

<hr style="height:3px; border:none; background-color:#3D444D;">

## ⚡ Setup  

The Express app lives in a **subfolder**, so run everything from `restro-server/restro-server`:

```bash
git clone https://github.com/curioushiva/restro-server.git
cd restro-server/restro-server
npm install
npm run start
```

Runs at → [http://localhost:5000](http://localhost:5000)

`.env`:

```bash
PORT=5000

SWIGGY_RESTAURANT_API=https://www.swiggy.com/dapi/restaurants/list/v5
SWIGGY_MENU_API=https://www.swiggy.com/dapi/menu/pl
SWIGGY_LOC_API=https://www.swiggy.com/dapi/misc/place-autocomplete
SWIGGY_GEO_API=https://www.swiggy.com/dapi/misc/address-recommend

SWIGGY_WAF_TOKEN=      # only needed for re-seeding, see below
```

> The last two take **no** `?input=` / `?place_id=` suffix — Swiggy serves them as POST, and the server builds the body from the query.

<hr style="height:3px; border:none; background-color:#3D444D;">

## 📡 Endpoints

| Route | Query params |
| --- | --- |
| `GET /` | — |
| `GET /api/restaurants` | `lat`, `lng`, optional `page_type` |
| `GET /api/menu` | `restaurantId`, `lat`, `lng` |
| `GET /api/misc/place-autocomplete` | `input` |
| `GET /api/misc/address-recommend` | `place_id` |
| `GET /api/status` | — (cache + upstream health) |

```javascript
const response = await fetch(
    "http://localhost:5000/api/restaurants?lat=12.9351929&lng=77.62448069999999"
);
```

<hr style="height:3px; border:none; background-color:#3D444D;">

## 🍽️ How menus work

Swiggy put **AWS WAF bot protection** on `/dapi/menu/pl` — it answers server-side requests with an empty `202` unless a browser token is attached, and that token dies in ~10–20 minutes. So the server serves menus it downloaded earlier, resolving in this order:

**fresh cache → live fetch → stale cache → a different restaurant's menu → `502`**

The body is always normal Swiggy menu JSON. Which case you got comes back in `X-Cache`:

| Value | Meaning |
| --- | --- |
| `HIT` / `MISS` / `STALE` | Real menu for that restaurant |
| `FALLBACK` | **A different restaurant's menu**, as a placeholder |

On `FALLBACK`, `X-Fallback-Restaurant-Id` and `X-Fallback-Restaurant-Name` (URI-encoded) name what was actually sent — the frontend uses these to show a "sample menu" notice. All four headers are CORS-exposed. The same `restaurantId` always maps to the same placeholder, so pages don't change on refresh.

Menus live in `seed/` (committed, gzipped, ~5 MB). The runtime `.cache/` tier doesn't survive a redeploy — Render wipes disk — which is why the pile is committed.

<hr style="height:3px; border:none; background-color:#3D444D;">

## 🌱 Re-seeding menus

The pile holds ~110 menus across Bangalore, Delhi, Mumbai, Hyderabad and Pune. **Menus are only as current as your last run.**

The token expires fast, so do these back to back:

1. On [swiggy.com](https://www.swiggy.com): `F12` → **Application** → **Cookies** → copy **`aws-waf-token`**
2. From `restro-server/restro-server`:

   ```powershell
   $env:SWIGGY_WAF_TOKEN="<paste token>"
   node scripts/seed.js 12.9716 77.5946 25      # <lat> <lng> <count>
   ```

3. `git add seed && git commit -m "Refresh seeded menus" && git push`

Re-run step 2 with other coordinates to add cities — each run **adds** to the pile. Delhi `28.5247418 77.1554539` · Mumbai `19.0760 72.8777` · Hyderabad `17.3850 78.4867` · Pune `18.5204 73.8567`.

`FAIL ... token dead?` means the token expired mid-run; grab a new one and re-run. Anything already downloaded is saved.

Optional: `CACHE_TTL_MS` (default 6h), `CACHE_DIR`, `SEED_DIR`.

<hr style="height:3px; border:none; background-color:#3D444D;">

## ☁️ Deployment  

On Render, because the app is in a subfolder:

| Field | Value |
| --- | --- |
| Root Directory | `restro-server` |
| Build Command | `npm install` |
| Start Command | `npm start` |

Add the `.env` variables in the dashboard — leave `SWIGGY_WAF_TOKEN` empty and don't set `PORT`, Render injects its own. Free-tier instances sleep after ~15 min idle, so the first request cold-starts in 30–60s.

In `/api/status`, `"ok": false` with `empty body (status 202)` on `menu` is **normal** — that's the WAF, and the seed pile is covering for it.

<hr style="height:3px; border:none; background-color:#3D444D;">

## 🙏 Acknowledgments  
Special thanks to [`Mr Chetan Nadda`](https://github.com/chetannada) for his excellent work on the [`FoodFire Server`](https://github.com/chetannada/FoodFire-Server) which served as the foundation and inspiration for building Restro Server.  

## 👨‍💻 Author  
Built with <3 by **[`Curiosuhiva`](https://www.instagram.com/curioushiva/)** to power the Restro App.  
