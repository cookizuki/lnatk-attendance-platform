// =============================================================================
// LNATK ATTENDANCE PLATFORM — SUPABASE BACKEND SERVICE & REALTIME API
// File: src/lib/supabaseApi.ts
// Stack: @supabase/supabase-js + TypeScript
// =============================================================================

import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';

export type AttendanceStatus = 'D' | 'S' | 'A' | 'P' | 'N' | 'K' | 'NP';
export type AttendanceSource = 'self' | 'coordinator' | 'officer';

export const STATUS_FULL_LABELS: Record<AttendanceStatus, string> = {
  D: 'D - Dumalo',
  S: 'S - Sumayaw',
  A: 'A - Absent',
  P: 'P - Program',
  N: 'N - No Attendance',
  K: 'K - Kids TK Practice',
  NP: 'N - No Practice',
};

export interface LocaleInfo {
  locale_id: number;
  city_name: 'Santa Rosa' | 'Biñan' | 'San Pedro';
  locale_name: string;
  access_code: string;
  coordinator_name: string;
}

export interface MemberRow {
  id: string;
  fullName: string;
  joinedAt: string;
}

export interface SessionColumn {
  id: string;
  type: 'PM' | 'WS' | 'TG' | 'SPBB' | 'Practice';
  date: string;
  allowed: AttendanceStatus[];
  opensAt: string;
  entriesCloseAt: string;
}

export interface AttendanceCellLog {
  memberId: string;
  sessionId: string;
  status: AttendanceStatus;
  source: AttendanceSource;
  confirmed: boolean;
}

export interface LocaleDutySheetPayload {
  members: MemberRow[];
  sessions: SessionColumn[];
  logs: AttendanceCellLog[];
}

export interface DistrictSummaryRow {
  city: string;
  locale_id: number;
  locale: string;
  month_year: string;
  weeks_3_4_duty: number;
  weeks_1_2_duty: number;
  no_duty: number;
  total: number;
  remarks: string | null;
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
// Accept either variable name (Supabase now labels this key "publishable").
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) as string | undefined;

export const isSupabaseConfigured = Boolean(
  supabaseUrl && supabaseAnonKey && !supabaseUrl.includes('your-project')
);

export const supabase: SupabaseClient = createClient(
  supabaseUrl || 'https://your-project.supabase.co',
  supabaseAnonKey || 'your-public-anon-key'
);

// -----------------------------------------------------------------------------
// 1. Public / Regular TK & Coordinator RPC Calls (SECURITY DEFINER)
// -----------------------------------------------------------------------------

/**
 * Fetches all 18 active locales grouped across Santa Rosa, Biñan, and San Pedro
 * for the Regular TK City & Locale dropdowns.
 */
export async function fetchActiveLocales(): Promise<LocaleInfo[]> {
  const { data, error } = await supabase.rpc('get_active_locales');
  if (error) throw new Error(error.message);
  return (data ?? []) as LocaleInfo[];
}

/**
 * Loads the full Regular Duty Sheet for a specific locale and month ('YYYY-MM').
 */
export async function fetchLocaleDutySheet(
  localeId: number,
  monthYear: string
): Promise<LocaleDutySheetPayload> {
  const { data, error } = await supabase.rpc('get_locale_duty_sheet', {
    p_locale_id: localeId,
    p_month_year: monthYear,
  });
  if (error) throw new Error(error.message);
  return data as LocaleDutySheetPayload;
}

/**
 * Updates a single cell in the Regular Duty Sheet (used by Regular TK & Coordinator
 * when clicking a cell dropdown and picking D - Dumalo, S - Sumayaw, etc.).
 */
export async function updateTableCellStatus(params: {
  localeId: number;
  memberId: string;
  sessionId: string;
  status: AttendanceStatus;
  source: 'self' | 'coordinator';
  localeCode?: string; // required when source === 'coordinator'
  pin?: string;        // required when source === 'coordinator'
}) {
  const { data, error } = await supabase.rpc('submit_table_cell_status', {
    p_locale_id: params.localeId,
    p_member_id: params.memberId,
    p_session_id: params.sessionId,
    p_status: params.status,
    p_source: params.source,
    p_locale_code: params.localeCode ?? null,
    p_pin: params.pin ?? null,
  });
  if (error) throw new Error(error.message);
  if (data && data.ok === false) throw new Error(data.error);
  return data;
}

/**
 * Coordinator Batch TG Roster submission with PIN verification and 5-attempt lockout.
 */
export async function submitCoordinatorBatchRoster(params: {
  localeCode: string;
  pin: string;
  sessionId: string;
  entries: Array<{ member_id: string; status: AttendanceStatus }>;
}) {
  const { data, error } = await supabase.rpc('submit_for_locale', {
    p_locale_code: params.localeCode,
    p_pin: params.pin,
    p_session_id: params.sessionId,
    p_entries: params.entries,
  });
  if (error) throw new Error(error.message);
  if (data && data.ok === false) throw new Error(data.error);
  return data;
}

/** Server-side coordinator code + PIN check (5 wrong tries = 15 min lockout). */
export async function coordinatorLogin(localeCode: string, pin: string) {
  const { data, error } = await supabase.rpc('coordinator_login', {
    p_locale_code: localeCode,
    p_pin: pin,
  });
  if (error) throw new Error(error.message);
  if (!data?.ok) throw new Error(data?.error ?? 'Login failed');
  return data as { ok: true; locale_id: number; locale_name: string };
}

// -----------------------------------------------------------------------------
// 2. Officer Authenticated Queries & Mutations (RLS Protected)
// -----------------------------------------------------------------------------

export async function signInOfficer(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  return data;
}

export async function signOutOfficer() {
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(error.message);
}

/**
 * Officer cell edit with audit log entry in `attendance_edits`.
 */
export async function officerEditAttendanceCell(params: {
  memberId: string;
  sessionId: string;
  oldStatus: AttendanceStatus;
  newStatus: AttendanceStatus;
  reason: string;
}) {
  const { data: userRes } = await supabase.auth.getUser();
  const officerId = userRes.user?.id ?? null;

  const { data: upserted, error: upsertErr } = await supabase
    .from('attendance_logs')
    .upsert(
      {
        member_id: params.memberId,
        session_id: params.sessionId,
        status: params.newStatus,
        source: 'officer',
        attended_via: 'live',
        confirmed: true,
        updated_by: officerId,
      },
      { onConflict: 'member_id,session_id' }
    )
    .select('id')
    .single();

  if (upsertErr) throw new Error(upsertErr.message);

  const { error: editErr } = await supabase.from('attendance_edits').insert({
    log_id: upserted.id,
    old_status: params.oldStatus,
    new_status: params.newStatus,
    changed_by: officerId,
    reason: params.reason || 'Officer inline sheet edit',
  });

  if (editErr) throw new Error(editErr.message);
  return upserted;
}

/**
 * Fetches the Monthly District Rollup across all 18 locales from `v_monthly_district_summary`.
 */
export async function fetchDistrictRollup(monthYear: string): Promise<DistrictSummaryRow[]> {
  const { data, error } = await supabase
    .from('v_monthly_district_summary')
    .select('*')
    .eq('month_year', monthYear)
    .order('city')
    .order('locale');

  if (error) throw new Error(error.message);
  return (data ?? []) as DistrictSummaryRow[];
}

/**
 * Saves monthly remarks for a locale in `monthly_reports`.
 */
export async function saveLocaleMonthlyRemarks(params: {
  localeId: number;
  monthYear: string;
  remarks: string;
}) {
  const { data: userRes } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('monthly_reports')
    .upsert(
      {
        locale_id: params.localeId,
        month_year: params.monthYear,
        remarks: params.remarks,
        submitted_by: userRes.user?.id ?? null,
      },
      { onConflict: 'locale_id,month_year' }
    )
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

// -----------------------------------------------------------------------------
// 3. Realtime Subscription for Live Venue Board (Per-Locale TG Updates)
// -----------------------------------------------------------------------------

export function subscribeToAttendanceChanges(
  onUpdate: () => void
): RealtimeChannel {
  return supabase
    .channel('lnatk-attendance-live')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'attendance_logs' },
      () => onUpdate()
    )
    .subscribe();
}

// -----------------------------------------------------------------------------
// 4. Monthly coordinator reports + member management (see 003_lnatk_reports.sql)
// -----------------------------------------------------------------------------

export async function submitCoordinatorReport(p: {
  localeId: number; pin: string; month: string; position: string; name: string;
  tkConcerns: Array<{ memberId: string; name: string; text: string }>;
  general: string; actions: string; other: string;
}) {
  const { data, error } = await supabase.rpc('submit_coordinator_report', {
    p_locale_id: p.localeId, p_pin: p.pin, p_month: p.month, p_position: p.position,
    p_name: p.name, p_tk_concerns: p.tkConcerns, p_general: p.general,
    p_actions: p.actions, p_other: p.other,
  });
  if (error) throw new Error(error.message);
  if (data && data.ok === false) throw new Error(data.error);
  return data;
}

export async function fetchCoordinatorReports(month: string) {
  const { data, error } = await supabase.from('coordinator_reports').select('*').eq('month_year', month);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function markReportReviewed(localeId: number, month: string) {
  const { error } = await supabase.from('coordinator_reports')
    .update({ reviewed: true }).eq('locale_id', localeId).eq('month_year', month);
  if (error) throw new Error(error.message);
}

export async function officerAddMember(localeId: number, fullName: string): Promise<string> {
  const { data: u } = await supabase.auth.getUser();
  const { data, error } = await supabase.from('members')
    .insert({ locale_id: localeId, full_name: fullName, created_by: u.user?.id ?? null })
    .select('id').single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

export async function officerRenameMember(memberId: string, fullName: string) {
  const { error } = await supabase.from('members').update({ full_name: fullName }).eq('id', memberId);
  if (error) throw new Error(error.message);
}

/** leftAt = 'YYYY-MM-DD' removes the member from the locale; null restores them. */
export async function officerSetMemberLeft(memberId: string, leftAt: string | null) {
  const { error } = await supabase.from('members').update({ left_at: leftAt }).eq('id', memberId);
  if (error) throw new Error(error.message);
}

export async function officerCreateSpbbEvent(eventName: string, dates: string[]) {
  const { error } = await supabase.rpc('create_spbb_event', { p_event_name: eventName, p_dates: dates });
  if (error) throw new Error(error.message);
}

export async function officerDeleteSpbbEvent(eventName: string) {
  const { error } = await supabase.rpc('delete_spbb_event', { p_event_name: eventName });
  if (error) throw new Error(error.message);
}
