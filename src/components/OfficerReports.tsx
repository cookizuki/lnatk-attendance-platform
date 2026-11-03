import React, { useState } from 'react';
import { CityName, LocaleItem, MonthlyReport } from '../types/lnatk';
import { Panel } from './ledger/LedgerComponents';

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
      <div className="text-[11px] font-mono uppercase font-semibold text-app-muted tracking-[0.06em] mb-1">{title}</div>
      <p className="text-xs sm:text-sm whitespace-pre-wrap text-app leading-relaxed">{text}</p>
    </div>
  ) : null;

export default function OfficerReports({ locales, reports, month, monthLabel, onReview }: Props) {
  const [open, setOpen] = useState<number | null>(null);
  const monthReports = reports.filter((r) => r.month === month);
  const byLocale = new Map(monthReports.map((r) => [r.localeId, r]));

  return (
    <section className="space-y-4 select-text">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-mono uppercase text-[11px] font-semibold tracking-[0.06em] text-app">
          COORDINATOR REPORTS — {monthLabel.toUpperCase()}
        </h3>
        <span className="text-[11px] font-mono px-2 py-0.5 rounded-[2px] bg-surface-2 border border-app text-app-muted tabular-nums">
          {monthReports.length} OF {locales.length} SUBMITTED
        </span>
      </div>

      {(['Santa Rosa', 'Biñan', 'San Pedro'] as CityName[]).map((city) => {
        const cityLocales = locales.filter((l) => l.city === city);
        const citySubmitted = cityLocales.filter((l) => byLocale.has(l.id)).length;

        return (
          <Panel
            key={city}
            title={city.toUpperCase()}
            meta={`${citySubmitted} OF ${cityLocales.length} SUBMITTED`}
            bodyClassName="p-0"
          >
            <div className="divide-y divide-app">
              {cityLocales.map((l, idx) => {
                const r = byLocale.get(l.id);
                const isOpen = open === l.id;
                return (
                  <div key={l.id} className={idx % 2 === 1 ? 'bg-surface-2-subtle' : ''}>
                    <button
                      disabled={!r}
                      onClick={() => {
                        setOpen(isOpen ? null : l.id);
                        if (r && !r.reviewed) onReview(r);
                      }}
                      className="w-full h-11 sm:h-9 px-3 flex items-center justify-between text-left disabled:opacity-60 hover:bg-surface-2 transition-colors cursor-pointer"
                    >
                      <span className="text-xs sm:text-sm font-medium text-app truncate">{l.name}</span>
                      <span className="flex items-center gap-2 shrink-0">
                        {!r && (
                          <span className="text-[10px] font-mono uppercase tracking-[0.06em] text-app-muted">
                            Not submitted
                          </span>
                        )}
                        {r && !r.reviewed && (
                          <span className="px-1.5 py-0.5 rounded-[2px] bg-brand-500/15 text-brand-700 dark:text-brand-300 font-mono uppercase text-[10px] tracking-[0.06em] font-medium border border-brand-500/30">
                            New
                          </span>
                        )}
                        {r && r.reviewed && (
                          <span className="px-1.5 py-0.5 rounded-[2px] bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-mono uppercase text-[10px] tracking-[0.06em] font-medium border border-emerald-500/30">
                            Reviewed
                          </span>
                        )}
                      </span>
                    </button>
                    {r && isOpen && (
                      <div className="p-3 sm:p-4 space-y-3 bg-surface-2 border-t border-app-strong">
                        <div className="text-[11px] font-mono text-app-muted tracking-[0.06em]">
                          {r.coordinatorName} · {r.position} · {r.submittedAt}
                        </div>
                        <div>
                          <div className="text-[11px] font-mono uppercase font-semibold text-app-muted tracking-[0.06em] mb-1">
                            TK's Concerns
                          </div>
                          <ul className="space-y-1">
                            {r.tkConcerns.map((c, i) => (
                              <li key={i} className="text-xs sm:text-sm text-app">
                                <strong>{c.name}</strong> — {c.text}
                              </li>
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
          </Panel>
        );
      })}
    </section>
  );
}
