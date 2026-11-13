// Checks words.json, the list of Mot du jour, and that settings.yml carries the same list.
// Run: node --test plugins/mot-du-jour/test/
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');
const { staticDataLine, readWords, settingsPath } = require('../sync-words.cjs');

const words = readWords();
const entries = Object.values(words.seasons).flat();

test('each season has a reserve of words', () => {
  assert.deepEqual(Object.keys(words.seasons).sort(), ['autumn', 'spring', 'summer', 'winter']);
  for (const [season, reserve] of Object.entries(words.seasons)) {
    assert.ok(reserve.length > 0, `${season} is empty`);
  }
});

test('each entry has its word, article, syllables, picture, definition and example', () => {
  for (const entry of entries) {
    assert.deepEqual(Object.keys(entry).sort(), ['article', 'definition', 'example', 'picto', 'syllables', 'word'], entry.word);
    assert.ok(['un', 'une', 'le', 'la'].includes(entry.article), `${entry.word}: article ${entry.article}`);
    assert.ok(Number.isInteger(entry.picto) && entry.picto > 0, `${entry.word}: ARASAAC id ${entry.picto}`);
    assert.match(entry.definition, /^\p{Lu}.*\.$/u, `${entry.word}: the definition is one sentence`);
    assert.match(entry.example, /^\p{Lu}.*[.!?]$/u, `${entry.word}: the example is one sentence`);
  }
});

test('the syllables spell the word', () => {
  for (const { word, syllables } of entries) {
    assert.equal(syllables.join(''), word.replace(/[ -]/g, ''), word);
  }
});

test('no word shows twice', () => {
  const seen = entries.map(e => e.word);
  assert.deepEqual(seen, [...new Set(seen)]);
});

test('settings.yml carries words.json (run sync-words.cjs after an edit)', () => {
  const settings = fs.readFileSync(settingsPath, 'utf8');
  assert.ok(settings.includes(`${staticDataLine(words)}\n`), 'static_data differs from words.json');
});
