# iFit Club - Strava Integration Documentation (Frontend Guide)

> **🕒 Last Updated:** 2026-02-17 (Dynamic Stats & Rolling Leaderboard)
> **⚠️ IMPORTANT FOR FRONTEND AI:**
> This document contains the **LIVE** endpoints and data structures. Use the URLs below to connect the mobile app to the backend.

## 🌐 Server Configuration

| Environment | Base URL | Status |
|-------------|----------|--------|
| **Public (Ngrok)** | `https://d1c37b7aa116.ngrok-free.app` | **ACTIVE** (Use this for Mobile App) |
| **Local** | `http://localhost:5001` | Development only |

---

## 🔐 Authentication Flow (Deep Linking)

1.  **Start Auth:** Open in mobile browser/webview:
    `GET /api/auth/strava`
    *(Full URL: `https://d1c37b7aa116.ngrok-free.app/api/auth/strava`)*

2.  **Redirect:** Backend redirects to app:
    `ifitclub://auth-success?token=<JWT>&athleteId=<STRAVA_ID>&firstName=<NAME>&lastName=<NAME>&profile=<URL>`

3.  **Action:** Save `token` and `athleteId`. Use `token` in `Authorization: Bearer <token>` header for all subsequent requests.

---

## 👤 Athlete Data Endpoints

**Required Header:** `Authorization: Bearer <JWT_TOKEN>`

### 1. 👤 Get Athlete Profile & Dynamic Stats
*   **Endpoint:** `GET /api/athlete/:id/profile`
*   **Usage:** Gets the full user profile along with dynamically calculated lifetime stats (Total Activities, Distance, and Hours).
*   **Note:** `dynamicStats` are calculated from the local database of synced activities.

#### Response Format
```json
{
  "success": true,
  "data": {
    "_id": "6982ceff7524c2117fe91539",
    "stravaId": 195904051,
    "firstName": "sugumar",
    "lastName": "jagadeesh",
    "profile": "https://...",
    "city": "Salem",
    "country": "India",
    "dynamicStats": {
      "totalActivities": 75,
      "totalDistanceKM": 98.1,
      "totalHours": 18.5
    }
  }
}
```

### 2. 📊 Get Activity Statistics (Strava Aggregated)
*   **Endpoint:** `GET /api/athlete/:id/stats`
*   **Usage:** Gets the pre-aggregated stats provided by Strava (YTD, All-time totals for Ride/Run/Swim).

### 3. 🚴 Get Activities List
*   **Endpoint:** `GET /api/athlete/:id/activities`
*   **Query Params:** `?page=1&limit=20`
*   **Usage:** Gets a paginated list of recent activities.

### 4. 📅 Get Weekly Summary
*   **Endpoint:** `GET /api/athlete/:id/weekly`
*   **Usage:** Gets aggregated stats for the last 4 weeks.

### 5. 🔄 Sync/Refresh Data
*   **Endpoint:** `POST /api/athlete/:id/sync`
*   **Usage:** Triggers a fresh sync from Strava. Use this for "Pull to Refresh".

---

## 🏆 Leaderboard API (Dynamic Calculation)

**Endpoint:** `GET /api/leaderboard`

**Query Parameters:**
*   `period`:
    *   `week` (default): **Rolling Last 7 Days** (e.g., Today minus 7 days)
    *   `month`: **Rolling Last 30 Days** (e.g., Today minus 30 days)
*   `type`: Filter by activity type.
    *   Options: `All Activities` (default), `Walk`, `Run`, `Cycle Ride`, `Swim`, `Hike`, `WeightTraining`, `Workout`, `Yoga`

**Response Format:**
```json
{
  "success": true,
  "users": [
    {
      "name": "sugumar jagadeesh",
      "profile": "https://lh3.googleusercontent.com/...",
      "totalDistanceKM": 150.4,
      "activityType": "Run",
      "totalTimeMinutes": 320,
      "totalElevationGainMeters": 1200,
      "caloriesBurned": 3450
    }
  ]
}
```

**Backend Calculation Logic:**
*   **Calories:** `(Factor × Weight × Time/60) + (ElevationBonus)`
    *   *Factors:* Run(9.8), Ride(6.8), Walk(3.5), etc.
    *   *Elevation Bonus:* `0.01 × Weight × Elevation` (for Run/Ride/Walk/Hike).
*   **Sorting:** Descending by `totalDistanceKM`.
*   **Inclusion:** Includes ALL registered users (even with 0 stats).

---

## 🎯 Challenges API

**Endpoint:** `GET /api/challenges`

**Usage:** Returns list of active challenges.

**Response Format:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "7012cf01f640edb179355d22",
      "title": "Weekly 5k Run",
      "description": "Complete a 5k run this week to earn a badge.",
      "type": "Run",
      "goalValue": 5000,
      "startDate": "2026-02-10T00:00:00.000Z",
      "endDate": "2026-02-17T23:59:59.000Z",
      "participantCount": 15,
      "image": "https://images.unsplash.com/..."
    }
  ]
}
```