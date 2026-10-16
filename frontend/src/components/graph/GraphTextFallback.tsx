import React, { useState } from 'react';
import { ListFilter, ChevronDown, ChevronUp } from 'lucide-react';
import type { D3GraphNode } from './types';
import Badge from '../ui/Badge';

/* ═══════════════════════════════════════════════════
   GraphTextFallback — Screen reader alternative & tabular list (Section 7C)
   Exposes graph topology as an accessible data table since SVG/canvas
   is not fully navigable via standard assistive technology.
   ═══════════════════════════════════════════════════ */

export interface GraphTextFallbackProps {
  nodes: D3GraphNode[];
  onSelectNode: (nodeId: string) => void;
}

export default function GraphTextFallback({ nodes, onSelectNode }: GraphTextFallbackProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (nodes.length === 0) return null;

  return (
    <div className="border border-[var(--border)] rounded-xl bg-[var(--bg)] overflow-hidden text-[12px]">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-controls="graph-accessible-table"
        className="
          w-full flex items-center justify-between p-3
          text-left font-medium text-[var(--text-secondary)]
          hover:bg-[var(--card-hover)] transition-colors cursor-pointer
        "
      >
        <div className="flex items-center gap-2">
          <ListFilter size={14} className="text-[var(--accent-start)]" aria-hidden="true" />
          <span>Accessible Node Directory ({nodes.length} nodes)</span>
        </div>
        {isOpen ? (
          <ChevronUp size={15} aria-hidden="true" />
        ) : (
          <ChevronDown size={15} aria-hidden="true" />
        )}
      </button>

      {isOpen && (
        <div id="graph-accessible-table" className="p-3 pt-0 overflow-x-auto">
          <table className="w-full text-left" aria-label="Graph nodes alternative representation">
            <thead>
              <tr className="border-b border-[var(--border)] text-[11px] uppercase tracking-wider text-[var(--text-muted)] font-semibold">
                <th scope="col" className="py-2 pr-2">
                  Rank
                </th>
                <th scope="col" className="py-2 pr-3">
                  Title
                </th>
                <th scope="col" className="py-2 pr-3 text-right">
                  PageRank
                </th>
                <th scope="col" className="py-2 pr-2 text-center">
                  In-Degree
                </th>
                <th scope="col" className="py-2 text-center">
                  Out-Degree
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {nodes.map((node) => (
                <tr
                  key={node.id}
                  onClick={() => onSelectNode(node.id)}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      onSelectNode(node.id);
                    }
                  }}
                  className="hover:bg-[var(--card)] cursor-pointer transition-colors"
                >
                  <td className="py-2 pr-2 font-mono font-bold text-[var(--text-muted)]">
                    #{node.rank}
                  </td>
                  <td className="py-2 pr-3 font-semibold text-[var(--text-primary)] truncate max-w-xs">
                    {node.title}
                  </td>
                  <td className="py-2 pr-3 text-right font-mono font-bold text-[var(--accent-start)]">
                    {node.pagerank.toFixed(5)}
                  </td>
                  <td className="py-2 pr-2 text-center">
                    <Badge variant="default" size="sm">
                      {node.inDegree}
                    </Badge>
                  </td>
                  <td className="py-2 text-center">
                    <Badge variant="default" size="sm">
                      {node.outDegree}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
