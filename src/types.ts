export type RiskLevel = 'GREEN' | 'YELLOW' | 'RED';

export interface PatientData {
  name?: string;
  age?: string;
  gender?: string;
  symptoms?: string;
  duration?: string;
  severity?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  isRedFlag?: boolean;
  triageReport?: TriageReport;
}

export interface TriageReport {
  patientSummary: string;
  symptomsReported: string;
  riskLevel: RiskLevel;
  reason: string;
  recommendation: string;
}

export type Language = 'en' | 'hi';
