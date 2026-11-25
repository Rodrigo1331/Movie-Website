import type { AspectRatings, RatingAspect } from '@moviesite/shared';

/** Aspects that can be rated separately, in display order. Keys must match the server's RATING_ASPECTS. */
export const ASPECTS: { key: RatingAspect; label: string }[] = [
  { key: 'story', label: 'Story / plot' },
  { key: 'characters', label: 'Characters' },
  { key: 'acting', label: 'Acting' },
  { key: 'soundtrack', label: 'Soundtrack' },
  { key: 'enjoyment', label: 'Enjoyment' },
];

/** Exact mean of the rated aspects; null when none are rated. */
export function aspectMean(ratings: AspectRatings): number | null {
  const scores = ASPECTS.map((a) => ratings[a.key]).filter((s): s is number => typeof s === 'number');
  if (scores.length === 0) return null;
  return scores.reduce((sum, s) => sum + s, 0) / scores.length;
}

/** Mean of the rated aspects, rounded to one decimal for display; null when none are rated. */
export function aspectAverage(ratings: AspectRatings): number | null {
  const mean = aspectMean(ratings);
  return mean === null ? null : Math.round(mean * 10) / 10;
}

/** Rounds up to the next half point: 9.0 → 9, 9.1 → 9.5, 9.6 → 10. */
export const roundUpToHalf = (score: number) => Math.min(10, Math.ceil(score * 2 - 1e-9) / 2);

/** Overall rating derived from the breakdown (aspect mean rounded up to the next 0.5); null when none are rated. */
export function overallFromAspects(ratings: AspectRatings): number | null {
  const mean = aspectMean(ratings);
  return mean === null ? null : roundUpToHalf(mean);
}

export const hasAspectRatings = (ratings: AspectRatings) => aspectAverage(ratings) !== null;
