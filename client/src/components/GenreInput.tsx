import { useId, useState } from 'react';
import { X } from 'lucide-react';
import { useFacets } from '../api/hooks';

const COMMON_GENRES = [
  'Action', 'Adventure', 'Animation', 'Comedy', 'Crime', 'Documentary', 'Drama', 'Family', 'Fantasy', 'History',
  'Horror', 'Music', 'Mystery', 'Romance', 'Science Fiction', 'Thriller', 'War', 'Western',
];

/** Tag-style genre editor with suggestions from the library and common genres. */
export function GenreInput({ value, onChange }: { value: string[]; onChange: (genres: string[]) => void }) {
  const [text, setText] = useState('');
  const listId = useId();
  const { data } = useFacets();
  const suggestions = [...new Set([...(data?.genres.map((g) => g.name) ?? []), ...COMMON_GENRES])]
    .filter((g) => !value.some((v) => v.toLowerCase() === g.toLowerCase()))
    .sort();

  const add = (raw: string) => {
    const names = raw.split(',').map((s) => s.trim()).filter(Boolean);
    const next = [...value];
    for (const n of names) if (!next.some((v) => v.toLowerCase() === n.toLowerCase()) && next.length < 20) next.push(n);
    onChange(next);
    setText('');
  };

  return (
    <div className="field flex flex-wrap items-center gap-1.5 py-2">
      {value.map((g) => (
        <span key={g} className="inline-flex items-center gap-1 rounded-md bg-white/8 py-0.5 pr-1 pl-2 text-xs font-medium text-ink-100">
          {g}
          <button type="button" className="rounded p-0.5 text-ink-400 hover:bg-white/10 hover:text-white" onClick={() => onChange(value.filter((x) => x !== g))} aria-label={`Remove ${g}`}>
            <X className="size-3" />
          </button>
        </span>
      ))}
      <input
        list={listId}
        value={text}
        maxLength={50}
        onChange={(e) => {
          const v = e.target.value;
          // A datalist pick arrives as a replacement (no inputType in Chromium, insertReplacementText in Firefox)
          const inputType = (e.nativeEvent as InputEvent).inputType;
          const picked = !inputType || inputType === 'insertReplacementText';
          if (picked && suggestions.includes(v)) add(v);
          else setText(v);
        }}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ',') && text.trim()) {
            e.preventDefault();
            add(text);
          } else if (e.key === 'Backspace' && !text && value.length) {
            onChange(value.slice(0, -1));
          }
        }}
        onBlur={() => text.trim() && add(text)}
        placeholder={value.length ? 'Add genre…' : 'e.g. Drama, Thriller'}
        className="min-w-28 flex-1 bg-transparent py-0.5 text-sm outline-none placeholder:text-ink-500"
      />
      <datalist id={listId}>
        {suggestions.map((g) => (
          <option key={g} value={g} />
        ))}
      </datalist>
    </div>
  );
}
