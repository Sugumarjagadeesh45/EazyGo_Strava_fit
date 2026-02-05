/**
 * iFit Club Backend Server
 * Strava Integration with REAL data only
 */
require('dotenv').config();

const app = require('./app');
const connectDB = require('./config/database');

const PORT = process.env.PORT || 5001;

console.log('');
console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║           iFit Club Backend - Strava Integration           ║');
console.log('║                    REAL DATA ONLY                          ║');
console.log('╚════════════════════════════════════════════════════════════╝');
console.log('');
console.log('📁 Environment:', process.env.NODE_ENV || 'development');
console.log('🔌 Port:', PORT);
console.log('🌐 Ngrok:', process.env.NGROK_URL || 'not configured');

let server;

const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDB();

    // Start server
    server = app.listen(PORT, () => {
      console.log('');
      console.log('✅ Server is running!');
      console.log('');
      console.log('🔗 URLs:');
      console.log(`   Local:   http://localhost:${PORT}`);
      console.log(`   Health:  http://localhost:${PORT}/api/health`);
      console.log(`   Debug:   http://localhost:${PORT}/api/auth/strava/debug`);
      if (process.env.NGROK_URL) {
        console.log(`   Ngrok:   ${process.env.NGROK_URL}`);
      }
      console.log('');
      console.log('📋 API Endpoints (REAL Strava Data):');
      console.log('   ┌─────────────────────────────────────────────────────────┐');
      console.log('   │ AUTH (No token required)                                │');
      console.log('   │   GET  /api/auth/strava           → Start OAuth         │');
      console.log('   │   GET  /api/auth/strava/callback  → OAuth callback      │');
      console.log('   │   GET  /api/auth/strava/debug     → Debug config        │');
      console.log('   ├─────────────────────────────────────────────────────────┤');
      console.log('   │ DATA (JWT token required)                               │');
      console.log('   │   GET  /api/athlete/:id/profile   → REAL profile        │');
      console.log('   │   GET  /api/athlete/:id/stats     → REAL statistics     │');
      console.log('   │   GET  /api/athlete/:id/activities→ REAL activities     │');
      console.log('   │   GET  /api/athlete/:id/weekly    → REAL weekly stats   │');
      console.log('   │   GET  /api/athlete/:id/monthly   → REAL monthly stats  │');
      console.log('   │   GET  /api/athlete/:id/history   → REAL history        │');
      console.log('   │   POST /api/athlete/:id/sync      → Sync from Strava    │');
      console.log('   └─────────────────────────────────────────────────────────┘');
      console.log('');
      console.log('💡 Mobile App: Open /api/auth/strava to connect with Strava');
      console.log('   After auth, app receives: ifitclub://auth-success?token=JWT&athleteId=ID');
      console.log('');
    });

    // Handle server errors
    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.log(`❌ Port ${PORT} is already in use`);
        console.log('💡 Try: kill -9 $(lsof -ti:' + PORT + ')');
        process.exit(1);
      }
      console.error('❌ Server error:', error.message);
    });

  } catch (err) {
    console.error('❌ Failed to start server:', err.message);
    process.exit(1);
  }
};

// Start the server
startServer();

// Graceful shutdown
const gracefulShutdown = (signal) => {
  console.log(`\n${signal} received. Shutting down gracefully...`);
  if (server) {
    server.close(() => {
      console.log('✅ Server closed');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.error('❌ Unhandled Rejection:', err.message);
  if (server) {
    server.close(() => process.exit(1));
  } else {
    process.exit(1);
  }
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err.message);
  process.exit(1);
});
