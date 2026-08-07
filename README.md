# 🍽️ Restro Server  

A minimal **Node.js + Express** backend powering the Restro App. It’s inspired by [`Mr Chetan Nadda’s FoodFire Server`](https://github.com/chetannada/FoodFire-Server) and extended with extra endpoints like **location autocomplete** and **geo lookup** to enhance restaurant discovery.  

<hr style="height:3px; border:none; background-color:#3D444D;">

## 🛠 Features  
- Restaurant listings by latitude & longitude  
- Detailed restaurant menus  
- Place autocomplete (search as you type)  
- Address/Geo lookup via place ID  
- Cached responses with a committed seed pile, so menus keep working when Swiggy blocks the server  
- Sample-menu fallback for restaurants that aren’t in the pile  
- `/api/status` health endpoint  
- Modular Express structure  

<hr style="height:3px; border:none; background-color:#3D444D;">

## 📁 Repository layout

The Express app lives in a **subfolder**, not at the repo root:

```text
restro-server/            <- repo root
├── README.md
└── restro-server/        <- the app; run every command from here
    ├── server.js
    ├── package.json
    ├── controllers/
    ├── routers/
    ├── scripts/seed.js   <- downloads menus into seed/
    ├── utils/cache.js
    └── seed/             <- committed menu pile (~5 MB gzipped)
```

<hr style="height:3px; border:none; background-color:#3D444D;">

## ⚡ Setup & Installation  

### 1. Clone this repo  
```bash
git clone https://github.com/curioushiva/restro-server.git
cd restro-server/restro-server
```

### 2. Install dependencies  
```bash
npm install
```

### 3. Configure environment variables  
```bash
PORT=5000

SWIGGY_RESTAURANT_API=https://www.swiggy.com/dapi/restaurants/list/v5
SWIGGY_MENU_API=https://www.swiggy.com/dapi/menu/pl
SWIGGY_LOC_API=https://www.swiggy.com/dapi/misc/place-autocomplete
SWIGGY_GEO_API=https://www.swiggy.com/dapi/misc/address-recommend

# Only needed when re-seeding menus — see "Seeding menus" below
SWIGGY_WAF_TOKEN=
```

> `SWIGGY_LOC_API` and `SWIGGY_GEO_API` take **no** `?input=` / `?place_id=` suffix. Swiggy serves those two as `POST` endpoints; the server converts the incoming `GET` query into the POST body.

### 4. Start the server  
```bash
npm run start
```

Runs locally at → [http://localhost:5000](http://localhost:5000)  

<hr style="height:3px; border:none; background-color:#3D444D;">

## 📡 Endpoints

| Method | Route | Query params |
| --- | --- | --- |
| `GET` | `/` | — |
| `GET` | `/api/restaurants` | `lat`, `lng`, optional `page_type` |
| `GET` | `/api/menu` | `restaurantId`, `lat`, `lng` |
| `GET` | `/api/misc/place-autocomplete` | `input` |
| `GET` | `/api/misc/address-recommend` | `place_id` |
| `GET` | `/api/status` | — |

Fetch restaurants near a location:  
```javascript
const response = await fetch(
    "http://localhost:5000/api/restaurants?lat=12.9351929&lng=77.62448069999999&page_type=DESKTOP_WEB_LISTING"
);
const data = await response.json();
```

<hr style="height:3px; border:none; background-color:#3D444D;">

## 🍽️ How menus work now

Swiggy put **AWS WAF bot protection** on `/dapi/menu/pl`. It answers a server-side request with an empty `202` unless a short-lived browser token is attached. That token expires in roughly 10–20 minutes, so it can’t be stored as a server credential.

The server works around this by keeping menus it already downloaded. Every menu request resolves in this order:

1. **Fresh cache** → serve it, never touch Swiggy
2. **Live fetch** → if Swiggy answers, serve it and cache it
3. **Stale cache** → Swiggy blocked us, but we have older data for *that* restaurant
4. **Seed fallback** → no data for that restaurant, so serve a **different** restaurant’s real menu as a placeholder
5. **`502`** → nothing at all to serve

The response body is always ordinary Swiggy menu JSON. Which case you got is reported in headers:

| `X-Cache` | Meaning |
| --- | --- |
| `HIT` | Real menu for that restaurant, from cache |
| `MISS` | Real menu, just fetched live |
| `STALE` | Real menu for that restaurant, older data |
| `FALLBACK` | **A different restaurant’s menu.** Placeholder |

On `FALLBACK`, two extra headers name what was actually sent:

- `X-Fallback-Restaurant-Id`
- `X-Fallback-Restaurant-Name` — URI-encoded, run through `decodeURIComponent()`

All four are listed in `Access-Control-Expose-Headers`, so browser JS can read them. The frontend uses this to show a “sample menu” notice.

The fallback is **deterministic** — the same `restaurantId` always maps to the same placeholder, so a page doesn’t change contents on refresh.

### Cache tiers

| Tier | Location | Survives redeploy? |
| --- | --- | --- |
| Memory | process | no |
| Runtime disk | `.cache/` (gitignored) | no — Render wipes disk on deploy and spin-down |
| Seed | `seed/` (committed) | **yes** |

That’s why the seed pile is committed: it’s the only tier guaranteed present on a cold boot.

<hr style="height:3px; border:none; background-color:#3D444D;">

## 🌱 Seeding menus

The pile currently holds ~110 menus across Bangalore, Delhi, Mumbai, Hyderabad and Pune. Re-seed to refresh prices or add cities.

**The token expires in ~10–20 minutes, so do steps 1 and 2 back to back.**

### 1. Grab a fresh WAF token

1. Open [swiggy.com](https://www.swiggy.com) in your browser
2. `F12` → **Application** tab
3. **Cookies** → `https://www.swiggy.com`
4. Find **`aws-waf-token`** and copy its full value

### 2. Run the seed script

```powershell
cd restro-server            # the inner folder
$env:SWIGGY_WAF_TOKEN="<paste token>"
node scripts/seed.js 12.9716 77.5946 25
```

```bash
# macOS / Linux
SWIGGY_WAF_TOKEN="<paste token>" node scripts/seed.js 12.9716 77.5946 25
```

Arguments are `<lat> <lng> <how-many-menus>`. Run it repeatedly with different coordinates to add cities — each run **adds** to the pile rather than replacing it.

| City | Command |
| --- | --- |
| Bangalore | `node scripts/seed.js 12.9716 77.5946 25` |
| Delhi | `node scripts/seed.js 28.5247418 77.1554539 25` |
| Mumbai | `node scripts/seed.js 19.0760 72.8777 25` |
| Hyderabad | `node scripts/seed.js 17.3850 78.4867 25` |
| Pune | `node scripts/seed.js 18.5204 73.8567 25` |

Expected output:

```text
Fetching restaurant list for 12.9716,77.5946 ...
Seeding 25 menus ...
  ok   10575
  ok   699427
  ...
Seeded 25/25 menus. Pile now holds 110.
Commit the seed/ directory to make this survive deploys.
```

If you see `FAIL ... token dead?`, the token expired mid-run — grab a new one and re-run. Whatever succeeded before that point is already saved.

### 3. Commit the pile

```bash
git add seed && git commit -m "Refresh seeded menus" && git push
```

Render redeploys automatically. **Menus are only as current as your last seeding run** — there is no way around that while Swiggy blocks live access.

### Notes

- Entries are gzipped (~5 MB total instead of ~69 MB raw)
- `seed/manifest.json` indexes the pile and is rebuilt automatically after each run
- Seeding is the **only** thing `SWIGGY_WAF_TOKEN` is for. Leave it unset in production — the server runs fine without it

<hr style="height:3px; border:none; background-color:#3D444D;">

## 🩺 Health check

```bash
curl http://localhost:5000/api/status
```

```json
{
  "wafTokenConfigured": false,
  "upstream": {
    "menu": { "ok": false, "detail": "empty body (status 202)", "at": "..." },
    "restaurants": { "ok": true, "detail": "200", "at": "..." }
  },
  "cache": { "memoryEntries": 1, "diskEntries": 0, "seedEntries": 115, "freshMs": 21600000 }
}
```

`"ok": false` with `empty body (status 202)` on `menu` is **normal** — that’s Swiggy’s WAF, and the seed pile is covering for it.

<hr style="height:3px; border:none; background-color:#3D444D;">

## ☁️ Deployment  

1. Push this repo to your GitHub.  
2. Create a **Web Service** on **Render** (or any Node host).  
3. Set these, because the app is in a subfolder:

   | Field | Value |
   | --- | --- |
   | Root Directory | `restro-server` |
   | Build Command | `npm install` |
   | Start Command | `npm start` |

4. Add the **.env variables** in the hosting dashboard. Leave `SWIGGY_WAF_TOKEN` empty. Don’t set `PORT` — Render injects its own.  
5. Update your Restro frontend to use your deployed server URL:  

```javascript
const response = await fetch(
    "https://your-restro-server.onrender.com/api/restaurants?lat=12.93&lng=77.62"
);
```

> On Render’s free tier the instance sleeps after ~15 minutes idle, so the first request after a lull takes 30–60s to cold-start.

<hr style="height:3px; border:none; background-color:#3D444D;">

## ⚙️ Optional configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `CACHE_TTL_MS` | `21600000` (6h) | How long a cached entry counts as fresh before a live re-fetch is attempted |
| `CACHE_DIR` | `.cache` | Runtime cache location |
| `SEED_DIR` | `seed` | Committed seed pile location |

<hr style="height:3px; border:none; background-color:#3D444D;">

## 🙏 Acknowledgments  
Special thanks to [`Mr Chetan Nadda`](https://github.com/chetannada) for his excellent work on the  [`FoodFire Server`](https://github.com/chetannada/FoodFire-Server) which served as the foundation and inspiration for building Restro Server.  

<hr style="height:3px; border:none; background-color:#3D444D;">

## 👨‍💻 Author  
Built with <3 by **[`Curiosuhiva`](https://www.instagram.com/curioushiva/)** to power the Restro App.  
