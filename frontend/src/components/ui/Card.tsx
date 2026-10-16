import React from 'react';

/* ═══════════════════════════════════════════════════
   Card — Shared container with consistent header and elevation
   ═══════════════════════════════════════════════════ */

export interface CardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  headerAction?: React.ReactNode;
}

export default function Card({
  title,
  subtitle,
  icon,
  headerAction,
  children,
  className = '',
  ...props
}: CardProps) {
  const hasHeader = Boolean(title || subtitle || icon || headerAction);

  return (
    <div
      className={`
        rounded-2xl border border-[var(--border)]
        bg-[var(--card)] shadow-card transition-theme
        p-5 flex flex-col gap-4
        ${className}
      `}
      {...props}
    >
      {hasHeader && (
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] pb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            {icon && (
              <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-accent-gradient shadow-glow text-white shrink-0">
                {icon}
              </div>
            )}
            <div className="min-w-0">
              {title && (
                <h3 className="text-[14px] font-bold text-[var(--text-primary)] leading-snug truncate">
                  {title}
                </h3>
              )}
              {subtitle && (
                <p className="text-[12px] text-[var(--text-muted)] leading-tight truncate">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          {headerAction && <div className="shrink-0">{headerAction}</div>}
        </div>
      )}
      {children}
    </div>
  );
}
