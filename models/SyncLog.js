const mongoose = require('mongoose');

const syncLogSchema = new mongoose.Schema({
  athleteId: {
    type: Number,
    required: true,
    index: true
  },
  syncType: {
    type: String,
    enum: ['full', 'incremental', 'profile', 'activities', 'stats'],
    required: true
  },
  status: {
    type: String,
    enum: ['started', 'completed', 'failed'],
    default: 'started'
  },
  activitiesSynced: { type: Number, default: 0 },
  newActivities: { type: Number, default: 0 },
  updatedActivities: { type: Number, default: 0 },
  errorMessage: String,
  startedAt: {
    type: Date,
    default: Date.now
  },
  completedAt: Date,
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
});

syncLogSchema.index({ athleteId: 1, startedAt: -1 });

module.exports = mongoose.model('SyncLog', syncLogSchema);
