const mongoose = require("mongoose");
const Admin = mongoose.model("Admin");
const User = mongoose.model("User");
const Product = mongoose.model("Product");
const Notifi = mongoose.model("Notification");
const Quote = mongoose.model("Quote");
const Order = mongoose.model("Order");
const Org = mongoose.model("Organization");
const jwt = require("jsonwebtoken");
const agenda = require("../middlewares/agenda");
const { MailtrapClient } = require("mailtrap");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const axios = require("axios"); // Add axios for Wave API

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

const registerAdmin = async (req, res) => {
  const { username, password } = req.body;

  const foundAdmin = await Admin.findOne({ username });

  if (foundAdmin)
    return res
      .status(500)
      .json({ error: "Email already in use. Try differnt one." });

  if (!username) return res.status(500).json({ error: "Email is required." });

  if (!password)
    return res.status(500).json({ error: "Password is required." });

  const admin = await Admin.create({
    ...req.body,
  });

  res.status(201).json({
    token: generateToken(admin._id),
    success: "Email has been registered",
  });
};

const adminLogin = async (req, res) => {
  const { username, password } = req.body;

  const admin = await Admin.findOne({ username });

  if (!admin)
    return res.status(400).json({ error: "Invalid email or password" });

  if (await admin.matchPassword(password)) {
    return res.status(201).json({
      token: generateToken(admin._id),
    });
  }
  return res.status(400).json({ error: "Invalid email or password" });
};

const getAdmin = async (req, res) => {
  const admin = await Admin.findById(req.user.id).select("-password");

  if (!admin) {
    return res.status(400).json({ error: "Invalid admin" });
  }

  res.json(admin);
};

const createProduct = async (req, res) => {
  const { sizes, organizationId } = req.body; // Add organizationId to the request body

  if (!organizationId) {
    return res.status(400).json({ error: "Organization is required" });
  }

  const product = new Product({
    ...req.body,
    sizes: sizes.split(","),
    organization: organizationId, // Assign organization
  });

  const images = req.files.map((img) => ({
    filename: img.filename,
    path: img.path,
  }));

  product.images = images;

  await product.save();

  res.status(201).json({ success: "Product created successfully" });
};

const getProducts = async (req, res) => {
  const products = await Product.find({ expired: false });
  res.json(products);
};

const deleteImg = async (req, res) => {
  const { _id, filename } = req.query;
  if (filename) {
    const product = await Product.findById(_id);
    const newImages = product.images.filter((img) => img.filename !== filename);

    product.images = newImages;

    await product.save();
    await agenda.now("deleteFileFromCloudinary", { filename });
    res.status(200).json({ success: "Image deleted successfully" });
  }
};

const deleteProduct = async (req, res) => {
  const { id } = req.params;
  const product = await Product.findById(id);
  const orderIds = product.orders;

  if (!product) return res.status(404).json({ error: "Product not found." });

  for (const orderId of orderIds) {
    const order = await Order.findOne({
      _id: orderId,
      "paymentMethod.paymentStatus": "hold",
    })
      .populate("user")
      .populate("product");

    if (!order) continue;

    if (order.paymentMethod.type === "stripe") {
      const refund = await stripe.refunds.create({
        charge: order.paymentMethod.chargeId,
      });
      order.paymentMethod.paymentStatus =
        refund.status === "succeeded" ? "refunded" : "hold";
    } else if (order.paymentMethod.type === "credits") {
      await User.findByIdAndUpdate(
        order.user._id,
        {
          $inc: { credits: order.totalAmount },
        },
        { new: true }
      );
      order.paymentMethod.paymentStatus = "refunded";
    }

    const notifi = new Notifi({
      to: order.user,
      title: "Order Refunded",
      description: `Refund has been applied to your order because the item you ordered is discontinued. The payment has been reversed to your original payment method ("${order.paymentMethod.type}"). The refunded amount is ${order.totalAmount}.`,
    });
    client.send({
      from: sender,
      to: [
        {
          email: order.user.username,
        },
      ],
      template_uuid: "a5a245d4-669d-4ddf-88b0-8672b40a49f0",
      template_variables: {
        user: order.user,
        productImage: order.product.images[0].path,
        order,
      },
    });
    await order.save();
    await notifi.save();
  }

  // for (const img of product.images) {
  //   const filename = img.filename;
  //   await agenda.now("deleteFileFromCloudinary", { filename });
  // }

  product.expired = true;

  await product.save();

  res.status(200).json({ success: "Product deleted successfully." });
};

const editProduct = async (req, res) => {
  const { id } = req.params;
  const {
    productName,
    productCode,
    productPrice,
    sizes,
    minQty,
    status,
    discount,
    endTime,
    description,
  } = req.body;

  const product = await Product.findByIdAndUpdate(id, {
    productName,
    productCode,
    productPrice,
    sizes: sizes.split(","),
    minQty,
    status,
    discount,
    endTime,
    description,
  });

  if (req.files && req.files.length) {
    req.files.map((img) =>
      product.images.push({
        path: img.path,
        filename: img.filename,
      })
    );
  }

  await product.save();
  res.status(200).json({ success: "Product updated successfully." });
};

const fetchCustomers = async (req, res) => {
  const users = await User.find({}).populate("organization");
  res.status(200).json(users);
};

const customerProfile = async (req, res) => {
  const { id } = req.params;
  const { status, credits } = req.body;

  const user = await User.findByIdAndUpdate(id, { status, credits });

  const notifi = new Notifi({
    from: req.user.id,
    to: id,
    title: `Profile status and credits`,
    description: `Your profile status has been updated to "${status}" by the admin. You have been assigned "${credits} credits" to your account.`,
    adminDescription: `${user.name} status has been updated to "${status}". You have assigned "${credits} credits" to his account.`,
  });

  client.send({
    from: sender,
    to: [
      {
        email: user.username,
      },
    ],
    template_uuid: "1ca7746f-f4e8-4e4a-9c86-f603a2d91875",
    template_variables: {
      name: user.name,
      status,
      credits,
    },
  });

  if (!user) return res.status(404).json({ error: "No such user found." });

  await notifi.save();

  res.status(201).json({ success: "Customer profile updated." });
};

const getQuotes = async (req, res) => {
  const quotes = await Quote.find({});
  res.status(200).json(quotes);
};

const fetchOrders = async (req, res) => {
  const orders = await Order.find({})
    .populate("product")
    .populate({
      path: "user", // Populate the user details
      populate: {
        path: "organization", // Nested population of the organization field in user
        model: "Organization", // Explicitly specify the model (optional if ref is set correctly)
      },
    });
  res.status(200).json(orders);
};

const changeOrderStatus = async (req, res) => {
  const { order, orderStatus } = req.body;
  const ord = await Order.findByIdAndUpdate(order._id, {
    status: orderStatus.status,
  });

  const notifi = new Notifi({
    from: req.user.id,
    to: order.user._id,
    title: `Order status changed`,
    description: `Your order status for product "${order.product.productName}" has been updated to "${orderStatus.status}" by the admin.`,
    adminDescription: `${order.user.name} order status for product "${order.product.productName}" has been updated to "${orderStatus.status}".`,
  });

  await notifi.save();

  client.send({
    from: sender,
    to: [
      {
        email: order.user.username,
      },
    ],
    template_uuid: "d6fd00cd-e38b-4c54-b612-30f6140b88c0",
    template_variables: {
      user: order.user,
      orderStatus,
      productImage: order.product.images[0].path,
      order,
    },
  });

  if (!ord) return res.status(404).json({ error: "Unable to find order." });

  res.status(200).json({ success: "Order status updated" });
};

const getReport = async (req, res) => {
  const { startDate, endDate, status, paymentStatus, product, organization } =
    req.body;

  const filter = {};

  try {
    // Date filter
    if (startDate || endDate) {
      filter.orderDate = {};
      if (startDate) {
        const start = new Date(startDate);
        if (isNaN(start.getTime())) throw new Error("Invalid startDate");
        filter.orderDate.$gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        if (isNaN(end.getTime())) throw new Error("Invalid endDate");
        filter.orderDate.$lte = end;
      }
    }

    // Status filter
    if (status !== "all") {
      filter.status = status;
    }

    // Payment status filter
    if (paymentStatus !== "all") {
      filter["paymentMethod.paymentStatus"] = paymentStatus;
    }

    // Product filter
    if (product !== "all") {
      if (!mongoose.Types.ObjectId.isValid(product))
        throw new Error("Invalid product ID");
      filter.product = product;
    }

    // Organization Filter
    if (organization !== "all") {
      if (!mongoose.Types.ObjectId.isValid(organization)) {
        throw new Error("Invalid organization ID: " + organization);
      }
      const users = await User.find({
        organization: new mongoose.Types.ObjectId(organization),
      }).select("_id");
      const userIds = users.map((user) => user._id);
      filter.user = { $in: userIds };
    }

    // Fetch orders
    const orders = await Order.find(filter)
      .populate({
        path: "product",
        select: "_id productCode productName images",
      })
      .populate({
        path: "user",
        populate: { path: "organization", select: "name" },
      })
      .lean();

    // Calculate report data
    const totalSales = orders.reduce(
      (sum, order) => sum + order.totalAmount,
      0
    );
    const totalOrders = orders.length;

    // Popular Products
    const productMap = {};
    orders.forEach((order) => {
      const productId = order.product._id.toString();
      if (!productMap[productId]) {
        productMap[productId] = {
          code: order.product.productCode,
          name: order.product.productName,
          thumbnail: order.product.images[0]?.path || "",
          quantitySold: 0,
          totalSales: 0,
        };
      }
      productMap[productId].quantitySold += order.quantity;
      productMap[productId].totalSales += order.totalAmount;
    });
    const popularProducts = Object.values(productMap).sort(
      (a, b) => b.totalSales - a.totalSales
    );

    // Sales by Date
    const salesByDate = {};
    orders.forEach((order) => {
      const date = order.orderDate.toISOString().split("T")[0];
      salesByDate[date] = (salesByDate[date] || 0) + order.totalAmount;
    });
    const formattedSalesByDate = Object.entries(salesByDate).map(
      ([date, sales]) => ({
        date,
        sales,
      })
    );

    // Sales by Size
    const salesBySize = {};
    orders.forEach((order) => {
      const size = order.size || "N/A";
      salesBySize[size] = (salesBySize[size] || 0) + order.totalAmount;
    });
    const formattedSalesBySize = Object.entries(salesBySize).map(
      ([size, sales]) => ({
        size,
        sales,
      })
    );

    // Payment Method Distribution
    const paymentMethodDistribution = {};
    orders.forEach((order) => {
      const method = order.paymentMethod.type;
      paymentMethodDistribution[method] =
        (paymentMethodDistribution[method] || 0) + order.totalAmount;
    });
    const formattedPaymentMethodDistribution = Object.entries(
      paymentMethodDistribution
    ).map(([method, sales]) => ({ method, sales }));

    // New Section: Orders by User and Organization
    const ordersByUserAndOrg = orders.map((order) => ({
      userId: order.user._id.toString(),
      userName: order.user.name || "Unknown",
      organizationId: order.user.organization?._id.toString() || "N/A",
      organizationName: order.user.organization?.name || "None",
      productId: order.product._id.toString(),
      productName: order.product.productName,
      quantity: order.quantity,
      totalAmount: order.totalAmount,
      orderDate: order.orderDate,
    }));

    res.status(200).json({
      success: true,
      data: {
        totalSales,
        totalOrders,
        popularProducts,
        salesByDate: formattedSalesByDate,
        salesBySize: formattedSalesBySize,
        paymentMethodDistribution: formattedPaymentMethodDistribution,
        ordersByUserAndOrg, // New section added
      },
    });
  } catch (error) {
    console.error("Error in getReport:", error.message, error.stack);
    res.status(500).json({ error: "Internal server error: " + error.message });
  }
};

const fetchOrganizations = async (req, res) => {
  const organizations = await Org.find({});
  res.json(organizations);
};

const createOrganization = async (req, res) => {
  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ error: "Organization name is required" });
  }
  const existingOrg = await Org.findOne({ name });
  if (existingOrg) {
    return res.status(400).json({ error: "Organization name already exists" });
  }
  const organization = new Org({ name });
  await organization.save();
  res
    .status(201)
    .json({ success: "Organization created successfully", organization });
};

const deleteOrganization = async (req, res) => {
  const { id } = req.params;

  // Check if the organization exists
  const organization = await Org.findById(id);
  if (!organization) {
    return res.status(404).json({ error: "Organization not found" });
  }

  // Check if the organization is referenced by users or products
  const userCount = await User.countDocuments({ organization: id });
  const productCount = await Product.countDocuments({ organization: id });
  if (userCount > 0 || productCount > 0) {
    return res.status(400).json({
      error: "Cannot delete organization with associated users or products",
    });
  }

  // Delete the organization
  await Org.findByIdAndDelete(id);
  res.status(200).json({ success: "Organization deleted successfully" });
};

const editOrganization = async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;
  if (!name)
    return res.status(400).json({ error: "Organization name is required" });
  const organization = await Org.findById(id);
  if (!organization)
    return res.status(404).json({ error: "Organization not found" });
  const duplicate = await Org.findOne({ name, _id: { $ne: id } });
  if (duplicate)
    return res.status(400).json({ error: "Organization name already exists" });
  organization.name = name;
  await organization.save();
  res
    .status(200)
    .json({ success: "Organization updated successfully", organization });
};

const generateInvoices = async (req, res) => {
  const { startDate, endDate, status, paymentStatus, product, organization } =
    req.body;

  const filter = {};

  try {
    if (startDate || endDate) {
      filter.orderDate = {};
      if (startDate) {
        const start = new Date(startDate);
        if (isNaN(start.getTime())) throw new Error("Invalid startDate");
        filter.orderDate.$gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        if (isNaN(end.getTime())) throw new Error("Invalid endDate");
        filter.orderDate.$lte = end;
      }
    }

    if (status !== "all") filter.status = status;
    if (paymentStatus !== "all")
      filter["paymentMethod.paymentStatus"] = paymentStatus;
    if (product !== "all") {
      if (!mongoose.Types.ObjectId.isValid(product))
        throw new Error("Invalid product ID");
      filter.product = product;
    }

    if (organization !== "all") {
      if (!mongoose.Types.ObjectId.isValid(organization)) {
        throw new Error("Invalid organization ID: " + organization);
      }
      const users = await User.find({
        organization: new mongoose.Types.ObjectId(organization),
      }).select("_id");
      const userIds = users.map((user) => user._id);
      filter.user = { $in: userIds };
    } else {
      throw new Error("Organization must be specified to generate invoices");
    }

    const orders = await Order.find(filter)
      .populate({
        path: "product",
        select: "_id productCode productName images",
      })
      .populate({
        path: "user",
        populate: { path: "organization", select: "name" },
      })
      .lean();

    if (!orders.length) {
      return res.status(404).json({ error: "No orders found for invoicing" });
    }

    // Group orders by organization (though we expect one org here)
    const ordersByOrg = {};
    orders.forEach((order) => {
      const orgId = order.user.organization?._id.toString() || "N/A";
      if (!ordersByOrg[orgId]) {
        ordersByOrg[orgId] = {
          organizationName: order.user.organization?.name || "None",
          total: 0,
          items: [],
        };
      }
      ordersByOrg[orgId].total += order.totalAmount;
      ordersByOrg[orgId].items.push({
        productName: order.product.productName,
        quantity: order.quantity,
        price: order.totalAmount / order.quantity, // Unit price
        amount: order.totalAmount,
      });
    });

    // Generate invoices
    const invoices = [];
    for (const [orgId, orgData] of Object.entries(ordersByOrg)) {
      if (orgId === "N/A") continue;

      const invoicePayload = {
        businessId: process.env.WAVE_BUSINESS_ID, // Your Wave business ID
        customerId: orgId, // Assuming orgId matches a Wave customer
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0], // Due in 7 days
        items: orgData.items.map((item) => ({
          productId: "your_product_id", // Replace with actual Wave product ID
          quantity: item.quantity,
          unitPrice: item.price,
        })),
        tax: {
          name: "HST 13%",
          rate: 0.13,
          amount: orgData.total * 0.13,
        },
        notes: `Orders for ${orgData.organizationName} from ${
          startDate || "start"
        } to ${endDate || "now"}`,
      };

      const response = await axios.post(
        "https://api.waveapps.com/v1/invoices",
        invoicePayload,
        {
          headers: {
            Authorization: `Bearer ${process.env.WAVE_API_TOKEN}`,
            "Content-Type": "application/json",
          },
        }
      );

      invoices.push({
        organizationId: orgId,
        organizationName: orgData.organizationName,
        invoiceId: response.data.id,
        total: orgData.total + orgData.total * 0.13, // Subtotal + tax
      });
    }

    res.status(200).json({
      success: true,
      invoices,
    });
  } catch (error) {
    console.error("Error in generateInvoices:", error.message, error.stack);
    res.status(500).json({ error: "Internal server error: " + error.message });
  }
};

module.exports = {
  registerAdmin,
  adminLogin,
  getAdmin,
  createProduct,
  getProducts,
  deleteImg,
  deleteProduct,
  editProduct,
  fetchCustomers,
  customerProfile,
  getQuotes,
  fetchOrders,
  changeOrderStatus,
  getReport,
  fetchOrganizations,
  createOrganization,
  deleteOrganization,
  editOrganization,
  generateInvoices,
};
