import React, { useState } from 'react';
import { LocaleItem, MemberItem, MonthlyReport } from '../types/lnatk';
import { GlassPanel, GLASS_INPUT, GLASS_SELECT, GLASS_BTN, GLASS_BTN_PRIMARY } from './glass/GlassPanel';

type Draft = Omit<MonthlyReport, 'id' | 'submittedAt' | 'reviewed'>;

interface Props {
  locale: LocaleItem;
  members: MemberItem[];
  month: string;
  monthLabel: string;
  existing?: MonthlyReport;
  onSubmit: (r: Draft) => void | Promise<void>;
}

const labelClass = 'block text-xs font-semibold mb-1 text-app';
const textareaClass =
  'w-full p-3 rounded-xl border border-[var(--glass-border)] bg-[var(--glass)] text-app text-sm placeholder:text-app-muted focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/60 focus:border-transparent transition-all';

export default function CoordinatorReportForm({
  locale,
  members,
  month,
  monthLabel,
  existing,
  onSubmit,
}: Props) {
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
    if (concerns.length === 0)
      return setError('Add at least one TK and their concern (pick the TK, then write the situation).');
    if (!general.trim()) return setError('General Problem Encountered/Concerns is required.');
    if (!actions.trim()) return setError('Actions Taken is required.');
    setError('');
    setBusy(true);
    await onSubmit({
      localeId: locale.id,
      month,
      position: position.trim(),
      coordinatorName: name.trim(),
      tkConcerns: concerns,
      general: general.trim(),
      actions: actions.trim(),
      other: other.trim(),
    });
    setBusy(false);
  };

  return (
    <div className="max-w-2xl mx-auto select-text">
      <GlassPanel
        title={`Monthly Locale Report — ${monthLabel}`}
        meta={`${locale.name} (${locale.city})`}
        bodyClassName="p-4 sm:p-6 space-y-5"
      >
        <p className="text-xs text-app-muted">
          Reporting for <strong>{locale.name}</strong> ({locale.city}). Sent directly to district officers.
        </p>
        {existing && (
          <div className="text-xs p-3 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
            Already submitted {existing.submittedAt}. Submitting again will replace it.
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Position *</label>
            <input
              className={`${GLASS_INPUT} w-full`}
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              placeholder="e.g. Locale Coordinator"
            />
          </div>
          <div>
            <label className={labelClass}>Name *</label>
            <input className={`${GLASS_INPUT} w-full`} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
        </div>

        <div>
          <label className={labelClass}>TK's Concerns (per TK) *</label>
          <p className="text-xs text-app-muted mb-2">
            Alamin ang sitwasyon ng bawat TK. e.g. "B. Kim - nakakaduty naman po palagi at nakakaganap po..."
          </p>
          <div className="space-y-2.5">
            {rows.map((r, i) => (
              <div key={i} className="rounded-2xl border border-divider bg-[var(--surface-2-subtle)] p-3 space-y-2">
                <div className="flex gap-2">
                  <select
                    className={`${GLASS_SELECT} flex-1`}
                    value={r.memberId}
                    onChange={(e) => setRow(i, { memberId: e.target.value })}
                  >
                    <option value="">Select TK…</option>
                    {roster.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.fullName}
                      </option>
                    ))}
                  </select>
                  {rows.length > 1 && (
                    <button onClick={() => setRows((p) => p.filter((_, idx) => idx !== i))} className={GLASS_BTN}>
                      ✕
                    </button>
                  )}
                </div>
                <textarea
                  className={textareaClass}
                  rows={2}
                  value={r.text}
                  onChange={(e) => setRow(i, { text: e.target.value })}
                  placeholder="Situation of this TK…"
                />
              </div>
            ))}
          </div>
          <button onClick={() => setRows((p) => [...p, { memberId: '', text: '' }])} className={`${GLASS_BTN} mt-2`}>
            + Add Another TK
          </button>
        </div>

        <div>
          <label className={labelClass}>General Problem Encountered / Concerns (per locale) *</label>
          <textarea className={textareaClass} rows={3} value={general} onChange={(e) => setGeneral(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>Actions Taken *</label>
          <textarea className={textareaClass} rows={3} value={actions} onChange={(e) => setActions(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>Other concerns and suggestions for whole LNATK</label>
          <textarea className={textareaClass} rows={3} value={other} onChange={(e) => setOther(e.target.value)} />
        </div>

        {error && <p className="text-xs text-rose-500 font-medium">{error}</p>}
        <button onClick={submit} disabled={busy} className={`${GLASS_BTN_PRIMARY} w-full py-3`}>
          {existing ? 'Update Report' : 'Submit Report'}
        </button>
      </GlassPanel>
    </div>
  );
}
