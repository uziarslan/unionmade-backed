const express = require("express");
const wrapAsync = require("../utils/wrapAsync");
const { submitQuote } = require("../controllers/quote");

const router = express();

// Handling the Quote form
router.post("/quote-request", wrapAsync(submitQuote));

module.exports = router;
