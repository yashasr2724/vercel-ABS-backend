const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  department: { type: String, required: true },
  eventName: { type: String, required: true },
  eventType: { type: String, required: true },
  startTime: { type: Date, required: true },
  endTime: { type: Date, required: true },
  sTime: { type: String, required: true }, // e.g., '09:00'
  eTime: { type: String, required: true }, // e.g., '10:00'
  comments: { type: String },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  requestedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false // Not required for admin bookings
  },
  bookedByAdmin: {
    type: Boolean,
    default: false // Admin bookings are auto-approved
  },
  requirements: {
    type: [String], // Example: ['mic', 'bottles', 'camera', 'speakers']
    default: []
  }
}, { timestamps: true });

/**
 * Notes:
 * - Admin bookings use bookedByAdmin: true
 * - Conflict check is handled in the route logic, not here
 * - requirements: Array of strings to list selected amenities
 * - sTime and eTime store just time strings for easier frontend display
 */

module.exports = mongoose.model('Booking', bookingSchema);
