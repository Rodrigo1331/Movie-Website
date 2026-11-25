import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ComparisonPoint } from '@moviesite/shared';
import { agreementLabel, axisDomain, criticsLikedMore, formatGap, lovedMoreThanImdb } from './comparison.ts';

const p = (title: string, mine: number, imdb: number | null, critics: number | null): ComparisonPoint => ({
  id: title.length,
  title,
  releaseYear: null,
  posterUrl: null,
  mine,
  imdb,
  critics,
});

test('formatGap signs and rounds', () => {
  assert.equal(formatGap(1.26), '+1.3');
  assert.equal(formatGap(-0.44), '−0.4');
  assert.equal(formatGap(0.04), '±0');
});

test('agreementLabel buckets correlations', () => {
  assert.equal(agreementLabel(null), 'Rate a few more films to see');
  assert.equal(agreementLabel(0.85), 'Very similar taste');
  assert.equal(agreementLabel(0), 'Independent taste');
  assert.equal(agreementLabel(-0.5), 'Contrarian taste');
});

test('gap lists pick the biggest differences in the right direction', () => {
  const points = [p('A', 9, 7, 9.5), p('B', 6, 8, 9), p('C', 8, 7.8, null), p('D', 9.5, 6.5, 5), p('E', 7, null, 8)];
  assert.deepEqual(lovedMoreThanImdb(points).map((g) => [g.title, g.gap]), [['D', 3], ['A', 2]]);
  assert.deepEqual(criticsLikedMore(points).map((g) => [g.title, g.gap]), [['B', 3], ['E', 1], ['A', 0.5]]);
});

test('axisDomain pads to at least four points and stays within 0–10', () => {
  assert.deepEqual(axisDomain([]), [0, 10]);
  assert.deepEqual(axisDomain([7.2, 8.4]), [6, 10]);
  assert.deepEqual(axisDomain([9.5, 10]), [6, 10]);
  assert.deepEqual(axisDomain([0.5, 1]), [0, 4]);
  assert.deepEqual(axisDomain([3.2, 9.1]), [3, 10]);
});
