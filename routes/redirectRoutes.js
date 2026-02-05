const express = require('express');
const router = express.Router();
const redirectController = require('../controllers/redirectController');

/**
 * Mobile Deep Link Redirect Routes
 *
 * These endpoints handle platform detection and smart redirects
 * for mobile app deep linking with store fallbacks.
 */

// =============================================================================
// PUBLIC REDIRECT ENDPOINTS (No auth required)
// =============================================================================

/**
 * @route   GET /redirect/strava
 * @desc    Smart redirect for Strava OAuth flow
 * @query   athleteId - Strava athlete ID
 * @query   token - JWT authentication token
 * @query   action - Action type (connect, sync, view)
 * @query   source - Traffic source for analytics
 * @query   utm_* - Campaign tracking parameters
 * @access  Public
 *
 * Response varies by Accept header:
 * - application/json: Returns JSON with redirect URLs
 * - text/html (default): Returns HTML smart redirect page
 */
router.get('/strava', redirectController.handleStravaRedirect);

/**
 * @route   GET /redirect/app
 * @desc    Generic app redirect with custom path
 * @query   path - Deep link path (dashboard, profile, activity)
 * @query   source - Traffic source for analytics
 * @query   utm_* - Campaign tracking parameters
 * @query   * - Additional params passed to app
 * @access  Public
 */
router.get('/app', redirectController.handleAppRedirect);

/**
 * @route   GET /redirect/urls
 * @desc    Get redirect URLs without performing redirect (API only)
 * @query   type - Link type (strava, activity, profile, dashboard)
 * @query   params - JSON string of parameters
 * @access  Public
 */
router.get('/urls', redirectController.getRedirectUrls);

/**
 * @route   GET /redirect/detect
 * @desc    Detect platform and device information
 * @access  Public
 *
 * Useful for debugging and understanding how requests are classified
 */
router.get('/detect', redirectController.detectPlatform);

/**
 * @route   GET /redirect/health
 * @desc    Health check for redirect service
 * @access  Public
 */
router.get('/health', redirectController.healthCheck);

// =============================================================================
// ANALYTICS ENDPOINTS (Consider adding auth for production)
// =============================================================================

/**
 * @route   GET /redirect/stats
 * @desc    Get redirect statistics and analytics
 * @query   startDate - Filter start date (ISO string)
 * @query   endDate - Filter end date (ISO string)
 * @access  Public (consider protecting in production)
 */
router.get('/stats', redirectController.getRedirectStats);

/**
 * @route   GET /redirect/logs
 * @desc    Get recent redirect logs
 * @query   limit - Number of logs (default: 50, max: 200)
 * @query   platform - Filter by platform (android, ios, web)
 * @query   source - Filter by source (email, sms, qr_code, etc.)
 * @access  Public (consider protecting in production)
 */
router.get('/logs', redirectController.getRedirectLogs);

module.exports = router;
