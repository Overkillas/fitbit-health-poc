export interface PatientSession {
  id: string;
  userId: string; // Fitbit user ID
  accessToken: string;
  refreshToken: string;
  sessionId: string;
  name: string;
}

export interface SessionData {
  patientId: string;
  timestamp: string;
  heartRate: Array<{ time: string; value: number }>;
  steps: Array<{ time: string; value: number }>;
}
