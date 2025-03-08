const express = require("express");
const wrapAsync = require("../utils/wrapAsync");
const { protect } = require("../middlewares/authMiddleware");
const {
  getAllProducts,
  fetchProduct,
  createCheckout,
  handleCheckoutSuccess,
  processOrder,
  fetchOrganizations,
  getAllProductsOrg,
} = require("../controllers/homepageRoutes");

const router = express();

// Get all products
router.get("/all-products", wrapAsync(getAllProducts));

router.get("/all-products-org", protect, wrapAsync(getAllProductsOrg));

// Fetch Single Product
router.get("/product/:id", wrapAsync(fetchProduct));

// Order Process using credits
router.post("/process-order", protect, wrapAsync(processOrder));

// Stripe checkout page
router.post("/create-checkout-session", wrapAsync(createCheckout));

// Stripe Payment Verified
router.post("/checkout-success", protect, wrapAsync(handleCheckoutSuccess));

// Fetch Organizations for the signup
router.get("/get-orgs", wrapAsync(fetchOrganizations));

module.exports = router;
