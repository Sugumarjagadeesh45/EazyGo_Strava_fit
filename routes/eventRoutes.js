const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const upload = require('../middleware/multer');
const eventController = require('../controllers/AddEvents');
const AddEvents = require('../models/AddEvents');

router.post(
    '/add-event',
    upload.single('eventBanner'),
    eventController.createEvent
);

router.post(
    '/add-award',
    upload.single('eventBanner'),
    eventController.createAward
);

router.get('/events', eventController.getEvents);
router.get('/awards', eventController.getAwards);

// User App Routes
router.post('/events/:id/join', eventController.joinEvent); // Ensure this line exists
router.get('/my-challenges', eventController.getMyChallenges);
router.post('/user-challenges', eventController.createUserChallenge);

// Admin Routes
router.get('/admin/challenges-status', eventController.getChallengesStatus);
router.post('/admin/events/:id/stop-joining', eventController.toggleJoinStatus);

router.delete('/events/:id', async (req, res) => {
    try {
        const id = req.params.id.trim();
        console.log(`[DELETE] Request received for ID: ${id}`);
        
        // Validate ID format
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid ID format' });
        }

        // 1. Try explicit AddEvents model first (Most reliable)
        const deletedExplicit = await AddEvents.findByIdAndDelete(id);
        if (deletedExplicit) {
            console.log(`[DELETE] Deleted using explicit AddEvents model`);
            return res.status(200).json({ success: true, message: 'Event deleted successfully' });
        }

        // 2. Try to find in other models dynamically
        const modelNames = mongoose.modelNames();
        const eventModels = modelNames.filter(name => 
            name !== 'AddEvents' && name.toLowerCase().includes('event')
        );
        
        for (const name of eventModels) {
            const Model = mongoose.model(name);
            const deleted = await Model.findByIdAndDelete(id);
            if (deleted) {
                console.log(`[DELETE] Deleted using dynamic model: ${name}`);
                return res.status(200).json({ success: true, message: 'Event deleted successfully' });
            }
        }
        
        // 3. Fallback: Direct DB Collection Access
        if (mongoose.connection.readyState === 1) {
            const db = mongoose.connection.db;
            const collections = await db.listCollections().toArray();
            
            // Filter collections that might contain events
            const targetCollections = collections
                .map(c => c.name)
                .filter(name => name.toLowerCase().includes('event'));
            
            console.log(`[DELETE] Checking collections: ${targetCollections.join(', ')}`);

            const objectId = new mongoose.Types.ObjectId(id);

            for (const colName of targetCollections) {
                const result = await db.collection(colName).deleteOne({ _id: objectId });
                if (result.deletedCount > 0) {
                    console.log(`[DELETE] Deleted from collection: ${colName}`);
                    return res.status(200).json({ success: true, message: 'Event deleted successfully' });
                }
            }
        }
        
        console.log(`[DELETE] ID ${id} not found in any event-related model or collection.`);
        res.status(404).json({ success: false, message: 'Event not found' });
    } catch (error) {
        console.error('Delete Event Error:', error);
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
});

module.exports = router;