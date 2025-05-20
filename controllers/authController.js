const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { sendEmail } = require('../utils/emailService');

// LOGIN: Admin or HOD
const login = async (req, res) => {
  const { username, password } = req.body;

  try {
    const user = await User.findOne({ username });
    if (!user) return res.status(404).json({ message: 'User not found' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' });

    if (user.role === 'hod' && user.approved === false) {
      return res.status(403).json({ message: 'Account awaiting admin approval' });
    }

    const token = jwt.sign(
      {
        id: user._id,
        role: user.role,
        department: user.department,
      },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.json({
      token,
      role: user.role,
      name: user.name,
      department: user.department,
    });
  } catch (err) {
    console.error('Login Error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ADMIN: Register a new HOD
const registerHOD = async (req, res) => {
  const { name, email, username, password, department } = req.body;

  try {
    const existingUser = await User.findOne({ $or: [{ username }, { email }] });
    if (existingUser) return res.status(400).json({ message: 'User already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      name,
      email,
      username,
      password: hashedPassword,
      department,
      role: 'hod',
      approved: true,
    });

    await newUser.save();
    
    // 📧 Send email to HOD with credentials
    await sendEmail({
      to: email,
      subject: 'Your HOD Account Credentials - Auditorium Booking System',
      html: `
        <h3>Welcome, ${name}!</h3>
        <p>Your HOD account has been successfully created.</p>
        <p><strong>Username:</strong> ${username}</p>
        <p><strong>Password:</strong> ${password}</p>
        <p>You can now log in to the system using the credentials above.</p>
        <br/>
        <p>Regards,<br/>Auditorium Booking Team</p>
      `,
    });

    res.status(201).json({ message: 'HOD registered successfully and email sent' });
  } catch (err) {
    console.error('Register HOD Error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};


// ADMIN: Edit HOD details
const updateHOD = async (req, res) => {
  const { id } = req.params;
  const { name, email, username, password } = req.body;

  try {
    const user = await User.findById(id);
    if (!user || user.role !== 'hod') {
      return res.status(404).json({ message: 'HOD not found' });
    }

    user.name = name || user.name;
    user.email = email || user.email;
    user.username = username || user.username;

    if (password) {
      user.password = await bcrypt.hash(password, 10);
    }

    await user.save();
    res.status(200).json({ message: 'HOD updated successfully' });
  } catch (err) {
    console.error('Update HOD Error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ✅ Get all approved HODs
const getAllApprovedHODs = async (req, res) => {
  try {
    const hods = await User.find({ role: 'hod', approved: true }).select('-password');
    res.status(200).json(hods);
  } catch (err) {
    console.error('Fetch HODs Error:', err);
    res.status(500).json({ message: 'Failed to fetch HODs' });
  }
};

// 🔐 Admin Forgot Password - Send OTP
const adminForgotPassword = async (req, res) => {
  const { username } = req.body;

  try {
    const user = await User.findOne({ username, role: 'admin' });
    if (!user) return res.status(404).json({ message: 'Admin not found' });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = new Date(Date.now() + 10 * 60 * 1000);

    user.otp = otp;
    user.otpExpiresAt = expiry;
    await user.save();

    try {
      await sendEmail(user.email, 'Admin Password Reset OTP', `Your OTP is: ${otp}`);
    } catch (error) {
      console.error("Email Error (Admin Forgot):", error);
      return res.status(500).json({ message: 'Failed to send OTP email' });
    }

    res.json({ message: 'OTP sent to your email' });
  } catch (error) {
    res.status(500).json({ message: 'Error sending OTP', error });
  }
};

// 🔐 Admin Reset Password with OTP
const adminResetPassword = async (req, res) => {
  const { username, otp, newPassword } = req.body;

  try {
    const user = await User.findOne({ username, role: 'admin' });
    if (!user || user.otp !== otp || new Date() > user.otpExpiresAt) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    user.otp = null;
    user.otpExpiresAt = null;
    await user.save();

    res.json({ message: 'Password reset successful' });
  } catch (error) {
    res.status(500).json({ message: 'Error resetting password', error });
  }
};

// 🔐 HOD Forgot Password - Notify Admin
const hodForgotPassword = async (req, res) => {
  const { username } = req.body;

  try {
    const hod = await User.findOne({ username, role: 'hod' });
    if (!hod) return res.status(404).json({ message: 'HOD not found' });

    const admin = await User.findOne({ role: 'admin' });
    if (!admin) return res.status(404).json({ message: 'Admin not found' });

    const message = `HOD user "${hod.name}" requested a password reset.\nPlease log in and reset it from the admin panel.`;

    try {
      await sendEmail(admin.email, 'HOD Password Reset Request', message);
    } catch (error) {
      console.error("Email Error (HOD Forgot):", error);
      return res.status(500).json({ message: 'Failed to notify admin' });
    }

    res.json({ message: 'Reset request sent to admin' });
  } catch (error) {
    res.status(500).json({ message: 'Error notifying admin', error });
  }
};

// 🔐 Admin Reset HOD Password
const resetHodPassword = async (req, res) => {
  const { username, newPassword } = req.body;

  try {
    const hod = await User.findOne({ username, role: 'hod' });
    if (!hod) return res.status(404).json({ message: 'HOD not found' });

    hod.password = await bcrypt.hash(newPassword, 10);
    await hod.save();

    try {
      await sendEmail(hod.email, 'Your New Password', `Your new password is: ${newPassword}`);
    } catch (error) {
      console.error("Email Error (Reset HOD):", error);
      return res.status(500).json({ message: 'Failed to send new password email' });
    }

    res.json({ message: 'Password reset and sent to HOD email' });
  } catch (error) {
    res.status(500).json({ message: 'Error resetting HOD password', error });
  }
};

// Unified Forgot Password (Admin gets OTP, HOD triggers admin email)
const forgotPassword = async (req, res) => {
  const { username } = req.body;

  try {
    const user = await User.findOne({ username });
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (user.role === 'admin') {
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const expiry = new Date(Date.now() + 10 * 60 * 1000);

      user.otp = otp;
      user.otpExpiresAt = expiry;
      await user.save();

      try {
        await sendEmail(user.email, 'Admin Password Reset OTP', `Your OTP is: ${otp}`);
      } catch (error) {
        console.error("Email Error (Unified Admin):", error);
        return res.status(500).json({ message: 'Failed to send OTP email' });
      }

      return res.json({ message: 'OTP sent to admin email' });
    }

    if (user.role === 'hod') {
      const admin = await User.findOne({ role: 'admin' });
      if (!admin) return res.status(404).json({ message: 'Admin not found' });

      const message = `HOD "${user.name}" has requested a password reset. Please reset it from the admin panel.`;

      try {
        await sendEmail(admin.email, 'HOD Password Reset Request', message);
      } catch (error) {
        console.error("Email Error (Unified HOD):", error);
        return res.status(500).json({ message: 'Failed to notify admin' });
      }

      return res.json({ message: 'Password reset request sent to admin' });
    }

    return res.status(400).json({ message: 'Unsupported user role' });
  } catch (err) {
    console.error('Forgot Password Error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  login,
  registerHOD,
  updateHOD,
  getAllApprovedHODs,
  adminForgotPassword,
  adminResetPassword,
  hodForgotPassword,
  resetHodPassword,
  forgotPassword
};
