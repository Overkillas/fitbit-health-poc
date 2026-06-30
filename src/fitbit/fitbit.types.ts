// ========================================
// Fitbit API Response Types
// ========================================

export interface FitbitTokenResponse {
  access_token: string;
  refresh_token: string;
  user_id: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

export interface FitbitActivityLog {
  activityId: number;
  activityParentId: number;
  calories: number;
  description: string;
  duration: number;
  hasStartTime: boolean;
  isFavorite: boolean;
  logId: number;
  name: string;
  startDate: string;
  startTime: string;
  steps: number;
}

export interface FitbitActivityResponse {
  activities: FitbitActivityLog[];
  goals: {
    activeMinutes: number;
    caloriesOut: number;
    distance: number;
    floors: number;
    steps: number;
  };
  summary: {
    activeScore: number;
    activityCalories: number;
    caloriesBMR: number;
    caloriesOut: number;
    distances: Array<{ activity: string; distance: number }>;
    fairlyActiveMinutes: number;
    lightlyActiveMinutes: number;
    marginalCalories: number;
    sedentaryMinutes: number;
    steps: number;
    veryActiveMinutes: number;
  };
}

export interface FitbitSleepLog {
  dateOfSleep: string;
  duration: number;
  efficiency: number;
  isMainSleep: boolean;
  logId: number;
  minutesAfterWakeup: number;
  minutesAsleep: number;
  minutesAwake: number;
  minutesToFallAsleep: number;
  startTime: string;
  timeInBed: number;
  type: string;
  levels?: {
    data: Array<{ dateTime: string; level: string; seconds: number }>;
    shortData: Array<{ dateTime: string; level: string; seconds: number }>;
    summary: {
      deep?: { count: number; minutes: number; thirtyDayAvgMinutes: number };
      light?: { count: number; minutes: number; thirtyDayAvgMinutes: number };
      rem?: { count: number; minutes: number; thirtyDayAvgMinutes: number };
      wake?: { count: number; minutes: number; thirtyDayAvgMinutes: number };
    };
  };
}

export interface FitbitSleepResponse {
  sleep: FitbitSleepLog[];
  summary: {
    totalMinutesAsleep: number;
    totalSleepRecords: number;
    totalTimeInBed: number;
    stages?: {
      deep: number;
      light: number;
      rem: number;
      wake: number;
    };
  };
}

export interface FitbitHeartRateZone {
  caloriesOut: number;
  max: number;
  min: number;
  minutes: number;
  name: string;
}

export interface FitbitHeartRateResponse {
  'activities-heart': Array<{
    dateTime: string;
    value: {
      customHeartRateZones: FitbitHeartRateZone[];
      heartRateZones: FitbitHeartRateZone[];
      restingHeartRate?: number;
    };
  }>;
  'activities-heart-intraday'?: {
    dataset: Array<{ time: string; value: number }>;
    datasetInterval: number;
    datasetType: string;
  };
}

export interface FitbitDeviceInfo {
  battery: string;
  batteryLevel: number;
  deviceVersion: string;
  features: string[];
  id: string;
  lastSyncTime: string;
  mac: string;
  type: string;
}

export interface FitbitProfileResponse {
  user: {
    age: number;
    avatar: string;
    averageDailySteps: number;
    country: string;
    dateOfBirth: string;
    displayName: string;
    encodedId: string;
    fullName: string;
    gender: string;
    height: number;
    weight: number;
    strideLengthWalking: number;
    strideLengthRunning: number;
    timezone: string;
  };
}

export interface FitbitTimeSeriesDataPoint {
  dateTime: string;
  value: string;
}

export interface FitbitTimeSeriesResponse {
  [key: string]: FitbitTimeSeriesDataPoint[];
}

export interface FitbitIntradayResponse {
  [key: string]: unknown;
}

// ========================================
// Application-level composite types
// ========================================

export interface WeekDayData {
  date: string;
  activity: FitbitActivityResponse;
  sleep: FitbitSleepResponse;
}

export interface WeekDayError {
  date: string;
  error: boolean;
  details: string;
}

export interface PatientFitbitResult {
  userId: number;
  userName: string;
  success: boolean;
  data?: unknown;
  error?: string;
  date?: string;
}

export interface UserAllFitbitData {
  userId: number;
  userName: string;
  date: string;
  success: boolean;
  activity: FitbitActivityResponse | { error: string };
  sleep: FitbitSleepResponse | { error: string };
  heartRate: FitbitHeartRateResponse | { error: string };
  error?: string;
}

export interface FitbitCardioScoreValue {
  vo2Max: string;
}

export interface FitbitCardioScoreEntry {
  dateTime: string;
  value: FitbitCardioScoreValue;
}

export interface FitbitCardioScoreResponse {
  cardioScore: FitbitCardioScoreEntry[];
}

export interface PatientPollingData {
  patientId: string;
  timestamp: string;
  heartRate: Array<{ time: string; value: number }>;
  steps: Array<{ time: string; value: number }>;
  patientName?: string;
}

export interface FitbitWebhookNotification {
  collectionType: string;
  ownerId: string;
  ownerType: string;
  subscriptionId: string;
}
