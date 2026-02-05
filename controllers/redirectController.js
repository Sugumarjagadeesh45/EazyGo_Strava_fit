const redirectService = require('../services/redirectService');
const { PLATFORMS, REDIRECT_TARGETS } = require('../services/redirectService');
const RedirectLog = require('../models/RedirectLog');
const redirectConfig = require('../config/redirect');

/**
 * Handle Strava deep link redirect
 * GET /redirect/strava
 *
 * Query params:
 * - athleteId: Strava athlete ID
 * - token: JWT token
 * - action: Action type (connect, sync, view)
 * - source: Traffic source (email, sms, qr_code, social, direct)
 * - utm_*: Campaign tracking parameters
 */
exports.handleStravaRedirect = async (req, res) => {
  const startTime = Date.now();

  try {
    // Extract parameters from query string
    const {
      athleteId,
      token,
      action = 'connect',
      source = 'direct',
      ...otherParams
    } = req.query;

    // Build deep link parameters
    const deepLinkParams = {
      athleteId,
      token,
      action,
      source,
      timestamp: Date.now()
    };

    // Generate redirect data
    const redirectData = redirectService.generateRedirectData(req, 'strava', deepLinkParams);

    // Log the redirect request
    if (redirectConfig.enableLogging) {
      await logRedirectRequest(redirectData, {
        source,
        success: true,
        processingTime: Date.now() - startTime
      });
    }

    // Check Accept header to determine response type
    const acceptHeader = req.headers.accept || '';

    if (acceptHeader.includes('application/json')) {
      // Return JSON response for API consumers
      return res.status(200).json(redirectService.generateJsonResponse(redirectData));
    }

    // Return HTML redirect page for browsers
    res.status(200).send(redirectService.generateRedirectHtml(redirectData, {
      title: 'Connect with Strava - iFit Club',
      message: 'Connecting to Strava...'
    }));

  } catch (error) {
    console.error('Strava redirect error:', error);

    // Log failed redirect
    if (redirectConfig.enableLogging) {
      try {
        await logRedirectRequest({
          requestId: redirectService.generateRequestId(),
          platform: PLATFORMS.UNKNOWN,
          deviceInfo: redirectService.parseDeviceInfo(req.headers['user-agent']),
          ipAddress: redirectService.getClientIp(req),
          redirectTarget: REDIRECT_TARGETS.WEB_FALLBACK
        }, {
          source: req.query.source || 'direct',
          success: false,
          errorMessage: error.message,
          processingTime: Date.now() - startTime
        });
      } catch (logError) {
        console.error('Failed to log redirect error:', logError);
      }
    }

    res.status(500).json({
      success: false,
      message: 'Redirect failed',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * Handle generic app redirect
 * GET /redirect/app
 *
 * Query params:
 * - path: Deep link path (e.g., 'dashboard', 'profile', 'activity')
 * - source: Traffic source
 * - utm_*: Campaign tracking parameters
 * - any additional params to pass to the app
 */
exports.handleAppRedirect = async (req, res) => {
  const startTime = Date.now();

  try {
    const { path = 'dashboard', source = 'direct', ...params } = req.query;

    // Build deep link parameters
    const deepLinkParams = {
      ...params,
      source,
      timestamp: Date.now()
    };

    // Generate redirect data using the specified path
    const redirectData = redirectService.generateRedirectData(req, path, deepLinkParams);

    // Log the redirect request
    if (redirectConfig.enableLogging) {
      await logRedirectRequest(redirectData, {
        source,
        success: true,
        processingTime: Date.now() - startTime
      });
    }

    // Check Accept header
    const acceptHeader = req.headers.accept || '';

    if (acceptHeader.includes('application/json')) {
      return res.status(200).json(redirectService.generateJsonResponse(redirectData));
    }

    res.status(200).send(redirectService.generateRedirectHtml(redirectData, {
      title: 'Open iFit Club',
      message: 'Opening iFit Club...'
    }));

  } catch (error) {
    console.error('App redirect error:', error);

    res.status(500).json({
      success: false,
      message: 'Redirect failed',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * Get redirect URLs without performing redirect (API only)
 * GET /redirect/urls
 *
 * Query params:
 * - type: Link type (strava, activity, profile, dashboard)
 * - params: JSON string of parameters to include in deep link
 */
exports.getRedirectUrls = async (req, res) => {
  try {
    const { type = 'strava' } = req.query;
    let params = {};

    // Parse params if provided as JSON string
    if (req.query.params) {
      try {
        params = JSON.parse(req.query.params);
      } catch {
        return res.status(400).json({
          success: false,
          message: 'Invalid params JSON'
        });
      }
    }

    // Generate redirect data
    const redirectData = redirectService.generateRedirectData(req, type, params);

    res.status(200).json(redirectService.generateJsonResponse(redirectData));

  } catch (error) {
    console.error('Get redirect URLs error:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to generate redirect URLs',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * Get redirect statistics
 * GET /redirect/stats
 *
 * Query params:
 * - startDate: Start date for filtering (ISO string)
 * - endDate: End date for filtering (ISO string)
 */
exports.getRedirectStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const stats = await RedirectLog.getStats(startDate, endDate);

    res.status(200).json({
      success: true,
      data: {
        period: {
          start: startDate || 'all time',
          end: endDate || 'now'
        },
        ...stats
      }
    });

  } catch (error) {
    console.error('Get redirect stats error:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to retrieve redirect statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * Get recent redirect logs
 * GET /redirect/logs
 *
 * Query params:
 * - limit: Number of logs to return (default: 50, max: 200)
 * - platform: Filter by platform
 * - source: Filter by source
 */
exports.getRedirectLogs = async (req, res) => {
  try {
    const { limit = 50, platform, source } = req.query;

    // Build query
    const query = {};
    if (platform) query.platform = platform;
    if (source) query.source = source;

    const logs = await RedirectLog.find(query)
      .sort({ createdAt: -1 })
      .limit(Math.min(parseInt(limit), 200))
      .select('-__v');

    res.status(200).json({
      success: true,
      count: logs.length,
      data: logs
    });

  } catch (error) {
    console.error('Get redirect logs error:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to retrieve redirect logs',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * Detect platform (utility endpoint)
 * GET /redirect/detect
 *
 * Returns detected platform and device information
 */
exports.detectPlatform = (req, res) => {
  const userAgent = req.headers['user-agent'] || '';
  const platform = redirectService.detectPlatform(userAgent);
  const deviceInfo = redirectService.parseDeviceInfo(userAgent);
  const ipAddress = redirectService.getClientIp(req);

  res.status(200).json({
    success: true,
    data: {
      platform,
      deviceInfo,
      ipAddress,
      userAgent,
      headers: {
        accept: req.headers.accept,
        acceptLanguage: req.headers['accept-language'],
        referer: req.headers.referer
      }
    }
  });
};

/**
 * Health check for redirect service
 * GET /redirect/health
 */
exports.healthCheck = (req, res) => {
  res.status(200).json({
    success: true,
    service: 'redirect',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    config: {
      appScheme: redirectConfig.appScheme,
      loggingEnabled: redirectConfig.enableLogging,
      supportedPlatforms: Object.values(PLATFORMS),
      supportedTargets: Object.values(REDIRECT_TARGETS)
    }
  });
};

/**
 * Helper function to log redirect requests
 */
async function logRedirectRequest(redirectData, options = {}) {
  try {
    const log = new RedirectLog({
      requestId: redirectData.requestId,
      platform: redirectData.platform,
      deviceInfo: redirectData.deviceInfo,
      ipAddress: redirectData.ipAddress,
      redirectTarget: redirectData.redirectTarget,
      deepLinkUrl: redirectData.deepLinkUrl,
      fallbackUrl: redirectData.fallbackUrl,
      finalRedirectUrl: redirectData.finalRedirectUrl,
      queryParams: redirectData.queryParams,
      source: options.source || 'direct',
      campaign: redirectData.campaign,
      referrer: redirectData.referrer,
      success: options.success !== false,
      errorMessage: options.errorMessage,
      processingTime: options.processingTime || redirectData.processingTime
    });

    await log.save();
    return log;
  } catch (error) {
    console.error('Failed to log redirect:', error);
    throw error;
  }
}
