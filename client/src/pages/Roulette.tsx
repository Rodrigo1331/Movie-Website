import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { Clock, Dices, Eye, Play, Plus, RotateCcw, SearchX, Sparkles } from 'lucide-react';
import type { Movie, Section } from '@moviesite/shared';
import { useMovies, useSections, useSetMovieSections } from '../api/hooks';
import { Page } from '../components/Layout';
import { Poster } from '../components/Poster';
import { useToast } from '../components/Toast';
import { EmptyState, ErrorState, PageLoader, Spinner } from '../components/ui';
import { cx, formatRuntime } from '../lib/format';
import { useDocumentTitle } from '../lib/hooks';
import { cycleReel, offsetFor, pickWinner, planSpin, shuffle } from '../lib/roulette';

const ITEM = 140; // poster width in px
const GAP = 12;
const STEP = ITEM + GAP;
const PAD = 6; // items kept before the centre when a new spin starts
const IDLE_LENGTH = PAD * 2 + 12;
const MIN_SPIN = 30; // minimum number of posters travelled per spin
const SPIN_MS = 4600;

const RUNTIME_OPTIONS = [
  { value: 0, label: 'Any length' },
  { value: 90, label: 'Under 90 min' },
  { value: 120, label: 'Under 2 hours' },
  { value: 150, label: 'Under 2½ hours' },
];

const isWantToWatch = (s: Section) => s.slug === 'want-to-watch' || s.name.toLowerCase() === 'want to watch';
const isCurrentlyWatching = (s: Section) => s.slug === 'currently-watching' || s.name.toLowerCase() === 'currently watching';

type Phase = 'idle' | 'spinning' | 'done';

export function RoulettePage() {
  useDocumentTitle('Roulette');
  const toast = useToast();
  const { data: sections, isLoading: sectionsLoading } = useSections();
  const [chosenSection, setChosenSection] = useState<number | null>(null);
  const defaultSection = sections?.find(isWantToWatch) ?? sections?.[0];
  const sectionId = chosenSection ?? defaultSection?.id ?? null;
  const section = sections?.find((s) => s.id === sectionId);
  const currentlyWatching = sections?.find(isCurrentlyWatching);

  const movies = useMovies({ section: sectionId ?? undefined, sort: 'title' }, { enabled: sectionId !== null });
  const [genre, setGenre] = useState('');
  const [maxRuntime, setMaxRuntime] = useState(0);
  const [noRepeat, setNoRepeat] = useState(true);

  const sectionMovies = movies.data ?? [];
  const genres = useMemo(() => [...new Set(sectionMovies.flatMap((m) => m.genres))].sort(), [sectionMovies]);
  const pool = useMemo(
    () =>
      sectionMovies.filter(
        (m) => (!genre || m.genres.includes(genre)) && (!maxRuntime || m.runtime === null || m.runtime <= maxRuntime),
      ),
    [sectionMovies, genre, maxRuntime],
  );
  const poolKey = pool.map((m) => m.id).join(',');

  // Reel state: the reel is a window onto one fixed cyclic order (1, 2, 3, 1, 2, 3…),
  // shuffled once whenever the set of candidates changes.
  const [order, setOrder] = useState<Movie[]>([]);
  const [win, setWin] = useState({ start: 0, length: 0 });
  const reel = useMemo(() => cycleReel(order, win.start, win.length), [order, win]);
  const [pos, setPos] = useState({ index: PAD, jitter: 0 });
  const [animate, setAnimate] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [winnerId, setWinnerId] = useState<number | null>(null);
  const [seen, setSeen] = useState<Set<number>>(new Set());
  const [cycledNote, setCycledNote] = useState(false);
  const fallbackTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Viewport width (for centring) tracked responsively
  const viewport = useRef<HTMLDivElement>(null);
  const [vw, setVw] = useState(0);
  useLayoutEffect(() => {
    const el = viewport.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setVw(entry!.contentRect.width));
    ro.observe(el);
    setVw(el.clientWidth);
    return () => ro.disconnect();
  }, [pool.length > 0]);

  // Rebuild the idle reel whenever the set of candidates changes
  useEffect(() => {
    clearTimeout(fallbackTimer.current);
    setOrder(shuffle(pool));
    setWin({ start: 0, length: IDLE_LENGTH });
    setPos({ index: PAD, jitter: 0 });
    setAnimate(false);
    setPhase('idle');
    setWinnerId(null);
    setSeen(new Set());
    setCycledNote(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poolKey]);

  useEffect(() => () => clearTimeout(fallbackTimer.current), []);

  const finish = () => {
    clearTimeout(fallbackTimer.current);
    setAnimate(false);
    setPhase('done');
  };

  const spin = () => {
    const n = order.length;
    if (n === 0 || phase === 'spinning') return;
    const picked = pickWinner(order, noRepeat ? seen : new Set<number>());
    setSeen(picked.seen);
    setCycledNote(noRepeat && picked.cycled && n > 1);
    setWinnerId(picked.winner.id);

    // Continue the cycle from the film currently centred so the spin starts seamlessly.
    const currentPos = (((win.start + pos.index) % n) + n) % n;
    const winnerPos = order.findIndex((m) => m.id === picked.winner.id);
    const plan = planSpin(n, currentPos, winnerPos, { pad: PAD, minSpin: MIN_SPIN });
    const winnerIndex = plan.winnerIndex;
    setAnimate(false);
    setWin({ start: plan.start, length: plan.length });
    setPos({ index: plan.centreIndex, jitter: pos.jitter });

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion || n === 1) {
      setPos({ index: winnerIndex, jitter: 0 });
      setPhase('done');
      return;
    }
    setPhase('spinning');
    // Two frames: let the reset position paint before enabling the transition.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        setAnimate(true);
        setPos({ index: winnerIndex, jitter: (Math.random() - 0.5) * ITEM * 0.7 });
        fallbackTimer.current = setTimeout(finish, SPIN_MS + 400);
      }),
    );
  };

  const winner = winnerId === null ? null : (sectionMovies.find((m) => m.id === winnerId) ?? null);
  const filtersActive = !!genre || maxRuntime > 0;

  if (sectionsLoading) return <PageLoader />;

  return (
    <Page>
      <header className="mb-8 flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="mb-1 text-xs font-semibold tracking-[0.2em] text-gold-500 uppercase">Can’t decide?</p>
          <h1 className="font-display text-4xl font-bold text-white">Movie roulette</h1>
          <p className="mt-1 text-sm text-ink-500">
            Let fate pick tonight’s film from{' '}
            <span className="text-ink-300">{section ? section.name : 'your list'}</span>.
          </p>
        </div>
      </header>

      {/* Controls */}
      <div className="panel mb-8 flex flex-wrap items-end gap-3 p-4">
        <label className="min-w-44 flex-1 sm:flex-none">
          <span className="label">Pick from</span>
          <select
            className="field"
            value={sectionId ?? ''}
            disabled={phase === 'spinning'}
            onChange={(e) => {
              setChosenSection(Number(e.target.value));
              setGenre('');
            }}
          >
            {sections?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.movieCount})
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-40 flex-1 sm:flex-none">
          <span className="label">Genre</span>
          <select className="field" value={genre} disabled={phase === 'spinning'} onChange={(e) => setGenre(e.target.value)}>
            <option value="">Any genre</option>
            {genres.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-40 flex-1 sm:flex-none">
          <span className="label">Runtime</span>
          <select className="field" value={maxRuntime} disabled={phase === 'spinning'} onChange={(e) => setMaxRuntime(Number(e.target.value))}>
            {RUNTIME_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex cursor-pointer items-center gap-2.5 py-2.5 text-sm text-ink-300 select-none">
          <input type="checkbox" className="peer sr-only" checked={noRepeat} onChange={(e) => setNoRepeat(e.target.checked)} />
          <span className="relative h-5 w-9 rounded-full bg-ink-600 transition-colors peer-checked:bg-gold-500 peer-focus-visible:outline-2 peer-focus-visible:outline-gold-500 after:absolute after:top-0.5 after:left-0.5 after:size-4 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-4" />
          Don’t repeat picks
        </label>
        <p className="ml-auto self-center text-sm text-ink-400 tabular-nums">
          <span className="font-semibold text-ink-100">{pool.length}</span> {pool.length === 1 ? 'film' : 'films'} in the draw
        </p>
      </div>

      {movies.isError ? (
        <ErrorState error={movies.error} onRetry={() => movies.refetch()} />
      ) : !sections?.length ? (
        <EmptyState icon={<Dices />} title="No sections yet" action={<Link to="/sections" className="btn-primary">Create a section</Link>}>
          The roulette picks from a section — create one and add some films to it.
        </EmptyState>
      ) : movies.isLoading ? (
        <PageLoader />
      ) : sectionMovies.length === 0 ? (
        <EmptyState
          icon={<Plus />}
          title={`${section?.name ?? 'This section'} is empty`}
          action={
            <Link to={`/movies/new?section=${sectionId}`} className="btn-primary">
              <Plus className="size-4" /> Add a movie
            </Link>
          }
        >
          Add films you want to see to {section?.name ?? 'this section'}, then come back and spin.
        </EmptyState>
      ) : pool.length === 0 ? (
        <EmptyState
          icon={<SearchX />}
          title="No films match"
          action={
            <button className="btn-secondary" onClick={() => (setGenre(''), setMaxRuntime(0))}>
              Reset filters
            </button>
          }
        >
          None of the films in {section?.name} fit these filters.
        </EmptyState>
      ) : (
        <>
          {/* Reel */}
          <div className="relative -mx-4 sm:mx-0">
            <div
              ref={viewport}
              className="relative overflow-hidden py-6 sm:rounded-2xl sm:border sm:border-white/6 sm:bg-ink-900/60"
              aria-live="polite"
              aria-busy={phase === 'spinning'}
            >
              <div
                className="flex will-change-transform"
                style={{
                  gap: GAP,
                  transform: `translate3d(${-offsetFor(pos.index, STEP, ITEM, vw, pos.jitter)}px, 0, 0)`,
                  transition: animate ? `transform ${SPIN_MS}ms cubic-bezier(0.08, 0.82, 0.12, 1)` : 'none',
                }}
                onTransitionEnd={(e) => {
                  if (e.target === e.currentTarget && e.propertyName === 'transform' && phase === 'spinning') finish();
                }}
              >
                {reel.map((m, i) => {
                  const isWinner = phase === 'done' && i === pos.index;
                  return (
                    <div
                      key={i}
                      className={cx(
                        'shrink-0 transition-all duration-500',
                        phase === 'done' && !isWinner && 'opacity-35 saturate-50',
                        isWinner && 'z-10 scale-110',
                      )}
                      style={{ width: ITEM }}
                    >
                      <Poster
                        src={m.posterUrl}
                        title={m.title}
                        eager
                        className={cx(
                          'rounded-xl ring-1 ring-white/8',
                          isWinner && 'shadow-2xl ring-2 shadow-gold-500/30 ring-gold-400',
                        )}
                      />
                    </div>
                  );
                })}
              </div>

              {/* Edge fades */}
              <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-ink-950 to-transparent sm:w-32" />
              <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-ink-950 to-transparent sm:w-32" />

              {/* Centre marker */}
              <div className="pointer-events-none absolute inset-y-0 left-1/2 -translate-x-1/2">
                <div className="absolute top-0 left-1/2 size-0 -translate-x-1/2 border-x-[10px] border-t-[12px] border-x-transparent border-t-gold-500 drop-shadow-[0_0_8px_rgba(232,176,75,0.7)]" />
                <div
                  className={cx(
                    'absolute inset-y-3 left-1/2 w-0.5 -translate-x-1/2 bg-gold-500/70 transition-opacity duration-300',
                    phase === 'done' ? 'opacity-0' : 'opacity-100',
                  )}
                />
                <div className="absolute bottom-0 left-1/2 size-0 -translate-x-1/2 border-x-[10px] border-b-[12px] border-x-transparent border-b-gold-500 drop-shadow-[0_0_8px_rgba(232,176,75,0.7)]" />
              </div>
            </div>
          </div>

          <div className="mt-8 flex flex-col items-center gap-3">
            <button className="btn-primary px-10 py-3.5 text-base" onClick={spin} disabled={phase === 'spinning'}>
              {phase === 'spinning' ? (
                <>
                  <Spinner className="size-5" /> Spinning…
                </>
              ) : (
                <>
                  <Dices className="size-5" /> {phase === 'done' ? 'Spin again' : 'Spin the roulette'}
                </>
              )}
            </button>
            {cycledNote && <p className="text-xs text-ink-500">Every film has had a turn — starting a fresh round.</p>}
            {noRepeat && phase !== 'idle' && !cycledNote && pool.length > 1 && (
              <p className="text-xs text-ink-500 tabular-nums">
                {pool.length - seen.size} of {pool.length} not picked yet this round
              </p>
            )}
          </div>

          {phase === 'done' && winner && (
            <WinnerCard key={winner.id} movie={winner} currentlyWatching={currentlyWatching} onSpinAgain={spin} toast={toast} />
          )}
          {filtersActive && phase === 'idle' && (
            <p className="mt-4 text-center text-xs text-ink-500">Films without a known runtime are always included.</p>
          )}
        </>
      )}
    </Page>
  );
}

interface WinnerProps {
  movie: Movie;
  currentlyWatching: Section | undefined;
  onSpinAgain: () => void;
  toast: ReturnType<typeof useToast>;
}

function WinnerCard({ movie, currentlyWatching, onSpinAgain, toast }: WinnerProps) {
  const setSections = useSetMovieSections(movie.id);
  const alreadyWatching = !!currentlyWatching && movie.sections.some((s) => s.id === currentlyWatching.id);
  const runtime = formatRuntime(movie.runtime);
  const backdrop = movie.backdropUrl ?? movie.posterUrl;

  const watchNow = () => {
    if (!currentlyWatching) return;
    // Adds to Currently Watching; the film stays in its other sections (including Want to Watch).
    setSections.mutate([...movie.sections.map((s) => s.id), currentlyWatching.id], {
      onSuccess: () => toast.success(`Enjoy “${movie.title}”! Added to ${currentlyWatching.name}.`),
      onError: (e) => toast.error(e),
    });
  };

  return (
    <section className="relative isolate mt-10 animate-scale-in overflow-hidden rounded-2xl border border-gold-500/20 bg-ink-900" aria-label="Tonight’s pick">
      {backdrop && (
        <img src={backdrop} alt="" aria-hidden className={cx('absolute inset-0 -z-20 size-full object-cover', movie.backdropUrl ? 'opacity-30' : 'scale-125 opacity-25 blur-2xl')} />
      )}
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-ink-950 via-ink-950/85 to-ink-950/40" />

      <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:p-8">
        <Link to={`/movies/${movie.id}`} className="mx-auto w-36 shrink-0 sm:mx-0 sm:w-44">
          <Poster src={movie.posterUrl} title={movie.title} eager className="rounded-xl shadow-2xl ring-1 shadow-black ring-white/10" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="inline-flex items-center gap-1.5 rounded-full border border-gold-500/30 bg-gold-500/10 px-3 py-1 text-xs font-semibold tracking-wider text-gold-300 uppercase">
            <Sparkles className="size-3.5" /> Tonight’s pick
          </p>
          <h2 className="mt-3 font-display text-3xl leading-tight font-bold text-white sm:text-4xl">{movie.title}</h2>
          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-300">
            {movie.releaseYear && <span>{movie.releaseYear}</span>}
            {runtime && (
              <span className="flex items-center gap-1">
                <Clock className="size-3.5 text-ink-500" /> {runtime}
              </span>
            )}
            {movie.director && <span>Directed by {movie.director}</span>}
          </p>
          {movie.genres.length > 0 && <p className="mt-1 text-xs text-ink-400">{movie.genres.join(' · ')}</p>}
          {movie.description && <p className="mt-4 line-clamp-3 max-w-2xl text-sm leading-relaxed text-ink-300">{movie.description}</p>}

          <div className="mt-6 flex flex-wrap gap-2">
            {currentlyWatching && (
              <button className="btn-primary" onClick={watchNow} disabled={alreadyWatching || setSections.isPending}>
                {setSections.isPending ? <Spinner className="size-4" /> : <Play className="size-4 fill-current" />}
                {alreadyWatching ? `In ${currentlyWatching.name}` : 'Watch it now'}
              </button>
            )}
            <button className="btn-secondary" onClick={onSpinAgain}>
              <RotateCcw className="size-4" /> Spin again
            </button>
            <Link to={`/movies/${movie.id}`} className="btn-ghost">
              <Eye className="size-4" /> View details
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
