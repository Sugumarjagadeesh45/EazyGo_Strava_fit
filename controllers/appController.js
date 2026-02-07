const Athlete = require('../models/Athlete');
const Activity = require('../models/Activity');
const Challenge = require('../models/Challenge');

function formatDuration(seconds) {
  if (!seconds) return { hours: 0, minutes: 0, formatted: '0h 0m' };
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return {
    hours,
    minutes,
    totalMinutes: Math.floor(seconds / 60),
    formatted: hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
  };
}


function formatDistance(meters) {
  if (!meters) return { km: 0, meters: 0, formatted: '0.00 km' };
  const km = meters / 1000;
  return {
    km: Math.round(km * 100) / 100,
    meters: Math.round(meters),
    formatted: `${km.toFixed(2)} km`
  };
}


/**
 * Categorize activity type for display
 */
function categorizeActivity(activity) {
  const name = (activity.name || '').toLowerCase();
  const type = (activity.type || '').toLowerCase();

  if (name.includes('morning') || (activity.startDateLocal && new Date(activity.startDateLocal).getHours() < 12)) {
    if (type === 'walk' || name.includes('walk')) return 'Morning Walk';
    if (type === 'run' || name.includes('run')) return 'Morning Run';
  }
  if (name.includes('evening') || (activity.startDateLocal && new Date(activity.startDateLocal).getHours() >= 17)) {
    if (type === 'walk' || name.includes('walk')) return 'Evening Walk';
    if (type === 'run' || name.includes('run')) return 'Evening Run';
  }

  // Default categorization
  if (type === 'walk') return 'Walk';
  if (type === 'run') return 'Run';
  if (type === 'ride') return 'Ride';

  return activity.type || 'Other';
}

/**
 * Get start of day
 */
function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Get end of day
 */
function endOfDay(date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

exports.getProfile = async (req, res) => {
  try {
    const { athleteId } = req.params;

    // Get athlete profile
    const athlete = await Athlete.findOne({ stravaId: parseInt(athleteId) });
    if (!athlete) {
      return res.status(404).json({
        success: false,
        message: 'Athlete not found'
      });
    }

    // Get all activities for this athlete (from join date)
    const activities = await Activity.find({
      athleteId: parseInt(athleteId)
    });

    // Calculate total stats
    const totalActivities = activities.length;

    // Total KM (running + walking only as per requirement)
    const runWalkActivities = activities.filter(a =>
      ['Run', 'Walk'].includes(a.type)
    );
    const totalDistanceMeters = runWalkActivities.reduce((sum, a) => sum + (a.distance || 0), 0);
    const totalDistance = formatDistance(totalDistanceMeters);

    // Total hours (all activities)
    const totalMovingTimeSeconds = activities.reduce((sum, a) => sum + (a.movingTime || 0), 0);
    const totalHours = formatDuration(totalMovingTimeSeconds);

    res.status(200).json({
      success: true,
      data: {
        profile: {
          id: athlete.stravaId,
          username: athlete.username,
          firstName: athlete.firstName,
          lastName: athlete.lastName,
          fullName: athlete.fullName,
          profileImage: athlete.profile,
          profileMedium: athlete.profileMedium,
          city: athlete.city,
          state: athlete.state,
          country: athlete.country,
          gender: athlete.gender,
          premium: athlete.premium,
          joinedAt: athlete.createdAt
        },
        stats: {
          totalActivities,
          totalKm: totalDistance.km,
          totalKmFormatted: totalDistance.formatted,
          totalHours: totalHours.hours,
          totalMinutes: totalHours.minutes,
          totalTimeFormatted: totalHours.formatted
        }
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ============================================================================
// HOME PAGE ENDPOINTS
// ============================================================================

/**
 * GET /app/home/:athleteId
 * Get all data needed for the home screen
 */
exports.getHomeData = async (req, res) => {
  try {
    const { athleteId } = req.params;

    // Get athlete profile
    const athlete = await Athlete.findOne({ stravaId: parseInt(athleteId) });
    if (!athlete) {
      return res.status(404).json({
        success: false,
        message: 'Athlete not found'
      });
    }

    // Get all activities for stats calculation
    const allActivities = await Activity.find({
      athleteId: parseInt(athleteId)
    });

    // Calculate total stats (from join date until now)
    const totalActivities = allActivities.length;

    const runWalkActivities = allActivities.filter(a =>
      ['Run', 'Walk'].includes(a.type)
    );
    const totalDistanceMeters = runWalkActivities.reduce((sum, a) => sum + (a.distance || 0), 0);
    const totalDistance = formatDistance(totalDistanceMeters);

    const totalMovingTimeSeconds = allActivities.reduce((sum, a) => sum + (a.movingTime || 0), 0);
    const totalHours = formatDuration(totalMovingTimeSeconds);

    // Get recent activities (last 3 days)
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    threeDaysAgo.setHours(0, 0, 0, 0);

    const recentActivities = await Activity.find({
      athleteId: parseInt(athleteId),
      startDateLocal: { $gte: threeDaysAgo }
    }).sort({ startDateLocal: -1 });

    // Format recent activities
    const formattedRecentActivities = recentActivities.map(activity => {
      const activityDate = new Date(activity.startDateLocal);
      const dayName = activityDate.toLocaleDateString('en-US', { weekday: 'short' });
      const time = activityDate.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });

      return {
        id: activity.stravaActivityId,
        name: activity.name,
        category: categorizeActivity(activity),
        type: activity.type,
        day: dayName,
        date: activityDate.toISOString().split('T')[0],
        time,
        displayDateTime: `${dayName} ${time}`,
        distanceKm: formatDistance(activity.distance).km,
        distanceFormatted: formatDistance(activity.distance).formatted,
        duration: formatDuration(activity.movingTime).formatted,
        calories: activity.calories || 0
      };
    });

    // Current date info for calendar
    const now = new Date();
    const currentDate = {
      date: now.getDate(),
      day: now.toLocaleDateString('en-US', { weekday: 'long' }),
      month: now.toLocaleDateString('en-US', { month: 'long' }),
      year: now.getFullYear(),
      formatted: now.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    };

    res.status(200).json({
      success: true,
      data: {
        user: {
          id: athlete.stravaId,
          firstName: athlete.firstName,
          lastName: athlete.lastName,
          fullName: athlete.fullName,
          profileImage: athlete.profile
        },
        calendar: currentDate,
        yourStats: {
          totalActivities,
          totalKm: totalDistance.km,
          totalKmFormatted: totalDistance.formatted,
          totalHours: totalHours.hours,
          totalMinutes: totalHours.minutes,
          totalTimeFormatted: totalHours.formatted
        },
        recentActivities: {
          count: formattedRecentActivities.length,
          period: 'Last 3 days',
          activities: formattedRecentActivities
        }
      }
    });
  } catch (error) {
    console.error('Get home data error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ============================================================================
// ACTIVITY PAGE ENDPOINTS
// ============================================================================

/**
 * GET /app/activities/:athleteId
 * Get activities with month filter
 * Query params: month (1-12), year (YYYY)
 */
exports.getActivities = async (req, res) => {
  try {
    const { athleteId } = req.params;
    const { month, year } = req.query;

    // Build date filter
    let dateFilter = {};
    const now = new Date();
    const filterYear = year ? parseInt(year) : now.getFullYear();
    const filterMonth = month ? parseInt(month) - 1 : now.getMonth(); // JavaScript months are 0-indexed

    // Filter by specific month
    const startOfMonth = new Date(filterYear, filterMonth, 1);
    const endOfMonth = new Date(filterYear, filterMonth + 1, 0, 23, 59, 59, 999);

    dateFilter = {
      startDateLocal: {
        $gte: startOfMonth,
        $lte: endOfMonth
      }
    };

    // Get activities for the specified month
    const activities = await Activity.find({
      athleteId: parseInt(athleteId),
      ...dateFilter
    }).sort({ startDateLocal: -1 });

    // Format activities
    const formattedActivities = activities.map(activity => {
      const activityDate = new Date(activity.startDateLocal);
      return {
        id: activity.stravaActivityId,
        name: activity.name,
        category: categorizeActivity(activity),
        type: activity.type,
        sportType: activity.sportType,
        date: activityDate.toISOString().split('T')[0],
        day: activityDate.getDate(),
        dayName: activityDate.toLocaleDateString('en-US', { weekday: 'short' }),
        time: activityDate.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        }),
        distanceKm: formatDistance(activity.distance).km,
        distanceFormatted: formatDistance(activity.distance).formatted,
        duration: formatDuration(activity.movingTime),
        elevationGain: activity.totalElevationGain || 0,
        calories: activity.calories || 0,
        averageSpeed: activity.averageSpeed || 0,
        maxSpeed: activity.maxSpeed || 0,
        hasMap: !!(activity.map && activity.map.summaryPolyline)
      };
    });

    // Calculate month summary
    const monthTotalDistance = activities.reduce((sum, a) => sum + (a.distance || 0), 0);
    const monthTotalTime = activities.reduce((sum, a) => sum + (a.movingTime || 0), 0);

    // Get available months (months that have activities)
    const athlete = await Athlete.findOne({ stravaId: parseInt(athleteId) });
    const allActivities = await Activity.find({
      athleteId: parseInt(athleteId)
    }).select('startDateLocal');

    const availableMonths = [...new Set(allActivities.map(a => {
      const d = new Date(a.startDateLocal);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }))].sort().reverse();

    res.status(200).json({
      success: true,
      data: {
        filter: {
          month: filterMonth + 1,
          monthName: new Date(filterYear, filterMonth).toLocaleDateString('en-US', { month: 'long' }),
          year: filterYear,
          formatted: `${new Date(filterYear, filterMonth).toLocaleDateString('en-US', { month: 'long' })} ${filterYear}`
        },
        summary: {
          totalActivities: activities.length,
          totalKm: formatDistance(monthTotalDistance).km,
          totalKmFormatted: formatDistance(monthTotalDistance).formatted,
          totalTime: formatDuration(monthTotalTime).formatted
        },
        availableMonths,
        activities: formattedActivities
      }
    });
  } catch (error) {
    console.error('Get activities error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * GET /app/activities/:athleteId/all
 * Get all activities from registration date until now
 */
exports.getAllActivities = async (req, res) => {
  try {
    const { athleteId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    const activities = await Activity.find({
      athleteId: parseInt(athleteId)
    })
      .sort({ startDateLocal: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit));

    const total = await Activity.countDocuments({ athleteId: parseInt(athleteId) });

    const formattedActivities = activities.map(activity => {
      const activityDate = new Date(activity.startDateLocal);
      return {
        id: activity.stravaActivityId,
        name: activity.name,
        category: categorizeActivity(activity),
        type: activity.type,
        date: activityDate.toISOString().split('T')[0],
        dayName: activityDate.toLocaleDateString('en-US', { weekday: 'short' }),
        time: activityDate.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        }),
        distanceKm: formatDistance(activity.distance).km,
        distanceFormatted: formatDistance(activity.distance).formatted,
        duration: formatDuration(activity.movingTime),
        calories: activity.calories || 0
      };
    });

    res.status(200).json({
      success: true,
      data: {
        activities: formattedActivities,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
          hasMore: parseInt(page) * parseInt(limit) < total
        }
      }
    });
  } catch (error) {
    console.error('Get all activities error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ============================================================================
// LEADERBOARD ENDPOINTS
// ============================================================================

/**
 * GET /app/leaderboard
 * Get leaderboard for all users
 * Query params: period (week, month)
 */
exports.getLeaderboard = async (req, res) => {
  try {
    const { period = 'week' } = req.query;

    // Calculate date range based on period
    const now = new Date();
    let startDate;

    if (period === 'week') {
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 7);
    } else if (period === 'month') {
      startDate = new Date(now);
      startDate.setMonth(startDate.getMonth() - 1);
    } else {
      startDate = new Date(0); // All time
    }
    startDate.setHours(0, 0, 0, 0);

    // Get all athletes
    const athletes = await Athlete.find({});

    // Calculate stats for each athlete in the period
    const leaderboardData = await Promise.all(
      athletes.map(async (athlete) => {
        const activities = await Activity.find({
          athleteId: athlete.stravaId,
          startDateLocal: { $gte: startDate }
        });

        const totalActivities = activities.length;
        const totalDistanceMeters = activities.reduce((sum, a) => sum + (a.distance || 0), 0);
        const totalTimeSeconds = activities.reduce((sum, a) => sum + (a.movingTime || 0), 0);
        const totalCalories = activities.reduce((sum, a) => sum + (a.calories || 0), 0);

        return {
          athleteId: athlete.stravaId,
          firstName: athlete.firstName,
          lastName: athlete.lastName,
          fullName: athlete.fullName,
          profileImage: athlete.profile,
          city: athlete.city,
          stats: {
            totalActivities,
            totalKm: formatDistance(totalDistanceMeters).km,
            totalKmFormatted: formatDistance(totalDistanceMeters).formatted,
            totalHours: formatDuration(totalTimeSeconds).hours,
            totalTimeFormatted: formatDuration(totalTimeSeconds).formatted,
            totalCalories
          },
          // Score for ranking (weighted: distance has highest weight)
          score: (totalDistanceMeters / 1000) + (totalActivities * 2) + (totalTimeSeconds / 3600)
        };
      })
    );

    // Sort by score descending
    leaderboardData.sort((a, b) => b.score - a.score);

    // Add rank
    leaderboardData.forEach((item, index) => {
      item.rank = index + 1;
    });

    // Separate top 3 and rest
    const top3 = leaderboardData.slice(0, 3);
    const rest = leaderboardData.slice(3);

    res.status(200).json({
      success: true,
      data: {
        period: {
          type: period,
          label: period === 'week' ? 'Last 1 Week' : period === 'month' ? 'Last 1 Month' : 'All Time',
          startDate: startDate.toISOString(),
          endDate: now.toISOString()
        },
        totalParticipants: leaderboardData.length,
        top3,
        others: rest
      }
    });
  } catch (error) {
    console.error('Get leaderboard error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * GET /app/leaderboard/:athleteId/rank
 * Get specific athlete's rank
 */
exports.getAthleteRank = async (req, res) => {
  try {
    const { athleteId } = req.params;
    const { period = 'week' } = req.query;

    // Calculate date range
    const now = new Date();
    let startDate;

    if (period === 'week') {
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 7);
    } else if (period === 'month') {
      startDate = new Date(now);
      startDate.setMonth(startDate.getMonth() - 1);
    } else {
      startDate = new Date(0);
    }
    startDate.setHours(0, 0, 0, 0);

    // Get all athletes and calculate scores
    const athletes = await Athlete.find({});
    const scores = await Promise.all(
      athletes.map(async (athlete) => {
        const activities = await Activity.find({
          athleteId: athlete.stravaId,
          startDateLocal: { $gte: startDate }
        });

        const totalDistanceMeters = activities.reduce((sum, a) => sum + (a.distance || 0), 0);
        const totalTimeSeconds = activities.reduce((sum, a) => sum + (a.movingTime || 0), 0);
        const score = (totalDistanceMeters / 1000) + (activities.length * 2) + (totalTimeSeconds / 3600);

        return {
          athleteId: athlete.stravaId,
          score,
          totalKm: formatDistance(totalDistanceMeters).km,
          totalActivities: activities.length
        };
      })
    );

    // Sort and find rank
    scores.sort((a, b) => b.score - a.score);
    const athleteIndex = scores.findIndex(s => s.athleteId === parseInt(athleteId));

    if (athleteIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Athlete not found'
      });
    }

    const athleteData = scores[athleteIndex];

    res.status(200).json({
      success: true,
      data: {
        athleteId: parseInt(athleteId),
        rank: athleteIndex + 1,
        totalParticipants: scores.length,
        period,
        stats: {
          totalKm: athleteData.totalKm,
          totalActivities: athleteData.totalActivities,
          score: Math.round(athleteData.score * 100) / 100
        }
      }
    });
  } catch (error) {
    console.error('Get athlete rank error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ============================================================================
// CHALLENGES ENDPOINTS
// ============================================================================

/**
 * GET /app/challenges
 * Get all active and upcoming challenges
 */
exports.getChallenges = async (req, res) => {
  try {
    const { athleteId } = req.query;

    // Get active and upcoming challenges
    const challenges = await Challenge.getActiveChallenges();

    if (!challenges || challenges.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No challenges available at the moment',
        data: {
          challenges: [],
          count: 0
        }
      });
    }

    // Format challenges
    const formattedChallenges = challenges.map(challenge => {
      // Check if current athlete has joined
      const participation = athleteId
        ? challenge.participants.find(p => p.athleteId === parseInt(athleteId))
        : null;

      return {
        id: challenge._id,
        title: challenge.title,
        description: challenge.description,
        type: challenge.type,
        activityTypes: challenge.activityTypes,
        goal: {
          value: challenge.goal.value,
          unit: challenge.goal.unit,
          formatted: `${challenge.goal.value} ${challenge.goal.unit}`
        },
        startDate: challenge.startDate,
        endDate: challenge.endDate,
        status: challenge.status,
        imageUrl: challenge.imageUrl,
        reward: challenge.reward,
        participantCount: challenge.participantCount,
        maxParticipants: challenge.maxParticipants,
        isJoined: !!participation,
        userProgress: participation ? {
          progress: participation.progress,
          completed: participation.completed,
          completedAt: participation.completedAt,
          percentage: Math.min(100, Math.round((participation.progress / challenge.goal.value) * 100))
        } : null
      };
    });

    res.status(200).json({
      success: true,
      data: {
        challenges: formattedChallenges,
        count: formattedChallenges.length
      }
    });
  } catch (error) {
    console.error('Get challenges error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * POST /app/challenges/:challengeId/join
 * Join a challenge
 */
exports.joinChallenge = async (req, res) => {
  try {
    const { challengeId } = req.params;
    const { athleteId } = req.body;

    if (!athleteId) {
      return res.status(400).json({
        success: false,
        message: 'Athlete ID is required'
      });
    }

    const challenge = await Challenge.findById(challengeId);

    if (!challenge) {
      return res.status(404).json({
        success: false,
        message: 'Challenge not found'
      });
    }

    // Check if already joined
    const alreadyJoined = challenge.participants.some(
      p => p.athleteId === parseInt(athleteId)
    );

    if (alreadyJoined) {
      return res.status(400).json({
        success: false,
        message: 'You have already joined this challenge'
      });
    }

    // Check max participants
    if (challenge.maxParticipants > 0 && challenge.participants.length >= challenge.maxParticipants) {
      return res.status(400).json({
        success: false,
        message: 'This challenge has reached maximum participants'
      });
    }

    // Add participant
    challenge.participants.push({
      athleteId: parseInt(athleteId),
      joinedAt: new Date(),
      progress: 0,
      completed: false
    });

    await challenge.save();

    res.status(200).json({
      success: true,
      message: 'Successfully joined the challenge',
      data: {
        challengeId,
        athleteId: parseInt(athleteId)
      }
    });
  } catch (error) {
    console.error('Join challenge error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * GET /app/challenges/:athleteId/my
 * Get challenges joined by the athlete
 */
exports.getMyChallenges = async (req, res) => {
  try {
    const { athleteId } = req.params;

    const challenges = await Challenge.find({
      'participants.athleteId': parseInt(athleteId)
    });

    if (!challenges || challenges.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'You have not joined any challenges yet',
        data: {
          challenges: [],
          count: 0
        }
      });
    }

    const formattedChallenges = challenges.map(challenge => {
      const participation = challenge.participants.find(
        p => p.athleteId === parseInt(athleteId)
      );

      return {
        id: challenge._id,
        title: challenge.title,
        description: challenge.description,
        type: challenge.type,
        goal: challenge.goal,
        startDate: challenge.startDate,
        endDate: challenge.endDate,
        status: challenge.status,
        progress: participation.progress,
        completed: participation.completed,
        completedAt: participation.completedAt,
        percentage: Math.min(100, Math.round((participation.progress / challenge.goal.value) * 100))
      };
    });

    res.status(200).json({
      success: true,
      data: {
        challenges: formattedChallenges,
        count: formattedChallenges.length
      }
    });
  } catch (error) {
    console.error('Get my challenges error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
