// // routes/leaderboard.js - COMPLETE UPDATED VERSION
// const express = require('express');
// const router = express.Router();
// const mongoose = require('mongoose');
// const Athlete = require('../models/Athlete');
// const Activity = require('../models/Activity');

// // Get leaderboard with historical data support
// router.get('/leaderboard', async (req, res) => {
//   try {
//     const { period = 'all', activityType = 'all' } = req.query;
    
//     console.log(`📊 Leaderboard request: period=${period}, activityType=${activityType}`);
    
//     // Get all athletes
//     const athletes = await Athlete.find({}).lean();
    
//     if (!athletes || athletes.length === 0) {
//       return res.json({ 
//         success: true, 
//         users: [], 
//         message: 'No athletes found' 
//       });
//     }
    
//     const leaderboardData = [];
//     const now = new Date();
    
//     for (const athlete of athletes) {
//       try {
//         // Build date filter based on period
//         let dateFilter = {};
        
//         if (period === '7days') {
//           // Last 7 days from today
//           const sevenDaysAgo = new Date(now);
//           sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
//           dateFilter = { startDate: { $gte: sevenDaysAgo } };
          
//         } else if (period === '30days') {
//           // Last 30 days from today
//           const thirtyDaysAgo = new Date(now);
//           thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
//           dateFilter = { startDate: { $gte: thirtyDaysAgo } };
          
//         } else if (period === 'all') {
//           // ALL historical data - from registration date to today
//           // Get athlete's earliest activity date or use registration date
//           const earliestActivity = await Activity.findOne(
//             { athleteId: athlete.stravaId.toString() },
//             { startDate: 1 }
//           ).sort({ startDate: 1 }).lean();
          
//           const registrationDate = earliestActivity?.startDate || 
//                                   athlete.stravaCreatedAt || 
//                                   athlete.createdAt || 
//                                   new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()); // 1 year ago
          
//           dateFilter = { startDate: { $gte: registrationDate, $lte: now } };
          
//           console.log(`📅 Athlete ${athlete.firstName || 'Unknown'}: Historical data from ${registrationDate.toISOString()} to ${now.toISOString()}`);
//         }
        
//         // Add activity type filter if not 'all'
//         let activityQuery = {
//           athleteId: athlete.stravaId ? athlete.stravaId.toString() : '',
//           ...dateFilter
//         };
        
//         if (activityType !== 'all') {
//           activityQuery.type = activityType;
//         }
        
//         // Get athlete's activities with filters
//         const activities = await Activity.find(activityQuery).lean();
        
//         // Calculate totals
//         const totals = calculateTotals(activities);
        
//         // Get athlete's registration date
//         const registrationDate = athlete.stravaCreatedAt || athlete.createdAt;
        
//         // Get last activity date
//         let lastActivityDate = null;
//         if (activities.length > 0) {
//           const latestActivity = activities.reduce((latest, current) => {
//             const currentDate = new Date(current.startDate);
//             const latestDate = latest ? new Date(latest.startDate) : new Date(0);
//             return currentDate > latestDate ? current : latest;
//           }, null);
//           lastActivityDate = latestActivity.startDate;
//         }
        
//         leaderboardData.push({
//           athleteId: athlete.stravaId,
//           name: `${athlete.firstName || ''} ${athlete.lastName || ''}`.trim() || 'Unknown',
//           firstName: athlete.firstName,
//           lastName: athlete.lastName,
//           profile: athlete.profile || athlete.profileMedium || '',
//           profile_medium: athlete.profileMedium || athlete.profile || '',
//           city: athlete.city || 'Unknown',
//           country: athlete.country || 'Unknown',
//           totalDistanceKM: totals.distance,
//           activityCount: totals.count,
//           caloriesBurned: totals.calories,
//           totalTimeMinutes: totals.movingTime,
//           totalElevationGainMeters: totals.elevation,
//           workoutDays: totals.uniqueDays,
//           activityType: activityType === 'all' ? 'All Activities' : activityType,
//           lastActivityDate: lastActivityDate,
//           registrationDate: registrationDate,
//           historicalData: period === 'all'
//         });
        
//       } catch (err) {
//         console.error(`Error processing athlete ${athlete.stravaId || athlete._id}:`, err.message);
//         // Continue with other athletes
//       }
//     }
    
//     // Filter out athletes with no data
//     const filteredData = leaderboardData.filter(user => user.activityCount > 0);
    
//     // Sort by distance (descending)
//     filteredData.sort((a, b) => b.totalDistanceKM - a.totalDistanceKM);
    
//     console.log(`✅ Generated leaderboard with ${filteredData.length} athletes`);
//     console.log(`📅 Period: ${period}, Activity Type: ${activityType}`);
//     console.log(`📊 Total athletes with data: ${filteredData.length}`);
    
//     res.json({
//       success: true,
//       period,
//       activityType,
//       historicalData: period === 'all',
//       users: filteredData,
//       totalAthletes: filteredData.length,
//       message: period === 'all' ? 
//         'Complete historical data from registration date to today' : 
//         `Data for last ${period === '7days' ? '7 days' : '30 days'}`
//     });
    
//   } catch (error) {
//     console.error('❌ Error in leaderboard endpoint:', error);
//     res.status(500).json({ 
//       success: false, 
//       error: error.message,
//       stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
//     });
//   }
// });

// // Helper function to calculate totals
// function calculateTotals(activities) {
//   if (!activities || activities.length === 0) {
//     return {
//       distance: 0,
//       count: 0,
//       calories: 0,
//       movingTime: 0,
//       elevation: 0,
//       uniqueDays: 0
//     };
//   }
  
//   const totals = activities.reduce((acc, activity) => {
//     acc.distance += activity.distance || 0;
//     acc.calories += activity.calories || 0;
//     acc.movingTime += activity.movingTime || 0;
//     acc.elevation += activity.totalElevationGain || 0;
//     return acc;
//   }, { distance: 0, calories: 0, movingTime: 0, elevation: 0 });
  
//   // Convert distance from meters to kilometers
//   totals.distance = totals.distance / 1000;
//   totals.elevation = totals.elevation;
  
//   // Convert moving time from seconds to minutes
//   totals.movingTime = Math.round(totals.movingTime / 60);
  
//   // Count unique activity days
//   const uniqueDays = new Set(
//     activities
//       .filter(a => a.startDate)
//       .map(a => new Date(a.startDate).toDateString())
//   ).size;
//   totals.uniqueDays = uniqueDays;
  
//   totals.count = activities.length;
  
//   return totals;
// }

// // Get available activity types
// router.get('/activity-types', async (req, res) => {
//   try {
//     const activityTypes = await Activity.distinct('type');
    
//     const filteredTypes = activityTypes
//       .filter(type => type && type.trim() !== '')
//       .sort();
    
//     res.json({
//       success: true,
//       activityTypes: filteredTypes
//     });
//   } catch (error) {
//     console.error('Error fetching activity types:', error);
//     res.status(500).json({ 
//       success: false, 
//       error: error.message 
//     });
//   }
// });

// module.exports = router;



































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
    const { period = 'week', type = 'all' } = req.query;
    
    console.log(`[Leaderboard] Request - Period: ${period}, Type: ${type}`);

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
    if (type && type !== 'All' && type !== 'all') {
      let stravaType = type;
      if (type === 'Cycle Ride') stravaType = 'Ride';
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
          activityType: { $literal: type === 'all' || !type ? 'All Activities' : type },
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
      activityType: type,
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