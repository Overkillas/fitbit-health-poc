import { Injectable } from '@nestjs/common';
import { PatientSession } from './entities/patient-session.entity';

@Injectable()
export class SessionService {
  // Em produção, use um banco de dados
  private sessions: Map<string, PatientSession[]> = new Map();

  // Adiciona um paciente a uma sessão
  addPatientToSession(sessionId: string, patient: PatientSession) {
    const patients = this.sessions.get(sessionId) || [];
    patients.push(patient);
    this.sessions.set(sessionId, patients);
  }

  // Remove um paciente de uma sessão
  removePatientFromSession(sessionId: string, patientId: string) {
    const patients = this.sessions.get(sessionId) || [];
    const filtered = patients.filter(p => p.id !== patientId);
    this.sessions.set(sessionId, filtered);
  }

  // Retorna todos os pacientes de uma sessão
  getSessionPatients(sessionId: string): PatientSession[] {
    return this.sessions.get(sessionId) || [];
  }

  // Remove uma sessão completa
  endSession(sessionId: string) {
    this.sessions.delete(sessionId);
  }
}
