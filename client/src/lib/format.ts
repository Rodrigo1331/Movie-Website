export const formatRating = (score: number) => (Number.isInteger(score) ? score.toFixed(0) : score.toFixed(1));

export function formatRuntime(minutes: number | null) {
  if (!minutes) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h}h ${m.toString().padStart(2, '0')}m` : `${m}m`;
}

const dateFmt = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

export function formatDate(value: string | null | undefined) {
  if (!value) return null;
  // Date-only strings are calendar dates: format them in UTC so they don't shift a day.
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00Z`) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : dateFmt.format(date);
}

export function timeAgo(iso: string | null | undefined) {
  if (!iso) return null;
  const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  const steps: [number, Intl.RelativeTimeFormatUnit][] = [
    [60, 'second'],
    [3600, 'minute'],
    [86400, 'hour'],
    [604800, 'day'],
    [2629800, 'week'],
    [31557600, 'month'],
    [Infinity, 'year'],
  ];
  const divisors = [1, 60, 3600, 86400, 604800, 2629800, 31557600];
  const index = steps.findIndex(([limit]) => seconds < limit);
  return rtf.format(-Math.round(seconds / divisors[index]!), steps[index]![1]);
}

export const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Colour scale for scores, from red (poor) to green (great). */
export function ratingColor(score: number | null): string {
  if (score === null) return '#52525c';
  if (score >= 8.5) return '#34d399';
  if (score >= 7) return '#a3e635';
  if (score >= 5.5) return '#e8b04b';
  if (score >= 4) return '#fb923c';
  return '#f87171';
}

export function ratingLabel(score: number | null): string {
  if (score === null) return 'Not rated';
  if (score >= 9.5) return 'Masterpiece';
  if (score >= 8.5) return 'Outstanding';
  if (score >= 7.5) return 'Great';
  if (score >= 6.5) return 'Good';
  if (score >= 5) return 'Decent';
  if (score >= 3.5) return 'Weak';
  if (score >= 2) return 'Bad';
  return 'Awful';
}

export const cx = (...classes: (string | false | null | undefined)[]) => classes.filter(Boolean).join(' ');
