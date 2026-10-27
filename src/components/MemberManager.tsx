import React, { useState } from 'react';
import { LocaleItem, MemberItem } from '../types/lnatk';

interface Props {
  locale: LocaleItem;
  members: MemberItem[]; // all members, including removed
  onAdd: (name: string) => void;
  onRename: (id: string, name: string) => void;
  onRemove: (id: string) => void;
  onRestore: (id: string) => void;
}

const input =
  'px-3 py-2 rounded-lg border border-zinc-300 dark:border-obsidian-700 bg-zinc-50 dark:bg-obsidian-950 text-base sm:text-sm';

export default function MemberManager({ locale, members, onAdd, onRename, onRemove, onRestore }: Props) {
  const [newName, setNewName] = useState('');
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const mine = members.filter((m) => m.localeId === locale.id);
  const active = mine.filter((m) => !m.leftAt);
  const removed = mine.filter((m) => m.leftAt);

  const commit = (m: MemberItem) => {
    const v = (edits[m.id] ?? m.fullName).trim();
    setEdits((p) => { const n = { ...p }; delete n[m.id]; return n; });
    if (v && v !== m.fullName) onRename(m.id, v);
  };

  return (
    <section className="max-w-2xl mx-auto space-y-4 select-text">
      <div className="border border-zinc-200 dark:border-obsidian-800 rounded-xl bg-white dark:bg-obsidian-900 p-4 space-y-3">
        <h3 className="text-sm font-semibold">Members of {locale.name} ({locale.city}) · {active.length}</h3>
        <p className="text-[11px] text-zinc-500">Pick another locale from the sidebar to manage its members. Removed members keep their past attendance.</p>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); onAdd(newName); setNewName(''); }}>
          <input className={`${input} flex-1 min-w-0`} placeholder="Add a member (full name)" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <button type="submit" className="px-4 rounded-lg bg-brand-800 hover:bg-brand-700 text-white text-xs font-semibold">Add</button>
        </form>
      </div>

      <div className="border border-zinc-200 dark:border-obsidian-800 rounded-xl bg-white dark:bg-obsidian-900 divide-y divide-zinc-100 dark:divide-obsidian-800">
        {active.length === 0 && <div className="p-4 text-xs text-zinc-400">No members yet.</div>}
        {active.map((m) => (
          <div key={m.id} className="p-2.5 flex items-center gap-2">
            <input className={`${input} flex-1 min-w-0`} value={edits[m.id] ?? m.fullName}
              onChange={(e) => setEdits((p) => ({ ...p, [m.id]: e.target.value }))}
              onBlur={() => commit(m)} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} />
            {confirmId === m.id ? (
              <>
                <button onClick={() => { onRemove(m.id); setConfirmId(null); }} className="px-3 py-2 rounded-lg bg-rose-600 text-white text-xs font-semibold">Remove</button>
                <button onClick={() => setConfirmId(null)} className="px-3 py-2 rounded-lg border border-zinc-300 dark:border-obsidian-700 text-xs">Cancel</button>
              </>
            ) : (
              <button onClick={() => setConfirmId(m.id)} className="px-3 py-2 rounded-lg border border-zinc-300 dark:border-obsidian-700 text-xs text-rose-500">Remove</button>
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
