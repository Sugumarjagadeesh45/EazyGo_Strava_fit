const axios = require('axios');
const stravaConfig = require('../config/strava');

/**
 * Custom error class for Strava API errors
 */
class StravaError extends Error {
  constructor(message, code, statusCode = 500) {
    super(message);
    this.name = 'StravaError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

/**
 * Error codes for OAuth flow
 */
const ERROR_CODES = {
  INVALID_CODE: 'INVALID_CODE',
  CODE_EXPIRED: 'CODE_EXPIRED',
  INVALID_REDIRECT_URI: 'INVALID_REDIRECT_URI',
  RATE_LIMITED: 'RATE_LIMITED',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  NETWORK_ERROR: 'NETWORK_ERROR',
  UNKNOWN: 'UNKNOWN'
};

class StravaService {
  constructor() {
    this.baseURL = stravaConfig.apiUrl || 'https://www.strava.com/api/v3';
    this.authURL = stravaConfig.authUrl || 'https://www.strava.com/oauth';
    this.scopes = stravaConfig.scopes;
  }

  // Get current config (allows for dynamic ngrok URL changes)
  getConfig() {
    return {
      clientId: stravaConfig.clientId,
      clientSecret: stravaConfig.clientSecret,
      redirectUri: stravaConfig.redirectUri,
      frontendUrl: stravaConfig.frontendUrl
    };
  }

  // Generate Strava OAuth authorization URL
  getAuthorizationUrl(state = '') {
    const config = this.getConfig();
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      scope: this.scopes,
      ...(state && { state })
    });
    return `${this.authURL}/authorize?${params.toString()}`;
  }

  // Parse Strava API error response
  parseStravaError(error) {
    const response = error.response;
    const data = response?.data;
    const status = response?.status;

    // Network errors
    if (!response) {
      return new StravaError('Network error connecting to Strava', ERROR_CODES.NETWORK_ERROR, 503);
    }

    // Rate limiting
    if (status === 429) {
      return new StravaError('Strava API rate limit exceeded. Please try again later.', ERROR_CODES.RATE_LIMITED, 429);
    }

    // OAuth-specific errors
    if (data?.error) {
      switch (data.error) {
        case 'invalid_grant':
          if (data.error_description?.includes('expired')) {
            return new StravaError('Authorization code has expired. Please try again.', ERROR_CODES.CODE_EXPIRED, 400);
          }
          return new StravaError('Invalid authorization code.', ERROR_CODES.INVALID_CODE, 400);

        case 'invalid_request':
          if (data.error_description?.includes('redirect_uri')) {
            return new StravaError('Invalid redirect URI. Check your Strava app settings.', ERROR_CODES.INVALID_REDIRECT_URI, 400);
          }
          return new StravaError(data.error_description || 'Invalid request', ERROR_CODES.UNKNOWN, 400);

        case 'unauthorized':
          return new StravaError('Unauthorized access', ERROR_CODES.UNAUTHORIZED, 401);

        default:
          return new StravaError(data.message || data.error_description || 'Strava API error', ERROR_CODES.UNKNOWN, status);
      }
    }

    // Generic errors
    if (status === 401) {
      return new StravaError('Access token expired or invalid', ERROR_CODES.TOKEN_EXPIRED, 401);
    }

    return new StravaError(data?.message || error.message || 'Unknown Strava error', ERROR_CODES.UNKNOWN, status || 500);
  }

  // Exchange authorization code for tokens
  async exchangeCodeForTokens(code) {
    const config = this.getConfig();

    console.log('📤 Exchanging code for tokens...');
    console.log('   Redirect URI:', config.redirectUri);

    try {
      const response = await axios.post(`${this.authURL}/token`, {
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code: code,
        grant_type: 'authorization_code'
      });

      console.log('✅ Token exchange successful');

      return {
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token,
        expiresAt: new Date(response.data.expires_at * 1000),
        tokenType: response.data.token_type,
        athlete: response.data.athlete
      };
    } catch (error) {
      console.error('❌ Token exchange error:', error.response?.data || error.message);
      throw this.parseStravaError(error);
    }
  }

  // Refresh access token
  async refreshAccessToken(refreshToken) {
    const config = this.getConfig();

    try {
      const response = await axios.post(`${this.authURL}/token`, {
        client_id: config.clientId,
        client_secret: config.clientSecret,
        grant_type: 'refresh_token',
        refresh_token: refreshToken
      });

      return {
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token,
        expiresAt: new Date(response.data.expires_at * 1000),
        tokenType: response.data.token_type
      };
    } catch (error) {
      console.error('❌ Token refresh error:', error.response?.data || error.message);
      throw this.parseStravaError(error);
    }
  }

  // Get authenticated athlete profile
  async getAthlete(accessToken) {
    try {
      const response = await axios.get(`${this.baseURL}/athlete`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      return response.data;
    } catch (error) {
      throw this.parseStravaError(error);
    }
  }

  // Get athlete activities with pagination
  async getAthleteActivities(accessToken, params = {}) {
    try {
      const response = await axios.get(`${this.baseURL}/athlete/activities`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: {
          per_page: params.per_page || 200,
          page: params.page || 1,
          before: params.before,
          after: params.after
        }
      });
      return response.data;
    } catch (error) {
      throw this.parseStravaError(error);
    }
  }

  // Get all activities with automatic pagination
  async getAllActivities(accessToken) {
    const allActivities = [];
    let page = 1;
    const perPage = 200;

    console.log('📥 Fetching all activities...');

    while (true) {
      try {
        const activities = await this.getAthleteActivities(accessToken, {
          page,
          per_page: perPage
        });

        if (activities.length === 0) break;

        allActivities.push(...activities);
        console.log(`   Page ${page}: ${activities.length} activities (total: ${allActivities.length})`);

        if (activities.length < perPage) break;

        page++;

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        // If rate limited, wait and retry
        if (error.code === ERROR_CODES.RATE_LIMITED) {
          console.log('⏳ Rate limited, waiting 60 seconds...');
          await new Promise(resolve => setTimeout(resolve, 60000));
          continue;
        }
        throw error;
      }
    }

    console.log(`✅ Fetched ${allActivities.length} total activities`);
    return allActivities;
  }

  // Get single activity details
  async getActivity(accessToken, activityId) {
    try {
      const response = await axios.get(`${this.baseURL}/activities/${activityId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: { include_all_efforts: true }
      });
      return response.data;
    } catch (error) {
      throw this.parseStravaError(error);
    }
  }

  // Get athlete stats
  async getAthleteStats(accessToken, athleteId) {
    try {
      const response = await axios.get(`${this.baseURL}/athletes/${athleteId}/stats`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      return response.data;
    } catch (error) {
      throw this.parseStravaError(error);
    }
  }

  // Deauthorize (disconnect Strava)
  async deauthorize(accessToken) {
    try {
      const response = await axios.post(`${this.authURL}/deauthorize`, null, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      return response.data;
    } catch (error) {
      throw this.parseStravaError(error);
    }
  }

  // Get activity streams (GPS data, heart rate, etc.)
  async getActivityStreams(accessToken, activityId, keys = ['latlng', 'altitude', 'time', 'distance', 'heartrate']) {
    try {
      const response = await axios.get(`${this.baseURL}/activities/${activityId}/streams`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: {
          keys: keys.join(','),
          key_by_type: true
        }
      });
      return response.data;
    } catch (error) {
      throw this.parseStravaError(error);
    }
  }

  // Get athlete's gear
  async getGear(accessToken, gearId) {
    try {
      const response = await axios.get(`${this.baseURL}/gear/${gearId}`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      return response.data;
    } catch (error) {
      throw this.parseStravaError(error);
    }
  }

  // Get activity laps
  async getActivityLaps(accessToken, activityId) {
    try {
      const response = await axios.get(`${this.baseURL}/activities/${activityId}/laps`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      return response.data;
    } catch (error) {
      throw this.parseStravaError(error);
    }
  }

  // Get activity zones (heart rate, power zones)
  async getActivityZones(accessToken, activityId) {
    try {
      const response = await axios.get(`${this.baseURL}/activities/${activityId}/zones`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      return response.data;
    } catch (error) {
      throw this.parseStravaError(error);
    }
  }

  // Fetch recent activities (last N days)
  async getRecentActivities(accessToken, days = 7) {
    const after = Math.floor((Date.now() - days * 24 * 60 * 60 * 1000) / 1000);
    try {
      const response = await axios.get(`${this.baseURL}/athlete/activities`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: {
          after,
          per_page: 200
        }
      });
      return response.data;
    } catch (error) {
      throw this.parseStravaError(error);
    }
  }
}

// Export singleton instance and error utilities
const stravaService = new StravaService();
module.exports = stravaService;
module.exports.StravaError = StravaError;
module.exports.ERROR_CODES = ERROR_CODES;
