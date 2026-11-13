// Checks which bin Collectes says to put out, and when.
// Run: node --test plugins/collectes/test/
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const source = fs.readFileSync(path.join(__dirname, '..', 'src/transform.js'), 'utf8');

// TRMNL runs transform.js as a plain script and calls its top-level run(); do the same,
// with the clock fixed at `utcIso`.
function runAt(utcIso, input) {
  const context = vm.createContext({});
  vm.runInContext(source, context);
  vm.runInContext(`Date.now = () => ${Date.parse(utcIso)}`, context);
  return JSON.parse(JSON.stringify(vm.runInContext('run', context)(input)));
}

// The house schedule: garbage every other Thursday from 12 November 2026, recycling the other Thursdays.
const HOUSE = {
  ordures_date: '2026-11-12', ordures_frequence: 'deux_semaines',
  recyclage_date: '2026-11-19', recyclage_frequence: 'deux_semaines',
};
const MONTREAL = -18000; // utc_offset in November (EST)

// Runs at a Montréal local time, 'YYYY-MM-DDTHH:MM'.
const at = (local, values = HOUSE, offset = MONTREAL) =>
  runAt(new Date(Date.parse(`${local}:00Z`) - offset * 1000).toISOString(), {
    trmnl: { user: { utc_offset: offset }, plugin_settings: { custom_fields_values: values } },
  });
const keys = r => r.matieres.map(m => m.key);

test('Wednesday 18 November evening: put the recycling out', () => {
  const r = at('2026-11-18T20:00');
  assert.equal(r.sortir, true);
  assert.deepEqual(keys(r), ['recyclage']);
  assert.equal(r.texte, 'Sors le recyclage\u{a0}!');
  assert.equal(r.collecte, '2026-11-19');
  assert.match(r.matieres[0].svg, /^<svg class="col-bin"/);
});

test('Wednesday 25 November evening: put the garbage out', () => {
  const r = at('2026-11-25T20:00');
  assert.equal(r.sortir, true);
  assert.deepEqual(keys(r), ['ordures']);
  assert.equal(r.texte, 'Sors les poubelles\u{a0}!');
});

test('the eve switches at 15 h', () => {
  assert.equal(at('2026-11-25T14:59').sortir, false);
  assert.equal(at('2026-11-25T15:00').sortir, true);
});

test('Thursday morning before 8 h still says to put it out, then moves to next week', () => {
  const morning = at('2026-11-26T07:30');
  assert.equal(morning.sortir, true);
  assert.deepEqual(keys(morning), ['ordures']);
  const later = at('2026-11-26T08:00');
  assert.equal(later.sortir, false);
  assert.deepEqual(keys(later), ['recyclage']);
  assert.equal(later.collecte, '2026-12-03');
});

test('a quiet Friday shows the next bin without the order', () => {
  const r = at('2026-11-13T10:00');
  assert.equal(r.sortir, false);
  assert.deepEqual(keys(r), ['recyclage']);
  assert.equal(r.collecte, '2026-11-19');
  assert.doesNotMatch(r.matieres[0].svg, /fill="#555"/); // drawn pale
});

test('the alternation holds before the first date and months later', () => {
  assert.equal(at('2026-11-04T20:00').collecte, '2026-11-05');
  assert.deepEqual(keys(at('2026-11-04T20:00')), ['recyclage']);
  assert.deepEqual(keys(at('2027-03-03T20:00')), ['ordures']); // 4 March 2027 is 16 weeks after 12 November
});

test('two bins the same day are named together', () => {
  const r = at('2026-11-18T20:00', { ...HOUSE, ordures_frequence: 'semaine', ordures_date: '2026-11-19' });
  assert.deepEqual(keys(r), ['ordures', 'recyclage']);
  assert.equal(r.texte, 'Sors les poubelles et le recyclage\u{a0}!');
});

test('"Pas de collecte" and an empty date leave a Matière out', () => {
  const r = at('2026-11-18T20:00', { ...HOUSE, recyclage_frequence: 'aucune' });
  assert.deepEqual(keys(r), ['ordures']);
  assert.equal(r.collecte, '2026-11-26');
  const none = at('2026-11-18T20:00', {});
  assert.deepEqual(none, { sortir: false, matieres: [], texte: '', collecte: null });
});

test('the local date comes from utc_offset, not the runtime time zone', () => {
  // 01:00 UTC Thursday is still Wednesday 20:00 in Montréal.
  const r = runAt('2026-11-19T01:00:00Z', {
    trmnl: { user: { utc_offset: MONTREAL }, plugin_settings: { custom_fields_values: HOUSE } },
  });
  assert.equal(r.sortir, true);
  assert.equal(r.collecte, '2026-11-19');
});
