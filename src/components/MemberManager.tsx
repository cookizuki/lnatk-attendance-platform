import React, { useState } from 'react';
import { LocaleItem, MemberItem, TkCategory, TK_CATEGORY_LABELS } from '../types/lnatk';

interface Props {
  locale: LocaleItem;
  members: MemberItem[]; // all members, including removed
  onAdd: (name: string) => void;
  onRename: (id: string, name: string) => void;
  onRemove: (id: string) => void;
  onRestore: (id: string) => void;
  onUpdate: (ids: string[], patch: { category?: TkCategory; onHold?: boolean; holdReason?: string }) => void;
}

const input =
  'px-3 py-2 rounded-lg border border-zinc-300 dark:border-obsidian-700 bg-zinc-50 dark:bg-obsidian-950 text-base sm:text-sm';
const btn = 'px-3 py-2 rounded-lg border border-zinc-300 dark:border-obsidian-700 text-xs font-semibold';

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
    setEdits((p) => { const n = { ...p }; delete n[m.id]; return n; });
    if (v && v !== m.fullName) onRename(m.id, v);
  };

  return (
    <section className="max-w-2xl mx-auto space-y-4 select-text">
      <div className="border border-zinc-200 dark:border-obsidian-800 rounded-xl bg-white dark:bg-obsidian-900 p-4 space-y-3">
        <h3 className="text-sm font-semibold">Members of {locale.name} ({locale.city}) · {active.length}</h3>
        <p className="text-[11px] text-zinc-500">
          Pick another locale from the sidebar to manage its members. Category and Hold are only used in the officer TK Overview; TKs and coordinators never see them.
        </p>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); onAdd(newName); setNewName(''); }}>
          <input className={`${input} flex-1 min-w-0`} placeholder="Add a member (full name)" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <button type="submit" className="px-4 rounded-lg bg-brand-800 hover:bg-brand-700 text-white text-xs font-semibold">Add</button>
        </form>
      </div>

      {sel.length > 0 && (
        <div className="sticky top-0 z-10 border border-brand-500/40 rounded-xl bg-white dark:bg-obsidian-900 p-3 flex flex-wrap items-center gap-2 shadow-sm">
          <span className="text-xs font-semibold">{sel.length} selected</span>
          <select className={`${input} !py-1.5 !text-xs`} value="" onChange={(e) => e.target.value && onUpdate(sel, { category: e.target.value as TkCategory })}>
            <option value="">Set category…</option>
            {(Object.keys(TK_CATEGORY_LABELS) as TkCategory[]).map((c) => <option key={c} value={c}>{TK_CATEGORY_LABELS[c]}</option>)}
          </select>
          <button className={btn} onClick={() => onUpdate(sel, { onHold: true })}>Put on hold</button>
          <button className={btn} onClick={() => onUpdate(sel, { onHold: false, holdReason: '' })}>Release hold</button>
          <button className={`${btn} ml-auto`} onClick={() => setSelected([])}>Clear</button>
        </div>
      )}

      <div className="border border-zinc-200 dark:border-obsidian-800 rounded-xl bg-white dark:bg-obsidian-900 divide-y divide-zinc-100 dark:divide-obsidian-800">
        {active.length === 0 && <div className="p-4 text-xs text-zinc-400">No members yet.</div>}
        {active.map((m) => (
          <div key={m.id} className="p-2.5 space-y-2">
            <div className="flex items-center gap-2">
              <input type="checkbox" aria-label={`Select ${m.fullName}`} className="w-5 h-5 shrink-0" checked={sel.includes(m.id)} onChange={() => toggle(m.id)} />
              <input className={`${input} flex-1 min-w-0`} value={edits[m.id] ?? m.fullName}
                onChange={(e) => setEdits((p) => ({ ...p, [m.id]: e.target.value }))}
                onBlur={() => commit(m)} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} />
            </div>
            <div className="flex flex-wrap items-center gap-2 pl-7">
              <select className={`${input} !py-1.5 !text-xs`} value={m.category ?? 'locale'} aria-label="Category"
                onChange={(e) => onUpdate([m.id], { category: e.target.value as TkCategory })}>
                {(Object.keys(TK_CATEGORY_LABELS) as TkCategory[]).map((c) => <option key={c} value={c}>{TK_CATEGORY_LABELS[c]}</option>)}
              </select>
              <button
                aria-pressed={!!m.onHold}
                onClick={() => onUpdate([m.id], m.onHold ? { onHold: false, holdReason: '' } : { onHold: true })}
                className={`${btn} ${m.onHold ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/50' : ''}`}
              >
                {m.onHold ? 'On hold · Release' : 'Put on hold'}
              </button>
              {confirmId === m.id ? (
                <>
                  <button onClick={() => { onRemove(m.id); setConfirmId(null); }} className="px-3 py-2 rounded-lg bg-rose-600 text-white text-xs font-semibold">Remove</button>
                  <button onClick={() => setConfirmId(null)} className={btn}>Cancel</button>
                </>
              ) : (
                <button onClick={() => setConfirmId(m.id)} className={`${btn} text-rose-500 ml-auto`}>Remove</button>
              )}
            </div>
            {m.onHold && (
              <input className={`${input} !py-1.5 !text-xs w-full ml-7 max-w-[calc(100%-1.75rem)]`} placeholder="Reason for hold (optional)"
                value={reasons[m.id] ?? m.holdReason ?? ''}
                onChange={(e) => setReasons((p) => ({ ...p, [m.id]: e.target.value }))}
                onBlur={() => reasons[m.id] !== undefined && reasons[m.id] !== (m.holdReason ?? '') && onUpdate([m.id], { holdReason: reasons[m.id] })} />
            )}
          </div>
        ))}
      </div>

      {removed.length > 0 && (
        <details className="border border-zinc-200 dark:border-obsidian-800 rounded-xl bg-white dark:bg-obsidian-900">
          <summary className="px-4 py-2.5 text-xs font-semibold cursor-pointer">Removed members ({removed.length})</summary>
          <div className="divide-y divide-zinc-100 dark:divide-obsidian-800">
            {removed.map((m) => (
              <div key={m.id} className="px-4 py-2 flex items-center justify-between text-sm">
                <span className="text-zinc-500">{m.fullName}</span>
                <button onClick={() => onRestore(m.id)} className="text-xs font-semibold text-brand-700 dark:text-brand-300">Restore</button>
              </div>
            ))}
          </div>
        </details>
      )}
    </section>
  );
}
