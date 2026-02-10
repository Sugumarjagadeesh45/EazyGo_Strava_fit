// controllers/AddEvents.js
const AddEvents = require('../models/AddEvents');
const UserChallenge = require('../models/UserChallenge');

exports.createEvent = async (req, res) => {
    try {
        const {
            eventName,
            eventType,
            startDate,
            endDate,
            distance,
            duration,
            description
        } = req.body;

        // Ensure we capture the file path correctly
        let bannerPath = "";
        if (req.file) {
            // Converts 'uploads/events/file.jpg' to 'http://localhost:5001/uploads/events/file.jpg'
            bannerPath = `${req.protocol}://${req.get('host')}/${req.file.path.replace(/\\/g, '/')}`;
        } else {
            return res.status(400).json({ success: false, message: 'Event banner image is required' });
        }

        const event = await AddEvents.create({
            eventName,
            eventType,
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            distance: Number(distance), // Ensure these are numbers for Mongoose
            duration: Number(duration),
            eventBanner: bannerPath,
            description,
            isAward: false
        });

        res.status(201).json({ success: true, data: event });
    } catch (err) {
        console.error("Database Error:", err); // Check your terminal for this!
        res.status(500).json({ success: false, message: err.message });
    }
};

// Create User Challenge
exports.createUserChallenge = async (req, res) => {
    try {
        const { eventName, bio, targetKm, duration, description } = req.body;
        
        const challenge = await UserChallenge.create({
            eventName,
            bio,
            targetKm,
            duration,
            description
        });
        
        res.status(201).json({ success: true, id: challenge._id, message: "User challenge created" });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.createAward = async (req, res) => {
    try {
        const { eventName, eventDate, startTime, endTime, description } = req.body;

        let bannerPath = "";
        if (req.file) {
            bannerPath = `${req.protocol}://${req.get('host')}/${req.file.path.replace(/\\/g, '/')}`;
        } else {
            return res.status(400).json({ success: false, message: 'Award banner image is required' });
        }

        const event = await AddEvents.create({
            eventName,
            eventType: 'Award',
            startDate: new Date(eventDate),
            endDate: new Date(eventDate),
            distance: 0,
            duration: 0,
            eventBanner: bannerPath,
            description,
            startTime,
            endTime,
            isAward: true
        });

        res.status(201).json({ success: true, data: event });
    } catch (err) {
        console.error("Database Error:", err); // Check your terminal for this!
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.getEvents = async (req, res) => {
    try {
        // Filter out awards so they don't appear in the main events list (Discover page)
        const events = await AddEvents.find({ isAward: { $ne: true } }).sort({ createdAt: -1 });
        res.json(events);
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.getAwards = async (req, res) => {
    try {
        const awards = await AddEvents.find({ isAward: true }).sort({ createdAt: -1 });
        
        // Add alias 'eventDate' for frontend convenience (maps to startDate)
        const awardsWithAlias = awards.map(award => {
            const awardObj = award.toObject();
            awardObj.eventDate = awardObj.startDate; 
            return awardObj;
        });
        
        res.json(awardsWithAlias);
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// Join an event
exports.joinEvent = async (req, res) => {
    try {
        const { id } = req.params;
        const { athleteId } = req.body;
        
        // Normalize athleteId to string to ensure consistency with DB storage
        const athleteIdStr = String(athleteId);

        if (!athleteId) {
            return res.status(400).json({ success: false, message: 'Athlete ID is required' });
        }

        const event = await AddEvents.findById(id);
        if (!event) {
            return res.status(404).json({ success: false, message: 'Event not found' });
        }

        if (event.isJoinable === false) {
            return res.status(400).json({ success: false, message: 'Joining is closed for this event' });
        }

        // Initialize participants array if it doesn't exist
        if (!event.participants) {
            event.participants = [];
        }

        // Check if already joined
        if (event.participants.includes(athleteIdStr)) {
            return res.status(400).json({ success: false, message: 'Already joined' });
        }

        event.participants.push(athleteIdStr);
        await event.save();

        res.json({ success: true, message: 'Joined successfully', data: event });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// Get events joined by a specific user
exports.getMyChallenges = async (req, res) => {
    try {
        const { athleteId } = req.query;
        if (!athleteId) {
            return res.status(400).json({ success: false, message: 'Athlete ID is required' });
        }
        
        const athleteIdStr = String(athleteId);

        const events = await AddEvents.find({ participants: athleteIdStr }).sort({ startDate: -1 });
        res.json({ success: true, data: events });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// Admin: Get status of challenges (participants count)
exports.getChallengesStatus = async (req, res) => {
    try {
        const events = await AddEvents.find().sort({ createdAt: -1 });
        
        const statusData = events.map(event => ({
            _id: event._id,
            eventName: event.eventName,
            startDate: event.startDate,
            startTime: event.startTime,
            joinersCount: event.participants ? event.participants.length : 0,
            groupsCount: 0, 
            isJoinable: event.isJoinable !== false // Default to true if undefined
        }));

        res.json(statusData);
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// Admin: Toggle joining status
exports.toggleJoinStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const event = await AddEvents.findById(id);
        
        if (!event) {
            return res.status(404).json({ success: false, message: 'Event not found' });
        }

        // Toggle status (default to true if undefined)
        const currentStatus = event.isJoinable !== false;
        event.isJoinable = !currentStatus;
        
        await event.save();

        res.json({ success: true, message: `Joining ${event.isJoinable ? 'enabled' : 'disabled'}`, isJoinable: event.isJoinable });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};