/**
 * Mobile Deep Link Redirect Configuration
 * Configures app deep links and store fallback URLs
 */

const config = {
  // App scheme for deep linking
  appScheme: process.env.APP_SCHEME || 'ifitclub',

  // Android package name
  androidPackage: process.env.ANDROID_PACKAGE || 'com.ifitclub.erode',

  // iOS bundle identifier
  iosBundleId: process.env.IOS_BUNDLE_ID || 'com.ifitclub.erode',

  // Store URLs
  playStoreUrl: process.env.PLAY_STORE_URL || 'https://play.google.com/store/apps/details?id=com.ifitclub.erode',
  appStoreUrl: process.env.APP_STORE_URL || 'https://apps.apple.com/app/ifit-club/id123456789',

  // Web fallback URL
  webFallbackUrl: process.env.WEB_FALLBACK_URL || 'https://ifitclub.com',

  // Deep link paths
  deepLinks: {
    strava: {
      path: 'strava-connect',
      description: 'Strava OAuth connection flow'
    },
    activity: {
      path: 'activity',
      description: 'View specific activity'
    },
    profile: {
      path: 'profile',
      description: 'View user profile'
    },
    dashboard: {
      path: 'dashboard',
      description: 'Main dashboard'
    }
  },

  // Timeout for app open attempt (ms)
  appOpenTimeout: parseInt(process.env.APP_OPEN_TIMEOUT) || 2000,

  // Maximum retries for app open
  maxRetries: parseInt(process.env.APP_OPEN_RETRIES) || 3,

  // Enable redirect logging
  enableLogging: process.env.REDIRECT_LOGGING !== 'false'
};

module.exports = config;
