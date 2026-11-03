import React, { useState } from 'react';
import { LocaleItem, MemberItem, TkCategory, TK_CATEGORY_LABELS } from '../types/lnatk';
import { Panel, LEDGER_INPUT, LEDGER_SELECT, LEDGER_BTN, LEDGER_BTN_PRIMARY } from './ledger/LedgerComponents';

interface Props {
  locale: LocaleItem;
  members: MemberItem[]; // all members, including removed
  onAdd: (name: string) => void;
  onRename: (id: string, name: string) => void;
  onRemove: (id: string) => void;
  onRestore: (id: string) => void;
  onUpdate: (ids: string[], patch: { category?: TkCategory; onHold?: boolean; holdReason?: string }) => void;
}

export default function MemberManager({ locale, members, onAdd, onRename, onRemove, onRestore, onUpdate }: Props) {
  const [newName, setNewName] = useState('');
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);

  const mine = members.filter((m) => m.localeId === locale.id);
  const active = mine.filter((m) => !m.leftAt);
  const removed = mine.filter((m) => m.leftAt);
  const toggle = (id: string) => setSelected((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const sel = selected.filter((id) => active.some((m) => m.id === id));

  const commit = (m: MemberItem) => {
    const v = (edits[m.id] ?? m.fullName).trim();
    setEdits((p) => {
      const n = { ...p };
      delete n[m.id];
      return n;
    });
    if (v && v !== m.fullName) onRename(m.id, v);
  };

  return (
    <section className="max-w-2xl mx-auto space-y-4 select-text">
      <Panel
        title={`MEMBERS OF ${locale.name.toUpperCase()} (${locale.city.toUpperCase()})`}
        meta={`${active.length} ACTIVE`}
        bodyClassName="p-3 sm:p-4 space-y-3"
      >
        <p className="text-[11px] font-mono text-app-muted">
          Pick another locale from the sidebar to manage its members. Category and Hold are only used in the officer TK
          Overview.
        </p>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (newName.trim()) {
              onAdd(newName.trim());
              setNewName('');
            }
          }}
        >
          <input
            className={`${LEDGER_INPUT} flex-1 min-w-0 font-sans text-sm`}
            placeholder="Add a member (full name)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <button type="submit" className={LEDGER_BTN_PRIMARY}>
            ADD
          </button>
        </form>
      </Panel>

      {sel.length > 0 && (
        <div className="sticky top-0 z-10 border border-brand-500/50 rounded-[2px] bg-surface-2 p-2 flex flex-wrap items-center gap-2">
          <span className="font-mono uppercase text-[11px] font-semibold text-app tabular-nums">
            {sel.length} SELECTED
          </span>
          <select
            className={LEDGER_SELECT}
            value=""
            onChange={(e) => e.target.value && onUpdate(sel, { category: e.target.value as TkCategory })}
          >
            <option value="">Set category…</option>
            {(Object.keys(TK_CATEGORY_LABELS) as TkCategory[]).map((c) => (
              <option key={c} value={c}>
                {TK_CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
          <button className={LEDGER_BTN} onClick={() => onUpdate(sel, { onHold: true })}>
            PUT ON HOLD
          </button>
          <button className={LEDGER_BTN} onClick={() => onUpdate(sel, { onHold: false, holdReason: '' })}>
            RELEASE HOLD
          </button>
          <button className={`${LEDGER_BTN} ml-auto`} onClick={() => setSelected([])}>
            CLEAR
          </button>
        </div>
      )}

      <Panel title={`ACTIVE MEMBERS (${active.length})`} bodyClassName="p-0">
        <div className="divide-y divide-app">
          {active.length === 0 && <div className="p-4 text-xs font-mono text-app-muted">No members yet.</div>}
          {active.map((m, idx) => (
            <div
              key={m.id}
              className={`p-2.5 space-y-2 transition-colors hover:bg-surface-2 ${
                idx % 2 === 1 ? 'bg-surface-2-subtle' : ''
              }`}
            >
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  aria-label={`Select ${m.fullName}`}
                  className="w-4 h-4 shrink-0 rounded-[2px] accent-brand-600"
                  checked={sel.includes(m.id)}
                  onChange={() => toggle(m.id)}
                />
                <input
                  className={`${LEDGER_INPUT} flex-1 min-w-0 font-sans text-sm`}
                  value={edits[m.id] ?? m.fullName}
                  onChange={(e) => setEdits((p) => ({ ...p, [m.id]: e.target.value }))}
                  onBlur={() => commit(m)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                />
              </div>
              <div className="flex flex-wrap items-center gap-2 pl-6">
                <select
                  className={LEDGER_SELECT}
                  value={m.category ?? 'locale'}
                  aria-label="Category"
                  onChange={(e) => onUpdate([m.id], { category: e.target.value as TkCategory })}
                >
                  {(Object.keys(TK_CATEGORY_LABELS) as TkCategory[]).map((c) => (
                    <option key={c} value={c}>
                      {TK_CATEGORY_LABELS[c]}
                    </option>
                  ))}
                </select>
                <button
                  aria-pressed={!!m.onHold}
                  onClick={() => onUpdate([m.id], m.onHold ? { onHold: false, holdReason: '' } : { onHold: true })}
                  className={`${LEDGER_BTN} ${
                    m.onHold ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/50' : ''
                  }`}
                >
                  {m.onHold ? 'ON HOLD · RELEASE' : 'PUT ON HOLD'}
                </button>
                {confirmId === m.id ? (
                  <>
                    <button
                      onClick={() => {
                        onRemove(m.id);
                        setConfirmId(null);
                      }}
                      className="h-9 sm:h-7 px-2.5 rounded-[2px] bg-rose-600 hover:bg-rose-500 text-white font-mono uppercase text-[11px] tracking-[0.06em] font-medium transition-colors"
                    >
                      REMOVE
                    </button>
                    <button onClick={() => setConfirmId(null)} className={LEDGER_BTN}>
                      CANCEL
                    </button>
                  </>
                ) : (
                  <button onClick={() => setConfirmId(m.id)} className={`${LEDGER_BTN} text-rose-500 ml-auto`}>
                    REMOVE
                  </button>
                )}
              </div>
              {m.onHold && (
                <input
                  className={`${LEDGER_INPUT} w-full ml-6 max-w-[calc(100%-1.5rem)]`}
                  placeholder="Reason for hold (optional)"
                  value={reasons[m.id] ?? m.holdReason ?? ''}
                  onChange={(e) => setReasons((p) => ({ ...p, [m.id]: e.target.value }))}
                  onBlur={() =>
                    reasons[m.id] !== undefined &&
                    reasons[m.id] !== (m.holdReason ?? '') &&
                    onUpdate([m.id], { holdReason: reasons[m.id] })
                  }
                />
              )}
            </div>
          ))}
        </div>
      </Panel>

      {removed.length > 0 && (
        <details className="border border-app rounded-[2px] bg-surface overflow-hidden">
          <summary className="h-8 px-3 bg-surface-2 border-b border-app-strong font-mono uppercase text-[11px] font-semibold tracking-[0.06em] text-app flex items-center cursor-pointer">
            REMOVED MEMBERS ({removed.length})
          </summary>
          <div className="divide-y divide-app">
            {removed.map((m) => (
              <div key={m.id} className="h-11 sm:h-9 px-3 flex items-center justify-between text-xs sm:text-sm text-app">
                <span className="text-app-muted">{m.fullName}</span>
                <button
                  onClick={() => onRestore(m.id)}
                  className="font-mono uppercase text-[11px] font-medium tracking-[0.06em] text-brand-500 hover:text-brand-400"
                >
                  RESTORE
                </button>
              </div>
            ))}
          </div>
        </details>
      )}
    </section>
  );
}
