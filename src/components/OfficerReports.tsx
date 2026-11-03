import React, { useState } from 'react';
import { CityName, LocaleItem, MonthlyReport } from '../types/lnatk';
import { GlassPanel } from './glass/GlassPanel';

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
      <p className="text-sm whitespace-pre-wrap text-app leading-relaxed">{text}</p>
    </div>
  ) : null;

export default function OfficerReports({ locales, reports, month, monthLabel, onReview }: Props) {
  const [open, setOpen] = useState<number | null>(null);
  const monthReports = reports.filter((r) => r.month === month);
  const byLocale = new Map(monthReports.map((r) => [r.localeId, r]));

  return (
    <section className="space-y-4 select-text">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-app">Coordinator Reports — {monthLabel}</h3>
        <span className="text-xs font-mono px-3 py-1 rounded-xl bg-[var(--glass-strong)] border border-[var(--glass-border)] text-app-muted tabular-nums">
          {monthReports.length} of {locales.length} submitted
        </span>
      </div>

      {(['Santa Rosa', 'Biñan', 'San Pedro'] as CityName[]).map((city) => {
        const cityLocales = locales.filter((l) => l.city === city);
        const citySubmitted = cityLocales.filter((l) => byLocale.has(l.id)).length;

        return (
          <GlassPanel
            key={city}
            title={city}
            meta={`${citySubmitted} of ${cityLocales.length} submitted`}
            bodyClassName="p-0"
          >
            <div className="divide-y divide-divider">
              {cityLocales.map((l, idx) => {
                const r = byLocale.get(l.id);
                const isOpen = open === l.id;
                return (
                  <div key={l.id} className={idx % 2 === 1 ? 'bg-black/[0.025] dark:bg-white/[0.025]' : ''}>
                    <button
                      disabled={!r}
                      onClick={() => {
                        setOpen(isOpen ? null : l.id);
                        if (r && !r.reviewed) onReview(r);
                      }}
                      className="w-full px-4 sm:px-5 py-3 flex items-center justify-between text-left text-sm disabled:opacity-50 hover:bg-white/[0.05] dark:hover:bg-white/[0.05] transition-colors cursor-pointer"
                    >
                      <span className="font-medium text-app">{l.name}</span>
                      <span className="flex items-center gap-2 text-[11px]">
                        {!r && <span className="text-app-muted font-mono">Not submitted</span>}
                        {r && !r.reviewed && (
                          <span className="px-2.5 py-0.5 rounded-full bg-[var(--accent)]/15 text-[var(--accent)] font-semibold border border-[var(--accent)]/30">
                            New
                          </span>
                        )}
                        {r && r.reviewed && (
                          <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-semibold border border-emerald-500/30">
                            Reviewed
                          </span>
                        )}
                      </span>
                    </button>
                    {r && isOpen && (
                      <div className="px-4 sm:px-5 pb-4 pt-3 space-y-3 bg-white/[0.03] dark:bg-black/[0.1] border-t border-divider">
                        <div className="text-xs font-mono text-app-muted">
                          {r.coordinatorName} · {r.position} · {r.submittedAt}
                        </div>
                        <div>
                          <div className="text-[11px] font-mono uppercase font-semibold text-app-muted tracking-[0.06em] mb-1">
                            TK's Concerns
                          </div>
                          <ul className="space-y-1">
                            {r.tkConcerns.map((c, i) => (
                              <li key={i} className="text-sm text-app">
                                <strong>{c.name}</strong> — {c.text}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <Block title="General Problem Encountered / Concerns" text={r.general} />
                        <Block title="Actions Taken" text={r.actions} />
                        <Block title="Other concerns and suggestions for whole LNATK" text={r.other} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </GlassPanel>
        );
      })}
    </section>
  );
}
