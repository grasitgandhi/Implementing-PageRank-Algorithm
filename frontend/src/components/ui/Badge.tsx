import React from 'react';

/* ═══════════════════════════════════════════════════
   Badge — Status and metadata chip primitive
   ═══════════════════════════════════════════════════ */

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'accent' | 'amber' | 'rose' | 'emerald' | 'purple';
  size?: 'sm' | 'md';
}

export default function Badge({
  variant = 'default',
  size = 'sm',
  className = '',
  children,
  ...props
}: BadgeProps) {
  const variantStyles = {
    default: 'bg-[var(--bg)] text-[var(--text-secondary)] border border-[var(--border)]',
    accent:
      'bg-[var(--accent-glow)] text-[var(--accent-start)] border border-[var(--accent-start)]/20',
    amber: 'bg-amber-500/10 text-amber-500 border border-amber-500/20',
    rose: 'bg-rose-500/10 text-rose-500 border border-rose-500/20',
    emerald: 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20',
    purple: 'bg-purple-500/10 text-purple-400 border border-purple-500/20',
  }[variant];

  const sizeStyles = {
    sm: 'px-2 py-0.5 text-[11px] font-semibold rounded-md',
    md: 'px-2.5 py-1 text-[12px] font-semibold rounded-lg',
  }[size];

  return (
    <span
      className={`
        inline-flex items-center gap-1 leading-none font-mono tabular-nums shrink-0
        ${sizeStyles}
        ${variantStyles}
        ${className}
      `}
      {...props}
    >
      {children}
    </span>
  );
}
