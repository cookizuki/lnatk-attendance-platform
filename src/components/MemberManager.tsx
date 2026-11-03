import React, { useState } from 'react';
import { LocaleItem, MemberItem, TkCategory, TK_CATEGORY_LABELS } from '../types/lnatk';
import { GlassPanel, GLASS_INPUT, GLASS_SELECT, GLASS_BTN, GLASS_BTN_PRIMARY } from './glass/GlassPanel';

interface Props {
  locale: LocaleItem;
  members: MemberItem[]; // all members, including removed
  onAdd: (name: string) => void;
  onRename: (id: string, name: string) => void;
  onRemove: (id: string) => void;
  onRestore: (id: string) => void;
  onUpdate: (ids: string[], patch: { category?: TkCategory; onHold?: boolean; holdReason?: string }) => void;
}

export default function MemberManager({
  locale,
  members,
  onAdd,
  onRename,
  onRemove,
  onRestore,
  onUpdate,
}: Props) {
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
    <section className="max-w-2xl mx-auto space-y-5 select-text">
      <GlassPanel
        title={`Members of ${locale.name} (${locale.city})`}
        meta={`${active.length} active`}
        bodyClassName="p-4 sm:p-5 space-y-3.5"
      >
        <p className="text-xs text-app-muted">
          Pick another locale from the sidebar to manage its members. Category and Hold are only used in the officer TK
          Overview; TKs and coordinators never see them.
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
            className={`${GLASS_INPUT} flex-1 min-w-0`}
            placeholder="Add a member (full name)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <button type="submit" className={GLASS_BTN_PRIMARY}>
            Add Member
          </button>
        </form>
      </GlassPanel>

      {sel.length > 0 && (
        <div className="sticky top-2 z-10 glass-panel p-3 flex flex-wrap items-center gap-2.5 shadow-md">
          <span className="text-xs font-semibold text-app">{sel.length} selected</span>
          <select
            className={`${GLASS_SELECT} !h-8 !py-1 !text-xs`}
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
          <button className={`${GLASS_BTN} !h-8 !text-xs`} onClick={() => onUpdate(sel, { onHold: true })}>
            Put on hold
          </button>
          <button
            className={`${GLASS_BTN} !h-8 !text-xs`}
            onClick={() => onUpdate(sel, { onHold: false, holdReason: '' })}
          >
            Release hold
          </button>
          <button className={`${GLASS_BTN} !h-8 !text-xs ml-auto`} onClick={() => setSelected([])}>
            Clear
          </button>
        </div>
      )}

      <GlassPanel title={`Active Members (${active.length})`} bodyClassName="p-0">
        <div className="divide-y divide-divider">
          {active.length === 0 && (
            <div className="p-4 text-xs font-mono text-app-muted">No active members yet.</div>
          )}
          {active.map((m, idx) => (
            <div
              key={m.id}
              className={`p-3 space-y-2.5 transition-colors hover:bg-white/[0.05] dark:hover:bg-white/[0.05] ${
                idx % 2 === 1 ? 'bg-black/[0.025] dark:bg-white/[0.025]' : ''
              }`}
            >
              <div className="flex items-center gap-2.5">
                <input
                  type="checkbox"
                  aria-label={`Select ${m.fullName}`}
                  className="w-4 h-4 shrink-0 rounded accent-[var(--accent)]"
                  checked={sel.includes(m.id)}
                  onChange={() => toggle(m.id)}
                />
                <input
                  className={`${GLASS_INPUT} flex-1 min-w-0 !h-9 text-xs sm:text-sm font-medium`}
                  value={edits[m.id] ?? m.fullName}
                  onChange={(e) => setEdits((p) => ({ ...p, [m.id]: e.target.value }))}
                  onBlur={() => commit(m)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                />
              </div>
              <div className="flex flex-wrap items-center gap-2 pl-6">
                <select
                  className={`${GLASS_SELECT} !h-8 !py-1 !text-xs`}
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
                  className={`${GLASS_BTN} !h-8 !text-xs ${
                    m.onHold
                      ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40'
                      : ''
                  }`}
                >
                  {m.onHold ? 'On hold · Release' : 'Put on hold'}
                </button>
                {confirmId === m.id ? (
                  <>
                    <button
                      onClick={() => {
                        onRemove(m.id);
                        setConfirmId(null);
                      }}
                      className="h-8 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-sm transition-all"
                    >
                      Remove
                    </button>
                    <button onClick={() => setConfirmId(null)} className={`${GLASS_BTN} !h-8 !text-xs`}>
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setConfirmId(m.id)}
                    className={`${GLASS_BTN} !h-8 !text-xs text-rose-500 ml-auto`}
                  >
                    Remove
                  </button>
                )}
              </div>
              {m.onHold && (
                <input
                  className={`${GLASS_INPUT} !h-8 !text-xs w-full ml-6 max-w-[calc(100%-1.5rem)]`}
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
      </GlassPanel>

      {removed.length > 0 && (
        <details className="glass-panel overflow-hidden">
          <summary className="px-4 sm:px-5 py-3 border-b border-divider text-xs font-semibold text-app cursor-pointer">
            Removed members ({removed.length})
          </summary>
          <div className="divide-y divide-divider">
            {removed.map((m) => (
              <div key={m.id} className="px-4 sm:px-5 py-2.5 flex items-center justify-between text-sm text-app">
                <span className="text-app-muted">{m.fullName}</span>
                <button
                  onClick={() => onRestore(m.id)}
                  className="text-xs font-semibold text-[var(--accent)] hover:opacity-80 transition-opacity"
                >
                  Restore
                </button>
              </div>
            ))}
          </div>
        </details>
      )}
    </section>
  );
}
