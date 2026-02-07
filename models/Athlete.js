/**
 * Athlete Model - Stores REAL Strava athlete data
 * All data comes directly from Strava API
 */
const mongoose = require('mongoose');

const athleteSchema = new mongoose.Schema({
  // Strava ID (unique identifier)
  stravaId: {
    type: Number,
    required: true,
    unique: true,
    index: true
  },

  // Profile Info (REAL from Strava)
  username: String,
  firstName: String,
  lastName: String,
  bio: String,
  profileMedium: String,
  profile: String,

  // Location (REAL from Strava)
  city: String,
  state: String,
  country: String,

  // Physical Data (REAL from Strava)
  gender: { type: String, enum: ['M', 'F', null] },
  weight: Number, // in kg

  // Social Stats (REAL from Strava)
  followerCount: { type: Number, default: 0 },
  friendCount: { type: Number, default: 0 },

  // Subscription (REAL from Strava)
  premium: { type: Boolean, default: false },
  summit: { type: Boolean, default: false },

  // Strava Timestamps
  stravaCreatedAt: Date,
  stravaUpdatedAt: Date,

  // Measurement Preferences (REAL from Strava)
  measurementPreference: { type: String, enum: ['feet', 'meters'], default: 'meters' },

  // FTP for cycling (REAL from Strava)
  ftp: Number,

  // Last sync timestamp
  lastSyncAt: Date,

  // Our timestamps
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Update timestamp on save
athleteSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Virtual for full name
athleteSchema.virtual('fullName').get(function() {
  return `${this.firstName || ''} ${this.lastName || ''}`.trim();
});

// Ensure virtuals are included in JSON
athleteSchema.set('toJSON', { virtuals: true });

// Check if model already exists before creating
const Athlete = mongoose.models.Athlete || mongoose.model('Athlete', athleteSchema);

module.exports = Athlete;// /**

//  * Athlete Model - Stores REAL Strava athlete data
//  * All data comes directly from Strava API
//  */
// const mongoose = require('mongoose');

// const athleteSchema = new mongoose.Schema({
//   // Strava ID (unique identifier)
//   stravaId: {
//     type: Number,
//     required: true,
//     unique: true,
//     index: true
//   },

//   // Profile Info (REAL from Strava)
//   username: String,
//   firstName: String,
//   lastName: String,
//   bio: String,
//   profileMedium: String,
//   profile: String,

//   // Location (REAL from Strava)
//   city: String,
//   state: String,
//   country: String,

//   // Physical Data (REAL from Strava)
//   gender: { type: String, enum: ['M', 'F', null] },
//   weight: Number, // in kg

//   // Social Stats (REAL from Strava)
//   followerCount: { type: Number, default: 0 },
//   friendCount: { type: Number, default: 0 },

//   // Subscription (REAL from Strava)
//   premium: { type: Boolean, default: false },
//   summit: { type: Boolean, default: false },

//   // Strava Timestamps
//   stravaCreatedAt: Date,
//   stravaUpdatedAt: Date,

//   // Measurement Preferences (REAL from Strava)
//   measurementPreference: { type: String, enum: ['feet', 'meters'], default: 'meters' },

//   // FTP for cycling (REAL from Strava)
//   ftp: Number,

//   // Last sync timestamp
//   lastSyncAt: Date,

//   // Our timestamps
//   createdAt: { type: Date, default: Date.now },
//   updatedAt: { type: Date, default: Date.now }
// });

// // Update timestamp on save
// athleteSchema.pre('save', function(next) {
//   this.updatedAt = Date.now();
//   next();
// });

// // Virtual for full name
// athleteSchema.virtual('fullName').get(function() {
//   return `${this.firstName || ''} ${this.lastName || ''}`.trim();
// });

// // Ensure virtuals are included in JSON
// athleteSchema.set('toJSON', { virtuals: true });

// module.exports = mongoose.model('Athlete', athleteSchema);
