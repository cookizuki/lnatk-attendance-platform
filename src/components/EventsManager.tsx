import React, { useState } from 'react';
import { EventItem } from '../types/lnatk';
import { dateRange, formatTime, relativeLabel, todayManila } from '../lib/eventDates';
import { GlassPanel, GLASS_INPUT, GLASS_BTN, GLASS_BTN_PRIMARY } from './glass/GlassPanel';

interface Props {
  events: EventItem[];
  onSave: (ev: Omit<EventItem, 'id'> & { id?: string }) => Promise<boolean>;
  onDelete: (id: string) => void;
}

const labelClass = 'block text-xs font-semibold text-app-muted mb-1';
const textareaClass =
  'w-full p-3 rounded-xl border border-[var(--glass-border)] bg-[var(--glass)] text-app text-sm placeholder:text-app-muted focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/60 focus:border-transparent transition-all mt-1';
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
      id: editId ?? undefined,
      title: form.title.trim(),
      date: form.date,
      endDate: form.endDate || null,
      time: form.time || null,
      location: form.location.trim(),
      details: form.details.trim(),
    });
    setBusy(false);
    if (ok) {
      setForm(blank);
      setEditId(null);
    }
  };

  const edit = (e: EventItem) => {
    setEditId(e.id);
    setForm({
      title: e.title,
      date: e.date,
      endDate: e.endDate ?? '',
      time: e.time ?? '',
      location: e.location,
      details: e.details,
    });
    window.scrollTo?.({ top: 0, behavior: 'smooth' });
  };

  const row = (e: EventItem, isPast: boolean, idx: number) => (
    <div
      key={e.id}
      className={`px-4 sm:px-5 py-3 flex items-center justify-between gap-2 border-b border-divider ${
        idx % 2 === 1 ? 'bg-black/[0.025] dark:bg-white/[0.025]' : ''
      } hover:bg-white/[0.05] dark:hover:bg-white/[0.05] transition-colors`}
    >
      <div className="min-w-0">
        <div className="text-sm font-medium truncate text-app">{e.title}</div>
        <div className="text-xs font-mono text-app-muted truncate mt-0.5 tabular-nums">
          {[dateRange(e.date, e.endDate), formatTime(e.time), e.location].filter(Boolean).join(' · ')}
          {!isPast && ` · ${relativeLabel(e.date, e.endDate, today)}`}
        </div>
      </div>
      {confirm === e.id ? (
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => {
              onDelete(e.id);
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
        <div className="flex gap-2 shrink-0">
          <button onClick={() => edit(e)} className={GLASS_BTN}>
            Edit
          </button>
          <button
            onClick={() => setConfirm(e.id)}
            className="h-9 px-3 rounded-xl border border-[var(--glass-border)] bg-[var(--glass)] hover:bg-[var(--glass-strong)] text-xs text-rose-500 font-semibold transition-all"
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );

  return (
    <section className="max-w-2xl mx-auto space-y-5 select-text">
      <GlassPanel
        title={editId ? 'Edit Event' : 'Add Upcoming Event'}
        meta="Shown on login page"
        bodyClassName="p-4 sm:p-5 space-y-3.5"
      >
        <p className="text-xs text-app-muted">
          Shown on the login page for everyone. It disappears automatically after its last day.
        </p>
        <label className={labelClass}>
          Title *
          <input
            className={`${GLASS_INPUT} w-full mt-1`}
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder="e.g. District Fellowship"
          />
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className={labelClass}>
            Date *
            <input
              type="date"
              className={`${GLASS_INPUT} w-full mt-1`}
              value={form.date}
              onChange={(e) => set('date', e.target.value)}
            />
          </label>
          <label className={labelClass}>
            End date (optional)
            <input
              type="date"
              className={`${GLASS_INPUT} w-full mt-1`}
              value={form.endDate}
              min={form.date}
              onChange={(e) => set('endDate', e.target.value)}
            />
          </label>
          <label className={labelClass}>
            Time (optional)
            <input
              type="time"
              className={`${GLASS_INPUT} w-full mt-1`}
              value={form.time}
              onChange={(e) => set('time', e.target.value)}
            />
          </label>
        </div>
        <label className={labelClass}>
          Location (optional)
          <input
            className={`${GLASS_INPUT} w-full mt-1`}
            value={form.location}
            onChange={(e) => set('location', e.target.value)}
          />
        </label>
        <label className={labelClass}>
          Details (optional)
          <textarea
            className={textareaClass}
            rows={3}
            value={form.details}
            onChange={(e) => set('details', e.target.value)}
          />
        </label>
        {error && <p className="text-xs text-rose-500 font-medium">{error}</p>}
        <div className="flex gap-2 pt-1">
          <button onClick={submit} disabled={busy} className={`${GLASS_BTN_PRIMARY} flex-1`}>
            {editId ? 'Save Changes' : 'Add Event'}
          </button>
          {editId && (
            <button
              onClick={() => {
                setEditId(null);
                setForm(blank);
                setError('');
              }}
              className={GLASS_BTN}
            >
              Cancel
            </button>
          )}
        </div>
      </GlassPanel>

      <GlassPanel title={`Upcoming (${upcoming.length})`} bodyClassName="p-0">
        <div className="divide-y divide-divider">
          {upcoming.length === 0 && (
            <div className="p-4 text-xs font-mono text-app-muted">Nothing scheduled right now.</div>
          )}
          {upcoming.map((e, idx) => row(e, false, idx))}
        </div>
      </GlassPanel>

      {past.length > 0 && (
        <details className="glass-panel overflow-hidden">
          <summary className="px-4 sm:px-5 py-3 border-b border-divider text-xs font-semibold text-app cursor-pointer">
            Past events, hidden from login ({past.length})
          </summary>
          <div className="divide-y divide-divider">{past.map((e, idx) => row(e, true, idx))}</div>
        </details>
      )}
    </section>
  );
}
