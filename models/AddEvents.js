const mongoose = require('mongoose');

const EventSchema = new mongoose.Schema({
    eventName: { type: String, required: true },
    eventBanner: { type: String, required: true },
    eventType: { type: String, default: 'General' },
    startDate: { type: Date },
    endDate: { type: Date },
    distance: { type: Number, default: 0 },
    duration: { type: Number, default: 0 },
    description: { type: String },
    isAward: { type: Boolean, default: false },
    startTime: { type: String },
    endTime: { type: String },
    participants: [{ type: String }], // Array of athlete IDs
    isJoinable: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('AddEvents', EventSchema);
