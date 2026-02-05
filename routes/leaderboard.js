const express = require('express');
const router = express.Router();
const Activity = require('../models/Activity');
const Athlete = require('../models/Athlete');

/**
 * @route   GET /api/leaderboard
 * @desc    Get leaderboard rankings with dynamic calculation
 * @access  Public (Protected by JWT in real flow)
 */
router.get('/leaderboard', async (req, res) => {
  try {
    const { period, type } = req.query;
    
    // 1. Date Filter
    const now = new Date();
    let startDate = new Date(now); // Create a copy to avoid mutation issues
    
    if (period === 'month') {
      // Rolling 30 days from today
      startDate.setDate(startDate.getDate() - 30);
    } else {
      // Default to a rolling 7 days from today
      startDate.setDate(startDate.getDate() - 7);
    }
    // Set to the beginning of the start day for an accurate range
    startDate.setHours(0, 0, 0, 0);
    
    console.log(`[Leaderboard] Fetching: ${period || 'week'} | StartDate: ${startDate.toISOString()} | Type: ${type || 'All'}`);

    // 2. Type Filter Setup
    let typeFilter = {};
    if (type && type !== 'All Activities') {
      let stravaType = type;
      if (type === 'Cycle Ride') stravaType = 'Ride';
      typeFilter = { type: stravaType };
    }

    // 3. Aggregation Pipeline (Start from Athlete to include everyone)
    const leaderboard = await Athlete.aggregate([
      {
        $lookup: {
          from: 'activities',
          let: { 
            aid: '$stravaId', 
            weight: { $ifNull: ['$weight', 70] } 
          },
          pipeline: [
            { 
              $match: {
                $expr: { $eq: ['$athleteId', '$$aid'] },
                // Use standard query syntax for external variables (more robust)
                startDate: { $gte: startDate },
                ...(Object.keys(typeFilter).length > 0 ? { type: typeFilter.type } : {})
              }
            },
            {
              $addFields: {
                durationMin: { $divide: ['$movingTime', 60] },
                activityFactor: {
                  $switch: {
                    branches: [
                      { case: { $eq: ['$type', 'Walk'] }, then: 3.5 },
                      { case: { $eq: ['$type', 'Run'] }, then: 9.8 },
                      { case: { $eq: ['$type', 'Ride'] }, then: 6.8 },
                      { case: { $eq: ['$type', 'Swim'] }, then: 8.3 },
                      { case: { $eq: ['$type', 'Hike'] }, then: 7.5 },
                      { case: { $eq: ['$type', 'WeightTraining'] }, then: 5 },
                      { case: { $eq: ['$type', 'Workout'] }, then: 8 },
                      { case: { $eq: ['$type', 'Yoga'] }, then: 2.5 }
                    ],
                    default: 6
                  }
                }
              }
            },
            {
              $addFields: {
                // Calories = Factor * Weight * Time(min) / 60
                baseCalories: {
                  $multiply: ['$activityFactor', '$$weight', { $divide: ['$durationMin', 60] }]
                },
                // Elevation Bonus: 0.01 * Weight * Elevation (for specific types)
                elevationCalories: {
                  $cond: {
                    if: { $in: ['$type', ['Walk', 'Run', 'Ride', 'Hike']] },
                    then: { $multiply: [0.01, '$$weight', '$totalElevationGain'] },
                    else: 0
                  }
                }
              }
            },
            {
              $addFields: {
                totalActivityCalories: { $add: ['$baseCalories', '$elevationCalories'] }
              }
            }
          ],
          as: 'activities'
        }
      },
      {
        $addFields: {
          totalDistance: { $sum: '$activities.distance' },
          totalTime: { $sum: '$activities.movingTime' },
          totalElevation: { $sum: '$activities.totalElevationGain' },
          totalCalories: { $sum: '$activities.totalActivityCalories' }
        }
      },
      { $sort: { totalDistance: -1 } }, // Sort by highest distance
      {
        $project: {
          _id: 0,
          athleteId: '$stravaId',
          name: { $concat: [{ $ifNull: ['$firstName', 'User'] }, ' ', { $ifNull: ['$lastName', ''] }] },
          profile: 1,
          totalDistanceKM: { $round: [{ $divide: ['$totalDistance', 1000] }, 2] },
          activityType: { $literal: type || 'All Activities' },
          totalTimeMinutes: { $round: [{ $divide: ['$totalTime', 60] }, 0] },
          totalElevationGainMeters: { $round: ['$totalElevation', 0] },
          caloriesBurned: { $round: ['$totalCalories', 0] }
        }
      }
    ]);

    res.json({
      success: true,
      users: leaderboard
    });

  } catch (error) {
    console.error('Leaderboard error:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
});

/**
 * @route   GET /api/challenges
 * @desc    Get active challenges
 */
router.get('/challenges', (req, res) => {
  const challengesData = [
    {
      _id: "7012cf01f640edb179355d22",
      title: "Weekly 5k Run",
      description: "Complete a 5k run this week to earn a badge.",
      type: "Run",
      goalValue: 5000,
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      participantCount: 15,
      image: "https://images.unsplash.com/photo-1552674605-469523170d9e?auto=format&fit=crop&w=800&q=80"
    }
  ];

  res.json({
    success: true,
    data: challengesData
  });
});

module.exports = router;