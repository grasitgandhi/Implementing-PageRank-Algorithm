import { Search, Medal, Network, Info } from 'lucide-react';
import ThemeToggle from './ThemeToggle';
import { useAppStore } from '../store/useAppStore';
import type { TabId } from '../types';

/* ═══════════════════════════════════════════════════
   Navbar — Top navigation bar
   ═══════════════════════════════════════════════════ */

const navTabs: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'search',    label: 'Search',    icon: Search },
  { id: 'top-pages', label: 'Top Pages', icon: Medal },
  { id: 'graph',     label: 'Graph',     icon: Network },
  { id: 'about',     label: 'About',     icon: Info },
];

export default function Navbar() {
  const activeTab = useAppStore((s) => s.activeTab);
  const setTab = useAppStore((s) => s.setTab);

  return (
    <header
      id="navbar"
      className="
        fixed top-0 left-0 right-0 z-50 h-16
        glass-surface
        border-b border-[var(--border)]
        transition-theme
      "
    >
      <div className="flex items-center justify-between h-full px-5">
        {/* ── Left: Logo + Title ── */}
        <div className="flex items-center gap-3">
          {/* Diamond / rotated-square logo */}
          <div className="relative flex items-center justify-center w-9 h-9">
            <div
              className="
                w-7 h-7 rounded-md rotate-45
                bg-accent-gradient
                shadow-glow
              "
            />
            <div
              className="
                absolute w-3 h-3 rounded-[3px] rotate-45
                bg-[var(--bg)]
              "
            />
          </div>

          <div className="flex flex-col leading-tight">
            <span className="text-[15px] font-bold tracking-tight text-[var(--text-primary)]">
              PageRank Explorer
            </span>
            <span className="text-[11px] font-medium text-[var(--text-muted)] tracking-wide">
              Search · Authority · Link Analysis
            </span>
          </div>
        </div>

        {/* ── Center-right: Nav pill tabs ── */}
        <nav className="hidden md:flex items-center gap-1.5 bg-[var(--card)] rounded-2xl p-1 border border-[var(--border)]">
          {navTabs.map(({ id, label, icon: Icon }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                id={`nav-tab-${id}`}
                onClick={() => setTab(id)}
                className={`
                  flex items-center gap-2 px-4 py-2 rounded-xl
                  text-[13px] font-semibold
                  transition-all duration-200 ease-out
                  cursor-pointer
                  ${isActive
                    ? 'bg-[var(--tab-active-bg)] text-[var(--tab-active-text)] shadow-sm'
                    : 'text-[var(--tab-inactive-text)] hover:bg-[var(--tab-hover-bg)] hover:text-[var(--text-secondary)]'
                  }
                `}
              >
                <Icon size={15} strokeWidth={2.2} />
                <span>{label}</span>
              </button>
            );
          })}
        </nav>

        {/* ── Right: Theme toggle + Avatar ── */}
        <div className="flex items-center gap-3">
          <ThemeToggle />

          {/* User avatar circle */}
          <div
            id="user-avatar"
            className="
              flex items-center justify-center
              w-9 h-9 rounded-full
              bg-accent-gradient
              text-white text-[13px] font-bold
              cursor-pointer
              hover:shadow-glow transition-shadow duration-300
            "
          >
            A
          </div>
        </div>
      </div>
    </header>
  );
}
