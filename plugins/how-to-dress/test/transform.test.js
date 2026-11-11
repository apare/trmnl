// Checks the How to dress rules (ticket 03) against the sample days in samples/.
// Run: node --test plugins/how-to-dress/test/
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const root = path.join(__dirname, '..');

// TRMNL runs transform.js as a plain script and calls its top-level run(); do the same.
function loadRun() {
  const context = vm.createContext({});
  vm.runInContext(fs.readFileSync(path.join(root, 'src/transform.js'), 'utf8'), context);
  return input => JSON.parse(JSON.stringify(vm.runInContext('run', context)(input)));
}
const run = loadRun();
const sample = name => JSON.parse(fs.readFileSync(path.join(root, 'samples', `${name}.json`), 'utf8'));
const titles = result => result.stages.map(s => s.title);

test('grand froid: everything for −25 °C, a sweater under the winter coat', () => {
  const r = run(sample('grand-froid'));
  assert.deepEqual(r.outfit, {
    top: 'manches', bottom: 'pantalon', legs: null, warm: 'chandail', coat: 'hiver', pants: 'neige',
    head: 'tuque', hands: 'mitaines', neck: 'cachecou', feet: 'bottesHiver', extra: null,
  });
  assert.equal(r.alt, null);
  assert.deepEqual(titles(r), ['En dessous', 'Le chandail', 'Pour sortir']);
  assert.match(r.friendly, /froid|pingouins/i);
  assert.equal(r.sentence, 'Ce matin\u{a0}: \u{2212}23\u{a0}°C (ressenti \u{2212}31). Cet après-midi\u{a0}: \u{2212}18\u{a0}°C (ressenti \u{2212}26). Pas de pluie ni de neige.');
  assert.equal(r.date, 'mercredi 20 janvier');
});

test('neige: snow hours set the friendly line, the sentence and the chart marks', () => {
  const r = run(sample('neige'));
  assert.equal(r.outfit.pants, 'neige');
  assert.equal(r.outfit.feet, 'bottesHiver');
  assert.equal(r.outfit.warm, 'chandail'); // coldest feels-like below −10
  assert.match(r.friendly, /neige|flocon/i);
  assert.match(r.sentence, /Neige vers 10\xa0h\./);
  assert.deepEqual(r.chart.filter(h => h.wet).map(h => [h.hour, h.wet]), [[10, 'snow'], [11, 'snow'], [12, 'snow']]);
});

test('neige au sol: snow pants and winter boots on a +2 °C day', () => {
  const r = run(sample('neige-au-sol'));
  assert.equal(r.outfit.coat, 'misaison');
  assert.equal(r.outfit.hands, 'gants');
  assert.equal(r.outfit.pants, 'neige');
  assert.equal(r.outfit.feet, 'bottesHiver');
  assert.match(r.sentence, /Pas de pluie ni de neige\.$/);
});

test('pluie: rain gear, and the Girls\u{2019} alternative beside the first mannequin', () => {
  const r = run(sample('pluie'));
  assert.equal(r.outfit.coat, 'impermeable');
  assert.equal(r.outfit.pants, 'pluie');
  assert.equal(r.outfit.feet, 'bottesPluie');
  assert.deepEqual(r.alt, ['jupe', 'collants']);
  assert.match(r.friendly, /pluie|pleut|flaques|imperméable/i);
  assert.match(r.sentence, /Pluie vers 14\xa0h\./);
  const [first, ...rest] = r.stages;
  assert.equal(first.alt.added, 'jupe · collants');
  assert.deepEqual(first.alt.pieces.map(p => p.key), ['collants', 'jupe', 'manches']);
  assert(rest.every(s => !s.alt));
});

test('doux et venteux: no Layer gives one "Aujourd\u{2019}hui" mannequin, strong wind is said', () => {
  const r = run(sample('doux-venteux'));
  assert.equal(r.outfit.top, 'tshirt');
  assert.equal(r.outfit.bottom, 'pantalon');
  assert.deepEqual(titles(r), ['Aujourd\u{2019}hui']);
  assert.equal(r.stages[0].number, null);
  assert.match(r.sentence, /Beaucoup de vent\.$/);
});

test('canicule: short, sunscreen and a cap; the dress replaces top and bottom', () => {
  const r = run(sample('canicule'));
  assert.equal(r.outfit.top, 'tshirt');
  assert.equal(r.outfit.bottom, 'short');
  assert.equal(r.outfit.head, 'casquette');
  assert.equal(r.outfit.extra, 'creme');
  assert.deepEqual(r.alt, ['robe']);
  assert.match(r.friendly, /chaud|chaleur/i);
  const [only] = r.stages;
  assert.deepEqual(only.extra, { key: 'creme', label: 'crème solaire' });
  assert(!only.alt.pieces.some(p => p.key === 'short' || p.key === 'tshirt'));
  assert(only.alt.pieces.some(p => p.key === 'robe'));
});

test('a likely-wet hour with no precipitation code is rain above 0 °C', () => {
  const day = sample('doux-venteux');
  day.hourly.precipitation_probability[9] = 60;
  const r = run(day);
  assert.equal(r.outfit.coat, 'impermeable');
  assert.deepEqual(titles(r), ['En dessous', 'Pour sortir']);
});

test('the chart spans the day: its tallest bar is the max, its shortest the min', () => {
  const r = run(sample('pluie'));
  assert.deepEqual(r.chart.map(h => h.hour), [8, 9, 10, 11, 12, 13, 14, 15, 16, 17]);
  assert.equal(Math.max(...r.chart.map(h => h.height)), 100);
  assert.equal(Math.min(...r.chart.map(h => h.height)), 15);
});

test('no weather gives a message instead of an Outfit', () => {
  assert.deepEqual(run({ trmnl: {} }), { error: 'Pas de météo pour le moment.' });
});

test('every piece the transform can draw has an icon in shared.liquid', () => {
  const shared = fs.readFileSync(path.join(root, 'src/shared.liquid'), 'utf8');
  const icons = new Set([...shared.matchAll(/\{% when '([a-zA-Z]+)' %\}/g)].map(m => m[1]));
  const keys = new Set();
  for (const name of fs.readdirSync(path.join(root, 'samples')).filter(f => f.endsWith('.json'))) {
    const r = run(sample(name.replace('.json', '')));
    r.stages.forEach(s => {
      s.pieces.forEach(p => keys.add(p.key));
      if (s.alt) s.alt.pieces.forEach(p => keys.add(p.key));
      if (s.extra) keys.add(s.extra.key);
    });
  }
  for (const key of keys) assert(icons.has(key), `no icon for ${key}`);
});
