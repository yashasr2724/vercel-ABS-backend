const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  profilePic: {
    type: String, // base64 or URL
    default: ''
  },  
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true
  },
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
    lowercase: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    trim: true,
    lowercase: true
  },
  department: {
    type: String,
    required: [true, 'Department is required'],
    trim: true
  },
  password: {
    type: String,
    required: [true, 'Password is required']
  },
  role: {
    type: String,
    enum: ['admin', 'hod'],
    default: 'hod'
  },
  approved: {
    type: Boolean,
    default: function () {
      return this.role === 'admin'; // Admins are auto-approved
    }
  },
  // 🔐 OTP fields for Admin forgot password
  otp: {
    type: String,
    default: null
  },
  otpExpiresAt: {
    type: Date,
    default: null
  }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
