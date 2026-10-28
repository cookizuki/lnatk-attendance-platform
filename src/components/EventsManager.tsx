import React, { useState } from 'react';
import { EventItem } from '../types/lnatk';
import { dateRange, formatTime, relativeLabel, todayManila } from '../lib/eventDates';

interface Props {
  events: EventItem[];
  onSave: (ev: Omit<EventItem, 'id'> & { id?: string }) => Promise<boolean>;
  onDelete: (id: string) => void;
}

const input =
  'px-3 py-2 rounded-lg border border-zinc-300 dark:border-obsidian-700 bg-zinc-50 dark:bg-obsidian-950 text-base sm:text-sm w-full';
const label = 'block text-[11px] font-semibold text-zinc-500';
const blank = { title: '', date: '', endDate: '', time: '', location: '', details: '' };

export default function EventsManager({ events, onSave, onDelete }: Props) {
  const [form, setForm] = useState(blank);
  const [editId, setEditId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<string | null>(null);

  const today = todayManila();
  const upcoming = events.filter((e) => (e.endDate ?? e.date) >= today).sort((a, b) => a.date.localeCompare(b.date));
  const past = events.filter((e) => (e.endDate ?? e.date) < today).sort((a, b) => b.date.localeCompare(a.date));
  const set = (k: keyof typeof blank, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const submit = async () => {
    if (!form.title.trim()) return setError('Give the event a title.');
    if (!form.date) return setError('Pick the date.');
    if (form.endDate && form.endDate < form.date) return setError('The end date is before the start date.');
    setError('');
    setBusy(true);
    const ok = await onSave({
      id: editId ?? undefined, title: form.title.trim(), date: form.date, endDate: form.endDate || null,
      time: form.time || null, location: form.location.trim(), details: form.details.trim(),
    });
    setBusy(false);
    if (ok) { setForm(blank); setEditId(null); }
  };

  const edit = (e: EventItem) => {
    setEditId(e.id);
    setForm({ title: e.title, date: e.date, endDate: e.endDate ?? '', time: e.time ?? '', location: e.location, details: e.details });
    window.scrollTo?.({ top: 0, behavior: 'smooth' });
  };

  const row = (e: EventItem, isPast: boolean) => (
    <div key={e.id} className="px-4 py-3 flex items-center justify-between gap-2">
      <div className="min-w-0">
        <div className="text-sm font-medium truncate">{e.title}</div>
        <div className="text-[11px] text-zinc-500 truncate">
          {[dateRange(e.date, e.endDate), formatTime(e.time), e.location].filter(Boolean).join(' · ')}
          {!isPast && ` · ${relativeLabel(e.date, e.endDate, today)}`}
        </div>
      </div>
      {confirm === e.id ? (
        <div className="flex gap-1.5 shrink-0">
          <button onClick={() => { onDelete(e.id); setConfirm(null); }} className="px-3 py-2 rounded-lg bg-rose-600 text-white text-xs font-semibold">Delete</button>
          <button onClick={() => setConfirm(null)} className="px-3 py-2 rounded-lg border border-zinc-300 dark:border-obsidian-700 text-xs">Cancel</button>
        </div>
      ) : (
        <div className="flex gap-1.5 shrink-0">
          <button onClick={() => edit(e)} className="px-3 py-2 rounded-lg border border-zinc-300 dark:border-obsidian-700 text-xs font-semibold">Edit</button>
          <button onClick={() => setConfirm(e.id)} className="px-3 py-2 rounded-lg border border-zinc-300 dark:border-obsidian-700 text-xs text-rose-500">Delete</button>
        </div>
      )}
    </div>
  );

  return (
    <section className="max-w-2xl mx-auto space-y-4 select-text">
      <div className="border border-zinc-200 dark:border-obsidian-800 rounded-xl bg-white dark:bg-obsidian-900 p-4 space-y-3">
        <h3 className="text-sm font-semibold">{editId ? 'Edit event' : 'Add an upcoming event'}</h3>
        <p className="text-[11px] text-zinc-500">Shown on the login page for everyone. It disappears by itself after its last day.</p>
        <label className={label}>Title *
          <input className={`${input} mt-1`} value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. District Fellowship" />
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <label className={label}>Date *
            <input type="date" className={`${input} mt-1`} value={form.date} onChange={(e) => set('date', e.target.value)} />
          </label>
          <label className={label}>End date (optional)
            <input type="date" className={`${input} mt-1`} value={form.endDate} min={form.date} onChange={(e) => set('endDate', e.target.value)} />
          </label>
          <label className={label}>Time (optional)
            <input type="time" className={`${input} mt-1`} value={form.time} onChange={(e) => set('time', e.target.value)} />
          </label>
        </div>
        <label className={label}>Location (optional)
          <input className={`${input} mt-1`} value={form.location} onChange={(e) => set('location', e.target.value)} />
        </label>
        <label className={label}>Details (optional)
          <textarea className={`${input} mt-1`} rows={3} value={form.details} onChange={(e) => set('details', e.target.value)} />
        </label>
        {error && <p className="text-xs text-rose-500">{error}</p>}
        <div className="flex gap-2">
          <button onClick={submit} disabled={busy} className="flex-1 py-2.5 rounded-xl bg-brand-800 hover:bg-brand-700 text-white text-xs font-semibold disabled:opacity-60">
            {editId ? 'Save changes' : 'Add event'}
          </button>
          {editId && (
            <button onClick={() => { setEditId(null); setForm(blank); setError(''); }} className="px-4 rounded-xl border border-zinc-300 dark:border-obsidian-700 text-xs">Cancel</button>
          )}
        </div>
      </div>

      <div className="border border-zinc-200 dark:border-obsidian-800 rounded-xl bg-white dark:bg-obsidian-900 divide-y divide-zinc-100 dark:divide-obsidian-800">
        <div className="px-4 py-2.5 text-xs font-semibold">Upcoming ({upcoming.length})</div>
        {upcoming.length === 0 && <div className="p-4 text-xs text-zinc-400">Nothing scheduled.</div>}
        {upcoming.map((e) => row(e, false))}
      </div>

      {past.length > 0 && (
        <details className="border border-zinc-200 dark:border-obsidian-800 rounded-xl bg-white dark:bg-obsidian-900">
          <summary className="px-4 py-2.5 text-xs font-semibold cursor-pointer">Past events, hidden from the login page ({past.length})</summary>
          <div className="divide-y divide-zinc-100 dark:divide-obsidian-800">{past.map((e) => row(e, true))}</div>
        </details>
      )}
    </section>
  );
}
