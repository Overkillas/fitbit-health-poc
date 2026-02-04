# Users API Documentation

## Base URL

```
http://localhost:3003/users
```

---

## CRUD Endpoints

### Create User

Creates a new user (doctor or patient).

**Endpoint:** `POST /users`

**Request Body:**

```json
{
  "name": "Dr. João Silva",
  "email": "joao.silva@hospital.com",
  "phone": "+5511999999999",
  "password": "senha123",
  "role": "DOCTOR"
}
```

**Creating a Patient with Doctor:**

```json
{
  "name": "Maria Santos",
  "email": "maria.santos@email.com",
  "phone": "+5511888888888",
  "password": "senha123",
  "role": "PATIENT",
  "doctorId": 1
}
```

**Response (201 Created):**

```json
{
  "id": 1,
  "name": "Dr. João Silva",
  "email": "joao.silva@hospital.com",
  "phone": "+5511999999999",
  "role": "DOCTOR",
  "doctorId": null,
  "fitbitUserId": null,
  "hasFitbitConnected": false
}
```

**Validation Rules:**
- `name`: Required, string
- `email`: Required, valid email format, unique
- `phone`: Required, string, unique
- `password`: Required, minimum 6 characters
- `role`: Required, must be "DOCTOR" or "PATIENT"
- `doctorId`: Optional, must reference an existing doctor

---

### List All Users

**Endpoint:** `GET /users`

**Response (200 OK):**

```json
[
  {
    "id": 1,
    "name": "Dr. João Silva",
    "email": "joao.silva@hospital.com",
    "phone": "+5511999999999",
    "role": "DOCTOR",
    "doctorId": null,
    "fitbitUserId": null,
    "hasFitbitConnected": false,
    "patients": [
      {
        "id": 2,
        "name": "Maria Santos",
        "email": "maria.santos@email.com",
        "phone": "+5511888888888",
        "role": "PATIENT",
        "doctorId": 1,
        "fitbitUserId": "ABC123",
        "hasFitbitConnected": true
      }
    ]
  }
]
```

---

### List All Doctors

**Endpoint:** `GET /users/doctors`

**Response (200 OK):**

```json
[
  {
    "id": 1,
    "name": "Dr. João Silva",
    "email": "joao.silva@hospital.com",
    "phone": "+5511999999999",
    "role": "DOCTOR",
    "hasFitbitConnected": false,
    "patients": [...]
  }
]
```

---

### List All Patients

**Endpoint:** `GET /users/patients`

**Response (200 OK):**

```json
[
  {
    "id": 2,
    "name": "Maria Santos",
    "email": "maria.santos@email.com",
    "phone": "+5511888888888",
    "role": "PATIENT",
    "doctorId": 1,
    "hasFitbitConnected": true,
    "doctor": {
      "id": 1,
      "name": "Dr. João Silva",
      "email": "joao.silva@hospital.com",
      "role": "DOCTOR"
    }
  }
]
```

---

### Get User by ID

**Endpoint:** `GET /users/:id`

**Example:** `GET /users/1`

**Response (200 OK):**

```json
{
  "id": 1,
  "name": "Dr. João Silva",
  "email": "joao.silva@hospital.com",
  "phone": "+5511999999999",
  "role": "DOCTOR",
  "doctorId": null,
  "fitbitUserId": null,
  "hasFitbitConnected": false,
  "patients": [...]
}
```

**Response (404 Not Found):**

```json
{
  "statusCode": 404,
  "message": "User with id 999 not found",
  "error": "Not Found"
}
```

---

### Update User

**Endpoint:** `PUT /users/:id`

**Example:** `PUT /users/1`

**Request Body (partial update allowed):**

```json
{
  "name": "Dr. João Silva Jr.",
  "phone": "+5511777777777"
}
```

**Response (200 OK):**

```json
{
  "id": 1,
  "name": "Dr. João Silva Jr.",
  "email": "joao.silva@hospital.com",
  "phone": "+5511777777777",
  "role": "DOCTOR",
  "hasFitbitConnected": false
}
```

---

### Delete User

**Endpoint:** `DELETE /users/:id`

**Example:** `DELETE /users/1`

**Response (204 No Content)**

**Error (400 Bad Request - Doctor with patients):**

```json
{
  "statusCode": 400,
  "message": "Cannot delete a doctor with associated patients",
  "error": "Bad Request"
}
```

---

## Doctor -> Patients Endpoints

### Get Doctor's Patients

**Endpoint:** `GET /users/:id/patients`

**Example:** `GET /users/1/patients`

**Response (200 OK):**

```json
[
  {
    "id": 2,
    "name": "Maria Santos",
    "email": "maria.santos@email.com",
    "phone": "+5511888888888",
    "role": "PATIENT",
    "doctorId": 1,
    "hasFitbitConnected": true
  },
  {
    "id": 3,
    "name": "Carlos Oliveira",
    "email": "carlos@email.com",
    "phone": "+5511666666666",
    "role": "PATIENT",
    "doctorId": 1,
    "hasFitbitConnected": true
  }
]
```

---

### Get All Patients' Activity Data (Doctor View)

Fetches activity data from Fitbit for all patients of a doctor.

**Endpoint:** `GET /users/:id/patients/fitbit/activity`

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `date` | string (YYYY-MM-DD) | No | Date to fetch data. Defaults to today |

**Example:** `GET /users/1/patients/fitbit/activity?date=2024-01-15`

**Response (200 OK):**

```json
[
  {
    "userId": 2,
    "success": true,
    "data": {
      "activities": [],
      "goals": {
        "activeMinutes": 30,
        "caloriesOut": 2500,
        "distance": 8,
        "floors": 10,
        "steps": 10000
      },
      "summary": {
        "activeScore": -1,
        "activityCalories": 1200,
        "caloriesBMR": 1500,
        "caloriesOut": 2100,
        "distances": [...],
        "fairlyActiveMinutes": 20,
        "lightlyActiveMinutes": 180,
        "marginalCalories": 400,
        "sedentaryMinutes": 720,
        "steps": 8500,
        "veryActiveMinutes": 15
      }
    }
  },
  {
    "userId": 3,
    "success": false,
    "error": "User has no Fitbit connected"
  }
]
```

---

### Get All Patients' Sleep Data (Doctor View)

**Endpoint:** `GET /users/:id/patients/fitbit/sleep`

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `date` | string (YYYY-MM-DD) | No | Date to fetch data. Defaults to today |

**Example:** `GET /users/1/patients/fitbit/sleep?date=2024-01-15`

**Response (200 OK):**

```json
[
  {
    "userId": 2,
    "success": true,
    "data": {
      "sleep": [
        {
          "dateOfSleep": "2024-01-15",
          "duration": 28800000,
          "efficiency": 92,
          "isMainSleep": true,
          "levels": {
            "summary": {
              "deep": { "count": 4, "minutes": 80 },
              "light": { "count": 30, "minutes": 200 },
              "rem": { "count": 8, "minutes": 100 },
              "wake": { "count": 20, "minutes": 40 }
            }
          },
          "minutesAfterWakeup": 0,
          "minutesAsleep": 420,
          "minutesAwake": 60,
          "startTime": "2024-01-14T23:00:00.000",
          "timeInBed": 480
        }
      ],
      "summary": {
        "totalMinutesAsleep": 420,
        "totalSleepRecords": 1,
        "totalTimeInBed": 480
      }
    }
  }
]
```

---

### Get All Patients' Week Data (Doctor View)

Fetches 7 days of activity and sleep data for all patients.

**Endpoint:** `GET /users/:id/patients/fitbit/week`

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `weekStart` | string (YYYY-MM-DD) | **Yes** | Start date of the week |

**Example:** `GET /users/1/patients/fitbit/week?weekStart=2024-01-08`

**Response (200 OK):**

```json
[
  {
    "userId": 2,
    "success": true,
    "data": [
      {
        "date": "2024-01-08",
        "activity": { "summary": { "steps": 8000, ... } },
        "sleep": { "summary": { "totalMinutesAsleep": 400, ... } }
      },
      {
        "date": "2024-01-09",
        "activity": { ... },
        "sleep": { ... }
      }
      // ... 7 days total
    ]
  }
]
```

---

## Fitbit Data Endpoints (Single User)

### Get User Activity

**Endpoint:** `GET /users/:id/fitbit/activity`

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `date` | string (YYYY-MM-DD) | No | Date to fetch. Defaults to today |

**Example:** `GET /users/2/fitbit/activity?date=2024-01-15`

**Response (200 OK):**

```json
{
  "activities": [],
  "goals": {
    "activeMinutes": 30,
    "caloriesOut": 2500,
    "distance": 8,
    "floors": 10,
    "steps": 10000
  },
  "summary": {
    "activeScore": -1,
    "activityCalories": 1200,
    "caloriesBMR": 1500,
    "caloriesOut": 2100,
    "distances": [
      { "activity": "total", "distance": 6.5 },
      { "activity": "tracker", "distance": 6.5 }
    ],
    "fairlyActiveMinutes": 20,
    "lightlyActiveMinutes": 180,
    "marginalCalories": 400,
    "sedentaryMinutes": 720,
    "steps": 8500,
    "veryActiveMinutes": 15
  }
}
```

---

### Get User Sleep

**Endpoint:** `GET /users/:id/fitbit/sleep`

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `date` | string (YYYY-MM-DD) | No | Date to fetch. Defaults to today |

**Example:** `GET /users/2/fitbit/sleep?date=2024-01-15`

---

### Get User Week Data

**Endpoint:** `GET /users/:id/fitbit/week`

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `weekStart` | string (YYYY-MM-DD) | **Yes** | Start date of the week |

**Example:** `GET /users/2/fitbit/week?weekStart=2024-01-08`

**Response (200 OK):**

```json
[
  {
    "date": "2024-01-08",
    "activity": { "summary": { "steps": 8000, ... } },
    "sleep": { "summary": { "totalMinutesAsleep": 400, ... } }
  },
  // ... 7 days
]
```

---

### Get User Time Series

Fetches aggregated daily data for a specific resource over a date range.

**Endpoint:** `GET /users/:id/fitbit/time-series`

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `resource` | string | **Yes** | Resource type (see below) |
| `startDate` | string (YYYY-MM-DD) | **Yes** | Start date |
| `endDate` | string (YYYY-MM-DD) | **Yes** | End date |

**Available Resources:**
- `steps`
- `distance`
- `calories`
- `floors`
- `elevation`
- `minutesSedentary`
- `minutesLightlyActive`
- `minutesFairlyActive`
- `minutesVeryActive`
- `activityCalories`

**Example:** `GET /users/2/fitbit/time-series?resource=steps&startDate=2024-01-01&endDate=2024-01-31`

**Response (200 OK):**

```json
{
  "activities-steps": [
    { "dateTime": "2024-01-01", "value": "8500" },
    { "dateTime": "2024-01-02", "value": "10200" },
    { "dateTime": "2024-01-03", "value": "7800" }
    // ...
  ]
}
```

---

### Get User Intraday Data

Fetches minute-by-minute data for a specific resource.

**Endpoint:** `GET /users/:id/fitbit/intraday`

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `resource` | string | **Yes** | Resource type |
| `startDate` | string (YYYY-MM-DD) | **Yes** | Start date |
| `endDate` | string (YYYY-MM-DD) | **Yes** | End date |
| `detailLevel` | string | No | `1min` (default) or `15min` |
| `startTime` | string (HH:mm) | No | Start time filter |
| `endTime` | string (HH:mm) | No | End time filter |

**Example:** `GET /users/2/fitbit/intraday?resource=steps&startDate=2024-01-15&endDate=2024-01-15&detailLevel=1min&startTime=08:00&endTime=12:00`

**Response (200 OK):**

```json
{
  "activities-steps": [
    { "dateTime": "2024-01-15", "value": "8500" }
  ],
  "activities-steps-intraday": {
    "dataset": [
      { "time": "08:00:00", "value": 50 },
      { "time": "08:01:00", "value": 75 },
      { "time": "08:02:00", "value": 120 }
      // ...
    ],
    "datasetInterval": 1,
    "datasetType": "minute"
  }
}
```

---

### Get User Heart Rate

Fetches heart rate data with configurable detail level.

**Endpoint:** `GET /users/:id/fitbit/heart-rate`

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `date` | string (YYYY-MM-DD) | **Yes** | Date to fetch |
| `detailLevel` | string | No | `1min` (default) or `1sec` |
| `startTime` | string (HH:mm) | No | Start time filter |
| `endTime` | string (HH:mm) | No | End time filter |

**Example:** `GET /users/2/fitbit/heart-rate?date=2024-01-15&detailLevel=1min&startTime=06:00&endTime=22:00`

**Response (200 OK):**

```json
{
  "activities-heart": [
    {
      "dateTime": "2024-01-15",
      "value": {
        "customHeartRateZones": [],
        "heartRateZones": [
          { "caloriesOut": 1200, "max": 94, "min": 30, "minutes": 600, "name": "Out of Range" },
          { "caloriesOut": 300, "max": 132, "min": 94, "minutes": 45, "name": "Fat Burn" },
          { "caloriesOut": 150, "max": 160, "min": 132, "minutes": 15, "name": "Cardio" },
          { "caloriesOut": 50, "max": 220, "min": 160, "minutes": 5, "name": "Peak" }
        ],
        "restingHeartRate": 62
      }
    }
  ],
  "activities-heart-intraday": {
    "dataset": [
      { "time": "06:00:00", "value": 58 },
      { "time": "06:01:00", "value": 59 },
      { "time": "06:02:00", "value": 61 }
      // ...
    ],
    "datasetInterval": 1,
    "datasetType": "minute"
  }
}
```

---

### Link Fitbit to User

Connects a user's Fitbit account by saving the OAuth tokens.

**Endpoint:** `POST /users/:id/fitbit`

**Example:** `POST /users/2/fitbit`

**Request Body:**

```json
{
  "fitbitUserId": "ABC123XYZ",
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "abc123def456...",
  "expiresAt": "2024-01-15T16:00:00.000Z"
}
```

**Response (201 Created):**

```json
{
  "id": 2,
  "name": "Maria Santos",
  "email": "maria.santos@email.com",
  "phone": "+5511888888888",
  "role": "PATIENT",
  "doctorId": 1,
  "fitbitUserId": "ABC123XYZ",
  "hasFitbitConnected": true
}
```

---

### Disconnect Fitbit

Removes Fitbit connection from a user account.

**Endpoint:** `DELETE /users/:id/fitbit`

**Example:** `DELETE /users/2/fitbit`

**Response (200 OK):**

```json
{
  "id": 2,
  "name": "Maria Santos",
  "email": "maria.santos@email.com",
  "phone": "+5511888888888",
  "role": "PATIENT",
  "doctorId": 1,
  "fitbitUserId": null,
  "hasFitbitConnected": false
}
```

---

## Error Responses

### Validation Error (400 Bad Request)

```json
{
  "statusCode": 400,
  "message": [
    "email must be an email",
    "password must be longer than or equal to 6 characters"
  ],
  "error": "Bad Request"
}
```

### Not Found (404)

```json
{
  "statusCode": 404,
  "message": "User with id 999 not found",
  "error": "Not Found"
}
```

### Conflict (409)

```json
{
  "statusCode": 409,
  "message": "Email already exists",
  "error": "Conflict"
}
```

### No Fitbit Connected (400)

```json
{
  "statusCode": 400,
  "message": "User has no Fitbit connected",
  "error": "Bad Request"
}
```

---

## cURL Examples

### Create a Doctor

```bash
curl -X POST http://localhost:3003/users \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Dr. João Silva",
    "email": "joao@hospital.com",
    "phone": "+5511999999999",
    "password": "senha123",
    "role": "DOCTOR"
  }'
```

### Create a Patient

```bash
curl -X POST http://localhost:3003/users \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Maria Santos",
    "email": "maria@email.com",
    "phone": "+5511888888888",
    "password": "senha123",
    "role": "PATIENT",
    "doctorId": 1
  }'
```

### Get User Activity

```bash
curl "http://localhost:3003/users/2/fitbit/activity?date=2024-01-15"
```

### Get Doctor's Patients with Activity Data

```bash
curl "http://localhost:3003/users/1/patients/fitbit/activity?date=2024-01-15"
```

### Get Week Data

```bash
curl "http://localhost:3003/users/2/fitbit/week?weekStart=2024-01-08"
```

### Get Time Series (Monthly Steps)

```bash
curl "http://localhost:3003/users/2/fitbit/time-series?resource=steps&startDate=2024-01-01&endDate=2024-01-31"
```

### Get Heart Rate Intraday

```bash
curl "http://localhost:3003/users/2/fitbit/heart-rate?date=2024-01-15&detailLevel=1min&startTime=08:00&endTime=18:00"
```

---

## Workflow: Connecting Fitbit to a User

### Option 1: Using the Web Interface (Recommended)

1. **Create the user first** (via API or your application)

2. **Open the connection page in your browser:**
   ```
   http://localhost:3003/fitbit/connect
   ```

3. **Select the user** from the dropdown or enter the user ID manually

4. **Click "Conectar com Fitbit"** - you will be redirected to Fitbit login

5. **Authorize the application** on Fitbit's website

6. **Done!** You will be redirected back and the tokens will be saved automatically

### Option 2: Using the API Directly

1. **Create the user first:**
   ```bash
   curl -X POST http://localhost:3003/users \
     -H "Content-Type: application/json" \
     -d '{"name": "Patient", "email": "patient@email.com", "phone": "+55119999", "password": "123456", "role": "PATIENT", "doctorId": 1}'
   ```

2. **Redirect user to OAuth with userId:**
   ```
   http://localhost:3003/fitbit/auth?userId=2
   ```

3. **User authorizes in browser** (redirects to Fitbit login)

4. **Tokens are saved automatically** when the callback is received

5. **Fetch Fitbit data:**
   ```bash
   curl "http://localhost:3003/users/2/fitbit/activity"
   ```

### Option 3: Manual Token Linking

If you already have the tokens, you can link them manually:

```bash
curl -X POST http://localhost:3003/users/2/fitbit \
  -H "Content-Type: application/json" \
  -d '{
    "fitbitUserId": "ABC123XYZ",
    "accessToken": "eyJhbGciOiJIUzI1NiJ9...",
    "refreshToken": "abc123def456...",
    "expiresAt": "2024-01-15T16:00:00.000Z"
  }'
```
