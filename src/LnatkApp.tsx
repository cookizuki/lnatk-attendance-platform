import React, { useState, useEffect, useMemo } from 'react';
import {
  CityName,
  PortalRole,
  OfficerTab,
  AttendanceStatus,
  statusLabel,
  TK_CATEGORY_LABELS,
  TkCategory,
  statusShort,
  LocaleItem,
  SessionItem,
  MemberItem,
  AttendanceLogItem,
  EditHistoryItem,
  EventItem,
  MonthlyReport,
} from './types/lnatk';
import { INITIAL_LOCALES, INITIAL_SESSIONS, buildSeedData } from './data/seedData';
import {
  updateTableCellStatus,
  submitCoordinatorBatchRoster,
  signInOfficer,
  signOutOfficer,
  coordinatorLogin,
  submitCoordinatorReport,
  markReportReviewed,
  officerAddMember,
  officerRenameMember,
  officerSetMemberLeft,
  officerEditAttendanceCell,
  officerCreateSpbbEvent,
  officerDeleteSpbbEvent,
  subscribeToAttendanceChanges,
  fetchActiveLocales,
  fetchLocaleDutySheet,
  supabase,
  isSupabaseConfigured,
} from './lib/supabaseApi';

import {
  ensureSessions,
  fetchOfficerMonth,
  fetchCoordinatorReport,
  decorateSessions,
  mapLogs,
  mapLocales,
  formatReports,
  RawSheet,
  fetchUpcomingEvents,
  officerFetchEvents,
  fetchMemberProfiles,
  officerUpdateMembers,
  officerSaveEvent,
  officerDeleteEvent,
} from './lib/dataLoader';
import CoordinatorReportForm from './components/CoordinatorReportForm';
import OfficerReports from './components/OfficerReports';
import MemberManager from './components/MemberManager';
import SpbbManager from './components/SpbbManager';
import UpcomingEvents from './components/UpcomingEvents';
import EventsManager from './components/EventsManager';
import TkOverview from './components/TkOverview';
import SquishSwitch from './components/SquishSwitch';
import { Sun, Moon } from 'lucide-react';
import { Panel, LEDGER_INPUT, LEDGER_SELECT, LEDGER_BTN, LEDGER_BTN_PRIMARY } from './components/ledger/LedgerComponents';
import { downloadExcel, printPdf, LocaleSummaryRow, MemberStatusRow } from './lib/exportReport';

/** "Jero Belgica" -> "Belgica, Jero". Names already written "Surname, First" are kept as typed. */
const surnameFirst = (name: string): string => {
  const t = name.trim();
  if (t.includes(',')) return t;
  const parts = t.split(/\s+/);
  if (parts.length < 2) return t;
  const last = parts.pop() as string;
  return `${last}, ${parts.join(' ')}`;
};

const currentMonthManila = () => new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 7);
const PLACEHOLDER_LOCALE: LocaleItem = {
  id: 0, city: 'Santa Rosa', name: '…', code: '', coordinator: '', contact: '', pin: '', failedAttempts: 0, active: true,
};
const OFFICER_TAB_LABELS: Record<string, string> = {
  grid: 'Duty Sheet',
  dashboard: 'Overall Status',
  inbox: 'Live Venue Board',
  reports: 'Coordinator Reports',
  admin: 'Members',
  events: 'SPBB Days',
  upcoming: 'Upcoming Events',
  overview: 'TK Overview',
};


const CELL_TONE: Record<string, string> = {
  S: 'text-emerald-700 dark:text-emerald-300 bg-emerald-500/10',
  P: 'text-brand-700 dark:text-brand-300 bg-brand-500/15',
  D: 'text-amber-700 dark:text-amber-300 bg-amber-500/10',
  A: 'text-rose-600 dark:text-rose-400 bg-rose-500/10',
  N: 'text-zinc-400 dark:text-zinc-500',
  K: 'text-sky-700 dark:text-sky-300 bg-sky-500/10',
  NP: 'text-violet-700 dark:text-violet-300 bg-violet-500/15 underline decoration-dotted',
};

// Practice reuses D and S, so give them their own colours (not duty colours).
const PRACTICE_TONE: Record<string, string> = {
  ...CELL_TONE,
  D: 'text-teal-700 dark:text-teal-300 bg-teal-500/10',
  S: 'text-lime-700 dark:text-lime-300 bg-lime-500/10',
};

export default function LnatkApp() {
  const seed = useMemo(() => buildSeedData(), []);
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('lnatk_theme');
      if (saved === 'dark') return true;
      if (saved === 'light') return false;
    }
    return true;
  });
  const [role, setRole] = useState<PortalRole>('landing');
  const [loginStep, setLoginStep] = useState<'stack' | 'tk' | 'coordinator' | 'officer'>('stack');
  const [officerTab, setOfficerTab] = useState<OfficerTab>('grid');

  const [locales, setLocales] = useState<LocaleItem[]>(isSupabaseConfigured ? [] : INITIAL_LOCALES);
  const [sessions, setSessions] = useState<SessionItem[]>(isSupabaseConfigured ? [] : INITIAL_SESSIONS);
  const [members, setMembers] = useState<MemberItem[]>(isSupabaseConfigured ? [] : seed.members);
  const [reports, setReports] = useState<MonthlyReport[]>([]);
  const [coordTab, setCoordTab] = useState<'duty' | 'report'>('duty');
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(typeof window !== 'undefined' && window.innerWidth >= 768);
  const [coordLocaleId, setCoordLocaleId] = useState<number>(1);
  const [logs, setLogs] = useState<Record<string, AttendanceLogItem>>(isSupabaseConfigured ? {} : seed.logs);
  const [reportMonth, setReportMonth] = useState<string>(isSupabaseConfigured ? currentMonthManila() : '2026-10');
  const [dataLoading, setDataLoading] = useState<boolean>(isSupabaseConfigured);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [weekView, setWeekView] = useState<number | 'all'>('all');
  const [fullNames, setFullNames] = useState(false);
  const [hoveredDutyRow, setHoveredDutyRow] = useState<number | null>(null);
  const weekViewInit = React.useRef('');
  const [editHistory, setEditHistory] = useState<EditHistoryItem[]>([
    {
      id: 'ed-1',
      memberName: 'Santos, Alyssa',
      localeName: 'Dila',
      sessionLabel: 'Week 3 TG',
      oldStatus: 'A',
      newStatus: 'S',
      by: 'Daniel Reyes',
      at: 'Oct 19, 8:14 PM',
      reason: 'Confirmed viewing submission with coordinator',
    },
  ]);

  // Regular TK & Officer Locale State
  const [selectedCity, setSelectedCity] = useState<CityName>('Santa Rosa');
  const [selectedLocaleId, setSelectedLocaleId] = useState<number>(1);
  const [memberSearch, setMemberSearch] = useState('');

  // Coordinator State
  const [coordCodeInput, setCoordCodeInput] = useState('SR-DILA');
  const [coordPinInput, setCoordPinInput] = useState('');
  const [coordSessionId, setCoordSessionId] = useState('w4-tg');
  const [coordDraft, setCoordDraft] = useState<Record<string, AttendanceStatus>>({});

  // Officer Live Board Filters
  const [liveCityFilter, setLiveCityFilter] = useState<string>('ALL');
  const [liveLocaleFilter, setLiveLocaleFilter] = useState<string>('ALL');
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [officerEmail, setOfficerEmail] = useState('');
  const [officerPassword, setOfficerPassword] = useState('');
  const [officerBusy, setOfficerBusy] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    try {
      localStorage.setItem('lnatk_theme', darkMode ? 'dark' : 'light');
    } catch {
      /* ignore quota or privacy errors */
    }
  }, [darkMode]);

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2800);
  };

  const currentLocale = useMemo(
    () => locales.find((l) => l.id === selectedLocaleId) ?? locales[0] ?? PLACEHOLDER_LOCALE,
    [locales, selectedLocaleId]
  );

  const reportMonthLabel = useMemo(
    () => new Date(`${reportMonth}-01T00:00:00Z`).toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
    [reportMonth]
  );
  const weekNums = useMemo(() => [...new Set(sessions.map((s) => s.weekNum))].sort((a, b) => a - b), [sessions]);
  const weekLabel = (w: number) => {
    const ds = sessions.filter((s) => s.weekNum === w).map((s) => s.date).sort();
    if (!ds.length) return `WEEK ${w}`;
    const f = (d: string) =>
      new Date(`${d}T00:00:00Z`).toLocaleString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).toUpperCase();
    return `WEEK ${w} (${f(ds[0])} – ${f(ds[ds.length - 1])})`;
  };
  const liveTg = useMemo(
    () => sessions.find((s) => (s.type === 'TG' || s.type === 'SPBB') && s.statusWindow === 'live'),
    [sessions]
  );

  const currentWeekNum = useMemo(() => {
    const now = new Date(Date.now() + 8 * 3600 * 1000);
    now.setUTCDate(now.getUTCDate() - ((now.getUTCDay() + 6) % 7));
    const monday = now.toISOString().slice(0, 10);
    const maxDate = (w: number) => sessions.filter((s) => s.weekNum === w).map((s) => s.date).sort().pop() ?? '';
    return weekNums.find((w) => maxDate(w) >= monday) ?? weekNums[weekNums.length - 1];
  }, [sessions, weekNums]);

  // Phones start on the current week; larger screens start on all weeks.
  useEffect(() => {
    const key = `${reportMonth}:${weekNums.length}`;
    if (!weekNums.length || weekViewInit.current === key) return;
    weekViewInit.current = key;
    setWeekView(typeof window !== 'undefined' && window.innerWidth < 768 ? currentWeekNum : 'all');
  }, [reportMonth, weekNums, currentWeekNum]);

  const liveTgId = useMemo(() => {
    const tgs = sessions.filter((s) => s.type === 'TG' || s.type === 'SPBB').sort((a, b) => a.date.localeCompare(b.date));
    return (
      tgs.find((s) => s.statusWindow === 'live') ?? tgs.find((s) => s.statusWindow === 'open') ?? tgs[tgs.length - 1]
    )?.id ?? 'w4-tg';
  }, [sessions]);

  const applySheet = (sheet: RawSheet, localeId: number | null) => {
    setSessions(decorateSessions(sheet.sessions));
    setMembers((prev) =>
      localeId === null
        ? sheet.members
        : [...prev.filter((m) => m.localeId !== localeId), ...sheet.members.map((m) => ({ ...m, localeId, leftAt: m.leftAt ?? null }))]
    );
    setLogs((prev) => ({ ...(localeId === null ? {} : prev), ...mapLogs(sheet.logs) }));
  };

  // Supabase: locale list on first load
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    (async () => {
      try {
        fetchUpcomingEvents().then(setEvents).catch(() => undefined);
        await ensureSessions();
        const rows = await fetchActiveLocales();
        setLocales(
          rows.map((l) => ({
            id: l.locale_id, city: l.city_name, locale: l.locale_name,
            name: l.locale_name, code: '', coordinator: l.coordinator_name ?? '', contact: '', pin: '',
            failedAttempts: 0, active: true,
          } as LocaleItem))
        );
        setLoadError(null);
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : 'Could not reach Supabase');
      } finally {
        setDataLoading(false);
      }
    })();
  }, [reloadTick]);

  // Supabase: Regular TK / Coordinator load their own locale only
  useEffect(() => {
    if (!isSupabaseConfigured || (role !== 'tk' && role !== 'coordinator')) return;
    let cancelled = false;
    fetchLocaleDutySheet(selectedLocaleId, reportMonth)
      .then((sheet) => { if (!cancelled) applySheet(sheet as unknown as RawSheet, selectedLocaleId); })
      .catch((err) => triggerToast(err instanceof Error ? err.message : 'Could not load the sheet'));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, selectedLocaleId, reportMonth, reloadTick]);

  // Supabase: Officer loads everything (+ live updates)
  useEffect(() => {
    if (!isSupabaseConfigured || role !== 'officer') return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = async () => {
      try {
        const [d, profiles] = await Promise.all([
          fetchOfficerMonth(reportMonth),
          fetchMemberProfiles().catch(() => ({} as Awaited<ReturnType<typeof fetchMemberProfiles>>)),
        ]);
        if (cancelled) return;
        setLocales(mapLocales(d.locales));
        applySheet({ ...d, members: d.members.map((m) => ({ ...m, ...(profiles[m.id] ?? {}) })) }, null);
        setReports(formatReports(d.reports));
      } catch (err) {
        triggerToast(err instanceof Error ? err.message : 'Could not load officer data');
      }
    };
    officerFetchEvents().then((ev) => { if (!cancelled) setEvents(ev); }).catch(() => undefined);
    load();
    const ch = subscribeToAttendanceChanges(() => {
      clearTimeout(timer);
      timer = setTimeout(load, 1500);
    });
    return () => { cancelled = true; clearTimeout(timer); supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, reportMonth, reloadTick]);

  // Supabase: coordinator re-opens their submitted report
  useEffect(() => {
    if (!isSupabaseConfigured || role !== 'coordinator' || coordTab !== 'report') return;
    fetchCoordinatorReport(selectedLocaleId, coordPinInput, reportMonth)
      .then((r) => {
        if (!r) return;
        const [fr] = formatReports([r]);
        setReports((prev) => [fr, ...prev.filter((x) => !(x.localeId === fr.localeId && x.month === fr.month))]);
      })
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, coordTab, selectedLocaleId, reportMonth]);

  useEffect(() => {
    if (liveTg) setCoordSessionId(liveTg.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveTg]);

  const getWeekBestStatus = (memberId: string, weekNum: number): string => {
    const rank: Record<string, number> = { P: 5, S: 4, D: 3, A: 2, N: 1, '-': 0 };
    let best = '-';
    sessions
      .filter((s) => s.weekNum === weekNum && s.type !== 'Practice')
      .forEach((s) => {
        const lg = logs[`${memberId}_${s.id}`];
        if (lg && lg.confirmed && rank[lg.status] > rank[best]) {
          best = lg.status;
        }
      });
    return best;
  };

  const computeMemberRollup = (memberId: string) => {
    let weeksDuty = 0;
    const weekMarkers: Record<number, string> = {};
    for (const w of weekNums) {
      const mk = getWeekBestStatus(memberId, w);
      weekMarkers[w] = mk;
      if (mk === 'S' || mk === 'P') weeksDuty++;
    }
    const bucket =
      weeksDuty >= 3 ? '3-4 Weeks Duty' : weeksDuty >= 1 ? '1-2 Weeks Duty' : 'No Duty';
    return { weeksDuty, bucket, weekMarkers };
  };

  const computeLocaleSummary = (localeId: number) => {
    const locMembers = members.filter((m) => m.localeId === localeId && !m.leftAt);
    let duty34 = 0,
      duty12 = 0,
      noDuty = 0;
    locMembers.forEach((m) => {
      const r = computeMemberRollup(m.id);
      if (r.bucket === '3-4 Weeks Duty') duty34++;
      else if (r.bucket === '1-2 Weeks Duty') duty12++;
      else noDuty++;
    });
    return { total: locMembers.length, duty34, duty12, noDuty };
  };

  const handleCellChange = async (
    memberId: string,
    sessionId: string,
    newStatus: AttendanceStatus,
    sourceRole: 'self' | 'coordinator' | 'officer'
  ) => {
    const key = `${memberId}_${sessionId}`;
    const prev = logs[key]?.status ?? 'N';
    const prevLog = logs[key];
    const member = members.find((m) => m.id === memberId);
    const sess = sessions.find((s) => s.id === sessionId);
    if (!member || !sess) return;

    setLogs((prevLogs) => ({
      ...prevLogs,
      [key]: {
        memberId,
        sessionId,
        status: newStatus,
        source: sourceRole,
        attendedVia: 'live',
        confirmed: true,
        updatedAt: 'Just now',
      },
    }));

    setEditHistory((prevHist) => [
      {
        id: `ed-${Date.now()}`,
        memberName: member.fullName,
        localeName: currentLocale.name,
        sessionLabel: sess.label,
        oldStatus: prev,
        newStatus,
        by:
          sourceRole === 'officer'
            ? 'Daniel Reyes (Officer)'
            : sourceRole === 'coordinator'
            ? `${currentLocale.coordinator} (Coordinator)`
            : `${member.fullName} (Regular TK)`,
        at: 'Just now',
        reason: 'Direct table edit',
      },
      ...prevHist,
    ]);

    triggerToast(`${member.fullName} (${sess.label}) → ${newStatus}`);

    try {
      if (sourceRole === 'officer') {
        if (isSupabaseConfigured) {
          await officerEditAttendanceCell({
            memberId, sessionId, oldStatus: prev as AttendanceStatus, newStatus, reason: 'Officer inline sheet edit',
          });
        }
      } else {
        await updateTableCellStatus({
          localeId: member.localeId,
          memberId,
          sessionId,
          status: newStatus,
          source: sourceRole,
          localeCode: sourceRole === 'coordinator' ? String(currentLocale.id) : undefined,
          pin: sourceRole === 'coordinator' ? coordPinInput : undefined,
        });
      }
    } catch (err) {
      if (isSupabaseConfigured) {
        triggerToast(err instanceof Error ? err.message : 'Update rejected');
        setLogs((p) => {
          const n = { ...p };
          if (prevLog) n[key] = prevLog;
          else delete n[key];
          return n;
        });
      }
    }
  };

  const handleCoordinatorBatchSubmit = async () => {
    if (!liveTg) {
      triggerToast('The roster is only open while a TG or SPBB day is live.');
      return;
    }
    const keys = Object.keys(coordDraft);
    if (keys.length === 0) {
      triggerToast('Tap S / P / D / A on at least one member first.');
      return;
    }

    setLogs((prevLogs) => {
      const next = { ...prevLogs };
      keys.forEach((mId) => {
        next[`${mId}_${coordSessionId}`] = {
          memberId: mId,
          sessionId: coordSessionId,
          status: coordDraft[mId],
          source: 'coordinator',
          attendedVia: 'live',
          confirmed: true,
          updatedAt: 'Just now',
        };
      });
      return next;
    });

    setCoordDraft({});
    triggerToast(`Submitted ${keys.length} entries to ${currentLocale.name} table`);

    try {
      await submitCoordinatorBatchRoster({
        localeCode: String(currentLocale.id),
        pin: coordPinInput,
        sessionId: coordSessionId,
        entries: keys.map((mId) => ({ member_id: mId, status: coordDraft[mId] })),
      });
    } catch (err) {
      if (isSupabaseConfigured) {
        triggerToast(err instanceof Error ? err.message : 'Submission rejected');
        setReloadTick((n) => n + 1);
      }
    }
  };

  const unreadReports = reports.filter((r) => !r.reviewed).length;
  const closeSidebarOnMobile = () => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) setSidebarOpen(false);
  };

  const buildLocaleRows = (): LocaleSummaryRow[] =>
    locales.map((l) => ({ city: l.city, locale: l.name, ...computeLocaleSummary(l.id) }));

  const buildMemberRows = (): MemberStatusRow[] =>
    locales.flatMap((loc) =>
      members
        .filter((m) => m.localeId === loc.id && !m.leftAt)
        .map((m) => {
          const r = computeMemberRollup(m.id);
          return {
            city: loc.city,
            locale: loc.name,
            name: m.fullName,
            category: TK_CATEGORY_LABELS[m.category ?? 'locale'],
            hold: m.onHold ? 'Yes' : '',
            weeks: weekNums.map((w) => r.weekMarkers[w]),
            weeksDuty: r.weeksDuty,
            status: r.bucket,
          };
        })
    );

  const handleDownloadExcel = async () => {
    const rows = reports
      .filter((r) => r.month === reportMonth)
      .map((r) => {
        const loc = locales.find((l) => l.id === r.localeId);
        return {
          city: loc?.city ?? '',
          locale: loc?.name ?? '',
          month: r.month,
          position: r.position,
          coordinator: r.coordinatorName,
          tkConcerns: r.tkConcerns.map((c) => `${c.name} - ${c.text}`).join('\n'),
          general: r.general,
          actions: r.actions,
          other: r.other,
          submittedAt: r.submittedAt,
        };
      });
    try {
      await downloadExcel(reportMonthLabel, buildLocaleRows(), buildMemberRows(), rows);
    } catch {
      triggerToast('Could not create the Excel file.');
    }
  };

  const handleDownloadPdf = () => {
    if (!printPdf(reportMonthLabel, buildLocaleRows(), buildMemberRows())) {
      triggerToast('Allow pop-ups to download the PDF.');
    }
  };

  const handleSubmitReport = async (r: Omit<MonthlyReport, 'id' | 'submittedAt' | 'reviewed'>) => {
    const submittedAt = new Date().toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' });
    try {
      if (isSupabaseConfigured) {
        await submitCoordinatorReport({
          localeId: r.localeId, pin: coordPinInput, month: r.month, position: r.position, name: r.coordinatorName,
          tkConcerns: r.tkConcerns, general: r.general, actions: r.actions, other: r.other,
        });
      }
    } catch (err) {
      triggerToast(err instanceof Error ? err.message : 'Report was not sent');
      return;
    }
    setReports((prev) => [
      { ...r, id: `rep-${r.localeId}-${r.month}`, submittedAt, reviewed: false },
      ...prev.filter((x) => !(x.localeId === r.localeId && x.month === r.month)),
    ]);
    triggerToast('Report sent to the officers');
  };

  const handleReview = (r: MonthlyReport) => {
    setReports((prev) => prev.map((x) => (x.id === r.id ? { ...x, reviewed: true } : x)));
    if (isSupabaseConfigured) markReportReviewed(r.localeId, r.month).catch(() => undefined);
  };

  const persist = async (fn: () => Promise<unknown>): Promise<boolean> => {
    if (!isSupabaseConfigured) return true;
    try {
      await fn();
      return true;
    } catch (err) {
      triggerToast(err instanceof Error ? err.message : 'Change was not saved');
      return false;
    }
  };
  const todayStr = () => new Date().toISOString().slice(0, 10);

  const handleSaveEvent = async (ev: Omit<EventItem, 'id'> & { id?: string }): Promise<boolean> => {
    let id = ev.id ?? `ev-${Date.now()}`;
    if (isSupabaseConfigured) {
      try {
        id = await officerSaveEvent(ev);
      } catch (err) {
        triggerToast(err instanceof Error ? err.message : 'Could not save the event');
        return false;
      }
    }
    setEvents((prev) => [{ ...ev, id }, ...prev.filter((e) => e.id !== id)]);
    triggerToast(ev.id ? 'Event updated' : 'Event added');
    return true;
  };
  const handleDeleteEvent = async (id: string) => {
    if (isSupabaseConfigured) {
      try {
        await officerDeleteEvent(id);
      } catch (err) {
        triggerToast(err instanceof Error ? err.message : 'Could not delete the event');
        return;
      }
    }
    setEvents((prev) => prev.filter((e) => e.id !== id));
    triggerToast('Event deleted');
  };

  const handleCreateSpbb = async (eventName: string, dates: string[], liveStart: string, liveEnd: string): Promise<boolean> => {
    if (!isSupabaseConfigured) {
      triggerToast('Connect Supabase to create SPBB days.');
      return false;
    }
    try {
      await officerCreateSpbbEvent(eventName, dates, liveStart, liveEnd);
    } catch (err) {
      triggerToast(err instanceof Error ? err.message : 'Could not create the event');
      return false;
    }
    triggerToast(`${eventName} created`);
    setReloadTick((n) => n + 1);
    return true;
  };
  const handleDeleteSpbb = async (eventName: string) => {
    if (!isSupabaseConfigured) return;
    try {
      await officerDeleteSpbbEvent(eventName);
      triggerToast(`${eventName} deleted`);
      setReloadTick((n) => n + 1);
    } catch (err) {
      triggerToast(err instanceof Error ? err.message : 'Could not delete the event');
    }
  };

  const handleUpdateMembers = async (
    ids: string[],
    patch: { category?: TkCategory; onHold?: boolean; holdReason?: string }
  ) => {
    if (!(await persist(() => officerUpdateMembers(ids, patch)))) return;
    setMembers((prev) =>
      prev.map((m) => (ids.includes(m.id) ? { ...m, ...patch } : m))
    );
    if (patch.category !== undefined) triggerToast(ids.length === 1 ? 'Category updated' : `${ids.length} categories updated`);
    else if (patch.onHold !== undefined) triggerToast(patch.onHold ? 'Put on hold' : 'Hold released');
  };

  const handleAddMember = async (name: string) => {
    const clean = name.trim();
    if (!clean) return;
    let id = `m-${Date.now()}`;
    if (isSupabaseConfigured) {
      try {
        id = await officerAddMember(currentLocale.id, clean);
      } catch (err) {
        triggerToast(err instanceof Error ? err.message : 'Could not add member');
        return;
      }
    }
    setMembers((prev) => [...prev, { id, localeId: currentLocale.id, fullName: clean, joinedAt: todayStr(), leftAt: null }]);
    triggerToast(`${clean} added to ${currentLocale.name}`);
  };
  const handleRenameMember = async (id: string, name: string) => {
    if (!(await persist(() => officerRenameMember(id, name)))) return;
    setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, fullName: name } : m)));
    triggerToast('Name updated');
  };
  const handleSetLeft = async (id: string, leftAt: string | null) => {
    if (!(await persist(() => officerSetMemberLeft(id, leftAt)))) return;
    setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, leftAt } : m)));
    triggerToast(leftAt ? 'Member removed' : 'Member restored');
  };

  const CELL_WIDTH = 'w-11 min-w-[2.75rem] max-w-[2.75rem] shrink-0';

  const renderEditableDutyTable = (sourceRole: 'self' | 'coordinator' | 'officer') => {
    const sorted = [...members]
      .filter(
        (m) =>
          m.localeId === currentLocale.id &&
          !m.leftAt &&
          m.fullName.toLowerCase().includes(memberSearch.toLowerCase())
      )
      .sort((a, b) =>
        a.fullName.localeCompare(b.fullName, 'en', { sensitivity: 'base' })
      );

    const visibleWeeks = weekView === 'all' || !weekNums.includes(weekView) ? weekNums : [weekView];
    const chip = (active: boolean) =>
      `shrink-0 px-2.5 py-1.5 rounded-[2px] border text-left leading-tight transition-colors font-mono uppercase text-[11px] tracking-[0.06em] cursor-pointer ${
        active
          ? 'bg-brand-600 border-brand-600 text-white font-medium'
          : 'border-app bg-surface-2 text-app-muted hover:text-app'
      }`;
    const legendChip = (cls: string, text: string) => (
      <span className={`inline-flex items-center justify-center min-w-[1.5rem] px-1.5 py-0.5 rounded font-mono text-[11px] font-semibold ${cls}`}>{text}</span>
    );

    return (
      <>
      <div className="px-3 sm:px-4 py-2.5 space-y-2 border-b border-app bg-surface">
        <div className="flex gap-1.5 overflow-x-auto pb-1" role="tablist" aria-label="Weeks">
          {weekNums.map((w) => (
            <button key={w} role="tab" aria-selected={weekView === w} onClick={() => setWeekView(w)} className={chip(weekView === w)}>
              <div className="text-[11px] font-semibold">
                Week {w}
                {w === currentWeekNum && <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-[1px] bg-emerald-400 align-middle" title="This week" />}
              </div>
              <div className="text-[10px] opacity-75">{weekLabel(w).replace(/^WEEK \d+ \(|\)$/g, '')}</div>
            </button>
          ))}
          <button role="tab" aria-selected={weekView === 'all'} onClick={() => setWeekView('all')} className={chip(weekView === 'all')}>
            <div className="text-[11px] font-semibold">All weeks</div>
            <div className="text-[10px] opacity-75">Full month</div>
          </button>
        </div>
        <details className="text-[11px] font-mono">
          <summary className="cursor-pointer uppercase tracking-[0.06em] text-app-muted hover:text-app py-0.5">What do the letters mean?</summary>
          <div className="mt-2 space-y-2 text-app">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <span className="font-semibold text-app-muted">PM, WS, TG, SPBB</span>
              <span>{legendChip(CELL_TONE.D, 'D')} Dumalo</span>
              <span>{legendChip(CELL_TONE.S, 'S')} Sumayaw</span>
              <span>{legendChip(CELL_TONE.P, 'P')} Program</span>
              <span>{legendChip(CELL_TONE.A, 'A')} Absent</span>
              <span>{legendChip(CELL_TONE.N, 'N')} No Attendance</span>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <span className="font-semibold text-app-muted">Practice</span>
              <span>{legendChip(PRACTICE_TONE.A, 'A')} Absent</span>
              <span>{legendChip(PRACTICE_TONE.K, 'K')} Kids TK</span>
              <span>{legendChip(PRACTICE_TONE.D, 'D')} District TK</span>
              <span>{legendChip(PRACTICE_TONE.S, 'S')} Self Study</span>
              <span>{legendChip(PRACTICE_TONE.NP, 'N')} No Practice</span>
              <span>{legendChip(PRACTICE_TONE.N, 'N')} No Attendance</span>
            </div>
            <p className="text-app-muted">Each column locks when its entry window ends. The batch roster (coordinators) only opens while TG or an SPBB day is live. A green dot on a column means it is open for entries. Closed columns are locked; ask an officer to change them.</p>
          </div>
        </details>
      </div>
      {/* Two-pane attendance grid */}
      <div className="h-[calc(100dvh-64px)] overflow-y-auto bg-surface">
        <div className="flex">
          {/* Left pane: names */}
          <div
            className="duty-names-pane w-32 shrink-0 border-r border-app-strong shadow-[3px_0_10px_-3px_rgba(0,0,0,0.15)] dark:shadow-[4px_0_12px_-2px_rgba(0,0,0,0.5)] z-20 overflow-x-auto overscroll-x-contain"
            style={{ scrollbarWidth: 'none' } as React.CSSProperties}
          >
            <style>{`.duty-names-pane::-webkit-scrollbar { display: none; }`}</style>
            <div className="sticky top-0 z-10 h-14 flex items-center px-2.5 font-semibold text-xs text-app bg-surface-2 border-b border-app-strong">
              Name
            </div>
            {sorted.map((m, idx) => {
              const isHovered = hoveredDutyRow === idx;
              const isStriped = idx % 2 === 1;
              return (
                <div
                  key={m.id}
                  className={`h-11 flex items-center px-2 whitespace-nowrap text-xs font-medium text-app border-b border-app transition-colors ${
                    isHovered ? '!bg-surface-2' : isStriped ? 'bg-surface-2-subtle' : 'bg-surface'
                  }`}
                  onMouseEnter={() => setHoveredDutyRow(idx)}
                  onMouseLeave={() => setHoveredDutyRow(null)}
                  onTouchStart={() => setHoveredDutyRow(idx)}
                  onTouchEnd={() => setHoveredDutyRow(null)}
                >
                  <span className="pl-1.5 pr-2 font-mono text-[10px] text-app-muted tabular-nums shrink-0">{idx + 1}</span>
                  <span title={m.fullName} className="truncate">{m.fullName}</span>
                </div>
              );
            })}
          </div>

          {/* Right pane: session cells */}
          <div className="flex-1 overflow-x-auto overscroll-x-contain">
            {/* Header row - 2 rows: Top for week spanning, Bottom for session headers */}
            <div className="sticky top-0 z-10 h-14 flex bg-surface-2 border-b border-app-strong">
              {visibleWeeks.map((w) => {
                const wSessions = sessions.filter((s) => s.weekNum === w);
                return (
                  <div key={w} className="flex flex-col border-r border-app-strong shrink-0">
                    {/* Top row: Week label spanning all columns of that week */}
                    <div className="h-6 px-2 flex items-center border-b border-app bg-surface-2 overflow-hidden">
                      <span className="sticky left-0 font-mono text-[10px] font-semibold tracking-wider text-app whitespace-nowrap">
                        {weekLabel(w)}
                      </span>
                    </div>
                    {/* Bottom row: individual column headers */}
                    <div className="h-8 flex bg-surface-2">
                      {wSessions.map((s) => (
                        <div
                          key={s.id}
                          className={`${CELL_WIDTH} border-r border-app text-center font-mono leading-tight py-1 px-0.5 flex flex-col justify-center`}
                        >
                          <div className={`font-semibold text-[11px] ${s.type === 'TG' ? 'text-brand-700 dark:text-brand-400' : 'text-app'}`}>
                            {s.shortLabel}
                          </div>
                          <div className="text-[9px] text-app-muted font-normal">
                            {s.date.slice(5)}
                            {s.statusWindow !== 'closed' && (
                              <span className="ml-0.5 inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 align-middle" title="Open for entries" />
                            )}
                          </div>
                        </div>
                      ))}
                      <div className={`${CELL_WIDTH} text-center font-mono py-1 px-0.5 flex items-center justify-center`}>
                        <span className="text-[10px] font-semibold text-app-muted">Week {w}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Body rows */}
            {sorted.map((m, idx) => {
              const rollup = computeMemberRollup(m.id);
              const isHovered = hoveredDutyRow === idx;
              const isStriped = idx % 2 === 1;
              return (
                <div
                  key={m.id}
                  className={`h-11 flex border-b border-app transition-colors ${
                    isHovered ? '!bg-surface-2' : isStriped ? 'bg-surface-2-subtle' : 'bg-surface'
                  }`}
                  onMouseEnter={() => setHoveredDutyRow(idx)}
                  onMouseLeave={() => setHoveredDutyRow(null)}
                  onTouchStart={() => setHoveredDutyRow(idx)}
                  onTouchEnd={() => setHoveredDutyRow(null)}
                >
                  {visibleWeeks.map((w) => {
                    const wSessions = sessions.filter((s) => s.weekNum === w);
                    const wkBest = rollup.weekMarkers[w];
                    const wkDot =
                      wkBest === 'S' || wkBest === 'P'
                        ? 'text-emerald-700 dark:text-emerald-300 font-bold'
                        : wkBest === 'D'
                        ? 'text-amber-600 dark:text-amber-400 font-semibold'
                        : 'text-app-muted';

                    return (
                      <div key={w} className="flex border-r border-app-strong shrink-0">
                        {wSessions.map((s) => {
                          const locked = sourceRole !== 'officer' && s.statusWindow === 'closed';
                          const isFuture = s.statusWindow === 'closed' && s.date > todayStr();
                          const lg = logs[`${m.id}_${s.id}`] ?? { status: 'N' as AttendanceStatus };
                          const tone = (s.type === 'Practice' ? PRACTICE_TONE : CELL_TONE)[lg.status] ?? CELL_TONE.N;

                          return (
                            <div key={s.id} className={`${CELL_WIDTH} border-r border-app flex items-center justify-center p-0.5`}>
                              {isFuture && sourceRole !== 'officer' ? (
                                <div
                                  className="w-10 h-10 sm:h-8 rounded-md font-mono text-xs flex items-center justify-center border border-dashed border-app-strong text-app-muted opacity-40 cursor-not-allowed"
                                  title="Future session not open yet"
                                >
                                  -
                                </div>
                              ) : (
                                <div className={`relative inline-flex items-center justify-center w-10 h-10 sm:h-8 rounded-md font-mono font-semibold text-sm sm:text-xs focus-within:ring-2 focus-within:ring-brand-500 ${tone} ${locked ? 'opacity-50' : ''}`}>
                                  <span className="pointer-events-none">{statusShort(lg.status)}</span>
                                  <select
                                    aria-label={`${m.fullName} ${s.label}`}
                                    value={lg.status}
                                    onChange={(e) =>
                                      handleCellChange(m.id, s.id, e.target.value as AttendanceStatus, sourceRole)
                                    }
                                    disabled={locked}
                                    className={`absolute inset-0 w-full h-full opacity-0 ${locked ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                                  >
                                    {s.allowed.map((st) => (
                                      <option
                                        key={st}
                                        value={st}
                                        className="bg-surface text-app"
                                      >
                                        {statusLabel(st, s.type)}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              )}
                            </div>
                          );
                        })}
                        <div className={`${CELL_WIDTH} flex items-center justify-center font-mono text-xs ${wkDot}`}>
                          {wkBest}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      </>
    );
  };

  const locSummary = computeLocaleSummary(currentLocale.id);
  const cityLocales = locales.filter((l) => l.city === selectedCity);

  if (isSupabaseConfigured && (dataLoading || loadError || locales.length === 0)) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 p-6 text-center bg-page text-app">
        <div className="font-bold tracking-widest text-sm">LNATK ATTENDANCE PLATFORM</div>
        {loadError ? (
          <>
            <p className="text-xs text-rose-500 max-w-xs">{loadError}</p>
            <button
              onClick={() => { setLoadError(null); setDataLoading(true); setReloadTick((n) => n + 1); }}
              className={LEDGER_BTN_PRIMARY}
            >
              TRY AGAIN
            </button>
          </>
        ) : (
          <p className="text-xs text-app-muted">{dataLoading ? 'Loading…' : 'No locales found. Did you run the SQL migrations?'}</p>
        )}
      </div>
    );
  }

  return (
    <div className="h-full overflow-hidden bg-page text-app flex select-none">
      {/* Left Sidebar (Hidden on Landing Log-In View) */}
      {role === 'officer' && (
        <>
        {sidebarOpen && (
          <div className="fixed inset-0 z-30 bg-black/50 md:hidden" onClick={() => setSidebarOpen(false)} />
        )}
        <aside
          className={`${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full md:hidden'
          } fixed md:static inset-y-0 left-0 z-40 w-64 shrink-0 bg-surface border-r border-app flex flex-col justify-between transition-transform`}
        >
          <div className="flex flex-col flex-1 min-h-0">
            <div className="h-11 sm:h-9 px-3 border-b border-app flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-[2px] bg-brand-600 text-white flex items-center justify-center font-mono font-bold text-[10px]">
                  TK
                </div>
                <span className="font-mono uppercase font-semibold text-xs tracking-[0.06em] text-app">LNATK DISTRICT</span>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                aria-label="Hide menu"
                title="Hide menu"
                className="p-1 rounded-[2px] text-app-muted hover:text-app hover:bg-surface-2 transition-colors"
              >
                <span className="md:hidden"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg></span>
                <span className="hidden md:inline"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 3v18" /><path d="m16 9-3 3 3 3" /></svg></span>
              </button>
            </div>

            {/* Officer Modules & 18-Locale Tree */}
            {role === 'officer' && (
            <div className="flex-1 overflow-y-auto px-2 py-2 space-y-3">
              <div className="space-y-0.5">
                <div className="px-2 pb-1 text-[11px] font-mono uppercase tracking-[0.06em] text-app-muted">
                  Officer Modules
                </div>
                {[
                  { id: 'grid', label: 'Duty Sheet' },
                  { id: 'dashboard', label: 'Overall Status' },
                  { id: 'overview', label: 'TK Overview' },
                  { id: 'reports', label: 'Coordinator Reports' },
                  { id: 'upcoming', label: 'Upcoming Events' },
                  { id: 'admin', label: 'Members' },
                  { id: 'events', label: 'SPBB Days' },
                  { id: 'inbox', label: 'Live Venue Board (Per Locale)' },
                ].map((t) => {
                  const isActive = role === 'officer' && officerTab === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => {
                        setRole('officer');
                        setOfficerTab(t.id as OfficerTab);
                        closeSidebarOnMobile();
                      }}
                      className={`w-full h-8 px-2.5 rounded-[2px] text-xs font-medium text-left border-l-2 transition-colors flex items-center justify-between ${
                        isActive
                          ? 'border-brand-500 bg-surface-2 text-app font-semibold'
                          : 'border-transparent text-app-muted hover:text-app hover:bg-surface-2'
                      }`}
                    >
                      <span className="truncate">{t.label}</span>
                      {t.id === 'reports' && unreadReports > 0 && (
                        <span className="ml-2 px-1.5 rounded-[2px] bg-brand-600 text-white text-[10px] font-mono tabular-nums leading-none py-0.5">{unreadReports}</span>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="space-y-3 pt-2 border-t border-app">
                <div className="px-2 text-[11px] font-mono uppercase tracking-[0.06em] text-app-muted">
                  18 Locales (3 Cities)
                </div>
                {(['Santa Rosa', 'Biñan', 'San Pedro'] as CityName[]).map((city) => (
                  <div key={city} className="space-y-0.5">
                    <div className="px-2 py-1 text-[10px] font-mono uppercase tracking-[0.06em] text-app-muted border-b border-app mb-1">
                      {city}
                    </div>
                    {locales
                      .filter((l) => l.city === city)
                      .map((l) => {
                        const isSelected = selectedLocaleId === l.id;
                        return (
                          <button
                            key={l.id}
                            onClick={() => {
                              setSelectedCity(l.city);
                              setSelectedLocaleId(l.id);
                              closeSidebarOnMobile();
                            }}
                            className={`w-full h-8 px-2.5 rounded-[2px] text-xs flex items-center justify-between border-l-2 transition-colors ${
                              isSelected
                                ? 'border-brand-500 bg-surface-2 text-app font-semibold'
                                : 'border-transparent text-app-muted hover:text-app hover:bg-surface-2'
                            }`}
                          >
                            <span className="truncate">{l.name}</span>
                            <span className="font-mono text-[10px] text-app-muted tabular-nums">{(l.code || '').split('-')[1]}</span>
                          </button>
                        );
                      })}
                  </div>
                ))}
              </div>
            </div>
            )}
          </div>
        </aside>
        </>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <header className="h-11 sm:h-9 shrink-0 bg-surface border-b border-app px-3 sm:px-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm min-w-0">
            {role === 'officer' && (
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                aria-label={sidebarOpen ? 'Hide menu' : 'Show menu'}
                aria-expanded={sidebarOpen}
                title="Show menu"
                className={`p-1 h-7 w-7 rounded-[2px] border border-app-strong bg-transparent hover:bg-surface-2 text-app transition-colors flex items-center justify-center ${sidebarOpen ? 'md:hidden' : ''}`}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 3v18" /><path d="m14 9 3 3-3 3" /></svg>
              </button>
            )}
            {role === 'landing' ? (
              <span className="font-mono uppercase font-bold tracking-[0.06em] text-xs">LNATK ATTENDANCE PLATFORM</span>
            ) : role === 'officer' ? (
              <span className="font-mono uppercase font-semibold text-xs text-app truncate tracking-[0.06em]">
                {OFFICER_TAB_LABELS[officerTab]}
                {(officerTab === 'grid' || officerTab === 'admin') && ` — ${currentLocale.name}`}
              </span>
            ) : (
              <div className="font-mono uppercase text-xs tracking-[0.06em] flex items-center gap-1.5 truncate">
                <span className="text-app-muted hidden sm:inline">{currentLocale.city}</span>
                <span className="text-app-muted/60 hidden sm:inline">/</span>
                <span className="font-semibold text-app truncate">{currentLocale.name}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {role !== 'landing' && isSupabaseConfigured && (
              <input
                type="month"
                value={reportMonth}
                onChange={(e) => e.target.value && setReportMonth(e.target.value)}
                className="h-7 px-2 w-[8.25rem] rounded-[2px] border border-app-strong bg-transparent text-[11px] font-mono text-app [color-scheme:light] dark:[color-scheme:dark]"
              />
            )}
            <div className="flex items-center gap-1.5 shrink-0">
              <Sun size={13} className="hidden sm:inline-block text-app-muted shrink-0" aria-hidden="true" />
              <SquishSwitch
                checked={darkMode}
                onChange={(next) => setDarkMode(next)}
                ariaLabel="Toggle dark mode"
                width={52}
                height={24}
                radius={4}
                speed={55}
                stretch={36}
                trackColor="#d4d4d8"
                trackOnColor="#3b2a7a"
                thumbColor="#ffffff"
                thumbOnColor="#c4b5fd"
                colorDuration={120}
              />
              <Moon size={13} className="hidden sm:inline-block text-app-muted shrink-0" aria-hidden="true" />
            </div>
            {role !== 'landing' && (
              <button
                onClick={async () => {
                  try {
                    if (isSupabaseConfigured) await signOutOfficer();
                  } catch {
                    /* already signed out */
                  }
                  setOfficerPassword('');
                  setCoordPinInput('');
                  setCoordTab('duty');
                  setLoginStep('stack');
                  setRole('landing');
                }}
                className="h-7 px-2.5 rounded-[2px] border border-app-strong bg-transparent hover:bg-surface-2 text-[11px] font-mono uppercase tracking-[0.06em] font-medium text-app transition-colors"
              >
                Log Out
              </button>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-3 sm:p-6 bg-page">
          {/* VIEW 1: CENTERED LOG-IN SCREEN */}
          {role === 'landing' && (
            <section className="min-h-[calc(100vh-6.5rem)] flex flex-col items-center justify-center">
              <div className="w-full max-w-sm md:max-w-4xl md:grid md:grid-cols-2 md:gap-8 md:items-start space-y-6 md:space-y-0">
                <Panel
                  title="LNATK DISTRICT"
                  meta="PORTAL ACCESS"
                  bodyClassName="p-0"
                  className="w-full"
                >
                  {loginStep === 'stack' && (
                    <div className="divide-y divide-app">
                      <button
                        onClick={() => setLoginStep('tk')}
                        className="w-full p-4 sm:p-5 text-left hover:bg-surface-2 transition-colors cursor-pointer group"
                      >
                        <div className="text-sm font-semibold text-app group-hover:text-brand-500 transition-colors">
                          Regular TK
                        </div>
                        <div className="text-[11px] font-mono text-app-muted mt-0.5">
                          Select city & locale · View & edit locale duty sheet
                        </div>
                      </button>
                      <button
                        onClick={() => setLoginStep('coordinator')}
                        className="w-full p-4 sm:p-5 text-left hover:bg-surface-2 transition-colors cursor-pointer group"
                      >
                        <div className="text-sm font-semibold text-app group-hover:text-brand-500 transition-colors">
                          Coordinator
                        </div>
                        <div className="text-[11px] font-mono text-app-muted mt-0.5">
                          Choose locale + PIN · Submit TG roster & monthly report
                        </div>
                      </button>
                      <button
                        onClick={() => setLoginStep('officer')}
                        className="w-full p-4 sm:p-5 text-left hover:bg-surface-2 transition-colors cursor-pointer group"
                      >
                        <div className="text-sm font-semibold text-app group-hover:text-brand-500 transition-colors">
                          Officer
                        </div>
                        <div className="text-[11px] font-mono text-app-muted mt-0.5">
                          District login · Full access to all 18 locales
                        </div>
                      </button>
                    </div>
                  )}

                  {loginStep === 'tk' && (
                    <div className="p-4 sm:p-5 space-y-3">
                      <div className="flex items-center justify-between">
                        <button
                          onClick={() => setLoginStep('stack')}
                          className="font-mono uppercase text-[11px] text-app-muted hover:text-app tracking-[0.06em]"
                        >
                          ← BACK
                        </button>
                        <span className="font-mono uppercase text-[11px] font-semibold text-brand-600 dark:text-brand-400 tracking-[0.06em]">
                          REGULAR TK
                        </span>
                      </div>
                      <div className="space-y-3 pt-1">
                        <div>
                          <label className="block font-mono uppercase text-[11px] font-semibold mb-1 text-app-muted tracking-[0.06em]">
                            SELECT CITY
                          </label>
                          <select
                            value={selectedCity}
                            onChange={(e) => {
                              const city = e.target.value as CityName;
                              setSelectedCity(city);
                              const first = locales.find((l) => l.city === city);
                              if (first) setSelectedLocaleId(first.id);
                            }}
                            className={`${LEDGER_SELECT} w-full`}
                          >
                            <option value="Santa Rosa">Santa Rosa</option>
                            <option value="Biñan">Biñan</option>
                            <option value="San Pedro">San Pedro</option>
                          </select>
                        </div>
                        <div>
                          <label className="block font-mono uppercase text-[11px] font-semibold mb-1 text-app-muted tracking-[0.06em]">
                            SELECT LOCALE
                          </label>
                          <select
                            value={selectedLocaleId}
                            onChange={(e) => setSelectedLocaleId(Number(e.target.value))}
                            className={`${LEDGER_SELECT} w-full`}
                          >
                            {cityLocales.map((l) => (
                              <option key={l.id} value={l.id}>
                                {l.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <button onClick={() => setRole('tk')} className={`${LEDGER_BTN_PRIMARY} w-full mt-2`}>
                        ENTER LOCALE TABLE
                      </button>
                    </div>
                  )}

                  {loginStep === 'coordinator' && (
                    <div className="p-4 sm:p-5 space-y-3">
                      <div className="flex items-center justify-between">
                        <button
                          onClick={() => setLoginStep('stack')}
                          className="font-mono uppercase text-[11px] text-app-muted hover:text-app tracking-[0.06em]"
                        >
                          ← BACK
                        </button>
                        <span className="font-mono uppercase text-[11px] font-semibold text-brand-600 dark:text-brand-400 tracking-[0.06em]">
                          COORDINATOR
                        </span>
                      </div>
                      <div className="space-y-3 pt-1">
                        <div>
                          <label className="block font-mono uppercase text-[11px] font-semibold mb-1 text-app-muted tracking-[0.06em]">
                            YOUR LOCALE
                          </label>
                          <select
                            value={coordLocaleId}
                            onChange={(e) => setCoordLocaleId(Number(e.target.value))}
                            className={`${LEDGER_SELECT} w-full`}
                          >
                            {(['Santa Rosa', 'Biñan', 'San Pedro'] as CityName[]).map((city) => (
                              <optgroup key={city} label={city}>
                                {locales
                                  .filter((l) => l.city === city)
                                  .map((l) => (
                                    <option key={l.id} value={l.id}>
                                      {l.name}
                                    </option>
                                  ))}
                              </optgroup>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block font-mono uppercase text-[11px] font-semibold mb-1 text-app-muted tracking-[0.06em]">
                            COORDINATOR PIN
                          </label>
                          <input
                            type="password"
                            inputMode="numeric"
                            value={coordPinInput}
                            onChange={(e) => setCoordPinInput(e.target.value)}
                            className={`${LEDGER_INPUT} w-full`}
                          />
                        </div>
                      </div>
                      <button
                        onClick={async () => {
                          const found = locales.find((l) => l.id === coordLocaleId);
                          if (!found) return;
                          if (isSupabaseConfigured) {
                            try {
                              await coordinatorLogin(String(found.id), coordPinInput);
                            } catch (err) {
                              triggerToast(err instanceof Error ? err.message : 'Invalid PIN');
                              return;
                            }
                          } else if (coordPinInput !== found.pin) {
                            triggerToast('Invalid PIN (demo PIN: 1234)');
                            return;
                          }
                          setSelectedCity(found.city);
                          setSelectedLocaleId(found.id);
                          setCoordTab('duty');
                          setRole('coordinator');
                        }}
                        className={`${LEDGER_BTN_PRIMARY} w-full mt-2`}
                      >
                        UNLOCK COORDINATOR ACCOUNT
                      </button>
                    </div>
                  )}

                  {loginStep === 'officer' && (
                    <div className="p-4 sm:p-5 space-y-3">
                      <div className="flex items-center justify-between">
                        <button
                          onClick={() => setLoginStep('stack')}
                          className="font-mono uppercase text-[11px] text-app-muted hover:text-app tracking-[0.06em]"
                        >
                          ← BACK
                        </button>
                        <span className="font-mono uppercase text-[11px] font-semibold text-brand-600 dark:text-brand-400 tracking-[0.06em]">
                          DISTRICT OFFICER
                        </span>
                      </div>
                      <div className="space-y-3 pt-1">
                        <div>
                          <label className="block font-mono uppercase text-[11px] font-semibold mb-1 text-app-muted tracking-[0.06em]">
                            OFFICER EMAIL
                          </label>
                          <input
                            type="email"
                            placeholder="officer@email.com"
                            value={officerEmail}
                            onChange={(e) => setOfficerEmail(e.target.value)}
                            className={`${LEDGER_INPUT} w-full`}
                          />
                        </div>
                        <div>
                          <label className="block font-mono uppercase text-[11px] font-semibold mb-1 text-app-muted tracking-[0.06em]">
                            PASSWORD
                          </label>
                          <input
                            type="password"
                            placeholder="••••••••"
                            value={officerPassword}
                            onChange={(e) => setOfficerPassword(e.target.value)}
                            className={`${LEDGER_INPUT} w-full`}
                          />
                        </div>
                      </div>
                      <button
                        disabled={officerBusy}
                        onClick={async () => {
                          if (isSupabaseConfigured) {
                            setOfficerBusy(true);
                            try {
                              await signInOfficer(officerEmail.trim(), officerPassword);
                            } catch (err) {
                              triggerToast(err instanceof Error ? err.message : 'Officer sign-in failed');
                              setOfficerBusy(false);
                              return;
                            }
                            setOfficerBusy(false);
                          }
                          setOfficerPassword('');
                          setRole('officer');
                          setOfficerTab('grid');
                        }}
                        className={`${LEDGER_BTN_PRIMARY} w-full mt-2`}
                      >
                        SIGN IN TO WORKSPACE
                      </button>
                    </div>
                  )}
                </Panel>
                <UpcomingEvents events={events} />
              </div>
            </section>
          )}

          {/* VIEW 2: REGULAR TK VIEW */}
          {role === 'tk' && (
            <section className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={selectedCity}
                    onChange={(e) => {
                      const c = e.target.value as CityName;
                      setSelectedCity(c);
                      const first = locales.find((l) => l.city === c);
                      if (first) setSelectedLocaleId(first.id);
                    }}
                    className={LEDGER_SELECT}
                  >
                    <option value="Santa Rosa">Santa Rosa</option>
                    <option value="Biñan">Biñan</option>
                    <option value="San Pedro">San Pedro</option>
                  </select>
                  <select
                    value={selectedLocaleId}
                    onChange={(e) => setSelectedLocaleId(Number(e.target.value))}
                    className={LEDGER_SELECT}
                  >
                    {cityLocales.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    placeholder="FIND YOUR NAME..."
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    className={`${LEDGER_INPUT} w-44`}
                  />
                </div>

                <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-mono uppercase tracking-[0.06em]">
                  <div className="px-2 py-0.5 rounded-[2px] bg-surface-2 border border-app tabular-nums">
                    3–4 WEEKS: <strong className="text-emerald-500">{locSummary.duty34}</strong>
                  </div>
                  <div className="px-2 py-0.5 rounded-[2px] bg-surface-2 border border-app tabular-nums">
                    1–2 WEEKS: <strong className="text-brand-400">{locSummary.duty12}</strong>
                  </div>
                  <div className="px-2 py-0.5 rounded-[2px] bg-surface-2 border border-app tabular-nums">
                    NO DUTY: <strong className="text-rose-400">{locSummary.noDuty}</strong>
                  </div>
                </div>
              </div>

              <div className="border border-app rounded-[2px] bg-surface overflow-hidden">
                <div className="h-8 px-3 bg-surface-2 border-b border-app-strong flex items-center justify-between text-xs">
                  <span className="font-mono uppercase text-[11px] font-semibold tracking-[0.06em] text-app">
                    {currentLocale.city} — {currentLocale.name} REGULAR DUTY SHEET
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-app-muted">
                    CLICK ANY CELL TO EDIT
                  </span>
                </div>
                {renderEditableDutyTable('self')}
              </div>
            </section>
          )}

          {/* VIEW 3: COORDINATOR VIEW */}
          {role === 'coordinator' && (
            <div className="flex gap-1.5 mb-4 p-0.5 rounded-[2px] bg-surface-2 border border-app w-fit">
              {([['duty', 'DUTY SHEET'], ['report', 'MONTHLY REPORT']] as const).map(([id, lbl]) => (
                <button
                  key={id}
                  onClick={() => setCoordTab(id)}
                  className={`px-3 py-1.5 rounded-[2px] font-mono uppercase text-[11px] tracking-[0.06em] font-medium transition-colors cursor-pointer ${
                    coordTab === id ? 'bg-surface text-app border border-app' : 'text-app-muted hover:text-app'
                  }`}
                >
                  {lbl}
                </button>
              ))}
            </div>
          )}
          {role === 'coordinator' && coordTab === 'report' && (
            <CoordinatorReportForm
              key={`${currentLocale.id}-${reportMonth}`}
              locale={currentLocale}
              members={members}
              month={reportMonth}
              monthLabel={reportMonthLabel}
              existing={reports.find((r) => r.localeId === currentLocale.id && r.month === reportMonth)}
              onSubmit={handleSubmitReport}
            />
          )}
          {role === 'coordinator' && coordTab === 'duty' && (
            <section className="space-y-4">
              <Panel
                title={`BATCH ${liveTg?.type === 'SPBB' ? 'SPBB' : 'TG'} DUTY ROSTER`}
                meta={liveTg ? 'LIVE NOW' : 'NOT LIVE'}
                className="max-w-xl mx-auto w-full mb-4"
                bodyClassName="p-3 sm:p-4 space-y-3"
              >
                <div className="border-b border-app pb-2">
                  <p className="text-[11px] font-mono text-app-muted">
                    Mark multiple members for the live {liveTg?.type === 'SPBB' ? 'SPBB day' : 'TG'} at once.
                  </p>
                </div>

                <div className="flex items-center justify-between gap-2 rounded-[2px] border border-app bg-surface-2 px-3 py-2 text-[11px] font-mono text-app">
                  <span className="text-app-muted uppercase tracking-[0.06em]">Session</span>
                  {liveTg ? (
                    <span className="font-semibold flex items-center gap-1.5">
                      <span className="inline-block w-1.5 h-1.5 rounded-[1px] bg-emerald-500" />
                      {liveTg.label} · {liveTg.date} · Live now
                    </span>
                  ) : (
                    <span className="font-semibold text-amber-600 dark:text-amber-400">NOT LIVE</span>
                  )}
                </div>
                {!liveTg && (
                  <p className="text-[11px] font-mono text-app-muted">
                    This roster is only open while the TG or an SPBB day is live. Outside of that, use the duty sheet below or ask an officer.
                  </p>
                )}

                {liveTg && (
                  <>
                    <div className="divide-y divide-app rounded-[2px] border border-app bg-surface max-h-96 overflow-y-auto">
                      {members
                        .filter((m) => m.localeId === currentLocale.id && !m.leftAt)
                        .map((m) => {
                          const cur = coordDraft[m.id] ?? logs[`${m.id}_${coordSessionId}`]?.status ?? 'N';
                          return (
                            <div key={m.id} className="px-3 py-2 flex items-center justify-between text-xs hover:bg-surface-2 transition-colors">
                              <span className="font-medium text-app">{m.fullName}</span>
                              <div className="flex items-center gap-1">
                                {(['S', 'P', 'D', 'A'] as AttendanceStatus[]).filter((st) => liveTg?.allowed.includes(st)).map((st) => (
                                  <button
                                    key={st}
                                    onClick={() => setCoordDraft((prev) => ({ ...prev, [m.id]: st }))}
                                    className={`w-7 h-7 rounded-[2px] font-mono text-[11px] font-semibold border ${
                                      cur === st
                                        ? 'bg-brand-600 text-white border-brand-500'
                                        : 'bg-surface-2 border-app text-app hover:bg-surface'
                                    }`}
                                  >
                                    {st}
                                  </button>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                    </div>

                    <button
                      onClick={handleCoordinatorBatchSubmit}
                      className={`${LEDGER_BTN_PRIMARY} w-full`}
                    >
                      SUBMIT COORDINATOR BATCH
                    </button>
                  </>
                )}
              </Panel>

              <div className="border border-app rounded-[2px] bg-surface overflow-hidden">
                <div className="h-8 px-3 bg-surface-2 border-b border-app-strong flex items-center justify-between text-xs">
                  <span className="font-mono uppercase text-[11px] font-semibold tracking-[0.06em] text-app">
                    {currentLocale.city} — {currentLocale.name} REGULAR DUTY SHEET
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-app-muted">
                    EDITABLE TABLE · AUTO-SYNCS
                  </span>
                </div>
                {renderEditableDutyTable('coordinator')}
              </div>
            </section>
          )}

          {/* VIEW 4: OFFICER WORKSPACE */}
          {role === 'officer' && officerTab === 'grid' && (
            <section className="space-y-4">
              <div className="border border-app rounded-[2px] bg-surface overflow-hidden">
                {renderEditableDutyTable('officer')}
              </div>
            </section>
          )}

          {role === 'officer' && officerTab === 'dashboard' && (
            <section className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-mono uppercase text-[11px] font-semibold tracking-[0.06em] text-app">
                  ALL LOCALES — {reportMonthLabel.toUpperCase()}
                </h3>
                <div className="flex gap-2">
                  <button onClick={handleDownloadExcel} className={LEDGER_BTN_PRIMARY}>
                    DOWNLOAD EXCEL
                  </button>
                  <button onClick={handleDownloadPdf} className={LEDGER_BTN}>
                    DOWNLOAD PDF
                  </button>
                </div>
              </div>
              {(['Santa Rosa', 'Biñan', 'San Pedro'] as CityName[]).map((city) => (
                <Panel key={city} title={city.toUpperCase()} meta="SUMMARY" bodyClassName="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="h-8 bg-surface-2 border-b border-app-strong font-mono uppercase text-[11px] text-app-muted tracking-[0.06em]">
                        <tr>
                          <th className="py-1 px-3 font-semibold">Locale</th>
                          <th className="py-1 px-3 text-right font-semibold">3–4 Weeks</th>
                          <th className="py-1 px-3 text-right font-semibold">1–2 Weeks</th>
                          <th className="py-1 px-3 text-right font-semibold">No Duty</th>
                          <th className="py-1 px-3 text-right font-semibold">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-app">
                        {locales
                          .filter((l) => l.city === city)
                          .map((loc, idx) => {
                            const s = computeLocaleSummary(loc.id);
                            return (
                              <tr
                                key={loc.id}
                                className={`h-11 sm:h-9 transition-colors hover:bg-surface-2 ${
                                  idx % 2 === 1 ? 'bg-surface-2-subtle' : ''
                                }`}
                              >
                                <td className="py-1 px-3 font-medium text-app truncate">{loc.name}</td>
                                <td className="py-1 px-3 text-right font-mono text-emerald-500 font-semibold tabular-nums">
                                  {s.duty34}
                                </td>
                                <td className="py-1 px-3 text-right font-mono text-brand-400 font-semibold tabular-nums">
                                  {s.duty12}
                                </td>
                                <td className="py-1 px-3 text-right font-mono text-rose-400 font-semibold tabular-nums">
                                  {s.noDuty}
                                </td>
                                <td className="py-1 px-3 text-right font-mono font-semibold text-app tabular-nums">
                                  {s.total}
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </Panel>
              ))}
            </section>
          )}

          {role === 'officer' && officerTab === 'inbox' && (
            <section className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-mono uppercase text-[11px] font-semibold tracking-[0.06em] text-app">
                  LIVE VENUE BOARD (SATURDAY TG — PER LOCALE)
                </h3>
                <div className="flex items-center gap-2">
                  <select
                    value={liveCityFilter}
                    onChange={(e) => {
                      setLiveCityFilter(e.target.value);
                      setLiveLocaleFilter('ALL');
                    }}
                    className={LEDGER_SELECT}
                  >
                    <option value="ALL">ALL CITIES (3)</option>
                    <option value="Santa Rosa">SANTA ROSA (7)</option>
                    <option value="Biñan">BIÑAN (7)</option>
                    <option value="San Pedro">SAN PEDRO (4)</option>
                  </select>
                  <select
                    value={liveLocaleFilter}
                    onChange={(e) => setLiveLocaleFilter(e.target.value)}
                    className={LEDGER_SELECT}
                  >
                    <option value="ALL">ALL LOCALES (PER-LOCALE VIEW)</option>
                    {locales
                      .filter((l) => liveCityFilter === 'ALL' || l.city === liveCityFilter)
                      .map((l) => (
                        <option key={l.id} value={String(l.id)}>
                          {l.city.toUpperCase()} — {l.name.toUpperCase()}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {locales
                  .filter(
                    (l) =>
                      (liveCityFilter === 'ALL' || l.city === liveCityFilter) &&
                      (liveLocaleFilter === 'ALL' || String(l.id) === liveLocaleFilter)
                  )
                  .map((loc) => {
                    const locMembers = members.filter((m) => m.localeId === loc.id && !m.leftAt);
                    return (
                      <Panel
                        key={loc.id}
                        title={`${loc.city} — ${loc.name}`.toUpperCase()}
                        meta={loc.code}
                        bodyClassName="p-0"
                      >
                        <div className="divide-y divide-app">
                          {locMembers.length === 0 && (
                            <div className="p-3 text-[11px] font-mono text-app-muted">No active members.</div>
                          )}
                          {locMembers.map((m, mIdx) => {
                            const lg = logs[`${m.id}_${liveTgId}`] ?? { status: 'N', source: 'self' };
                            return (
                              <div
                                key={m.id}
                                className={`h-11 sm:h-9 px-3 flex items-center justify-between text-xs text-app ${
                                  mIdx % 2 === 1 ? 'bg-surface-2-subtle' : ''
                                }`}
                              >
                                <span className="font-medium truncate mr-2">{m.fullName}</span>
                                <span className="font-mono font-bold shrink-0">{lg.status}</span>
                              </div>
                            );
                          })}
                        </div>
                      </Panel>
                    );
                  })}
              </div>
            </section>
          )}
          {role === 'officer' && officerTab === 'reports' && (
            <OfficerReports
              locales={locales}
              reports={reports}
              month={reportMonth}
              monthLabel={reportMonthLabel}
              onReview={handleReview}
            />
          )}

          {role === 'officer' && officerTab === 'overview' && (
            <TkOverview members={members} locales={locales} rollup={computeMemberRollup} monthLabel={reportMonthLabel} isDark={darkMode} />
          )}

          {role === 'officer' && officerTab === 'upcoming' && (
            <EventsManager events={events} onSave={handleSaveEvent} onDelete={handleDeleteEvent} />
          )}

          {role === 'officer' && officerTab === 'events' && (
            <SpbbManager
              sessions={sessions}
              monthLabel={reportMonthLabel}
              onCreate={handleCreateSpbb}
              onDelete={handleDeleteSpbb}
            />
          )}

          {role === 'officer' && officerTab === 'admin' && (
            <MemberManager
              locale={currentLocale}
              members={members}
              onAdd={handleAddMember}
              onRename={handleRenameMember}
              onRemove={(id) => handleSetLeft(id, todayStr())}
              onRestore={(id) => handleSetLeft(id, null)}
              onUpdate={handleUpdateMembers}
            />
          )}
        </main>
      </div>

      {toastMsg && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-4 left-4 right-4 sm:left-auto sm:max-w-sm z-50 px-3 py-2 rounded-[2px] border border-app bg-surface-2 text-app text-xs font-mono tracking-[0.06em]"
          style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
        >
          {toastMsg}
        </div>
      )}
    </div>
  );
}
