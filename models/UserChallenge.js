const mongoose = require('mongoose');

const UserChallengeSchema = new mongoose.Schema({
    eventName: { type: String, required: true },
    bio: { type: String },
    targetKm: { type: Number, required: true },
    duration: { type: Number, required: true }, // Days
    description: { type: String },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('UserChallenge', UserChallengeSchema);