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

// Routes - Mount strava routes at /api root
app.use('/api', stravaRoutes);

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
      ]
    },
    note: 'All data endpoints require JWT token in Authorization header'
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
      'DELETE /api/athlete/:id/disconnect'
    ]
  });
});

module.exports = app;
