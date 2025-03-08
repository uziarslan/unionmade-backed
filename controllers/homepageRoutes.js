const mongoose = require("mongoose");
const Product = mongoose.model("Product");
const Order = mongoose.model("Order");
const User = mongoose.model("User");
const Org = mongoose.model("Organization");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const YOUR_DOMAIN = process.env.DOMAIN_FRONTEND;

const getAllProducts = async (req, res) => {
  const products = await Product.find({});
  res.status(200).json(products);
};

const getAllProductsOrg = async (req, res) => {
  let products;
  if (req.user && req.user.organization) {
    products = await Product.find({ organization: req.user.organization });
  }
  res.status(200).json(products);
};

const fetchProduct = async (req, res) => {
  const { id } = req.params;
  const product = await Product.findById(id);

  if (!product)
    return res.status(404).json({ error: "Unable to find product." });

  res.status(200).json(product);
};

const processOrder = async (req, res) => {
  const { cart, totalPrice } = req.body;
  const { id } = req.user;

  await Promise.all(
    cart.map(async (item) => {
      const product = await Product.findById(item.product._id);
      const order = new Order({
        user: id,
        product: item.product._id,
        quantity: item.qty,
        size: item.size,
        totalAmount: parseInt(item.qty) * parseInt(product.productPrice),
        paymentMethod: {
          type: "credits",
          paymentStatus: "hold",
        },

        customSizes: item.customSizes ? item.customSizes : undefined,
      });

      await order.save();

      if (product) {
        product.orders.push(order._id);
        product.funded += item.qty;
        await product.save();
      }
    })
  );

  await User.findByIdAndUpdate(
    id,
    { $inc: { credits: -totalPrice } },
    { new: true }
  );

  res.status(201).json({ success: "Order successfully created" });
};

const createCheckout = async (req, res) => {
  const { cart } = req.body;

  const lineItems = cart.map((item) => ({
    price_data: {
      currency: "usd",
      product_data: {
        name: item.product.productName,
        description: item.product.description,
      },
      unit_amount: Math.round(parseFloat(item.product.productPrice) * 100),
    },
    quantity: item.qty,
  }));

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    line_items: lineItems,
    mode: "payment",
    success_url: `${YOUR_DOMAIN}/payment-success?success=true&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${YOUR_DOMAIN}/payment-cancel?canceled=true`,
    metadata: {
      custom_product_ids: JSON.stringify(cart.map((item) => item.product._id)),
    },
  });

  res.status(200).json({ url: session.url });
};

const handleCheckoutSuccess = async (req, res) => {
  const { sessionId, cart } = req.body;
  const { id } = req.user;

  const session = await stripe.checkout.sessions.retrieve(sessionId);
  const paymentIntentId = session.payment_intent;
  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
  const chargeId = paymentIntent.latest_charge;

  await Promise.all(
    cart.map(async (item) => {
      const product = await Product.findById(item.product._id);
      const order = new Order({
        user: id,
        product: item.product._id,
        quantity: item.qty,
        size: item.size,
        totalAmount: parseInt(item.qty) * parseInt(product.productPrice),
        paymentMethod: {
          type: "stripe",
          chargeId,
          paymentStatus: "hold",
        },
        customSizes: item.customSizes ? item.customSizes : undefined,
      });

      await order.save();

      if (product) {
        product.orders.push(order._id);
        product.funded += item.qty;
        await product.save();
      }
    })
  );

  res.status(200).json({ message: "Payment successful and order saved!" });
};

const fetchOrganizations = async (req, res) => {
  const organizations = await Org.find({});
  res.json(organizations);
};

module.exports = {
  getAllProducts,
  fetchProduct,
  createCheckout,
  handleCheckoutSuccess,
  processOrder,
  fetchOrganizations,
  getAllProductsOrg,
};
