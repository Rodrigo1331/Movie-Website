import { useRef, useState, type FormEvent, type ReactNode } from 'react';
import { ChevronDown, EyeOff } from 'lucide-react';
import type { AspectRatings, MovieInput } from '@moviesite/shared';
import { AspectRatingsInput } from '../../components/AspectRatings';
import { GenreInput } from '../../components/GenreInput';
import { Poster } from '../../components/Poster';
import { RatingInput } from '../../components/RatingInput';
import { SectionPicker } from '../../components/SectionPicker';
import { SpoilerText } from '../../components/SpoilerText';
import { hasSpoilers, wrapSpoiler } from '../../lib/spoilers';
import { Spinner } from '../../components/ui';
import { cx, todayIso } from '../../lib/format';

export interface MovieFormValues {
  tmdbId: number | null;
  title: string;
  releaseDate: string;
  releaseYear: string;
  director: string;
  description: string;
  posterUrl: string;
  backdropUrl: string;
  runtime: string;
  genres: string[];
  rating: number | null;
  /** Whether the "rate aspects separately" option is switched on. */
  aspectsEnabled: boolean;
  aspectRatings: AspectRatings;
  review: string;
  dateWatched: string;
  sectionIds: number[];
}

export const emptyMovieForm = (): MovieFormValues => ({
  tmdbId: null,
  title: '',
  releaseDate: '',
  releaseYear: '',
  director: '',
  description: '',
  posterUrl: '',
  backdropUrl: '',
  runtime: '',
  genres: [],
  rating: null,
  aspectsEnabled: false,
  aspectRatings: {},
  review: '',
  dateWatched: '',
  sectionIds: [],
});

export function toMovieInput(v: MovieFormValues): MovieInput {
  const num = (s: string) => (s.trim() === '' ? null : Number(s));
  return {
    tmdbId: v.tmdbId,
    title: v.title.trim(),
    releaseDate: v.releaseDate || null,
    releaseYear: v.releaseDate ? Number(v.releaseDate.slice(0, 4)) : num(v.releaseYear),
    director: v.director.trim() || null,
    description: v.description.trim() || null,
    posterUrl: v.posterUrl.trim() || null,
    backdropUrl: v.backdropUrl.trim() || null,
    runtime: num(v.runtime),
    genres: v.genres,
    rating: v.rating,
    // Switching the option off clears any aspect scores that were saved before.
    aspectRatings: v.aspectsEnabled ? v.aspectRatings : {},
    review: v.review.trim() || null,
    dateWatched: v.dateWatched || null,
    sectionIds: v.sectionIds,
  };
}

function validate(v: MovieFormValues): Partial<Record<keyof MovieFormValues, string>> {
  const errors: Partial<Record<keyof MovieFormValues, string>> = {};
  if (!v.title.trim()) errors.title = 'Title is required';
  if (v.releaseYear && !/^\d{4}$/.test(v.releaseYear)) errors.releaseYear = 'Use a 4-digit year';
  if (v.runtime && !/^\d{1,4}$/.test(v.runtime)) errors.runtime = 'Minutes as a whole number';
  for (const key of ['posterUrl', 'backdropUrl'] as const) {
    if (v[key].trim() && !/^https?:\/\/\S+$/i.test(v[key].trim())) errors[key] = 'Must start with http:// or https://';
  }
  if (v.dateWatched && v.dateWatched > todayIso()) errors.dateWatched = 'Date watched cannot be in the future';
  return errors;
}

function Field({ label, error, children, className }: { label: string; error?: string; children: ReactNode; className?: string }) {
  return (
    <label className={cx('block', className)}>
      <span className="label">{label}</span>
      {children}
      {error && <span className="mt-1 block text-xs text-red-400">{error}</span>}
    </label>
  );
}

/** Review textarea with inline spoiler markup (`||spoiler||`), a toolbar button and a live preview. */
function ReviewEditor({ value, onChange }: { value: string; onChange: (text: string) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [preview, setPreview] = useState(false);

  const markSpoiler = () => {
    const el = ref.current;
    if (!el) return;
    const next = wrapSpoiler(el.value, el.selectionStart, el.selectionEnd);
    onChange(next.text);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(next.selectionStart, next.selectionEnd);
    });
  };

  const tab = (active: boolean) =>
    cx('cursor-pointer rounded-md px-2.5 py-1 text-xs font-semibold transition-colors', active ? 'bg-white/10 text-white' : 'text-ink-400 hover:text-ink-200');

  return (
    <div>
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-medium tracking-wide text-ink-400 uppercase">Review</span>
        <div className="flex items-center gap-2">
          {!preview && (
            <button
              type="button"
              onClick={markSpoiler}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-amber-400/25 bg-amber-400/10 px-2.5 py-1 text-xs font-semibold text-amber-200 transition-colors hover:bg-amber-400/20"
              title="Wrap the selected text in spoiler tags (Ctrl+Shift+S)"
            >
              <EyeOff className="size-3.5" /> Mark as spoiler
            </button>
          )}
          <div className="flex rounded-lg border border-white/8 bg-ink-850 p-0.5">
            <button type="button" className={tab(!preview)} onClick={() => setPreview(false)} aria-pressed={!preview}>
              Write
            </button>
            <button type="button" className={tab(preview)} onClick={() => setPreview(true)} aria-pressed={preview}>
              Preview
            </button>
          </div>
        </div>
      </div>
      {preview ? (
        <div className="field min-h-40 leading-relaxed">
          {value.trim() ? <SpoilerText text={value} /> : <p className="text-ink-500">Nothing written yet.</p>}
        </div>
      ) : (
        <textarea
          ref={ref}
          aria-label="Review"
          className="field min-h-40 resize-y leading-relaxed"
          placeholder="What did you think? Performances, moments, how it made you feel…"
          maxLength={20000}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 's') {
              e.preventDefault();
              markSpoiler();
            }
          }}
        />
      )}
      <p className="mt-1.5 text-xs text-ink-500">
        Hide spoilers inline by wrapping them in double bars: <code className="rounded bg-white/8 px-1 text-amber-200">||the twist||</code>. Select text and
        press <kbd className="rounded border border-white/10 px-1 text-[10px]">Ctrl+Shift+S</kbd> or use “Mark as spoiler”.
        {hasSpoilers(value) && <span className="ml-1 text-amber-300/80">This review contains spoilers.</span>}
      </p>
    </div>
  );
}

interface Props {
  initial: MovieFormValues;
  submitLabel: string;
  pending: boolean;
  onSubmit: (input: MovieInput) => void;
  onCancel: () => void;
  /** Collapse film details by default (e.g. when prefilled from TMDB). */
  detailsCollapsed?: boolean;
}

export function MovieForm({ initial, submitLabel, pending, onSubmit, onCancel, detailsCollapsed }: Props) {
  const [v, setV] = useState(initial);
  const [errors, setErrors] = useState<ReturnType<typeof validate>>({});
  const [showDetails, setShowDetails] = useState(!detailsCollapsed);
  const set = <K extends keyof MovieFormValues>(key: K, value: MovieFormValues[K]) => setV((prev) => ({ ...prev, [key]: value }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const found = validate(v);
    setErrors(found);
    if (Object.keys(found).length) {
      if (found.title || found.releaseYear || found.runtime || found.posterUrl || found.backdropUrl) setShowDetails(true);
      return;
    }
    onSubmit(toMovieInput(v));
  };

  return (
    <form onSubmit={submit} className="grid gap-8 lg:grid-cols-[240px_1fr]" noValidate>
      <aside className="hidden lg:block">
        <div className="sticky top-24">
          <Poster src={v.posterUrl.trim() || null} title={v.title || 'Untitled'} className="rounded-xl shadow-2xl ring-1 shadow-black/60 ring-white/10" eager />
          <p className="mt-3 font-display text-lg font-semibold text-ink-100">{v.title || 'Untitled'}</p>
          <p className="text-sm text-ink-500">{[v.releaseDate.slice(0, 4) || v.releaseYear, v.director].filter(Boolean).join(' · ') || '—'}</p>
        </div>
      </aside>

      <div className="space-y-8">
        <section className="panel space-y-5 p-5 sm:p-6">
          <h2 className="font-display text-lg font-semibold text-ink-100">Your take</h2>
          <div>
            <span className="label">Rating</span>
            <RatingInput value={v.rating} onChange={(r) => set('rating', r)} />
            <label className="mt-3 inline-flex cursor-pointer items-center gap-2.5 text-sm text-ink-300 select-none hover:text-ink-100">
              <input
                type="checkbox"
                className="size-4 cursor-pointer accent-gold-500"
                checked={v.aspectsEnabled}
                onChange={(e) => set('aspectsEnabled', e.target.checked)}
              />
              Rate aspects separately
              <span className="text-xs text-ink-500">(story, characters, acting, soundtrack, enjoyment)</span>
            </label>
            {v.aspectsEnabled && (
              <AspectRatingsInput
                value={v.aspectRatings}
                onChange={(next) => set('aspectRatings', next)}
                overall={v.rating}
                onUseAverage={(avg) => set('rating', avg)}
              />
            )}
          </div>
          <div className="grid gap-5 sm:grid-cols-[200px_1fr]">
            <Field label="Date watched" error={errors.dateWatched}>
              <input type="date" className="field" max={todayIso()} value={v.dateWatched} onChange={(e) => set('dateWatched', e.target.value)} />
            </Field>
            <div>
              <span className="label">Sections</span>
              <SectionPicker value={v.sectionIds} onChange={(ids) => set('sectionIds', ids)} />
            </div>
          </div>
          <ReviewEditor value={v.review} onChange={(text) => set('review', text)} />
        </section>

        <section className="panel p-5 sm:p-6">
          <button type="button" className="flex w-full cursor-pointer items-center justify-between" onClick={() => setShowDetails((s) => !s)} aria-expanded={showDetails}>
            <h2 className="font-display text-lg font-semibold text-ink-100">Film details</h2>
            <ChevronDown className={cx('size-5 text-ink-400 transition-transform', showDetails && 'rotate-180')} />
          </button>
          {showDetails && (
            <div className="mt-5 grid animate-fade-in gap-5 sm:grid-cols-2">
              <Field label="Title *" error={errors.title} className="sm:col-span-2">
                <input className="field" value={v.title} maxLength={300} onChange={(e) => set('title', e.target.value)} />
              </Field>
              <Field label="Release date">
                <input type="date" className="field" value={v.releaseDate} onChange={(e) => set('releaseDate', e.target.value)} />
              </Field>
              <Field label="Release year (if no exact date)" error={errors.releaseYear}>
                <input className="field" inputMode="numeric" placeholder="e.g. 1994" disabled={!!v.releaseDate} value={v.releaseDate ? v.releaseDate.slice(0, 4) : v.releaseYear} onChange={(e) => set('releaseYear', e.target.value)} />
              </Field>
              <Field label="Director">
                <input className="field" value={v.director} maxLength={300} onChange={(e) => set('director', e.target.value)} />
              </Field>
              <Field label="Runtime (minutes)" error={errors.runtime}>
                <input className="field" inputMode="numeric" value={v.runtime} onChange={(e) => set('runtime', e.target.value)} />
              </Field>
              <div className="sm:col-span-2">
                <span className="label">Genres</span>
                <GenreInput value={v.genres} onChange={(g) => set('genres', g)} />
              </div>
              <Field label="Poster image URL" error={errors.posterUrl}>
                <input className="field" type="url" placeholder="https://…" value={v.posterUrl} onChange={(e) => set('posterUrl', e.target.value)} />
              </Field>
              <Field label="Backdrop image URL" error={errors.backdropUrl}>
                <input className="field" type="url" placeholder="https://…" value={v.backdropUrl} onChange={(e) => set('backdropUrl', e.target.value)} />
              </Field>
              <Field label="Description" className="sm:col-span-2">
                <textarea className="field min-h-28 resize-y leading-relaxed" maxLength={5000} value={v.description} onChange={(e) => set('description', e.target.value)} />
              </Field>
            </div>
          )}
        </section>

        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onCancel} disabled={pending}>
            Cancel
          </button>
          <button type="submit" className="btn-primary min-w-32" disabled={pending}>
            {pending && <Spinner className="size-4" />}
            {submitLabel}
          </button>
        </div>
      </div>
    </form>
  );
}
