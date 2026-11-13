// Checks words.json, the list Mot du jour polls from this repo's main branch.
// Run: node --test plugins/mot-du-jour/test/
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const words = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'words.json'), 'utf8'));
const entries = Object.values(words.months).flat();

// The Liquid looks the month up by its French name, as l_date writes it.
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

test('each month has its reserve of 10 words', () => {
  assert.deepEqual(Object.keys(words.months), MONTHS);
  for (const [month, reserve] of Object.entries(words.months)) {
    assert.equal(reserve.length, 10, month);
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
