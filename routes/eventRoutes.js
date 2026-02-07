const express = require('express');
const router = express.Router();
const upload = require('../middleware/multer');
const eventController = require('../controllers/AddEvents');

router.post(
    '/add-event',
    upload.single('eventBanner'),
    eventController.createEvent
);

router.get('/events', eventController.getEvents);

module.exports = router;