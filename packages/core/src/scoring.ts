import type { PillarKey, PillarScores, Tier } from './schema.ts';

export const PILLAR_WEIGHTS: Record<PillarKey, number> = {
  functionality: 0.25,
  usefulness: 0.25,
  anti_slop: 0.20,
  creativity: 0.15,
  marketability: 0.15,
};

export const PILLAR_META: Record<
  PillarKey,
  { label: string; shortLabel: string; weightPct: number; criteria: string }
> = {
  functionality: {
    label: 'Functionality & Craft',
    shortLabel: 'Functionality',
    weightPct: 25,
    criteria:
      'Architectural cleanliness, error boundaries, rate limiting, absence of runtime or console errors on live URL, responsive layout, load performance, and no exposed secrets.',
  },
  usefulness: {
    label: 'Usefulness',
    shortLabel: 'Usefulness',
    weightPct: 25,
    criteria:
      'Painkiller vs. vitamin. Clear Ideal Customer Profile, low time-to-value to first core output, and solving a recurring workflow bottleneck instead of a one-prompt novelty.',
  },
  anti_slop: {
    label: 'Anti-Slop Score',
    shortLabel: 'Anti-Slop',
    weightPct: 20,
    criteria:
      'Inverted scale where 100 equals zero slop. Penalizes unedited AI boilerplate, monolithic files over 800 LOC, leftover incomplete markers, thin API wrappers, generic templates, and cliché marketing copy.',
  },
  creativity: {
    label: 'Creativity & Moat',
    shortLabel: 'Creativity',
    weightPct: 15,
    criteria:
      'Original UX interaction patterns, opinionated workflow constraints, and proprietary data or logic pipelines compared to standard tutorial clones.',
  },
  marketability: {
    label: 'Marketability',
    shortLabel: 'Marketability',
    weightPct: 15,
    criteria:
      'Five-second value proposition clarity on the landing page, built-in distribution and sharing loops, artifact generation, and realistic monetization alignment.',
  },
};

export function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

/**
 * Deterministic 100-point weighted calculation.
 * Never delegate overall score arithmetic to an LLM.
 */
export function computeOverallScore(scores: PillarScores): number {
  const weighted =
    clampScore(scores.functionality) * PILLAR_WEIGHTS.functionality +
    clampScore(scores.usefulness) * PILLAR_WEIGHTS.usefulness +
    clampScore(scores.anti_slop) * PILLAR_WEIGHTS.anti_slop +
    clampScore(scores.creativity) * PILLAR_WEIGHTS.creativity +
    clampScore(scores.marketability) * PILLAR_WEIGHTS.marketability;

  return clampScore(weighted);
}

/**
 * Deterministic tier mapping from overallScore.
 */
export function computeTier(overallScore: number): Tier {
  const s = clampScore(overallScore);
  if (s >= 90) return 'Apex Craft';
  if (s >= 75) return 'Ship-Ready';
  if (s >= 50) return 'Weekend Hackathon';
  if (s >= 25) return 'Certified AI Slop';
  return 'Vaporware';
}

export function getTierColor(tier: Tier): {
  hex: string;
  textClass: string;
  bgClass: string;
  borderClass: string;
} {
  switch (tier) {
    case 'Apex Craft':
      return {
        hex: '#15803D',
        textClass: 'text-[#15803D]',
        bgClass: 'bg-[#F0FDF4]',
        borderClass: 'border-[#BBF7D0]',
      };
    case 'Ship-Ready':
      return {
        hex: '#16A34A',
        textClass: 'text-[#16A34A]',
        bgClass: 'bg-[#F0FDF4]',
        borderClass: 'border-[#BBF7D0]',
      };
    case 'Weekend Hackathon':
      return {
        hex: '#B45309',
        textClass: 'text-[#B45309]',
        bgClass: 'bg-[#FFFBEB]',
        borderClass: 'border-[#FDE68A]',
      };
    case 'Certified AI Slop':
      return {
        hex: '#DC2626',
        textClass: 'text-[#DC2626]',
        bgClass: 'bg-[#FEF2F2]',
        borderClass: 'border-[#FECACA]',
      };
    case 'Vaporware':
      return {
        hex: '#991B1B',
        textClass: 'text-[#991B1B]',
        bgClass: 'bg-[#FEF2F2]',
        borderClass: 'border-[#FECACA]',
      };
  }
}
