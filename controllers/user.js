const mongoose = require("mongoose");
const User = mongoose.model("User");
const Order = mongoose.model("Order");
const jwt = require("jsonwebtoken");
const { MailtrapClient } = require("mailtrap");

// Mailtrap Integration
const TOKEN = process.env.MAIL_TRAP_TOKEN;
const client = new MailtrapClient({ token: TOKEN });
const sender = {
  email: "info@unionmade.net",
  name: "Union Made Apparel",
};

const jwt_secret = process.env.JWT_SECRET;

const generateToken = (id) => {
  return jwt.sign({ id }, jwt_secret, {
    expiresIn: "30d",
  });
};

const signupUser = async (req, res) => {
  const { username, password } = req.body;
  const { file } = req;

  const foundUser = await User.findOne({ username });

  if (foundUser)
    return res
      .status(500)
      .json({ error: "Email already in use. Try differnt one." });

  if (!username) return res.status(500).json({ error: "Email is required." });

  if (!password)
    return res.status(500).json({ error: "Password is required." });

  const user = await User.create({
    ...req.body,
    doc: { filename: file.filename, path: file.path },
  });

  client.send({
    from: sender,
    to: [
      {
        email: user.username,
      },
    ],
    template_uuid: "a68ae9ac-b35f-4111-a468-286514bdb8b7",
    template_variables: {
      name: user.name,
    },
  });

  res.status(201).json({
    token: generateToken(user._id),
    success: "Your application is submitted for approval",
  });
};

const login = async (req, res) => {
  const { username, password } = req.body;

  const user = await User.findOne({ username });

  if (!user)
    return res.status(400).json({ error: "Invalid email or password" });

  if (await user.matchPassword(password)) {
    return res.status(201).json({
      token: generateToken(user._id),
    });
  }
  return res.status(400).json({ error: "Invalid email or password" });
};

const forgotPassword = async (req, res) => {
  const { username } = req.body;
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  const foundUser = await User.findOneAndUpdate(
    { username },
    { $set: { otp } },
    { new: true }
  );

  if (!foundUser) {
    return res
      .status(500)
      .json({ success: "Password reset email sent successfully" });
  }

  client.send({
    from: sender,
    to: [{ email: foundUser.username }],
    template_uuid: "3539f6b3-30c2-4b3d-bff5-b351a93a187c",
    template_variables: {
      name: foundUser.name,
      otp: foundUser.otp,
      link: `${process.env.DOMAIN_FRONTEND}/verify-code?id=${foundUser._id}`,
    },
  });

  return res.status(200).json({
    success: "Password reset email sent successfully",
    id: foundUser._id,
  });
};

const verifyCode = async (req, res) => {
  const { id } = req.params;
  const { otp } = req.body;

  const foundUser = await User.findById(id);

  if (!foundUser) {
    return res.status(500).json({ error: "Email not found" });
  }

  if (parseInt(foundUser.otp) !== parseInt(otp)) {
    return res.status(500).json({ error: "Code is incorrect" });
  } else {
    foundUser.otp = "";
    foundUser.save();
    return res.status(201).json({ success: "Code is verified" });
  }
};

const setNewPassword = async (req, res) => {
  const { id } = req.params;
  const { newPassword } = req.body;

  const foundUser = await User.findById(id);

  if (!foundUser) {
    return res.status(500).json({ error: "Email not found" });
  }

  foundUser.setPassword(newPassword, async (err) => {
    if (err) {
      return res.status(500).json({ error: "Password update failed" });
    }

    await foundUser.save();

    return res.status(201).json({ success: "Password updated successfully" });
  });
};

const resendOtp = async (req, res) => {
  const { id } = req.body;
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  const foundUser = await User.findByIdAndUpdate(
    id,
    { $set: { otp } },
    { new: true }
  );

  if (!foundUser) {
    return res
      .status(500)
      .json({ success: "Password reset email sent successfully" });
  }

  client.send({
    from: sender,
    to: [{ email: foundUser.username }],
    template_uuid: "3539f6b3-30c2-4b3d-bff5-b351a93a187c",
    template_variables: {
      name: foundUser.name,
      otp: foundUser.otp,
      link: `${process.env.DOMAIN_FRONTEND}/verify-code?id=${foundUser._id}`,
    },
  });

  return res.status(200).json({
    success: "Password reset email sent successfully",
    id: foundUser._id,
  });
};

const getUser = async (req, res) => {
  const user = await User.findById(req.user.id).select("-password");

  if (!user) {
    return res.status(400).json({ error: "Invalid user" });
  }
  res.json(user);
};

const fetchUserOrders = async (req, res) => {
  const { id } = req.user;

  const orders = await Order.find({ user: id }).populate("product");

  res.status(200).json(orders);
};

module.exports = {
  signupUser,
  getUser,
  login,
  forgotPassword,
  verifyCode,
  setNewPassword,
  resendOtp,
  fetchUserOrders,
};
