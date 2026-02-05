const express = require('express');
const router = express.Router();
const stravaController = require('../controllers/stravaController');
const auth = require('../middleware/auth');

// =====================================================
// AUTHENTICATION ROUTES (No auth required)
// =====================================================

// GET /auth/strava/debug - Debug configuration (for troubleshooting)
router.get('/auth/strava/debug', stravaController.debugConfig);

// GET /auth/strava - Redirect to Strava authorization
router.get('/auth/strava', stravaController.redirectToStrava);

// GET /auth/strava/callback - Handle OAuth callback
router.get('/auth/strava/callback', stravaController.handleCallback);

// =====================================================
// ATHLETE DATA ROUTES (JWT Protected)
// =====================================================

// GET /athlete/:athleteId/profile - Get athlete profile (REAL DATA)
router.get('/athlete/:athleteId/profile', auth, stravaController.getAthleteProfile);

// GET /athlete/:athleteId/activities - Get all activities (REAL DATA)
router.get('/athlete/:athleteId/activities', auth, stravaController.getAthleteActivities);

// GET /athlete/:athleteId/stats - Get activity statistics (REAL DATA)
router.get('/athlete/:athleteId/stats', auth, stravaController.getAthleteStats);

// GET /athlete/:athleteId/weekly - Get weekly summary (REAL DATA)
router.get('/athlete/:athleteId/weekly', auth, stravaController.getWeeklyStats);

// GET /athlete/:athleteId/monthly - Get monthly summary (REAL DATA)
router.get('/athlete/:athleteId/monthly', auth, stravaController.getMonthlyStats);

// GET /athlete/:athleteId/history - Get activity history (REAL DATA)
router.get('/athlete/:athleteId/history', auth, stravaController.getActivityHistory);

// POST /athlete/:athleteId/sync - Sync latest data from Strava
router.post('/athlete/:athleteId/sync', auth, stravaController.syncAthleteData);

// GET /athlete/:athleteId/sync-history - Get sync history
router.get('/athlete/:athleteId/sync-history', auth, stravaController.getSyncHistory);

// DELETE /athlete/:athleteId/disconnect - Disconnect Strava
router.delete('/athlete/:athleteId/disconnect', auth, stravaController.disconnectStrava);

module.exports = router;
