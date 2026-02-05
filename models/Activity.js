const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema({
  athleteId: {
    type: Number,
    required: true,
    index: true
  },
  stravaActivityId: {
    type: Number,
    required: true,
    unique: true,
    index: true
  },
  name: String,
  type: String,
  sportType: String,
  distance: { type: Number, default: 0 },
  movingTime: { type: Number, default: 0 },
  elapsedTime: { type: Number, default: 0 },
  totalElevationGain: { type: Number, default: 0 },
  startDate: Date,
  startDateLocal: Date,
  timezone: String,
  utcOffset: Number,
  startLatLng: [Number],
  endLatLng: [Number],
  achievementCount: { type: Number, default: 0 },
  kudosCount: { type: Number, default: 0 },
  commentCount: { type: Number, default: 0 },
  athleteCount: { type: Number, default: 1 },
  photoCount: { type: Number, default: 0 },
  trainer: { type: Boolean, default: false },
  commute: { type: Boolean, default: false },
  manual: { type: Boolean, default: false },
  private: { type: Boolean, default: false },
  flagged: { type: Boolean, default: false },
  workoutType: Number,
  averageSpeed: { type: Number, default: 0 },
  maxSpeed: { type: Number, default: 0 },
  averageCadence: Number,
  averageHeartrate: Number,
  maxHeartrate: Number,
  averageWatts: Number,
  maxWatts: Number,
  weightedAverageWatts: Number,
  kilojoules: Number,
  deviceWatts: Boolean,
  hasHeartrate: { type: Boolean, default: false },
  calories: { type: Number, default: 0 },
  sufferScore: Number,
  map: {
    id: String,
    summaryPolyline: String,
    resourceState: Number
  },
  gearId: String,
  deviceName: String,
  description: String,
  locationCity: String,
  locationState: String,
  locationCountry: String,
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

activitySchema.index({ athleteId: 1, startDate: -1 });
activitySchema.index({ athleteId: 1, type: 1 });

activitySchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Activity', activitySchema);
