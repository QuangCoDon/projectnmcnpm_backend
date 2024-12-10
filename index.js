const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const dotenv = require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(
  express.urlencoded({
    extended: true,
    limit: '10mb',
  }),
);

const PORT = process.env.PORT || 8080;
//mongodb connection
mongoose.set('strictQuery', false);
mongoose
  .connect(process.env.MONGODB_URL)
  .then(() => console.log('Connect to Database'))
  .catch((err) => console.log(err));

//schema
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

//
const userModel = mongoose.model('user', userSchema);

//api
app.get('/', (req, res) => {
  res.send('Server is running');
});


//sign up
app.post('/signup', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).send({ message: 'Email is required' });
    }

    const result = await userModel.findOne({ email: email });

    if (result) {
      return res
        .status(400)
        .send({ message: 'Email is already registered', alert: false });
    } else {
      const newUser = new userModel(req.body);
      await newUser.save();
      return res
        .status(200)
        .send({ message: 'Successfully signed up', alert: true });
    }
  } catch (err) {
    console.error(err);
    return res.status(500).send({ message: 'An error occurred during signup' });
  }
});

//login api
app.post('/login', async (req, res) => {
  // console.log(req.body)
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).send({ message: 'Email is required' });
    }

    const result = await userModel.findOne({ email: email });

    if (result) {
      const dataSend = {
        _id: result._id,
        firstName: result.firstName,
        lastName: result.lastName,
        email: result.email,
        image: result.image,
      };
      console.log(dataSend);
      return res
        .status(200)
        .send({
          message: 'Login is successfully',
          alert: true,
          data: dataSend,
        });
    } else {
      return res
        .status(400)
        .send({
          message: 'Email is not available, please sign up',
          alert: false,
        });
    }
  } catch (err) {
    console.error(err);
    return res.status(500).send({ message: 'An error occurred during signup' });
  }
});

//product section

const schemaProduct = mongoose.Schema({
  name: String,
  category: String,
  image: String,
  price: String,
  description: String,
});
const productModel = mongoose.model('product', schemaProduct);

// save product in database
// api
app.post('/uploadProduct', async (req, res) => {
  console.log(req.body);
  const data = productModel(req.body);
  const datasave = await data.save();
  res.send({ message: 'Upload successfully' });
});

app.get('/product', async (req, res) => {
  const data = await productModel.find({});
  res.send(JSON.stringify(data));
});
app.get('/product/search', async (req, res) => {
  try {
    const { name } = req.query;

    if (!name || name.trim() === '') {
      console.log('Search term missing');
      return res.status(400).json({ error: 'Search term is required' });
    }

    // Sử dụng regex để tìm kiếm sản phẩm theo tên
    const query = { name: { $regex: name, $options: 'i'  } }; // options: i => không phân biệt chữ hoa, chữ thường
    const data = await productModel.find(query); 
    // console.log('Search Query:', query); // Log query để kiểm tra
    // console.log('Search Results:', data); // Log kết quả từ database
    res.status(200).json(data); 
  } catch (error) {
    console.error('Error searching for products:', error);
    res.status(500).json({ error: 'Failed to search for products' });
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
        .json({ error: 'Cart is empty. Please add items to cart.' });
    }
    if (items.length < 2) {
      return res
        .status(400)
        .json({
          error: 'Insufficient items for checkout. Minimum 2 items required.',
        });
    }
    const totalAmount = items.reduce(
      (acc, item) => acc + item.price * item.qty,
      0,
    );
    if (totalAmount < 15) {
      return res
        .status(400)
        .json({ error: 'Total amount is too low for checkout.' });
    }
    const mockSession = {
      sessionId: 'mock_session_id_123456',
      message: 'This is a mock payment session',
      paymentUrl: `${process.env.FRONTEND_URL}/success`, 
      cancelUrl: `${process.env.FRONTEND_URL}/cancel`, 
    };

    res.status(200).json(mockSession);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'An error occurred in the mock payment' });
  }
});

//Gửi kết nối messages phản hồi với database
app.listen(PORT, () => console.log('Server is running at port : ' + PORT));

const contactSchema = mongoose.Schema({
  name: String,
  email: String,
  phone: String,
  message: String,
  createdAt: { type: Date, default: Date.now },
});

const contactModel = mongoose.model('Contact', contactSchema);

// API để nhận dữ liệu form
app.post('/submit-contact', async (req, res) => {
  try {
    const { name, email, phone, message } = req.body;

    if (!name || !email || !phone || !message) {
      return res.status(400).json({ message: 'All fields are required.' });
    }

    // Lưu vào MongoDB
    const newContact = new contactModel({
      name,
      email,
      phone,
      message,
    });

    await newContact.save();

    res.status(200).json({ message: 'Form submitted successfully!' });
  } catch (error) {
    console.error('Error saving contact form:', error);
    res.status(500).json({ message: 'Error submitting the form.' });
  }
});

// API để lấy danh sách đánh giá từ MongoDB
app.get('/get-contacts', async (req, res) => {
  try {
    const contacts = await contactModel.find().sort({ createdAt: -1 }); // Sắp xếp theo ngày tạo (mới nhất trước)
    res.status(200).json(contacts);
  } catch (error) {
    console.error('Error fetching contacts:', error);
    res.status(500).json({ message: 'Error fetching contact data.' });
  }
});