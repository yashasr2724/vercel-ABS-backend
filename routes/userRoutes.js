const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const User = require('../models/User');
const Booking = require('../models/Booking'); // Import for metrics route
const { verifyToken, authorizeRoles } = require('../middleware/authMiddleware');

// ✅ Check if any user exists
router.get('/exists', async (req, res) => {
  try {
    const userExists = await User.exists({});
    res.json({ exists: !!userExists });
  } catch (err) {
    console.error('[CHECK-EXISTS ERROR]', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ✅ Registration route (for first admin)
router.post('/register', async (req, res) => {
  console.log('[REGISTER] Received registration data:', req.body);

  try {
    const { name, email, username, password } = req.body;

    // Input validation
    if (!name || !email || !username || !password) {
      console.warn('[REGISTER] Missing fields:', { name, email, username, password });
      return res.status(400).json({ message: 'All fields are required' });
    }

    // Check for existing user
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      console.warn('[REGISTER] Username already exists:', username);
      return res.status(400).json({ message: 'Username already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    console.log('[REGISTER] Password hashed successfully.');

    // Create and save new admin user
    const newUser = new User({
      name,
      email,
      username,
      password: hashedPassword,
      role: 'admin',
      approved: true,
      department: 'Admin'
    });

    await newUser.save();
    console.log('[REGISTER] Admin registered successfully:', newUser.username);

    res.status(201).json({ message: 'Admin registered successfully' });

  } catch (err) {
    console.error('[REGISTER ERROR]', err);
    res.status(500).json({ message: 'Server error during registration' });
  }
});

// ✅ Admin dashboard metrics route (total users & total bookings)
router.get('/admin/metrics', async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalBookings = await Booking.countDocuments();
    res.json({ totalUsers, totalBookings });
  } catch (err) {
    console.error('[METRICS ERROR]', err);
    res.status(500).json({ message: 'Server error fetching metrics' });
  }
});

router.put('/update-profile', verifyToken, async (req, res) => {
  try {
    const { username, email, password, profilePic } = req.body;

    const updatedFields = {};

    if (username?.trim()) updatedFields.username = username;
    if (email?.trim()) updatedFields.email = email;
    if (profilePic?.trim()) updatedFields.profilePic = profilePic;
    if (password?.trim()) {
      updatedFields.password = await bcrypt.hash(password, 10);
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      { $set: updatedFields },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json(updatedUser);
  } catch (err) {
    console.error('[UPDATE PROFILE ERROR]', err);
    res.status(500).json({ message: 'Server error updating profile' });
  }
});

router.get('/profile', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });

    res.status(200).json(user);
  } catch (err) {
    console.error('[FETCH PROFILE ERROR]', err);
    res.status(500).json({ message: 'Error fetching profile' });
  }
});

module.exports = router;
