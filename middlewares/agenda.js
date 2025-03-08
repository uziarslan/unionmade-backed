const mongoose = require("mongoose");
const Agenda = require("agenda");
const { uploader } = require("cloudinary").v2;
const wrapAsync = require("../utils/wrapAsync");
const Product = mongoose.model("Product");
const Order = mongoose.model("Order");
const User = mongoose.model("User");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const { MailtrapClient } = require("mailtrap");
const Notifi = mongoose.model("Notification");

const TOKEN = process.env.MAIL_TRAP_TOKEN;
const client = new MailtrapClient({ token: TOKEN });
const sender = {
  email: "info@unionmade.net",
  name: "Union Made Apparel",
};

const agenda = new Agenda({ db: { address: process.env.MONGODB_URI } });

// Helper functions
const processRefund = async (order) => {
  try {
    if (order.paymentMethod.type === "stripe") {
      const refund = await stripe.refunds.create({
        charge: order.paymentMethod.chargeId,
      });
      order.paymentMethod.paymentStatus =
        refund.status === "succeeded" ? "refunded" : "hold";
    } else if (order.paymentMethod.type === "credits") {
      await User.findByIdAndUpdate(
        order.user._id,
        { $inc: { credits: order.totalAmount } },
        { new: true }
      );
      order.paymentMethod.paymentStatus = "refunded";
    }
    await order.save();
    return true;
  } catch (error) {
    console.error(`Refund failed for order ${order._id}:`, error);
    return false;
  }
};

const sendNotification = async (order, templateId, title, description) => {
  try {
    const notifi = new Notifi({
      to: order.user._id,
      title,
      description,
    });
    await notifi.save();

    await client.send({
      from: sender,
      to: [{ email: order.user.username }],
      template_uuid: templateId,
      template_variables: {
        user: order.user,
        productImage: order.product.images[0]?.path || "",
        order,
      },
    });
  } catch (error) {
    console.error(`Notification failed for order ${order._id}:`, error);
  }
};

const processExpiredProduct = async (product, refundReason, templateId) => {
  console.log(`Processing product ${product._id}: ${refundReason}`);

  for (const orderId of product.orders) {
    const order = await Order.findOne({
      _id: orderId,
      "paymentMethod.paymentStatus": "hold",
    })
      .populate("user")
      .populate("product");

    if (!order) continue;

    const success = await processRefund(order);
    if (success) {
      await sendNotification(
        order,
        templateId,
        "Order Refunded",
        `Refund has been applied because ${refundReason}. ` +
          `Refunded ${order.totalAmount} via ${order.paymentMethod.type}.`
      );
    }
  }
};

// Agenda jobs
agenda.define(
  "deleteFileFromCloudinary",
  wrapAsync(async (job) => {
    const { filename } = job.attrs.data;
    try {
      await uploader.destroy(filename, { resource_type: "image" });
    } catch (error) {
      console.error(`Failed to delete Cloudinary file ${filename}:`, error);
      throw error;
    }
  })
);

agenda.define(
  "auto-refund-script",
  wrapAsync(async (job) => {
    console.log("Starting auto-refund-script");

    const expiredProducts = await Product.find({
      endTime: { $lte: new Date() },
      stage: "Mockup",
      expired: false,
    });

    for (const product of expiredProducts) {
      const funded = parseInt(product.funded);
      const minQty = parseInt(product.minQty);

      if (funded < minQty) {
        await processExpiredProduct(
          product,
          "minimum quantity not met",
          "a780f975-5e06-4c05-a58f-e4b7445db811"
        );
      } else {
        product.stage = "Pre-production";
        console.log(`Product ${product._id} moving to Pre-production`);

        for (const orderId of product.orders) {
          const order = await Order.findById(orderId)
            .populate("user")
            .populate("product");
          if (!order) continue;

          await sendNotification(
            order,
            "2929bdb6-071e-43b4-8bd1-1ea53e8e5b46",
            "Product Stage Updated",
            `Product stage updated to "${product.stage}"`
          );
        }
      }

      product.expired = true;
      await product.save();
    }
  })
);

agenda.define(
  "check-expired-products",
  wrapAsync(async (job) => {
    console.log("Starting check-expired-products");

    const expiredProducts = await Product.find({
      endTime: { $lte: new Date() },
      expired: true,
    });

    for (const product of expiredProducts) {
      await processExpiredProduct(
        product,
        "product discontinued",
        "a5a245d4-669d-4ddf-88b0-8672b40a49f0"
      );
    }
  })
);

module.exports = agenda;
