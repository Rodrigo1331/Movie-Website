/** Pure helpers for the movie roulette (randomness, fair picking, reel construction). */

export type RandomInt = (maxExclusive: number) => number;

/** Uniform random integer in [0, max) using the Web Crypto API, without modulo bias. */
export const secureRandomInt: RandomInt = (max) => {
  if (!Number.isInteger(max) || max <= 0) throw new RangeError('max must be a positive integer');
  const limit = Math.floor(0x1_0000_0000 / max) * max;
  const buf = new Uint32Array(1);
  let x: number;
  do {
    crypto.getRandomValues(buf);
    x = buf[0]!;
  } while (x >= limit);
  return x % max;
};

/**
 * Picks a winner from `pool`, skipping ids in `seen` (no-repeat mode).
 * When every item has already been seen, the cycle starts over.
 */
export function pickWinner<T extends { id: number }>(pool: T[], seen: ReadonlySet<number>, random: RandomInt = secureRandomInt) {
  if (pool.length === 0) throw new Error('Cannot pick from an empty pool');
  let candidates = pool.filter((m) => !seen.has(m.id));
  const cycled = candidates.length === 0;
  if (cycled) candidates = pool;
  const winner = candidates[random(candidates.length)]!;
  const nextSeen = new Set(cycled ? [] : seen);
  nextSeen.add(winner.id);
  return { winner, seen: nextSeen, cycled };
}

/**
 * Builds the reel strip: optional `prefix` (what is currently on screen, so the spin starts seamlessly),
 * random filler, the winner at `winnerIndex`, and a short tail so the strip never ends on screen.
 * Neighbours of the winner are never the winner itself (when the pool allows it), so the landing is unambiguous.
 */
export function buildReel<T extends { id: number }>(
  pool: T[],
  winner: T,
  options: { prefix?: T[]; length?: number; winnerIndex?: number; random?: RandomInt } = {},
) {
  const { prefix = [], length = 44, random = secureRandomInt } = options;
  const winnerIndex = options.winnerIndex ?? length - 6;
  if (winnerIndex < prefix.length || winnerIndex >= length) throw new RangeError('winnerIndex out of range');

  const others = pool.filter((m) => m.id !== winner.id);
  const filler = () => (others.length ? others : pool)[random((others.length ? others : pool).length)]!;

  const reel: T[] = [...prefix];
  while (reel.length < length) reel.push(reel.length === winnerIndex ? winner : filler());
  return { reel, winnerIndex };
}

/** Horizontal translation that centres reel item `index` in a viewport of `viewportWidth`. */
export const offsetFor = (index: number, step: number, itemWidth: number, viewportWidth: number, jitter = 0) =>
  index * step + itemWidth / 2 - viewportWidth / 2 + jitter;
