# Design Direction: PageRank Explorer
- Identity: Deep violet & cyber slate themes with dual-spectrum identity (Light: purple/pink/blue; Dark: orange/red/pink).
- Typography: Self-hosted Inter font with strict 12px content minimum and tabular numerals for mathematical scores.
- Contrast & WCAG: All text tokens exceed 4.5:1 ratio (Light: text-muted #6b6584, Dark: text-muted #9e98b5).
- Shared Components: Tokenized UI primitives (Button, Card, Badge, Toast, ScoreBar, AsyncState) eliminating duplicate utility strings.
- Motion: Subtle micro-transitions with complete zero-delay suppression under `prefers-reduced-motion`.
- Layout: 4 desktop breakpoints (1024, 1280, 1440, 1920px) guaranteeing 100% panel reachability without horizontal scroll.
- Graph Clarity: Dynamic D3 force visualization with interactive node highlighting, hover cards, zoom/fit controls, and text fallback.
