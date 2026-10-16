import React from 'react';
import { Loader2 } from 'lucide-react';

/* ═══════════════════════════════════════════════════
   Button — Design system button primitive
   Variants: primary (gradient), secondary, ghost, danger
   ═══════════════════════════════════════════════════ */

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
}

export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  children,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  const sizeStyles = {
    sm: 'px-3 py-1.5 text-[12px] rounded-lg gap-1.5',
    md: 'px-4 py-2 text-[13px] rounded-xl gap-2',
    lg: 'px-5 py-2.5 text-[14px] rounded-xl gap-2.5',
  }[size];

  const variantStyles = {
    primary:
      'bg-accent-gradient text-white font-semibold shadow-glow hover:brightness-110 active:scale-[0.98]',
    secondary:
      'bg-[var(--card)] hover:bg-[var(--card-hover)] border border-[var(--border)] text-[var(--text-primary)] font-medium hover:border-[var(--border-hover)] shadow-card',
    ghost:
      'bg-transparent hover:bg-[var(--card-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
    danger:
      'bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/20 font-medium',
  }[variant];

  return (
    <button
      disabled={disabled || loading}
      aria-busy={loading}
      className={`
        inline-flex items-center justify-center
        font-medium transition-all duration-200
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-start)]
        disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none
        cursor-pointer shrink-0
        ${sizeStyles}
        ${variantStyles}
        ${className}
      `}
      {...props}
    >
      {loading ? (
        <>
          <Loader2 size={size === 'sm' ? 13 : 15} className="animate-spin" aria-hidden="true" />
          <span>{children}</span>
        </>
      ) : (
        <>
          {icon && <span className="shrink-0">{icon}</span>}
          {children}
        </>
      )}
    </button>
  );
}
