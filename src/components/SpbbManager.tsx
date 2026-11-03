import React, { useState } from 'react';
import { SessionItem } from '../types/lnatk';
import { GlassPanel, GLASS_INPUT, GLASS_BTN, GLASS_BTN_PRIMARY } from './glass/GlassPanel';

interface Props {
  sessions: SessionItem[];
  monthLabel: string;
  onCreate: (eventName: string, dates: string[], liveStart: string, liveEnd: string) => Promise<boolean>;
  onDelete: (eventName: string) => void;
}

const labelClass = 'block text-xs font-semibold text-app-muted mb-1';

export default function SpbbManager({ sessions, monthLabel, onCreate, onDelete }: Props) {
  const [name, setName] = useState('');
  const [dates, setDates] = useState<string[]>(['', '', '']);
  const [liveStart, setLiveStart] = useState('14:30');
  const [liveEnd, setLiveEnd] = useState('15:30');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<string | null>(null);

  const events = new Map<string, SessionItem[]>();
  sessions
    .filter((s) => s.type === 'SPBB')
    .forEach((s) => {
      const ev = s.label.replace(/ D\d+$/, '');
      events.set(ev, [...(events.get(ev) ?? []), s]);
    });

  const submit = async () => {
    const filled = dates.filter(Boolean);
    if (!name.trim()) return setError('Give the event a name, e.g. SPBB Q4 2026.');
    if (filled.length === 0) return setError('Pick at least the D1 date.');
    if (dates.findIndex((d) => !d) !== -1 && dates.findIndex((d) => !d) < dates.filter(Boolean).length)
      return setError('Fill the days in order (D1, then D2, then D3).');
    setError('');
    setBusy(true);
    if (liveEnd <= liveStart) return setError('The live roster must close after it opens.');
    const ok = await onCreate(name.trim(), filled, liveStart, liveEnd);
    setBusy(false);
    if (ok) {
      setName('');
      setDates(['', '', '']);
    }
  };

  return (
    <section className="max-w-2xl mx-auto space-y-5 select-text">
      <GlassPanel title="Create SPBB Days" meta="Schedule Replacement" bodyClassName="p-4 sm:p-5 space-y-3.5">
        <p className="text-xs text-app-muted leading-relaxed">
          Replaces regular PM, WS and TG for that Monday–Sunday week with <strong>CPMWS | Practice | SPBB D1 | Practice | SPBB D2 | Practice | SPBB D3</strong>. Create before the week starts.
        </p>
        <label className={labelClass}>
          Event Name
          <input
            className={`${GLASS_INPUT} w-full mt-1`}
            placeholder="Event name, e.g. SPBB Q4 2026"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {dates.map((d, i) => (
            <label key={i} className={labelClass}>
              D{i + 1}
              {i > 0 && ' (optional)'}
              <input
                type="date"
                className={`${GLASS_INPUT} w-full mt-1 [color-scheme:light] dark:[color-scheme:dark]`}
                value={d}
                onChange={(e) => setDates((p) => p.map((x, idx) => (idx === i ? e.target.value : x)))}
              />
            </label>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className={labelClass}>
            Live roster opens
            <input
              type="time"
              className={`${GLASS_INPUT} w-full mt-1 [color-scheme:light] dark:[color-scheme:dark]`}
              value={liveStart}
              onChange={(e) => setLiveStart(e.target.value)}
            />
          </label>
          <label className={labelClass}>
            Live roster closes
            <input
              type="time"
              className={`${GLASS_INPUT} w-full mt-1 [color-scheme:light] dark:[color-scheme:dark]`}
              value={liveEnd}
              onChange={(e) => setLiveEnd(e.target.value)}
            />
          </label>
        </div>
        {error && <p className="text-xs text-rose-500 font-medium">{error}</p>}
        <button onClick={submit} disabled={busy} className={`${GLASS_BTN_PRIMARY} w-full mt-1`}>
          Create Event
        </button>
      </GlassPanel>

      <GlassPanel title={`Events in ${monthLabel}`} meta={`${events.size} scheduled`} bodyClassName="p-0">
        <div className="divide-y divide-divider">
          {events.size === 0 && (
            <div className="p-4 text-xs font-mono text-app-muted">No SPBB events this month.</div>
          )}
          {[...events.entries()].map(([ev, days], idx) => (
            <div
              key={ev}
              className={`px-4 sm:px-5 py-3 flex items-center justify-between gap-2 border-b border-divider hover:bg-white/[0.05] dark:hover:bg-white/[0.05] transition-colors ${
                idx % 2 === 1 ? 'bg-black/[0.025] dark:bg-white/[0.025]' : ''
              }`}
            >
              <div className="min-w-0">
                <div className="text-sm font-medium truncate text-app">{ev}</div>
                <div className="text-xs font-mono text-app-muted mt-0.5 tabular-nums">
                  {days.map((d) => `${d.shortLabel} · ${d.date.slice(5)}`).join('   ')}
                </div>
              </div>
              {confirm === ev ? (
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => {
                      onDelete(ev);
                      setConfirm(null);
                    }}
                    className="h-9 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-sm transition-all"
                  >
                    Delete
                  </button>
                  <button onClick={() => setConfirm(null)} className={GLASS_BTN}>
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirm(ev)}
                  className="h-9 px-3 rounded-xl border border-[var(--glass-border)] bg-[var(--glass)] hover:bg-[var(--glass-strong)] text-xs text-rose-500 font-semibold transition-all shrink-0"
                >
                  Delete
                </button>
              )}
            </div>
          ))}
        </div>
      </GlassPanel>
    </section>
  );
}
