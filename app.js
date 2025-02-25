if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}
require("./models/admin");
require("./models/product");
require("./models/user");
require("./models/notification");
require("./models/quote");
require("./models/Order");
require("./models/organization");
const express = require("express");
const app = express();
const session = require("express-session");
const mongoose = require("mongoose");
const MongoDBStore = require("connect-mongo");
const bodyParser = require("body-parser");
const ExpressError = require("./utils/ExpressError");
const cors = require("cors");
const adminRoutes = require("./routes/admin");
const homepageRoutes = require("./routes/homepageRoutes");
const userRoutes = require("./routes/user");
const notificationRoutes = require("./routes/notification");
const quoteRoutes = require("./routes/quote");
const agenda = require("./middlewares/agenda");

// Varibales
const PORT = process.env.PORT;

const mongoURi = process.env.MONGODB_URI;

const secret = "thisisnotagoodsecret";

const store = MongoDBStore.create({
  mongoUrl: mongoURi,
  secret,
  touchAfter: 24 * 60 * 60,
});

const sessionConfig = {
  store,
  secret,
  name: "session",
  resave: false,
  saveUninitialized: false,
};

const corsOptions = {
  origin: [
    process.env.DOMAIN_FRONTEND,
    process.env.DOMAIN_SECOND,
    process.env.STRIPE_URL,
  ],
  credentials: true,
  methods: "GET,POST,PUT,DELETE",
  allowedHeaders: "Content-Type,Authorization",
};

// Using the app
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(session(sessionConfig));

// Route handler
app.use("/api/auth", adminRoutes);
app.use("/api/v1", adminRoutes);
app.use("/api/v1", homepageRoutes);
app.use("/api/auth", userRoutes);
app.use("/api/v1", notificationRoutes);
app.use("/api/v1", quoteRoutes);

// initializing Mongoose
mongoose
  .connect(mongoURi, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log("Mongoose is connected");
  })
  .catch((e) => {
    console.log(e);
  });

agenda.on("ready", async () => {
  console.log("Agenda Jobs Scheduler Started");

  // Start the agenda instance
  await agenda.start();

  // Schedule production jobs
  agenda.every("0 3 * * *", "auto-refund-script"); // Daily at 3 AM
  agenda.every("0 4 * * *", "check-expired-products"); // Daily at 4 AM

  // Remove these test executions:
  // agenda.now("auto-refund-script");
  // agenda.now("check-expired-products");
});

agenda.on("fail", (err, job) => {
  console.error(`Job failed with error: ${err.message}`, job);
});

// handling the error message
app.all("*", (req, res, next) => {
  next(new ExpressError("Page not found", 404));
});

app.use((err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }
  const { status = 500 } = err;
  if (!err.message) err.message = "Oh No, Something Went Wrong!";
  res.status(status).json({ error: err.message });
});

// Listen for the port Number
app.listen(PORT, () => {
  console.log(`App is listening on http://localhost:${PORT}`);
});
