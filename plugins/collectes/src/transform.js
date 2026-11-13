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

// ---------- Drawings (viewBox 0 0 120 120, the How to dress style: thick black outline, five grays) ----------

const W = '#fff', L = '#d4d4d4', M = '#9a9a9a', D = '#555';
const f1 = n => +n.toFixed(1);
const P = (d, fill = W, sw) => `<path d="${d}" fill="${fill}"${sw ? ` style="stroke-width:${sw}"` : ''}/>`;
const S = (d, sw = 3, color) => `<path d="${d}" fill="none" style="stroke-width:${sw}${color ? `;stroke:${color}` : ''}"/>`;
const CART_BODY = 'M24 54 L96 54 L90 104 Q89 109 84 109 L36 109 Q31 109 30 104 Z';
const CART_RIM = 'M18 47 Q18 43 22 43 L98 43 Q102 43 102 47 L102 52 Q102 56 98 56 L22 56 Q18 56 18 52 Z';
const WHEELS = `<circle cx="34" cy="108" r="8" fill="${D}"/><circle cx="34" cy="108" r="2.5" fill="${W}" style="stroke-width:0"/>`
  + `<circle cx="86" cy="108" r="8" fill="${D}"/><circle cx="86" cy="108" r="2.5" fill="${W}" style="stroke-width:0"/>`;
const fly = (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})">`
  + `<ellipse cx="-4.5" cy="-4" rx="4.5" ry="3" fill="${W}" style="stroke-width:2"/><ellipse cx="4.5" cy="-4" rx="4.5" ry="3" fill="${W}" style="stroke-width:2"/>`
  + `<ellipse cx="0" cy="1" rx="3.2" ry="4" fill="#000" style="stroke-width:0"/></g>`;

// Three chasing arrows around (cx, cy).
function recycle(cx, cy, r) {
  let out = '';
  for (let k = 0; k < 3; k++) {
    const a0 = (-90 + k * 120 + 20) * Math.PI / 180, a1 = a0 + 72 * Math.PI / 180;
    const [x0, y0, x1, y1] = [cx + r * Math.cos(a0), cy + r * Math.sin(a0), cx + r * Math.cos(a1), cy + r * Math.sin(a1)];
    const t = [-Math.sin(a1), Math.cos(a1)], n = [Math.cos(a1), Math.sin(a1)];
    const pts = [[x1 + n[0] * 6.5, y1 + n[1] * 6.5], [x1 + t[0] * 8, y1 + t[1] * 8], [x1 - n[0] * 6.5, y1 - n[1] * 6.5]];
    out += `<path d="M${f1(x0)} ${f1(y0)} A${r} ${r} 0 0 1 ${f1(x1)} ${f1(y1)}" fill="none" style="stroke-width:6.5;stroke-linecap:butt"/>`;
    out += `<polygon points="${pts.map(p => p.map(f1).join(',')).join(' ')}" fill="#000" style="stroke-width:1.5"/>`;
  }
  return out;
}

// A full grey cart: the bag spills over, the lid sits crooked on it, two flies.
const ORDURES_ART = P('M20 48 Q12 36 26 32 Q40 27 60 28 Q80 27 94 32 Q108 36 100 48 Z', M)
  + S('M34 35 q-3 6 0 12 M86 35 q3 6 0 12', 2.5)
  + `<g transform="rotate(-9 60 28)">${P('M46 18 Q46 13 51 13 H69 Q74 13 74 18 V21 H46 Z', D, 4)}<rect x="12" y="20" width="96" height="11" rx="5" fill="${D}"/></g>`
  + P(CART_BODY, D) + P(CART_RIM, D) + S('M46 64 V100 M60 64 V100 M74 64 V100', 3.5, M) + WHEELS
  + fly(32, 4) + fly(90, 8, 0.9);

// A pale cart, lid open: a box, a bottle and a can stick out; the arrows on the front.
const RECYCLAGE_ART = `<g transform="rotate(20 104 46)"><rect x="50" y="33" width="26" height="6" rx="3" fill="${L}"/><rect x="16" y="38" width="90" height="10" rx="4" fill="${L}"/></g>`
  + `<g transform="rotate(-10 36 46)">${P('M23 49 V25 H49 V49 Z', M)}${P('M23 25 L15 15 H41 L49 25 Z', L, 4)}${S('M36 25 V35', 3)}</g>`
  + P('M53 49 V22 Q53 16 58 14 V7 H66 V14 Q71 16 71 22 V49 Z', W) + P('M56 2 H68 V8 H56 Z', D) + P('M53 28 H71 V38 H53 Z', L, 3)
  + `<g transform="rotate(12 84 40)">${P('M76 49 V27 H92 V49 Z', W)}${P('M76 33 H92 V40 H76 Z', M, 3)}<ellipse cx="84" cy="27" rx="8" ry="2.5" fill="${L}" style="stroke-width:3"/></g>`
  + P(CART_BODY, L) + P(CART_RIM, L) + recycle(60, 81, 15) + WHEELS;

const svg = art => `<svg class="col-bin" viewBox="-6 -6 132 132" xmlns="http://www.w3.org/2000/svg">${art}</svg>`;

// Each Matière: its settings keys are `<key>_date` and `<key>_frequence`.
const MATIERES = [
  { key: 'ordures', quoi: 'les poubelles', svg: svg(ORDURES_ART) },
  { key: 'recyclage', quoi: 'le recyclage', svg: svg(RECYCLAGE_ART) },
];
const PERIODS = { semaine: 7, deux_semaines: 14 };

// The same drawing in pale grays, for a bin that waits for a later night (full.liquid greys its outline).
const PALE = { '#000': '#b8b8b8', [D]: '#cccccc', [M]: '#dddddd', [L]: '#eeeeee' };
const pale = art => art.replace(/fill="(#[0-9a-f]+)"/g, (all, color) => (PALE[color] ? `fill="${PALE[color]}"` : all));

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
    matieres: matieres.map(m => ({ key: m.key, svg: sortir ? m.svg : pale(m.svg) })),
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
