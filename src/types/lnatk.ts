export type CityName = 'Santa Rosa' | 'Biñan' | 'San Pedro';
export type PortalRole = 'landing' | 'tk' | 'coordinator' | 'officer';
export type OfficerTab = 'grid' | 'dashboard' | 'inbox' | 'admin' | 'reports' | 'events' | 'upcoming';
export type AttendanceStatus = 'D' | 'S' | 'A' | 'P' | 'N' | 'K' | 'NP';

export const STATUS_FULL_LABELS: Record<AttendanceStatus, string> = {
  D: 'D - Dumalo',
  S: 'S - Sumayaw',
  A: 'A - Absent',
  P: 'P - Program',
  N: 'N - No Attendance',
  K: 'K - Kids TK Practice',
  NP: 'N - No Practice',
};

/** Practice reuses the letters D and S with different meanings. */
export const PRACTICE_LABELS: Partial<Record<AttendanceStatus, string>> = {
  D: 'D - District TK Practice',
  S: 'S - Self Study',
};

export const statusLabel = (st: AttendanceStatus, sessionType: string): string =>
  (sessionType === 'Practice' && PRACTICE_LABELS[st]) || STATUS_FULL_LABELS[st];

/** NP (No Practice) is shown as "N" in cells, in its own colour. */
export const statusShort = (st: AttendanceStatus): string => (st === 'NP' ? 'N' : st);

export interface LocaleItem {
  id: number;
  city: CityName;
  name: string;
  code: string;
  coordinator: string;
  contact: string;
  pin: string;
  failedAttempts: number;
  active: boolean;
}

export interface SessionItem {
  id: string;
  type: 'PM' | 'WS' | 'TG' | 'SPBB' | 'Practice';
  label: string;
  shortLabel: string;
  date: string;
  weekNum: number;
  code: string | null;
  confirmViewing: boolean;
  allowed: AttendanceStatus[];
  statusWindow: 'open' | 'live' | 'closed';
}

export interface MemberItem {
  id: string;
  localeId: number;
  fullName: string;
  joinedAt: string;
  leftAt: string | null;
}

export interface AttendanceLogItem {
  memberId: string;
  sessionId: string;
  status: AttendanceStatus;
  source: 'self' | 'coordinator' | 'officer';
  attendedVia: 'live' | 'viewing' | null;
  confirmed: boolean;
  updatedAt: string;
}

export interface EditHistoryItem {
  id: string;
  memberName: string;
  localeName: string;
  sessionLabel: string;
  oldStatus: string;
  newStatus: string;
  by: string;
  at: string;
  reason: string;
}

export interface TkConcern {
  memberId: string;
  name: string;
  text: string;
}

export interface MonthlyReport {
  id: string;
  localeId: number;
  month: string; // 'YYYY-MM'
  position: string;
  coordinatorName: string;
  tkConcerns: TkConcern[];
  general: string;
  actions: string;
  other: string;
  submittedAt: string;
  reviewed: boolean;
}

export interface EventItem {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  endDate: string | null;
  time: string | null; // HH:MM
  location: string;
  details: string;
}
