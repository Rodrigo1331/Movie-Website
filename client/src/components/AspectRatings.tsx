import { X } from 'lucide-react';
import type { AspectRatings, RatingAspect } from '@moviesite/shared';
import { ASPECTS, aspectAverage } from '../lib/aspects';
import { formatRating, ratingColor } from '../lib/format';

/** Compact sliders for scoring each aspect separately (each one optional). */
export function AspectRatingsInput(props: {
  value: AspectRatings;
  onChange: (next: AspectRatings) => void;
  overall: number | null;
  onUseAverage: (average: number) => void;
}) {
  const { value, onChange } = props;
  const setAspect = (key: RatingAspect, score: number | null) => {
    const next = { ...value };
    if (score === null) delete next[key];
    else next[key] = Math.round(score * 10) / 10;
    onChange(next);
  };
  const average = aspectAverage(value);

  return (
    <div className="mt-3 animate-fade-in space-y-3 rounded-xl border border-white/8 bg-ink-850 p-4">
      {ASPECTS.map(({ key, label }) => {
        const score = value[key] ?? null;
        const color = ratingColor(score);
        return (
          <div key={key} className="grid grid-cols-[6.5rem_1fr_2.5rem_1.25rem] items-center gap-3 sm:grid-cols-[8rem_1fr_2.5rem_1.25rem]">
            <span className="truncate text-sm text-ink-300">{label}</span>
            <input
              type="range"
              min={0}
              max={10}
              step={0.1}
              aria-label={`${label} rating`}
              value={score ?? 0}
              onChange={(e) => setAspect(key, Number(e.target.value))}
              className="rating-range w-full"
              style={{ '--range-color': score === null ? 'var(--rating-none)' : color, '--range-pct': `${(score ?? 0) * 10}%` } as React.CSSProperties}
            />
            <span className="text-right font-display text-base font-bold tabular-nums" style={{ color: score === null ? undefined : color }}>
              {score === null ? <span className="text-ink-600">–</span> : formatRating(score)}
            </span>
            {score !== null ? (
              <button type="button" className="grid size-5 cursor-pointer place-items-center rounded text-ink-500 hover:bg-white/5 hover:text-ink-200" onClick={() => setAspect(key, null)} aria-label={`Clear ${label} rating`} title="Clear">
                <X className="size-3.5" />
              </button>
            ) : (
              <span />
            )}
          </div>
        );
      })}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/6 pt-3 text-xs text-ink-400">
        <span>
          Aspect average:{' '}
          <strong className="font-semibold tabular-nums" style={{ color: average === null ? undefined : ratingColor(average) }}>
            {average === null ? '–' : formatRating(average)}
          </strong>
          <span className="ml-1 text-ink-500">(unrated aspects are skipped)</span>
        </span>
        {average !== null && average !== props.overall && (
          <button type="button" className="cursor-pointer font-semibold text-gold-400 hover:text-gold-300" onClick={() => props.onUseAverage(average)}>
            Use as overall rating
          </button>
        )}
      </div>
    </div>
  );
}

/** Read-only bars showing each rated aspect, used on the movie page. */
export function AspectBreakdown({ ratings }: { ratings: AspectRatings }) {
  const rated = ASPECTS.filter((a) => typeof ratings[a.key] === 'number');
  if (rated.length === 0) return null;
  return (
    <div className="panel p-4 sm:p-5">
      <p className="label mb-3">Rating breakdown</p>
      <ul className="space-y-2.5">
        {rated.map(({ key, label }) => {
          const score = ratings[key]!;
          const color = ratingColor(score);
          return (
            <li key={key} className="grid grid-cols-[7rem_1fr_2.25rem] items-center gap-3 text-sm sm:grid-cols-[8rem_1fr_2.25rem]">
              <span className="truncate text-ink-300">{label}</span>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/6">
                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${score * 10}%`, background: color }} />
              </div>
              <span className="text-right font-semibold tabular-nums" style={{ color }}>
                {formatRating(score)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
