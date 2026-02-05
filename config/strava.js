/**
 * Strava OAuth Configuration
 * Supports dynamic ngrok URL for local development
 */

const getRedirectUri = () => {
  // In development with ngrok, use NGROK_URL
  if (process.env.NODE_ENV === 'development' && process.env.NGROK_URL) {
    return `${process.env.NGROK_URL}/api/auth/strava/callback`;
  }
  // Otherwise use explicit STRAVA_REDIRECT_URI
  return process.env.STRAVA_REDIRECT_URI;
};

const config = {
  clientId: process.env.STRAVA_CLIENT_ID,
  clientSecret: process.env.STRAVA_CLIENT_SECRET,
  accessToken: process.env.STRAVA_ACCESS_TOKEN,
  refreshToken: process.env.STRAVA_REFRESH_TOKEN,
  redirectUri: getRedirectUri(),
  apiUrl: process.env.STRAVA_API_URL || 'https://www.strava.com/api/v3',
  authUrl: 'https://www.strava.com/oauth',
  scopes: 'read,read_all,profile:read_all,activity:read,activity:read_all',
  frontendUrl: process.env.FRONTEND_URL || 'ifitclub://auth-success',
};

// Validate required config on module load
const validateConfig = () => {
  const required = ['clientId', 'clientSecret', 'redirectUri'];
  const missing = required.filter(key => !config[key]);

  if (missing.length > 0) {
    console.error('❌ Missing Strava config:', missing.join(', '));
  } else if (process.env.NODE_ENV === 'development') {
    console.log('✅ Strava config loaded');
    console.log('   Redirect URI:', config.redirectUri);
  }
};

validateConfig();

module.exports = config;