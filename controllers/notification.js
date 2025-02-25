const mongoose = require("mongoose");
const Notifi = mongoose.model("Notification");

const fetchNotification = async (req, res) => {
  const { id } = req.user;
  const notifi = await Notifi.find({ to: id }).populate("to");
  res.status(200).json(notifi);
};

const getNotifications = async (req, res) => {
  const { id } = req.user;
  const notifi = await Notifi.find({ from: id }).populate("to");
  res.status(200).json(notifi);
};

const setNotificationStatus = async (req, res) => {
  const { id } = req.params;

  const notifi = await Notifi.findByIdAndUpdate(id, { status: "hide" });

  if (!notifi)
    return res.status(404).json({ error: "Notification not found." });

  res.status(201).json({ success: "Notification is deleted." });
};

module.exports = {
  fetchNotification,
  getNotifications,
  setNotificationStatus,
};
