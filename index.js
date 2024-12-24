const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const dotenv = require("dotenv").config();
const nodemailer = require("nodemailer");

const app = express();
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(
  express.urlencoded({
    extended: true,
    limit: "10mb",
  })
);

const PORT = process.env.PORT || 8080;
// Tự động xóa các email chưa xác thực OTP sau 5 phút
setInterval(async () => {
  try {
    const now = new Date();
    const expiredUsers = await userModel.find({ otpExpiresAt: { $lt: now } });

    if (expiredUsers.length > 0) {
      const userIds = expiredUsers.map((user) => user._id);
      await userModel.deleteMany({ _id: { $in: userIds } });
      console.log(`Deleted ${userIds.length} expired users.`);
    }
  } catch (error) {
    console.error("Error deleting expired users:", error);
  }
}, 60 * 1000); // Kiểm tra mỗi phút

//mongodb connection
mongoose.set("strictQuery", false);
mongoose
  .connect(process.env.MONGODB_URL)
  .then(() => console.log("Connected to Database"))
  .catch((err) => console.log("Error connecting to MongoDB:", err));

// Schemas
const userSchema = mongoose.Schema({
  firstName: {
    type: String,
    required: true,
  },
  lastName: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    unique: true,
    required: true,
  },
  password: {
    type: String,
    required: true,
  },
  confirmPassword: {
    type: String,
    required: true,
  },
  image: {
    type: String,
    required: true,
  },
  otp: String,
  otpExpiresAt: Date,
  isVerified: {
    type: Boolean,
    default: false,
  },
  resetOtp: String,
  resetOtpExpires: Date,
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

// api send-otp post
app.post("/send-otp", async (req, res) => {
  const { firstName, lastName, password, confirmPassword, email, image } =
    req.body;

  try {
    const existingUser = await userModel.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email already registered!" });
    }

    // Tạo OTP và thời gian hết hạn
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000); // Hết hạn sau 5 phút

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Your OTP for Signup Verification",
      text: `Your OTP is: ${otp}. It will expire in 5 minutes.\n\nThank you!`,
    };

    transporter.sendMail(mailOptions, async (err, info) => {
      if (err) {
        console.log(err);
        return res
          .status(500)
          .json({ message: "Failed to send OTP. Please try again." });
      }

      const newUser = new userModel({
        firstName,
        lastName,
        email,
        password,
        confirmPassword,
        image,
        otp,
        otpExpiresAt,
      });
      await newUser.save();

      res
        .status(200)
        .json({ message: "OTP sent to your email successfully!", alert: true });
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
});

//api verify-otp post
app.post("/verify-otp", async (req, res) => {
  const { email, otp } = req.body;

  try {
    const user = await userModel.findOne({ email, otp });

    if (!user) {
      return res.status(400).json({ message: "Invalid OTP or email!" });
    }

    // Kiểm tra thời gian hết hạn OTP
    if (new Date() > user.otpExpiresAt) {
      await userModel.deleteOne({ _id: user._id });
      return res
        .status(400)
        .json({ message: "OTP has expired. Please request a new one." });
    }
    user.isVerified = true;
    // Xóa OTP sau khi xác thực thành công
    await userModel.updateOne(
      { email },
      {
        $set: { isVerified: true },
        $unset: { otp: "", otpExpiresAt: "" },
      }
    );
    res.status(200).json({ message: "OTP verified successfully!" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
});

//login api
app.post("/login", async (req, res) => {
  // console.log(req.body)
  try {
    const { email, password, isVerified } = req.body;
    if (!email || !password) {
      return res
        .status(400)
        .send({ message: "Email and password is required" });
    }

    const result = await userModel.findOne({ email });

    if (result) {
      if (result.isVerified) {
        if (password === result.password) {
          const dataSend = {
            _id: result._id,
            firstName: result.firstName,
            lastName: result.lastName,
            email: result.email,
            image: result.image,
          };
          console.log(dataSend);
          return res.status(200).send({
            message: "Login is successfully",
            alert: true,
            data: dataSend,
          });
        } else {
          return res.status(400).send({
            message: "Invalid password",
            alert: false,
          });
        }
      } else {
        return res
          .status(403)
          .json({ message: "Account not verified. Please verify your email." });
      }
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

// API kiểm tra token hợp lệ
app.get('/verify-reset-token/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const user = await userModel.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        message: 'Link đặt lại mật khẩu không hợp lệ hoặc đã hết hạn',
        valid: false
      });
    }

    res.json({ valid: true });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', valid: false });
  }
});

// API endpoint để gửi email quên mật khẩu
app.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    const user = await userModel.findOne({ email });

    if (!user) {
      return res.status(404).json({ 
        message: 'Email không tồn tại trong hệ thống', 
        alert: false 
      });
    }

    // Tạo token reset password
    const resetToken = Math.random().toString(36).slice(-8);
    const resetPasswordExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 phút

    // Lưu token vào database
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = resetPasswordExpires;
    await user.save();

    // Gửi email
    const resetLink = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Đặt lại mật khẩu',
      html: `
        <h1>Yêu cầu đặt lại mật khẩu</h1>
        <p>Bạn đã yêu cầu đặt lại mật khẩu. Vui lòng click vào link bên dưới để đặt lại mật khẩu:</p>
        <a href="${resetLink}">Đặt lại mật khẩu</a>
        <p>Link này sẽ hết hạn sau 15 phút.</p>
        <p>Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này.</p>
      `
    };

    await transporter.sendMail(mailOptions);

    res.json({ 
      message: 'Hướng dẫn đặt lại mật khẩu đã được gửi đến email của bạn',
      alert: true 
    });

  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ 
      message: 'Đã có lỗi xảy ra, vui lòng thử lại sau',
      alert: false 
    });
  }
});

// API endpoint để đặt lại mật khẩu
app.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    const user = await userModel.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ 
        message: 'Link đặt lại mật khẩu không hợp lệ hoặc đã hết hạn',
        alert: false 
      });
    }

    // Cập nhật mật khẩu mới
    user.password = newPassword;
    user.confirmPassword = newPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({ 
      message: 'Mật khẩu đã được đặt lại thành công',
      alert: true 
    });

  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ 
      message: 'Đã có lỗi xảy ra, vui lòng thử lại sau',
      alert: false 
    });
  }
});

// payment api
// mock payment endpoint
app.post('/create-mock-checkout-session', async (req, res) => {
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

// API để nhận dữ liệu form
app.post("/submit-contact", async (req, res) => {
  try {
    const { name, email, phone, message } = req.body;

    if (!name || !email || !phone || !message) {
      return res.status(400).json({ message: "All fields are required." });
    }

    // Lưu vào MongoDB
    const newContact = new contactModel({
      name,
      email,
      phone,
      message,
    });

    await newContact.save();

    res.status(200).json({ message: "Form submitted successfully!" });
  } catch (error) {
    console.error("Error saving contact form:", error);
    res.status(500).json({ message: "Error submitting the form." });
  }
});

// API để lấy danh sách đánh giá từ MongoDB
app.get("/get-contacts", async (req, res) => {
  try {
    const contacts = await contactModel.find().sort({ createdAt: -1 }); // Sắp xếp theo ngày tạo (mới nhất trước)
    res.status(200).json(contacts);
  } catch (error) {
    console.error("Error fetching contacts:", error);
    res.status(500).json({ message: "Error fetching contact data." });
  }
});

// Cập nhật thông tin khách hàng
const updateInfoSchema = mongoose.Schema({
  fullName: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  address: { type: String, required: true },
  dob: { type: Date, required: true },
});

// Tạo model từ schema
const updateInfoModel = mongoose.model("UpdateInfo", updateInfoSchema);

// API để nhận dữ liệu form cập nhật thông tin khách hàng
app.post("/update-customer-info", async (req, res) => {
  try {
    const { fullName, email, phone, address, dob } = req.body;

    // Kiểm tra dữ liệu có đủ không
    if ( !fullName || !email || !phone || !address || !dob) {
      return res.status(400).json({ message: "All fields are required." });
    }

    // Cập nhật thông tin vào MongoDB
    const updatedInfo = await updateInfoModel.findOneAndUpdate(
      { email }, // Sử dụng _id để tìm khách hàng
      { fullName, phone, address, dob },
      { new: true } // Cập nhật thông tin và trả về đối tượng đã cập nhật
    );

    if (!updatedInfo) {
      return res.status(404).json({ message: "Customer not found." });
    }

    // Trả về phản hồi thành công
    res.status(200).json({ message: "Information updated successfully!" });
  } catch (error) {
    console.error("Error updating customer info:", error);
    res.status(500).json({ message: "Error updating the information." });
  }
});

// API để lấy tất cả thông tin khách hàng
app.get('/get-customer-info/:id', async (req, res) => {
  try {
    // Tìm khách hàng theo email
    const customer = await updateInfoModel.findOne({ email: req.params.email });

    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    res.status(200).json(customer);
  } catch (error) {
    console.error("Error fetching customer info:", error);
    res.status(500).json({ message: "Error fetching customer data." });
  }
});



//Gửi kết nối messages phản hồi với database
app.listen(PORT, () => console.log("Server is running at port : " + PORT));
