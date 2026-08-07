const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
// Custom headers are invisible to browser JS unless explicitly exposed, and the
// frontend needs them to tell real menus from seeded stand-ins.
app.use(
  cors({
    exposedHeaders: [
      "X-Cache",
      "X-Cache-Age",
      "X-Fallback-Restaurant-Id",
      "X-Fallback-Restaurant-Name",
    ],
  })
);

// Routes
const router = require("./routers/router");
app.use("/", router);

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
