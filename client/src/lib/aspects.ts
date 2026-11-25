import type { AspectRatings, RatingAspect } from '@moviesite/shared';

/** Aspects that can be rated separately, in display order. Keys must match the server's RATING_ASPECTS. */
export const ASPECTS: { key: RatingAspect; label: string }[] = [
  { key: 'story', label: 'Story / plot' },
  { key: 'characters', label: 'Characters' },
  { key: 'acting', label: 'Acting' },
  { key: 'soundtrack', label: 'Soundtrack' },
  { key: 'enjoyment', label: 'Enjoyment' },
];

/** Mean of the rated aspects, rounded to one decimal; null when none are rated. */
export function aspectAverage(ratings: AspectRatings): number | null {
  const scores = ASPECTS.map((a) => ratings[a.key]).filter((s): s is number => typeof s === 'number');
  if (scores.length === 0) return null;
  return Math.round((scores.reduce((sum, s) => sum + s, 0) / scores.length) * 10) / 10;
}

export const hasAspectRatings = (ratings: AspectRatings) => aspectAverage(ratings) !== null;
