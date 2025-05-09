const Booking = require('../models/Booking');
const User = require('../models/User');
const { sendEmail } = require('../utils/emailService'); // ✅ Use the full-featured emailService

const getApprovedBookingsWithTimeOnly = async (req, res) => {
  try {
    const bookings = await Booking.find({ status: 'approved' }).select(' startTime endTime sTime eTime department eventName ');                     //
    res.json(bookings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch bookings with time only' });
  }
};

const getAllBookings = async (req, res) => {
  try {
    const bookings = await Booking.find()
      .populate('department', 'name')
      .populate('hod', 'name email')
      .sort({ createdAt: -1 });

    res.json(bookings);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

const getApprovedBookings = async (req, res) => {
  try {
    const approvedBookings = await Booking.find({ status: 'approved' })
      .select('startTime endTime') // optional: select only needed fields
      .sort({ startTime: 1 });

    res.json(approvedBookings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch approved bookings' });
  }
};

const updateBookingStatus = async (req, res) => {
  const { bookingId } = req.params;
  const { status } = req.body;

  try {
    const booking = await Booking.findById(bookingId)
      .populate('department', 'name')
      .populate('hod', 'name email');

    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    if (status === 'approved') {
      const conflict = await Booking.findOne({
        _id: { $ne: bookingId },
        status: 'approved',
        $or: [
          { startTime: { $lt: booking.endTime, $gte: booking.startTime } },
          { endTime: { $gt: booking.startTime, $lte: booking.endTime } },
          { startTime: { $lte: booking.startTime }, endTime: { $gte: booking.endTime } }
        ]
      });

      if (conflict) {
        return res.status(409).json({ message: 'Time conflict with another booking' });
      }
    }

    booking.status = status;
    await booking.save();

    // ✅ Fetch all admin emails
    const adminUsers = await User.find({ role: 'admin' });
    const adminEmails = adminUsers.map(admin => admin.email);
    if (process.env.ADMIN_EMAIL && !adminEmails.includes(process.env.ADMIN_EMAIL)) {
      adminEmails.push(process.env.ADMIN_EMAIL); // fallback admin
    }

    // ✅ Prepare email content
    const subject = `Booking ${status === 'approved' ? 'Approved' : 'Rejected'}: ${booking.eventName}`;
    const html = `
      <p><strong>Department:</strong> ${booking.department?.name || 'N/A'}</p>
      <p><strong>Event:</strong> ${booking.eventName}</p>
      <p><strong>Status:</strong> ${status}</p>
      <p><strong>Time:</strong> ${booking.startTime.toLocaleString()} - ${booking.endTime.toLocaleString()}</p>
      <p>Check the dashboard for more info.</p>
    `;

    // ✉️ Notify HOD
    if (booking.hod?.email) {
      await sendEmail({ to: booking.hod.email, subject, html });
    }

    // ✉️ Notify all admins
    for (const email of adminEmails) {
      await sendEmail({ to: email, subject, html });
    }

    // ✅ Equipment notification emails
    if (status === 'approved' && !booking.bookedByAdmin && booking.requirements?.length > 0) {
      const requirementEmails = [];

      if (booking.requirements.includes('camera')) {
        requirementEmails.push({
          to: 'ofake5389@gmail.com',
          subject: 'Camera Requirement for Approved Booking',
          html: `<p>A booking requiring a camera has been approved. Event: ${booking.eventName}</p>`
        });
      }

      if (
        booking.requirements.includes('mic') ||
        booking.requirements.includes('speakers')
      ) {
        requirementEmails.push({
          to: 'mmax73060@gmail.com',
          subject: 'Audio Equipment Requirement for Approved Booking',
          html: `<p>A booking requiring mic or speakers has been approved. Event: ${booking.eventName}</p>`
        });
      }

      for (const mail of requirementEmails) {
        await sendEmail(mail);
      }
    }

    res.json({ message: `Booking ${status} successfully` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

const bookByAdmin = async (req, res) => {
  const { eventName, eventType, startTime, endTime, sTime, eTime, comments } = req.body;

  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const conflict = await Booking.findOne({
      status: 'approved',
      $or: [
        { startTime: { $lt: endTime, $gte: startTime } },
        { endTime: { $gt: startTime, $lte: endTime } },
        { startTime: { $lte: startTime }, endTime: { $gte: endTime } }
      ]
    });

    if (conflict) {
      return res.status(409).json({ message: 'Time conflict with another booking' });
    }

    const booking = new Booking({
      eventName,
      eventType,
      startTime,
      endTime,
      sTime,       // ✅ added
      eTime,       // ✅ added
      comments,
      department: user.department,
      status: 'approved',
      bookedByAdmin: true
    });

    await booking.save();
    res.status(201).json({ message: 'Booking successful', booking });
  } catch (err) {
    console.error('Admin booking error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getAllBookings,
  updateBookingStatus,
  bookByAdmin,
  getApprovedBookings,
  getApprovedBookingsWithTimeOnly
};
