import { supabase } from './supabaseApi';
import {
  AttendanceLogItem, AttendanceStatus, EventItem, LocaleItem, MemberItem, MonthlyReport, SessionItem,
} from '../types/lnatk';

export interface RawSession {
  id: string; type: SessionItem['type']; date: string; allowed: AttendanceStatus[];
  opensAt: string; liveClosesAt: string | null; entriesCloseAt: string; confirmViewing: boolean;
  dayNumber: number | null; eventName: string | null;
}
export interface RawSheet {
  members: MemberItem[]; sessions: RawSession[];
  logs: Array<{ memberId: string; sessionId: string; status: AttendanceStatus; source: AttendanceLogItem['source'];
    attendedVia: AttendanceLogItem['attendedVia']; confirmed: boolean; updatedAt: string }>;
}
export interface OfficerMonth extends RawSheet {
  locales: Array<{ id: number; city: LocaleItem['city']; name: string; code: string; coordinator: string | null;
    contact: string | null; active: boolean }>;
  reports: MonthlyReport[];
}

export async function ensureSessions() {
  await supabase.rpc('ensure_sessions');
}

export async function fetchOfficerMonth(month: string): Promise<OfficerMonth> {
  const { data, error } = await supabase.rpc('officer_load_month', { p_month: month });
  if (error) throw new Error(error.message);
  return data as OfficerMonth;
}

export async function fetchCoordinatorReport(localeId: number, pin: string, month: string) {
  const { data, error } = await supabase.rpc('get_coordinator_report', {
    p_locale_id: localeId, p_pin: pin, p_month: month,
  });
  if (error) throw new Error(error.message);
  if (data && data.ok === false) throw new Error(data.error);
  return (data?.report ?? null) as MonthlyReport | null;
}

const mondayOf = (d: string) => {
  const dt = new Date(`${d}T00:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() - ((dt.getUTCDay() + 6) % 7));
  return dt.toISOString().slice(0, 10);
};

/** Adds week numbers, labels and the open/live/closed window the UI needs. */
export function decorateSessions(raw: RawSession[], now = new Date()): SessionItem[] {
  const weeks = [...new Set(raw.map((s) => mondayOf(s.date)))].sort();
  const rank: Record<string, number> = { PM: 1, WS: 2, Practice: 3, TG: 4, SPBB: 5 };
  const sorted = [...raw].sort((a, b) => a.date.localeCompare(b.date) || (rank[a.type] ?? 9) - (rank[b.type] ?? 9));
  return sorted.map((s) => {
    const weekNum = weeks.indexOf(mondayOf(s.date)) + 1;
    const t = now.getTime();
    const opens = new Date(s.opensAt).getTime();
    const closes = new Date(s.entriesCloseAt).getTime();
    const liveEnd = s.liveClosesAt ? new Date(s.liveClosesAt).getTime() : null;
    const statusWindow: SessionItem['statusWindow'] =
      t < opens || t > closes ? 'closed' : liveEnd !== null && t <= liveEnd ? 'live' : 'open';
    const isSpbb = s.type === 'SPBB';
    return {
      id: s.id,
      type: s.type,
      label: isSpbb ? `${s.eventName ?? 'SPBB'} D${s.dayNumber ?? ''}` : `Week ${weekNum} ${s.type}`,
      shortLabel: isSpbb ? `D${s.dayNumber ?? ''}` : s.type === 'Practice' ? 'PRAC' : s.type,
      date: s.date,
      weekNum,
      code: null,
      confirmViewing: s.confirmViewing,
      allowed: s.allowed,
      statusWindow,
    };
  });
}

export function mapLogs(raw: RawSheet['logs']): Record<string, AttendanceLogItem> {
  const out: Record<string, AttendanceLogItem> = {};
  raw.forEach((l) => {
    out[`${l.memberId}_${l.sessionId}`] = {
      memberId: l.memberId, sessionId: l.sessionId, status: l.status, source: l.source,
      attendedVia: l.attendedVia, confirmed: l.confirmed,
      updatedAt: new Date(l.updatedAt).toLocaleString('en-PH', { dateStyle: 'short', timeStyle: 'short' }),
    };
  });
  return out;
}

export function mapLocales(rows: OfficerMonth['locales']): LocaleItem[] {
  return rows.map((l) => ({
    id: l.id, city: l.city, name: l.name, code: l.code ?? '', coordinator: l.coordinator ?? '',
    contact: l.contact ?? '', pin: '', failedAttempts: 0, active: l.active,
  }));
}

export function formatReports(rows: MonthlyReport[]): MonthlyReport[] {
  return rows.map((r) => ({
    ...r,
    submittedAt: new Date(r.submittedAt).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' }),
  }));
}

// ---- Upcoming events -------------------------------------------------------
interface EventRow {
  id: string; title: string; event_date: string; end_date: string | null;
  start_time: string | null; location: string | null; details: string | null;
}
const mapEvents = (rows: EventRow[]): EventItem[] =>
  rows.map((r) => ({
    id: r.id, title: r.title, date: r.event_date, endDate: r.end_date,
    time: r.start_time ? r.start_time.slice(0, 5) : null,
    location: r.location ?? '', details: r.details ?? '',
  }));

/** Public: only events that haven't finished yet. */
export async function fetchUpcomingEvents(): Promise<EventItem[]> {
  const { data, error } = await supabase.rpc('get_upcoming_events');
  if (error) throw new Error(error.message);
  return mapEvents((data ?? []) as EventRow[]);
}

/** Officers: everything, including past events. */
export async function officerFetchEvents(): Promise<EventItem[]> {
  const { data, error } = await supabase.from('events').select('*').order('event_date', { ascending: false });
  if (error) throw new Error(error.message);
  return mapEvents((data ?? []) as EventRow[]);
}

export async function officerSaveEvent(ev: Omit<EventItem, 'id'> & { id?: string }): Promise<string> {
  const row = {
    title: ev.title, event_date: ev.date, end_date: ev.endDate || null, start_time: ev.time || null,
    location: ev.location || null, details: ev.details || null,
  };
  if (ev.id) {
    const { error } = await supabase.from('events').update(row).eq('id', ev.id);
    if (error) throw new Error(error.message);
    return ev.id;
  }
  const { data: u } = await supabase.auth.getUser();
  const { data, error } = await supabase.from('events').insert({ ...row, created_by: u.user?.id ?? null }).select('id').single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

export async function officerDeleteEvent(id: string) {
  const { error } = await supabase.from('events').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
