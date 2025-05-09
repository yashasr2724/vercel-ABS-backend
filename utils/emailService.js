// utils/emailService.js
const nodemailer = require('nodemailer');

console.log("Email user:", process.env.EMAIL_USER);
console.log("Email pass present:", !!process.env.EMAIL_PASS);

const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE || 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

/**
 * Sends an email. Can be called as:
 * sendEmail(to, subject, text)
 * OR
 * sendEmail({ to, subject, html })
 */
const sendEmail = async (toOrOptions, subject, text) => {
  let mailOptions;

  if (typeof toOrOptions === 'object') {
    // Full object form
    mailOptions = {
      from: `"Auditorium Booking" <${process.env.EMAIL_USER}>`,
      to: Array.isArray(toOrOptions.to) ? toOrOptions.to.join(', ') : toOrOptions.to,
      subject: toOrOptions.subject,
      html: toOrOptions.html
    };
  } else {
    // Shorthand: sendEmail(to, subject, text)
    mailOptions = {
      from: `"Auditorium Booking" <${process.env.EMAIL_USER}>`,
      to: toOrOptions,
      subject,
      html: `<p>${text}</p>`
    };
  }

  try {
    await transporter.sendMail(mailOptions);
    console.log('Email sent to:', mailOptions.to);
  } catch (error) {
    console.error('Email sending failed:', error);
  }
};

module.exports = { sendEmail };
