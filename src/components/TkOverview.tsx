import React, { useMemo, useState } from 'react';
import { CityName, LocaleItem, MemberItem, TK_CATEGORY_LABELS, TkCategory } from '../types/lnatk';
import { Panel, StatStrip, LEDGER_INPUT, LEDGER_SELECT } from './ledger/LedgerComponents';

interface Props {
  members: MemberItem[];
  locales: LocaleItem[];
  rollup: (memberId: string) => { weeksDuty: number };
  monthLabel: string;
  isDark?: boolean;
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

function StackBar({ parts, max }: { parts: Array<{ label: string; color: string; n: number }>; max: number }) {
  const total = parts.reduce((a, p) => a + p.n, 0);
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2.5 bg-surface-2 border border-app overflow-hidden flex">
        <div className="flex h-full" style={{ width: `${max ? (total / max) * 100 : 0}%` }}>
          {parts.map((p) =>
            p.n > 0 ? (
              <div
                key={p.label}
                title={`${p.label}: ${p.n}`}
                className="h-full"
                style={{ width: `${(p.n / total) * 100}%`, background: p.color }}
              />
            ) : null
          )}
        </div>
      </div>
      <span className="w-8 text-right font-mono text-xs tabular-nums text-app">{total}</span>
    </div>
  );
}

const Legend = ({ items }: { items: Array<{ label: string; color: string }> }) => (
  <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono uppercase text-[10px] tracking-[0.06em] text-app-muted pt-1">
    {items.map((i) => (
      <span key={i.label} className="inline-flex items-center gap-1.5">
        <span className="w-2 h-2 shrink-0" style={{ background: i.color }} />
        {i.label}
      </span>
    ))}
  </div>
);

/** Sort by city, then locale, then last word of fullName, then first name. */
const dirSort = (a: { city: string; locale: string; fullName: string }, b: { city: string; locale: string; fullName: string }) => {
  const cmp = (x: string, y: string) => x.localeCompare(y, 'en', { sensitivity: 'base' });
  const last = (n: string) => { const p = n.trim().split(/\s+/); return p[p.length - 1]; };
  const first = (n: string) => { const p = n.trim().split(/\s+/); return p.slice(0, -1).join(' '); };
  return cmp(a.city, b.city) || cmp(a.locale, b.locale) || cmp(last(a.fullName), last(b.fullName)) || cmp(first(a.fullName), first(b.fullName));
};

function DirectoryTable({ title, rows, emptyMsg }: { title: string; rows: Array<{ fullName: string; locale: string; city: string }>; emptyMsg: string }) {
  return (
    <Panel title={title} meta={`${rows.length} RECORD${rows.length === 1 ? '' : 'S'}`} bodyClassName="p-0">
      {rows.length === 0 ? (
        <div className="p-4 text-xs font-mono text-app-muted">{emptyMsg}</div>
      ) : (
        <div className="overflow-x-auto max-h-96">
          <table className="w-full text-left text-xs border-separate border-spacing-0">
            <thead>
              <tr className="sticky top-0 z-10 bg-surface-2 border-b border-app-strong font-mono uppercase text-[11px] tracking-[0.06em] text-app-muted">
                <th className="py-2 px-2.5 font-mono text-[10px] w-10 text-right">#</th>
                <th className="py-2 px-3 font-semibold whitespace-nowrap">Name</th>
                <th className="py-2 px-3 font-semibold whitespace-nowrap">Locale</th>
                <th className="py-2 px-3 font-semibold whitespace-nowrap">City</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr
                  key={`${r.fullName}-${r.locale}-${i}`}
                  className={`h-11 sm:h-9 border-b border-app hover:bg-surface-2 transition-colors ${
                    i % 2 === 1 ? 'bg-surface-2-subtle' : 'bg-surface'
                  }`}
                >
                  <td className="px-2.5 font-mono text-[11px] text-app-muted tabular-nums text-right">{i + 1}</td>
                  <td className="px-3 whitespace-nowrap font-medium text-app">{r.fullName}</td>
                  <td className="px-3 whitespace-nowrap text-app-muted">{r.locale}</td>
                  <td className="px-3 whitespace-nowrap font-mono text-[11px] text-app-muted uppercase tracking-[0.06em]">{r.city}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

export default function TkOverview({ members, locales, rollup, monthLabel }: Props) {
  const [city, setCity] = useState<'all' | CityName>('all');
  const [localeId, setLocaleId] = useState<number | 'all'>('all');
  const [dirSearch, setDirSearch] = useState('');

  // Directory tables: district TKs and trainees with locale / city info
  const directoryRows = useMemo(() => {
    const q = dirSearch.toLowerCase();
    return members
      .filter((m) => !m.leftAt)
      .flatMap((m) => {
        const loc = locales.find((l) => l.id === m.localeId);
        if (!loc) return [];
        const cat = m.category ?? 'locale';
        if (cat !== 'district' && cat !== 'trainee') return [];
        const row = { fullName: m.fullName, locale: loc.name, city: loc.city, category: cat };
        if (q && !row.fullName.toLowerCase().includes(q) && !row.locale.toLowerCase().includes(q) && !row.city.toLowerCase().includes(q)) return [];
        return [row];
      })
      .sort(dirSort);
  }, [members, locales, dirSearch]);

  const districtRows = useMemo(() => directoryRows.filter((r) => r.category === 'district'), [directoryRows]);
  const traineeRows = useMemo(() => directoryRows.filter((r) => r.category === 'trainee'), [directoryRows]);

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
      {/* 1. Title and Filters Row */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-mono uppercase font-bold text-xs sm:text-sm tracking-[0.06em] text-app">
            TK OVERVIEW — {monthLabel}
          </h2>
          <p className="font-mono text-[11px] text-app-muted tracking-[0.06em] mt-0.5">
            ACTIVE = ≥1 DUTY · INACTIVE = 0 DUTY · HOLD = OFFICER FLAGGED
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            className={LEDGER_SELECT}
            aria-label="City"
            value={city}
            onChange={(e) => {
              setCity(e.target.value as 'all' | CityName);
              setLocaleId('all');
            }}
          >
            <option value="all">ALL CITIES</option>
            {(['Santa Rosa', 'Biñan', 'San Pedro'] as CityName[]).map((c) => (
              <option key={c} value={c}>{c.toUpperCase()}</option>
            ))}
          </select>
          <select
            className={LEDGER_SELECT}
            aria-label="Locale"
            value={localeId}
            onChange={(e) => setLocaleId(e.target.value === 'all' ? 'all' : Number(e.target.value))}
          >
            <option value="all">ALL LOCALES</option>
            {cityLocales.map((l) => (
              <option key={l.id} value={l.id}>{l.name.toUpperCase()}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 2. StatStrip */}
      <StatStrip
        items={[
          { label: 'Total TKs', value: total },
          { label: 'Active', value: counts.active, color: STATUS_META.active.color },
          { label: 'Inactive', value: counts.inactive, color: STATUS_META.inactive.color },
          { label: 'On hold', value: counts.hold, color: STATUS_META.hold.color },
        ]}
      />

      {/* 3. Two-Column Row: Status Breakdown & By Category */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Status Breakdown Panel */}
        <Panel title="STATUS BREAKDOWN" meta={`${total} TOTAL`}>
          <div className="space-y-4">
            {/* Horizontal segmented bar, 12px high, square ends */}
            <div className="h-3 bg-surface-2 border border-app overflow-hidden flex">
              {total > 0 && (
                <>
                  <div
                    title={`Active: ${counts.active}`}
                    style={{
                      width: `${(counts.active / total) * 100}%`,
                      background: STATUS_META.active.color,
                    }}
                    className="h-full"
                  />
                  <div
                    title={`Inactive: ${counts.inactive}`}
                    style={{
                      width: `${(counts.inactive / total) * 100}%`,
                      background: STATUS_META.inactive.color,
                    }}
                    className="h-full"
                  />
                  <div
                    title={`On hold: ${counts.hold}`}
                    style={{
                      width: `${(counts.hold / total) * 100}%`,
                      background: STATUS_META.hold.color,
                    }}
                    className="h-full"
                  />
                </>
              )}
            </div>

            {/* Mono legend row with count and percent per status */}
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-app text-xs font-mono">
              {(Object.keys(STATUS_META) as Status[]).map((k) => (
                <div key={k} className="flex flex-col">
                  <div className="flex items-center gap-1.5 uppercase text-[10px] tracking-[0.06em] text-app-muted">
                    <span className="w-2 h-2 shrink-0" style={{ background: STATUS_META[k].color }} />
                    <span>{STATUS_META[k].label}</span>
                  </div>
                  <div className="text-base font-bold tabular-nums mt-1" style={{ color: STATUS_META[k].color }}>
                    {counts[k]}
                    <span className="text-[10px] font-normal text-app-muted ml-1">
                      ({total ? Math.round((counts[k] / total) * 100) : 0}%)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Panel>

        {/* By Category Panel */}
        <Panel title="BY CATEGORY" meta={`${categories.length} GROUPS`}>
          <div className="space-y-3">
            {categories.map((c) => {
              const cr = rows.filter((r) => r.category === c);
              return (
                <div key={c} className="space-y-1">
                  <div className="font-mono uppercase text-[11px] tracking-[0.06em] text-app-muted">
                    {TK_CATEGORY_LABELS[c]}
                  </div>
                  <StackBar
                    max={catMax}
                    parts={(Object.keys(STATUS_META) as Status[]).map((k) => ({
                      label: STATUS_META[k].label,
                      color: STATUS_META[k].color,
                      n: cr.filter((r) => r.status === k).length,
                    }))}
                  />
                </div>
              );
            })}
            <Legend items={(Object.keys(STATUS_META) as Status[]).map((k) => STATUS_META[k])} />
          </div>
        </Panel>
      </div>

      {/* 4. Statuses by City Panel */}
      <Panel
        title={`TOTAL OF STATUSES${localeId === 'all' && city === 'all' ? ' BY CITY' : localeId === 'all' ? ` IN ${city.toUpperCase()}` : ''}`}
        meta={`${groups.length} ENTRIES`}
      >
        <div className="space-y-3">
          {groups.map((g) => (
            <div key={g.name} className="space-y-1">
              <div className="font-mono uppercase text-[11px] tracking-[0.06em] text-app-muted">{g.name}</div>
              <StackBar
                max={groupMax}
                parts={BUCKETS.map((b) => ({
                  label: b.label,
                  color: b.color,
                  n: g.rows.filter((r) => r.bucket === b.key).length,
                }))}
              />
            </div>
          ))}
          {groups.length === 0 && <p className="text-xs font-mono text-app-muted">No TKs found for selection.</p>}
          <Legend items={BUCKETS.map((b) => ({ label: b.label, color: b.color }))} />
        </div>
      </Panel>

      {/* 5. Directory Section */}
      <div className="space-y-3 pt-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="font-mono uppercase font-bold text-xs tracking-[0.06em] text-app">DIRECTORY</div>
          <input
            type="text"
            placeholder="SEARCH BY NAME, LOCALE, OR CITY…"
            value={dirSearch}
            onChange={(e) => setDirSearch(e.target.value)}
            className={`${LEDGER_INPUT} w-full sm:w-64`}
          />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <DirectoryTable title="DISTRICT TK" rows={districtRows} emptyMsg="No district TKs found" />
          <DirectoryTable title="TRAINEES" rows={traineeRows} emptyMsg="No trainees found" />
        </div>
      </div>
    </section>
  );
}
