// Picks the weather the trmnlp preview of How to dress shows.
//   node plugins/how-to-dress/samples/use.js pluie   one of the sample days here
//   node plugins/how-to-dress/samples/use.js live    today's Open-Meteo forecast
const fs = require('node:fs');
const path = require('node:path');

const name = process.argv[2];
const config = path.join(__dirname, '..', '.trmnlp.yml');
const samples = fs.readdirSync(__dirname).filter(f => f.endsWith('.json')).map(f => f.slice(0, -5));
if (!name || (name !== 'live' && !samples.includes(name))) {
  console.error(`usage: use.js <${[...samples, 'live'].join('|')}>`);
  process.exit(1);
}

// The sample's `hourly` replaces the polled one (trmnlp deep-merges `variables`).
const variables = name === 'live' ? {}
  : { hourly: JSON.parse(fs.readFileSync(path.join(__dirname, `${name}.json`), 'utf8')).hourly };
const text = fs.readFileSync(config, 'utf8')
  .replace(/^# sample: .*$/m, `# sample: ${name}`)
  .replace(/^variables: .*$/m, `variables: ${JSON.stringify(variables)}`);
fs.writeFileSync(config, text);
console.log(`Preview now shows: ${name}`);
