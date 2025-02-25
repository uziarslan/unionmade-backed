const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    from: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },
    to: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    title: {
      type: String,
    },
    description: {
      type: String,
    },
    adminDescription: {
      type: String,
    },
    status: {
      type: String,
      enum: ["show", "hide"],
      default: "show",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Notification", notificationSchema);
