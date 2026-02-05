const mongoose = require('mongoose');

const challengeSchema = new mongoose.Schema({
  // Challenge identification
  title: {
    type: String,
    required: true,
    trim: true
  },

  description: {
    type: String,
    required: true
  },

  // Challenge type
  type: {
    type: String,
    enum: ['distance', 'duration', 'activities', 'streak', 'custom'],
    required: true
  },

  // Activity types that count towards this challenge
  activityTypes: [{
    type: String,
    enum: ['Run', 'Walk', 'Ride', 'Swim', 'Hike', 'All']
  }],

  // Challenge goal
  goal: {
    value: { type: Number, required: true },
    unit: { type: String, enum: ['km', 'miles', 'minutes', 'hours', 'count', 'days'], required: true }
  },

  // Challenge period
  startDate: {
    type: Date,
    required: true
  },

  endDate: {
    type: Date,
    required: true
  },

  // Challenge status
  status: {
    type: String,
    enum: ['upcoming', 'active', 'completed', 'cancelled'],
    default: 'upcoming'
  },

  // Challenge image/banner
  imageUrl: String,

  // Rewards/Badges
  reward: {
    badge: String,
    points: { type: Number, default: 0 },
    description: String
  },

  // Participants tracking
  participants: [{
    athleteId: { type: Number, required: true },
    joinedAt: { type: Date, default: Date.now },
    progress: { type: Number, default: 0 },
    completed: { type: Boolean, default: false },
    completedAt: Date
  }],

  // Created by admin
  createdBy: {
    type: String,
    default: 'admin'
  },

  // Visibility
  isPublic: {
    type: Boolean,
    default: true
  },

  // Max participants (0 = unlimited)
  maxParticipants: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Indexes
challengeSchema.index({ status: 1, startDate: 1 });
challengeSchema.index({ endDate: 1 });
challengeSchema.index({ 'participants.athleteId': 1 });

// Virtual for participant count
challengeSchema.virtual('participantCount').get(function() {
  return this.participants ? this.participants.length : 0;
});

// Virtual to check if challenge is active
challengeSchema.virtual('isActive').get(function() {
  const now = new Date();
  return this.status === 'active' && now >= this.startDate && now <= this.endDate;
});

// Method to update challenge status based on dates
challengeSchema.methods.updateStatus = function() {
  const now = new Date();
  if (this.status === 'cancelled') return this.status;

  if (now < this.startDate) {
    this.status = 'upcoming';
  } else if (now >= this.startDate && now <= this.endDate) {
    this.status = 'active';
  } else {
    this.status = 'completed';
  }
  return this.status;
};

// Static method to get active challenges
challengeSchema.statics.getActiveChallenges = function() {
  const now = new Date();
  return this.find({
    status: { $in: ['active', 'upcoming'] },
    startDate: { $lte: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) }, // Within next 30 days
    endDate: { $gte: now },
    isPublic: true
  }).sort({ startDate: 1 });
};

challengeSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Challenge', challengeSchema);
