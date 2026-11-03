import React, { useState } from 'react';
import { EventItem } from '../types/lnatk';
import { dateRange, formatTime, relativeLabel, todayManila } from '../lib/eventDates';
import { Panel, LEDGER_INPUT, LEDGER_BTN, LEDGER_BTN_PRIMARY } from './ledger/LedgerComponents';

interface Props {
  events: EventItem[];
  onSave: (ev: Omit<EventItem, 'id'> & { id?: string }) => Promise<boolean>;
  onDelete: (id: string) => void;
}

const labelClass = 'block font-mono uppercase text-[11px] font-semibold text-app-muted tracking-[0.06em]';
const textareaClass =
  'p-2 rounded-[2px] border border-app-strong bg-transparent text-app font-mono text-[11px] tracking-[0.06em] focus:outline-none focus:border-brand-500 placeholder:text-app-muted transition-colors w-full mt-1';
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
      className={`px-3 py-2 flex items-center justify-between gap-2 ${
        idx % 2 === 1 ? 'bg-surface-2-subtle' : ''
      } hover:bg-surface-2 transition-colors`}
    >
      <div className="min-w-0">
        <div className="text-xs sm:text-sm font-medium truncate text-app">{e.title}</div>
        <div className="text-[11px] font-mono text-app-muted truncate mt-0.5">
          {[dateRange(e.date, e.endDate), formatTime(e.time), e.location].filter(Boolean).join(' · ')}
          {!isPast && ` · ${relativeLabel(e.date, e.endDate, today)}`}
        </div>
      </div>
      {confirm === e.id ? (
        <div className="flex gap-1.5 shrink-0">
          <button
            onClick={() => {
              onDelete(e.id);
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
        <div className="flex gap-1.5 shrink-0">
          <button onClick={() => edit(e)} className={LEDGER_BTN}>
            EDIT
          </button>
          <button
            onClick={() => setConfirm(e.id)}
            className="h-9 sm:h-7 px-2.5 rounded-[2px] border border-app-strong bg-transparent hover:bg-surface-2 text-rose-500 font-mono uppercase text-[11px] tracking-[0.06em] font-medium transition-colors"
          >
            DELETE
          </button>
        </div>
      )}
    </div>
  );

  return (
    <section className="max-w-2xl mx-auto space-y-4 select-text">
      <Panel
        title={editId ? 'EDIT EVENT' : 'ADD UPCOMING EVENT'}
        meta="SHOWN ON LOGIN PAGE"
        bodyClassName="p-3 sm:p-4 space-y-3"
      >
        <p className="text-[11px] font-mono text-app-muted">
          Auto-disappears after its last day.
        </p>
        <label className={labelClass}>
          Title *
          <input
            className={`${LEDGER_INPUT} w-full mt-1`}
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder="e.g. District Fellowship"
          />
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <label className={labelClass}>
            Date *
            <input
              type="date"
              className={`${LEDGER_INPUT} w-full mt-1`}
              value={form.date}
              onChange={(e) => set('date', e.target.value)}
            />
          </label>
          <label className={labelClass}>
            End date (optional)
            <input
              type="date"
              className={`${LEDGER_INPUT} w-full mt-1`}
              value={form.endDate}
              min={form.date}
              onChange={(e) => set('endDate', e.target.value)}
            />
          </label>
          <label className={labelClass}>
            Time (optional)
            <input
              type="time"
              className={`${LEDGER_INPUT} w-full mt-1`}
              value={form.time}
              onChange={(e) => set('time', e.target.value)}
            />
          </label>
        </div>
        <label className={labelClass}>
          Location (optional)
          <input
            className={`${LEDGER_INPUT} w-full mt-1`}
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
        {error && <p className="text-[11px] font-mono text-rose-500">{error}</p>}
        <div className="flex gap-2 pt-1">
          <button onClick={submit} disabled={busy} className={`${LEDGER_BTN_PRIMARY} flex-1`}>
            {editId ? 'SAVE CHANGES' : 'ADD EVENT'}
          </button>
          {editId && (
            <button
              onClick={() => {
                setEditId(null);
                setForm(blank);
                setError('');
              }}
              className={LEDGER_BTN}
            >
              CANCEL
            </button>
          )}
        </div>
      </Panel>

      <Panel title={`UPCOMING (${upcoming.length})`} bodyClassName="p-0">
        <div className="divide-y divide-app">
          {upcoming.length === 0 && (
            <div className="p-4 text-xs font-mono text-app-muted">Nothing scheduled.</div>
          )}
          {upcoming.map((e, idx) => row(e, false, idx))}
        </div>
      </Panel>

      {past.length > 0 && (
        <details className="border border-app rounded-[2px] bg-surface overflow-hidden">
          <summary className="h-8 px-3 bg-surface-2 border-b border-app-strong font-mono uppercase text-[11px] font-semibold tracking-[0.06em] text-app flex items-center cursor-pointer">
            PAST EVENTS, HIDDEN FROM LOGIN ({past.length})
          </summary>
          <div className="divide-y divide-app">{past.map((e, idx) => row(e, true, idx))}</div>
        </details>
      )}
    </section>
  );
}
