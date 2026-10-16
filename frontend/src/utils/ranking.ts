/* ═══════════════════════════════════════════════════
   ranking.ts — Formula helpers for PageRank Explorer (B3)
   Computes the score fusion:
   final = alpha * relevance + (1 - alpha) * pagerank
   ═══════════════════════════════════════════════════ */

/** Calculate fused rank score given alpha weight, scaled relevance, and PageRank */
export function computeFinalScore(alpha: number, relevance: number, pagerank: number): number {
  const clampedAlpha = Math.max(0, Math.min(1, alpha));
  const score = clampedAlpha * relevance + (1 - clampedAlpha) * pagerank;
  return Number(score.toFixed(4));
}

/** Format a human-readable explanation of why a page received its rank score (B3) */
export interface RankBreakdown {
  alpha: number;
  oneMinusAlpha: number;
  relevance: number;
  pagerank: number;
  relevanceComponent: number;
  pagerankComponent: number;
  finalScore: number;
  formulaString: string;
}

export function explainRankScore(
  alpha: number,
  relevance: number,
  pagerank: number
): RankBreakdown {
  const a = Number(Math.max(0, Math.min(1, alpha)).toFixed(2));
  const oneMinusA = Number((1 - a).toFixed(2));
  const relComp = Number((a * relevance).toFixed(4));
  const prComp = Number((oneMinusA * pagerank).toFixed(4));
  const final = Number((relComp + prComp).toFixed(4));

  const formulaString = `${final.toFixed(4)} = (${a.toFixed(2)} × ${relevance.toFixed(4)}) + (${oneMinusA.toFixed(2)} × ${pagerank.toFixed(4)})`;

  return {
    alpha: a,
    oneMinusAlpha: oneMinusA,
    relevance,
    pagerank,
    relevanceComponent: relComp,
    pagerankComponent: prComp,
    finalScore: final,
    formulaString,
  };
}
