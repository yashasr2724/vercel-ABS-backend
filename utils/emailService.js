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

transporter.verify((error, success) => {
  if (error) {
    console.error('Email transporter verification failed:', error);
  } else {
    console.log('Email transporter is ready to send messages');
  }
});

const sendEmail = async (toOrOptions, subject, text) => {
  let mailOptions;

  if (typeof toOrOptions === 'object') {
    mailOptions = {
      from: `"Auditorium Booking" <${process.env.EMAIL_USER}>`,
      to: Array.isArray(toOrOptions.to) ? toOrOptions.to.join(', ') : toOrOptions.to,
      subject: toOrOptions.subject,
      html: toOrOptions.html
    };
  } else {
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
    throw error; // ⚠️ important!
  }
};

module.exports = { sendEmail };
