English | [Portugues](README.pt-BR.md)

# Fitbit API Integration - NestJS

> **Disclaimer: This is a Proof of Concept (POC).** This project is not production-ready. It was built to demonstrate the feasibility of integrating the Fitbit Web API with a NestJS backend for remote patient health monitoring. The following trade-offs were made intentionally to keep the focus on the core integration:
>
> - **No API authentication/authorization** — endpoints are unprotected. The POC focuses on demonstrating Fitbit OAuth2 integration, data retrieval, and the doctor-patient data flow, not on building a full auth system. In production, JWT-based authentication with role guards (DOCTOR/PATIENT) would be required.
> - **Fitbit tokens stored as plain text** in the database (should be encrypted at rest).
> - **`synchronize: true`** in TypeORM — auto-syncs schema from entities. In production, use migrations.
> - **No rate limiting** — Fitbit enforces 150 req/hour per user; this API does not throttle or cache.

Backend API built with NestJS for Fitbit Web API integration. A POC that allows doctors to monitor their patients' health data through Fitbit wearables (Flex 2 and Inspire HR).

## About

System with doctor and patient registration, OAuth2 authentication with Fitbit, automatic health data collection, and a web interface for visualization. Doctors can view data from all linked patients in a single dashboard.

## Features

- OAuth2 authentication with Fitbit (Authorization Code Grant)
- User CRUD (doctors and patients)
- Doctor-patient linking
- Fitbit token persistence in PostgreSQL
- Automatic token refresh (15-minute buffer before expiration)
- Cron job every 10 minutes to check device sync status
- Sync history tracking (SyncHistory entity)
- Activity, sleep, heart rate, profile, and device data
- Time series and intraday data (minute-by-minute)\*
- Subscriptions (webhooks) and SSE for real-time data
- Web interface for management and visualization

\* Intraday data requires a "Personal" application type or special approval from Fitbit.

## Stack

- **Framework**: [NestJS](https://nestjs.com/) 11.x
- **Language**: [TypeScript](https://www.typescriptlang.org/) 5.x
- **Database**: [PostgreSQL](https://www.postgresql.org/) 16 via [TypeORM](https://typeorm.io/)
- **HTTP Client**: [Axios](https://axios-http.com/)
- **Scheduler**: [@nestjs/schedule](https://docs.nestjs.com/techniques/task-scheduling) (cron jobs)
- **Events**: [@nestjs/event-emitter](https://docs.nestjs.com/techniques/events) (webhooks)
- **API**: [Fitbit Web API](https://dev.fitbit.com/build/reference/web-api/)

## Installation

### Prerequisites

- Node.js (version 16 or higher)
- PostgreSQL (or Docker)
- Fitbit developer account at [dev.fitbit.com](https://dev.fitbit.com/apps)

### 1. Clone and install

```bash
git clone <your-repository>
cd fitbit-api
npm install
```

### 2. Start the database

```bash
docker compose up -d
```

### 3. Configure environment variables

Create a `.env` file in the project root:

```env
FITBIT_CLIENT_ID=your_client_id
FITBIT_CLIENT_SECRET=your_client_secret
FITBIT_REDIRECT_URI=http://localhost:3003/fitbit/callback
PORT=3003

DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=user
DB_PASSWORD=password
DB_NAME=fitbit_db
```

### 4. Register your Fitbit application

1. Go to [Fitbit Developer](https://dev.fitbit.com/apps)
2. Click "Register a new app"
3. Fill in:
   - **OAuth 2.0 Application Type**: `Server`
   - **Redirect URL**: `http://localhost:3003/fitbit/callback`
   - **Default Access Type**: `Read Only`
4. Copy the **Client ID** and **Client Secret** to your `.env` file

### 5. Start the server

```bash
# Development
npm run start:dev

# Production
npm run build && npm run start:prod
```

The server will be running at `http://localhost:3003`

## Web Interface

The application includes a web interface accessible at `http://localhost:3003`. Available pages:

| Page | Description |
|------|-------------|
| **Dashboard** | Overview with counters (total users, doctors, patients, Fitbit-connected) |
| **Users** | Full CRUD — register, edit, and remove doctors and patients. Link patients to doctors. Connect/disconnect Fitbit |
| **Summary Data** | Select a doctor and view all patients' data by tabs: Activity, Sleep, Week, and Profile. Includes last sync badge per patient |
| **Full Data** | Select a doctor and view all consolidated data per patient (activity + sleep + HR + profile + devices + sync history) |

Additionally, `/fitbit/connect` provides the interface for the Fitbit OAuth2 linking flow.

## Endpoints

### Fitbit Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/fitbit/auth?userId=:id` | Initiates OAuth2 flow (redirects to Fitbit) |
| GET | `/fitbit/callback` | OAuth2 callback (called by Fitbit) |
| POST | `/fitbit/refresh` | Refreshes access token (body: `{ "refreshToken": "..." }`) |
| GET | `/fitbit/connect` | Web page for Fitbit connection |

### User CRUD

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/users` | Create user (doctor or patient) |
| GET | `/users` | List all users |
| GET | `/users/doctors` | List doctors |
| GET | `/users/patients` | List patients |
| GET | `/users/:id` | Get user by ID |
| PUT | `/users/:id` | Update user |
| DELETE | `/users/:id` | Delete user |

### Fitbit Data per User

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/users/:id/fitbit/activity?date=YYYY-MM-DD` | Daily activity |
| GET | `/users/:id/fitbit/sleep?date=YYYY-MM-DD` | Sleep data |
| GET | `/users/:id/fitbit/week?weekStart=YYYY-MM-DD` | 7-day data (activity + sleep) |
| GET | `/users/:id/fitbit/heart-rate?date=YYYY-MM-DD` | Intraday heart rate |
| GET | `/users/:id/fitbit/time-series?resource=steps&startDate=...&endDate=...` | Time series by period |
| GET | `/users/:id/fitbit/intraday?resource=steps&startDate=...&endDate=...` | Minute-by-minute intraday |
| GET | `/users/:id/fitbit/profile` | Fitbit profile (name, age, height, weight) |
| GET | `/users/:id/fitbit/devices` | Devices and last sync |
| GET | `/users/:id/fitbit/sync-history?limit=20` | Sync history |
| GET | `/users/:id/fitbit/all?date=YYYY-MM-DD` | All daily data (activity + sleep + HR) |
| POST | `/users/:id/fitbit` | Link Fitbit tokens to user |
| DELETE | `/users/:id/fitbit` | Disconnect Fitbit from user |

### Doctor View (patients' data)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/users/:id/patients` | List doctor's patients |
| GET | `/users/:id/patients/fitbit/activity?date=...` | All patients' activity |
| GET | `/users/:id/patients/fitbit/sleep?date=...` | All patients' sleep |
| GET | `/users/:id/patients/fitbit/week?weekStart=...` | All patients' weekly data |
| GET | `/users/:id/patients/fitbit/profile` | All patients' Fitbit profiles |
| GET | `/users/:id/patients/fitbit/all?date=...` | All data for all patients |

### Direct Endpoints (Fitbit token via header)

These endpoints accept a Fitbit access token directly via `Authorization: Bearer <fitbit_token>` header, without requiring a registered user in the system.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/fitbit/activity?date=...` | Activity |
| GET | `/fitbit/sleep?date=...` | Sleep |
| GET | `/fitbit/week?weekStart=...` | Weekly data |
| GET | `/fitbit/time-series?resource=...&startDate=...&endDate=...` | Time series |
| GET | `/fitbit/intraday?resource=...&startDate=...&endDate=...` | Intraday |
| GET | `/fitbit/heart-rate-intraday?date=...` | HR intraday |
| POST | `/fitbit/refresh` | Refresh token (body: `{ "refreshToken": "..." }`) |

### Sessions and Real-Time

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/fitbit/session/:sessionId/patient` | Add patient to session |
| DELETE | `/fitbit/session/:sessionId/patient/:patientId` | Remove patient from session |
| SSE | `/fitbit/session/:sessionId/live` | Real-time data stream |
| DELETE | `/fitbit/session/:sessionId` | End session |
| POST | `/fitbit/webhook` | Receive Fitbit notifications |

## Data Coverage: This API vs Fitbit Web API

Comparison between all data types available in the [Fitbit Web API](https://dev.fitbit.com/build/reference/web-api/) and what this API implements. The **Hardware Restriction** column indicates when data **cannot be collected** by the Flex 2 and/or Inspire HR models used in this POC.

| Category | Data | Fitbit Web API | This API | Hardware Restriction (Flex 2 / Inspire HR) |
|----------|------|:--------------:|:--------:|---------------------------------------------|
| **Activity** | Steps | ✅ | ✅ | None |
| | Calories | ✅ | ✅ | None |
| | Distance | ✅ | ✅ | None |
| | Floors | ✅ | ✅ | ⚠️ **Both lack altimeter** — returns 0 |
| | Elevation | ✅ | ✅ | ⚠️ **Both lack altimeter** — returns 0 |
| | Sedentary minutes | ✅ | ✅ | None |
| | Lightly active minutes | ✅ | ✅ | None |
| | Fairly active minutes | ✅ | ✅ | None |
| | Very active minutes | ✅ | ✅ | None |
| | Active Zone Minutes (AZM) | ✅ | ❌ | ⚠️ **Flex 2 no HR** — cannot collect |
| | Activity intraday | ✅ | ✅ | None (requires Personal app) |
| **Sleep** | Sleep summary | ✅ | ✅ | None |
| | Stages (light/deep/REM) | ✅ | ✅ | ⚠️ **Flex 2 no HR** — returns basic sleep only (awake/asleep/restless) |
| | Sleep time series | ✅ | ❌ | None |
| **Heart Rate** | Daily heart rate (zones) | ✅ | ✅ | ⚠️ **Flex 2 no HR** — cannot collect |
| | Heart rate intraday | ✅ | ✅ | ⚠️ **Flex 2 no HR** — cannot collect |
| | Heart Rate Variability (HRV) | ✅ | ❌ | ⚠️ **Neither supports** HRV |
| **Breathing** | Breathing rate | ✅ | ❌ | ⚠️ **Flex 2 no HR** — cannot collect |
| **Temperature** | Skin temperature | ✅ | ❌ | ⚠️ **Both lack temp. sensor** |
| | Core body temperature (manual) | ✅ | ❌ | None (manual entry) |
| **Oxygen** | SpO2 | ✅ | ❌ | ⚠️ **Both lack SpO2 sensor** |
| **Cardio Fitness** | VO2 Max | ✅ | ❌ | ⚠️ **Flex 2 no HR** — cannot calculate |
| **Body** | Weight | ✅ | ❌ | None (scope already authorized) |
| | Body fat | ✅ | ❌ | None (requires Aria scale) |
| | BMI | ✅ | ❌ | None |
| **Nutrition** | Food logs | ✅ | ❌ | None (manual entry) |
| | Water | ✅ | ❌ | None (manual entry) |
| **ECG** | Electrocardiogram | ✅ | ❌ | ⚠️ **Both lack ECG sensor** (Sense/Sense 2 only) |
| **IRN** | Irregular Rhythm Notifications | ✅ | ❌ | ⚠️ **Both lack ECG sensor** (Sense/Sense 2 only) |
| **Profile** | User data | ✅ | ✅ | None |
| **Devices** | Device list | ✅ | ✅ | None |
| **OAuth** | Authentication | ✅ | ✅ | None |
| | Refresh token | ✅ | ✅ | None |
| **Subscriptions** | Webhooks | ✅ | ✅ | None |

**Legend**: ⚠️ = hardware limitation of the models used in this POC. The endpoint may exist in the Fitbit Web API, but the device lacks the required sensor.

### Coverage by Model: Flex 2 vs Inspire HR

The **Flex 2** and **Inspire HR** have different sensors, which directly impacts what data can be collected.

#### Sensors

| Sensor | Flex 2 | Inspire HR |
|--------|:------:|:----------:|
| 3-axis accelerometer | ✅ | ✅ |
| Optical heart rate monitor | ❌ | ✅ |
| Altimeter | ❌ | ❌ |
| Connected GPS (via phone) | ❌ | ✅ |
| SpO2 sensor | ❌ | ❌ |
| Temperature sensor | ❌ | ❌ |
| OLED display | ❌ | ✅ |
| Water resistance | 10m | 50m |

#### Data Collectible via This API

| Data | Flex 2 | Inspire HR | Endpoint | Restriction reason |
|------|:------:|:----------:|----------|--------------------|
| Steps | ✅ | ✅ | `/users/:id/fitbit/activity` | |
| Calories | ✅ | ✅ | `/users/:id/fitbit/activity` | |
| Distance | ✅ | ✅ | `/users/:id/fitbit/activity` | |
| Floors | ❌ | ❌ | — | No altimeter on either |
| Active minutes | ✅ | ✅ | `/users/:id/fitbit/activity` | |
| Activity intraday | ✅ | ✅ | `/users/:id/fitbit/intraday` | |
| Sleep (total duration) | ✅ | ✅ | `/users/:id/fitbit/sleep` | |
| Sleep (light/deep/REM stages) | ❌ | ✅ | `/users/:id/fitbit/sleep` | Flex 2 lacks HR sensor |
| Heart rate (24/7) | ❌ | ✅ | `/users/:id/fitbit/heart-rate` | Flex 2 lacks HR sensor |
| Heart rate intraday | ❌ | ✅ | `/users/:id/fitbit/heart-rate` | Flex 2 lacks HR sensor |
| Heart rate zones | ❌ | ✅ | `/users/:id/fitbit/activity` | Flex 2 lacks HR sensor |
| Active Zone Minutes | ❌ | ⚠️ | — | Not implemented (Inspire HR supports it) |
| VO2 Max | ❌ | ⚠️ | — | Not implemented (Inspire HR supports it) |
| Breathing rate | ❌ | ⚠️ | — | Not implemented (Inspire HR supports it) |
| Connected GPS | ❌ | ✅ | `/users/:id/fitbit/activity` | Flex 2 lacks GPS |
| Auto exercise recognition | ✅ | ✅ | `/users/:id/fitbit/activity` | |
| User profile | ✅ | ✅ | `/users/:id/fitbit/profile` | |
| Devices and last sync | ✅ | ✅ | `/users/:id/fitbit/devices` | |
| Sync history | ✅ | ✅ | `/users/:id/fitbit/sync-history` | |
| Weekly data | ✅ | ✅ | `/users/:id/fitbit/week` | |
| Time series | ✅ | ✅ | `/users/:id/fitbit/time-series` | |
| SpO2 | ❌ | ❌ | — | No sensor on either |
| Skin temperature | ❌ | ❌ | — | No sensor on either |
| ECG | ❌ | ❌ | — | No sensor on either |
| HRV | ❌ | ❌ | — | Neither supports it |

**Legend**: ✅ = available | ❌ = unavailable (no hardware) | ⚠️ = hardware supports it, but endpoint not implemented in this API

> **Summary**: The **Inspire HR** provides significantly richer data than the **Flex 2** thanks to its heart rate sensor, which enables sleep stages, HR zones, VO2 Max, and breathing rate. The **Flex 2** is limited to accelerometer-based data (steps, distance, basic sleep). Neither model has SpO2, temperature, ECG, or altimeter sensors.

## Limitations and Notes

### Intraday Data (403 Forbidden)
"Server" type applications **do not have access** to intraday data by default. To get access:
- Request special permission at https://dev.fitbit.com/build/reference/web-api/intraday/
- Or use a "Personal" application type (only for your own data)

### Rate Limits
- **150 requests per hour** per user
- **Intraday**: 1 request per second

### Token Expiration
- **Access Token**: expires in **8 hours**
- **Refresh Token**: does **not expire** by time — it remains valid indefinitely until used. Each refresh token is **single-use**: when used, a new access token **and** a new refresh token are returned. The old refresh token is immediately invalidated
- Refresh tokens can be revoked if the user revokes access on Fitbit or changes their password
- The cron job (every 10 min) and on-demand requests automatically refresh tokens within **15 minutes** of expiration

### Hardware Limitations (Flex 2 and Inspire HR)
- **Floors/elevation**: Both lack an altimeter, endpoint returns 0
- **Heart rate**: Flex 2 has no optical HR sensor
- **Sleep stages**: Flex 2 returns basic sleep only (awake/asleep/restless)
- **SpO2, temperature, ECG, HRV**: Neither model has these sensors
