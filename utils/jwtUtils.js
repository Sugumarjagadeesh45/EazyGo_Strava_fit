/**
 * JWT Utility Functions
 * Handles token generation and verification for athlete authentication
 */
const jwt = require('jsonwebtoken');

/**
 * Generate JWT token for an athlete
 * @param {number} athleteId - Strava athlete ID
 * @param {object} additionalData - Optional additional data to include in token
 * @returns {string} JWT token
 */
const generateToken = (athleteId, additionalData = {}) => {
  const payload = {
    id: athleteId,
    type: 'athlete',
    ...additionalData,
    iat: Math.floor(Date.now() / 1000)
  };

  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d',
  });
};

/**
 * Verify JWT token
 * @param {string} token - JWT token to verify
 * @returns {object|null} Decoded token payload or null if invalid
 */
const verifyToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    console.error('Token verification failed:', error.message);
    return null;
  }
};

/**
 * Decode token without verification (for debugging)
 * @param {string} token - JWT token to decode
 * @returns {object|null} Decoded payload or null
 */
const decodeToken = (token) => {
  try {
    return jwt.decode(token);
  } catch (error) {
    return null;
  }
};

/**
 * Check if token is expired
 * @param {string} token - JWT token to check
 * @returns {boolean} True if expired
 */
const isTokenExpired = (token) => {
  const decoded = decodeToken(token);
  if (!decoded || !decoded.exp) return true;
  return decoded.exp < Math.floor(Date.now() / 1000);
};

module.exports = {
  generateToken,
  verifyToken,
  decodeToken,
  isTokenExpired
};