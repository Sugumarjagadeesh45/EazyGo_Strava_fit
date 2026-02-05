const express = require('express');
const router = express.Router();
const appController = require('../controllers/appController');
const auth = require('../middleware/auth');

/**
 * App Routes
 * Endpoints specifically designed for the React Native mobile app
 * All endpoints require JWT authentication
 */

// ============================================================================
// PROFILE ROUTES
// ============================================================================

/**
 * @route   GET /app/profile/:athleteId
 * @desc    Get user profile with calculated lifetime stats
 * @access  Protected (JWT required)
 *
 * Response includes:
 * - Profile information (name, image, location)
 * - Total activities (from join date)
 * - Total KM (running + walking)
 * - Total hours spent
 */
router.get('/profile/:athleteId', auth, appController.getProfile);

// ============================================================================
// HOME PAGE ROUTES
// ============================================================================

/**
 * @route   GET /app/home/:athleteId
 * @desc    Get all data needed for home screen
 * @access  Protected (JWT required)
 *
 * Response includes:
 * - User name and profile
 * - Current date/calendar info
 * - Your Stats (total activities, km, hours)
 * - Recent activities (last 3 days)
 */
router.get('/home/:athleteId', auth, appController.getHomeData);

// ============================================================================
// ACTIVITY PAGE ROUTES
// ============================================================================

/**
 * @route   GET /app/activities/:athleteId
 * @desc    Get activities with month filter (default: current month)
 * @query   month - Month number (1-12)
 * @query   year - Year (YYYY)
 * @access  Protected (JWT required)
 *
 * Response includes:
 * - Filter info (selected month/year)
 * - Month summary (total activities, km, time)
 * - Available months list
 * - Activities list
 */
router.get('/activities/:athleteId', auth, appController.getActivities);

/**
 * @route   GET /app/activities/:athleteId/all
 * @desc    Get all activities from registration date (paginated)
 * @query   page - Page number (default: 1)
 * @query   limit - Items per page (default: 50)
 * @access  Protected (JWT required)
 */
router.get('/activities/:athleteId/all', auth, appController.getAllActivities);

// ============================================================================
// LEADERBOARD ROUTES
// ============================================================================

/**
 * @route   GET /app/leaderboard
 * @desc    Get leaderboard for all users
 * @query   period - Filter period: 'week' (default), 'month', 'all'
 * @access  Protected (JWT required)
 *
 * Response includes:
 * - Period info
 * - Total participants
 * - Top 3 performers (separate)
 * - Remaining users list
 */
router.get('/leaderboard', auth, appController.getLeaderboard);

/**
 * @route   GET /app/leaderboard/:athleteId/rank
 * @desc    Get specific athlete's rank in leaderboard
 * @query   period - Filter period: 'week' (default), 'month', 'all'
 * @access  Protected (JWT required)
 */
router.get('/leaderboard/:athleteId/rank', auth, appController.getAthleteRank);

// ============================================================================
// CHALLENGES ROUTES
// ============================================================================

/**
 * @route   GET /app/challenges
 * @desc    Get all active and upcoming challenges
 * @query   athleteId - Optional, to check join status
 * @access  Protected (JWT required)
 *
 * If no challenges exist, returns professional empty response
 */
router.get('/challenges', auth, appController.getChallenges);

/**
 * @route   POST /app/challenges/:challengeId/join
 * @desc    Join a challenge
 * @body    athleteId - Athlete ID
 * @access  Protected (JWT required)
 */
router.post('/challenges/:challengeId/join', auth, appController.joinChallenge);

/**
 * @route   GET /app/challenges/:athleteId/my
 * @desc    Get challenges joined by the athlete
 * @access  Protected (JWT required)
 */
router.get('/challenges/:athleteId/my', auth, appController.getMyChallenges);

module.exports = router;
