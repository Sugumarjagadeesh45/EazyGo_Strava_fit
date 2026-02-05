const crypto = require('crypto');
const redirectConfig = require('../config/redirect');

/**
 * Platform types
 */
const PLATFORMS = {
  ANDROID: 'android',
  IOS: 'ios',
  WEB: 'web',
  UNKNOWN: 'unknown'
};

/**
 * Redirect targets
 */
const REDIRECT_TARGETS = {
  APP_DEEP_LINK: 'app_deep_link',
  PLAY_STORE: 'play_store',
  APP_STORE: 'app_store',
  WEB_FALLBACK: 'web_fallback'
};

class RedirectService {
  constructor() {
    this.config = redirectConfig;
  }

  /**
   * Generate unique request ID
   */
  generateRequestId() {
    return crypto.randomUUID();
  }

  /**
   * Detect platform from user agent string
   * @param {string} userAgent - User agent string from request headers
   * @returns {string} - Platform identifier
   */
  detectPlatform(userAgent) {
    if (!userAgent) {
      return PLATFORMS.UNKNOWN;
    }

    const ua = userAgent.toLowerCase();

    // Check for Android
    if (ua.includes('android')) {
      return PLATFORMS.ANDROID;
    }

    // Check for iOS (iPhone, iPad, iPod)
    if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ipod')) {
      return PLATFORMS.IOS;
    }

    // Check for iOS Safari on macOS (could be iOS device reporting as Mac)
    if (ua.includes('macintosh') && 'ontouchend' in (typeof document !== 'undefined' ? document : {})) {
      return PLATFORMS.IOS;
    }

    // Default to web for desktop browsers
    if (ua.includes('mozilla') || ua.includes('chrome') || ua.includes('safari') || ua.includes('firefox') || ua.includes('edge')) {
      return PLATFORMS.WEB;
    }

    return PLATFORMS.UNKNOWN;
  }

  /**
   * Parse detailed device information from user agent
   * @param {string} userAgent - User agent string
   * @returns {Object} - Device information
   */
  parseDeviceInfo(userAgent) {
    if (!userAgent) {
      return {
        userAgent: 'Unknown',
        deviceType: 'unknown',
        osVersion: null,
        browser: null,
        browserVersion: null
      };
    }

    const ua = userAgent.toLowerCase();
    const info = {
      userAgent: userAgent.substring(0, 500), // Limit length for storage
      deviceType: 'unknown',
      osVersion: null,
      browser: null,
      browserVersion: null
    };

    // Detect device type
    if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
      info.deviceType = 'mobile';
    } else if (ua.includes('tablet') || ua.includes('ipad')) {
      info.deviceType = 'tablet';
    } else {
      info.deviceType = 'desktop';
    }

    // Extract OS version
    const androidMatch = ua.match(/android\s+([\d.]+)/i);
    if (androidMatch) {
      info.osVersion = `Android ${androidMatch[1]}`;
    }

    const iosMatch = ua.match(/(?:iphone|ipad|ipod).*?os\s+([\d_]+)/i);
    if (iosMatch) {
      info.osVersion = `iOS ${iosMatch[1].replace(/_/g, '.')}`;
    }

    // Extract browser info
    if (ua.includes('chrome') && !ua.includes('edg')) {
      info.browser = 'Chrome';
      const match = ua.match(/chrome\/([\d.]+)/i);
      if (match) info.browserVersion = match[1];
    } else if (ua.includes('safari') && !ua.includes('chrome')) {
      info.browser = 'Safari';
      const match = ua.match(/version\/([\d.]+)/i);
      if (match) info.browserVersion = match[1];
    } else if (ua.includes('firefox')) {
      info.browser = 'Firefox';
      const match = ua.match(/firefox\/([\d.]+)/i);
      if (match) info.browserVersion = match[1];
    } else if (ua.includes('edg')) {
      info.browser = 'Edge';
      const match = ua.match(/edg\/([\d.]+)/i);
      if (match) info.browserVersion = match[1];
    }

    return info;
  }

  /**
   * Get client IP address from request
   * @param {Object} req - Express request object
   * @returns {string} - IP address
   */
  getClientIp(req) {
    // Check for forwarded headers (behind proxy/load balancer)
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
      // x-forwarded-for can contain multiple IPs, take the first one
      return forwarded.split(',')[0].trim();
    }

    // Check for real IP header (nginx)
    const realIp = req.headers['x-real-ip'];
    if (realIp) {
      return realIp;
    }

    // Fallback to direct connection IP
    return req.ip || req.connection?.remoteAddress || 'unknown';
  }

  /**
   * Build deep link URL
   * @param {string} path - Deep link path (e.g., 'strava-connect')
   * @param {Object} params - Query parameters to include
   * @returns {string} - Complete deep link URL
   */
  buildDeepLink(path, params = {}) {
    const scheme = this.config.appScheme;
    const queryString = this.buildQueryString(params);

    return `${scheme}://${path}${queryString ? '?' + queryString : ''}`;
  }

  /**
   * Build Android Intent URL for better Chrome support
   * @param {string} path - Deep link path
   * @param {Object} params - Query parameters
   * @returns {string} - Android intent URL
   */
  buildAndroidIntent(path, params = {}) {
    const queryString = this.buildQueryString(params);
    const fullPath = `${path}${queryString ? '?' + queryString : ''}`;

    return `intent://${fullPath}#Intent;scheme=${this.config.appScheme};package=${this.config.androidPackage};end`;
  }

  /**
   * Build query string from parameters object
   * @param {Object} params - Parameters object
   * @returns {string} - URL-encoded query string
   */
  buildQueryString(params) {
    if (!params || Object.keys(params).length === 0) {
      return '';
    }

    return Object.entries(params)
      .filter(([, value]) => value !== undefined && value !== null)
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join('&');
  }

  /**
   * Parse UTM and campaign parameters from query string
   * @param {Object} query - Request query object
   * @returns {Object} - Campaign tracking data
   */
  parseCampaignParams(query) {
    return {
      utmSource: query.utm_source || null,
      utmMedium: query.utm_medium || null,
      utmCampaign: query.utm_campaign || null,
      utmTerm: query.utm_term || null,
      utmContent: query.utm_content || null
    };
  }

  /**
   * Determine redirect target based on platform
   * @param {string} platform - Detected platform
   * @returns {Object} - Redirect target info with URLs
   */
  getRedirectTarget(platform) {
    switch (platform) {
      case PLATFORMS.ANDROID:
        return {
          target: REDIRECT_TARGETS.APP_DEEP_LINK,
          fallbackTarget: REDIRECT_TARGETS.PLAY_STORE,
          storeUrl: this.config.playStoreUrl
        };

      case PLATFORMS.IOS:
        return {
          target: REDIRECT_TARGETS.APP_DEEP_LINK,
          fallbackTarget: REDIRECT_TARGETS.APP_STORE,
          storeUrl: this.config.appStoreUrl
        };

      case PLATFORMS.WEB:
        return {
          target: REDIRECT_TARGETS.WEB_FALLBACK,
          fallbackTarget: REDIRECT_TARGETS.WEB_FALLBACK,
          storeUrl: this.config.webFallbackUrl
        };

      default:
        return {
          target: REDIRECT_TARGETS.WEB_FALLBACK,
          fallbackTarget: REDIRECT_TARGETS.WEB_FALLBACK,
          storeUrl: this.config.webFallbackUrl
        };
    }
  }

  /**
   * Generate complete redirect response data
   * @param {Object} req - Express request object
   * @param {string} linkType - Type of deep link (e.g., 'strava')
   * @param {Object} params - Additional parameters for the deep link
   * @returns {Object} - Complete redirect data
   */
  generateRedirectData(req, linkType = 'strava', params = {}) {
    const startTime = Date.now();
    const userAgent = req.headers['user-agent'] || '';
    const platform = this.detectPlatform(userAgent);
    const deviceInfo = this.parseDeviceInfo(userAgent);
    const ipAddress = this.getClientIp(req);
    const redirectTarget = this.getRedirectTarget(platform);

    // Get the configured path for this link type
    const linkConfig = this.config.deepLinks[linkType] || { path: linkType };

    // Build URLs
    const deepLinkUrl = this.buildDeepLink(linkConfig.path, params);
    const androidIntentUrl = this.buildAndroidIntent(linkConfig.path, params);
    const fallbackUrl = redirectTarget.storeUrl;

    // Determine final redirect URL based on platform
    let finalRedirectUrl = deepLinkUrl;
    if (platform === PLATFORMS.WEB) {
      finalRedirectUrl = this.config.webFallbackUrl;
    }

    return {
      requestId: this.generateRequestId(),
      platform,
      deviceInfo,
      ipAddress,
      redirectTarget: redirectTarget.target,
      deepLinkUrl,
      androidIntentUrl,
      fallbackUrl,
      finalRedirectUrl,
      queryParams: params,
      source: params.source || 'direct',
      campaign: this.parseCampaignParams(req.query),
      referrer: req.headers.referer || req.headers.referrer || null,
      processingTime: Date.now() - startTime
    };
  }

  /**
   * Generate HTML page for smart redirect with app detection
   * @param {Object} redirectData - Redirect data from generateRedirectData
   * @param {Object} options - Additional options for the HTML page
   * @returns {string} - HTML string
   */
  generateRedirectHtml(redirectData, options = {}) {
    const {
      platform,
      deepLinkUrl,
      androidIntentUrl,
      fallbackUrl
    } = redirectData;

    const title = options.title || 'Redirecting to iFit Club';
    const message = options.message || 'Opening iFit Club...';
    const timeout = this.config.appOpenTimeout;
    const maxRetries = this.config.maxRetries;

    return `
<!DOCTYPE html>
<html>
<head>
  <title>${title}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="refresh" content="${Math.ceil(timeout / 1000)};url=${deepLinkUrl}">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 20px;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      color: white;
    }
    .container { text-align: center; max-width: 400px; }
    .icon {
      width: 80px; height: 80px;
      background: #fc4c02;
      border-radius: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 24px;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.05); }
    }
    .icon svg { width: 40px; height: 40px; fill: white; }
    h1 { font-size: 24px; margin-bottom: 8px; }
    .subtitle { color: #aaa; margin-bottom: 32px; }
    .btn {
      display: block;
      width: 100%;
      padding: 16px 24px;
      background: #fc4c02;
      color: white;
      text-decoration: none;
      border-radius: 12px;
      font-weight: 600;
      font-size: 16px;
      margin-bottom: 12px;
      transition: all 0.2s;
      border: none;
      cursor: pointer;
    }
    .btn:hover { background: #e04400; transform: scale(1.02); }
    .btn-secondary { background: transparent; border: 2px solid #fc4c02; }
    .btn-store { background: #333; }
    .loader {
      border: 3px solid rgba(255,255,255,0.1);
      border-top: 3px solid #fc4c02;
      border-radius: 50%;
      width: 20px; height: 20px;
      animation: spin 1s linear infinite;
      display: inline-block;
      margin-right: 8px;
      vertical-align: middle;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .status { color: #888; font-size: 14px; margin-top: 24px; }
    .hidden { display: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">
      <svg viewBox="0 0 24 24">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
      </svg>
    </div>
    <h1>${message}</h1>
    <p class="subtitle">Please wait while we redirect you</p>

    <a href="${deepLinkUrl}" class="btn" id="openBtn">
      <span class="loader" id="loader"></span>
      <span id="btnText">Open iFit Club</span>
    </a>

    ${platform === 'android' ? `
    <a href="${androidIntentUrl}" class="btn btn-secondary" id="androidBtn">
      Open App (Android)
    </a>
    ` : ''}

    <a href="${fallbackUrl}" class="btn btn-store hidden" id="storeBtn">
      ${platform === 'android' ? 'Get it on Google Play' : platform === 'ios' ? 'Download on App Store' : 'Visit Website'}
    </a>

    <p class="status" id="status">Attempting to open app...</p>
  </div>

  <script>
    (function() {
      const deepLink = "${deepLinkUrl}";
      const fallback = "${fallbackUrl}";
      const timeout = ${timeout};
      const maxRetries = ${maxRetries};
      let retryCount = 0;
      let appOpened = false;

      function updateStatus(msg) {
        document.getElementById('status').textContent = msg;
      }

      function showStoreButton() {
        document.getElementById('storeBtn').classList.remove('hidden');
        document.getElementById('loader').style.display = 'none';
        document.getElementById('btnText').textContent = 'Try Again';
        updateStatus('App not installed? Get it from the store.');
      }

      function tryOpenApp() {
        if (appOpened || retryCount >= maxRetries) {
          showStoreButton();
          return;
        }

        retryCount++;
        updateStatus('Attempting to open app... (' + retryCount + '/' + maxRetries + ')');

        // Use hidden iframe technique for better compatibility
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = deepLink;
        document.body.appendChild(iframe);

        // Also try direct location change
        setTimeout(function() {
          if (!appOpened) {
            window.location.href = deepLink;
          }
        }, 100);

        // Check if still on page after timeout
        setTimeout(function() {
          if (!appOpened && document.hasFocus()) {
            tryOpenApp();
          }
        }, timeout);
      }

      // Track if app opens (page loses focus/visibility)
      document.addEventListener('visibilitychange', function() {
        if (document.hidden) {
          appOpened = true;
        }
      });

      window.addEventListener('blur', function() {
        appOpened = true;
      });

      // Start attempt after short delay
      setTimeout(tryOpenApp, 300);
    })();
  </script>
</body>
</html>`;
  }

  /**
   * Generate JSON response for API consumers
   * @param {Object} redirectData - Redirect data
   * @returns {Object} - JSON response object
   */
  generateJsonResponse(redirectData) {
    return {
      success: true,
      data: {
        requestId: redirectData.requestId,
        platform: redirectData.platform,
        deviceType: redirectData.deviceInfo.deviceType,
        redirectTarget: redirectData.redirectTarget,
        urls: {
          deepLink: redirectData.deepLinkUrl,
          androidIntent: redirectData.androidIntentUrl,
          fallback: redirectData.fallbackUrl,
          recommended: redirectData.finalRedirectUrl
        },
        config: {
          appScheme: this.config.appScheme,
          timeout: this.config.appOpenTimeout,
          maxRetries: this.config.maxRetries
        }
      }
    };
  }
}

// Export singleton instance and constants
const redirectService = new RedirectService();
module.exports = redirectService;
module.exports.PLATFORMS = PLATFORMS;
module.exports.REDIRECT_TARGETS = REDIRECT_TARGETS;
