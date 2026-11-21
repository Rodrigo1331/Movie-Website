import { Star } from 'lucide-react';
import { cx, formatRating, ratingColor, ratingLabel } from '../lib/format';

/** Compact score pill used on poster cards. */
export function RatingBadge({ score, className }: { score: number | null; className?: string }) {
  if (score === null) return null;
  const color = ratingColor(score);
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-md bg-night/85 px-1.5 py-0.5 text-xs font-bold tabular-nums ring-1 backdrop-blur-md',
        className,
      )}
      style={{ color, '--tw-ring-color': `${color}55` } as React.CSSProperties}
    >
      <Star className="size-3 fill-current" />
      {formatRating(score)}
    </span>
  );
}

/** Circular score display used on the details page and dashboard. */
export function RatingRing({ score, size = 96, showLabel = true }: { score: number | null; size?: number; showLabel?: boolean }) {
  const stroke = Math.max(4, size / 14);
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = score === null ? 0 : score / 10;
  const color = ratingColor(score);
  return (
    <div className="flex items-center gap-4">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-white/8" />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - pct)}
            style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.2,0.7,0.2,1)', filter: `drop-shadow(0 0 8px ${color}55)` }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display font-bold text-white tabular-nums" style={{ fontSize: size * 0.32 }}>
            {score === null ? '–' : formatRating(score)}
          </span>
          {size >= 80 && <span className="text-[10px] font-medium tracking-wider text-ink-400">/ 10</span>}
        </div>
      </div>
      {showLabel && (
        <div>
          <p className="text-xs font-semibold tracking-[0.15em] text-ink-400 uppercase">My rating</p>
          <p className="font-display text-xl font-semibold" style={{ color }}>
            {ratingLabel(score)}
          </p>
        </div>
      )}
    </div>
  );
}
