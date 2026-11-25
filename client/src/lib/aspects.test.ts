import assert from 'node:assert/strict';
import { test } from 'node:test';
import { aspectAverage, hasAspectRatings, overallFromAspects, roundUpToHalf } from './aspects.ts';

test('aspectAverage averages only the rated aspects', () => {
  assert.equal(aspectAverage({}), null);
  assert.equal(aspectAverage({ story: 8 }), 8);
  assert.equal(aspectAverage({ story: 8, acting: 9, soundtrack: 7.5 }), 8.2);
  assert.equal(aspectAverage({ story: 0 }), 0);
  assert.equal(hasAspectRatings({}), false);
  assert.equal(hasAspectRatings({ enjoyment: 0 }), true);
});

test('roundUpToHalf always rounds up to the next 0.5', () => {
  assert.equal(roundUpToHalf(9.1), 9.5);
  assert.equal(roundUpToHalf(9.6), 10);
  assert.equal(roundUpToHalf(9), 9);
  assert.equal(roundUpToHalf(9.5), 9.5);
  assert.equal(roundUpToHalf(0.01), 0.5);
  assert.equal(roundUpToHalf(10), 10);
});

test('overallFromAspects uses the exact mean, not the rounded display value', () => {
  assert.equal(overallFromAspects({}), null);
  assert.equal(overallFromAspects({ story: 8.2, acting: 8.8 }), 8.5); // mean is exactly 8.5
  assert.equal(overallFromAspects({ story: 9, acting: 9, soundtrack: 9.1 }), 9.5); // mean 9.033…
  assert.equal(overallFromAspects({ story: 7, enjoyment: 8 }), 7.5);
});
