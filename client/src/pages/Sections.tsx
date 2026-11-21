import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { ArrowDown, ArrowUp, Check, FolderOpen, FolderPlus, Pencil, Plus, Trash2, X } from 'lucide-react';
import type { Section } from '@moviesite/shared';
import { useMovies, useSectionMutations, useSections } from '../api/hooks';
import { Page } from '../components/Layout';
import { ConfirmDialog } from '../components/Modal';
import { Poster } from '../components/Poster';
import { useToast } from '../components/Toast';
import { EmptyState, ErrorState, PageLoader, Spinner } from '../components/ui';
import { useDocumentTitle } from '../lib/hooks';

export function SectionsPage() {
  useDocumentTitle('Sections');
  const { data: sections, isLoading, error, refetch } = useSections();
  const { create, reorder } = useSectionMutations();
  const toast = useToast();
  const [name, setName] = useState('');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    create.mutate(name.trim(), {
      onSuccess: (s) => {
        setName('');
        toast.success(`Created “${s.name}”`);
      },
      onError: (err) => toast.error(err),
    });
  };

  const move = (index: number, dir: -1 | 1) => {
    if (!sections) return;
    const ids = sections.map((s) => s.id);
    const target = index + dir;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target]!, ids[index]!];
    reorder.mutate(ids, { onError: (err) => toast.error(err) });
  };

  if (isLoading) return <PageLoader />;
  if (error || !sections) return <Page><ErrorState error={error} onRetry={() => refetch()} /></Page>;

  return (
    <Page>
      <header className="mb-8 flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="mb-1 text-xs font-semibold tracking-[0.2em] text-gold-500 uppercase">Organise</p>
          <h1 className="font-display text-4xl font-bold text-white">Sections</h1>
          <p className="mt-1 text-sm text-ink-500">Group films however you like. A film can live in as many sections as you want.</p>
        </div>
        <form onSubmit={submit} className="flex w-full gap-2 sm:w-auto">
          <input className="field sm:w-64" placeholder="New section name" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} aria-label="New section name" />
          <button className="btn-primary shrink-0" disabled={!name.trim() || create.isPending}>
            {create.isPending ? <Spinner className="size-4" /> : <FolderPlus className="size-4" />} Create
          </button>
        </form>
      </header>

      {sections.length === 0 ? (
        <EmptyState icon={<FolderOpen />} title="No sections">
          Create a section above to start organising your films.
        </EmptyState>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {sections.map((s, i) => (
            <SectionCard key={s.id} section={s} index={i} isFirst={i === 0} isLast={i === sections.length - 1} onMove={(dir) => move(i, dir)} reordering={reorder.isPending} />
          ))}
        </div>
      )}
    </Page>
  );
}

interface CardProps {
  section: Section;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  reordering: boolean;
  onMove: (dir: -1 | 1) => void;
}

function SectionCard({ section, index, isFirst, isLast, reordering, onMove }: CardProps) {
  const { rename, remove } = useSectionMutations();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(section.name);
  const [confirming, setConfirming] = useState(false);
  const { data: preview = [] } = useMovies({ section: section.id, sort: 'reviewed', limit: 5 });

  const save = (e?: FormEvent) => {
    e?.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || trimmed === section.name) {
      setName(section.name);
      return setEditing(false);
    }
    rename.mutate(
      { id: section.id, name: trimmed },
      { onSuccess: () => setEditing(false), onError: (err) => toast.error(err) },
    );
  };

  return (
    <article className="panel group animate-fade-up overflow-hidden" style={{ animationDelay: `${index * 50}ms` }}>
      <Link to={`/library?section=${section.id}`} className="relative block h-36 overflow-hidden bg-ink-850" aria-label={`Browse ${section.name}`}>
        {preview.length > 0 ? (
          <div className="flex h-full gap-1 p-1">
            {preview.map((m) => (
              <Poster key={m.id} src={m.posterUrl} title={m.title} className="h-full flex-1 rounded-md transition-transform duration-500 group-hover:scale-[1.03]" />
            ))}
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-ink-600">No films yet</div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-ink-900 via-ink-900/30 to-transparent" />
      </Link>

      <div className="flex items-center gap-3 p-4">
        <div className="min-w-0 flex-1">
          {editing ? (
            <form onSubmit={save} className="flex items-center gap-1">
              <input
                autoFocus
                className="field py-1.5"
                value={name}
                maxLength={60}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Escape' && (setName(section.name), setEditing(false))}
                aria-label="Section name"
              />
              <button className="btn-ghost p-2" aria-label="Save name" disabled={rename.isPending}>
                {rename.isPending ? <Spinner className="size-4" /> : <Check className="size-4 text-emerald-400" />}
              </button>
              <button type="button" className="btn-ghost p-2" aria-label="Cancel" onClick={() => (setName(section.name), setEditing(false))}>
                <X className="size-4" />
              </button>
            </form>
          ) : (
            <>
              <Link to={`/library?section=${section.id}`} className="block truncate font-display text-lg font-semibold text-ink-100 hover:text-gold-400">
                {section.name}
              </Link>
              <p className="text-xs text-ink-500">
                {section.movieCount} {section.movieCount === 1 ? 'film' : 'films'}
                {section.isDefault && ' · default'}
              </p>
            </>
          )}
        </div>
        {!editing && (
          <div className="flex shrink-0 items-center">
            <Link to={`/movies/new?section=${section.id}`} className="btn-ghost p-2" title="Add a movie to this section" aria-label="Add a movie to this section">
              <Plus className="size-4" />
            </Link>
            <button className="btn-ghost p-2" onClick={() => onMove(-1)} disabled={isFirst || reordering} aria-label="Move up">
              <ArrowUp className="size-4" />
            </button>
            <button className="btn-ghost p-2" onClick={() => onMove(1)} disabled={isLast || reordering} aria-label="Move down">
              <ArrowDown className="size-4" />
            </button>
            <button className="btn-ghost p-2" onClick={() => setEditing(true)} aria-label="Rename">
              <Pencil className="size-4" />
            </button>
            <button className="btn-ghost p-2 hover:text-red-300" onClick={() => setConfirming(true)} aria-label="Delete">
              <Trash2 className="size-4" />
            </button>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirming}
        title={`Delete “${section.name}”?`}
        message={
          section.movieCount > 0
            ? `The ${section.movieCount} ${section.movieCount === 1 ? 'film' : 'films'} in it stay in your library — only the section is removed.`
            : 'This section is empty.'
        }
        pending={remove.isPending}
        onClose={() => setConfirming(false)}
        onConfirm={() =>
          remove.mutate(section.id, {
            onSuccess: () => toast.success(`Deleted “${section.name}”`),
            onError: (err) => toast.error(err),
          })
        }
      />
    </article>
  );
}
