// Copies words.json into the static_data of src/settings.yml, the data TRMNL hands to the markup.
//   node plugins/mot-du-jour/sync-words.cjs
// Run it after each edit of words.json; test/words.test.js fails while the two differ.
const fs = require('node:fs');
const path = require('node:path');

const root = __dirname;
const settingsPath = path.join(root, 'src/settings.yml');

// static_data as settings.yml holds it: compact JSON in a single-quoted YAML string.
function staticDataLine(words) {
  return `static_data: '${JSON.stringify(words).replaceAll("'", "''")}'`;
}

function readWords() {
  return JSON.parse(fs.readFileSync(path.join(root, 'words.json'), 'utf8'));
}

if (require.main === module) {
  const settings = fs.readFileSync(settingsPath, 'utf8');
  if (!/^static_data: .*$/m.test(settings)) throw new Error('src/settings.yml has no static_data line');
  fs.writeFileSync(settingsPath, settings.replace(/^static_data: .*$/m, () => staticDataLine(readWords())));
  console.log('static_data of src/settings.yml now matches words.json');
}

module.exports = { staticDataLine, readWords, settingsPath };
