const mongoose = require('mongoose');

const oAuthTokenSchema = new mongoose.Schema({
  athleteId: {
    type: Number,
    required: true,
    unique: true,
    index: true
  },
  accessToken: {
    type: String,
    required: true
  },
  refreshToken: {
    type: String,
    required: true
  },
  expiresAt: {
    type: Date,
    required: true
  },
  tokenType: {
    type: String,
    default: 'Bearer'
  },
  scope: String,
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

oAuthTokenSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Check if token is expired
oAuthTokenSchema.methods.isExpired = function() {
  return new Date() >= this.expiresAt;
};

module.exports = mongoose.model('OAuthToken', oAuthTokenSchema);
