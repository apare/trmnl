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

// Silent letters, the ones that turn pale gray, are between parentheses.
const unmark = text => text.replace(/[()]/g, '');

test('each entry has its word, silent letters, article, syllables, picture, definition and example', () => {
  for (const entry of entries) {
    assert.deepEqual(Object.keys(entry).sort(), ['article', 'definition', 'example', 'picto', 'silent', 'syllables', 'word'], entry.word);
    assert.ok(['un', 'une', 'le', 'la'].includes(entry.article), `${entry.word}: article ${entry.article}`);
    assert.ok(Number.isInteger(entry.picto) && entry.picto > 0, `${entry.word}: ARASAAC id ${entry.picto}`);
    assert.match(entry.definition, /^\p{Lu}.*\.$/u, `${entry.word}: the definition is one sentence`);
    assert.match(entry.example, /^\p{Lu}.*[.!?]$/u, `${entry.word}: the example is one sentence`);
  }
});

test('the syllables spell the word', () => {
  for (const { word, syllables } of entries) {
    assert.equal(unmark(syllables.join('')), word.replace(/[ -]/g, ''), word);
  }
});

test('the silent letters spell the word, and the syllables mark the same ones', () => {
  for (const { word, silent, syllables } of entries) {
    assert.equal(unmark(silent), word, word);
    assert.match(silent, /^[^()]*(\([^()]+\)[^()]*)*$/u, `${word}: parentheses in pairs`);
    // The Liquid boxes a silent first letter (hibou) on its own: "(h)", one letter.
    if (silent.startsWith('(')) assert.match(silent, /^\(\p{L}\)/u, `${word}: one silent letter first`);
    // The syllables may close and reopen a group the word keeps whole, never mark other letters.
    const letters = text => [...text.replace(/[ -]/g, '')].reduce((acc, ch) => {
      if (ch === '(') acc.inside = true;
      else if (ch === ')') acc.inside = false;
      else acc.flags.push(acc.inside);
      return acc;
    }, { inside: false, flags: [] }).flags;
    assert.deepEqual(syllables.flatMap(s => letters(s)), letters(silent), `${word}: syllables ${syllables.join(' · ')}`);
  }
});

test('the example marks the word, once, between asterisks', () => {
  for (const { word, example } of entries) {
    const parts = example.split('*');
    assert.equal(parts.length, 3, `${word}: ${example}`);
    // The marked form is the word, its plural, or a plural inside it (vers de terre).
    const stem = word.split(' ')[0].toLowerCase();
    assert.ok(parts[1].toLowerCase().startsWith(stem), `${word}: marked « ${parts[1]} »`);
  }
});

test('no word shows twice', () => {
  const seen = entries.map(e => e.word);
  assert.deepEqual(seen, [...new Set(seen)]);
});
