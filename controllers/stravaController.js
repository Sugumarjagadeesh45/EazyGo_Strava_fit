const stravaService = require('../services/stravaService');
const { StravaError, ERROR_CODES } = require('../services/stravaService');
const Athlete = require('../models/Athlete');
const OAuthToken = require('../models/OAuthToken');
const Activity = require('../models/Activity');
const ActivityStats = require('../models/ActivityStats');
const SyncLog = require('../models/SyncLog');
const { generateToken } = require('../utils/jwtUtils');

// Helper: Generate HTML for deep link redirection (Fix for Android Chrome)
const getRedirectHtml = (deepLink, params = {}) => {
  // Create Android intent:// URL for better Android support
  const androidIntent = `intent://auth-success?athleteId=${params.athleteId || ''}&token=${params.token || ''}&firstName=${encodeURIComponent(params.firstName || '')}&lastName=${encodeURIComponent(params.lastName || '')}&profile=${encodeURIComponent(params.profile || '')}#Intent;scheme=ifitclub;package=com.ifitclub.erode;end`;

  return `
<!DOCTYPE html>
<html>
<head>
  <title>Authorization Successful - iFit Club</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="refresh" content="1;url=${deepLink}">
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      padding: 20px;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      color: white;
    }
    .container {
      text-align: center;
      max-width: 400px;
    }
    .success-icon {
      width: 80px;
      height: 80px;
      background: #4CAF50;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 24px;
      animation: scaleIn 0.5s ease;
    }
    .success-icon svg { width: 40px; height: 40px; }
    @keyframes scaleIn { 0% { transform: scale(0); } 100% { transform: scale(1); } }
    h1 { font-size: 24px; margin: 0 0 8px; color: #4CAF50; }
    .subtitle { color: #aaa; margin-bottom: 32px; }
    .btn {
      display: block;
      width: 100%;
      padding: 16px 24px;
      background: #fc4c02;
      color: white;
      text-decoration: none;
      border-radius: 12px;
      font-weight: 600;
      font-size: 18px;
      margin-bottom: 12px;
      transition: transform 0.2s, background 0.2s;
    }
    .btn:hover { background: #e04400; transform: scale(1.02); }
    .btn:active { transform: scale(0.98); }
    .btn-secondary {
      background: transparent;
      border: 2px solid #fc4c02;
    }
    .loader {
      border: 3px solid rgba(255,255,255,0.1);
      border-top: 3px solid #fc4c02;
      border-radius: 50%;
      width: 24px;
      height: 24px;
      animation: spin 1s linear infinite;
      display: inline-block;
      margin-right: 8px;
      vertical-align: middle;
    }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    .status {
      color: #888;
      font-size: 14px;
      margin-top: 24px;
      padding: 12px;
      background: rgba(255,255,255,0.05);
      border-radius: 8px;
    }
    .retry-count { color: #fc4c02; font-weight: bold; }
    .help-text {
      margin-top: 32px;
      padding: 16px;
      background: rgba(255,255,255,0.05);
      border-radius: 8px;
      font-size: 13px;
      color: #888;
    }
    .help-text strong { color: #fff; }
  </style>
</head>
<body>
  <div class="container">
    <div class="success-icon">
      <svg viewBox="0 0 24 24" fill="white">
        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
      </svg>
    </div>
    <h1>Authorization Successful!</h1>
    <p class="subtitle">Your Strava account is now connected</p>

    <a href="${deepLink}" class="btn" id="openAppBtn">
      <span class="loader" id="loader"></span>
      <span id="btnText">Opening iFit Club...</span>
    </a>

    <a href="${androidIntent}" class="btn btn-secondary" id="androidBtn" style="display:none;">
      Open App (Android)
    </a>

    <div class="status" id="status">
      Attempting to open app... <span class="retry-count" id="retryCount">1</span>/3
    </div>

    <div class="help-text" id="helpText" style="display:none;">
      <strong>App not opening?</strong><br><br>
      1. Make sure iFit Club app is installed<br>
      2. Tap the orange button above<br>
      3. If using Android, try the "Open App (Android)" button
    </div>
  </div>

  <script>
    const deepLink = "${deepLink}";
    const androidIntent = "${androidIntent}";
    let retryCount = 0;
    const maxRetries = 3;

    // Detect platform
    const isAndroid = /android/i.test(navigator.userAgent);
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);

    // Show Android button on Android devices
    if (isAndroid) {
      document.getElementById('androidBtn').style.display = 'block';
    }

    function updateStatus(message, count) {
      document.getElementById('status').innerHTML = message +
        (count ? ' <span class="retry-count">' + count + '</span>/' + maxRetries : '');
    }

    function showHelp() {
      document.getElementById('helpText').style.display = 'block';
      document.getElementById('loader').style.display = 'none';
      document.getElementById('btnText').textContent = 'Tap to Open iFit Club';
      updateStatus('Tap the button above to open the app', null);
    }

    function tryOpenApp() {
      retryCount++;
      updateStatus('Attempting to open app...', retryCount);

      // Try multiple methods
      if (isAndroid) {
        // Android: Try intent first, then custom scheme
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = deepLink;
        document.body.appendChild(iframe);

        setTimeout(() => {
          window.location.href = deepLink;
        }, 100);
      } else {
        // iOS and others: Use location.href
        window.location.href = deepLink;
      }

      // Check if we're still on this page after timeout
      setTimeout(() => {
        if (retryCount < maxRetries) {
          tryOpenApp();
        } else {
          showHelp();
        }
      }, 2000);
    }

    // Start trying to open the app after a short delay
    setTimeout(tryOpenApp, 500);

    // Also track if page visibility changes (app opened successfully)
    document.addEventListener('visibilitychange', function() {
      if (document.hidden) {
        // App likely opened, clear retry logic
        retryCount = maxRetries;
      }
    });
  </script>
</body>
</html>
`;
};

// Helper: Generate error redirect HTML
const getErrorRedirectHtml = (errorMessage) => {
  const deepLink = `ifitclub://auth-error?message=${encodeURIComponent(errorMessage)}`;
  const androidIntent = `intent://auth-error?message=${encodeURIComponent(errorMessage)}#Intent;scheme=ifitclub;package=com.ifitclub.erode;end`;

  return `
<!DOCTYPE html>
<html>
<head>
  <title>Authorization Failed - iFit Club</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="refresh" content="2;url=${deepLink}">
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      padding: 20px;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      color: white;
    }
    .container { text-align: center; max-width: 400px; }
    .error-icon {
      width: 80px;
      height: 80px;
      background: #f44336;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 24px;
    }
    .error-icon svg { width: 40px; height: 40px; }
    h1 { font-size: 24px; margin: 0 0 8px; color: #f44336; }
    .error-msg {
      background: rgba(244, 67, 54, 0.1);
      border: 1px solid rgba(244, 67, 54, 0.3);
      padding: 16px;
      border-radius: 8px;
      color: #ffcdd2;
      margin-bottom: 24px;
      word-break: break-word;
    }
    .btn {
      display: block;
      width: 100%;
      padding: 16px 24px;
      background: #fc4c02;
      color: white;
      text-decoration: none;
      border-radius: 12px;
      font-weight: 600;
      font-size: 18px;
      margin-bottom: 12px;
    }
    .btn-retry { background: #4CAF50; }
  </style>
</head>
<body>
  <div class="container">
    <div class="error-icon">
      <svg viewBox="0 0 24 24" fill="white">
        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
      </svg>
    </div>
    <h1>Authorization Failed</h1>
    <div class="error-msg">${errorMessage}</div>
    <a href="${deepLink}" class="btn">Return to App</a>
    <a href="/api/auth/strava" class="btn btn-retry">Try Again</a>
  </div>
  <script>
    const isAndroid = /android/i.test(navigator.userAgent);
    setTimeout(() => {
      window.location.href = isAndroid ? "${androidIntent}" : "${deepLink}";
    }, 1000);
  </script>
</body>
</html>
`;
};

// Debug: Show Strava config (for troubleshooting)
exports.debugConfig = (req, res) => {
  const config = stravaService.getConfig();
  const authUrl = stravaService.getAuthorizationUrl();

  res.json({
    success: true,
    message: 'Strava OAuth Configuration',
    environment: process.env.NODE_ENV || 'development',
    config: {
      clientId: config.clientId,
      redirectUri: config.redirectUri,
      frontendUrl: config.frontendUrl,
      ngrokUrl: process.env.NGROK_URL || 'not set',
      authorizationUrl: authUrl
    },
    instructions: {
      step1: 'Visit authorizationUrl to start OAuth',
      step2: 'Authorize on Strava',
      step3: 'Strava redirects to callback with code',
      step4: 'Backend exchanges code for token',
      step5: 'Backend redirects to mobile app via deep link'
    },
    troubleshooting: {
      'invalid_redirect_uri': 'Make sure your Strava app callback domain matches your ngrok domain (without https://)',
      'code_expired': 'Authorization codes expire quickly - complete the flow promptly',
      'app_not_opening': 'Check that your mobile app has the ifitclub:// scheme registered'
    }
  });
};

// Redirect to Strava OAuth
exports.redirectToStrava = (req, res) => {
  const authUrl = stravaService.getAuthorizationUrl();
  console.log('🔗 Redirecting to Strava:', authUrl);
  res.redirect(authUrl);
};

// Handle Strava OAuth callback - FAST redirect, background sync
exports.handleCallback = async (req, res) => {
  try {
    const { code, error } = req.query;

    if (error) {
      console.error('Strava auth error:', error);
      return res.send(getErrorRedirectHtml('Strava authorization denied: ' + error));
    }

    if (!code) {
      return res.send(getErrorRedirectHtml('Authorization code not provided'));
    }

    console.log('🔄 Exchanging code for tokens...');

    // Exchange code for tokens
    const tokenData = await stravaService.exchangeCodeForTokens(code);
    const { accessToken, refreshToken, expiresAt, athlete } = tokenData;

    console.log('✅ Token received for athlete:', athlete.id);

    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║               👤 ATHLETE PROFILE DATA                      ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log(JSON.stringify(athlete, null, 2));
    console.log('--------------------------------------------------------------\n');

    // Save or update athlete (FAST - just profile data from token response)
    await Athlete.findOneAndUpdate(
      { stravaId: athlete.id },
      {
        stravaId: athlete.id,
        username: athlete.username,
        firstName: athlete.firstname,
        lastName: athlete.lastname,
        profileMedium: athlete.profile_medium,
        profile: athlete.profile,
        city: athlete.city,
        state: athlete.state,
        country: athlete.country,
        gender: athlete.sex,
        weight: athlete.weight,
        followerCount: athlete.follower_count,
        friendCount: athlete.friend_count,
        premium: athlete.premium,
        summit: athlete.summit,
        stravaCreatedAt: athlete.created_at ? new Date(athlete.created_at) : null,
        stravaUpdatedAt: athlete.updated_at ? new Date(athlete.updated_at) : null
      },
      { upsert: true, new: true }
    );

    console.log('✅ Athlete saved');

    // Save or update OAuth token (FAST)
    await OAuthToken.findOneAndUpdate(
      { athleteId: athlete.id },
      {
        athleteId: athlete.id,
        accessToken,
        refreshToken,
        expiresAt
      },
      { upsert: true, new: true }
    );

    console.log('✅ OAuth tokens saved');

    // Generate JWT token for the athlete
    const jwtToken = generateToken(athlete.id);

    console.log('✅ JWT generated');
    console.log('🔗 Redirecting to mobile app IMMEDIATELY...');

    // REDIRECT IMMEDIATELY - Don't wait for activities sync!
    const params = {
      athleteId: athlete.id,
      token: jwtToken,
      firstName: athlete.firstname || '',
      lastName: athlete.lastname || '',
      profile: athlete.profile || ''
    };
    const deepLinkUrl = `ifitclub://auth-success?athleteId=${params.athleteId}&token=${params.token}&firstName=${encodeURIComponent(params.firstName)}&lastName=${encodeURIComponent(params.lastName)}&profile=${encodeURIComponent(params.profile)}`;

    // Send redirect response FIRST
    res.send(getRedirectHtml(deepLinkUrl, params));

    // THEN sync activities in background (non-blocking)
    console.log('🔄 Starting background sync for activities and stats...');
    syncActivitiesInBackground(athlete.id, accessToken).catch(err => {
      console.error('❌ Background sync error:', err.message);
    });

  } catch (error) {
    console.error('❌ Strava callback error:', error);

    // Provide user-friendly error messages based on error type
    let errorMessage = 'Authentication failed. Please try again.';

    if (error instanceof StravaError) {
      switch (error.code) {
        case ERROR_CODES.CODE_EXPIRED:
          errorMessage = 'Authorization expired. Please try connecting again.';
          break;
        case ERROR_CODES.INVALID_CODE:
          errorMessage = 'Invalid authorization. Please try connecting again.';
          break;
        case ERROR_CODES.INVALID_REDIRECT_URI:
          errorMessage = 'Configuration error. Please contact support.';
          break;
        case ERROR_CODES.RATE_LIMITED:
          errorMessage = 'Too many requests. Please wait a moment and try again.';
          break;
        default:
          errorMessage = error.message;
      }
    } else if (error.message) {
      errorMessage = error.message;
    }

    res.send(getErrorRedirectHtml(errorMessage));
  }
};

// Background sync function (runs after redirect)
async function syncActivitiesInBackground(athleteId, accessToken) {
  const syncLog = new SyncLog({
    athleteId: athleteId,
    syncType: 'full',
    status: 'started'
  });
  await syncLog.save();

  try {
    console.log('📊 Fetching stats for athlete:', athleteId);

    // Fetch and save athlete stats
    const statsData = await stravaService.getAthleteStats(accessToken, athleteId);
    
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║                 📊 ATHLETE STATS DATA                      ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log(JSON.stringify(statsData, null, 2));
    console.log('--------------------------------------------------------------\n');

    await saveAthleteStats(athleteId, statsData);
    console.log('✅ Stats saved');

    // Fetch and save all activities
    console.log('📥 Fetching activities (this may take a while)...');
    const activitiesResult = await fetchAndSaveAllActivities(athleteId, accessToken);

    // Update sync log
    syncLog.status = 'completed';
    syncLog.activitiesSynced = activitiesResult.total;
    syncLog.newActivities = activitiesResult.new;
    syncLog.updatedActivities = activitiesResult.updated;
    syncLog.completedAt = new Date();
    await syncLog.save();

    console.log('✅ Background sync complete!');
    console.log('📊 Total activities synced:', activitiesResult.total);
    console.log('🆕 New:', activitiesResult.new);
    console.log('🔄 Updated:', activitiesResult.updated);

  } catch (syncError) {
    console.error('❌ Background sync failed:', syncError.message);
    syncLog.status = 'failed';
    syncLog.errorMessage = syncError.message;
    syncLog.completedAt = new Date();
    await syncLog.save();
  }
}

// Get athlete profile
exports.getAthleteProfile = async (req, res) => {
  try {
    const { athleteId } = req.params;
    const numericAthleteId = parseInt(athleteId);

    console.log(`🔍 [Profile] Fetching profile for ID: ${athleteId} (Numeric: ${numericAthleteId})`);

    // 1. Fetch athlete profile
    const athlete = await Athlete.findOne({ stravaId: numericAthleteId }).lean();

    if (!athlete) {
      console.log(`❌ [Profile] Athlete not found: ${numericAthleteId}`);
      return res.status(404).json({
        success: false,
        message: 'Athlete not found'
      });
    }
    
    // 2. Aggregate stats from Activities
    console.log(`📊 [Profile] Aggregating stats for athlete: ${numericAthleteId}`);
    const stats = await Activity.aggregate([
      { $match: { athleteId: numericAthleteId } },
      {
        $group: {
          _id: null, // Group all matched activities
          totalActivities: { $sum: 1 },
          totalDistance: { $sum: '$distance' }, // in meters
          totalMovingTime: { $sum: '$movingTime' } // in seconds
        }
      }
    ]);

    console.log(`📉 [Profile] Raw Aggregation Result:`, JSON.stringify(stats, null, 2));

    // 3. Format and combine data
    const dynamicStats = {
      totalActivities: stats[0]?.totalActivities || 0,
      totalDistanceKM: Math.round(((stats[0]?.totalDistance || 0) / 1000) * 10) / 10,
      totalHours: Math.round(((stats[0]?.totalMovingTime || 0) / 3600) * 10) / 10,
    };
    
    console.log(`✅ [Profile] Calculated Dynamic Stats:`, JSON.stringify(dynamicStats, null, 2));

    res.status(200).json({
      success: true,
      data: { ...athlete, dynamicStats }
    });

  } catch (error) {
    console.error('Get athlete profile error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get athlete activities
exports.getAthleteActivities = async (req, res) => {
  try {
    const { athleteId } = req.params;
    const { page = 1, limit = 50, type, startDate, endDate } = req.query;

    const query = { athleteId: parseInt(athleteId) };

    if (type) {
      query.type = type;
    }

    if (startDate || endDate) {
      query.startDate = {};
      if (startDate) query.startDate.$gte = new Date(startDate);
      if (endDate) query.startDate.$lte = new Date(endDate);
    }

    const activities = await Activity.find(query)
      .sort({ startDate: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Activity.countDocuments(query);

    res.status(200).json({
      success: true,
      data: activities,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get athlete activities error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get athlete stats
exports.getAthleteStats = async (req, res) => {
  try {
    const { athleteId } = req.params;

    const stats = await ActivityStats.findOne({ athleteId: parseInt(athleteId) });

    if (!stats) {
      return res.status(404).json({
        success: false,
        message: 'Stats not found'
      });
    }

    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Get athlete stats error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Sync athlete data (refresh)
exports.syncAthleteData = async (req, res) => {
  try {
    const { athleteId } = req.params;

    // Get valid access token
    const accessToken = await getValidAccessToken(parseInt(athleteId));

    // Create sync log
    const syncLog = new SyncLog({
      athleteId: parseInt(athleteId),
      syncType: 'incremental',
      status: 'started'
    });
    await syncLog.save();

    try {
      // Refresh athlete profile
      const athleteData = await stravaService.getAthlete(accessToken);
      await Athlete.findOneAndUpdate(
        { stravaId: parseInt(athleteId) },
        {
          username: athleteData.username,
          firstName: athleteData.firstname,
          lastName: athleteData.lastname,
          profileMedium: athleteData.profile_medium,
          profile: athleteData.profile,
          city: athleteData.city,
          state: athleteData.state,
          country: athleteData.country,
          gender: athleteData.sex,
          weight: athleteData.weight,
          followerCount: athleteData.follower_count,
          friendCount: athleteData.friend_count,
          premium: athleteData.premium,
          summit: athleteData.summit
        }
      );

      // Refresh stats
      const statsData = await stravaService.getAthleteStats(accessToken, athleteId);
      await saveAthleteStats(parseInt(athleteId), statsData);

      // Fetch new activities
      const activitiesResult = await fetchAndSaveAllActivities(parseInt(athleteId), accessToken);

      // Update sync log
      syncLog.status = 'completed';
      syncLog.activitiesSynced = activitiesResult.total;
      syncLog.newActivities = activitiesResult.new;
      syncLog.updatedActivities = activitiesResult.updated;
      syncLog.completedAt = new Date();
      await syncLog.save();

      res.status(200).json({
        success: true,
        message: 'Data synced successfully',
        data: {
          newActivities: activitiesResult.new,
          updatedActivities: activitiesResult.updated,
          totalActivities: activitiesResult.total
        }
      });
    } catch (syncError) {
      syncLog.status = 'failed';
      syncLog.errorMessage = syncError.message;
      syncLog.completedAt = new Date();
      await syncLog.save();
      throw syncError;
    }

  } catch (error) {
    console.error('Sync athlete data error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get sync history
exports.getSyncHistory = async (req, res) => {
  try {
    const { athleteId } = req.params;
    const { limit = 10 } = req.query;

    const syncLogs = await SyncLog.find({ athleteId: parseInt(athleteId) })
      .sort({ startedAt: -1 })
      .limit(parseInt(limit));

    res.status(200).json({
      success: true,
      data: syncLogs
    });
  } catch (error) {
    console.error('Get sync history error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// =====================================================
// WEEKLY STATS - Calculate from REAL activities
// =====================================================
exports.getWeeklyStats = async (req, res) => {
  try {
    const { athleteId } = req.params;
    const { weeks = 4 } = req.query; // Default last 4 weeks

    // Calculate date range
    const now = new Date();
    const startOfCurrentWeek = new Date(now);
    startOfCurrentWeek.setDate(now.getDate() - now.getDay()); // Start of current week (Sunday)
    startOfCurrentWeek.setHours(0, 0, 0, 0);

    const startDate = new Date(startOfCurrentWeek);
    startDate.setDate(startDate.getDate() - (weeks * 7));

    // Fetch REAL activities from database (synced from Strava)
    const activities = await Activity.find({
      athleteId: parseInt(athleteId),
      startDate: { $gte: startDate }
    }).sort({ startDate: -1 });

    // Group by week
    const weeklyData = [];
    for (let i = 0; i < weeks; i++) {
      const weekStart = new Date(startOfCurrentWeek);
      weekStart.setDate(weekStart.getDate() - (i * 7));
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);

      const weekActivities = activities.filter(a => {
        const actDate = new Date(a.startDate);
        return actDate >= weekStart && actDate < weekEnd;
      });

      // Calculate stats from REAL data
      const stats = calculateActivityStats(weekActivities);
      weeklyData.push({
        weekStart: weekStart.toISOString().split('T')[0],
        weekEnd: weekEnd.toISOString().split('T')[0],
        weekNumber: getWeekNumber(weekStart),
        ...stats,
        activities: weekActivities.map(formatActivitySummary)
      });
    }

    res.status(200).json({
      success: true,
      message: 'Real Strava weekly data',
      athleteId: parseInt(athleteId),
      weeksRequested: parseInt(weeks),
      data: weeklyData
    });
  } catch (error) {
    console.error('Get weekly stats error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// =====================================================
// MONTHLY STATS - Calculate from REAL activities
// =====================================================
exports.getMonthlyStats = async (req, res) => {
  try {
    const { athleteId } = req.params;
    const { months = 6 } = req.query; // Default last 6 months

    // Calculate date range
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);

    // Fetch REAL activities from database
    const activities = await Activity.find({
      athleteId: parseInt(athleteId),
      startDate: { $gte: startDate }
    }).sort({ startDate: -1 });

    // Group by month
    const monthlyData = [];
    for (let i = 0; i < months; i++) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);

      const monthActivities = activities.filter(a => {
        const actDate = new Date(a.startDate);
        return actDate >= monthStart && actDate <= monthEnd;
      });

      // Calculate stats from REAL data
      const stats = calculateActivityStats(monthActivities);
      monthlyData.push({
        month: monthStart.toLocaleString('default', { month: 'long' }),
        year: monthStart.getFullYear(),
        monthStart: monthStart.toISOString().split('T')[0],
        monthEnd: monthEnd.toISOString().split('T')[0],
        ...stats
      });
    }

    res.status(200).json({
      success: true,
      message: 'Real Strava monthly data',
      athleteId: parseInt(athleteId),
      monthsRequested: parseInt(months),
      data: monthlyData
    });
  } catch (error) {
    console.error('Get monthly stats error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// =====================================================
// ACTIVITY HISTORY - Complete history from REAL data
// =====================================================
exports.getActivityHistory = async (req, res) => {
  try {
    const { athleteId } = req.params;
    const { year, type, limit = 100 } = req.query;

    // Build query
    const query = { athleteId: parseInt(athleteId) };

    // Filter by year if provided
    if (year) {
      const startOfYear = new Date(parseInt(year), 0, 1);
      const endOfYear = new Date(parseInt(year), 11, 31, 23, 59, 59);
      query.startDate = { $gte: startOfYear, $lte: endOfYear };
    }

    // Filter by activity type if provided
    if (type) {
      query.type = type;
    }

    // Fetch REAL activities
    const activities = await Activity.find(query)
      .sort({ startDate: -1 })
      .limit(parseInt(limit));

    // Calculate summary stats
    const allStats = calculateActivityStats(activities);

    // Group by type
    const byType = {};
    activities.forEach(a => {
      if (!byType[a.type]) {
        byType[a.type] = [];
      }
      byType[a.type].push(formatActivitySummary(a));
    });

    // Calculate type-specific stats
    const typeStats = {};
    Object.keys(byType).forEach(actType => {
      const typeActivities = activities.filter(a => a.type === actType);
      typeStats[actType] = calculateActivityStats(typeActivities);
    });

    res.status(200).json({
      success: true,
      message: 'Real Strava activity history',
      athleteId: parseInt(athleteId),
      filters: {
        year: year || 'all',
        type: type || 'all',
        limit: parseInt(limit)
      },
      summary: allStats,
      typeBreakdown: typeStats,
      totalActivities: activities.length,
      activities: activities.map(formatActivitySummary)
    });
  } catch (error) {
    console.error('Get activity history error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// =====================================================
// HELPER FUNCTIONS for calculating REAL stats
// =====================================================

// Calculate stats from array of activities
function calculateActivityStats(activities) {
  if (!activities || activities.length === 0) {
    return {
      totalActivities: 0,
      totalDistance: 0,
      totalDistanceKm: 0,
      totalDistanceMiles: 0,
      totalMovingTime: 0,
      totalMovingTimeFormatted: '0h 0m',
      totalElapsedTime: 0,
      totalElevationGain: 0,
      totalCalories: 0,
      averageSpeed: 0,
      maxSpeed: 0,
      averageHeartrate: null,
      maxHeartrate: null,
      byType: {}
    };
  }

  const totalDistance = activities.reduce((sum, a) => sum + (a.distance || 0), 0);
  const totalMovingTime = activities.reduce((sum, a) => sum + (a.movingTime || 0), 0);
  const totalElapsedTime = activities.reduce((sum, a) => sum + (a.elapsedTime || 0), 0);
  const totalElevationGain = activities.reduce((sum, a) => sum + (a.totalElevationGain || 0), 0);
  const totalCalories = activities.reduce((sum, a) => sum + (a.calories || 0), 0);

  // Calculate averages
  const avgSpeed = activities.reduce((sum, a) => sum + (a.averageSpeed || 0), 0) / activities.length;
  const maxSpeed = Math.max(...activities.map(a => a.maxSpeed || 0));

  // Heart rate (only from activities with HR data)
  const hrActivities = activities.filter(a => a.averageHeartrate);
  const avgHr = hrActivities.length > 0
    ? hrActivities.reduce((sum, a) => sum + a.averageHeartrate, 0) / hrActivities.length
    : null;
  const maxHr = hrActivities.length > 0
    ? Math.max(...hrActivities.map(a => a.maxHeartrate || 0))
    : null;

  // Count by type
  const byType = {};
  activities.forEach(a => {
    if (!byType[a.type]) {
      byType[a.type] = { count: 0, distance: 0, movingTime: 0, elevationGain: 0 };
    }
    byType[a.type].count++;
    byType[a.type].distance += a.distance || 0;
    byType[a.type].movingTime += a.movingTime || 0;
    byType[a.type].elevationGain += a.totalElevationGain || 0;
  });

  return {
    totalActivities: activities.length,
    totalDistance: Math.round(totalDistance),
    totalDistanceKm: Math.round(totalDistance / 1000 * 100) / 100,
    totalDistanceMiles: Math.round(totalDistance / 1609.34 * 100) / 100,
    totalMovingTime: totalMovingTime,
    totalMovingTimeFormatted: formatDuration(totalMovingTime),
    totalElapsedTime: totalElapsedTime,
    totalElevationGain: Math.round(totalElevationGain),
    totalCalories: Math.round(totalCalories),
    averageSpeed: Math.round(avgSpeed * 100) / 100,
    maxSpeed: Math.round(maxSpeed * 100) / 100,
    averageHeartrate: avgHr ? Math.round(avgHr) : null,
    maxHeartrate: maxHr ? Math.round(maxHr) : null,
    byType
  };
}

// Format activity for response
function formatActivitySummary(activity) {
  return {
    id: activity.stravaActivityId,
    name: activity.name,
    type: activity.type,
    sportType: activity.sportType,
    date: activity.startDateLocal,
    distance: activity.distance,
    distanceKm: Math.round(activity.distance / 1000 * 100) / 100,
    movingTime: activity.movingTime,
    movingTimeFormatted: formatDuration(activity.movingTime),
    elapsedTime: activity.elapsedTime,
    elevationGain: activity.totalElevationGain,
    averageSpeed: activity.averageSpeed,
    maxSpeed: activity.maxSpeed,
    averageHeartrate: activity.averageHeartrate,
    maxHeartrate: activity.maxHeartrate,
    calories: activity.calories,
    kudosCount: activity.kudosCount,
    hasMap: !!activity.map?.summaryPolyline
  };
}

// Format duration in seconds to "Xh Ym" format
function formatDuration(seconds) {
  if (!seconds) return '0m';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

// Get ISO week number
function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

// Disconnect Strava
exports.disconnectStrava = async (req, res) => {
  try {
    const { athleteId } = req.params;

    const tokenDoc = await OAuthToken.findOne({ athleteId: parseInt(athleteId) });

    if (tokenDoc) {
      // Deauthorize with Strava
      try {
        await stravaService.deauthorize(tokenDoc.accessToken);
      } catch (e) {
        console.error('Deauthorization with Strava failed:', e.message);
      }

      // Delete all data
      await Promise.all([
        Athlete.deleteOne({ stravaId: parseInt(athleteId) }),
        OAuthToken.deleteOne({ athleteId: parseInt(athleteId) }),
        Activity.deleteMany({ athleteId: parseInt(athleteId) }),
        ActivityStats.deleteOne({ athleteId: parseInt(athleteId) }),
        SyncLog.deleteMany({ athleteId: parseInt(athleteId) })
      ]);
    }

    res.status(200).json({
      success: true,
      message: 'Strava disconnected successfully'
    });
  } catch (error) {
    console.error('Disconnect Strava error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Helper: Get valid access token (refresh if expired)
async function getValidAccessToken(athleteId) {
  const tokenDoc = await OAuthToken.findOne({ athleteId });

  if (!tokenDoc) {
    throw new Error('Token not found. Please reconnect with Strava.');
  }

  // Check if token is expired
  if (tokenDoc.isExpired()) {
    const newTokens = await stravaService.refreshAccessToken(tokenDoc.refreshToken);

    tokenDoc.accessToken = newTokens.accessToken;
    tokenDoc.refreshToken = newTokens.refreshToken;
    tokenDoc.expiresAt = newTokens.expiresAt;
    await tokenDoc.save();

    return newTokens.accessToken;
  }

  return tokenDoc.accessToken;
}

// Helper: Save athlete stats
async function saveAthleteStats(athleteId, statsData) {
  const formatTotals = (data) => ({
    count: data?.count || 0,
    distance: data?.distance || 0,
    movingTime: data?.moving_time || 0,
    elapsedTime: data?.elapsed_time || 0,
    elevationGain: data?.elevation_gain || 0,
    achievementCount: data?.achievement_count || 0
  });

  await ActivityStats.findOneAndUpdate(
    { athleteId },
    {
      athleteId,
      biggestRideDistance: statsData.biggest_ride_distance || 0,
      biggestClimbElevationGain: statsData.biggest_climb_elevation_gain || 0,
      recentRideTotals: formatTotals(statsData.recent_ride_totals),
      recentRunTotals: formatTotals(statsData.recent_run_totals),
      recentSwimTotals: formatTotals(statsData.recent_swim_totals),
      ytdRideTotals: formatTotals(statsData.ytd_ride_totals),
      ytdRunTotals: formatTotals(statsData.ytd_run_totals),
      ytdSwimTotals: formatTotals(statsData.ytd_swim_totals),
      allRideTotals: formatTotals(statsData.all_ride_totals),
      allRunTotals: formatTotals(statsData.all_run_totals),
      allSwimTotals: formatTotals(statsData.all_swim_totals)
    },
    { upsert: true, new: true }
  );
}

// Helper: Fetch and save all activities
async function fetchAndSaveAllActivities(athleteId, accessToken) {
  const activities = await stravaService.getAllActivities(accessToken);

  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log(`║        🚴 ACTIVITIES DATA (${activities.length} items)                 ║`);
  console.log('╚════════════════════════════════════════════════════════════╝');
  if (activities.length > 0) {
    console.log('Sample Activity (First item):');
    console.log(JSON.stringify(activities[0], null, 2));
    console.log(`... and ${activities.length - 1} more activities.`);
  } else {
    console.log('No activities found.');
  }
  console.log('--------------------------------------------------------------\n');

  let newCount = 0;
  let updatedCount = 0;

  for (const activityData of activities) {
    const existingActivity = await Activity.findOne({ stravaActivityId: activityData.id });

    const activityDoc = {
      athleteId,
      stravaActivityId: activityData.id,
      name: activityData.name,
      type: activityData.type,
      sportType: activityData.sport_type,
      distance: activityData.distance || 0,
      movingTime: activityData.moving_time || 0,
      elapsedTime: activityData.elapsed_time || 0,
      totalElevationGain: activityData.total_elevation_gain || 0,
      startDate: new Date(activityData.start_date),
      startDateLocal: new Date(activityData.start_date_local),
      timezone: activityData.timezone,
      utcOffset: activityData.utc_offset,
      startLatLng: activityData.start_latlng,
      endLatLng: activityData.end_latlng,
      achievementCount: activityData.achievement_count || 0,
      kudosCount: activityData.kudos_count || 0,
      commentCount: activityData.comment_count || 0,
      athleteCount: activityData.athlete_count || 1,
      photoCount: activityData.photo_count || 0,
      trainer: activityData.trainer || false,
      commute: activityData.commute || false,
      manual: activityData.manual || false,
      private: activityData.private || false,
      flagged: activityData.flagged || false,
      workoutType: activityData.workout_type,
      averageSpeed: activityData.average_speed || 0,
      maxSpeed: activityData.max_speed || 0,
      averageCadence: activityData.average_cadence,
      averageHeartrate: activityData.average_heartrate,
      maxHeartrate: activityData.max_heartrate,
      averageWatts: activityData.average_watts,
      maxWatts: activityData.max_watts,
      weightedAverageWatts: activityData.weighted_average_watts,
      kilojoules: activityData.kilojoules,
      deviceWatts: activityData.device_watts,
      hasHeartrate: activityData.has_heartrate || false,
      calories: activityData.calories || 0,
      sufferScore: activityData.suffer_score,
      map: activityData.map ? {
        id: activityData.map.id,
        summaryPolyline: activityData.map.summary_polyline,
        resourceState: activityData.map.resource_state
      } : null,
      gearId: activityData.gear_id,
      deviceName: activityData.device_name
    };

    if (existingActivity) {
      await Activity.updateOne(
        { stravaActivityId: activityData.id },
        activityDoc
      );
      updatedCount++;
    } else {
      await Activity.create(activityDoc);
      newCount++;
    }
  }

  return {
    total: activities.length,
    new: newCount,
    updated: updatedCount
  };
}
