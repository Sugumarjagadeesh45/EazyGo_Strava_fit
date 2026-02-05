/**
 * JWT Authentication Middleware
 * Protects routes that require authentication
 */
const jwt = require('jsonwebtoken');

const auth = (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.header('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'No token provided. Authorization denied.',
        hint: 'Include Authorization header: Bearer <token>'
      });
    }

    const token = authHeader.replace('Bearer ', '');

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Add athlete ID to request (from JWT payload)
    req.athleteId = decoded.id;

    // Optional: Verify the athleteId in params matches the token
    const paramAthleteId = req.params.athleteId;
    if (paramAthleteId && parseInt(paramAthleteId) !== decoded.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only access your own data.',
        tokenAthleteId: decoded.id,
        requestedAthleteId: parseInt(paramAthleteId)
      });
    }

    next();
  } catch (error) {
    console.error('Auth middleware error:', error.message);

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token has expired. Please reconnect with Strava.'
      });
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token. Please reconnect with Strava.'
      });
    }

    return res.status(401).json({
      success: false,
      message: 'Token validation failed.'
    });
  }
};

module.exports = auth;