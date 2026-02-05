/**
 * Background Sync Worker
 * Handles activity syncing in the background without blocking the OAuth callback
 */

const stravaService = require('./stravaService');
const Activity = require('../models/Activity');
const ActivityStats = require('../models/ActivityStats');
const SyncLog = require('../models/SyncLog');
const OAuthToken = require('../models/OAuthToken');

/**
 * Queue for managing sync jobs
 * In production, consider using Bull/Redis for distributed job processing
 */
const syncQueue = new Map();

/**
 * Start background sync for an athlete
 * @param {number} athleteId - Strava athlete ID
 * @param {string} accessToken - Valid Strava access token
 * @returns {Promise<string>} - Sync log ID
 */
async function startBackgroundSync(athleteId, accessToken) {
  // Create sync log entry
  const syncLog = new SyncLog({
    athleteId: athleteId,
    syncType: 'full',
    status: 'started'
  });
  await syncLog.save();

  // Add to queue (prevent duplicate syncs)
  if (syncQueue.has(athleteId)) {
    console.log(`⚠️ Sync already in progress for athlete ${athleteId}`);
    return syncQueue.get(athleteId);
  }

  syncQueue.set(athleteId, syncLog._id.toString());

  // Run sync in background (non-blocking)
  runSync(athleteId, accessToken, syncLog).finally(() => {
    syncQueue.delete(athleteId);
  });

  return syncLog._id.toString();
}

/**
 * Execute the sync process
 */
async function runSync(athleteId, accessToken, syncLog) {
  try {
    console.log(`📊 [Sync ${syncLog._id}] Starting sync for athlete ${athleteId}`);

    // Fetch and save athlete stats
    console.log(`📈 [Sync ${syncLog._id}] Fetching stats...`);
    const statsData = await stravaService.getAthleteStats(accessToken, athleteId);
    await saveAthleteStats(athleteId, statsData);
    console.log(`✅ [Sync ${syncLog._id}] Stats saved`);

    // Fetch and save all activities
    console.log(`📥 [Sync ${syncLog._id}] Fetching activities...`);
    const activitiesResult = await fetchAndSaveAllActivities(athleteId, accessToken);

    // Update sync log with success
    syncLog.status = 'completed';
    syncLog.activitiesSynced = activitiesResult.total;
    syncLog.newActivities = activitiesResult.new;
    syncLog.updatedActivities = activitiesResult.updated;
    syncLog.completedAt = new Date();
    await syncLog.save();

    console.log(`✅ [Sync ${syncLog._id}] Complete!`);
    console.log(`   Total: ${activitiesResult.total}, New: ${activitiesResult.new}, Updated: ${activitiesResult.updated}`);

    return activitiesResult;

  } catch (error) {
    console.error(`❌ [Sync ${syncLog._id}] Failed:`, error.message);

    syncLog.status = 'failed';
    syncLog.errorMessage = error.message;
    syncLog.completedAt = new Date();
    await syncLog.save();

    throw error;
  }
}

/**
 * Get valid access token, refreshing if expired
 */
async function getValidAccessToken(athleteId) {
  const tokenDoc = await OAuthToken.findOne({ athleteId });

  if (!tokenDoc) {
    throw new Error('Token not found. Please reconnect with Strava.');
  }

  if (tokenDoc.isExpired()) {
    console.log(`🔄 Token expired for athlete ${athleteId}, refreshing...`);
    const newTokens = await stravaService.refreshAccessToken(tokenDoc.refreshToken);

    tokenDoc.accessToken = newTokens.accessToken;
    tokenDoc.refreshToken = newTokens.refreshToken;
    tokenDoc.expiresAt = newTokens.expiresAt;
    await tokenDoc.save();

    return newTokens.accessToken;
  }

  return tokenDoc.accessToken;
}

/**
 * Save athlete stats to database
 */
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

/**
 * Fetch and save all activities from Strava
 */
async function fetchAndSaveAllActivities(athleteId, accessToken) {
  const activities = await stravaService.getAllActivities(accessToken);

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

/**
 * Check sync status
 */
function getSyncStatus(athleteId) {
  return {
    inProgress: syncQueue.has(athleteId),
    syncLogId: syncQueue.get(athleteId) || null
  };
}

module.exports = {
  startBackgroundSync,
  getValidAccessToken,
  saveAthleteStats,
  fetchAndSaveAllActivities,
  getSyncStatus
};
