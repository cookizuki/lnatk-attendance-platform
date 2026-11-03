import React from 'react';
import { EventItem } from '../types/lnatk';
import { dateRange, dayNum, formatTime, monthShort, relativeLabel, todayManila } from '../lib/eventDates';

export default function UpcomingEvents({ events }: { events: EventItem[] }) {
  const today = todayManila();
  const list = events
    .filter((e) => (e.endDate ?? e.date) >= today)
    .sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? '99').localeCompare(b.time ?? '99'));

  return (
    <aside aria-labelledby="upcoming-events-title" className="space-y-3">
      <h2 id="upcoming-events-title" className="text-sm font-semibold text-app">
        Upcoming Events
      </h2>
      {list.length === 0 ? (
        <div className="glass-panel p-4 text-xs font-mono text-app-muted">
          No upcoming events right now. Check back soon.
        </div>
      ) : (
        <ul className="space-y-2.5">
          {list.map((e) => {
            const rel = relativeLabel(e.date, e.endDate, today);
            const live = rel === 'Today' || rel === 'Happening now';
            const meta = [dateRange(e.date, e.endDate), formatTime(e.time), e.location].filter(Boolean).join(' · ');
            return (
              <li
                key={e.id}
                className="flex gap-3 rounded-2xl border border-[var(--glass-border)] bg-[var(--glass)] p-3.5 shadow-sm hover:border-[var(--glass-top)] transition-all"
              >
                <div className="shrink-0 w-12 text-center rounded-xl bg-[var(--accent)]/15 text-[var(--accent)] py-1.5 border border-[var(--accent)]/25">
                  <div className="text-[10px] font-mono font-semibold uppercase leading-none">{monthShort(e.date)}</div>
                  <div className="text-lg font-bold font-mono leading-tight tabular-nums mt-0.5">{dayNum(e.date)}</div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold leading-snug text-app">{e.title}</h3>
                    <span
                      className={`shrink-0 text-[10px] font-mono px-2 py-0.5 rounded-full font-medium ${
                        live
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                          : 'bg-[var(--glass-strong)] text-app-muted border border-divider'
                      }`}
                    >
                      {rel}
                    </span>
                  </div>
                  <p className="text-xs font-mono text-app-muted mt-1 tabular-nums">{meta}</p>
                  {e.details && <p className="text-xs mt-1.5 whitespace-pre-wrap text-app-muted leading-relaxed">{e.details}</p>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}
