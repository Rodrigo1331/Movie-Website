import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildReel, offsetFor, pickWinner, secureRandomInt } from './roulette.ts';

const pool = [1, 2, 3, 4, 5].map((id) => ({ id }));

test('secureRandomInt stays in range and covers every value', () => {
  const counts = new Array(5).fill(0);
  for (let i = 0; i < 5000; i++) {
    const n = secureRandomInt(5);
    assert.ok(Number.isInteger(n) && n >= 0 && n < 5);
    counts[n]++;
  }
  // Each bucket should be roughly 1000; a very loose bound keeps the test stable.
  assert.ok(counts.every((c) => c > 700 && c < 1300), `uneven distribution: ${counts}`);
  assert.throws(() => secureRandomInt(0));
});

test('pickWinner never repeats until the pool is exhausted, then cycles', () => {
  let seen = new Set<number>();
  const picked: number[] = [];
  for (let i = 0; i < pool.length; i++) {
    const r = pickWinner(pool, seen);
    assert.equal(r.cycled, false);
    picked.push(r.winner.id);
    seen = r.seen;
  }
  assert.deepEqual([...picked].sort(), [1, 2, 3, 4, 5]);

  const next = pickWinner(pool, seen);
  assert.equal(next.cycled, true);
  assert.deepEqual([...next.seen], [next.winner.id]);
  assert.throws(() => pickWinner([], new Set()));
});

test('pickWinner uses the injected random source', () => {
  assert.equal(pickWinner(pool, new Set([1]), () => 0).winner.id, 2);
});

test('buildReel places the winner exactly and keeps the prefix', () => {
  const winner = pool[2]!;
  const prefix = [pool[0]!, pool[1]!];
  const { reel, winnerIndex } = buildReel(pool, winner, { prefix, length: 30 });
  assert.equal(reel.length, 30);
  assert.equal(winnerIndex, 24);
  assert.equal(reel[winnerIndex], winner);
  assert.deepEqual(reel.slice(0, 2), prefix);
  assert.notEqual(reel[winnerIndex - 1]!.id, winner.id);
  assert.notEqual(reel[winnerIndex + 1]!.id, winner.id);
  assert.equal(reel.filter((m) => m.id === winner.id).length, 1);
});

test('buildReel works with a single-movie pool', () => {
  const only = { id: 9 };
  const { reel, winnerIndex } = buildReel([only], only, { length: 10 });
  assert.equal(reel.length, 10);
  assert.equal(reel[winnerIndex], only);
  assert.throws(() => buildReel(pool, pool[0]!, { prefix: pool, winnerIndex: 2 }));
});

test('offsetFor centres the requested item', () => {
  // item 10 with step 152 and width 140 in an 800px viewport
  assert.equal(offsetFor(10, 152, 140, 800), 10 * 152 + 70 - 400);
  assert.equal(offsetFor(0, 152, 140, 140), 0);
});
