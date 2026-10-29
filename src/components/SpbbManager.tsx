import React, { useState } from 'react';
import { SessionItem } from '../types/lnatk';

interface Props {
  sessions: SessionItem[];
  monthLabel: string;
  onCreate: (eventName: string, dates: string[], liveStart: string, liveEnd: string) => Promise<boolean>;
  onDelete: (eventName: string) => void;
}

const input =
  'px-3 py-2 rounded-lg border border-zinc-300 dark:border-obsidian-700 bg-zinc-50 dark:bg-obsidian-950 text-base sm:text-sm';

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
    if (ok) { setName(''); setDates(['', '', '']); }
  };

  return (
    <section className="max-w-2xl mx-auto space-y-4 select-text">
      <div className="border border-zinc-200 dark:border-obsidian-800 rounded-xl bg-white dark:bg-obsidian-900 p-4 space-y-3">
        <h3 className="text-sm font-semibold">Create SPBB days</h3>
        <p className="text-[11px] text-zinc-500">
          That week's columns become <strong>CPMWS | Practice | SPBB D1 | Practice | SPBB D2 | Practice | SPBB D3</strong>. The week's regular PM, WS and TG are replaced, so create the event before the week starts. All days must be in the same Monday to Sunday week. Coordinators get the live roster for each SPBB day during its live time. Entries close at the end of that week's Tuesday.
        </p>
        <input className={`${input} w-full`} placeholder="Event name, e.g. SPBB Q4 2026" value={name} onChange={(e) => setName(e.target.value)} />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {dates.map((d, i) => (
            <label key={i} className="text-[11px] font-semibold text-zinc-500">
              D{i + 1}{i > 0 && ' (optional)'}
              <input type="date" className={`${input} w-full mt-1`} value={d}
                onChange={(e) => setDates((p) => p.map((x, idx) => (idx === i ? e.target.value : x)))} />
            </label>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-[11px] font-semibold text-zinc-500">Live roster opens
            <input type="time" className={`${input} w-full mt-1`} value={liveStart} onChange={(e) => setLiveStart(e.target.value)} />
          </label>
          <label className="text-[11px] font-semibold text-zinc-500">Live roster closes
            <input type="time" className={`${input} w-full mt-1`} value={liveEnd} onChange={(e) => setLiveEnd(e.target.value)} />
          </label>
        </div>
        {error && <p className="text-xs text-rose-500">{error}</p>}
        <button onClick={submit} disabled={busy}
          className="w-full py-2.5 rounded-xl bg-brand-800 hover:bg-brand-700 text-white text-xs font-semibold disabled:opacity-60">
          Create event
        </button>
      </div>

      <div className="border border-zinc-200 dark:border-obsidian-800 rounded-xl bg-white dark:bg-obsidian-900 divide-y divide-zinc-100 dark:divide-obsidian-800">
        <div className="px-4 py-2.5 text-xs font-semibold">Events in {monthLabel}</div>
        {events.size === 0 && <div className="p-4 text-xs text-zinc-400">No SPBB events this month.</div>}
        {[...events.entries()].map(([ev, days]) => (
          <div key={ev} className="px-4 py-3 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-sm font-medium truncate">{ev}</div>
              <div className="text-[11px] text-zinc-500">{days.map((d) => `${d.shortLabel} · ${d.date.slice(5)}`).join('   ')}</div>
            </div>
            {confirm === ev ? (
              <div className="flex gap-1.5 shrink-0">
                <button onClick={() => { onDelete(ev); setConfirm(null); }} className="px-3 py-2 rounded-lg bg-rose-600 text-white text-xs font-semibold">Delete</button>
                <button onClick={() => setConfirm(null)} className="px-3 py-2 rounded-lg border border-zinc-300 dark:border-obsidian-700 text-xs">Cancel</button>
              </div>
            ) : (
              <button onClick={() => setConfirm(ev)} className="px-3 py-2 rounded-lg border border-zinc-300 dark:border-obsidian-700 text-xs text-rose-500 shrink-0">Delete</button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
