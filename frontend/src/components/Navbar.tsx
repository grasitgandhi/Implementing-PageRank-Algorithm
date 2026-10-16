import React from 'react';
import { Globe, Search, Network, History } from 'lucide-react';
import ThemeToggle from './ThemeToggle';
import { useAppStore } from '../store/useAppStore';
import type { TabId } from '../types';

/* ═══════════════════════════════════════════════════
   Navbar — Top navigation bar with accessible landmarks
   and tablist semantics (WCAG 2.1 AA)
   ═══════════════════════════════════════════════════ */

const navTabs: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'crawl', label: 'Crawl', icon: Globe },
  { id: 'search', label: 'Search', icon: Search },
  { id: 'graph', label: 'Graph', icon: Network },
  { id: 'history', label: 'History', icon: History },
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
          <div className="relative flex items-center justify-center w-9 h-9" aria-hidden="true">
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
            <span className="text-[12px] font-medium text-[var(--text-muted)] tracking-wide">
              Group 81 · SPIT TE Sem V Mini Project
            </span>
          </div>
        </div>

        {/* ── Center-right: Nav pill tabs with role="tablist" ── */}
        <nav
          role="tablist"
          aria-label="Main Navigation"
          className="hidden md:flex items-center gap-1.5 bg-[var(--card)] rounded-2xl p-1 border border-[var(--border)]"
        >
          {navTabs.map(({ id, label, icon: Icon }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                id={`nav-tab-${id}`}
                role="tab"
                aria-selected={isActive}
                aria-controls={`panel-${id}`}
                onClick={() => setTab(id)}
                className={`
                  flex items-center gap-2 px-3.5 py-1.5 rounded-xl
                  text-[13px] font-semibold
                  transition-all duration-200 ease-out
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-start)]
                  cursor-pointer
                  ${
                    isActive
                      ? 'bg-[var(--tab-active-bg)] text-[var(--tab-active-text)] shadow-sm'
                      : 'text-[var(--tab-inactive-text)] hover:bg-[var(--tab-hover-bg)] hover:text-[var(--text-secondary)]'
                  }
                `}
              >
                <Icon size={15} strokeWidth={2.2} aria-hidden="true" />
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
            role="img"
            aria-label="Project Team: Group 81 (Grasit Gandhi, Aaditya Doshi, Rudraksh Shah)"
            title="Group 81: Grasit Gandhi, Aaditya Doshi, Rudraksh Shah"
            className="
              flex items-center justify-center
              w-9 h-9 rounded-full
              bg-accent-gradient
              text-white text-[13px] font-bold
              select-none
              hover:shadow-glow transition-all duration-300
            "
          >
            81
          </div>
        </div>
      </div>
    </header>
  );
}
