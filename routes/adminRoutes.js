const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Booking = require('../models/Booking');
const { verifyToken, authorizeRoles } = require('../middleware/authMiddleware');

// GET /api/admin/metrics - Dashboard overview (Total Users, Bookings)
router.get('/metrics', verifyToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const totalUsers = await User.countDocuments({ role: 'hod' });
    const totalBookings = await Booking.countDocuments();

    res.json({ totalUsers, totalBookings });
  } catch (err) {
    console.error('Dashboard Metrics Error:', err);
    res.status(500).json({ message: 'Failed to fetch dashboard metrics' });
  }
});

module.exports = router;
