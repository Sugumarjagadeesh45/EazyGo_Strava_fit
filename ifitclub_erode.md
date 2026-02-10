# iFit Club Backend API Documentation

> **Status**: Updated for Real Data Integration.
> **Critical Note**: All endpoints must return **REAL DATABASE DATA** calculated from actual user activities. Do not use hardcoded or mock responses.

## 🚀 Base Configuration
- **Base URL**: `http://<YOUR_IP>:5000` (Local) or Production URL
- **API Prefix**: `/api`

---

## 1. Health Statistics (Dashboard)

### Get Health Stats
- **Endpoint**: `GET /api/athlete/:id/health`
- **Description**: Fetches the user's saved health metrics from the database.
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "weight": "75",
      "height": "178",
      "bmi": "23.7",
      "bp": "120/80",
      "lung": "4.5L",
      "temp": "36.6"
    }
  }
  ```

### Update Health Stats
- **Endpoint**: `POST /api/athlete/:id/health`
- **Description**: Saves the user's editable health metrics.
- **Body**:
  ```json
  {
    "weight": "75",
    "height": "178",
    "bmi": "23.7",
    "bp": "120/80",
    "lung": "4.5L",
    "temp": "36.6"
  }
  ```

---

## 2. Club Performance (Real Data)

### Get Top Performers (Today)
- **Endpoint**: `GET /api/club/top-performer`
- **Description**: Fetches the **Top 3** club members with the best performance **today** (based on distance).
- **Logic**: 
  1. Query all activities where `startDate` is today.
  2. Group by user.
  3. Sort by total distance descending.
  4. Return top 3.
- **Response**:
  ```json
  {
    "success": true,
    "data": [
      {
        "name": "John Doe",
        "avatar": "url/to/image.jpg",
        "totalDistance": 12.5,
        "activityCount": 3,
        "badge": "Today's Leader"
      },
      {
        "name": "Jane Smith",
        "avatar": "url/to/image2.jpg",
        "totalDistance": 10.2,
        "activityCount": 1,
        "badge": "2nd Place"
      },
      {
        "name": "Mike Ross",
        "avatar": "url/to/image3.jpg",
        "totalDistance": 8.5,
        "activityCount": 2,
        "badge": "3rd Place"
      }
    ]
  }
  ```

---

## 3. User Challenges (Create Own Challenge)

### Create User Challenge
- **Endpoint**: `POST /api/user-challenges`
- **Description**: Allows a user to create their own custom challenge.
- **Body**:
  ```json
  {
    "eventName": "My Morning Run",
    "bio": "Beat the sunrise",
    "targetKm": "5",
    "duration": "7", // Days
    "description": "A personal challenge to run every morning."
  }
  ```

---

## 4. Events & Awards

- **Get Events**: `GET /api/events` (Discover Tab)
- **Get Awards**: `GET /api/awards` (Awards Tab)
- **Join Event**: `POST /api/events/:id/join`
- **My Challenges**: `GET /api/my-challenges?athleteId=...`

---

## 5. Data Sync (Strava)

### Sync Activities
- **Endpoint**: `POST /api/athlete/:id/sync`
- **Description**: Triggers a manual sync with Strava to fetch latest activities.
- **Usage**: Called when user pulls to refresh the dashboard to ensure "My Activity" progress is accurate.