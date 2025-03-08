const express = require("express");
const wrapAsync = require("../utils/wrapAsync");
const { protect } = require("../middlewares/authMiddleware");
const {
  fetchNotification,
  getNotifications,
  setNotificationStatus,
} = require("../controllers/notification");

const router = express();

// Get Notification for each user
router.get("/user-notifications", protect, wrapAsync(fetchNotification));

// Get notification for admin
router.get("/admin-notifications", protect, wrapAsync(getNotifications));

// Set notification status
router.post("/set-status/:id", protect, wrapAsync(setNotificationStatus));

module.exports = router;
