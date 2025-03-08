const express = require("express");
const wrapAsync = require("../utils/wrapAsync");
const { protect } = require("../middlewares/authMiddleware");
const {
  registerTalent,
  orgSignup,
  handleLogin,
  forgotPassword,
  verifyCode,
  setNewPassword,
  getUser,
} = require("../controllers/auth");

const router = express();

// Talent Signup Route
router.post("/signup", wrapAsync(registerTalent));

// Organization Signup Route
router.post("/org/signup", wrapAsync(orgSignup));

// Talent and Org Login Route
router.post("/login", wrapAsync(handleLogin));

// Forgot Password Logic
router.post("/forgot/password", wrapAsync(forgotPassword));

router.post("/verify-code", wrapAsync(verifyCode));

router.post("/newpassword", wrapAsync(setNewPassword));

// Fetching the Talent and Org logged in user
router.get("/user", protect, wrapAsync(getUser));

module.exports = router;
