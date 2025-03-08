const express = require("express");
const wrapAsync = require("../utils/wrapAsync");
const { protect } = require("../middlewares/authMiddleware");
const {
  registerAdmin,
  adminLogin,
  getAdmin,
  createProduct,
  getProducts,
  deleteImg,
  deleteProduct,
  editProduct,
  fetchCustomers,
  customerProfile,
  getQuotes,
  fetchOrders,
  changeOrderStatus,
  getReport,
  fetchOrganizations,
  createOrganization,
  deleteOrganization,
  editOrganization,
  generateInvoices,
} = require("../controllers/admin");
const multer = require("multer");
const { storage } = require("../cloudinary");
const upload = multer({ storage });

const router = express();

// Handling and saving the admin credentials
router.post("/admin/signup", wrapAsync(registerAdmin));

// Fetching and verify user request
router.post("/admin/login", wrapAsync(adminLogin));

// Fetching User for frontend
router.get("/admin", protect, wrapAsync(getAdmin));

// Create Product
router.post(
  "/create-product",
  protect,
  upload.array("images"),
  wrapAsync(createProduct)
);

// Get all products
router.get("/get-products", protect, wrapAsync(getProducts));

// Delete Img from Cloudinary
router.delete("/delete-img", protect, wrapAsync(deleteImg));

// Deleting product and its images from cloudinary
router.delete("/delete-product/:id", protect, wrapAsync(deleteProduct));

// Editing product info and uploading the images to cloudinary if any
router.put(
  "/edit-product/:id",
  upload.array("images"),
  protect,
  wrapAsync(editProduct)
);

// Get all customers for the table
router.get("/fetch-customers", protect, wrapAsync(fetchCustomers));

// Customer Profile activation and credits allocation
router.post("/customer-profile/:id", protect, wrapAsync(customerProfile));

// Fetching the details for admin of Request Quote
router.get("/get-quotes", protect, wrapAsync(getQuotes));

// Fetching the orders
router.get("/fetch-orders", protect, wrapAsync(fetchOrders));

// Change order status
router.post("/order-status", protect, wrapAsync(changeOrderStatus));

// Generate reports
router.post("/generate-report", protect, wrapAsync(getReport));

// Fetch all organizations
router.get("/get-all-org", protect, wrapAsync(fetchOrganizations));

//Creating Org
router.post("/create-organization", protect, wrapAsync(createOrganization));

// New route for deleting an organization
router.delete(
  "/delete-organization/:id",
  protect,
  wrapAsync(deleteOrganization)
);

// Edit Organization
router.put("/edit-organization/:id", protect, wrapAsync(editOrganization));

//Generating Wave invoices
router.post("/generate-invoices", protect, wrapAsync(generateInvoices));

module.exports = router;
