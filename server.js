require('dotenv').config(); // ✅ Load env variables first

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const departmentRoutes = require('./routes/departmentRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const adminRoutes = require('./routes/adminRoutes');
const bodyParser = require('body-parser');
const app = express();

// Debug: check email environment variables
console.log("Email user:", process.env.EMAIL_USER);
console.log("Email pass present:", !!process.env.EMAIL_PASS);

// Allow larger JSON and URL-encoded bodies (like base64 images)
app.use(bodyParser.json({ limit: '10mb' })); // Adjust to 10mb or more
app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));

// Middleware
const allowedOrigins = ['https://vercel-abs-frontend-yashasrr.vercel.app']; // Replace with your actual frontend URL

app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true
}));
app.options('*', cors()); // Allow preflight requests

app.use(express.json());
app.use('/api/user', userRoutes);
app.get("/", (req, res) => {
  res.send("Backend is running 🚀");
});

// API Routes
app.use('/api/departments', departmentRoutes);
app.use('/api/booking', bookingRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);

// Connect to DB and start server
const PORT = process.env.PORT || 5000;

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('MongoDB connected');
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch(err => console.error('MongoDB connection error:', err));
