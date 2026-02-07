const mongoose = require('mongoose');

const EventSchema = new mongoose.Schema({
    eventName: { type: String, required: true },
    eventBanner: { type: String, required: true },
    eventType: { type: String, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    distance: { type: Number, required: true },
    duration: { type: Number, required: true },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('AddEvents', EventSchema);
