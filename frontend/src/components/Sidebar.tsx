import { Search, Medal, Network, Info, Sparkles } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import type { TabId } from '../types';

/* ═══════════════════════════════════════════════════
   Sidebar — Vertical icon+label navigation
   Collapses to icon-only below 1024px
   ═══════════════════════════════════════════════════ */

const sidebarItems: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'search',    label: 'Search',    icon: Search },
  { id: 'top-pages', label: 'Top Pages', icon: Medal },
  { id: 'graph',     label: 'Graph',     icon: Network },
  { id: 'about',     label: 'About',     icon: Info },
];

export default function Sidebar() {
  const activeTab = useAppStore((s) => s.activeTab);
  const setTab = useAppStore((s) => s.setTab);

  return (
    <aside
      id="sidebar"
      className="
        fixed top-16 left-0 bottom-0 z-40
        w-16 lg:w-[220px]
        bg-[var(--sidebar-bg)]
        border-r border-[var(--border)]
        flex flex-col
        transition-all duration-300 ease-out
        overflow-hidden
      "
    >
      {/* ── Navigation items ── */}
      <nav className="flex-1 flex flex-col gap-1 p-2 pt-4">
        {sidebarItems.map(({ id, label, icon: Icon }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              id={`sidebar-${id}`}
              onClick={() => setTab(id)}
              className={`
                relative flex items-center gap-3
                w-full rounded-xl cursor-pointer
                px-3 py-2.5
                text-[13px] font-semibold
                transition-all duration-200 ease-out
                group
                ${isActive
                  ? 'bg-[var(--sidebar-active)] text-[var(--tab-active-text)]'
                  : 'text-[var(--text-muted)] hover:bg-[var(--sidebar-hover)] hover:text-[var(--text-secondary)]'
                }
              `}
            >
              {/* Active indicator bar */}
              {isActive && (
                <span className="
                  absolute left-0 top-1/2 -translate-y-1/2
                  w-[3px] h-5 rounded-r-full
                  bg-accent-gradient
                  animate-scale-in
                " />
              )}

              <Icon
                size={18}
                strokeWidth={2.2}
                className={`
                  flex-shrink-0 transition-transform duration-200
                  ${isActive ? 'scale-110' : 'group-hover:scale-105'}
                `}
              />

              {/* Label — hidden on collapsed (< lg) */}
              <span className="hidden lg:inline truncate">
                {label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* ── Promo card at bottom ── */}
      <div className="p-2 pb-4">
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
          <div className="
            flex items-center justify-center
            w-10 h-10 rounded-xl mb-3
            bg-accent-gradient
            shadow-glow
          ">
            <Sparkles size={20} className="text-white" />
          </div>

          <h3 className="text-[13px] font-bold text-[var(--text-primary)] mb-1">
            PageRank Explorer
          </h3>
          <p className="text-[11px] leading-relaxed text-[var(--text-muted)]">
            Explore how PageRank and relevance work together to rank web pages.
          </p>
        </div>

        {/* Collapsed version: just the icon */}
        <div
          className="
            flex lg:hidden items-center justify-center
            w-12 h-12 mx-auto rounded-xl
            bg-accent-gradient
            shadow-glow
          "
        >
          <Sparkles size={18} className="text-white" />
        </div>
      </div>
    </aside>
  );
}
