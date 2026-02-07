const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

const errorHandler = require('./middleware/errorHandler');
const userRoutes = require('./routes/userRoutes');

const app = express();

// Trust proxy (for rate limiting behind reverse proxy)
app.set('trust proxy', 1);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: 'Too many requests from this IP, please try again later.'
});

const corsOptions = {
  origin: [
    'http://localhost:3000', // React dev server
    'http://localhost:3001', // Alternative port
    'http://localhost:5173', // Vite dev server
    'https://357f-103-59-135-103.ngrok-free.app', // Your ngrok URL
    // Add other origins as needed
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'Access-Control-Allow-Headers',
    'Access-Control-Request-Headers',
    'Access-Control-Allow-Origin',
    'ngrok-skip-browser-warning'
  ],
  exposedHeaders: ['Content-Length', 'Content-Type'],
  maxAge: 86400, // 24 hours
};

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" } // Allows React to see the images
}));

app.use(cors(corsOptions));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const mongoose = require('mongoose');

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
const eventRoutes = require('./routes/eventRoutes');
app.use('/api', eventRoutes);


app.use('/api', limiter);

// Import routes
const stravaRoutes = require('./routes/stravaRoutes');
const redirectRoutes = require('./routes/redirectRoutes');
const appRoutes = require('./routes/appRoutes');
const leaderboardRoutes = require('./routes/leaderboard');

// Log route registration
console.log('🔧 Registering routes...');
console.log('   📌 Auth:');
console.log('      GET  /api/auth/strava');
console.log('      GET  /api/auth/strava/callback');
console.log('   📌 Athlete Data (REAL Strava):');
console.log('      GET  /api/athlete/:id/profile');
console.log('      GET  /api/athlete/:id/activities');
console.log('      GET  /api/athlete/:id/stats');
console.log('      GET  /api/athlete/:id/weekly');
console.log('      GET  /api/athlete/:id/monthly');
console.log('      GET  /api/athlete/:id/history');
console.log('   📌 Deep Link Redirects:');
console.log('      GET  /api/redirect/strava');
console.log('      GET  /api/redirect/app');
console.log('      GET  /api/redirect/urls');
console.log('      GET  /api/redirect/detect');
console.log('      GET  /api/redirect/stats');
console.log('      GET  /api/redirect/logs');
console.log('   📌 Mobile App Endpoints:');
console.log('      GET  /api/app/profile/:id');
console.log('      GET  /api/app/home/:id');
console.log('      GET  /api/app/activities/:id');
console.log('      GET  /api/app/leaderboard');
console.log('      GET  /api/app/challenges');

// Routes - Mount strava routes at /api root
app.use('/api', stravaRoutes);
app.use('/api/redirect', redirectRoutes);
app.use('/api/app', appRoutes);
app.use('/api', leaderboardRoutes);


// Health check endpoint
app.get('/api/health', (req, res) => {
  const stravaConfig = require('./config/strava');

  res.status(200).json({
    status: 'OK',
    message: 'iFit Club Backend - REAL Strava Data Only',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    ngrokUrl: process.env.NGROK_URL || 'not configured',
    stravaRedirectUri: stravaConfig.redirectUri,
    dataSource: 'REAL Strava API - No mock data',
    endpoints: {
      authentication: [
        'GET  /api/auth/strava                     - Redirect to Strava OAuth',
        'GET  /api/auth/strava/callback            - OAuth callback handler',
        'GET  /api/auth/strava/debug               - Debug OAuth config'
      ],
      athleteData: [
        'GET  /api/athlete/:id/profile             - REAL athlete profile',
        'GET  /api/athlete/:id/activities          - REAL activities list',
        'GET  /api/athlete/:id/stats               - REAL activity statistics',
        'GET  /api/athlete/:id/weekly              - REAL weekly summary',
        'GET  /api/athlete/:id/monthly             - REAL monthly summary',
        'GET  /api/athlete/:id/history             - REAL activity history'
      ],
      sync: [
        'POST /api/athlete/:id/sync                - Sync data from Strava',
        'GET  /api/athlete/:id/sync-history        - Get sync history'
      ],
      management: [
        'DELETE /api/athlete/:id/disconnect        - Disconnect Strava'
      ],
      redirect: [
        'GET  /api/redirect/strava                 - Strava deep link redirect',
        'GET  /api/redirect/app                    - Generic app redirect',
        'GET  /api/redirect/urls                   - Get redirect URLs (JSON)',
        'GET  /api/redirect/detect                 - Detect platform/device',
        'GET  /api/redirect/stats                  - Redirect statistics',
        'GET  /api/redirect/logs                   - Redirect logs'
      ],
      mobileApp: [
        'GET  /api/app/profile/:id                 - Profile with lifetime stats',
        'GET  /api/app/home/:id                    - Home screen data',
        'GET  /api/app/activities/:id              - Activities with month filter',
        'GET  /api/app/activities/:id/all          - All activities paginated',
        'GET  /api/app/leaderboard                 - Leaderboard (week/month)',
        'GET  /api/app/leaderboard/:id/rank        - User rank',
        'GET  /api/app/challenges                  - All challenges',
        'POST /api/app/challenges/:id/join         - Join a challenge',
        'GET  /api/app/challenges/:id/my           - My joined challenges'
      ]
    },
    note: 'All data endpoints require JWT token in Authorization header. Redirect endpoints are public.'
  });
});

// Welcome route
app.get('/', (req, res) => {
  res.json({
    message: '🚴 Welcome to iFit Club API',
    version: '1.0.0',
    documentation: 'Strava-only authentication. Click "Connect with Strava" to begin.',
    authEndpoint: '/api/auth/strava',
    healthCheck: '/api/health'
  });
});

// Error handling
app.use(errorHandler);


// =================== TEST ENDPOINTS FOR THUNDER CLIENT ===================
// Add these lines right before: // 404 handler

// 1. Public endpoint to see all database collections
app.get('/api/db/collections', async (req, res) => {
  try {
    console.log('🔍 Checking database collections...');
    
    if (!mongoose.connection.db) {
      return res.status(500).json({ error: 'Database not connected' });
    }
    
    const collections = await mongoose.connection.db.listCollections().toArray();
    
    console.log('\n📊 DATABASE COLLECTIONS:');
    console.log('='.repeat(80));
    collections.forEach((col, i) => {
      console.log(`${i + 1}. ${col.name}`);
    });
    console.log('='.repeat(80));
    
    res.json({
      success: true,
      collections: collections.map(c => c.name)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Get ALL users from ANY collection (NO AUTH NEEDED)
app.get('/api/db/all-users', async (req, res) => {
  try {
    console.log('🔍 Fetching ALL users from ALL collections...');
    
    const db = mongoose.connection.db;
    let allUsers = [];
    
    // Check common collection names
    const collectionsToCheck = ['athletes', 'Athlete', 'athlete', 'users', 'User'];
    
    for (const collectionName of collectionsToCheck) {
      try {
        const collection = db.collection(collectionName);
        const count = await collection.countDocuments();
        
        if (count > 0) {
          console.log(`✅ Found ${count} users in "${collectionName}" collection`);
          const users = await collection.find({}).toArray();
          allUsers = [...allUsers, ...users];
        }
      } catch (err) {
        // Collection doesn't exist, skip
      }
    }
    
    // Also check Mongoose models
    if (mongoose.models.Athlete) {
      const modelUsers = await mongoose.models.Athlete.find().lean();
      if (modelUsers.length > 0) {
        console.log(`✅ Found ${modelUsers.length} users in Athlete model`);
        allUsers = [...allUsers, ...modelUsers];
      }
    }
    
    // Log all users to console
    console.log('\n📋 ALL REGISTERED USERS FOUND:');
    console.log('='.repeat(80));
    
    if (allUsers.length === 0) {
      console.log('❌ NO USERS FOUND IN DATABASE!');
      console.log('The database is empty or users are stored in a different collection.');
    } else {
      allUsers.forEach((user, index) => {
        console.log(`\n👤 USER ${index + 1}:`);
        console.log(`   ID: ${user._id}`);
        console.log(`   Strava ID: ${user.stravaId || user.id || user.athleteId || 'N/A'}`);
        console.log(`   Name: ${user.firstName || user.firstname || 'Unknown'} ${user.lastName || user.lastname || ''}`);
        console.log(`   Profile: ${user.profile || user.profileMedium || user.profile_medium || 'No profile'}`);
        console.log(`   Location: ${user.city || 'N/A'}, ${user.country || 'N/A'}`);
        console.log(`   Created: ${user.createdAt || 'Unknown'}`);
        console.log(`   All fields: ${Object.keys(user).join(', ')}`);
      });
    }
    
    console.log('\n📊 SUMMARY:');
    console.log(`Total users found: ${allUsers.length}`);
    console.log('='.repeat(80));
    
    // Return clean user data
    const cleanUsers = allUsers.map(user => ({
      _id: user._id,
      id: user.stravaId || user.id || user.athleteId,
      firstName: user.firstName || user.firstname,
      lastName: user.lastName || user.lastname,
      username: user.username,
      profile: user.profile || user.profileMedium || user.profile_medium,
      city: user.city,
      state: user.state,
      country: user.country,
      gender: user.gender || user.sex,
      weight: user.weight,
      premium: user.premium,
      createdAt: user.createdAt,
      lastSynced: user.lastSyncAt || user.lastSynced
    }));
    
    res.json({
      success: true,
      totalUsers: cleanUsers.length,
      users: cleanUsers,
      message: 'Check server console for detailed user information'
    });
    
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 3. Create a test user (for testing if database is empty)
app.post('/api/db/create-test-user', async (req, res) => {
  try {
    console.log('📝 Creating test user...');
    
    const testUser = {
      stravaId: Date.now(),
      firstName: 'Test',
      lastName: 'User',
      username: 'test_user_' + Date.now(),
      city: 'Test City',
      country: 'Test Country',
      profile: 'https://via.placeholder.com/150',
      createdAt: new Date()
    };
    
    // Try to save using Athlete model
    let savedUser;
    if (mongoose.models.Athlete) {
      const Athlete = mongoose.models.Athlete;
      savedUser = new Athlete(testUser);
      await savedUser.save();
      console.log('✅ Test user saved via Athlete model');
    } else {
      // Save directly to collection
      const db = mongoose.connection.db;
      const result = await db.collection('athletes').insertOne(testUser);
      savedUser = { ...testUser, _id: result.insertedId };
      console.log('✅ Test user saved directly to athletes collection');
    }
    
    console.log('Test user created:', savedUser);
    
    res.json({
      success: true,
      message: 'Test user created successfully',
      user: savedUser
    });
    
  } catch (error) {
    console.error('Error creating test user:', error);
    res.status(500).json({ error: error.message });
  }
});

// 4. Direct MongoDB query endpoint
app.get('/api/db/query', async (req, res) => {
  try {
    const { collection = 'athletes', query = '{}', limit = 50 } = req.query;
    
    console.log(`🔍 Querying collection "${collection}"`);
    
    const db = mongoose.connection.db;
    const parsedQuery = JSON.parse(query || '{}');
    
    const documents = await db.collection(collection)
      .find(parsedQuery)
      .limit(parseInt(limit))
      .toArray();
    
    console.log(`Found ${documents.length} documents in ${collection}`);
    
    // Show first document structure
    if (documents.length > 0) {
      console.log('\n📄 First document structure:');
      console.log('='.repeat(80));
      const firstDoc = documents[0];
      Object.keys(firstDoc).forEach(key => {
        console.log(`  ${key}: ${JSON.stringify(firstDoc[key])}`);
      });
      console.log('='.repeat(80));
    }
    
    res.json({
      success: true,
      collection,
      total: documents.length,
      documents
    });
    
  } catch (error) {
    console.error('Query error:', error);
    res.status(500).json({ error: error.message });
  }
});



console.log('   📌 Admin User Management:');
console.log('      GET  /api/admin/users           → All users with pagination');
console.log('      GET  /api/admin/statistics      → User statistics');
console.log('      GET  /api/admin/user/:id        → Detailed user profile');
console.log('      DELETE /api/admin/user/:id      → Delete user (admin)');
console.log('      GET  /api/admin/export          → Export all user data');

// Add to routes:
app.use('/api', userRoutes);


// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.originalUrl,
    method: req.method,
    availableRoutes: [
      'GET  /',
      'GET  /api/health',
      'GET  /api/auth/strava',
      'GET  /api/auth/strava/callback',
      'GET  /api/auth/strava/debug',
      'GET  /api/athlete/:id/profile',
      'GET  /api/athlete/:id/activities',
      'GET  /api/athlete/:id/stats',
      'GET  /api/athlete/:id/weekly',
      'GET  /api/athlete/:id/monthly',
      'GET  /api/athlete/:id/history',
      'POST /api/athlete/:id/sync',
      'GET  /api/athlete/:id/sync-history',
      'DELETE /api/athlete/:id/disconnect',
      'GET  /api/redirect/strava',
      'GET  /api/redirect/app',
      'GET  /api/redirect/urls',
      'GET  /api/redirect/detect',
      'GET  /api/redirect/stats',
      'GET  /api/redirect/logs',
      'GET  /api/redirect/health',
      'GET  /api/app/profile/:id',
      'GET  /api/app/home/:id',
      'GET  /api/app/activities/:id',
      'GET  /api/app/activities/:id/all',
      'GET  /api/app/leaderboard',
      'GET  /api/app/leaderboard/:id/rank',
      'GET  /api/app/challenges',
      'POST /api/app/challenges/:id/join',
      'GET  /api/app/challenges/:id/my'
    ]
  });
});

module.exports = app;
