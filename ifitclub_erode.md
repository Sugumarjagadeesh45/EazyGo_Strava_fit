# iFit Club - Strava Integration Documentation (Frontend Guide)

> **⚠️ IMPORTANT FOR FRONTEND AI:**
> This document contains the **LIVE** endpoints and data structures. Use the URLs below to connect the mobile app to the backend.

## 🌐 Server Configuration

| Environment | Base URL | Status |
|-------------|----------|--------|
| **Public (Ngrok)** | `https://e257-103-59-135-74.ngrok-free.app` | **ACTIVE** (Use this for Mobile App) |
| **Local** | `http://localhost:5001` | Development only |

---

## 🔐 Authentication Flow (Deep Linking)

The authentication process uses OAuth 2.0 with a Deep Link redirect back to the app.

1.  **Start Auth:** Open this URL in the mobile browser/webview:
    ```
    GET /api/auth/strava
    ```
    *(Full URL: `https://e257-103-59-135-74.ngrok-free.app/api/auth/strava`)*

2.  **Redirect:** After successful Strava login, the backend redirects to:
    ```
    ifitclub://auth-success?token=<JWT_TOKEN>&athleteId=<STRAVA_ID>&firstName=<NAME>&lastName=<NAME>&profile=<URL>
    ```

3.  **Frontend Action (CRITICAL):**
    *   Capture the `token` and `athleteId` from the URL.
    *   Save the `token` in secure storage.
    *   **IMMEDIATELY** call the Data Endpoints below to fetch the full user data.

---

## 📡 API Endpoints (Data Fetching)

**Required Header:** `Authorization: Bearer <JWT_TOKEN>`

### 1. 👤 Get Full Athlete Profile
*   **Endpoint:** `GET /api/athlete/:id/profile`
*   **Usage:** Call this immediately after login to get user details.
*   **Example URL:** `/api/athlete/195904051/profile`

### 2. 📊 Get Activity Statistics
*   **Endpoint:** `GET /api/athlete/:id/stats`
*   **Usage:** Gets lifetime totals, recent ride/run totals, etc.
*   **Example URL:** `/api/athlete/195904051/stats`

### 3. 🚴 Get Activities List
*   **Endpoint:** `GET /api/athlete/:id/activities`
*   **Query Params:** `?page=1&limit=20`
*   **Usage:** Gets the list of activities (Runs, Rides, Walks).
*   **Example URL:** `/api/athlete/195904051/activities?limit=50`

### 4. 📅 Get Weekly Summary
*   **Endpoint:** `GET /api/athlete/:id/weekly`
*   **Usage:** Gets aggregated stats for the last 4 weeks.

### 5. 🔄 Sync/Refresh Data
*   **Endpoint:** `POST /api/athlete/:id/sync`
*   **Usage:** Triggers a fresh sync from Strava (e.g., "Pull to Refresh").

---

## 💻 Frontend Console Logging Requirement

**To ensure data flow is correct, the Frontend MUST implement the following logging logic:**

```javascript
// Example Frontend Function to Fetch & Log Data
const fetchAndLogUserData = async (athleteId, token) => {
  const BASE_URL = 'https://e257-103-59-135-74.ngrok-free.app';
  const headers = { Authorization: `Bearer ${token}` };

  console.log('🚀 STARTING DATA FETCH FOR:', athleteId);

  try {
    // 1. Fetch Profile
    const profileRes = await fetch(`${BASE_URL}/api/athlete/${athleteId}/profile`, { headers });
    const profileData = await profileRes.json();
    console.log('👤 [FRONTEND] COMPLETE PROFILE DATA:', JSON.stringify(profileData, null, 2));

    // 2. Fetch Stats
    const statsRes = await fetch(`${BASE_URL}/api/athlete/${athleteId}/stats`, { headers });
    const statsData = await statsRes.json();
    console.log('📊 [FRONTEND] COMPLETE STATS DATA:', JSON.stringify(statsData, null, 2));

    // 3. Fetch Activities
    const activitiesRes = await fetch(`${BASE_URL}/api/athlete/${athleteId}/activities?limit=5`, { headers });
    const activitiesData = await activitiesRes.json();
    console.log('🚴 [FRONTEND] RECENT ACTIVITIES:', JSON.stringify(activitiesData, null, 2));

  } catch (error) {
    console.error('❌ [FRONTEND] DATA FETCH ERROR:', error);
  }
};
```

---

## 📄 Data Response Examples (JSON)

### Athlete Profile Response
```json
{
  "success": true,
  "data": {
    "_id": "6982ceff7524c2117fe91539",
    "stravaId": 195904051,
    "username": "sugumar_jagadeesh",
    "firstName": "sugumar",
    "lastName": "jagadeesh",
    "city": "Salem",
    "state": "Tamil Nadu",
    "country": "India",
    "gender": "M",
    "profile": "https://lh3.googleusercontent.com/a/ACg8ocIpdryk94arDIR7zSXOtbXcXauDrA...",
    "profileMedium": "https://lh3.googleusercontent.com/a/ACg8ocIpdryk94arDIR7zSXOtbXcXauDrA...",
    "followerCount": 0,
    "friendCount": 0,
    "premium": false,
    "stravaCreatedAt": "2025-12-01T08:20:32.000Z",
    "stravaUpdatedAt": "2025-12-09T03:29:15.000Z",
    "createdAt": "2026-02-04T04:45:51.439Z",
    "updatedAt": "2026-02-04T04:45:51.439Z",
    "fullName": "sugumar jagadeesh"
  }
}
```

### Activity Response (Single Item)
```json
{
  "_id": "6982cf01f640edb179355d1b",
  "athleteId": 195904051,
  "stravaActivityId": 17212509432,
  "name": "Morning Walk",
  "type": "Walk",
  "sportType": "Walk",
  "distance": 1495.9,
  "movingTime": 830,
  "elapsedTime": 935,
  "totalElevationGain": 4.5,
  "startDate": "2026-01-29T02:13:29.000Z",
  "startDateLocal": "2026-01-29T07:43:29.000Z",
  "timezone": "(GMT+05:30) Asia/Kolkata",
  "map": {
    "id": "a17212509432",
    "summaryPolyline": "..."
  },
  "averageSpeed": 1.8,
  "maxSpeed": 2.5,
  "calories": 120
}
```

### Stats Response
```json
{
  "success": true,
  "data": {
    "_id": "6982cf01f640edb179355d99",
    "athleteId": 195904051,
    "biggestRideDistance": 25000,
    "biggestClimbElevationGain": 150,
    "allRideTotals": {
      "count": 12,
      "distance": 150400,
      "movingTime": 36000,
      "elapsedTime": 40000,
      "elevationGain": 1200
    },
    "allRunTotals": {
      "count": 5,
      "distance": 25000,
      "movingTime": 12000,
      "elapsedTime": 13000,
      "elevationGain": 200
    }
  }
}
```