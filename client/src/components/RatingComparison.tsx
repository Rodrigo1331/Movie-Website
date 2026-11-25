import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Globe, RefreshCw, ThumbsUp, Trophy } from 'lucide-react';
import type { ComparisonPoint, RatingComparison as Comparison } from '@moviesite/shared';
import { useExternalBackfill, useExternalStatus } from '../api/hooks';
import { agreementLabel, axisDomain, criticsLikedMore, formatGap, lovedMoreThanImdb, type GapItem } from '../lib/comparison';
import { formatRating } from '../lib/format';
import { Poster } from './Poster';
import { Spinner } from './ui';

/** Dashboard section: your ratings vs IMDb and critics, plus a one-click backfill for films without scores. */
export function RatingComparison({ comparison }: { comparison: Comparison }) {
  const { data: status } = useExternalStatus();
  const configured = !!status && (status.omdb || status.tmdb);
  if (comparison.compared === 0 && comparison.points.length === 0 && !(configured && status.missing > 0)) return null;

  return (
    <section className="animate-fade-up">
      <div className="mb-4">
        <p className="text-xs font-semibold tracking-[0.2em] text-gold-500 uppercase">You vs the world</p>
        <h2 className="font-display text-2xl font-semibold text-ink-100">How your ratings compare</h2>
      </div>
      {configured && status.missing > 0 && <BackfillBanner missing={status.missing} />}
      {comparison.points.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
          <div className="panel p-5">
            <Summary comparison={comparison} />
            {comparison.compared > 0 && <Scatter points={comparison.points.filter((p) => p.imdb !== null)} />}
          </div>
          <div className="grid gap-6">
            <GapList
              title="You liked more than IMDb"
              icon={<ThumbsUp className="size-4" />}
              items={lovedMoreThanImdb(comparison.points)}
              otherLabel="IMDb"
              empty="No films you rate well above IMDb yet."
              sign={1}
            />
            <GapList
              title="Critics liked more than you"
              icon={<Trophy className="size-4" />}
              items={criticsLikedMore(comparison.points)}
              otherLabel="Critics"
              empty="Critics haven’t outscored you on any film yet."
              sign={-1}
            />
          </div>
        </div>
      )}
    </section>
  );
}

function BackfillBanner({ missing }: { missing: number }) {
  const backfill = useExternalBackfill();
  return (
    <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-white/8 bg-ink-900/80 p-4 text-sm">
      <Globe className="size-5 shrink-0 text-gold-500" />
      <p className="min-w-0 flex-1 text-ink-300">
        {backfill.running
          ? `Fetching IMDb, Rotten Tomatoes and Metacritic scores… ${backfill.done} / ${backfill.total}`
          : `${missing} ${missing === 1 ? 'film doesn’t' : 'films don’t'} have IMDb, Rotten Tomatoes or Metacritic scores yet.`}
        {backfill.error && <span className="mt-1 block text-red-400">{backfill.error}</span>}
      </p>
      <button type="button" className="btn-secondary px-3 py-2 text-xs" onClick={() => backfill.run(missing)} disabled={backfill.running}>
        {backfill.running ? <Spinner className="size-3.5" /> : <RefreshCw className="size-3.5" />}
        Fetch scores
      </button>
    </div>
  );
}

function Summary({ comparison: c }: { comparison: Comparison }) {
  const tiles = [
    { label: 'Your average', value: c.myAverage === null ? '–' : c.myAverage.toFixed(2), sub: `${c.compared} films compared` },
    { label: 'IMDb average', value: c.imdbAverage === null ? '–' : c.imdbAverage.toFixed(2), sub: 'same films' },
    {
      label: 'Average gap',
      value: c.averageGap === null ? '–' : formatGap(c.averageGap),
      sub: c.averageGap === null ? '' : c.averageGap > 0.05 ? 'you rate higher' : c.averageGap < -0.05 ? 'you rate lower' : 'right in line',
    },
    { label: 'Agreement', value: c.correlation === null ? '–' : c.correlation.toFixed(2), sub: agreementLabel(c.correlation) },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {tiles.map((t) => (
        <div key={t.label}>
          <p className="text-xs font-medium text-ink-400">{t.label}</p>
          <p className="mt-1 font-display text-2xl font-bold text-ink-100 tabular-nums">{t.value}</p>
          <p className="text-[11px] text-ink-500">{t.sub}</p>
        </div>
      ))}
    </div>
  );
}

const W = 520;
const H = 340;
const M = { top: 16, right: 16, bottom: 40, left: 44 };

/** Your rating (y) against IMDb (x). Dots above the diagonal are films you rate higher than IMDb. */
function Scatter({ points }: { points: (ComparisonPoint & { imdb: number | null })[] }) {
  const navigate = useNavigate();
  const [active, setActive] = useState<ComparisonPoint | null>(null);
  const [lo, hi] = axisDomain(points.flatMap((p) => [p.mine, p.imdb!]));
  const sx = (v: number) => M.left + ((v - lo) / (hi - lo)) * (W - M.left - M.right);
  const sy = (v: number) => H - M.bottom - ((v - lo) / (hi - lo)) * (H - M.top - M.bottom);
  const ticks = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);

  return (
    <figure className="relative mt-6">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full overflow-visible" role="img" aria-label={`Scatter chart of your ratings against IMDb ratings for ${points.length} films`}>
        {/* Grid + axes (recessive) */}
        {ticks.map((t) => (
          <g key={t} className="text-[11px]">
            <line x1={sx(lo)} x2={sx(hi)} y1={sy(t)} y2={sy(t)} className="stroke-white/6" />
            <line x1={sx(t)} x2={sx(t)} y1={sy(lo)} y2={sy(hi)} className="stroke-white/6" />
            <text x={sx(lo) - 10} y={sy(t)} dy="0.32em" textAnchor="end" className="fill-ink-500 tabular-nums">{t}</text>
            <text x={sx(t)} y={sy(lo) + 18} textAnchor="middle" className="fill-ink-500 tabular-nums">{t}</text>
          </g>
        ))}
        <text x={(sx(lo) + sx(hi)) / 2} y={H - 4} textAnchor="middle" className="fill-ink-400 text-[11px] font-medium">IMDb rating</text>
        <text transform={`translate(12 ${(sy(lo) + sy(hi)) / 2}) rotate(-90)`} textAnchor="middle" className="fill-ink-400 text-[11px] font-medium">Your rating</text>

        {/* Agreement diagonal */}
        <line x1={sx(lo)} y1={sy(lo)} x2={sx(hi)} y2={sy(hi)} className="stroke-ink-500" strokeWidth={1.5} strokeDasharray="4 5" />
        <text x={sx(hi) - 6} y={sy(hi) + 14} textAnchor="end" className="fill-ink-500 text-[10px]">same as IMDb</text>
        <text x={sx(lo) + 8} y={sy(hi) + 14} className="fill-ink-500 text-[10px]">↑ you rate higher</text>
        <text x={sx(hi) - 8} y={sy(lo) - 8} textAnchor="end" className="fill-ink-500 text-[10px]">IMDb rates higher ↓</text>

        {/* Dots: 10px with a 2px surface ring so overlaps stay readable */}
        {points.map((p) => (
          <circle
            key={p.id}
            cx={sx(p.imdb!)}
            cy={sy(p.mine)}
            r={5}
            className={active?.id === p.id ? 'fill-gold-400' : 'fill-gold-500'}
            stroke="var(--color-ink-900)"
            strokeWidth={2}
            pointerEvents="none"
          />
        ))}
        {/* Larger invisible hit targets, focusable for keyboard users */}
        {points.map((p) => (
          <circle
            key={`hit-${p.id}`}
            cx={sx(p.imdb!)}
            cy={sy(p.mine)}
            r={12}
            fill="transparent"
            className="cursor-pointer outline-none"
            tabIndex={0}
            role="link"
            aria-label={`${p.title}: you ${formatRating(p.mine)}, IMDb ${formatRating(p.imdb!)}`}
            onMouseEnter={() => setActive(p)}
            onMouseLeave={() => setActive((a) => (a?.id === p.id ? null : a))}
            onFocus={() => setActive(p)}
            onBlur={() => setActive(null)}
            onClick={() => navigate(`/movies/${p.id}`)}
            onKeyDown={(e) => e.key === 'Enter' && navigate(`/movies/${p.id}`)}
          />
        ))}
        {active && <circle cx={sx(active.imdb!)} cy={sy(active.mine)} r={9} fill="none" className="stroke-gold-400" strokeWidth={2} pointerEvents="none" />}
      </svg>

      {active && (
        <div
          className="pointer-events-none absolute z-10 w-max max-w-56 -translate-x-1/2 -translate-y-full rounded-lg border border-white/10 bg-ink-800 px-3 py-2 text-xs shadow-xl shadow-black/40"
          style={{ left: `${(sx(active.imdb!) / W) * 100}%`, top: `calc(${(sy(active.mine) / H) * 100}% - 14px)` }}
        >
          <p className="font-semibold text-ink-100">
            {active.title} {active.releaseYear && <span className="font-normal text-ink-500">({active.releaseYear})</span>}
          </p>
          <p className="mt-0.5 text-ink-300 tabular-nums">
            You {formatRating(active.mine)} · IMDb {formatRating(active.imdb!)} · <span className="text-ink-100">{formatGap(active.mine - active.imdb!)}</span>
          </p>
        </div>
      )}
      <figcaption className="mt-2 text-[11px] text-ink-500">Each dot is a film you rated. Hover or focus a dot for details, click to open it.</figcaption>
    </figure>
  );
}

function GapList(props: { title: string; icon: React.ReactNode; items: GapItem[]; otherLabel: string; empty: string; sign: 1 | -1 }) {
  return (
    <div className="panel p-5">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-ink-100">
        <span className="text-gold-500">{props.icon}</span> {props.title}
      </h3>
      {props.items.length === 0 ? (
        <p className="mt-4 text-sm text-ink-500">{props.empty}</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {props.items.map((item) => (
            <li key={item.id}>
              <Link to={`/movies/${item.id}`} className="group flex items-center gap-3">
                <Poster src={item.posterUrl} title={item.title} className="w-9 shrink-0 rounded-md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-ink-200 group-hover:text-gold-400">{item.title}</p>
                  <p className="text-xs text-ink-500 tabular-nums">
                    You {formatRating(item.mine)} · {props.otherLabel} {formatRating(Math.round(item.other * 10) / 10)}
                  </p>
                </div>
                <span className="shrink-0 rounded-md bg-white/5 px-2 py-0.5 text-xs font-semibold text-ink-200 tabular-nums">
                  {formatGap(props.sign * item.gap)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
