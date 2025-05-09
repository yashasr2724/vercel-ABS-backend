const express = require('express');
const router = express.Router();
const Department = require('../models/Department');
const { verifyToken } = require('../middleware/authMiddleware');

// @route   POST /api/departments
// @desc    Create a new department (Admin only)
// @access  Private
router.post('/', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only admin can create departments' });
    }

    const { name } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({ message: 'Department name is required' });
    }

    const existing = await Department.findOne({ name: name.trim() });
    if (existing) {
      return res.status(400).json({ message: 'Department already exists' });
    }

    const newDept = new Department({ name: name.trim() });
    await newDept.save();

    res.status(201).json({
      message: 'Department created successfully',
      department: { id: newDept._id, name: newDept.name },
    });
  } catch (err) {
    console.error('Error creating department:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/departments
// @desc    Get all departments
// @access  Private
router.get('/', verifyToken, async (req, res) => {
  try {
    const departments = await Department.find({}, 'name'); // return only name field
    const departmentList = departments.map((dept) => dept.name);
    res.status(200).json(departmentList);
  } catch (err) {
    console.error('Error fetching departments:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
