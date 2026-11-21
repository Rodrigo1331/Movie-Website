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

const mod = (a: number, n: number) => ((a % n) + n) % n;

/** Fisher–Yates shuffle (returns a new array). */
export function shuffle<T>(items: readonly T[], random: RandomInt = secureRandomInt): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = random(i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

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
 * The reel is always a window onto one fixed cyclic order (1, 2, 3, 1, 2, 3…).
 * `start` is the position in `order` of the reel's first item.
 */
export function cycleReel<T>(order: readonly T[], start: number, length: number): T[] {
  if (order.length === 0) return [];
  return Array.from({ length }, (_, i) => order[mod(start + i, order.length)]!);
}

/**
 * Plans a spin that continues the cycle from the item currently centred (`currentPos`) and lands on
 * `winnerPos`, travelling at least `minSpin` items. The new reel keeps `pad` items before the centre,
 * so the first frame of the spin looks identical to what is on screen.
 */
export function planSpin(
  orderLength: number,
  currentPos: number,
  winnerPos: number,
  { pad = 6, minSpin = 30, tail = 7 }: { pad?: number; minSpin?: number; tail?: number } = {},
) {
  if (orderLength <= 0) throw new RangeError('orderLength must be positive');
  const distance = mod(winnerPos - currentPos, orderLength);
  const laps = Math.max(0, Math.ceil((minSpin - distance) / orderLength));
  const winnerIndex = pad + distance + laps * orderLength;
  return { start: mod(currentPos - pad, orderLength), centreIndex: pad, winnerIndex, length: winnerIndex + tail + 1 };
}

/** Horizontal translation that centres reel item `index` in a viewport of `viewportWidth`. */
export const offsetFor = (index: number, step: number, itemWidth: number, viewportWidth: number, jitter = 0) =>
  index * step + itemWidth / 2 - viewportWidth / 2 + jitter;
