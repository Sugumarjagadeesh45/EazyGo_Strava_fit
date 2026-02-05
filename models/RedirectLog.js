const mongoose = require('mongoose');

const redirectLogSchema = new mongoose.Schema({
  // Request identification
  requestId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },

  // Platform detection
  platform: {
    type: String,
    enum: ['android', 'ios', 'web', 'unknown'],
    required: true,
    index: true
  },

  // Device information
  deviceInfo: {
    userAgent: String,
    deviceType: String,
    osVersion: String,
    browser: String,
    browserVersion: String
  },

  // Request details
  ipAddress: {
    type: String,
    required: true,
    index: true
  },

  // Redirect target
  redirectTarget: {
    type: String,
    enum: ['app_deep_link', 'play_store', 'app_store', 'web_fallback'],
    required: true
  },

  // URLs
  deepLinkUrl: String,
  fallbackUrl: String,
  finalRedirectUrl: String,

  // Query parameters passed
  queryParams: {
    type: Map,
    of: String
  },

  // Source tracking
  source: {
    type: String,
    enum: ['strava', 'email', 'sms', 'qr_code', 'social', 'direct', 'other'],
    default: 'direct'
  },

  // Campaign tracking (UTM parameters)
  campaign: {
    utmSource: String,
    utmMedium: String,
    utmCampaign: String,
    utmTerm: String,
    utmContent: String
  },

  // Referrer information
  referrer: String,

  // Response status
  responseStatus: {
    type: Number,
    default: 302
  },

  // Whether the redirect was successful
  success: {
    type: Boolean,
    default: true
  },

  // Error message if redirect failed
  errorMessage: String,

  // Processing time in milliseconds
  processingTime: Number,

  // Geolocation (optional - can be populated later)
  geolocation: {
    country: String,
    region: String,
    city: String
  }
}, {
  timestamps: true
});

// Indexes for analytics queries
redirectLogSchema.index({ createdAt: -1 });
redirectLogSchema.index({ platform: 1, createdAt: -1 });
redirectLogSchema.index({ redirectTarget: 1, createdAt: -1 });
redirectLogSchema.index({ source: 1, createdAt: -1 });
redirectLogSchema.index({ 'campaign.utmSource': 1, createdAt: -1 });

// Static method to get redirect statistics
redirectLogSchema.statics.getStats = async function(startDate, endDate) {
  const matchStage = {};
  if (startDate || endDate) {
    matchStage.createdAt = {};
    if (startDate) matchStage.createdAt.$gte = new Date(startDate);
    if (endDate) matchStage.createdAt.$lte = new Date(endDate);
  }

  const stats = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalRedirects: { $sum: 1 },
        successfulRedirects: {
          $sum: { $cond: ['$success', 1, 0] }
        },
        byPlatform: {
          $push: '$platform'
        },
        byTarget: {
          $push: '$redirectTarget'
        },
        avgProcessingTime: { $avg: '$processingTime' }
      }
    }
  ]);

  if (stats.length === 0) {
    return {
      totalRedirects: 0,
      successfulRedirects: 0,
      platformBreakdown: {},
      targetBreakdown: {},
      avgProcessingTime: 0
    };
  }

  // Count platform occurrences
  const platformCounts = stats[0].byPlatform.reduce((acc, platform) => {
    acc[platform] = (acc[platform] || 0) + 1;
    return acc;
  }, {});

  // Count target occurrences
  const targetCounts = stats[0].byTarget.reduce((acc, target) => {
    acc[target] = (acc[target] || 0) + 1;
    return acc;
  }, {});

  return {
    totalRedirects: stats[0].totalRedirects,
    successfulRedirects: stats[0].successfulRedirects,
    successRate: ((stats[0].successfulRedirects / stats[0].totalRedirects) * 100).toFixed(2) + '%',
    platformBreakdown: platformCounts,
    targetBreakdown: targetCounts,
    avgProcessingTime: Math.round(stats[0].avgProcessingTime || 0) + 'ms'
  };
};

// Static method to get recent redirects
redirectLogSchema.statics.getRecent = function(limit = 50) {
  return this.find()
    .sort({ createdAt: -1 })
    .limit(limit)
    .select('-__v');
};

module.exports = mongoose.model('RedirectLog', redirectLogSchema);
