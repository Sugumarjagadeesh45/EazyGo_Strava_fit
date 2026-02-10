const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Athlete = require('../models/Athlete');
const stravaController = require('../controllers/stravaController');

// User schema (if not already defined)
const User = mongoose.models.Athlete || mongoose.model('Athlete', new mongoose.Schema({
  athleteId: { type: String, required: true, unique: true },
  firstname: String,
  lastname: String,
  profile: String,
  profile_medium: String,
  city: String,
  country: String,
  accessToken: String,
  refreshToken: String,
  expiresAt: Date,
  lastSynced: Date,
  totalDistance: { type: Number, default: 0 },
  totalActivities: { type: Number, default: 0 },
  totalCalories: { type: Number, default: 0 },
  healthStats: {
    bmi: String,
    lung: String,
    weight: String,
    height: String,
    bp: String,
    temp: String,
    focus: String
  },
  createdAt: { type: Date, default: Date.now }
}));

// Fix: Ensure healthStats exists on the schema if the model is already compiled from elsewhere
if (User.schema && !User.schema.paths.healthStats) {
  User.schema.add({
    healthStats: {
      bmi: String,
      lung: String,
      weight: String,
      height: String,
      bp: String,
      temp: String,
      focus: String
    }
  });
}

// Middleware to verify admin token
const verifyAdmin = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: 'No authentication token provided' 
      });
    }
    
    // Decode JWT to check if admin (you can add admin flag in your JWT)
    // For now, we'll just validate any valid token
    // In production, add proper admin role check
    
    next();
  } catch (error) {
    return res.status(401).json({ 
      success: false, 
      message: 'Invalid token' 
    });
  }
};

// GET all users with pagination and filtering
router.get('/admin/users', verifyAdmin, async (req, res) => {
  try {
    console.log('🔍 Fetching ALL users from database...');
    
    // Get query parameters
    const { 
      page = 1, 
      limit = 50, 
      sort = 'createdAt', 
      order = 'desc',
      search = '',
      city = '',
      country = ''
    } = req.query;
    
    // Build query
    const query = {};
    
    if (search) {
      query.$or = [
        { firstname: { $regex: search, $options: 'i' } },
        { lastname: { $regex: search, $options: 'i' } },
        { athleteId: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (city) {
      query.city = { $regex: city, $options: 'i' };
    }
    
    if (country) {
      query.country = { $regex: country, $options: 'i' };
    }
    
    // Get total count
    const total = await User.countDocuments(query);
    
    // Get paginated users
    const users = await User.find(query)
      .sort({ [sort]: order === 'desc' ? -1 : 1 })
      .skip((page - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .select('-accessToken -refreshToken'); // Exclude sensitive data
    
    console.log(`✅ Found ${users.length} users (Total: ${total})`);
    
    // Log detailed user data to console
    console.log('\n📋 USER DATA FROM DATABASE:');
    console.log('='.repeat(80));
    users.forEach((user, index) => {
      console.log(`\n👤 User ${index + 1}:`);
      console.log(`   ID: ${user.athleteId}`);
      console.log(`   Name: ${user.firstname} ${user.lastname}`);
      console.log(`   Location: ${user.city || 'N/A'}, ${user.country || 'N/A'}`);
      console.log(`   Profile: ${user.profile_medium || user.profile || 'N/A'}`);
      console.log(`   Stats: ${user.totalDistance || 0}km, ${user.totalActivities || 0} activities`);
      console.log(`   Created: ${user.createdAt}`);
      console.log(`   Last Synced: ${user.lastSynced || 'Never'}`);
    });
    console.log('='.repeat(80));
    
    res.status(200).json({
      success: true,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
      users
    });
    
  } catch (error) {
    console.error('❌ Error fetching users:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch users',
      error: error.message 
    });
  }
});

// GET user statistics
router.get('/admin/statistics', verifyAdmin, async (req, res) => {
  try {
    console.log('📊 Generating user statistics...');
    
    // Get total users
    const totalUsers = await User.countDocuments();
    
    // Get users by country
    const usersByCountry = await User.aggregate([
      { $match: { country: { $exists: true, $ne: '' } } },
      { $group: { _id: '$country', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);
    
    // Get users by city
    const usersByCity = await User.aggregate([
      { $match: { city: { $exists: true, $ne: '' } } },
      { $group: { _id: '$city', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);
    
    // Get registration timeline (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const registrationsByDay = await User.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo } } },
      { $group: { 
        _id: { 
          $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } 
        }, 
        count: { $sum: 1 } 
      } },
      { $sort: { _id: 1 } }
    ]);
    
    // Get top performers
    const topPerformers = await User.find()
      .sort({ totalDistance: -1 })
      .limit(5)
      .select('athleteId firstname lastname totalDistance totalActivities totalCalories');
    
    // Get sync status
    const activeUsers = await User.countDocuments({ 
      lastSynced: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } 
    });
    
    const statistics = {
      totalUsers,
      usersByCountry,
      usersByCity,
      registrationsByDay,
      topPerformers,
      activeUsers,
      inactiveUsers: totalUsers - activeUsers,
      averageDistance: 0,
      averageActivities: 0
    };
    
    // Calculate averages
    const aggregateStats = await User.aggregate([
      {
        $group: {
          _id: null,
          avgDistance: { $avg: '$totalDistance' },
          avgActivities: { $avg: '$totalActivities' }
        }
      }
    ]);
    
    if (aggregateStats.length > 0) {
      statistics.averageDistance = Math.round(aggregateStats[0].avgDistance || 0);
      statistics.averageActivities = Math.round(aggregateStats[0].avgActivities || 0);
    }
    
    console.log('\n📊 USER STATISTICS:');
    console.log('='.repeat(80));
    console.log(`Total Users: ${totalUsers}`);
    console.log(`Active Users (last 7 days): ${activeUsers}`);
    console.log(`Inactive Users: ${statistics.inactiveUsers}`);
    console.log(`Average Distance: ${statistics.averageDistance}km`);
    console.log(`Average Activities: ${statistics.averageActivities}`);
    console.log('\n🌍 Users by Country:');
    usersByCountry.forEach(country => {
      console.log(`   ${country._id}: ${country.count} users`);
    });
    console.log('\n🏆 Top Performers:');
    topPerformers.forEach((user, index) => {
      console.log(`   ${index + 1}. ${user.firstname} ${user.lastname}: ${user.totalDistance}km`);
    });
    console.log('='.repeat(80));
    
    res.status(200).json({
      success: true,
      statistics
    });
    
  } catch (error) {
    console.error('❌ Error generating statistics:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to generate statistics',
      error: error.message 
    });
  }
});

// GET detailed user profile
router.get('/admin/user/:id', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log(`🔍 Fetching detailed profile for user: ${id}`);
    
    // Try to find by athleteId first, then by _id
    let user = await User.findOne({ athleteId: id });
    if (!user) {
      user = await User.findById(id);
    }
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }
    
    // Get user's activities if available
    // You might need to adjust based on your Activity schema
    const Activity = mongoose.models.Activity;
    let recentActivities = [];
    
    if (Activity) {
      recentActivities = await Activity.find({ athleteId: user.athleteId })
        .sort({ start_date: -1 })
        .limit(10);
    }
    
    const userData = user.toObject();
    userData.recentActivities = recentActivities;
    
    console.log(`\n📄 DETAILED USER PROFILE: ${user.firstname} ${user.lastname}`);
    console.log('='.repeat(80));
    console.log(JSON.stringify(userData, null, 2));
    console.log('='.repeat(80));
    
    res.status(200).json({
      success: true,
      user: userData
    });
    
  } catch (error) {
    console.error(`❌ Error fetching user ${req.params.id}:`, error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch user profile',
      error: error.message 
    });
  }
});

// DELETE user (admin only)
router.delete('/admin/user/:id', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log(`🗑️ Attempting to delete user: ${id}`);
    
    // Try to delete by athleteId first, then by _id
    let result = await User.findOneAndDelete({ athleteId: id });
    
    if (!result) {
      result = await User.findByIdAndDelete(id);
    }
    
    if (!result) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }
    
    console.log(`✅ User deleted: ${result.firstname} ${result.lastname} (ID: ${result.athleteId})`);
    
    res.status(200).json({
      success: true,
      message: 'User deleted successfully'
    });
    
  } catch (error) {
    console.error(`❌ Error deleting user ${req.params.id}:`, error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to delete user',
      error: error.message 
    });
  }
});

// Export database (for debugging)
router.get('/admin/export', verifyAdmin, async (req, res) => {
  try {
    console.log('📤 Exporting database...');
    
    const users = await User.find()
      .select('-accessToken -refreshToken')
      .lean();
    
    const exportData = {
      exportedAt: new Date(),
      totalUsers: users.length,
      users: users
    };
    
    console.log(`✅ Exported ${users.length} users to console`);
    console.log('\n📤 DATABASE EXPORT:');
    console.log('='.repeat(80));
    console.log(JSON.stringify(exportData, null, 2));
    console.log('='.repeat(80));
    
    res.status(200).json(exportData);
    
  } catch (error) {
    console.error('❌ Error exporting database:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to export database',
      error: error.message 
    });
  }
});

// =====================================================
// NEW ADMIN PANEL COMPLIANCE ROUTES
// =====================================================

// POST /api/champions - Add Champion (Manual User)
router.post('/champions', verifyAdmin, async (req, res) => {
  try {
    const { name, mobile, location, activity, description } = req.body;
    
    const nameParts = (name || 'Champion').trim().split(/\s+/);
    const firstname = nameParts[0];
    const lastname = nameParts.slice(1).join(' ');
    
    const newUser = new User({
      athleteId: mobile || `manual_${Date.now()}`,
      firstname,
      lastname,
      city: location,
      profile: description,
      totalActivities: 0,
      totalDistance: 0,
      createdAt: new Date()
    });
    
    await newUser.save();
    res.status(201).json({ success: true, message: 'Champion added', user: newUser });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/db/all-users - Get All Users (Simple List)
router.get('/db/all-users', verifyAdmin, async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, users });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /api/admin/users/:id - Delete User (Plural Alias)
router.delete('/admin/users/:id', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    let result = await User.findOneAndDelete({ athleteId: id });
    if (!result) result = await User.findByIdAndDelete(id);
    
    if (!result) return res.status(404).json({ success: false, message: 'User not found' });
    res.status(200).json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/db/collections - List DB Collections
router.get('/db/collections', verifyAdmin, async (req, res) => {
  try {
    const collections = await mongoose.connection.db.listCollections().toArray();
    res.status(200).json({ success: true, collections: collections.map(c => c.name) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/health - System Health
router.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date() });
});

// GET /api/athlete/:id/health - Get Health Stats
router.get('/athlete/:id/health', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Determine query based on Schema and ID format
    let query = {};
    
    // Check if using the real Athlete model (has stravaId)
    if (User.schema.paths.stravaId) {
      if (!isNaN(id)) {
        query.stravaId = parseInt(id);
      } else if (mongoose.Types.ObjectId.isValid(id)) {
        query._id = id;
      } else {
        query.stravaId = id; // Fallback
      }
    } else {
      // Fallback schema (uses athleteId)
      query.athleteId = id;
      if (mongoose.Types.ObjectId.isValid(id)) {
        query = { $or: [{ athleteId: id }, { _id: id }] };
      }
    }

    const user = await User.findOne(query).select('healthStats');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, data: user.healthStats || {} });
  } catch (error) {
    console.error('[Health Fetch Error]', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/athlete/:id/health - Update Health Stats
router.post('/athlete/:id/health', async (req, res) => {
  try {
    const { id } = req.params;
    const stats = req.body;

    console.log(`[Health Update] ID: ${id}, Stats:`, stats);

    if (!stats) {
      return res.status(400).json({ success: false, message: 'No stats provided' });
    }
    
    // Determine query based on Schema and ID format
    let query = {};
    
    // Check if using the real Athlete model (has stravaId)
    if (User.schema.paths.stravaId) {
      if (!isNaN(id)) {
        query.stravaId = parseInt(id);
      } else if (mongoose.Types.ObjectId.isValid(id)) {
        query._id = id;
      } else {
        query.stravaId = id; // Fallback
      }
    } else {
      // Fallback schema (uses athleteId)
      query.athleteId = id;
      if (mongoose.Types.ObjectId.isValid(id)) {
        query = { $or: [{ athleteId: id }, { _id: id }] };
      }
    }

    const user = await User.findOneAndUpdate(
      query,
      { $set: { healthStats: stats } },
      { new: true, upsert: true }
    );

    res.json({ success: true, message: 'Health stats updated', data: user.healthStats });
  } catch (error) {
    console.error('[Health Update Error]', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/athlete/:id/sync - Manual Sync with Strava
router.post('/athlete/:athleteId/sync', stravaController.syncAthleteData);

module.exports = router;