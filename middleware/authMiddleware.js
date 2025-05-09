const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
  const token = req.header('Authorization');

  console.log("Authorization Header:", token); // ✅ Log the raw token

  if (!token) return res.status(401).json({ message: 'Access Denied: No token provided' });

  try {
    const rawToken = token.split(" ")[1];
    const decodedToken = jwt.decode(rawToken);
    console.log("Decoded Token (before verify):", decodedToken); // ✅ Log decoded token content

    const verified = jwt.verify(rawToken, process.env.JWT_SECRET);
    req.user = verified;

    console.log("Verified User:", req.user); // ✅ Confirm verification
    next();
  } catch (err) {
    console.error("JWT Verification Failed:", err.message); // ✅ Error detail
    res.status(400).json({ message: 'Invalid token' });
  }
};

const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    console.log("Authorized Roles:", roles);
    console.log("Current User Role:", req.user?.role);

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Access Denied: Unauthorized role' });
    }
    next();
  };
};

module.exports = { verifyToken, authorizeRoles };
