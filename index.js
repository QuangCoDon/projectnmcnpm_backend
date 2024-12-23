const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const dotenv = require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(
  express.urlencoded({
    extended: true,
    limit: "10mb",
  })
);

const PORT = process.env.PORT || 8080;

// MongoDB Connection
mongoose.set("strictQuery", false);
mongoose
  .connect(process.env.MONGODB_URL)
  .then(() => console.log("Connected to Database"))
  .catch((err) => console.log("Error connecting to MongoDB:", err));

// Schemas
const userSchema = mongoose.Schema({
  firstName: String,
  lastName: String,
  email: {
    type: String,
    unique: true,
  },
  password: String,
  confirmPassword: String,
  image: String,
});
const userModel = mongoose.model("user", userSchema);

const productSchema = mongoose.Schema({
  name: String,
  category: String,
  image: String,
  price: String,
  description: String,
});
const productModel = mongoose.model("product", productSchema);

const contactSchema = mongoose.Schema({
  name: String,
  email: String,
  phone: String,
  message: String,
  createdAt: { type: Date, default: Date.now },
});
const contactModel = mongoose.model("Contact", contactSchema);

const discountSchema = mongoose.Schema({
  code: { type: String, required: true },
  type: { type: String, required: true },
  value: { type: Number, required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },

  timeFrame: {
    start: { type: String, required: true },
    end: { type: String, required: true },
  },
  minimumOrderValue: { type: Number, required: true },
  minimumItems: { type: Number, required: true },
  applicableCategories: { type: [String], required: true },
  usageLimit: { type: Number, required: true },
});
const discountModel = mongoose.model("Discount", discountSchema);

// APIs
app.get("/", (req, res) => {
  res.send("Server is running");
});

// User APIs
app.post("/signup", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).send({ message: "Email is required" });
    }

    const result = await userModel.findOne({ email });

    if (result) {
      return res
        .status(400)
        .send({ message: "Email is already registered", alert: false });
    } else {
      const newUser = new userModel(req.body);
      await newUser.save();
      return res
        .status(200)
        .send({ message: "Successfully signed up", alert: true });
    }
  } catch (err) {
    console.error(err);
    return res.status(500).send({ message: "An error occurred during signup" });
  }
});

app.post("/login", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).send({ message: "Email is required" });
    }

    const result = await userModel.findOne({ email });

    if (result) {
      const dataSend = {
        _id: result._id,
        firstName: result.firstName,
        lastName: result.lastName,
        email: result.email,
        image: result.image,
      };
      return res.status(200).send({
        message: "Login is successfully",
        alert: true,
        data: dataSend,
      });
    } else {
      return res.status(400).send({
        message: "Email is not available, please sign up",
        alert: false,
      });
    }
  } catch (err) {
    console.error(err);
    return res.status(500).send({ message: "An error occurred during login" });
  }
});

// Product APIs
app.post("/uploadProduct", async (req, res) => {
  try {
    const data = new productModel(req.body);
    await data.save();
    res.status(200).send({ message: "Product uploaded successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: "Failed to upload product" });
  }
});

app.get("/product", async (req, res) => {
  try {
    const data = await productModel.find({});
    res.status(200).json(data);
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: "Failed to fetch products" });
  }
});

// Discount APIs
app.post("/uploadDiscount", async (req, res) => {
  try {
    console.log("Received Discount Data:", req.body);

    const {
      code,
      type,
      value,
      startDate,
      endDate,

      timeFrame,
      minimumOrderValue,
      minimumItems,
      applicableCategories,
      usageLimit,
    } = req.body;

    if (
      !code ||
      !type ||
      !value ||
      !startDate ||
      !endDate ||
      !timeFrame.start ||
      !timeFrame.end ||
      !minimumOrderValue ||
      !minimumItems ||
      applicableCategories.length === 0 ||
      !usageLimit
    ) {
      return res.status(400).send({ message: "Missing required fields" });
    }

    const newDiscount = new discountModel(req.body);
    await newDiscount.save();
    res.status(200).send({ message: "Discount added successfully!" });
  } catch (err) {
    console.error("Error uploading discount:", err);
    res.status(500).send({ message: "Failed to add discount" });
  }
});

app.get("/discounts", async (req, res) => {
  try {
    const discounts = await discountModel.find({});
    res.status(200).json(discounts);
  } catch (err) {
    console.error("Error fetching discounts:", err);
    res.status(500).send({ message: "Failed to fetch discounts" });
  }
});

// Contact APIs
app.post("/submit-contact", async (req, res) => {
  try {
    const { name, email, phone, message } = req.body;

    if (!name || !email || !phone || !message) {
      return res.status(400).json({ message: "All fields are required." });
    }

    const newContact = new contactModel({ name, email, phone, message });
    await newContact.save();
    res.status(200).json({ message: "Form submitted successfully!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error submitting the form." });
  }
});

app.get("/get-contacts", async (req, res) => {
  try {
    const contacts = await contactModel.find().sort({ createdAt: -1 });
    res.status(200).json(contacts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching contact data." });
  }
});

// Payment APIs
app.post("/create-mock-checkout-session", async (req, res) => {
  try {
    const items = req.body;
    if (!items || items.length === 0) {
      return res
        .status(400)
        .json({ error: "Cart is empty. Please add items to cart." });
    }
    if (items.length < 2) {
      return res.status(400).json({
        error: "Insufficient items for checkout. Minimum 2 items required.",
      });
    }
    const totalAmount = items.reduce(
      (acc, item) => acc + item.price * item.qty,
      0
    );
    if (totalAmount < 15) {
      return res
        .status(400)
        .json({ error: "Total amount is too low for checkout." });
    }
    const mockSession = {
      sessionId: "mock_session_id_123456",
      message: "This is a mock payment session",
      paymentUrl: `${process.env.FRONTEND_URL}/success`,
      cancelUrl: `${process.env.FRONTEND_URL}/cancel`,
    };

    res.status(200).json(mockSession);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "An error occurred in the mock payment" });
  }
});

// Start Server
app.listen(PORT, () => console.log("Server is running at port: " + PORT));
