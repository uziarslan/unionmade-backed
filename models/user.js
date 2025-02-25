const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    status: { type: String, enum: ["active", "inactive"], default: "inactive" },
    name: String,
    credits: { type: Number, default: 0 },
    otp: String,
    doc: { filename: String, path: String },
  },
  { timestamps: true }
);

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.setPassword = async function (newPassword, callback) {
  try {
    this.password = newPassword;
    await this.save();
    if (callback) callback(null);
  } catch (error) {
    if (callback) callback(error);
  }
};

userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model("User", userSchema);
