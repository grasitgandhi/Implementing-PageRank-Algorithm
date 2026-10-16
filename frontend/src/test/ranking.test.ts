import { describe, it, expect } from 'vitest';
import { computeFinalScore, explainRankScore } from '../utils/ranking';

describe('ranking.ts — Why this rank? score arithmetic (B3)', () => {
  it('computes balanced fusion correctly when alpha is 0.5', () => {
    // alpha = 0.5, relevance = 0.8, pagerank = 0.6
    // final = 0.5 * 0.8 + 0.5 * 0.6 = 0.4 + 0.3 = 0.7
    const finalScore = computeFinalScore(0.5, 0.8, 0.6);
    expect(finalScore).toBe(0.7);
  });

  it('computes 100% PageRank authority when alpha is 0.0', () => {
    const finalScore = computeFinalScore(0.0, 0.9, 0.42);
    expect(finalScore).toBe(0.42);
  });

  it('computes 100% TF-IDF relevance when alpha is 1.0', () => {
    const finalScore = computeFinalScore(1.0, 0.95, 0.1);
    expect(finalScore).toBe(0.95);
  });

  it('generates accurate arithmetic decomposition and formula string', () => {
    const breakdown = explainRankScore(0.7, 0.85, 0.5);

    expect(breakdown.alpha).toBe(0.7);
    expect(breakdown.oneMinusAlpha).toBe(0.3);
    expect(breakdown.relevanceComponent).toBe(0.595); // 0.7 * 0.85
    expect(breakdown.pagerankComponent).toBe(0.15); // 0.3 * 0.5
    expect(breakdown.finalScore).toBe(0.745);
    expect(breakdown.formulaString).toContain('0.7450 = (0.70 × 0.8500) + (0.30 × 0.5000)');
  });
});
