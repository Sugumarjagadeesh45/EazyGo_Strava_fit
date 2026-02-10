
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Athlete = require('../models/Athlete');
const Activity = require('../models/Activity');

/**
 * @route   GET /api/leaderboard
 * @desc    Get unified leaderboard (Works for User App & Admin Panel)
 * @access  Public
 */
router.get('/leaderboard', async (req, res) => {
  try {
    const { period = '7days', type = 'all', activityType } = req.query;
    
    // Handle activityType alias and defaults
    const filterType = activityType || type || 'all';
    
    console.log(`[Leaderboard] Request - Period: ${period}, Type: ${filterType}`);

    // 1. Normalize Period Input
    let daysToSubtract = 7;
    if (period === 'month' || period === '30days') daysToSubtract = 30;

    // 2. Date Filter Logic (Extract plain Date object)
    const now = new Date();
    let filterStartDate = null;

    if (period !== 'all') {
      let startDate = new Date(now);
      startDate.setDate(startDate.getDate() - daysToSubtract);
      startDate.setHours(0, 0, 0, 0);
      filterStartDate = startDate;
    }

    // 3. Type Filter Logic
    let typeFilter = {};
    if (filterType && filterType !== 'All' && filterType !== 'all') {
      let stravaType = filterType;
      if (filterType === 'Cycle Ride') stravaType = 'Ride';
      typeFilter = { type: stravaType };
    }

    // 4. Aggregation Pipeline
    const leaderboard = await Athlete.aggregate([
      {
        // STAGE 1: Lookup Activities
        $lookup: {
          from: 'activities',
          let: { 
            athleteIdStr: { $toString: '$stravaId' },
            weight: { $ifNull: ['$weight', 70] } 
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: [{ $toString: '$athleteId' }, '$$athleteIdStr'] },
                    // Correct Date Filter usage
                    ...(filterStartDate ? [{ $gte: ['$startDate', filterStartDate] }] : []),
                    // Type Filter
                    ...(Object.keys(typeFilter).length > 0 ? [{ $eq: ['$type', typeFilter.type] }] : [])
                  ]
                }
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
                baseCalories: {
                  $multiply: ['$activityFactor', '$$weight', { $divide: ['$durationMin', 60] }]
                },
                elevationCalories: {
                  $cond: {
                    if: { $in: ['$type', ['Walk', 'Run', 'Ride', 'Hike']] },
                    then: { $multiply: [0.01, '$$weight', { $ifNull: ['$totalElevationGain', 0] }] },
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
        // STAGE 2: Calculate Basic Totals & Prepare Dates
        $addFields: {
          totalDistance: { $sum: '$activities.distance' },
          totalTime: { $sum: '$activities.movingTime' },
          totalElevation: { $sum: '$activities.totalElevationGain' },
          totalCalories: { $sum: '$activities.totalActivityCalories' },
          activityCount: { $size: '$activities' },
          // Map dates to string array for later unique calculation
          dateStrings: {
            $map: {
              input: '$activities',
              as: 'act',
              in: { $dateToString: { date: '$$act.startDate', format: '%Y-%m-%d' } }
            }
          }
        }
      },
      {
        // STAGE 3: Calculate Unique Days (Fixing the '$set' error)
        $addFields: {
          uniqueDates: {
            $reduce: {
              input: '$dateStrings',
              initialValue: [],
              in: {
                $concatArrays: [
                  '$$value',
                  {
                    $cond: {
                      if: { $in: ['$$this', '$$value'] },
                      then: [], // Duplicate, add nothing
                      else: ['$$this'] // Unique, add date
                    }
                  }
                ]
              }
            }
          }
        }
      },
      {
        // STAGE 4: Format Final Metrics
        $addFields: {
          workoutDays: { $size: '$uniqueDates' }
        }
      },
      {
        // STAGE 5: Sort (Highest Distance First)
        $sort: { totalDistance: -1 }
      },
      {
        // STAGE 6: Project Final Output
        $project: {
          _id: 0,
          athleteId: '$stravaId',
          name: { 
            $concat: [
              { $ifNull: ['$firstName', 'User'] }, 
              ' ', 
              { $ifNull: ['$lastName', ''] }
            ] 
          },
          // Fields for User App
          profile: 1, 
          // Fields for Admin Panel
          firstName: 1,
          lastName: 1,
          city: { $ifNull: ['$city', 'Unknown'] },
          country: { $ifNull: ['$country', 'Unknown'] },
          profile_medium: '$profileMedium',
          
          // Metrics
          totalDistanceKM: { $round: [{ $divide: ['$totalDistance', 1000] }, 2] },
          activityType: { $literal: filterType === 'all' || !filterType ? 'All Activities' : filterType },
          totalTimeMinutes: { $round: [{ $divide: ['$totalTime', 60] }, 0] },
          totalElevationGainMeters: { $round: ['$totalElevation', 0] },
          caloriesBurned: { $round: ['$totalCalories', 0] },
          
          // Admin Metrics
          activityCount: 1,
          workoutDays: 1,
          registrationDate: '$createdAt',
          lastActivityDate: { $arrayElemAt: ['$activities.startDate', -1] } 
        }
      }
    ]);

    res.json({
      success: true,
      period,
      activityType: filterType,
      totalAthletes: leaderboard.length,
      users: leaderboard
    });

  } catch (error) {
    console.error('❌ Leaderboard Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server Error', 
      error: error.message 
    });
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

/**
 * @route   GET /api/activity-types
 * @desc    Get all unique activity types from database
 */
router.get('/activity-types', async (req, res) => {
  try {
    console.log('📊 Fetching activity types...');
    
    const activityTypes = await Activity.distinct('type');
    
    const filteredTypes = activityTypes
      .filter(type => type && type.trim() !== '' && type !== null)
      .map(type => type.trim())
      .sort();
    
    if (filteredTypes.length === 0) {
      const commonTypes = ['Run', 'Walk', 'Ride', 'Swim', 'Hike', 'Workout', 'WeightTraining', 'Yoga'];
      return res.json({ success: true, activityTypes: commonTypes });
    }
    
    res.json({ success: true, activityTypes: filteredTypes });
    
  } catch (error) {
    console.error('❌ Error fetching activity types:', error);
    const fallbackTypes = ['Run', 'Walk', 'Ride', 'Swim', 'Hike', 'Workout'];
    res.json({ success: true, activityTypes: fallbackTypes });
  }
});

/**
 * @route   GET /api/club/top-performer
 * @desc    Get the club member with the best performance today
 */
router.get('/club/top-performer', async (req, res) => {
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const topPerformer = await Activity.aggregate([
      {
        $match: {
          startDate: { $gte: startOfDay, $lte: endOfDay }
        }
      },
      {
        $group: {
          _id: "$athleteId",
          totalDistance: { $sum: "$distance" },
          activityCount: { $sum: 1 }
        }
      },
      { $sort: { totalDistance: -1 } },
      { $limit: 3 },
      {
        $lookup: {
          from: "athletes",
          localField: "_id",
          foreignField: "athleteId",
          as: "athleteInfo"
        }
      },
      { $unwind: "$athleteInfo" }
    ]);

    if (topPerformer.length === 0) {
      return res.json({ 
        success: true, 
        data: []
      });
    }

    const data = topPerformer.map((performer, index) => {
      const athlete = performer.athleteInfo;
      let badge = "Participant";
      if (index === 0) badge = "Today's Leader";
      if (index === 1) badge = "2nd Place";
      if (index === 2) badge = "3rd Place";

      return {
        name: `${athlete.firstname || athlete.firstName || 'Unknown'} ${athlete.lastname || athlete.lastName || ''}`.trim(),
        avatar: athlete.profile_medium || athlete.profile || '',
        totalDistance: parseFloat((performer.totalDistance / 1000).toFixed(2)),
        activityCount: performer.activityCount,
        badge: badge
      };
    });
    
    res.json({
      success: true,
      data: data
    });

  } catch (error) {
    console.error('❌ Top Performer Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;








// const express = require('express');
// const router = express.Router();
// const Activity = require('../models/Activity');
// const Athlete = require('../models/Athlete');

// /**
//  * @route   GET /api/leaderboard
//  * @desc    Get leaderboard rankings with dynamic calculation
//  * @access  Public (Protected by JWT in real flow)
//  */
// router.get('/leaderboard', async (req, res) => {
//   try {
//     const { period, type } = req.query;
    
//     // 1. Date Filter
//     const now = new Date();
//     let startDate = new Date(now); // Create a copy to avoid mutation issues
    
//     if (period === 'month') {
//       // Rolling 30 days from today
//       startDate.setDate(startDate.getDate() - 30);
//     } else {
//       // Default to a rolling 7 days from today
//       startDate.setDate(startDate.getDate() - 7);
//     }
//     // Set to the beginning of the start day for an accurate range
//     startDate.setHours(0, 0, 0, 0);
    
//     console.log(`[Leaderboard] Fetching: ${period || 'week'} | StartDate: ${startDate.toISOString()} | Type: ${type || 'All'}`);

//     // 2. Type Filter Setup
//     let typeFilter = {};
//     if (type && type !== 'All Activities') {
//       let stravaType = type;
//       if (type === 'Cycle Ride') stravaType = 'Ride';
//       typeFilter = { type: stravaType };
//     }

//     // 3. Aggregation Pipeline (Start from Athlete to include everyone)
//     const leaderboard = await Athlete.aggregate([
//       {
//         $lookup: {
//           from: 'activities',
//           let: { 
//             aid: '$stravaId', 
//             weight: { $ifNull: ['$weight', 70] } 
//           },
//           pipeline: [
//             { 
//               $match: {
//                 $expr: { $eq: ['$athleteId', '$$aid'] },
//                 // Use standard query syntax for external variables (more robust)
//                 startDate: { $gte: startDate },
//                 ...(Object.keys(typeFilter).length > 0 ? { type: typeFilter.type } : {})
//               }
//             },
//             {
//               $addFields: {
//                 durationMin: { $divide: ['$movingTime', 60] },
//                 activityFactor: {
//                   $switch: {
//                     branches: [
//                       { case: { $eq: ['$type', 'Walk'] }, then: 3.5 },
//                       { case: { $eq: ['$type', 'Run'] }, then: 9.8 },
//                       { case: { $eq: ['$type', 'Ride'] }, then: 6.8 },
//                       { case: { $eq: ['$type', 'Swim'] }, then: 8.3 },
//                       { case: { $eq: ['$type', 'Hike'] }, then: 7.5 },
//                       { case: { $eq: ['$type', 'WeightTraining'] }, then: 5 },
//                       { case: { $eq: ['$type', 'Workout'] }, then: 8 },
//                       { case: { $eq: ['$type', 'Yoga'] }, then: 2.5 }
//                     ],
//                     default: 6
//                   }
//                 }
//               }
//             },
//             {
//               $addFields: {
//                 // Calories = Factor * Weight * Time(min) / 60
//                 baseCalories: {
//                   $multiply: ['$activityFactor', '$$weight', { $divide: ['$durationMin', 60] }]
//                 },
//                 // Elevation Bonus: 0.01 * Weight * Elevation (for specific types)
//                 elevationCalories: {
//                   $cond: {
//                     if: { $in: ['$type', ['Walk', 'Run', 'Ride', 'Hike']] },
//                     then: { $multiply: [0.01, '$$weight', '$totalElevationGain'] },
//                     else: 0
//                   }
//                 }
//               }
//             },
//             {
//               $addFields: {
//                 totalActivityCalories: { $add: ['$baseCalories', '$elevationCalories'] }
//               }
//             }
//           ],
//           as: 'activities'
//         }
//       },
//       {
//         $addFields: {
//           totalDistance: { $sum: '$activities.distance' },
//           totalTime: { $sum: '$activities.movingTime' },
//           totalElevation: { $sum: '$activities.totalElevationGain' },
//           totalCalories: { $sum: '$activities.totalActivityCalories' }
//         }
//       },
//       { $sort: { totalDistance: -1 } }, // Sort by highest distance
//       {
//         $project: {
//           _id: 0,
//           athleteId: '$stravaId',
//           name: { $concat: [{ $ifNull: ['$firstName', 'User'] }, ' ', { $ifNull: ['$lastName', ''] }] },
//           profile: 1,
//           totalDistanceKM: { $round: [{ $divide: ['$totalDistance', 1000] }, 2] },
//           activityType: { $literal: type || 'All Activities' },
//           totalTimeMinutes: { $round: [{ $divide: ['$totalTime', 60] }, 0] },
//           totalElevationGainMeters: { $round: ['$totalElevation', 0] },
//           caloriesBurned: { $round: ['$totalCalories', 0] }
//         }
//       }
//     ]);

//     res.json({
//       success: true,
//       users: leaderboard
//     });

//   } catch (error) {
//     console.error('Leaderboard error:', error);
//     res.status(500).json({ success: false, message: 'Server Error' });
//   }
// });

// /**
//  * @route   GET /api/challenges
//  * @desc    Get active challenges
//  */
// router.get('/challenges', (req, res) => {
//   const challengesData = [
//     {
//       _id: "7012cf01f640edb179355d22",
//       title: "Weekly 5k Run",
//       description: "Complete a 5k run this week to earn a badge.",
//       type: "Run",
//       goalValue: 5000,
//       startDate: new Date().toISOString(),
//       endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
//       participantCount: 15,
//       image: "https://images.unsplash.com/photo-1552674605-469523170d9e?auto=format&fit=crop&w=800&q=80"
//     }
//   ];

//   res.json({
//     success: true,
//     data: challengesData
//   });
// });

// module.exports = router;