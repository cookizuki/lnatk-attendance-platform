import React, { useState, useEffect, useMemo } from 'react';
import {
  CityName,
  PortalRole,
  OfficerTab,
  AttendanceStatus,
  statusLabel,
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
  officerSaveEvent,
  officerDeleteEvent,
} from './lib/dataLoader';
import CoordinatorReportForm from './components/CoordinatorReportForm';
import OfficerReports from './components/OfficerReports';
import MemberManager from './components/MemberManager';
import SpbbManager from './components/SpbbManager';
import UpcomingEvents from './components/UpcomingEvents';
import EventsManager from './components/EventsManager';
import { downloadExcel, printPdf, LocaleSummaryRow, MemberStatusRow } from './lib/exportReport';

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
  const [darkMode, setDarkMode] = useState(true);
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
    () => sessions.find((s) => s.type === 'TG' && s.statusWindow === 'live'),
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
    const tgs = sessions.filter((s) => s.type === 'TG').sort((a, b) => a.date.localeCompare(b.date));
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
        const d = await fetchOfficerMonth(reportMonth);
        if (cancelled) return;
        setLocales(mapLocales(d.locales));
        applySheet(d, null);
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
      triggerToast('The TG roster is only open while the TG is live on Saturday.');
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

  const handleCreateSpbb = async (eventName: string, dates: string[]): Promise<boolean> => {
    if (!isSupabaseConfigured) {
      triggerToast('Connect Supabase to create SPBB days.');
      return false;
    }
    try {
      await officerCreateSpbbEvent(eventName, dates);
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

  const renderEditableDutyTable = (sourceRole: 'self' | 'coordinator' | 'officer') => {
    const filteredMembers = members.filter(
      (m) =>
        m.localeId === currentLocale.id &&
        !m.leftAt &&
        m.fullName.toLowerCase().includes(memberSearch.toLowerCase())
    );

    const visibleWeeks = weekView === 'all' || !weekNums.includes(weekView) ? weekNums : [weekView];
    const chip = (active: boolean) =>
      `shrink-0 px-3 py-2 rounded-xl border text-left leading-tight ${
        active
          ? 'bg-brand-800 border-brand-800 text-white'
          : 'border-zinc-200 dark:border-obsidian-700 text-zinc-600 dark:text-zinc-300'
      }`;
    const legendChip = (cls: string, text: string) => (
      <span className={`inline-flex items-center justify-center min-w-[1.5rem] px-1.5 py-0.5 rounded font-mono text-[11px] font-semibold ${cls}`}>{text}</span>
    );

    return (
      <>
      <div className="px-3 sm:px-4 py-3 space-y-2.5 border-b border-zinc-200 dark:border-obsidian-800">
        <div className="flex gap-1.5 overflow-x-auto pb-1" role="tablist" aria-label="Weeks">
          {weekNums.map((w) => (
            <button key={w} role="tab" aria-selected={weekView === w} onClick={() => setWeekView(w)} className={chip(weekView === w)}>
              <div className="text-xs font-semibold">
                Week {w}
                {w === currentWeekNum && <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 align-middle" title="This week" />}
              </div>
              <div className="text-[10px] opacity-70">{weekLabel(w).replace(/^WEEK \d+ \(|\)$/g, '')}</div>
            </button>
          ))}
          <button role="tab" aria-selected={weekView === 'all'} onClick={() => setWeekView('all')} className={chip(weekView === 'all')}>
            <div className="text-xs font-semibold">All weeks</div>
            <div className="text-[10px] opacity-70">Full month</div>
          </button>
        </div>
        <details className="text-xs">
          <summary className="cursor-pointer text-zinc-500 py-1">What do the letters mean?</summary>
          <div className="mt-2 space-y-2">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <span className="font-semibold text-zinc-500">PM, WS, TG, SPBB</span>
              <span>{legendChip(CELL_TONE.D, 'D')} Dumalo</span>
              <span>{legendChip(CELL_TONE.S, 'S')} Sumayaw</span>
              <span>{legendChip(CELL_TONE.P, 'P')} Program</span>
              <span>{legendChip(CELL_TONE.A, 'A')} Absent</span>
              <span>{legendChip(CELL_TONE.N, 'N')} No Attendance</span>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <span className="font-semibold text-zinc-500">Practice</span>
              <span>{legendChip(PRACTICE_TONE.A, 'A')} Absent</span>
              <span>{legendChip(PRACTICE_TONE.K, 'K')} Kids TK</span>
              <span>{legendChip(PRACTICE_TONE.D, 'D')} District TK</span>
              <span>{legendChip(PRACTICE_TONE.S, 'S')} Self Study</span>
              <span>{legendChip(PRACTICE_TONE.NP, 'N')} No Practice</span>
              <span>{legendChip(PRACTICE_TONE.N, 'N')} No Attendance</span>
            </div>
            <p className="text-zinc-500">Each column locks when its entry window ends. The TG batch roster (coordinators) only opens while TG is live on Saturday. A green dot on a column means it is open for entries. Closed columns are locked; ask an officer to change them.</p>
          </div>
        </details>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs sheet-table">
          <thead>
            <tr className="bg-zinc-100/80 dark:bg-obsidian-900 text-zinc-600 dark:text-zinc-400">
              <th rowSpan={2} className="sticky-col-1 bg-zinc-100 dark:bg-obsidian-900 py-2 px-2 text-center font-mono text-[10px] w-9">
                #
              </th>
              <th rowSpan={2} className="sticky-col-2 bg-zinc-100 dark:bg-obsidian-900 py-2 px-3.5 font-semibold text-xs text-zinc-900 dark:text-zinc-100 min-w-[132px] sm:min-w-[170px]">
                Member Name
              </th>
              {visibleWeeks.map((w) => (
                <th
                  key={w}
                  colSpan={sessions.filter((s) => s.weekNum === w).length + 1}
                  className="py-1.5 px-2 text-center font-mono text-[10px] font-semibold tracking-wider text-zinc-700 dark:text-zinc-300 bg-zinc-100/60 dark:bg-obsidian-900"
                >
                  {weekLabel(w)}
                </th>
              ))}
              <th colSpan={2} className="py-1.5 px-2.5 text-center font-mono text-[10px] font-semibold tracking-wider text-brand-800 dark:text-brand-300 bg-brand-50/50 dark:bg-brand-950/30">
                ROLLUP
              </th>
            </tr>
            <tr className="bg-zinc-50 dark:bg-obsidian-900/80 text-zinc-500 dark:text-zinc-400">
              {visibleWeeks.map((w) => {
                const wSessions = sessions.filter((s) => s.weekNum === w);
                return (
                  <React.Fragment key={w}>
                    {wSessions.map((s) => (
                      <th key={s.id} className="py-1.5 px-1 text-center font-mono w-14">
                        <div className={`font-semibold text-[11px] ${s.type === 'TG' ? 'text-brand-700 dark:text-brand-400' : 'text-zinc-700 dark:text-zinc-300'}`}>
                          {s.shortLabel}
                        </div>
                        <div className="text-[9px] text-zinc-400 font-normal">{s.date.slice(5)}
                          {s.statusWindow !== 'closed' && (
                            <span className="ml-1 inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 align-middle" title="Open for entries" />
                          )}
                        </div>
                      </th>
                    ))}
                    <th className="py-1.5 px-1.5 text-center font-mono w-14 whitespace-nowrap bg-zinc-100/70 dark:bg-obsidian-900">
                      <div className="text-[10px] font-semibold text-zinc-600 dark:text-zinc-300">Week {w}</div>
                    </th>
                  </React.Fragment>
                );
              })}
              <th className="py-1.5 px-2 text-center font-mono text-[10px] font-semibold">Weeks</th>
              <th className="py-1.5 px-3 text-left font-mono text-[10px] font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredMembers.map((m, idx) => {
              const rollup = computeMemberRollup(m.id);
              const statusStyle =
                rollup.bucket === '3-4 Weeks Duty'
                  ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border-emerald-500/20'
                  : rollup.bucket === '1-2 Weeks Duty'
                  ? 'text-brand-700 dark:text-brand-300 bg-brand-500/10 border-brand-500/20'
                  : 'text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/20';

              return (
                <tr key={m.id} className="hover:bg-zinc-50/80 dark:hover:bg-obsidian-900/40">
                  <td className="sticky-col-1 bg-white dark:bg-obsidian-950 py-1.5 px-2 text-center font-mono text-[11px] text-zinc-400 tabular-nums">
                    {idx + 1}
                  </td>
                  <td className="sticky-col-2 bg-white dark:bg-obsidian-950 py-1.5 px-3.5 font-medium text-zinc-900 dark:text-zinc-100 whitespace-nowrap">
                    {m.fullName}
                  </td>
                  {visibleWeeks.map((w) => {
                    const wSessions = sessions.filter((s) => s.weekNum === w);
                    const wkBest = rollup.weekMarkers[w];
                    const wkDot =
                      wkBest === 'S' || wkBest === 'P'
                        ? 'text-emerald-700 dark:text-emerald-300 font-bold'
                        : wkBest === 'D'
                        ? 'text-amber-600 dark:text-amber-400 font-semibold'
                        : 'text-zinc-400 dark:text-zinc-600';

                    return (
                      <React.Fragment key={w}>
                        {wSessions.map((s) => {
                          const locked = sourceRole !== 'officer' && s.statusWindow === 'closed';
                          const lg = logs[`${m.id}_${s.id}`] ?? { status: 'N' as AttendanceStatus };
                          const tone = (s.type === 'Practice' ? PRACTICE_TONE : CELL_TONE)[lg.status] ?? CELL_TONE.N;
                          return (
                            <td key={s.id} className="p-0.5 text-center align-middle">
                              <div className={`relative inline-flex items-center justify-center w-12 h-11 sm:w-11 sm:h-8 rounded-md font-mono font-semibold text-sm sm:text-xs focus-within:ring-2 focus-within:ring-brand-500 ${tone} ${locked ? 'opacity-50' : ''}`}>
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
                                      className="bg-white dark:bg-obsidian-900 text-zinc-900 dark:text-white"
                                    >
                                      {statusLabel(st, s.type)}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </td>
                          );
                        })}
                        <td className={`p-1 text-center bg-zinc-50/70 dark:bg-obsidian-900/50 font-mono text-xs ${wkDot}`}>
                          {wkBest}
                        </td>
                      </React.Fragment>
                    );
                  })}
                  <td className="py-1.5 px-2 text-center font-mono font-semibold text-xs tabular-nums">
                    {rollup.weeksDuty}
                  </td>
                  <td className="py-1.5 px-3 whitespace-nowrap">
                    <span className={`inline-block px-2 py-0.5 rounded border text-[11px] font-medium ${statusStyle}`}>
                      {rollup.bucket}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      </>
    );
  };

  const locSummary = computeLocaleSummary(currentLocale.id);
  const cityLocales = locales.filter((l) => l.city === selectedCity);

  if (isSupabaseConfigured && (dataLoading || loadError || locales.length === 0)) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 p-6 text-center bg-white dark:bg-obsidian-950 text-zinc-900 dark:text-zinc-100">
        <div className="font-bold tracking-widest text-sm">LNATK ATTENDANCE PLATFORM</div>
        {loadError ? (
          <>
            <p className="text-xs text-rose-500 max-w-xs">{loadError}</p>
            <button
              onClick={() => { setLoadError(null); setDataLoading(true); setReloadTick((n) => n + 1); }}
              className="px-4 py-2 rounded-xl bg-brand-800 text-white text-xs font-semibold"
            >
              Try again
            </button>
          </>
        ) : (
          <p className="text-xs text-zinc-500">{dataLoading ? 'Loading…' : 'No locales found. Did you run the SQL migrations?'}</p>
        )}
      </div>
    );
  }

  return (
    <div className="h-full overflow-hidden bg-white dark:bg-obsidian-950 text-zinc-900 dark:text-zinc-100 flex select-none">
      {/* Left Sidebar (Hidden on Landing Log-In View) */}
      {role === 'officer' && (
        <>
        {sidebarOpen && (
          <div className="fixed inset-0 z-30 bg-black/50 md:hidden" onClick={() => setSidebarOpen(false)} />
        )}
        <aside
          className={`${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full md:hidden'
          } fixed md:static inset-y-0 left-0 z-40 w-64 shrink-0 bg-zinc-50 dark:bg-obsidian-900 border-r border-zinc-200 dark:border-obsidian-800 flex flex-col justify-between transition-transform`}
        >
          <div className="flex flex-col flex-1 min-h-0">
            <div className="h-14 px-4 border-b border-zinc-200 dark:border-obsidian-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-brand-800 text-white flex items-center justify-center font-mono font-bold text-xs">
                  TK
                </div>
                <span className="font-semibold text-sm tracking-tight">LNATK District</span>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                aria-label="Hide menu"
                title="Hide menu"
                className="p-2 rounded-lg text-zinc-500 hover:bg-zinc-200/70 dark:hover:bg-obsidian-800"
              >
                <span className="md:hidden"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg></span>
                <span className="hidden md:inline"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 3v18" /><path d="m16 9-3 3 3 3" /></svg></span>
              </button>
            </div>

            {/* Officer Modules & 18-Locale Tree */}
            {role === 'officer' && (
            <div className="flex-1 overflow-y-auto px-2.5 py-3 space-y-4">
              <div className="space-y-1">
                <div className="px-2 pb-1 text-[10px] font-mono uppercase tracking-wider text-zinc-400">
                  Officer Modules
                </div>
                {[
                  { id: 'grid', label: 'Duty Sheet' },
                  { id: 'dashboard', label: 'Overall Status' },
                  { id: 'reports', label: 'Coordinator Reports' },
                  { id: 'upcoming', label: 'Upcoming Events' },
                  { id: 'admin', label: 'Members' },
                  { id: 'events', label: 'SPBB Days' },
                  { id: 'inbox', label: 'Live Venue Board (Per Locale)' },
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      setRole('officer');
                      setOfficerTab(t.id as OfficerTab);
                      closeSidebarOnMobile();
                    }}
                    className={`w-full px-2.5 py-2 rounded-lg text-xs font-medium text-left transition-colors ${
                      role === 'officer' && officerTab === t.id
                        ? 'bg-brand-800 text-white font-semibold'
                        : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/60 dark:hover:bg-obsidian-850'
                    }`}
                  >
                    <span className="flex items-center justify-between">
                      {t.label}
                      {t.id === 'reports' && unreadReports > 0 && (
                        <span className="ml-2 px-1.5 rounded-full bg-brand-500 text-white text-[10px] font-mono">{unreadReports}</span>
                      )}
                    </span>
                  </button>
                ))}
              </div>

              <div className="space-y-2 pt-2 border-t border-zinc-200 dark:border-obsidian-800">
                <div className="px-2 text-[10px] font-mono uppercase tracking-wider text-zinc-400">
                  18 Locales (3 Cities)
                </div>
                {(['Santa Rosa', 'Biñan', 'San Pedro'] as CityName[]).map((city) => (
                  <div key={city} className="space-y-0.5">
                    <div className="px-2 py-0.5 text-[10px] font-semibold text-zinc-400">{city}</div>
                    {locales
                      .filter((l) => l.city === city)
                      .map((l) => (
                        <button
                          key={l.id}
                          onClick={() => {
                            setSelectedCity(l.city);
                            setSelectedLocaleId(l.id);
                            closeSidebarOnMobile();
                          }}
                          className={`w-full px-2.5 py-1.5 rounded-md text-xs flex items-center justify-between ${
                            selectedLocaleId === l.id
                              ? 'bg-brand-800/10 dark:bg-brand-500/15 text-brand-800 dark:text-brand-300 font-semibold'
                              : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/60 dark:hover:bg-obsidian-850'
                          }`}
                        >
                          <span className="truncate">{l.name}</span>
                          <span className="font-mono text-[10px] opacity-60">{(l.code || '').split('-')[1]}</span>
                        </button>
                      ))}
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
        <header className="h-14 shrink-0 border-b border-zinc-200 dark:border-obsidian-800 px-3 sm:px-6 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm min-w-0">
            {role === 'officer' && (
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                aria-label={sidebarOpen ? 'Hide menu' : 'Show menu'}
                aria-expanded={sidebarOpen}
                title="Show menu"
                className={`p-2 rounded-lg border border-zinc-200 dark:border-obsidian-800 hover:bg-zinc-100 dark:hover:bg-obsidian-900 ${sidebarOpen ? 'md:hidden' : ''}`}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 3v18" /><path d="m14 9 3 3-3 3" /></svg>
              </button>
            )}
            {role === 'landing' ? (
              <span className="font-bold tracking-widest text-xs sm:text-sm">LNATK ATTENDANCE PLATFORM</span>
            ) : role === 'officer' ? (
              <span className="font-semibold truncate">
                {OFFICER_TAB_LABELS[officerTab]}
                {(officerTab === 'grid' || officerTab === 'admin') && ` — ${currentLocale.name}`}
              </span>
            ) : (
              <>
                <span className="text-zinc-400 font-medium hidden sm:inline">{currentLocale.city}</span>
                <span className="text-zinc-300 dark:text-zinc-700 hidden sm:inline">/</span>
                <span className="font-semibold truncate">{currentLocale.name}</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {role !== 'landing' && isSupabaseConfigured && (
              <input
                type="month"
                value={reportMonth}
                onChange={(e) => e.target.value && setReportMonth(e.target.value)}
                className="px-2 py-1 w-[8.5rem] rounded-lg border border-zinc-200 dark:border-obsidian-800 bg-transparent text-xs"
              />
            )}
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-obsidian-800 text-xs font-medium"
            >
              {darkMode ? 'Light' : 'Dark'}
            </button>
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
                className="px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-obsidian-800 text-xs font-medium"
              >
                Log Out
              </button>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-3 sm:p-6">
          {/* VIEW 1: CENTERED LOG-IN SCREEN */}
          {role === 'landing' && (
            <section className="min-h-[calc(100vh-6.5rem)] flex flex-col items-center justify-center">
              <div className="w-full max-w-sm md:max-w-4xl md:grid md:grid-cols-2 md:gap-10 md:items-start space-y-8 md:space-y-0">
              <div className="space-y-5">
                <div className="text-center space-y-1.5">
                  <div className="inline-flex items-center justify-center w-10 h-10 rounded-2xl bg-brand-800 text-white font-mono font-bold text-sm">
                    TK
                  </div>
                  <h1 className="text-xl font-bold tracking-widest uppercase">Log-In</h1>
                  <p className="text-xs text-zinc-500">LNATK District Attendance Platform</p>
                </div>

                <div className="rounded-[28px] border-2 border-zinc-200 dark:border-obsidian-700 bg-white dark:bg-obsidian-900 shadow-2xl overflow-hidden">
                  {loginStep === 'stack' && (
                    <div className="divide-y-2 divide-zinc-200 dark:divide-obsidian-800">
                      <button
                        onClick={() => setLoginStep('tk')}
                        className="w-full py-6 px-6 text-center hover:bg-brand-50/60 dark:hover:bg-brand-950/30 transition-colors"
                      >
                        <div className="text-lg font-semibold">Regular TK</div>
                        <div className="text-[11px] text-zinc-400">
                          Select your city & locale · View & edit locale table
                        </div>
                      </button>
                      <button
                        onClick={() => setLoginStep('coordinator')}
                        className="w-full py-6 px-6 text-center hover:bg-brand-50/60 dark:hover:bg-brand-950/30 transition-colors"
                      >
                        <div className="text-lg font-semibold">Coordinator</div>
                        <div className="text-[11px] text-zinc-400">
                          Choose your locale + PIN · Submit TG roster & monthly report
                        </div>
                      </button>
                      <button
                        onClick={() => setLoginStep('officer')}
                        className="w-full py-6 px-6 text-center hover:bg-brand-50/60 dark:hover:bg-brand-950/30 transition-colors"
                      >
                        <div className="text-lg font-semibold">Officer</div>
                        <div className="text-[11px] text-zinc-400">
                          District login · Full access to all 18 locales
                        </div>
                      </button>
                    </div>
                  )}

                  {loginStep === 'tk' && (
                    <div className="p-6 space-y-4">
                      <div className="flex items-center justify-between">
                        <button onClick={() => setLoginStep('stack')} className="text-xs text-zinc-400">
                          ← Back
                        </button>
                        <span className="text-xs font-semibold uppercase text-brand-600">Regular TK</span>
                      </div>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-medium mb-1">Select City</label>
                          <select
                            value={selectedCity}
                            onChange={(e) => {
                              const city = e.target.value as CityName;
                              setSelectedCity(city);
                              const first = locales.find((l) => l.city === city);
                              if (first) setSelectedLocaleId(first.id);
                            }}
                            className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 dark:border-obsidian-700 bg-zinc-50 dark:bg-obsidian-950 text-xs font-semibold"
                          >
                            <option value="Santa Rosa">Santa Rosa</option>
                            <option value="Biñan">Biñan</option>
                            <option value="San Pedro">San Pedro</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-1">Select Locale</label>
                          <select
                            value={selectedLocaleId}
                            onChange={(e) => setSelectedLocaleId(Number(e.target.value))}
                            className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 dark:border-obsidian-700 bg-zinc-50 dark:bg-obsidian-950 text-xs font-semibold"
                          >
                            {cityLocales.map((l) => (
                              <option key={l.id} value={l.id}>
                                {l.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <button
                        onClick={() => setRole('tk')}
                        className="w-full py-2.5 px-4 rounded-xl bg-brand-800 hover:bg-brand-700 text-white text-xs font-semibold"
                      >
                        Enter Locale Table
                      </button>
                    </div>
                  )}

                  {loginStep === 'coordinator' && (
                    <div className="p-6 space-y-4">
                      <div className="flex items-center justify-between">
                        <button onClick={() => setLoginStep('stack')} className="text-xs text-zinc-400">
                          ← Back
                        </button>
                        <span className="text-xs font-semibold uppercase text-brand-600">Coordinator</span>
                      </div>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-medium mb-1">Your Locale</label>
                          <select
                            value={coordLocaleId}
                            onChange={(e) => setCoordLocaleId(Number(e.target.value))}
                            className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 dark:border-obsidian-700 bg-zinc-50 dark:bg-obsidian-950 text-base sm:text-xs font-semibold"
                          >
                            {(['Santa Rosa', 'Biñan', 'San Pedro'] as CityName[]).map((city) => (
                              <optgroup key={city} label={city}>
                                {locales.filter((l) => l.city === city).map((l) => (
                                  <option key={l.id} value={l.id}>{l.name}</option>
                                ))}
                              </optgroup>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-1">Coordinator PIN</label>
                          <input
                            type="password"
                            inputMode="numeric"
                            value={coordPinInput}
                            onChange={(e) => setCoordPinInput(e.target.value)}
                            className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 dark:border-obsidian-700 bg-zinc-50 dark:bg-obsidian-950 font-mono text-base sm:text-xs"
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
                        className="w-full py-2.5 px-4 rounded-xl bg-brand-800 hover:bg-brand-700 text-white text-xs font-semibold"
                      >
                        Unlock Coordinator Account
                      </button>
                    </div>
                  )}

                  {loginStep === 'officer' && (
                    <div className="p-6 space-y-4">
                      <div className="flex items-center justify-between">
                        <button onClick={() => setLoginStep('stack')} className="text-xs text-zinc-400">
                          ← Back
                        </button>
                        <span className="text-xs font-semibold uppercase text-brand-600">District Officer</span>
                      </div>
                      <div className="space-y-3">
                        <input
                          type="email"
                          placeholder="Officer email"
                          value={officerEmail}
                          onChange={(e) => setOfficerEmail(e.target.value)}
                          className="w-full px-3.5 py-2 rounded-xl border border-zinc-300 dark:border-obsidian-700 bg-zinc-50 dark:bg-obsidian-950 text-xs"
                        />
                        <input
                          type="password"
                          placeholder="Password"
                          value={officerPassword}
                          onChange={(e) => setOfficerPassword(e.target.value)}
                          className="w-full px-3.5 py-2 rounded-xl border border-zinc-300 dark:border-obsidian-700 bg-zinc-50 dark:bg-obsidian-950 text-xs"
                        />
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
                        className="w-full py-2.5 px-4 rounded-xl bg-brand-800 hover:bg-brand-700 text-white text-xs font-semibold disabled:opacity-60"
                      >
                        Sign In to Officer Workspace
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <UpcomingEvents events={events} />
              </div>
            </section>
          )}

          {/* VIEW 2: REGULAR TK VIEW */}
          {role === 'tk' && (
            <section className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={selectedCity}
                    onChange={(e) => {
                      const c = e.target.value as CityName;
                      setSelectedCity(c);
                      const first = locales.find((l) => l.city === c);
                      if (first) setSelectedLocaleId(first.id);
                    }}
                    className="px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-obsidian-800 bg-zinc-50 dark:bg-obsidian-900 text-xs font-medium"
                  >
                    <option value="Santa Rosa">Santa Rosa</option>
                    <option value="Biñan">Biñan</option>
                    <option value="San Pedro">San Pedro</option>
                  </select>
                  <select
                    value={selectedLocaleId}
                    onChange={(e) => setSelectedLocaleId(Number(e.target.value))}
                    className="px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-obsidian-800 bg-zinc-50 dark:bg-obsidian-900 text-xs font-semibold"
                  >
                    {cityLocales.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    placeholder="Find your name..."
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    className="px-3 py-1.5 w-44 rounded-lg border border-zinc-200 dark:border-obsidian-800 bg-zinc-50 dark:bg-obsidian-900 text-xs"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-1.5 text-xs font-mono">
                  <div className="px-2.5 py-1 rounded-md bg-zinc-100 dark:bg-obsidian-900 border border-zinc-200 dark:border-obsidian-800">
                    3-4 Weeks Duty: <strong className="text-emerald-500">{locSummary.duty34}</strong>
                  </div>
                  <div className="px-2.5 py-1 rounded-md bg-zinc-100 dark:bg-obsidian-900 border border-zinc-200 dark:border-obsidian-800">
                    1-2 Weeks Duty: <strong className="text-brand-400">{locSummary.duty12}</strong>
                  </div>
                  <div className="px-2.5 py-1 rounded-md bg-zinc-100 dark:bg-obsidian-900 border border-zinc-200 dark:border-obsidian-800">
                    No Duty: <strong className="text-rose-400">{locSummary.noDuty}</strong>
                  </div>
                </div>
              </div>

              <div className="border border-zinc-200 dark:border-obsidian-800 rounded-xl bg-white dark:bg-obsidian-900 overflow-hidden">
                <div className="px-4 py-2.5 bg-zinc-50 dark:bg-obsidian-900 border-b border-zinc-200 dark:border-obsidian-800 flex items-center justify-between text-xs">
                  <span className="font-semibold">
                    {currentLocale.city} — Locale of {currentLocale.name} Regular Duty Sheet
                  </span>
                  <span className="font-mono text-[11px] text-brand-700 dark:text-brand-300 bg-brand-500/10 px-2 py-0.5 rounded">
                    Regular TK · Click Any Cell to Edit
                  </span>
                </div>
                {renderEditableDutyTable('self')}
              </div>
            </section>
          )}

          {/* VIEW 3: COORDINATOR VIEW */}
          {role === 'coordinator' && (
            <div className="flex gap-1.5 mb-4 p-1 rounded-xl bg-zinc-200/70 dark:bg-obsidian-900 w-fit">
              {([['duty', 'Duty Sheet'], ['report', 'Monthly Report']] as const).map(([id, lbl]) => (
                <button
                  key={id}
                  onClick={() => setCoordTab(id)}
                  className={`px-4 py-2 rounded-lg text-xs font-semibold ${
                    coordTab === id ? 'bg-white dark:bg-obsidian-800 shadow-sm' : 'text-zinc-500'
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
              <div className="max-w-xl mx-auto w-full border border-zinc-200 dark:border-obsidian-800 rounded-xl bg-white dark:bg-obsidian-900 p-4 sm:p-5 space-y-4">
                <div className="border-b border-zinc-100 dark:border-obsidian-800 pb-3">
                  <h2 className="text-sm font-semibold">Batch TG Duty Roster</h2>
                  <p className="text-xs text-zinc-500">
                    Mark multiple members for TG at once and submit to the locale table.
                  </p>
                </div>

                <div className="flex items-center justify-between gap-2 rounded-lg border border-zinc-200 dark:border-obsidian-800 px-3.5 py-2.5 text-xs">
                  <span className="text-zinc-500">Session</span>
                  {liveTg ? (
                    <span className="font-semibold flex items-center gap-1.5">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      {liveTg.label} · {liveTg.date} · Live now
                    </span>
                  ) : (
                    <span className="font-semibold text-amber-600 dark:text-amber-400">Not live</span>
                  )}
                </div>
                {!liveTg && (
                  <p className="text-xs text-zinc-500">
                    This roster is only open while the Saturday TG is live. Outside of that, use the duty sheet below or ask an officer.
                  </p>
                )}

                {liveTg && (
                  <>
                <div className="divide-y divide-zinc-200 dark:divide-obsidian-800 rounded-lg border border-zinc-200 dark:border-obsidian-800 max-h-96 overflow-y-auto">
                  {members
                    .filter((m) => m.localeId === currentLocale.id && !m.leftAt)
                    .map((m) => {
                      const cur = coordDraft[m.id] ?? logs[`${m.id}_${coordSessionId}`]?.status ?? 'N';
                      return (
                        <div key={m.id} className="px-3.5 py-2.5 flex items-center justify-between text-xs">
                          <span className="font-medium">{m.fullName}</span>
                          <div className="flex items-center gap-1">
                            {(['S', 'P', 'D', 'A'] as AttendanceStatus[]).map((st) => (
                              <button
                                key={st}
                                onClick={() => setCoordDraft((prev) => ({ ...prev, [m.id]: st }))}
                                className={`w-7 h-7 rounded font-mono text-xs font-semibold border ${
                                  cur === st
                                    ? 'bg-brand-800 text-white border-brand-700'
                                    : 'bg-zinc-50 dark:bg-obsidian-950 border-zinc-200 dark:border-obsidian-800'
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
                  className="w-full py-2 px-4 rounded-lg bg-brand-800 hover:bg-brand-700 text-white font-semibold text-xs"
                >
                  Submit Coordinator Batch
                </button>
                  </>
                )}
              </div>

              <div className="border border-zinc-200 dark:border-obsidian-800 rounded-xl bg-white dark:bg-obsidian-900 overflow-hidden">
                <div className="px-4 py-3 bg-zinc-50 dark:bg-obsidian-900 border-b border-zinc-200 dark:border-obsidian-800 flex items-center justify-between text-xs">
                  <span className="font-semibold">
                    {currentLocale.city} — Locale of {currentLocale.name} Regular Duty Sheet
                  </span>
                  <span className="font-mono text-[11px] text-brand-700 dark:text-brand-300 bg-brand-500/10 px-2 py-0.5 rounded">
                    Editable Table · Auto-Syncs
                  </span>
                </div>
                {renderEditableDutyTable('coordinator')}
              </div>
            </section>
          )}

          {/* VIEW 4: OFFICER WORKSPACE */}
          {role === 'officer' && officerTab === 'grid' && (
            <section className="space-y-4">
              <div className="border border-zinc-200 dark:border-obsidian-800 rounded-xl bg-white dark:bg-obsidian-900 overflow-hidden">
                {renderEditableDutyTable('officer')}
              </div>
            </section>
          )}

          {role === 'officer' && officerTab === 'dashboard' && (
            <section className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">All Locales — {reportMonthLabel}</h3>
                <div className="flex gap-2">
                  <button onClick={handleDownloadExcel} className="px-3 py-2 rounded-lg bg-brand-800 hover:bg-brand-700 text-white text-xs font-semibold">
                    Download Excel
                  </button>
                  <button onClick={handleDownloadPdf} className="px-3 py-2 rounded-lg border border-zinc-300 dark:border-obsidian-700 text-xs font-semibold">
                    Download PDF
                  </button>
                </div>
              </div>
              {(['Santa Rosa', 'Biñan', 'San Pedro'] as CityName[]).map((city) => (
                <div
                  key={city}
                  className="border border-zinc-200 dark:border-obsidian-800 rounded-xl bg-white dark:bg-obsidian-900 overflow-hidden"
                >
                  <div className="px-4 py-3 bg-zinc-50 dark:bg-obsidian-950 border-b border-zinc-200 dark:border-obsidian-800 font-semibold text-sm">
                    {city}
                  </div>
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-zinc-200 dark:border-obsidian-800 text-zinc-400">
                      <tr>
                        <th className="py-2 px-4">Locale</th>
                        <th className="py-2 px-3 text-right">3–4 Weeks</th>
                        <th className="py-2 px-3 text-right">1–2 Weeks</th>
                        <th className="py-2 px-3 text-right">No Duty</th>
                        <th className="py-2 px-4 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-obsidian-800">
                      {locales
                        .filter((l) => l.city === city)
                        .map((loc) => {
                          const s = computeLocaleSummary(loc.id);
                          return (
                            <tr key={loc.id}>
                              <td className="py-2.5 px-4 font-medium">{loc.name}</td>
                              <td className="py-2.5 px-3 text-right font-mono text-emerald-500 font-semibold">
                                {s.duty34}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono text-brand-400 font-semibold">
                                {s.duty12}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono text-rose-400 font-semibold">
                                {s.noDuty}
                              </td>
                              <td className="py-2.5 px-4 text-right font-mono font-semibold">{s.total}</td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              ))}
            </section>
          )}

          {role === 'officer' && officerTab === 'inbox' && (
            <section className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">Live Venue Board (Saturday TG — Per Locale)</h3>
                <div className="flex items-center gap-2">
                  <select
                    value={liveCityFilter}
                    onChange={(e) => {
                      setLiveCityFilter(e.target.value);
                      setLiveLocaleFilter('ALL');
                    }}
                    className="px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-obsidian-800 bg-zinc-50 dark:bg-obsidian-950 text-xs"
                  >
                    <option value="ALL">All Cities (3)</option>
                    <option value="Santa Rosa">Santa Rosa (7)</option>
                    <option value="Biñan">Biñan (7)</option>
                    <option value="San Pedro">San Pedro (4)</option>
                  </select>
                  <select
                    value={liveLocaleFilter}
                    onChange={(e) => setLiveLocaleFilter(e.target.value)}
                    className="px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-obsidian-800 bg-zinc-50 dark:bg-obsidian-950 text-xs font-semibold"
                  >
                    <option value="ALL">All Locales (Per-Locale View)</option>
                    {locales
                      .filter((l) => liveCityFilter === 'ALL' || l.city === liveCityFilter)
                      .map((l) => (
                        <option key={l.id} value={String(l.id)}>
                          {l.city} — {l.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {locales
                  .filter(
                    (l) =>
                      (liveCityFilter === 'ALL' || l.city === liveCityFilter) &&
                      (liveLocaleFilter === 'ALL' || String(l.id) === liveLocaleFilter)
                  )
                  .map((loc) => {
                    const locMembers = members.filter((m) => m.localeId === loc.id && !m.leftAt);
                    return (
                      <div
                        key={loc.id}
                        className="rounded-xl border border-zinc-200 dark:border-obsidian-800 bg-white dark:bg-obsidian-900 overflow-hidden"
                      >
                        <div className="px-4 py-2.5 bg-zinc-50 dark:bg-obsidian-950 border-b border-zinc-200 dark:border-obsidian-800 flex items-center justify-between text-xs">
                          <span className="font-semibold">
                            {loc.city} — {loc.name}
                          </span>
                          <span className="font-mono text-[10px] text-zinc-400">{loc.code}</span>
                        </div>
                        <div className="divide-y divide-zinc-100 dark:divide-obsidian-800">
                          {locMembers.map((m) => {
                            const lg = logs[`${m.id}_${liveTgId}`] ?? { status: 'N', source: 'self' };
                            return (
                              <div key={m.id} className="px-4 py-2 flex items-center justify-between text-xs">
                                <span>{m.fullName}</span>
                                <span className="font-mono font-bold">{lg.status}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
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
            />
          )}
        </main>
      </div>

      {toastMsg && (
        <div role="status" aria-live="polite" className="fixed bottom-4 left-4 right-4 sm:left-auto sm:max-w-sm z-50 px-4 py-3 rounded-xl bg-zinc-900 dark:bg-obsidian-800 text-white text-sm sm:text-xs font-medium shadow-lg" style={{ marginBottom: 'env(safe-area-inset-bottom)' }}>
          {toastMsg}
        </div>
      )}
    </div>
  );
}
