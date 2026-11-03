import React, { ReactNode } from 'react';

interface PanelProps {
  title?: ReactNode;
  meta?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}

export function Panel({ title, meta, children, className = '', bodyClassName = 'p-3 sm:p-4' }: PanelProps) {
  return (
    <div className={`border border-app bg-surface rounded-[2px] overflow-hidden ${className}`}>
      {(title || meta) && (
        <div className="h-8 px-3 bg-surface-2 border-b border-app-strong flex items-center justify-between gap-2">
          <div className="font-mono uppercase text-[11px] font-semibold tracking-[0.06em] text-app truncate">
            {title}
          </div>
          {meta && (
            <div className="font-mono text-[11px] text-app-muted tracking-[0.06em] shrink-0 tabular-nums">
              {meta}
            </div>
          )}
        </div>
      )}
      <div className={bodyClassName}>{children}</div>
    </div>
  );
}

export interface StatItem {
  label: string;
  value: number | string;
  color?: string;
}

interface StatStripProps {
  items: StatItem[];
  className?: string;
}

export function StatStrip({ items, className = '' }: StatStripProps) {
  return (
    <div
      className={`border border-app bg-surface rounded-[2px] grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-app ${className}`}
    >
      {items.map((it, idx) => (
        <div key={idx} className="p-3 sm:px-4 sm:py-3 flex flex-col justify-between">
          <div className="font-mono uppercase text-[11px] tracking-[0.06em] text-app-muted font-medium truncate">
            {it.label}
          </div>
          <div
            className="text-2xl font-bold font-mono tabular-nums leading-none mt-2"
            style={{ color: it.color ?? 'inherit' }}
          >
            {it.value}
          </div>
        </div>
      ))}
    </div>
  );
}

export const LEDGER_INPUT =
  'h-9 sm:h-7 px-2.5 sm:px-2 rounded-[2px] border border-app-strong bg-transparent text-app font-mono text-[11px] tracking-[0.06em] focus:outline-none focus:border-brand-500 placeholder:text-app-muted transition-colors';

export const LEDGER_SELECT =
  'h-9 sm:h-7 px-2.5 sm:px-2 rounded-[2px] border border-app-strong bg-surface text-app font-mono text-[11px] tracking-[0.06em] focus:outline-none focus:border-brand-500 transition-colors';

export const LEDGER_BTN =
  'h-9 sm:h-7 px-2.5 sm:px-2 rounded-[2px] border border-app-strong bg-transparent hover:bg-surface-2 text-app font-mono uppercase text-[11px] tracking-[0.06em] font-medium transition-colors inline-flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer';

export const LEDGER_BTN_PRIMARY =
  'h-9 sm:h-7 px-3 sm:px-2.5 rounded-[2px] bg-brand-600 hover:bg-brand-500 text-white font-mono uppercase text-[11px] tracking-[0.06em] font-medium transition-colors inline-flex items-center justify-center gap-1.5 disabled:opacity-50 border border-transparent cursor-pointer';

