import { Sun, Moon } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

/* ═══════════════════════════════════════════════════
   ThemeToggle — Sun/Moon icon button
   Toggles 'dark' class on <html>, persists to localStorage
   ═══════════════════════════════════════════════════ */

export default function ThemeToggle() {
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);

  const toggle = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  return (
    <button
      id="theme-toggle"
      onClick={toggle}
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      className="
        relative flex items-center justify-center
        w-9 h-9 rounded-xl
        bg-[var(--card)] border border-[var(--border)]
        hover:border-[var(--border-hover)] hover:shadow-card-hover
        transition-all duration-300 ease-out
        group cursor-pointer
      "
    >
      {/* Sun icon — visible in dark mode */}
      <Sun
        size={16}
        className={`
          absolute transition-all duration-300 ease-out
          text-amber-400
          ${theme === 'dark' ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 rotate-90 scale-50'}
        `}
      />

      {/* Moon icon — visible in light mode */}
      <Moon
        size={16}
        className={`
          absolute transition-all duration-300 ease-out
          text-indigo-500
          ${theme === 'light' ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 -rotate-90 scale-50'}
        `}
      />

      {/* Hover glow ring */}
      <span
        className="
        absolute inset-0 rounded-xl opacity-0
        group-hover:opacity-100
        transition-opacity duration-300
        bg-gradient-to-br from-[var(--accent-start)] to-[var(--accent-end)]
        blur-sm -z-10
      "
        style={{ transform: 'scale(1.15)' }}
      />
    </button>
  );
}
