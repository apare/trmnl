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
    assert.deepEqual(Object.keys(entry).sort(), ['article', 'definition', 'example', 'image', 'silent', 'syllables', 'word'], entry.word);
    assert.ok(['un', 'une', 'le', 'la'].includes(entry.article), `${entry.word}: article ${entry.article}`);
    assert.match(entry.image, /^images\/[a-z0-9-]+\.png$/, `${entry.word}: local image path`);
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

test('all 120 words have distinct transparent square PNGs in the repo', () => {
  const files = entries.map(entry => entry.image);
  assert.equal(new Set(files).size, 120);
  const available = fs.readdirSync(path.join(__dirname, '..', 'images')).filter(file => file.endsWith('.png'));
  assert.deepEqual(available.sort(), files.map(file => path.basename(file)).sort());
  for (const entry of entries) {
    const png = fs.readFileSync(path.join(__dirname, '..', entry.image));
    assert.deepEqual(png.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), entry.word);
    assert.equal(png.readUInt32BE(16), 1024, `${entry.word}: width`);
    assert.equal(png.readUInt32BE(20), 1024, `${entry.word}: height`);
    assert.equal(png[25], 6, `${entry.word}: RGBA PNG with alpha`);
  }
});

test('the Layout loads our images from an immutable image commit', () => {
  const liquid = fs.readFileSync(path.join(__dirname, '..', 'src', 'full.liquid'), 'utf8');
  assert.match(liquid, /assign image_base = "https:\/\/raw\.githubusercontent\.com\/apare\/trmnl\/[a-f0-9]{40}\/plugins\/mot-du-jour\/"/);
  assert.match(liquid, /src="{{ image_base }}{{ entry.image }}"/);
  assert(!liquid.includes('arasaac') && !liquid.includes('entry.picto'));
});
