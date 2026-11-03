import React, { ReactNode } from 'react';

export interface GlassPanelProps {
  title?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  headerClassName?: string;
  bodyClassName?: string;
}

export function GlassPanel({
  title,
  meta,
  actions,
  children,
  className = '',
  headerClassName = '',
  bodyClassName = 'p-4 sm:p-5',
}: GlassPanelProps) {
  const hasHeader = title !== undefined || meta !== undefined || actions !== undefined;

  return (
    <div className={`glass-panel overflow-hidden ${className}`}>
      {hasHeader && (
        <div
          className={`px-4 sm:px-5 py-3 border-b border-divider flex items-center justify-between gap-3 ${headerClassName}`}
        >
          {title && (
            <div className="font-semibold text-sm sm:text-base text-app tracking-tight truncate">
              {title}
            </div>
          )}
          {(meta || actions) && (
            <div className="flex items-center gap-2 shrink-0 text-xs text-app-muted">
              {meta && <span>{meta}</span>}
              {actions}
            </div>
          )}
        </div>
      )}
      <div className={bodyClassName}>{children}</div>
    </div>
  );
}

export const GLASS_INPUT =
  'h-10 px-3.5 rounded-xl border border-[var(--glass-border)] bg-[var(--glass)] text-app text-sm placeholder:text-app-muted focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/60 focus:border-transparent transition-all';

export const GLASS_SELECT =
  'h-10 px-3.5 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-strong)] text-app text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/60 focus:border-transparent transition-all';

export const GLASS_BTN =
  'h-10 px-4 rounded-xl border border-[var(--glass-border)] bg-[var(--glass)] hover:bg-[var(--glass-strong)] active:scale-[0.98] text-app text-xs font-semibold tracking-wide transition-all inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shadow-sm';

export const GLASS_BTN_PRIMARY =
  'h-10 px-4 rounded-xl bg-gradient-to-r from-[var(--accent)] to-[var(--accent-light)] hover:opacity-95 active:scale-[0.98] text-white text-xs font-semibold tracking-wide transition-all inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shadow-[0_4px_14px_-2px_rgba(139,92,246,0.45)]';

