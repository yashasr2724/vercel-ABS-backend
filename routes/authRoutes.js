const express = require('express');
const router = express.Router();

const {
  login,
  registerHOD,
  updateHOD,
  getAllApprovedHODs,
  adminForgotPassword,
  adminResetPassword,
  hodForgotPassword,
  resetHodPassword,
  forgotPassword  // include it here
} = require('../controllers/authController');

const { verifyToken, authorizeRoles } = require('../middleware/authMiddleware');

// Login route (no auth required)
router.post('/login', login);

// Unified forgot password route
router.post('/forgot-password', forgotPassword);

// Admin Forgot Password - Send OTP
router.post('/admin-forgot-password', adminForgotPassword);

// Admin Reset Password with OTP
router.post('/admin-reset-password', adminResetPassword);

// HOD Forgot Password - Sends request to Admin
router.post('/hod-forgot-password', hodForgotPassword);

// Admin resets HOD password manually
router.post('/reset-hod-password', verifyToken, authorizeRoles('admin'), resetHodPassword);

// Get all approved HODs (Admin only)
router.get('/hods', verifyToken, authorizeRoles('admin'), getAllApprovedHODs);

// Register HOD (Admin only)
router.post('/register-hod', verifyToken, authorizeRoles('admin'), registerHOD);

// Update HOD (Admin only)
router.put('/update-hod/:id', verifyToken, authorizeRoles('admin'), updateHOD);

module.exports = router;
