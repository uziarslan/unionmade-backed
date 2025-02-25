const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    productName: String,
    productCode: String,
    productPrice: String,
    sizes: [
      {
        type: String,
      },
    ],
    minQty: String,
    status: String,
    discount: String,
    endTime: Date,
    images: [
      {
        filename: String,
        path: String,
      },
    ],
    description: String,
    stage: {
      type: String,
      enum: ["Mockup", "Pre-production", "Production", "Shipped"],
      default: "Mockup",
    },
    funded: {
      type: Number,
      default: 0,
    },
    orders: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Order",
      },
    ],
    expired: {
      type: Boolean,
      enum: [true, false],
      default: false,
    },
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Product", productSchema);
