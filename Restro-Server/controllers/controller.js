const fetch = require("cross-fetch");

// Load env variables
const SWIGGY_RESTAURANT_API = process.env.SWIGGY_RESTAURANT_API;
const SWIGGY_MENU_API = process.env.SWIGGY_MENU_API;
const SWIGGY_LOC_API = process.env.SWIGGY_LOC_API;
const SWIGGY_GEO_API = process.env.SWIGGY_GEO_API;

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

  const url = `${SWIGGY_RESTAURANT_API}?lat=${lat}&lng=${lng}&page_type=${page_type || "DESKTOP_WEB_LISTING"}`;

  try {
    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36",
      },
    });

    if (!response.ok) throw new Error("Failed to fetch restaurants");

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("Restaurants API Error:", error.message);
    res.status(500).json({ error: error.message });
  }
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

  try {
    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    if (!response.ok) throw new Error("Failed to fetch menu");

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("Menu API Error:", error.message);
    res.status(500).json({ error: error.message });
  }
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
};
