import assert from 'node:assert/strict';
import { test } from 'node:test';
import { aspectAverage, hasAspectRatings } from './aspects.ts';

test('aspectAverage averages only the rated aspects', () => {
  assert.equal(aspectAverage({}), null);
  assert.equal(aspectAverage({ story: 8 }), 8);
  assert.equal(aspectAverage({ story: 8, acting: 9, soundtrack: 7.5 }), 8.2);
  assert.equal(aspectAverage({ story: 0 }), 0);
  assert.equal(hasAspectRatings({}), false);
  assert.equal(hasAspectRatings({ enjoyment: 0 }), true);
});
