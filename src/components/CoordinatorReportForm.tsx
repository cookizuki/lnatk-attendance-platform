import React, { useState } from 'react';
import { LocaleItem, MemberItem, MonthlyReport } from '../types/lnatk';
import { Panel, LEDGER_INPUT, LEDGER_SELECT, LEDGER_BTN, LEDGER_BTN_PRIMARY } from './ledger/LedgerComponents';

type Draft = Omit<MonthlyReport, 'id' | 'submittedAt' | 'reviewed'>;

interface Props {
  locale: LocaleItem;
  members: MemberItem[];
  month: string;
  monthLabel: string;
  existing?: MonthlyReport;
  onSubmit: (r: Draft) => void | Promise<void>;
}

const labelClass = 'block font-mono uppercase text-[11px] font-semibold mb-1 text-app-muted tracking-[0.06em]';
const textareaClass =
  'w-full p-2.5 rounded-[2px] border border-app-strong bg-transparent text-app text-xs sm:text-sm placeholder:text-app-muted focus:outline-none focus:border-brand-500 transition-colors';

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
      <Panel
        title={`MONTHLY LOCALE REPORT — ${monthLabel.toUpperCase()}`}
        meta={`${locale.name.toUpperCase()} (${locale.city.toUpperCase()})`}
        bodyClassName="p-3 sm:p-5 space-y-4"
      >
        <p className="text-[11px] font-mono text-app-muted">
          Reporting for <strong>{locale.name}</strong> ({locale.city}). Sent directly to district officers.
        </p>
        {existing && (
          <div className="p-2 rounded-[2px] bg-emerald-500/10 border border-emerald-500/30 text-[11px] font-mono text-emerald-600 dark:text-emerald-400">
            ALREADY SUBMITTED {existing.submittedAt.toUpperCase()}. SUBMITTING AGAIN WILL REPLACE IT.
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Position *</label>
            <input
              className={`${LEDGER_INPUT} w-full`}
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              placeholder="e.g. Locale Coordinator"
            />
          </div>
          <div>
            <label className={labelClass}>Name *</label>
            <input className={`${LEDGER_INPUT} w-full`} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
        </div>

        <div>
          <label className={labelClass}>TK's Concerns (per TK) *</label>
          <p className="text-[11px] font-mono text-app-muted mb-2">
            Alamin ang sitwasyon ng bawat TK. e.g. "B. Kim - nakakaduty naman po palagi..."
          </p>
          <div className="space-y-2">
            {rows.map((r, i) => (
              <div key={i} className="rounded-[2px] border border-app bg-surface-2 p-2.5 space-y-2">
                <div className="flex gap-2">
                  <select
                    className={`${LEDGER_SELECT} flex-1`}
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
                    <button onClick={() => setRows((p) => p.filter((_, idx) => idx !== i))} className={LEDGER_BTN}>
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
          <button onClick={() => setRows((p) => [...p, { memberId: '', text: '' }])} className={`${LEDGER_BTN} mt-2`}>
            + ADD ANOTHER TK
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

        {error && <p className="text-[11px] font-mono text-rose-500">{error}</p>}
        <button onClick={submit} disabled={busy} className={`${LEDGER_BTN_PRIMARY} w-full`}>
          {existing ? 'UPDATE REPORT' : 'SUBMIT REPORT'}
        </button>
      </Panel>
    </div>
  );
}
