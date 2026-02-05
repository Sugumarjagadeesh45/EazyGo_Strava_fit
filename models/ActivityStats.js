/**
 * ActivityStats Model - Stores REAL Strava statistics
 * All data comes directly from Strava API /athletes/{id}/stats endpoint
 */
const mongoose = require('mongoose');

// Sub-schema for activity totals (matches Strava API structure)
const totalsSchema = new mongoose.Schema({
  count: { type: Number, default: 0 },
  distance: { type: Number, default: 0 },           // meters
  movingTime: { type: Number, default: 0 },         // seconds
  elapsedTime: { type: Number, default: 0 },        // seconds
  elevationGain: { type: Number, default: 0 },      // meters
  achievementCount: { type: Number, default: 0 }
}, { _id: false });

const activityStatsSchema = new mongoose.Schema({
  // Link to athlete
  athleteId: {
    type: Number,
    required: true,
    unique: true,
    index: true
  },

  // Records (REAL from Strava)
  biggestRideDistance: { type: Number, default: 0 },        // meters
  biggestClimbElevationGain: { type: Number, default: 0 },  // meters

  // Recent totals - last 4 weeks (REAL from Strava)
  recentRideTotals: { type: totalsSchema, default: () => ({}) },
  recentRunTotals: { type: totalsSchema, default: () => ({}) },
  recentSwimTotals: { type: totalsSchema, default: () => ({}) },

  // Year-to-date totals (REAL from Strava)
  ytdRideTotals: { type: totalsSchema, default: () => ({}) },
  ytdRunTotals: { type: totalsSchema, default: () => ({}) },
  ytdSwimTotals: { type: totalsSchema, default: () => ({}) },

  // All-time totals (REAL from Strava)
  allRideTotals: { type: totalsSchema, default: () => ({}) },
  allRunTotals: { type: totalsSchema, default: () => ({}) },
  allSwimTotals: { type: totalsSchema, default: () => ({}) },

  // Timestamps
  lastSyncAt: Date,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Update timestamp on save
activityStatsSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Virtual for total activities count
activityStatsSchema.virtual('totalActivities').get(function() {
  return (this.allRideTotals?.count || 0) +
         (this.allRunTotals?.count || 0) +
         (this.allSwimTotals?.count || 0);
});

// Virtual for total distance (all activities)
activityStatsSchema.virtual('totalDistance').get(function() {
  return (this.allRideTotals?.distance || 0) +
         (this.allRunTotals?.distance || 0) +
         (this.allSwimTotals?.distance || 0);
});

// Virtual for total moving time (all activities)
activityStatsSchema.virtual('totalMovingTime').get(function() {
  return (this.allRideTotals?.movingTime || 0) +
         (this.allRunTotals?.movingTime || 0) +
         (this.allSwimTotals?.movingTime || 0);
});

// Ensure virtuals are included in JSON
activityStatsSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('ActivityStats', activityStatsSchema);
