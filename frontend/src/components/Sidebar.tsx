import React from 'react';
import {
  Globe,
  Search,
  Network,
  History,
  Sparkles,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import type { TabId } from '../types';

/* ═══════════════════════════════════════════════════
   Sidebar — Vertical icon+label navigation
   Collapsible via toggle button; also collapses
   automatically below 1024px (lg breakpoint).
   Accessible role="tablist" with aria-selected.
   ═══════════════════════════════════════════════════ */

const sidebarItems: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'crawl', label: 'Crawl', icon: Globe },
  { id: 'search', label: 'Search', icon: Search },
  { id: 'graph', label: 'Graph', icon: Network },
  { id: 'history', label: 'History', icon: History },
];

export default function Sidebar() {
  const activeTab = useAppStore((s) => s.activeTab);
  const setTab = useAppStore((s) => s.setTab);
  const collapsed = useAppStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);

  return (
    <aside
      id="sidebar"
      aria-label="Sidebar Navigation"
      className={`
        fixed top-16 left-0 bottom-0 z-40
        ${collapsed ? 'w-16' : 'w-16 lg:w-[220px]'}
        bg-[var(--sidebar-bg)]
        border-r border-[var(--border)]
        flex flex-col
        transition-all duration-300 ease-out
        overflow-hidden
      `}
    >
      {/* ── Navigation items with role="tablist" ── */}
      <nav
        role="tablist"
        aria-label="Sidebar Views"
        className="flex-1 flex flex-col gap-1 p-2 pt-4"
      >
        {sidebarItems.map(({ id, label, icon: Icon }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              id={`sidebar-${id}`}
              role="tab"
              aria-selected={isActive}
              aria-controls={`panel-${id}`}
              onClick={() => setTab(id)}
              className={`
                relative flex items-center gap-3
                w-full rounded-xl cursor-pointer
                px-3 py-2.5
                text-[13px] font-semibold
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-start)]
                transition-all duration-200 ease-out
                group
                ${
                  isActive
                    ? 'bg-[var(--sidebar-active)] text-[var(--tab-active-text)]'
                    : 'text-[var(--text-muted)] hover:bg-[var(--sidebar-hover)] hover:text-[var(--text-secondary)]'
                }
              `}
            >
              {/* Active indicator bar */}
              {isActive && (
                <span
                  className="
                    absolute left-0 top-1/2 -translate-y-1/2
                    w-[3px] h-5 rounded-r-full
                    bg-accent-gradient
                    animate-scale-in
                  "
                  aria-hidden="true"
                />
              )}

              <Icon
                size={18}
                strokeWidth={2.2}
                aria-hidden="true"
                className={`
                  flex-shrink-0 transition-transform duration-200
                  ${isActive ? 'scale-110' : 'group-hover:scale-105'}
                `}
              />

              {/* Label — hidden when collapsed */}
              {!collapsed && <span className="hidden lg:inline truncate">{label}</span>}
            </button>
          );
        })}
      </nav>

      {/* ── Promo / collapse area at bottom ── */}
      <div className="p-2 pb-4">
        {!collapsed && (
          <div
            id="sidebar-promo"
            className="
              rounded-2xl p-4 overflow-hidden
              border border-[var(--border)]
              transition-theme
              hidden lg:block
            "
            style={{ background: 'var(--promo-bg)' }}
          >
            {/* Gradient icon */}
            <div
              aria-hidden="true"
              className="
                flex items-center justify-center
                w-9 h-9 rounded-xl mb-2.5
                bg-accent-gradient
                shadow-glow
              "
            >
              <Sparkles size={18} className="text-white" />
            </div>

            <h3 className="text-[13px] font-bold text-[var(--text-primary)] mb-1">
              Group 81 Engine
            </h3>
            <p className="text-[12px] leading-relaxed text-[var(--text-muted)]">
              TF-IDF query relevance fused with PageRank link authority.
            </p>
          </div>
        )}

        {/* Collapsed or small-screen: gradient icon slot doubles as expand toggle */}
        <button
          id={collapsed ? 'sidebar-toggle' : 'sidebar-toggle-icon'}
          type="button"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={collapsed ? 'Expand sidebar navigation' : 'Collapse sidebar navigation'}
          aria-expanded={!collapsed}
          onClick={toggleSidebar}
          className={`
            items-center justify-center
            w-12 h-12 mx-auto rounded-xl
            bg-accent-gradient
            shadow-glow cursor-pointer
            transition-all duration-200 hover:brightness-110
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-start)]
            ${collapsed ? 'flex' : 'flex lg:hidden'}
          `}
        >
          {collapsed ? (
            <PanelLeftOpen size={18} className="text-white" strokeWidth={2.2} aria-hidden="true" />
          ) : (
            <Sparkles size={18} className="text-white" aria-hidden="true" />
          )}
        </button>

        {/* Wide expanded: subtle text collapse row, only visible on lg+ */}
        {!collapsed && (
          <button
            id="sidebar-toggle"
            type="button"
            onClick={toggleSidebar}
            aria-label="Collapse sidebar navigation"
            aria-expanded={true}
            className="
              hidden lg:flex items-center justify-center
              w-full mt-2 py-1.5 rounded-xl
              text-[var(--text-muted)] text-[11px] gap-1.5
              hover:bg-[var(--sidebar-hover)]
              hover:text-[var(--text-secondary)]
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-start)]
              transition-all duration-200 cursor-pointer
            "
            title="Collapse sidebar"
          >
            <PanelLeftClose size={13} strokeWidth={2.2} aria-hidden="true" />
            <span>Collapse</span>
          </button>
        )}
      </div>
    </aside>
  );
}
