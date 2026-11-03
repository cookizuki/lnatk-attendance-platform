import React, { useState } from 'react';
import { SessionItem } from '../types/lnatk';
import { Panel, LEDGER_INPUT, LEDGER_BTN, LEDGER_BTN_PRIMARY } from './ledger/LedgerComponents';

interface Props {
  sessions: SessionItem[];
  monthLabel: string;
  onCreate: (eventName: string, dates: string[], liveStart: string, liveEnd: string) => Promise<boolean>;
  onDelete: (eventName: string) => void;
}

const labelClass = 'block font-mono uppercase text-[11px] font-semibold text-app-muted tracking-[0.06em]';

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
    <section className="max-w-2xl mx-auto space-y-4 select-text">
      <Panel title="CREATE SPBB DAYS" meta="SCHEDULE REPLACEMENT" bodyClassName="p-3 sm:p-4 space-y-3">
        <p className="text-[11px] font-mono text-app-muted">
          Replaces regular PM, WS and TG for that Monday–Sunday week with CPMWS, Practice, and SPBB D1–D3. Create before
          the week starts.
        </p>
        <label className={labelClass}>
          Event Name
          <input
            className={`${LEDGER_INPUT} w-full mt-1`}
            placeholder="e.g. SPBB Q4 2026"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {dates.map((d, i) => (
            <label key={i} className={labelClass}>
              D{i + 1}
              {i > 0 && ' (optional)'}
              <input
                type="date"
                className={`${LEDGER_INPUT} w-full mt-1 [color-scheme:light] dark:[color-scheme:dark]`}
                value={d}
                onChange={(e) => setDates((p) => p.map((x, idx) => (idx === i ? e.target.value : x)))}
              />
            </label>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className={labelClass}>
            Live roster opens
            <input
              type="time"
              className={`${LEDGER_INPUT} w-full mt-1 [color-scheme:light] dark:[color-scheme:dark]`}
              value={liveStart}
              onChange={(e) => setLiveStart(e.target.value)}
            />
          </label>
          <label className={labelClass}>
            Live roster closes
            <input
              type="time"
              className={`${LEDGER_INPUT} w-full mt-1 [color-scheme:light] dark:[color-scheme:dark]`}
              value={liveEnd}
              onChange={(e) => setLiveEnd(e.target.value)}
            />
          </label>
        </div>
        {error && <p className="text-[11px] font-mono text-rose-500">{error}</p>}
        <button onClick={submit} disabled={busy} className={`${LEDGER_BTN_PRIMARY} w-full mt-1`}>
          CREATE EVENT
        </button>
      </Panel>

      <Panel title={`EVENTS IN ${monthLabel.toUpperCase()}`} meta={`${events.size} EVENTS`} bodyClassName="p-0">
        <div className="divide-y divide-app">
          {events.size === 0 && (
            <div className="p-4 text-xs font-mono text-app-muted">No SPBB events this month.</div>
          )}
          {[...events.entries()].map(([ev, days], idx) => (
            <div
              key={ev}
              className={`px-3 py-2 flex items-center justify-between gap-2 hover:bg-surface-2 transition-colors ${
                idx % 2 === 1 ? 'bg-surface-2-subtle' : ''
              }`}
            >
              <div className="min-w-0">
                <div className="text-xs sm:text-sm font-medium truncate text-app">{ev}</div>
                <div className="text-[11px] font-mono text-app-muted mt-0.5 tabular-nums">
                  {days.map((d) => `${d.shortLabel} · ${d.date.slice(5)}`).join('   ')}
                </div>
              </div>
              {confirm === ev ? (
                <div className="flex gap-1.5 shrink-0">
                  <button
                    onClick={() => {
                      onDelete(ev);
                      setConfirm(null);
                    }}
                    className="h-9 sm:h-7 px-2.5 rounded-[2px] bg-rose-600 hover:bg-rose-500 text-white font-mono uppercase text-[11px] tracking-[0.06em] font-medium transition-colors"
                  >
                    DELETE
                  </button>
                  <button onClick={() => setConfirm(null)} className={LEDGER_BTN}>
                    CANCEL
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirm(ev)}
                  className="h-9 sm:h-7 px-2.5 rounded-[2px] border border-app-strong bg-transparent hover:bg-surface-2 text-rose-500 font-mono uppercase text-[11px] tracking-[0.06em] font-medium transition-colors shrink-0"
                >
                  DELETE
                </button>
              )}
            </div>
          ))}
        </div>
      </Panel>
    </section>
  );
}
