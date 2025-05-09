// admin.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const User = require('./models/User');

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('MongoDB connected'))
  .catch(err => console.log(err));

async function createAdmin() {
  try {
    const existing = await User.findOne({ username: 'admin1' });
    if (existing) {
      console.log('Admin already exists');
      return mongoose.disconnect();
    }

    const hashedPassword = await bcrypt.hash('admin123', 10);

    const admin = new User({
      name: 'Super Admin',
      email: 'admin@example.com',
      username: 'admin1',
      password: hashedPassword,
      role: 'admin',
      approved: true
    });

    await admin.save();
    console.log('✅ Admin created');
  } catch (err) {
    console.error(err);
  } finally {
    mongoose.disconnect();
  }
}

createAdmin();
