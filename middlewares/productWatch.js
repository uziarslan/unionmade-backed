const mongoose = require("mongoose");
const user = require("../models/user");
const Product = mongoose.model("Product");
const Order = mongoose.model("Order");
const User = mongoose.model("User");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const productChangeStream = Product.watch();

productChangeStream.on("change", async (change) => {
  if (change.operationType === "update") {
    const productId = change.documentKey._id;
    const updatedFields = change.updateDescription.updatedFields;

    if (updatedFields.endTime) {
      const product = await Product.findById(productId);
      if (product && new Date(product.endTime <= new Date())) {
        const funded = parseInt(product.funded);
        const orderIds = product.orders; // Assuming orders have paymentId
        if (funded < parseInt(product.minQty)) {
          // Loop over the orders to process the refund
          for (const orderId of orderIds) {
            const order = await Order.findById(orderId);
            if (order && order.paymentMethod.type === "stripe") {
              try {
                const refund = await stripe.refunds.create({
                  payment_intent: order.paymentMethod.chargeId,
                });

                if (refund.status === "succeeded") {
                  order.paymentMethod.paymentStatus = "refunded";
                  console.log(
                    `Refund successfully processed for product ${productId}`
                  );
                } else {
                  order.paymentMethod.paymentStatus = "pending";
                  console.log(`Refund failed for product ${productId}`);
                }

                await order.save();
              } catch (error) {
                console.error("Error processing refund:", error);
                order.paymentMethod.paymentStatus = "pending";
              }
            } else if (order && order.paymentMethod.type === "credits") {
              try {
                const creditsRefunded = order.totalAmount;
                await User.findByIdAndUpdate(
                  order.user,
                  { $inc: { credits: +creditsRefunded } },
                  { new: true }
                );
                order.paymentMethod.paymentStatus = "refunded";
                await order.save();
              } catch (error) {
                console.error("Error processing credits:", error);
                order.paymentMethod.paymentStatus = "pending";
              }
            }
          }
        } else if (funded >= parseInt(product.minQty)) {
          product.stage = "Pre-production";
          for (const orderId of orderIds) {
            const order = await Order.findById(orderId);
            if (order) {
              order.paymentMethod.paymentStatus = "paid";
              await order.save();
            }
          }
        }

        await product.save(); // Save the refund status
      }
    }
  }
});
