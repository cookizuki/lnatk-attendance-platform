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
      <div className="text-[11px] font-semibold text-app-muted">{title}</div>
      <p className="text-sm whitespace-pre-wrap text-app">{text}</p>
    </div>
  ) : null;

export default function OfficerReports({ locales, reports, month, monthLabel, onReview }: Props) {
  const [open, setOpen] = useState<number | null>(null);
  const monthReports = reports.filter((r) => r.month === month);
  const byLocale = new Map(monthReports.map((r) => [r.localeId, r]));

  return (
    <section className="space-y-4 select-text">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-app">Coordinator Reports — {monthLabel}</h3>
        <span className="text-xs font-mono px-2.5 py-1 rounded-md bg-surface-2 border border-app text-app">
          {monthReports.length} of {locales.length} submitted
        </span>
      </div>

      {(['Santa Rosa', 'Biñan', 'San Pedro'] as CityName[]).map((city) => (
        <div key={city} className="border border-app rounded-xl bg-surface overflow-hidden shadow-sm">
          <div className="px-4 py-2.5 bg-surface-2 border-b border-app-strong font-semibold text-sm text-app">{city}</div>
          <div className="divide-y divide-app">
            {locales.filter((l) => l.city === city).map((l, idx) => {
              const r = byLocale.get(l.id);
              const isOpen = open === l.id;
              return (
                <div key={l.id} className={idx % 2 === 1 ? 'bg-surface-2-subtle' : ''}>
                  <button disabled={!r} onClick={() => { setOpen(isOpen ? null : l.id); if (r && !r.reviewed) onReview(r); }}
                    className="w-full px-4 py-3 flex items-center justify-between text-left text-sm disabled:opacity-60 hover:bg-surface-2 transition-colors">
                    <span className="font-medium text-app">{l.name}</span>
                    <span className="flex items-center gap-2 text-[11px]">
                      {!r && <span className="text-app-muted">Not submitted</span>}
                      {r && !r.reviewed && <span className="px-2 py-0.5 rounded bg-brand-500/15 text-brand-700 dark:text-brand-300 font-semibold border border-brand-500/30">New</span>}
                      {r && r.reviewed && <span className="text-emerald-500">Reviewed</span>}
                    </span>
                  </button>
                  {r && isOpen && (
                    <div className="px-4 pb-4 pt-2 space-y-3 bg-surface-2/60 border-t border-app">
                      <div className="text-xs text-app-muted">{r.coordinatorName} · {r.position} · {r.submittedAt}</div>
                      <div>
                        <div className="text-[11px] font-semibold text-app-muted mb-1">TK's Concerns</div>
                        <ul className="space-y-1.5">
                          {r.tkConcerns.map((c, i) => (
                            <li key={i} className="text-sm text-app"><strong>{c.name}</strong> — {c.text}</li>
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
