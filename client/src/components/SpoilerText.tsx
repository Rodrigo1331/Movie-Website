import { useMemo, useState } from 'react';
import { cx } from '../lib/format';
import { parseSpoilers } from '../lib/spoilers';

/** Renders review text with `||spoilers||` hidden until clicked. */
export function SpoilerText({ text, revealAll = false, className }: { text: string; revealAll?: boolean; className?: string }) {
  const segments = useMemo(() => parseSpoilers(text), [text]);
  return (
    <p className={cx('whitespace-pre-wrap', className)}>
      {segments.map((s, i) => (s.type === 'text' ? <span key={i}>{s.value}</span> : <Spoiler key={i} value={s.value} forceOpen={revealAll} />))}
    </p>
  );
}

function Spoiler({ value, forceOpen }: { value: string; forceOpen: boolean }) {
  const [open, setOpen] = useState(false);
  const revealed = open || forceOpen;

  if (revealed) {
    return (
      <span
        className="animate-fade-in rounded bg-amber-400/10 box-decoration-clone px-0.5 text-amber-100 ring-1 ring-amber-400/15"
        title="Spoiler"
      >
        {value}
      </span>
    );
  }
  const reveal = (e: React.SyntheticEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setOpen(true);
  };

  // A <span role="button"> rather than <button>: browsers render buttons as unbreakable boxes,
  // which would push long spoilers onto their own line instead of flowing with the sentence.
  return (
    <span
      role="button"
      tabIndex={0}
      onClick={reveal}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && reveal(e)}
      aria-label="Hidden spoiler — click to reveal"
      title="Click to reveal spoiler"
      className="cursor-pointer rounded bg-ink-600 box-decoration-clone px-0.5 text-transparent transition-colors select-none hover:bg-ink-500"
    >
      <span aria-hidden>{value}</span>
    </span>
  );
}
