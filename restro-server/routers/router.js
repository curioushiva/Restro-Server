const express = require("express");
const controller = require("../controllers/controller");

const router = express.Router();

// Base route
router.get("/", controller.initialData);

// Restaurants
router.get("/api/restaurants", controller.restaurantsData);

// Menu
router.get("/api/menu", controller.menuData);

// Place autocomplete
router.get("/api/misc/place-autocomplete", controller.placeAutocomplete);

// Place geo details
router.get("/api/misc/address-recommend", controller.geoData);

// Upstream + cache health
router.get("/api/status", controller.statusData);

module.exports = router;
