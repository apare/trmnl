const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const root = path.join(__dirname, '..');
const context = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(root, 'src/transform.js'), 'utf8'), context);
const run = input => JSON.parse(JSON.stringify(context.run(input)));
const sample = name => JSON.parse(fs.readFileSync(path.join(root, 'samples', name + '.json'), 'utf8'));
const layers = html => [...html.matchAll(/\/images\/(mannequin\/[^" ]+)\.png/g)].map(m => m[1]);
const figures = html => [...html.matchAll(/<div class="mq"[^>]*>(.*?)<\/div>/gs)].map(m => layers(m[1]));

const labels = html => [...html.matchAll(/<text[^>]*>(.*?)<\/text>/g)].map(m => m[1].replace(/<[^>]+>/g, ' ').replace(/ +/g, ' ').trim());

test('D keeps covered shirts and pants hidden, rain hood in front, base clothes visible', () => {
  const winter = figures(run(sample('grand-froid')).dashboard.kids);
  assert.equal(winter.length, 2);
  assert(winter[0].includes('mannequin/chandail') && winter[0].includes('mannequin/pantalon'));
  const outside = winter.at(-1);
  for (const key of ['manches', 'pantalon', 'chandail']) assert(!outside.includes('mannequin/' + key));
  assert(outside.indexOf('mannequin/neige') < outside.indexOf('mannequin/bottesHiver'));
  assert(outside.indexOf('mannequin/hiver') < outside.indexOf('mannequin/cachecou'));
  const rain = figures(run(sample('pluie')).dashboard.kids).at(-1);
  assert(rain.indexOf('mannequin/tete-courte') < rain.indexOf('mannequin/impermeable-capuchon-devant'));
  assert(!rain.includes('mannequin/cheveux-longs-derriere'));
});

test('D requests only the 84 approved immutable images across twelve months, snow and rain', () => {
  const available = new Set(['mannequin', 'scene', 'icones'].flatMap(dir =>
    fs.readdirSync(path.join(root, 'images', dir)).map(name => dir + '/' + name)));
  assert.equal(available.size, 84);
  for (let month = 1; month <= 12; month++) {
    for (const name of ['canicule', 'pluie', 'neige', 'grand-froid', 'doux-venteux', 'neige-au-sol']) {
      const input = sample(name);
      input.hourly.time = input.hourly.time.map(t => '2026-' + String(month).padStart(2, '0') + '-12' + t.slice(10));
      const result = run(input).dashboard;
      const html = result.scene + result.kids + result.cards + result.chart;
      assert(!html.includes('undefined') && !html.includes('NaN'), name + ': invalid render');
      for (const match of html.matchAll(/(?:src|href)="(https:[^"]+)"/g)) {
        const url = new URL(match[1]);
        assert.equal(url.hostname, 'raw.githubusercontent.com');
        assert.match(url.pathname, /^\/apare\/trmnl\/[a-f0-9]{40}\/plugins\/how-to-dress\/images\//);
        assert(available.has(url.pathname.split('/images/')[1]), url.pathname);
      }
      assert(result.sceneLayers.includes('scene/mois-' + String(month).padStart(2, '0') +
        (['neige', 'grand-froid', 'neige-au-sol'].includes(name) && [1, 2, 3, 4, 10, 11, 12].includes(month) ? '-neige' : '')));
      assert.equal(figures(result.kids).length, 2, name + ': two kids');
    }
  }
});

test('D names each kid\u{2019}s clothes beside it, with a line to the piece', () => {
  const winter = run(sample('grand-froid')).dashboard.kids;
  const places = ['Int\u{e9}rieur', 'Ext\u{e9}rieur'];
  assert.deepEqual(labels(winter).filter(t => places.includes(t)).sort(), places.sort());
  assert.deepEqual(labels(winter).filter(t => !places.includes(t)).sort(), ['bottes d\'hiver', 'cache-cou', 'chandail', 'manches longues', 'manteau d\'hiver',
    'mitaines', 'pantalon', 'pantalon de neige', 'tuque'].sort());
  assert.equal((winter.match(/<circle/g) || []).length, 9);
  const summer = labels(run(sample('canicule')).dashboard.kids);
  assert(summer.includes('crème solaire') && summer.includes('robe') && summer.includes('souliers'));
  assert(!summer.includes('t-shirt short'));
});

test('D uses actual local sunrise, sunset and cloud cover, including the morning night icon', () => {
  const input = sample('canicule');
  input.daily = { sunrise: [input.hourly.time[0].slice(0, 10) + 'T09:00'], sunset: [input.hourly.time[0].slice(0, 10) + 'T16:12'] };
  input.hourly.cloud_cover = input.hourly.time.map(() => 0);
  let dashboard = run(input).dashboard;
  assert.deepEqual(dashboard.sun, { rise: 540, set: 972 });
  assert.match(dashboard.cards, /meteo-lune\.png/);
  assert(dashboard.cards.includes('7\u{a0}h\u{a0}12 de clarté'));
  input.hourly.cloud_cover.fill(100);
  dashboard = run(input).dashboard;
  assert(dashboard.sceneLayers.includes('scene/ciel-couvert'));
  assert.match(dashboard.cards, /meteo-nuage\.png/);
});

test('D shows one pill per hour over 24 hours, with a sky icon only when the sky changes', () => {
  const input = sample('canicule');
  input.hourly.cloud_cover = input.hourly.time.map(() => 0);
  const icons = chart => [...chart.matchAll(/icones\/(meteo-[a-z-]+)\.png/g)].map(m => m[1]);
  const clear = run(input).dashboard.chart;
  assert.deepEqual(labels(clear).filter(t => / h$/.test(t)), Array.from({ length: 24 }, (_, h) => h + ' h'));
  assert.equal((clear.match(/fill="url\(#htd-dots\)"/g) || []).length, 24);
  assert.deepEqual(icons(clear), ['meteo-lune', 'meteo-soleil', 'meteo-lune']);
  for (const hour of ['T10:00', 'T11:00']) {
    const i = input.hourly.time.findIndex(t => t.endsWith(hour));
    input.hourly.precipitation_probability[i] = 100;
    input.hourly.weather_code[i] = 63;
  }
  assert.deepEqual(icons(run(input).dashboard.chart), ['meteo-lune', 'meteo-soleil', 'meteo-pluie', 'meteo-soleil', 'meteo-lune']);
});

test('D pills run from the lower to the higher of the temperature and the feels-like', () => {
  const input = sample('grand-froid');
  const i = input.hourly.time.findIndex(t => t.endsWith('T00:00'));
  input.hourly.temperature_2m[i] = -12.2;
  input.hourly.apparent_temperature[i] = -19.6;
  const texts = labels(run(input).dashboard.chart);
  assert.deepEqual(texts.slice(0, 2), ['\u{2212}12°', '\u{2212}20°']);
});

test('D moon phase, sun and chart do not depend on the runtime clock', () => {
  const input = sample('neige');
  const first = run(input).dashboard;
  const other = vm.createContext({ Date: class extends Date { static now() { return 0; } } });
  vm.runInContext(fs.readFileSync(path.join(root, 'src/transform.js'), 'utf8'), other);
  assert.deepEqual(JSON.parse(JSON.stringify(other.run(input))).dashboard, first);
  assert(first.moon.idx >= 0 && first.moon.idx < 8);
  const settings = fs.readFileSync(path.join(root, 'src/settings.yml'), 'utf8');
  assert.match(settings, /uv_index,cloud_cover&daily=sunrise,sunset/);
  assert.match(settings, /^id: 538569$/m);
});
