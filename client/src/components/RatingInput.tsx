import { useEffect, useState } from 'react';
import { formatRating, ratingColor, ratingLabel } from '../lib/format';

/** 0–10 rating with 0.1 precision: slider + exact number input, or "no rating". */
export function RatingInput({ value, onChange, locked = false }: { value: number | null; onChange: (v: number | null) => void; locked?: boolean }) {
  const [text, setText] = useState(value === null ? '' : formatRating(value));
  useEffect(() => setText(value === null ? '' : formatRating(value)), [value]);

  const color = ratingColor(value);
  const commitText = (raw: string) => {
    if (raw.trim() === '') return onChange(null);
    const n = Number(raw.replace(',', '.'));
    if (Number.isFinite(n)) onChange(Math.min(10, Math.max(0, Math.round(n * 10) / 10)));
    else setText(value === null ? '' : formatRating(value));
  };

  return (
    <fieldset disabled={locked} className="rounded-xl border border-white/8 bg-ink-850 p-4 disabled:[&_input[type=range]]:cursor-default">
      <div className="flex items-center gap-4">
        <div className="w-24 shrink-0">
          <input
            aria-label="Rating out of 10"
            inputMode="decimal"
            className="w-full bg-transparent font-display text-4xl font-bold tabular-nums outline-none placeholder:text-ink-600"
            style={{ color }}
            placeholder="–"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={(e) => commitText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), commitText(e.currentTarget.value))}
          />
          <p className="text-[11px] font-semibold tracking-wider text-ink-500 uppercase">{ratingLabel(value)}</p>
        </div>
        <div className="flex-1">
          <input
            type="range"
            min={0}
            max={10}
            step={0.1}
            aria-label="Rating slider"
            value={value ?? 0}
            onChange={(e) => onChange(Number(e.target.value))}
            className="rating-range w-full"
            style={{ '--range-color': value === null ? 'var(--rating-none)' : color, '--range-pct': `${(value ?? 0) * 10}%` } as React.CSSProperties}
          />
          <div className="mt-2 flex justify-between px-0.5 text-[10px] text-ink-500 tabular-nums">
            {Array.from({ length: 11 }, (_, i) => (
              <button key={i} type="button" className="w-4 text-center hover:text-ink-200" onClick={() => onChange(i)}>
                {i}
              </button>
            ))}
          </div>
        </div>
      </div>
      {value !== null && !locked && (
        <button type="button" className="mt-2 text-xs text-ink-500 hover:text-ink-200" onClick={() => onChange(null)}>
          Clear rating
        </button>
      )}
    </fieldset>
  );
}
