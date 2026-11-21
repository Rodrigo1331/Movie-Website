import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cycleReel, offsetFor, pickWinner, planSpin, secureRandomInt, shuffle } from './roulette.ts';

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

test('shuffle keeps every item exactly once', () => {
  const s = shuffle(pool);
  assert.equal(s.length, pool.length);
  assert.deepEqual(s.map((m) => m.id).sort(), [1, 2, 3, 4, 5]);
  assert.notEqual(s, pool);
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

test('cycleReel repeats films in a fixed order', () => {
  assert.deepEqual(cycleReel([1, 2, 3], 0, 7), [1, 2, 3, 1, 2, 3, 1]);
  assert.deepEqual(cycleReel([1, 2, 3], 2, 5), [3, 1, 2, 3, 1]);
  assert.deepEqual(cycleReel([1, 2, 3], -1, 4), [3, 1, 2, 3]);
  assert.deepEqual(cycleReel([], 0, 4), []);
});

test('planSpin continues the cycle seamlessly and lands on the winner', () => {
  const order = ['a', 'b', 'c', 'd'];
  for (let current = 0; current < order.length; current++) {
    for (let winner = 0; winner < order.length; winner++) {
      const plan = planSpin(order.length, current, winner, { pad: 6, minSpin: 30 });
      const reel = cycleReel(order, plan.start, plan.length);
      assert.equal(reel[plan.centreIndex], order[current], 'first frame matches what was on screen');
      assert.equal(reel[plan.winnerIndex], order[winner], 'lands on the winner');
      assert.ok(plan.winnerIndex - plan.centreIndex >= 30, 'travels at least minSpin items');
      assert.ok(plan.winnerIndex - plan.centreIndex < 30 + order.length, 'no unnecessary extra laps');
      assert.equal(plan.length, plan.winnerIndex + 8, 'tail after the winner');
      // Adjacent items always follow the fixed order
      for (let i = 1; i < reel.length; i++) {
        assert.equal(order.indexOf(reel[i]!), (order.indexOf(reel[i - 1]!) + 1) % order.length);
      }
    }
  }
});

test('planSpin handles pools larger than the minimum spin', () => {
  const plan = planSpin(100, 10, 5, { minSpin: 30 });
  assert.equal(plan.winnerIndex - plan.centreIndex, 95);
  const single = planSpin(1, 0, 0, { minSpin: 30 });
  assert.equal(single.winnerIndex - single.centreIndex, 30);
  assert.throws(() => planSpin(0, 0, 0));
});

test('offsetFor centres the requested item', () => {
  assert.equal(offsetFor(10, 152, 140, 800), 10 * 152 + 70 - 400);
  assert.equal(offsetFor(0, 152, 140, 140), 0);
});
