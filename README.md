English | [Portugues](README.pt-BR.md)

# Fitbit API Integration - NestJS

> **Disclaimer: This is a Proof of Concept (POC).** This project is not production-ready. It was built to demonstrate the feasibility of integrating the Fitbit Web API with a NestJS backend for remote patient health monitoring. The following trade-offs were made intentionally to keep the focus on the core integration:
>
> - **No API authentication/authorization** — endpoints are unprotected. The POC focuses on demonstrating Fitbit OAuth2 integration, data retrieval, and the doctor-patient data flow, not on building a full auth system. In production, JWT-based authentication with role guards (DOCTOR/PATIENT) would be required.
> - **Fitbit tokens stored as plain text** in the database (should be encrypted at rest).
> - **`synchronize: true`** in TypeORM — auto-syncs schema from entities. In production, use migrations.
> - **No rate limiting** — Fitbit enforces 150 req/hour per user; this API does not throttle or cache.

Backend API built with NestJS for Fitbit Web API integration. A POC that allows doctors to monitor their patients' health data through Fitbit wearables (Flex 2 and Inspire HR).

## Table of Contents

- [About](#about)
- [Features](#features)
- [Stack](#stack)
- [Installation](#installation)
  - [Prerequisites](#prerequisites)
  - [1. Clone and install](#1-clone-and-install)
  - [2. Start the database](#2-start-the-database)
  - [3. Configure environment variables](#3-configure-environment-variables)
  - [4. Register your Fitbit application](#4-register-your-fitbit-application)
  - [5. Start the server](#5-start-the-server)
- [Web Interface](#web-interface)
- [Endpoints](#endpoints)
  - [Fitbit Authentication](#fitbit-authentication)
  - [User CRUD](#user-crud)
  - [Fitbit Data per User](#fitbit-data-per-user)
  - [Doctor View (patients' data)](#doctor-view-patients-data)
  - [Direct Endpoints (Fitbit token via header)](#direct-endpoints-fitbit-token-via-header)
  - [Sessions and Real-Time](#sessions-and-real-time)
- [Data Coverage](#data-coverage)
- [Health Metrics Glossary](#health-metrics-glossary)
  - [Steps](#steps)
  - [Calories](#calories)
  - [Distance](#distance)
  - [Floors & Elevation](#floors--elevation)
  - [Active Minutes](#active-minutes)
  - [Heart Rate](#heart-rate)
  - [Active Zone Minutes (AZM)](#active-zone-minutes-azm)
  - [Sleep](#sleep)
  - [VO2 Max (Cardio Fitness Score)](#vo2-max-cardio-fitness-score)
  - [Breathing Rate](#breathing-rate)
  - [Profile Data](#profile-data)
  - [Device & Sync Data](#device--sync-data)
- [Metrics Not Implemented: AZM and Breathing Rate](#metrics-not-implemented-azm-and-breathing-rate)
- [Limitations and Notes](#limitations-and-notes)
  - [Intraday Data (403 Forbidden)](#intraday-data-403-forbidden)
  - [Rate Limits](#rate-limits)
  - [Token Expiration](#token-expiration)
  - [Days Without the Watch](#days-without-the-watch)
  - [Hardware Limitations (Flex 2 and Inspire HR)](#hardware-limitations-flex-2-and-inspire-hr)
  - [Reverse Proxy / Subpath Deployment](#reverse-proxy--subpath-deployment)
- [Next Steps](#next-steps)
  - [Daily Goals per Patient](#daily-goals-per-patient)
  - [Other Candidates](#other-candidates)

## About

System with doctor and patient registration, OAuth2 authentication with Fitbit, automatic health data collection, and a web interface for visualization. Doctors can view data from all linked patients in a single dashboard.

## Features

- OAuth2 authentication with Fitbit (Authorization Code Grant)
- User CRUD (doctors and patients)
- Doctor-patient linking
- Fitbit token persistence in PostgreSQL
- Automatic token refresh (15-minute buffer before expiration)
- Cron job every 10 minutes to check device sync status
- Sync history tracking per device (`SyncHistory` entity — stores `deviceId`, `batteryLevel` %, model name, type, and sync timestamp), throttled to one entry per 30 minutes unless the battery drops 5% or more
- Battery level temporal chart (Chart.js) with device filter, date range, and per-entry selection
- Activity, sleep, heart rate, profile, and device data
- Sleep panel with per-record breakdown (main sleep + naps), 30-day average comparison per sleep stage, sleep latency and nocturnal awakening metrics, and a swimlane-style timeline chart with stage-transition lines and hover tooltips
- Time series and intraday data (minute-by-minute)\*
- Subscriptions (webhooks) and SSE for real-time data
- Web interface for management and visualization
- Docker deployment (multi-stage `Dockerfile` + Docker Compose for the API and database)
- Reverse proxy / subpath-friendly deployment (`X-Forwarded-Prefix` support and a dynamic frontend base path)

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
docker compose up -d postgres
```

> Running `docker compose up -d` without arguments starts **both** the PostgreSQL database and the API container (built from the `Dockerfile`). Use that instead of steps 3–5 for a fully containerized setup — just make sure your `.env` file (step 3) is in place first, since the API container loads it via `env_file`.

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
| **Summary Data** | Select a doctor and view all patients' data by tabs: Activity, Sleep, Week, Profile, and **Devices**. The Devices tab shows live device info and sync history with battery % chart per patient |
| **Full Data** | Select a doctor and view all consolidated data per patient (activity + sleep + HR + profile + devices + sync history with battery % chart) |

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
| GET | `/users/:id/fitbit/sync-history?limit=20` | Sync history (includes `batteryLevel` % and `deviceId` per record) |
| GET | `/users/:id/fitbit/cardio-score?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD` | VO2 Max estimate (Cardio Fitness Score) |
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

## Data Coverage

Complete reference of all data types available in the [Fitbit Web API](https://dev.fitbit.com/build/reference/web-api/), showing what this API implements for each device used in this POC.

**Sensors available per device:**

| Sensor | Flex 2 | Inspire HR |
|--------|:------:|:----------:|
| 3-axis accelerometer | ✅ | ✅ |
| Optical heart rate monitor | ❌ | ✅ |
| Connected GPS (via phone) | ❌ | ✅ |
| Altimeter | ❌ | ❌ |
| SpO2 sensor | ❌ | ❌ |
| Temperature sensor | ❌ | ❌ |
| Water resistance | 10m | 50m |

**Data coverage by device:**

| Category | Data | Fitbit API | Flex 2 | Inspire HR | Notes |
|----------|------|:----------:|:------:|:----------:|-------|
| **Activity** | Steps | ✅ | ✅ | ✅ | |
| | Calories | ✅ | ✅ | ✅ | Returns 0 if watch not worn — see [note](#days-without-the-watch) |
| | Distance | ✅ | ✅ | ✅ | |
| | Floors / Elevation | ✅ | ❌ | ❌ | No altimeter on either — always returns 0 |
| | Active minutes (sedentary/light/moderate/intense) | ✅ | ✅ | ✅ | |
| | Active Zone Minutes (AZM) | ✅ | ❌ | ⚠️ | Flex 2 no HR; not implemented in this API |
| | Activity intraday | ✅ | ✅ | ✅ | Requires Personal app type |
| **Sleep** | Sleep summary | ✅ | ✅ | ✅ | |
| | Stages (light/deep/REM) | ✅ | ❌ | ✅ | Flex 2 returns basic sleep only (awake/asleep/restless) |
| | Sleep time series | ✅ | ❌ | ❌ | Not implemented |
| **Heart Rate** | Daily HR (zones + resting) | ✅ | ❌ | ✅ | Flex 2 no HR sensor |
| | HR intraday | ✅ | ❌ | ✅ | Flex 2 no HR sensor |
| | Heart Rate Variability (HRV) | ✅ | ❌ | ❌ | Neither device supports HRV |
| **Breathing** | Breathing rate | ✅ | ❌ | ⚠️ | Sleep only; not implemented — see [note](#metrics-not-implemented-azm-and-breathing-rate) |
| **Temperature** | Skin temperature | ✅ | ❌ | ❌ | No sensor on either |
| | Core body temp (manual) | ✅ | ❌ | ❌ | Manual entry only |
| **Oxygen** | SpO2 | ✅ | ❌ | ❌ | No sensor on either |
| **Cardio Fitness** | VO2 Max | ✅ | ❌ | ✅ | Flex 2 no HR; requires `cardio_fitness` scope |
| **Body** | Weight / BMI | ✅ | ⚠️ | ⚠️ | Not implemented; requires manual entry or Aria scale |
| | Body fat | ✅ | ❌ | ❌ | Requires Aria scale |
| **Nutrition** | Food logs / Water | ✅ | ❌ | ❌ | Manual entry only |
| **ECG / IRN** | Electrocardiogram | ✅ | ❌ | ❌ | Sense / Sense 2 only |
| **Profile** | User data | ✅ | ✅ | ✅ | |
| **Devices** | Device list + sync history | ✅ | ✅ | ✅ | |
| **OAuth** | Auth + token refresh | ✅ | ✅ | ✅ | |
| **Subscriptions** | Webhooks | ✅ | ✅ | ✅ | |

**Legend**: ✅ implemented and functional | ❌ unavailable (no hardware or no Fitbit API support) | ⚠️ hardware/API supports it but not implemented in this API

> **Summary**: The **Inspire HR** provides significantly richer data than the **Flex 2** thanks to its heart rate sensor, which enables sleep stages, HR zones, VO2 Max, and breathing rate. The **Flex 2** is limited to accelerometer-based data (steps, distance, basic sleep). Neither model has SpO2, temperature, ECG, or altimeter sensors.

## Health Metrics Glossary

A reference guide to every health metric this API can collect, what it measures, and its clinical relevance.

---

### Steps

The total number of steps taken in a day, detected by the device's 3-axis accelerometer. One of the most basic activity indicators. The WHO recommends at least 7,000–10,000 steps/day for general health. Useful for tracking sedentary behaviour trends in patients over time.

---

### Calories

**Total calories (caloriesOut)**: All calories the body burned in the day — basal metabolic rate (BMR) plus activity calories.

**BMR (caloriesBMR)**: Calories burned at rest just to sustain vital functions (breathing, circulation, cell repair). Estimated from the user's profile (age, height, weight, gender).

**Activity calories (activityCalories)**: Calories burned above BMR due to movement and exercise.

---

### Distance

Estimated total distance travelled (km), calculated from step count and stride length configured in the user's Fitbit profile. Less accurate without GPS — the Inspire HR uses connected GPS (via phone) for outdoor activities.

---

### Floors & Elevation

Number of floors climbed and elevation gain in metres, measured by an altimeter. **Neither the Flex 2 nor the Inspire HR has an altimeter**, so these values always return 0 for both devices.

---

### Active Minutes

Time spent in different physical activity intensities, classified by METs (Metabolic Equivalent of Task):

| Field | Intensity | METs |
|---|---|---|
| `sedentaryMinutes` | Sitting / no movement | < 1.5 |
| `lightlyActiveMinutes` | Light activity (slow walk) | 1.5–2.9 |
| `fairlyActiveMinutes` | Moderate activity (brisk walk) | 3–5.9 |
| `veryActiveMinutes` | Vigorous activity (running) | ≥ 6 |

The WHO recommends 150 min/week of moderate-to-vigorous activity (≥ 21 min/day of `fairlyActive` + `veryActive`).

---

### Heart Rate

The Inspire HR measures heart rate continuously via optical photoplethysmography (PPG) — a green LED that detects blood volume changes in the wrist.

**Resting heart rate (restingHeartRate)**: Average heart rate during the lowest-activity period of the day, usually measured during deep sleep. A lower resting HR generally indicates better cardiovascular fitness. Normal range: 60–100 bpm; athletes may go below 60.

**Heart rate zones**: Ranges based on percentage of maximum estimated HR (220 − age):

| Zone | % of Max HR | Benefit |
|---|---|---|
| Out of Range | < 50% | Everyday activity |
| Fat Burn | 50–69% | Fat metabolism |
| Cardio | 70–84% | Cardiovascular endurance |
| Peak | 85–100% | Anaerobic performance |

---

### Active Zone Minutes (AZM)

A Fitbit-specific metric that counts time spent in elevated heart rate zones throughout the day, weighted by intensity:

| Zone | Points per minute |
|---|---|
| Fat Burn | 1 point |
| Cardio | 2 points |
| Peak | 2 points |

The default goal is 22 AZM/day (equivalent to the WHO's 150 min/week recommendation). Useful for tracking whether a patient is meeting physical activity guidelines.

> **Note**: Not implemented in this API — see the [Metrics Not Implemented](#metrics-not-implemented-azm-and-breathing-rate) section.

---

### Sleep

Sleep data summarises each sleep session logged automatically by the device.

**Duration metrics**:
- `totalMinutesAsleep`: Time actually asleep (excluding awake periods)
- `totalTimeInBed`: Total time between sleep start and wake-up
- `efficiency`: `(minutesAsleep / timeInBed) × 100`. Values above 85% are generally considered healthy

**Sleep stages** (requires heart rate sensor — available on Inspire HR, not Flex 2):

| Stage | Description | Typical % of sleep |
|---|---|---|
| Light sleep | Transition phase, body slows down | 45–55% |
| Deep sleep | Physical restoration, immune function | 10–25% |
| REM sleep | Memory consolidation, dreams | 20–25% |
| Wake | Brief awakenings (normal if < 5% of time) | < 5% |

Disrupted sleep stages are associated with cardiovascular disease, diabetes, and cognitive decline.

**Multiple records per day**: Fitbit logs one entry per sleep session — the main overnight sleep (`isMainSleep: true`) plus any naps. The web interface shows a tab selector ("★ Main Sleep" / "◌ Nap N") with an individual panel per record.

**Additional per-record metrics**:
- **Sleep latency**: time to fall asleep, derived from the first entry of the stage timeline (`levels.data[0]`) when it is a `wake` segment
- **Nocturnal awakening**: total minutes of brief awakenings during the night, summed from Fitbit's `levels.shortData` (sub-minute `wake` events not counted in the main stage summary)
- **30-day average comparison**: each stage (deep/light/REM/wake) is compared against Fitbit's `thirtyDayAvgMinutes`, shown only for the main sleep record (naps have no 30-day baseline)

**Sleep timeline chart**: a swimlane-style canvas chart with one horizontal track per stage (deep, light, REM, total awake, nocturnal awakening), built from Fitbit's per-stage timeline (`levels.data` / `levels.shortData`). Vertical lines connect consecutive stage transitions, colored by the originating stage, and hovering a segment shows a tooltip with its duration.

---

### VO2 Max (Cardio Fitness Score)

VO2 Max (maximal oxygen uptake) is the maximum rate at which the body can consume oxygen during intense exercise, expressed in **mL of O₂ per kg of body weight per minute (mL/kg/min)**. It is considered one of the strongest predictors of long-term cardiovascular health and all-cause mortality.

The Fitbit Inspire HR **estimates** VO2 Max using heart rate data during outdoor walks or runs (using connected GPS), combined with resting heart rate over time. It does not require a lab test.

The API returns a range string (e.g., `"40-44"`) rather than a precise value, reflecting the estimation nature of the measurement.

**Reference ranges (adults 30–39 years):**

| Classification | Women (mL/kg/min) | Men (mL/kg/min) |
|---|---|---|
| Excellent | > 45 | > 52 |
| Good | 38–45 | 44–52 |
| Average | 32–37 | 37–43 |
| Below average | 26–31 | 31–36 |
| Poor | < 26 | < 31 |

Values decline with age and sedentary lifestyle. Monitoring VO2 Max over time can help doctors assess a patient's cardiovascular fitness trajectory.

---

### Breathing Rate

Estimated number of breaths per minute during sleep, derived from heart rate variability (HRV) analysis. Normal range during sleep: **12–20 breaths/min**.

The Inspire HR estimates this without an SpO2 sensor, using subtle variations in beat-to-beat intervals (rRR intervals) recorded by the optical HR sensor. Accuracy is lower than devices with SpO2 (like Sense 2 or Charge 6).

Persistently elevated breathing rate during sleep may indicate respiratory issues, anxiety, sleep apnea, or deteriorating cardiovascular health.

> **Note**: Not implemented in this API — see the [Metrics Not Implemented](#metrics-not-implemented-azm-and-breathing-rate) section.

---

### Profile Data

Static user information stored in the Fitbit account: full name, date of birth, height, weight, gender, country, timezone, and stride lengths. Used to contextualise health metrics (e.g., BMR calculation, VO2 Max estimation).

---

### Device & Sync Data

Information about the physical wearable connected to the account: model name, type (TRACKER/SCALE), battery level (percentage), battery status (Full/Medium/Low/Empty), and last sync timestamp. The API also stores a local `SyncHistory` per device, enabling battery trend tracking over time.

---

## Metrics Not Implemented: AZM and Breathing Rate

### Active Zone Minutes (AZM)

Active Zone Minutes measure how long a user spends in elevated heart rate zones throughout the day. The Fitbit API provides a dedicated endpoint for this metric, and the Inspire HR hardware supports it. However, the Fitbit Web API requires a separate OAuth scope (`oxygen_saturation` or `activity` — depending on the API version) and, more importantly, the AZM endpoint (`/1/user/-/activities/active-zone-minutes/date/...`) returns cumulative daily totals but does not offer a meaningful date range history in the same way as the Cardio Score. For this POC, AZM data is partially available through the standard activity endpoint (`summary.activeZoneMinutes`), so a dedicated endpoint was deemed redundant. It can be added in a future iteration if granular AZM tracking is required.

### Breathing Rate

Breathing Rate (respiratory rate in breaths per minute) is estimated by the Inspire HR **during sleep only**, using heart rate variability analysis — the device does not have an SpO2 sensor. The Fitbit API exposes this data via `/1/user/-/br/date/[date].json` and requires an additional OAuth scope (`respiratory_rate`). This metric was not implemented because:

1. **Sleep-only coverage**: The data is only available for sleep periods, limiting its clinical utility outside of sleep analysis already covered by the sleep endpoint.
2. **Scope re-authorization**: Adding this scope requires all existing users to re-authorize the application, which is a disruptive change for a POC.
3. **Inspire HR estimation accuracy**: Without SpO2, breathing rate is an estimation with lower accuracy compared to devices like the Sense 2. In a clinical context, presenting estimated respiratory data without clearly communicating its limitations could be misleading.

Both metrics remain viable candidates for a future version of the system, particularly if the device fleet is upgraded to models with SpO2 sensors (Sense 2, Charge 6).

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

### Days Without the Watch

When the device is not worn for a full day, the Fitbit API **does not return zeros or an error** — it fills the day with an estimated Basal Metabolic Rate (BMR) based on the user's profile (age, height, weight, gender). This produces misleading data that can appear higher than active days:

| Field | Value when watch not worn |
|-------|--------------------------|
| `steps` | 0–9 |
| `sedentaryMinutes` | ~1,440 (full day) |
| `caloriesOut` | ~1,400–2,000 (pure BMR estimate) |
| Heart rate zones | 1,440 min in "Out of Range" |

This API detects this pattern (`steps < 10` and `sedentaryMinutes > 1,400`) and displays a warning banner in the web interface, marking the calorie value as a BMR estimate rather than a measured value. **This data should be excluded from clinical analysis.**

### Hardware Limitations (Flex 2 and Inspire HR)
- **Floors/elevation**: Both lack an altimeter, endpoint returns 0
- **Heart rate**: Flex 2 has no optical HR sensor
- **Sleep stages**: Flex 2 returns basic sleep only (awake/asleep/restless)
- **SpO2, temperature, ECG, HRV**: Neither model has these sensors

### Reverse Proxy / Subpath Deployment

When deployed behind a reverse proxy (e.g., NGINX) under a subpath (e.g., `https://example.com/fitbit-api/`), the app needs to know that prefix to build correct redirect URLs and API calls:

- **OAuth callback redirect**: `GET /fitbit/callback` reads the `X-Forwarded-Prefix` header to prefix the `/fitbit/connect` redirect. Configure your reverse proxy to send it (e.g., `proxy_set_header X-Forwarded-Prefix /fitbit-api;` in NGINX).
- **Frontend API base**: the web interface (`public/index.html`, `public/fitbit-connect.html`) derives its API base URL from `window.location.pathname` at runtime, so it works under any subpath without a build-time configuration.

## Next Steps

Potential improvements for future iterations of this project.

### Daily Goals per Patient

The Fitbit Web API supports writing activity goals via:

```
POST /1/user/-/activities/goals/daily.json
  Body: type=steps&value=10000
```

Available goal types: `steps`, `caloriesOut`, `distance`, `floors`, `activeMinutes`.

Since this API already stores each patient's OAuth access token, a doctor could set goals on behalf of a patient by making write requests using that token. A suggested endpoint:

```
POST /users/:id/fitbit/goals
Body: { "steps": 10000, "caloriesOut": 2500, "activeMinutes": 30 }
```

> **Important**: the patient consented to the app reading their data via OAuth. Setting goals remotely on their behalf is technically possible but requires explicit informed consent from the patient.

### Other Candidates

| Feature | Notes |
|---|---|
| JWT authentication + role guards | Protect endpoints with DOCTOR/PATIENT roles |
| Active Zone Minutes (AZM) | Inspire HR supports it; available in `summary.activeZoneMinutes` |
| Breathing Rate | Inspire HR estimates during sleep; requires `respiratory_rate` scope |
| Weight / BMI history | Scope already authorized; requires Body Logs endpoint |
| SpO2 / HRV / Temperature | Requires hardware upgrade (Sense 2, Charge 6) |
