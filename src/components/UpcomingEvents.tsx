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
      <h2 id="upcoming-events-title" className="font-mono uppercase text-[11px] font-semibold tracking-[0.06em] text-app">
        Upcoming Events
      </h2>
      {list.length === 0 ? (
        <div className="rounded-[2px] border border-app bg-surface p-4 text-xs font-mono text-app-muted">
          No upcoming events right now. Check back soon.
        </div>
      ) : (
        <ul className="space-y-2">
          {list.map((e) => {
            const rel = relativeLabel(e.date, e.endDate, today);
            const live = rel === 'Today' || rel === 'Happening now';
            const meta = [dateRange(e.date, e.endDate), formatTime(e.time), e.location].filter(Boolean).join(' · ');
            return (
              <li
                key={e.id}
                className="flex gap-3 rounded-[2px] border border-app bg-surface p-3 hover:border-app-strong transition-colors"
              >
                <div className="shrink-0 w-12 text-center rounded-[2px] bg-surface-2 text-app py-1.5 border border-app font-mono">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.06em] text-app-muted leading-none">
                    {monthShort(e.date)}
                  </div>
                  <div className="text-lg font-bold leading-tight tabular-nums mt-0.5">{dayNum(e.date)}</div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold leading-snug text-app">{e.title}</h3>
                    <span
                      className={`shrink-0 text-[10px] font-mono uppercase tracking-[0.06em] px-1.5 py-0.5 rounded-[2px] font-medium ${
                        live
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                          : 'bg-surface-2 text-app-muted border border-app'
                      }`}
                    >
                      {rel}
                    </span>
                  </div>
                  <p className="text-[11px] font-mono text-app-muted mt-1 tabular-nums">{meta}</p>
                  {e.details && <p className="text-xs mt-1.5 whitespace-pre-wrap text-app-muted">{e.details}</p>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}
