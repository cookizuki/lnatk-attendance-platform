import React, { useMemo, useState } from 'react';
import { CityName, LocaleItem, MemberItem, TK_CATEGORY_LABELS, TkCategory } from '../types/lnatk';

interface Props {
  members: MemberItem[];
  locales: LocaleItem[];
  rollup: (memberId: string) => { weeksDuty: number };
  monthLabel: string;
}

type Status = 'active' | 'inactive' | 'hold';
const STATUS_META: Record<Status, { label: string; color: string }> = {
  active: { label: 'Active', color: '#10b981' },
  inactive: { label: 'Inactive', color: '#f43f5e' },
  hold: { label: 'On hold', color: '#f59e0b' },
};
const BUCKETS = [
  { key: 'd34', label: '3–4 weeks duty', color: '#059669' },
  { key: 'd12', label: '1–2 weeks duty', color: '#38bdf8' },
  { key: 'none', label: 'No duty', color: '#f43f5e' },
  { key: 'hold', label: 'On hold', color: '#a1a1aa' },
] as const;
type BucketKey = (typeof BUCKETS)[number]['key'];

const select =
  'px-3 py-2 rounded-lg border border-zinc-300 dark:border-obsidian-700 bg-white dark:bg-obsidian-900 text-base sm:text-xs';
const card = 'border border-zinc-200 dark:border-obsidian-800 rounded-xl bg-white dark:bg-obsidian-900 p-4';

function Donut({ counts, total }: { counts: Record<Status, number>; total: number }) {
  const R = 42;
  const C = 2 * Math.PI * R;
  let offset = 0;
  return (
    <svg viewBox="0 0 120 120" className="w-40 h-40 shrink-0" role="img"
      aria-label={`Active ${counts.active}, inactive ${counts.inactive}, on hold ${counts.hold}, of ${total} TKs`}>
      <circle cx="60" cy="60" r={R} fill="none" stroke="currentColor" strokeOpacity="0.1" strokeWidth="16" />
      {total > 0 &&
        (Object.keys(STATUS_META) as Status[]).map((k) => {
          const len = (counts[k] / total) * C;
          const el = (
            <circle key={k} cx="60" cy="60" r={R} fill="none" stroke={STATUS_META[k].color} strokeWidth="16"
              strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-offset} transform="rotate(-90 60 60)" />
          );
          offset += len;
          return el;
        })}
      <text x="60" y="58" textAnchor="middle" className="fill-current" fontSize="22" fontWeight="700">{total}</text>
      <text x="60" y="74" textAnchor="middle" className="fill-current" fontSize="9" opacity="0.6">TKs</text>
    </svg>
  );
}

function StackBar({ parts, max }: { parts: Array<{ label: string; color: string; n: number }>; max: number }) {
  const total = parts.reduce((a, p) => a + p.n, 0);
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-6 rounded-md bg-zinc-100 dark:bg-obsidian-800 overflow-hidden flex" style={{ maxWidth: '100%' }}>
        <div className="flex h-full" style={{ width: `${max ? (total / max) * 100 : 0}%` }}>
          {parts.map((p) =>
            p.n > 0 ? (
              <div key={p.label} title={`${p.label}: ${p.n}`} className="h-full flex items-center justify-center text-[10px] font-semibold text-white"
                style={{ width: `${(p.n / total) * 100}%`, background: p.color }}>
                {p.n}
              </div>
            ) : null
          )}
        </div>
      </div>
      <span className="w-8 text-right text-xs font-mono">{total}</span>
    </div>
  );
}

const Legend = ({ items }: { items: Array<{ label: string; color: string }> }) => (
  <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-zinc-500">
    {items.map((i) => (
      <span key={i.label} className="inline-flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-sm" style={{ background: i.color }} />{i.label}
      </span>
    ))}
  </div>
);

export default function TkOverview({ members, locales, rollup, monthLabel }: Props) {
  const [city, setCity] = useState<'all' | CityName>('all');
  const [localeId, setLocaleId] = useState<number | 'all'>('all');

  const rows = useMemo(() => {
    return members
      .filter((m) => !m.leftAt)
      .flatMap((m) => {
        const loc = locales.find((l) => l.id === m.localeId);
        if (!loc) return [];
        if (city !== 'all' && loc.city !== city) return [];
        if (localeId !== 'all' && loc.id !== localeId) return [];
        const duty = rollup(m.id).weeksDuty;
        const status: Status = m.onHold ? 'hold' : duty > 0 ? 'active' : 'inactive';
        const bucket: BucketKey = m.onHold ? 'hold' : duty >= 3 ? 'd34' : duty >= 1 ? 'd12' : 'none';
        return [{ city: loc.city, locale: loc.name, localeId: loc.id, category: (m.category ?? 'locale') as TkCategory, status, bucket }];
      });
  }, [members, locales, rollup, city, localeId]);

  const counts: Record<Status, number> = { active: 0, inactive: 0, hold: 0 };
  rows.forEach((r) => { counts[r.status]++; });
  const total = rows.length;

  const categories = Object.keys(TK_CATEGORY_LABELS) as TkCategory[];
  const catMax = Math.max(1, ...categories.map((c) => rows.filter((r) => r.category === c).length));

  // Chart 3 groups: locales (if a city/locale is chosen) or the three cities + overall.
  const groups: Array<{ name: string; rows: typeof rows }> = useMemo(() => {
    if (localeId !== 'all' || city !== 'all') {
      const ids = [...new Set(rows.map((r) => r.localeId))];
      return ids.map((id) => ({ name: locales.find((l) => l.id === id)?.name ?? '', rows: rows.filter((r) => r.localeId === id) }));
    }
    return [
      { name: 'All districts', rows },
      ...(['Santa Rosa', 'Biñan', 'San Pedro'] as CityName[]).map((c) => ({ name: c, rows: rows.filter((r) => r.city === c) })),
    ];
  }, [rows, locales, city, localeId]);
  const groupMax = Math.max(1, ...groups.map((g) => g.rows.length));

  const cityLocales = locales.filter((l) => city === 'all' || l.city === city);

  return (
    <section className="max-w-4xl mx-auto space-y-4 select-text">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">TK Overview — {monthLabel}</h3>
          <p className="text-[11px] text-zinc-500">Active = at least one duty in the month · Inactive = no duty · Hold is set by officers in Members.</p>
        </div>
        <div className="flex gap-2">
          <select className={select} aria-label="City" value={city} onChange={(e) => { setCity(e.target.value as 'all' | CityName); setLocaleId('all'); }}>
            <option value="all">All cities</option>
            {(['Santa Rosa', 'Biñan', 'San Pedro'] as CityName[]).map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select className={select} aria-label="Locale" value={localeId} onChange={(e) => setLocaleId(e.target.value === 'all' ? 'all' : Number(e.target.value))}>
            <option value="all">All locales</option>
            {cityLocales.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[{ label: 'Total TKs', n: total, color: 'currentColor' }, ...(Object.keys(STATUS_META) as Status[]).map((k) => ({ label: STATUS_META[k].label, n: counts[k], color: STATUS_META[k].color }))].map((t) => (
          <div key={t.label} className={card}>
            <div className="text-[11px] text-zinc-500">{t.label}</div>
            <div className="text-2xl font-bold" style={{ color: t.color }}>{t.n}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className={`${card} space-y-3`}>
          <h4 className="text-xs font-semibold">Active, inactive and on hold</h4>
          <div className="flex items-center gap-4">
            <Donut counts={counts} total={total} />
            <ul className="space-y-1.5 text-sm">
              {(Object.keys(STATUS_META) as Status[]).map((k) => (
                <li key={k} className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-sm" style={{ background: STATUS_META[k].color }} />
                  <span>{STATUS_META[k].label}</span>
                  <span className="font-mono font-semibold">{counts[k]}</span>
                  <span className="text-xs text-zinc-500">{total ? Math.round((counts[k] / total) * 100) : 0}%</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className={`${card} space-y-3`}>
          <h4 className="text-xs font-semibold">By category</h4>
          <div className="space-y-3">
            {categories.map((c) => {
              const cr = rows.filter((r) => r.category === c);
              return (
                <div key={c} className="space-y-1">
                  <div className="text-xs">{TK_CATEGORY_LABELS[c]}</div>
                  <StackBar max={catMax} parts={(Object.keys(STATUS_META) as Status[]).map((k) => ({ label: STATUS_META[k].label, color: STATUS_META[k].color, n: cr.filter((r) => r.status === k).length }))} />
                </div>
              );
            })}
          </div>
          <Legend items={(Object.keys(STATUS_META) as Status[]).map((k) => STATUS_META[k])} />
        </div>
      </div>

      <div className={`${card} space-y-3`}>
        <h4 className="text-xs font-semibold">Total of statuses{localeId === 'all' && city === 'all' ? ' by city' : localeId === 'all' ? ` in ${city}` : ''}</h4>
        <div className="space-y-3">
          {groups.map((g) => (
            <div key={g.name} className="space-y-1">
              <div className="text-xs">{g.name}</div>
              <StackBar max={groupMax} parts={BUCKETS.map((b) => ({ label: b.label, color: b.color, n: g.rows.filter((r) => r.bucket === b.key).length }))} />
            </div>
          ))}
          {groups.length === 0 && <p className="text-xs text-zinc-400">No TKs yet.</p>}
        </div>
        <Legend items={BUCKETS.map((b) => ({ label: b.label, color: b.color }))} />
      </div>
    </section>
  );
}
