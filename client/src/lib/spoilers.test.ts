import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hasSpoilers, parseSpoilers, stripSpoilers, wrapSpoiler } from './spoilers.ts';

test('plain text has no spoilers', () => {
  assert.deepEqual(parseSpoilers('Just great.'), [{ type: 'text', value: 'Just great.' }]);
  assert.equal(hasSpoilers('Just great.'), false);
  assert.deepEqual(parseSpoilers(''), []);
});

test('parses inline and multiple spoilers', () => {
  assert.deepEqual(parseSpoilers('Loved it. ||He dies.|| Wow ||twist||'), [
    { type: 'text', value: 'Loved it. ' },
    { type: 'spoiler', value: 'He dies.' },
    { type: 'text', value: ' Wow ' },
    { type: 'spoiler', value: 'twist' },
  ]);
});

test('spoilers can span lines', () => {
  assert.deepEqual(parseSpoilers('a ||line1\nline2|| b')[1], { type: 'spoiler', value: 'line1\nline2' });
});

test('unclosed or empty bars stay literal', () => {
  assert.deepEqual(parseSpoilers('this || that'), [{ type: 'text', value: 'this || that' }]);
  assert.equal(hasSpoilers('a |||| b'), false);
});

test('strips spoilers for previews', () => {
  assert.equal(stripSpoilers('Great. ||Ending is a dream.|| Go see it.'), 'Great. [spoiler] Go see it.');
  assert.equal(stripSpoilers('||all of it||', ''), '');
});

test('wraps a selection or inserts a placeholder', () => {
  assert.deepEqual(wrapSpoiler('The killer is Bob.', 14, 17), {
    text: 'The killer is ||Bob||.',
    selectionStart: 16,
    selectionEnd: 19,
  });
  assert.deepEqual(wrapSpoiler('Hi ', 3, 3), { text: 'Hi ||spoiler||', selectionStart: 5, selectionEnd: 12 });
});
