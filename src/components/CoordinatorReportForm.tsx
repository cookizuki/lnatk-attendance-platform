import React, { useState } from 'react';
import { LocaleItem, MemberItem, MonthlyReport } from '../types/lnatk';

type Draft = Omit<MonthlyReport, 'id' | 'submittedAt' | 'reviewed'>;

interface Props {
  locale: LocaleItem;
  members: MemberItem[];
  month: string;
  monthLabel: string;
  existing?: MonthlyReport;
  onSubmit: (r: Draft) => void | Promise<void>;
}

const input =
  'w-full px-3 py-2.5 rounded-xl border border-zinc-300 dark:border-obsidian-700 bg-zinc-50 dark:bg-obsidian-950 text-base sm:text-sm';
const label = 'block text-xs font-semibold mb-1';

export default function CoordinatorReportForm({ locale, members, month, monthLabel, existing, onSubmit }: Props) {
  const [position, setPosition] = useState(existing?.position ?? '');
  const [name, setName] = useState(existing?.coordinatorName ?? locale.coordinator);
  const [rows, setRows] = useState<{ memberId: string; text: string }[]>(
    existing?.tkConcerns.map((c) => ({ memberId: c.memberId, text: c.text })) ?? [{ memberId: '', text: '' }]
  );
  const [general, setGeneral] = useState(existing?.general ?? '');
  const [actions, setActions] = useState(existing?.actions ?? '');
  const [other, setOther] = useState(existing?.other ?? '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const roster = members.filter((m) => m.localeId === locale.id && !m.leftAt);
  const setRow = (i: number, patch: Partial<{ memberId: string; text: string }>) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const submit = async () => {
    const concerns = rows
      .filter((r) => r.memberId && r.text.trim())
      .map((r) => ({
        memberId: r.memberId,
        name: roster.find((m) => m.id === r.memberId)?.fullName ?? '',
        text: r.text.trim(),
      }));
    if (!position.trim() || !name.trim()) return setError('Please fill in your position and name.');
    if (concerns.length === 0) return setError("Add at least one TK and their concern (pick the TK, then write the situation).");
    if (!general.trim()) return setError('General Problem Encountered/Concerns is required.');
    if (!actions.trim()) return setError('Actions Taken is required.');
    setError('');
    setBusy(true);
    await onSubmit({
      localeId: locale.id, month, position: position.trim(), coordinatorName: name.trim(),
      tkConcerns: concerns, general: general.trim(), actions: actions.trim(), other: other.trim(),
    });
    setBusy(false);
  };

  return (
    <div className="max-w-2xl mx-auto border border-zinc-200 dark:border-obsidian-800 rounded-xl bg-white dark:bg-obsidian-900 p-4 sm:p-6 space-y-5 select-text">
      <div>
        <h2 className="text-base font-semibold">Monthly Locale Report — {monthLabel}</h2>
        <p className="text-xs text-zinc-500 mt-0.5">
          Reporting for <strong>{locale.name}</strong> ({locale.city}). Sent straight to the officers.
        </p>
        {existing && (
          <p className="text-[11px] mt-2 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            Already submitted {existing.submittedAt}. Submitting again will replace it.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={label}>Position *</label>
          <input className={input} value={position} onChange={(e) => setPosition(e.target.value)} placeholder="e.g. Locale Coordinator" />
        </div>
        <div>
          <label className={label}>Name *</label>
          <input className={input} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
      </div>

      <div>
        <label className={label}>TK's Concerns (per TK) *</label>
        <p className="text-[11px] text-zinc-500 mb-2">
          Alamin ang sitwasyon ng bawat TK. e.g. “B. Kim - nakakaduty naman po palagi at nakakaganap po ng tungkulin nang maayos”
        </p>
        <div className="space-y-2.5">
          {rows.map((r, i) => (
            <div key={i} className="rounded-xl border border-zinc-200 dark:border-obsidian-800 p-2.5 space-y-2">
              <div className="flex gap-2">
                <select className={input} value={r.memberId} onChange={(e) => setRow(i, { memberId: e.target.value })}>
                  <option value="">Select TK…</option>
                  {roster.map((m) => (
                    <option key={m.id} value={m.id}>{m.fullName}</option>
                  ))}
                </select>
                {rows.length > 1 && (
                  <button onClick={() => setRows((p) => p.filter((_, idx) => idx !== i))}
                    className="px-3 rounded-xl border border-zinc-300 dark:border-obsidian-700 text-xs">✕</button>
                )}
              </div>
              <textarea className={input} rows={2} value={r.text} onChange={(e) => setRow(i, { text: e.target.value })}
                placeholder="Situation of this TK…" />
            </div>
          ))}
        </div>
        <button onClick={() => setRows((p) => [...p, { memberId: '', text: '' }])}
          className="mt-2 text-xs font-semibold text-brand-700 dark:text-brand-300">+ Add another TK</button>
      </div>

      <div>
        <label className={label}>General Problem Encountered/Concerns (per locale) *</label>
        <textarea className={input} rows={3} value={general} onChange={(e) => setGeneral(e.target.value)} />
      </div>
      <div>
        <label className={label}>Actions Taken *</label>
        <textarea className={input} rows={3} value={actions} onChange={(e) => setActions(e.target.value)} />
      </div>
      <div>
        <label className={label}>Other concerns and suggestions for the whole LNATK</label>
        <textarea className={input} rows={3} value={other} onChange={(e) => setOther(e.target.value)} />
      </div>

      {error && <p className="text-xs text-rose-500">{error}</p>}
      <button onClick={submit} disabled={busy}
        className="w-full py-3 rounded-xl bg-brand-800 hover:bg-brand-700 text-white text-sm font-semibold disabled:opacity-60">
        {existing ? 'Update Report' : 'Submit Report'}
      </button>
    </div>
  );
}
