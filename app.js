const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const errorHandler = require('./middleware/errorHandler');

const app = express();

// Trust proxy (for rate limiting behind reverse proxy)
app.set('trust proxy', 1);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: 'Too many requests from this IP, please try again later.'
});

// CORS configuration for mobile apps
const corsOptions = {
  origin: process.env.SOCKET_CORS_ORIGIN === '*' ? '*' : (process.env.SOCKET_CORS_ORIGIN || '').split(','),
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};

// Middleware
app.use(helmet({
  contentSecurityPolicy: false // Disable for deep link redirect pages
}));
app.use(cors(corsOptions));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
