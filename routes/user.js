const express = require("express");
const wrapAsync = require("../utils/wrapAsync");
const { protect } = require("../middlewares/authMiddleware");
const {
  signupUser,
  getUser,
  login,
  forgotPassword,
  verifyCode,
  setNewPassword,
  resendOtp,
  fetchUserOrders,
} = require("../controllers/user");
const multer = require("multer");
const { storage } = require("../cloudinary");
const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 },
});

const router = express();

// Signup User
router.post("/signup", upload.single("image"), wrapAsync(signupUser));

// Login Router
router.post("/login", wrapAsync(login));

// Fetch user details
router.get("/user", protect, wrapAsync(getUser));

// Forgot password fetching email and sending otp
router.post("/forgot-password", wrapAsync(forgotPassword));

// Verify The code
router.post("/verify-code/:id", wrapAsync(verifyCode));

// Set new password
router.post("/new-password/:id", wrapAsync(setNewPassword));

// Resend OTP
router.post("/resend-otp", wrapAsync(resendOtp));

// Fetch user orders
router.get("/user-orders", protect, wrapAsync(fetchUserOrders));

module.exports = router;
