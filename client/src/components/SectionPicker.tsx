import { useState, type FormEvent } from 'react';
import { Check, Plus } from 'lucide-react';
import { useSectionMutations, useSections } from '../api/hooks';
import { cx } from '../lib/format';
import { Spinner } from './ui';
import { useToast } from './Toast';

interface Props {
  value: number[];
  onChange: (ids: number[]) => void;
  disabled?: boolean;
}

/** Toggle chips for the sections a movie belongs to, with inline section creation. */
export function SectionPicker({ value, onChange, disabled }: Props) {
  const { data: sections = [], isLoading } = useSections();
  const { create } = useSectionMutations();
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');

  const toggle = (id: number) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!name.trim()) return;
    create.mutate(name.trim(), {
      onSuccess: (section) => {
        onChange([...value, section.id]);
        setName('');
        setAdding(false);
      },
      onError: (err) => toast.error(err),
    });
  };

  if (isLoading) return <Spinner className="size-4 text-ink-500" />;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {sections.map((s) => {
        const active = value.includes(s.id);
        return (
          <button
            key={s.id}
            type="button"
            disabled={disabled}
            aria-pressed={active}
            onClick={() => toggle(s.id)}
            className={cx(
              'inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all duration-200 active:scale-95 disabled:opacity-60',
              active
                ? 'border-gold-500/60 bg-gold-500/15 text-gold-300'
                : 'border-white/10 bg-white/[0.03] text-ink-300 hover:border-white/25 hover:text-ink-100',
            )}
          >
            {active && <Check className="size-3.5" />}
            {s.name}
          </button>
        );
      })}
      {adding ? (
        <div className="flex items-center gap-1">
          <input
            autoFocus
            className="field w-40 py-1.5 text-xs"
            placeholder="New section name"
            maxLength={60}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit(e);
              if (e.key === 'Escape') setAdding(false);
            }}
          />
          <button type="button" className="btn-secondary px-2.5 py-1.5 text-xs" onClick={submit} disabled={create.isPending}>
            {create.isPending ? <Spinner className="size-3.5" /> : 'Add'}
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={() => setAdding(true)}
          className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-dashed border-white/15 px-3 py-1.5 text-xs font-medium text-ink-400 hover:border-white/30 hover:text-ink-200"
        >
          <Plus className="size-3.5" /> New section
        </button>
      )}
    </div>
  );
}
