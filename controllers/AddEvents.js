// controllers/AddEvents.js
const AddEvents = require('../models/AddEvents');

exports.createEvent = async (req, res) => {
    try {
        const {
            eventName,
            eventType,
            startDate,
            endDate,
            distance,
            duration
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
            eventBanner: bannerPath 
        });

        res.status(201).json({ success: true, data: event });
    } catch (err) {
        console.error("Database Error:", err); // Check your terminal for this!
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.getEvents = async (req, res) => {
    try {
        const events = await AddEvents.find().sort({ createdAt: -1 });
        res.json(events);
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};