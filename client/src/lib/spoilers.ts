/**
 * Inline spoiler markup: text wrapped in double bars — `||like this||` — is a spoiler.
 * Spoilers may span multiple lines. An unclosed `||` is kept as literal text.
 */
export type SpoilerSegment = { type: 'text' | 'spoiler'; value: string };

const SPOILER_RE = /\|\|([\s\S]+?)\|\|/g;

export function parseSpoilers(text: string): SpoilerSegment[] {
  const segments: SpoilerSegment[] = [];
  let last = 0;
  for (const match of text.matchAll(SPOILER_RE)) {
    const start = match.index;
    if (start > last) segments.push({ type: 'text', value: text.slice(last, start) });
    segments.push({ type: 'spoiler', value: match[1]! });
    last = start + match[0].length;
  }
  if (last < text.length) segments.push({ type: 'text', value: text.slice(last) });
  return segments;
}

export const hasSpoilers = (text: string) => parseSpoilers(text).some((s) => s.type === 'spoiler');

/** Plain text with every spoiler replaced, for places that can't render interactive spoilers. */
export const stripSpoilers = (text: string, placeholder = '[spoiler]') =>
  parseSpoilers(text)
    .map((s) => (s.type === 'spoiler' ? placeholder : s.value))
    .join('');

/** Wraps the selected range in spoiler bars; returns the new text and the range of the inner text. */
export function wrapSpoiler(text: string, start: number, end: number, fallback = 'spoiler') {
  const inner = text.slice(start, end) || fallback;
  return {
    text: `${text.slice(0, start)}||${inner}||${text.slice(end)}`,
    selectionStart: start + 2,
    selectionEnd: start + 2 + inner.length,
  };
}
