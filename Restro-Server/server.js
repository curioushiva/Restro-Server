const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(cors());

// Routes
const router = require("./routers/router");
app.use("/", router);

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
