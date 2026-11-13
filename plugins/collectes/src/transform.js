// Collectes: tells which bin goes to the curb, from the schedule in the Plugin's settings.
//
// TRMNL runs this file before rendering (Serverless transform): `run(input)` gets the
// Plugin's custom fields, and what it returns is what full.liquid sees. Nothing is polled.
//
// Today's date comes from the clock plus the account's `utc_offset`, read with getUTC*,
// so it never depends on the runtime's time zone, which isn't documented.

// ---------- Rules ----------

const EVE_FROM_HOUR = 15; // the day before a Collecte, from this hour, the page says to put the bin out
const MORNING_UNTIL_HOUR = 8; // on the Collecte day, before this hour, it still does
const LOOKAHEAD_DAYS = 28; // how far ahead the next Collecte is looked for
const DAY_MS = 86400000;

// ---------- Images ----------

// Realistic bins seen from the side, generated then prepared for 16 grays (images/, README).
// TRMNL fetches them from the public repo, pinned to a commit so a later change can't swap them.
// Each has a `-pale` copy for a bin that waits for a later night.
const IMAGE_BASE = 'https://raw.githubusercontent.com/apare/trmnl/7a429fdabab7914c932cfb74e56c4240a2a8f2f9/plugins/collectes/images/';

// Each Matière: its settings keys are `<key>_date` and `<key>_frequence`.
const MATIERES = [
  { key: 'ordures', quoi: 'les vidanges' },
  { key: 'recyclage', quoi: 'le recyclage' },
];
const PERIODS = { semaine: 7, deux_semaines: 14 };

// ---------- Schedule ----------

// Days since 1970-01-01 for a 'YYYY-MM-DD' date, or null.
function dayNumber(text) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(text || ''));
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) / DAY_MS : null;
}

// The Matières whose schedule is filled in: { matiere, first, period }.
function schedules(values) {
  return MATIERES.map(matiere => ({
    matiere,
    first: dayNumber(values[`${matiere.key}_date`]),
    period: PERIODS[values[`${matiere.key}_frequence`]],
  })).filter(s => s.first !== null && s.period);
}

// The Matières collected on day `day`.
function collectedOn(list, day) {
  return list.filter(s => (((day - s.first) % s.period) + s.period) % s.period === 0).map(s => s.matiere);
}

// What the page shows at local time `now` (a Date whose UTC fields are the local time).
function plan(values, now) {
  const list = schedules(values);
  const today = Math.floor(now.getTime() / DAY_MS);
  const hour = now.getUTCHours();
  let day = today, matieres = [];
  for (; day <= today + LOOKAHEAD_DAYS; day++) {
    if (day === today && hour >= MORNING_UNTIL_HOUR) continue; // today's truck has gone
    matieres = collectedOn(list, day);
    if (matieres.length) break;
  }
  if (!matieres.length) return { sortir: false, matieres: [], texte: '', collecte: null };
  const sortir = day === today || (day === today + 1 && hour >= EVE_FROM_HOUR);
  const quoi = matieres.map(m => m.quoi);
  const texte = `Sors ${quoi.length > 1 ? `${quoi.slice(0, -1).join(', ')} et ${quoi[quoi.length - 1]}` : quoi[0]}\u{a0}!`;
  return {
    sortir,
    matieres: matieres.map(m => ({ key: m.key, image: `${IMAGE_BASE}${m.key}${sortir ? '' : '-pale'}.png` })),
    texte,
    collecte: new Date(day * DAY_MS).toISOString().slice(0, 10),
  };
}

function run(input) {
  const trmnl = (input && input.trmnl) || {};
  const values = (trmnl.plugin_settings && trmnl.plugin_settings.custom_fields_values) || {};
  const offset = Number(trmnl.user && trmnl.user.utc_offset) || 0;
  return plan(values, new Date(Date.now() + offset * 1000));
}
