import React, { useState } from 'react';
import { EventItem } from '../types/lnatk';
import { dateRange, formatTime, relativeLabel, todayManila } from '../lib/eventDates';

interface Props {
  events: EventItem[];
  onSave: (ev: Omit<EventItem, 'id'> & { id?: string }) => Promise<boolean>;
  onDelete: (id: string) => void;
}

const input =
  'px-3 py-2 rounded-lg border border-app bg-surface-2 text-app placeholder:text-app-muted text-base sm:text-sm w-full';
const label = 'block text-[11px] font-semibold text-app-muted';
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

  const row = (e: EventItem, isPast: boolean, idx: number) => (
    <div key={e.id} className={`px-4 py-3 flex items-center justify-between gap-2 ${idx % 2 === 1 ? 'bg-surface-2-subtle' : ''} hover:bg-surface-2 transition-colors`}>
      <div className="min-w-0">
        <div className="text-sm font-medium truncate text-app">{e.title}</div>
        <div className="text-[11px] text-app-muted truncate">
          {[dateRange(e.date, e.endDate), formatTime(e.time), e.location].filter(Boolean).join(' · ')}
          {!isPast && ` · ${relativeLabel(e.date, e.endDate, today)}`}
        </div>
      </div>
      {confirm === e.id ? (
        <div className="flex gap-1.5 shrink-0">
          <button onClick={() => { onDelete(e.id); setConfirm(null); }} className="px-3 py-2 rounded-lg bg-rose-600 text-white text-xs font-semibold">Delete</button>
          <button onClick={() => setConfirm(null)} className="px-3 py-2 rounded-lg border border-app bg-surface-2 text-app text-xs hover:bg-surface">Cancel</button>
        </div>
      ) : (
        <div className="flex gap-1.5 shrink-0">
          <button onClick={() => edit(e)} className="px-3 py-2 rounded-lg border border-app bg-surface-2 text-app text-xs font-semibold hover:bg-surface">Edit</button>
          <button onClick={() => setConfirm(e.id)} className="px-3 py-2 rounded-lg border border-app bg-surface-2 text-xs text-rose-500 hover:bg-surface">Delete</button>
        </div>
      )}
    </div>
  );

  return (
    <section className="max-w-2xl mx-auto space-y-4 select-text">
      <div className="border border-app rounded-xl bg-surface p-4 space-y-3 shadow-sm">
        <h3 className="text-sm font-semibold text-app">{editId ? 'Edit event' : 'Add an upcoming event'}</h3>
        <p className="text-[11px] text-app-muted">Shown on the login page for everyone. It disappears by itself after its last day.</p>
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
            <button onClick={() => { setEditId(null); setForm(blank); setError(''); }} className="px-4 rounded-xl border border-app bg-surface-2 text-app hover:bg-surface text-xs">Cancel</button>
          )}
        </div>
      </div>

      <div className="border border-app rounded-xl bg-surface divide-y divide-app shadow-sm overflow-hidden">
        <div className="px-4 py-2.5 bg-surface-2 border-b border-app text-xs font-semibold text-app">Upcoming ({upcoming.length})</div>
        {upcoming.length === 0 && <div className="p-4 text-xs text-app-muted">Nothing scheduled.</div>}
        {upcoming.map((e, idx) => row(e, false, idx))}
      </div>

      {past.length > 0 && (
        <details className="border border-app rounded-xl bg-surface shadow-sm overflow-hidden">
          <summary className="px-4 py-2.5 bg-surface-2 border-b border-app text-xs font-semibold text-app cursor-pointer">Past events, hidden from the login page ({past.length})</summary>
          <div className="divide-y divide-app">{past.map((e, idx) => row(e, true, idx))}</div>
        </details>
      )}
    </section>
  );
}
