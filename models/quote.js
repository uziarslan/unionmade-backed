const mongoose = require("mongoose");

const quoteSchema = new mongoose.Schema(
  {
    username: {
      type: String,
    },
    companyName: {
      type: String,
    },
    companyPosition: {
      type: String,
    },
    name: {
      type: String,
    },
    message: {
      type: String,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Quote", quoteSchema);
