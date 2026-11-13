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
const kid = (result, place) => result.kids.find(k => k.place === place);
const keys = k => k.pieces.map(p => p.key);

test('grand froid: everything for −25 °C, a sweater under the winter coat', () => {
  const r = run(sample('grand-froid'));
  assert.deepEqual(r.outfit, {
    top: 'manches', bottom: 'pantalon', legs: null, warm: 'chandail', coat: 'hiver', pants: 'neige',
    head: 'tuque', hands: 'mitaines', neck: 'cachecou', feet: 'bottesHiver', extra: null,
  });
  assert.equal(r.alt, null);
  assert.deepEqual(keys(kid(r, 'inside')), ['bottom', 'top', 'warm'].map(s => r.outfit[s]));
  assert.equal(kid(r, 'outside').pieces.length, 9);
  assert.equal(r.sentence, 'Ce matin\u{a0}: \u{2212}23\u{a0}°C (ressenti \u{2212}31). Cet après-midi\u{a0}: \u{2212}18\u{a0}°C (ressenti \u{2212}26). Pas de pluie ni de neige.');
  assert.equal(r.date, 'mercredi 20 janvier');
});

test('neige: snow hours set the sentence and the chart marks', () => {
  const r = run(sample('neige'));
  assert.equal(r.outfit.pants, 'neige');
  assert.equal(r.outfit.feet, 'bottesHiver');
  assert.equal(r.outfit.warm, 'chandail'); // coldest feels-like below −10
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

test('pluie: rain gear, and the girl wears the Girls\u{2019} alternative', () => {
  const r = run(sample('pluie'));
  assert.equal(r.outfit.coat, 'impermeable');
  assert.equal(r.outfit.pants, 'pluie');
  assert.equal(r.outfit.feet, 'bottesPluie');
  assert.deepEqual(r.alt, ['jupe', 'collants']);
  assert.match(r.sentence, /Pluie vers 14\xa0h\./);
  const girl = r.kids.find(k => k.character === 'long');
  assert.equal(girl.place, 'inside'); // 21 avril: the girl stays in, the boy goes out
  assert.deepEqual(keys(girl), ['collants', 'jupe', 'manches', 'chandail']);
  assert(!keys(kid(r, 'outside')).includes('jupe'));
});

test('doux et venteux: no Layer still shows two kids, strong wind is said', () => {
  const r = run(sample('doux-venteux'));
  assert.equal(r.outfit.top, 'tshirt');
  assert.equal(r.outfit.bottom, 'pantalon');
  assert.deepEqual(r.kids.map(k => k.place), ['inside', 'outside']);
  assert(!keys(kid(r, 'inside')).includes('souliers'));
  assert(keys(kid(r, 'outside')).includes('souliers'));
  assert.match(r.sentence, /Beaucoup de vent\.$/);
});

test('canicule: short, sunscreen and a cap; the dress replaces top and bottom', () => {
  const r = run(sample('canicule'));
  assert.equal(r.outfit.top, 'tshirt');
  assert.equal(r.outfit.bottom, 'short');
  assert.equal(r.outfit.head, 'casquette');
  assert.equal(r.outfit.extra, 'creme');
  assert.deepEqual(r.alt, ['robe']);
  assert.equal(kid(r, 'outside').extra, 'creme');
  assert.equal(kid(r, 'inside').extra, undefined);
  const girl = r.kids.find(k => k.character === 'long');
  assert(!keys(girl).some(k => k === 'short' || k === 'tshirt'));
  assert(keys(girl).includes('robe'));
});

test('a likely-wet hour with no precipitation code is rain above 0 °C', () => {
  const day = sample('doux-venteux');
  day.hourly.precipitation_probability[9] = 60;
  const r = run(day);
  assert.equal(r.outfit.coat, 'impermeable');
  assert.equal(kid(r, 'inside').pieces.some(p => p.key === 'impermeable'), false);
});

test('the boy and the girl swap inside and outside from one day to the next', () => {
  const day = sample('pluie');
  const today = run(day).kids.map(k => k.place + ':' + k.character);
  day.hourly.time = day.hourly.time.map(t => t.replace('-21T', '-22T'));
  const tomorrow = run(day).kids.map(k => k.place + ':' + k.character);
  assert.deepEqual(today, ['inside:long', 'outside:short']);
  assert.deepEqual(tomorrow, ['inside:short', 'outside:long']);
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
    r.kids.forEach(k => {
      k.pieces.forEach(p => keys.add(p.key));
      if (k.extra) keys.add(k.extra);
    });
  }
  for (const key of keys) assert(icons.has(key), `no icon for ${key}`);
});
