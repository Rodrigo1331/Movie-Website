import type { ComparisonPoint } from '@moviesite/shared';

/** Signed difference with one decimal: "+1.3", "−0.4", "±0". */
export function formatGap(gap: number): string {
  const rounded = Math.round(gap * 10) / 10;
  if (rounded === 0) return '±0';
  return `${rounded > 0 ? '+' : '−'}${Math.abs(rounded).toFixed(1)}`;
}

/** Plain-language reading of a correlation coefficient. */
export function agreementLabel(r: number | null): string {
  if (r === null) return 'Rate a few more films to see';
  if (r >= 0.7) return 'Very similar taste';
  if (r >= 0.4) return 'Fairly similar taste';
  if (r >= 0.1) return 'Loosely similar taste';
  if (r > -0.1) return 'Independent taste';
  return 'Contrarian taste';
}

export interface GapItem extends ComparisonPoint {
  /** Score being compared against, 0–10 */
  other: number;
  /** Positive = the larger side of the comparison, always > 0 */
  gap: number;
}

/** Films you rate higher than IMDb, biggest difference first (only gaps of at least `min`). */
export function lovedMoreThanImdb(points: ComparisonPoint[], limit = 5, min = 0.5): GapItem[] {
  return points
    .filter((p) => p.imdb !== null && p.mine - p.imdb >= min)
    .map((p) => ({ ...p, other: p.imdb!, gap: p.mine - p.imdb! }))
    .sort((a, b) => b.gap - a.gap || a.title.localeCompare(b.title))
    .slice(0, limit);
}

/** Films critics (Metacritic, else Rotten Tomatoes) rate higher than you, biggest difference first. */
export function criticsLikedMore(points: ComparisonPoint[], limit = 5, min = 0.5): GapItem[] {
  return points
    .filter((p) => p.critics !== null && p.critics - p.mine >= min)
    .map((p) => ({ ...p, other: p.critics!, gap: p.critics! - p.mine }))
    .sort((a, b) => b.gap - a.gap || a.title.localeCompare(b.title))
    .slice(0, limit);
}

/** Axis range for the scatter: whole numbers around the data, at least 4 points wide, within 0–10. */
export function axisDomain(values: number[]): [number, number] {
  if (values.length === 0) return [0, 10];
  let lo = Math.floor(Math.min(...values));
  let hi = Math.ceil(Math.max(...values));
  while (hi - lo < 4) {
    if (lo > 0) lo--;
    if (hi - lo < 4 && hi < 10) hi++;
  }
  return [Math.max(0, lo), Math.min(10, hi)];
}

const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });
export const formatVotes = (n: number | null) => (n === null ? null : `${compact.format(n)} votes`);
