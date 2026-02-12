import { Injectable } from '@nestjs/common';
import { PatientSession } from './entities/patient-session.entity';

@Injectable()
export class SessionService {
  // In production, use a database instead of in-memory storage
  private sessions: Map<string, PatientSession[]> = new Map();

  addPatientToSession(sessionId: string, patient: PatientSession) {
    const patients = this.sessions.get(sessionId) || [];
    patients.push(patient);
    this.sessions.set(sessionId, patients);
  }

  removePatientFromSession(sessionId: string, patientId: string) {
    const patients = this.sessions.get(sessionId) || [];
    const filtered = patients.filter((p) => p.id !== patientId);
    this.sessions.set(sessionId, filtered);
  }

  getSessionPatients(sessionId: string): PatientSession[] {
    return this.sessions.get(sessionId) || [];
  }

  endSession(sessionId: string) {
    this.sessions.delete(sessionId);
  }
}
