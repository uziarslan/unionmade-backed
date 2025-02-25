const mongoose = require("mongoose");

const paymentMethodSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ["credits", "stripe"],
    default: "credits",
  },
  chargeId: {
    type: String,
    required: function () {
      return this.type === "stripe";
    },
  },
  paymentStatus: {
    type: String,
    enum: ["paid", "refunded", "hold"],
    default: "pending",
  },
});

const orderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
    },
    size: {
      type: String,
    },
    customSizes: {
      type: Map,
      of: String,
    },
    totalAmount: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ["Mockup", "Pre-production", "Production", "Shipped"],
      default: "Mockup",
    },
    orderDate: {
      type: Date,
      default: Date.now,
    },
    paymentMethod: paymentMethodSchema,
  },
  { timestamps: true }
);

module.exports = mongoose.model("Order", orderSchema);
