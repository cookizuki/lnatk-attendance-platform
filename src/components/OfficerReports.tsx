import React, { useState } from 'react';
import { CityName, LocaleItem, MonthlyReport } from '../types/lnatk';

interface Props {
  locales: LocaleItem[];
  reports: MonthlyReport[];
  month: string;
  monthLabel: string;
  onReview: (r: MonthlyReport) => void;
}

const Block = ({ title, text }: { title: string; text: string }) =>
  text ? (
    <div>
      <div className="text-[11px] font-semibold text-zinc-500">{title}</div>
      <p className="text-sm whitespace-pre-wrap">{text}</p>
    </div>
  ) : null;

export default function OfficerReports({ locales, reports, month, monthLabel, onReview }: Props) {
  const [open, setOpen] = useState<number | null>(null);
  const monthReports = reports.filter((r) => r.month === month);
  const byLocale = new Map(monthReports.map((r) => [r.localeId, r]));

  return (
    <section className="space-y-4 select-text">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Coordinator Reports — {monthLabel}</h3>
        <span className="text-xs font-mono px-2.5 py-1 rounded-md bg-zinc-100 dark:bg-obsidian-900 border border-zinc-200 dark:border-obsidian-800">
          {monthReports.length} of {locales.length} submitted
        </span>
      </div>

      {(['Santa Rosa', 'Biñan', 'San Pedro'] as CityName[]).map((city) => (
        <div key={city} className="border border-zinc-200 dark:border-obsidian-800 rounded-xl bg-white dark:bg-obsidian-900 overflow-hidden">
          <div className="px-4 py-2.5 bg-zinc-50 dark:bg-obsidian-950 border-b border-zinc-200 dark:border-obsidian-800 font-semibold text-sm">{city}</div>
          <div className="divide-y divide-zinc-100 dark:divide-obsidian-800">
            {locales.filter((l) => l.city === city).map((l) => {
              const r = byLocale.get(l.id);
              const isOpen = open === l.id;
              return (
                <div key={l.id}>
                  <button disabled={!r} onClick={() => { setOpen(isOpen ? null : l.id); if (r && !r.reviewed) onReview(r); }}
                    className="w-full px-4 py-3 flex items-center justify-between text-left text-sm disabled:opacity-60">
                    <span className="font-medium">{l.name}</span>
                    <span className="flex items-center gap-2 text-[11px]">
                      {!r && <span className="text-zinc-400">Not submitted</span>}
                      {r && !r.reviewed && <span className="px-2 py-0.5 rounded bg-brand-500/15 text-brand-700 dark:text-brand-300 font-semibold">New</span>}
                      {r && r.reviewed && <span className="text-emerald-500">Reviewed</span>}
                    </span>
                  </button>
                  {r && isOpen && (
                    <div className="px-4 pb-4 space-y-3">
                      <div className="text-xs text-zinc-500">{r.coordinatorName} · {r.position} · {r.submittedAt}</div>
                      <div>
                        <div className="text-[11px] font-semibold text-zinc-500 mb-1">TK's Concerns</div>
                        <ul className="space-y-1.5">
                          {r.tkConcerns.map((c, i) => (
                            <li key={i} className="text-sm"><strong>{c.name}</strong> — {c.text}</li>
                          ))}
                        </ul>
                      </div>
                      <Block title="General Problem Encountered/Concerns" text={r.general} />
                      <Block title="Actions Taken" text={r.actions} />
                      <Block title="Other concerns and suggestions for the whole LNATK" text={r.other} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </section>
  );
}
