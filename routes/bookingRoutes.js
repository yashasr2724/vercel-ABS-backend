const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking');
const User = require('../models/User');
const { verifyToken, authorizeRoles } = require('../middleware/authMiddleware');
const { sendEmail } = require('../utils/emailService');
const { getApprovedBookingsWithTimeOnly } = require('../controllers/bookingController');

const { Parser } = require('json2csv');
const ExcelJS = require('exceljs');


// Export route: CSV or Excel
router.get('/export', verifyToken, authorizeRoles('admin'), async (req, res) => {
  const format = req.query.format || 'csv'; // default to CSV
  try {
    const bookings = await Booking.find({ status: 'approved' }).populate('requestedBy', 'name email department');

    const exportData = bookings.map(b => ({
      EventName: b.eventName,
      EventType: b.eventType,
      Department: b.department,
      RequestedBy: b.requestedBy?.name || 'Admin',
      Email: b.requestedBy?.email || 'N/A',
      StartTime: b.startTime.toLocaleString(),
      EndTime: b.endTime.toLocaleString(),
      Slot: `${b.sTime} - ${b.eTime}`,
      Requirements: b.requirements.join(', ')
    }));

    if (format === 'excel') {
      // Create Excel workbook
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Approved Bookings');

      worksheet.columns = Object.keys(exportData[0]).map(key => ({
        header: key,
        key,
        width: 25
      }));

      exportData.forEach(row => {
        worksheet.addRow(row);
      });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=bookings.xlsx');
      await workbook.xlsx.write(res);
      res.end();
    } else {
      // Generate CSV
      const parser = new Parser();
      const csv = parser.parse(exportData);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=bookings.csv');
      res.send(csv);
    }
  } catch (err) {
    console.error('Export Error:', err);
    res.status(500).json({ message: 'Failed to export bookings' });
  }
});



router.get('/approved-times', verifyToken, getApprovedBookingsWithTimeOnly);

// ===================== ADMIN ROUTES =====================

router.get('/', verifyToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const bookings = await Booking.find()
      .populate('requestedBy', 'name email department')
      .sort({ createdAt: -1 });

    res.json(bookings);
  } catch (err) {
    console.error('Fetch Bookings Error:', err);
    res.status(500).json({ message: 'Failed to fetch bookings' });
  }
});

router.get('/approved', async (req, res) => {
  try {
    const approvedBookings = await Booking.find({ status: 'approved' });

    const grouped = {};

    approvedBookings.forEach(b => {
      const date = new Date(b.startTime).toISOString().split('T')[0];
      if (!grouped[date]) grouped[date] = [];

      grouped[date].push({
        slot: `${b.sTime} - ${b.eTime}`,
        department: b.department,
        eventName: b.eventName
      });
    });

    const result = Object.entries(grouped).map(([date, slots]) => ({
      date,
      bookedSlots: slots.map(s => s.slot),
      department: slots[0].department, // optionally from first entry
      eventName: slots[0].eventName   // optionally from first entry
    }));

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch approved bookings' });
  }
});


router.get('/pending', verifyToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const pendingBookings = await Booking.find({ status: 'pending' })
      .populate('requestedBy', 'name email department')
      .sort({ createdAt: -1 });

    res.json(pendingBookings);
  } catch (err) {
    console.error('Fetch Pending Bookings Error:', err);
    res.status(500).json({ message: 'Failed to fetch pending bookings' });
  }
});

router.get('/recent-bookings', verifyToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const year = parseInt(req.query.year);
    const month = parseInt(req.query.month); // 1-based

    if (!year || !month) {
      return res.status(400).json({ message: 'Year and month required' });
    }

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59); // end of month

    const bookings = await Booking.find({
      startTime: { $gte: startDate, $lte: endDate }
    }).sort({ startTime: -1 });

    res.json(bookings);
  } catch (err) {
    console.error('Recent Bookings Error:', err);
    res.status(500).json({ message: 'Failed to fetch recent bookings' });
  }
});


router.get('/metrics', verifyToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalBookings = await Booking.countDocuments();
    res.json({ totalUsers, totalBookings });
  } catch (err) {
    console.error('Admin Metrics Error:', err);
    res.status(500).json({ message: 'Failed to fetch dashboard metrics' });
  }
});

router.put('/:bookingId/status', verifyToken, authorizeRoles('admin'), async (req, res) => {
  const { bookingId } = req.params;
  const { status } = req.body;

  try {
    const booking = await Booking.findById(bookingId).populate('requestedBy');

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    booking.status = status;
    await booking.save();

    const { email, name, department } = booking.requestedBy;

    if (status === 'approved') {
      await sendEmail({
        to: email,
        subject: `Your Booking Request has been APPROVED`,
        html: `
          <p>Hello <strong>${name}</strong>,</p>
          <p>Your auditorium booking request has been <strong>approved</strong> by the Admin.</p>
          <p>
            <strong>Event:</strong> ${booking.eventName}<br>
            <strong>Start Time:</strong> ${new Date(booking.startTime).toLocaleString()}<br>
            <strong>End Time:</strong> ${new Date(booking.endTime).toLocaleString()}<br>
            <strong>Requirements:</strong> ${booking.requirements?.join(', ') || 'None'}
          </p>
          <p>Regards,<br>Auditorium Management System</p>
        `
      });

      const lowerReqs = (booking.requirements || []).map(req => req.toLowerCase());

      if (lowerReqs.includes('camera')) {
        await sendEmail({
          to: 'ofake5389@gmail.com',
          subject: '📸 Camera Required for Approved Event',
          html: `
            <p>An event has been approved that requires a camera setup:</p>
            <ul>
              <li><strong>Event:</strong> ${booking.eventName}</li>
              <li><strong>Department:</strong> ${department}</li>
              <li><strong>Start:</strong> ${new Date(booking.startTime).toLocaleString()}</li>
              <li><strong>End:</strong> ${new Date(booking.endTime).toLocaleString()}</li>
            </ul>
          `
        });
      }

      if (lowerReqs.includes('mic') || lowerReqs.includes('speakers')) {
        await sendEmail({
          to: 'mmax73060@gmail.com',
          subject: '🔊 Mic/Speakers Required for Approved Event',
          html: `
            <p>An event has been approved that requires mic or speaker setup:</p>
            <ul>
              <li><strong>Event:</strong> ${booking.eventName}</li>
              <li><strong>Department:</strong> ${department}</li>
              <li><strong>Start:</strong> ${new Date(booking.startTime).toLocaleString()}</li>
              <li><strong>End:</strong> ${new Date(booking.endTime).toLocaleString()}</li>
              <li><strong>Requirements:</strong> ${booking.requirements?.join(', ')}</li>
            </ul>
          `
        });
      }
    }

    res.json({ message: `Booking ${status}${status === 'approved' ? ' and notification emails sent' : ''}.` });
  } catch (err) {
    console.error('Update Status Error:', err);
    res.status(500).json({ message: 'Failed to update booking status' });
  }
});

router.post('/admin-book', verifyToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const { eventName, eventType, startTime, endTime, sTime, eTime, comments, requirements } = req.body;

    const adminUser = await User.findById(req.user.id);
    if (!adminUser) {
      return res.status(404).json({ message: 'Admin user not found' });
    }

    const conflict = await Booking.findOne({
      status: 'approved',
      $or: [
        {
          startTime: { $lt: new Date(endTime) },
          endTime: { $gt: new Date(startTime) }
        }
      ]
    });

    if (conflict) {
      return res.status(400).json({ message: 'Time slot already booked' });
    }

    const newBooking = new Booking({
      department: adminUser.department || 'Admin',
      eventName,
      eventType,
      startTime,
      endTime,
      sTime,
      eTime,
      comments,
      requirements: requirements || [],
      status: 'approved',
      bookedByAdmin: true
    });

    await newBooking.save();

    res.status(201).json({ message: 'Auditorium booked successfully by admin.' });
  } catch (err) {
    console.error('Admin Booking Error:', err);
    res.status(500).json({ message: 'Server error during admin booking.' });
  }
});

router.delete('/admin-cancel/:bookingId', verifyToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.bookingId);

    if (!booking || !booking.bookedByAdmin) {
      return res.status(404).json({ message: 'Admin booking not found.' });
    }

    await booking.deleteOne();
    res.json({ message: 'Admin booking cancelled successfully.' });
  } catch (err) {
    console.error('Cancel Admin Booking Error:', err);
    res.status(500).json({ message: 'Error cancelling admin booking.' });
  }
});

// ===================== HOD ROUTES =====================

router.post('/', verifyToken, authorizeRoles('hod'), async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const { eventName, eventType, startTime, endTime, sTime, eTime, comments, requirements } = req.body;

    const conflict = await Booking.findOne({
      status: 'approved',
      $or: [
        {
          startTime: { $lt: new Date(endTime) },
          endTime: { $gt: new Date(startTime) }
        }
      ]
    });

    if (conflict) {
      return res.status(400).json({ message: 'Time slot already booked' });
    }

    if (!user || !user.department) {
      return res.status(400).json({ message: 'User department is missing. Please contact admin.' });
    }

    const newBooking = new Booking({
      department: user.department,
      eventName,
      eventType,
      startTime,
      endTime,
      sTime,
      eTime,
      comments,
      requirements: requirements || [],
      requestedBy: req.user.id
    });

    await newBooking.save();

    const admins = await User.find({ role: 'admin' });
    const adminEmails = admins.map(a => a.email);
    if (process.env.ADMIN_EMAIL) {
      adminEmails.push(process.env.ADMIN_EMAIL);
    }

    for (const email of adminEmails) {
      await sendEmail({
        to: email,
        subject: 'New Auditorium Booking Request',
        html: `
          <p>A new booking has been submitted by <strong>${user.name}</strong> from <strong>${user.department}</strong>.</p>
          <p>
            <strong>Event:</strong> ${eventName}<br>
            <strong>Start:</strong> ${new Date(startTime).toLocaleString()}<br>
            <strong>End:</strong> ${new Date(endTime).toLocaleString()}<br>
            <strong>Requirements:</strong> ${requirements?.join(', ') || 'None'}
          </p>
          <p>Please log in to the admin panel to review the request.</p>
        `
      });
    }

    res.status(201).json({ message: 'Booking request submitted successfully' });
  } catch (err) {
    console.error('Booking Error:', err);
    res.status(500).json({ message: 'Server error during booking submission' });
  }
});

router.get('/my-requests', verifyToken, authorizeRoles('hod'), async (req, res) => {
  try {
    const bookings = await Booking.find({ requestedBy: req.user.id }).sort({ createdAt: -1 });
    res.json(bookings);
  } catch (err) {
    console.error('Fetch My Requests Error:', err);
    res.status(500).json({ message: 'Server error fetching your bookings' });
  }
});

router.get('/booked-dates', verifyToken, async (req, res) => {
  try {
    const bookings = await Booking.find({
      status: 'approved',
      startTime: { $exists: true, $ne: null },
      endTime: { $exists: true, $ne: null }
    }).select('startTime endTime eventName department');

    const formatted = bookings.map(b => ({
      startDate: b.startTime,
      endDate: b.endTime,
      eventName: b.eventName,
      departmentName: b.department
    }));

    res.json(formatted);
  } catch (err) {
    console.error('Booked Dates Error:', err);
    res.status(500).json({ message: 'Failed to fetch booked dates' });
  }
});

module.exports = router;
