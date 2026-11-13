// How to dress: turns Open-Meteo's hourly forecast into the day's Outfit and its text.
//
// TRMNL runs this file before rendering (Serverless transform): `run(input)` gets the
// polled JSON, and what it returns is what full.liquid sees. The rules are those of
// ticket 03 ("What should the kid wear, and when?"); every threshold is a constant here.
//
// The date and hours come from Open-Meteo's local `hourly.time` (the URL asks for
// timezone=auto), never from the runtime clock, whose time zone isn't documented.

// ---------- Thresholds ----------

const OUTDOOR_WINDOW = { first: 8, last: 17 }; // hours whose weather decides the Outfit
const WET_CHANCE = 50; // % precipitation chance that makes a Wet hour
const SNOW_ON_GROUND_M = 0.01; // snow depth (m) that counts as snow on the ground
const SUNSCREEN_UV = 3; // max UV that adds crème solaire (and a casquette)
const MORNING_HOUR = 8; // hour quoted as "ce matin"
const AFTERNOON_HOUR = 15; // hour quoted as "cet après-midi"
const SHOW_FEELS_LIKE_GAP = 3; // quote the ressenti when it differs this much
const STRONG_WIND_KMH = 30; // mean wind that is "strong"
const STRONG_GUST_KMH = 50; // gusts that are "strong"
const BIG_COLD = -15; // coldest feels-like that shows the "grand froid" sky
const HEAT_WAVE = 28; // warmest feels-like that shows the "canicule" sky
const STORM_CAPE = 1000; // CAPE (J/kg) that, with precipitation, makes a storm possible
const STORM_CODES = [95, 96, 99]; // WMO thunderstorm codes: a storm is forecast

// WHO UV index words, by the day's max UV.
const UV_WORDS = [[11, 'Extr\u{ea}me'], [8, 'Tr\u{e8}s \u{e9}lev\u{e9}'], [6, '\u{c9}lev\u{e9}'], [3, 'Mod\u{e9}r\u{e9}'], [0, 'Faible']];
// US AQI words, by the day's worst AQI.
const AQI_WORDS = [[301, 'Dangereux'], [201, 'Tr\u{e8}s mauvais'], [151, 'Mauvais'], [101, 'Mauvais pour les sensibles'], [51, 'Mod\u{e9}r\u{e9}'], [0, 'Bon']];

// Base clothes by the warmest feels-like (W). `alt` is the Girls' alternative.
const BASE_RULES = [
  { min: 22, top: 'tshirt', bottom: 'short', alt: ['robe'] },
  { min: 20, top: 'tshirt', bottom: 'pantalon', alt: ['jupe', 'collants'] },
  { min: 12, top: 'manches', bottom: 'pantalon', alt: ['jupe', 'collants'] },
  { min: -Infinity, top: 'manches', bottom: 'pantalon', alt: null },
];

// Layers by the coldest feels-like (C).
const LAYER_RULES = [
  { min: 15, feet: 'souliers' },
  { min: 10, warm: 'chandail', feet: 'souliers' },
  { min: 5, warm: 'chandail', coat: 'misaison', feet: 'souliers' },
  { min: 0, warm: 'chandail', coat: 'misaison', head: 'tuque', hands: 'gants', feet: 'souliers' },
  { min: -10, coat: 'hiver', pants: 'neige', head: 'tuque', hands: 'mitaines', neck: 'cachecou', feet: 'bottesHiver' },
  { min: -Infinity, warm: 'chandail', coat: 'hiver', pants: 'neige', head: 'tuque', hands: 'mitaines', neck: 'cachecou', feet: 'bottesHiver' },
];

// WMO weather codes: snow (fall, grains, showers) and rain (drizzle, rain, showers, storms).
const SNOW_CODES = [71, 73, 75, 77, 85, 86];
const RAIN_CODES = [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99];

// ---------- Words ----------

const LABELS = {
  tshirt: 't-shirt', manches: 'manches longues', chandail: 'chandail',
  misaison: 'manteau mi-saison', hiver: "manteau d'hiver", impermeable: 'imperméable',
  short: 'short', pantalon: 'pantalon', neige: 'pantalon de neige', pluie: 'pantalon de pluie',
  jupe: 'jupe', robe: 'robe', collants: 'collants',
  casquette: 'casquette', tuque: 'tuque', gants: 'gants', mitaines: 'mitaines',
  cachecou: 'cache-cou', souliers: 'souliers', bottesPluie: 'bottes de pluie',
  bottesHiver: "bottes d'hiver", creme: 'crème solaire',
};

const DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août',
  'septembre', 'octobre', 'novembre', 'décembre'];

// ---------- Mannequin drawing ----------

// Approved illustrations use one shared coordinate system; a piece includes both
// hands or feet, so no per-item stretching or mirroring is needed.
const MANNEQUIN = { viewBox: '60 10 280 620', width: 280, height: 620 };
const DRAW_ORDER = ['legs', 'bottom', 'top', 'warm', 'pants', 'feet', 'coat', 'head', 'neck', 'hands'];

// ---------- Reading the forecast ----------

function hoursOfWindow(hourly, first = OUTDOOR_WINDOW.first, last = OUTDOOR_WINDOW.last) {
  const hours = [];
  hourly.time.forEach((time, i) => {
    const hour = Number(time.slice(11, 13));
    if (hour < first || hour > last) return;
    const code = hourly.weather_code ? hourly.weather_code[i] : null;
    const snowfall = hourly.snowfall ? hourly.snowfall[i] : 0;
    const precipitation = hourly.precipitation ? hourly.precipitation[i] : 0;
    const chance = hourly.precipitation_probability ? hourly.precipitation_probability[i] : 0;
    let wet = null;
    if (chance >= WET_CHANCE) {
      // Each Wet hour is rain or snow: the forecast's code or amounts say which,
      // else the temperature does.
      if (SNOW_CODES.includes(code) || snowfall > 0) wet = 'snow';
      else if (RAIN_CODES.includes(code) || precipitation > 0) wet = 'rain';
      else wet = hourly.temperature_2m[i] <= 0 ? 'snow' : 'rain';
    }
    hours.push({
      hour,
      cloud: hourly.cloud_cover?.[i] ?? (code >= 3 ? 100 : code === 2 ? 65 : code === 1 ? 35 : 0),
      temp: hourly.temperature_2m[i],
      feels: hourly.apparent_temperature[i],
      wet,
      code,
      precipitation,
      snowfall,
      cape: hourly.cape ? hourly.cape[i] : 0,
      snowDepth: hourly.snow_depth ? hourly.snow_depth[i] : 0,
      uv: hourly.uv_index ? hourly.uv_index[i] : 0,
      wind: hourly.wind_speed_10m ? hourly.wind_speed_10m[i] : 0,
      gust: hourly.wind_gusts_10m ? hourly.wind_gusts_10m[i] : 0,
    });
  });
  return hours;
}

function summarize(hours) {
  const feels = hours.map(h => h.feels);
  return {
    warmest: Math.max(...feels),
    coldest: Math.min(...feels),
    rain: hours.some(h => h.wet === 'rain'),
    snow: hours.some(h => h.wet === 'snow'),
    snowOnGround: hours.some(h => h.snowDepth >= SNOW_ON_GROUND_M),
    uv: Math.max(...hours.map(h => h.uv)),
    windy: hours.some(h => h.wind >= STRONG_WIND_KMH || h.gust >= STRONG_GUST_KMH),
    firstWet: hours.find(h => h.wet) || null,
  };
}

// ---------- Rules ----------

function pickOutfit(day) {
  const base = BASE_RULES.find(r => day.warmest >= r.min);
  const layers = LAYER_RULES.find(r => day.coldest >= r.min);
  const outfit = {
    top: base.top, bottom: base.bottom, legs: null,
    warm: layers.warm || null, coat: layers.coat || null, pants: layers.pants || null,
    head: layers.head || null, hands: layers.hands || null, neck: layers.neck || null,
    feet: layers.feet, extra: null,
  };
  if (day.rain) {
    if (outfit.coat !== 'hiver') outfit.coat = 'impermeable';
    if (outfit.pants !== 'neige') outfit.pants = 'pluie';
    if (outfit.feet !== 'bottesHiver') outfit.feet = 'bottesPluie';
  }
  if (day.snow || day.snowOnGround) {
    outfit.pants = 'neige';
    outfit.feet = 'bottesHiver';
  }
  if (day.uv >= SUNSCREEN_UV) {
    outfit.extra = 'creme';
    if (!outfit.head) outfit.head = 'casquette';
  }
  return { outfit, alt: base.alt };
}

// ---------- Text ----------

const degrees = n => `${Math.round(n) < 0 ? '\u{2212}' : ''}${Math.abs(Math.round(n))}\u{a0}°C`;

function temperatureAt(hours, hour, label) {
  const h = hours.find(x => x.hour === hour);
  if (!h) return '';
  const gap = Math.abs(Math.round(h.feels) - Math.round(h.temp));
  const feels = gap >= SHOW_FEELS_LIKE_GAP ? ` (ressenti ${degrees(h.feels).replace('\u{a0}°C', '')})` : '';
  return `${label}\u{a0}: ${degrees(h.temp)}${feels}.`;
}

function weatherSentence(hours, day) {
  const parts = [
    temperatureAt(hours, MORNING_HOUR, 'Ce matin'),
    temperatureAt(hours, AFTERNOON_HOUR, 'Cet après-midi'),
  ];
  if (day.firstWet) {
    parts.push(`${day.firstWet.wet === 'snow' ? 'Neige' : 'Pluie'} vers ${day.firstWet.hour}\u{a0}h.`);
  } else {
    parts.push('Pas de pluie ni de neige.');
  }
  if (day.windy) parts.push('Beaucoup de vent.');
  return parts.filter(Boolean).join(' ');
}

function localDate(firstTime) {
  const [y, m, d] = firstTime.slice(0, 10).split('-').map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const dayOfYear = Math.round((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 1)) / 86400000);
  return { text: `${DAYS[weekday]} ${d === 1 ? '1er' : d} ${MONTHS[m - 1]}`, dayOfYear };
}

// ---------- Chart ----------

function chartOf(hours) {
  const temps = hours.map(h => Math.round(h.temp));
  const min = Math.min(...temps);
  const max = Math.max(...temps);
  return hours.map((h, i) => ({
    hour: h.hour,
    temp: degrees(temps[i]).replace('\u{a0}°C', '°'),
    // Top of the chart is the day's max, bottom its min; a bar never vanishes.
    height: max === min ? 100 : Math.round(15 + ((temps[i] - min) / (max - min)) * 85),
    wet: h.wet,
  }));
}

// ---------- Mannequins ----------

function pieces(items) {
  return DRAW_ORDER.filter(slot => items[slot]).map(slot => ({ key: items[slot] }));
}

// The Girls' alternative replaces the base clothes it names.
function withAlt(items, alt) {
  const out = { ...items };
  if (!alt) return out;
  if (alt.includes('robe')) { out.top = 'robe'; out.bottom = null; }
  if (alt.includes('jupe')) out.bottom = 'jupe';
  if (alt.includes('collants')) out.legs = 'collants';
  return out;
}

// Two kids, a boy and a girl: on the left the one dressed for inside (everything that
// stays on under the coat), on the right the one dressed to go outside (the whole
// Outfit). They swap places every day; the girl wears the Girls' alternative.
function kidsOf(outfit, alt, dayOfYear) {
  const girlOutside = dayOfYear % 2 === 1;
  const inside = { top: outfit.top, bottom: outfit.bottom, legs: outfit.legs, warm: outfit.warm };
  return [['inside', inside], ['outside', outfit]].map(([place, items]) => {
    const character = (place === 'outside') === girlOutside ? 'long' : 'short';
    const worn = character === 'long' ? withAlt(items, alt) : items;
    const kid = { place, character, pieces: pieces(worn) };
    if (place === 'outside' && outfit.extra) kid.extra = outfit.extra;
    return kid;
  });
}

// ---------- Entry point ----------

// With two polling URLs, TRMNL hands over { IDX_0: forecast, IDX_1: air quality };
// with one (old local samples), the forecast itself.
function run(polled) {
  const input = polled && polled.IDX_0 ? polled.IDX_0 : polled;
  const air = polled && polled.IDX_1 && polled.IDX_1.hourly ? polled.IDX_1.hourly : null;
  const hourly = input && input.hourly;
  if (!hourly || !Array.isArray(hourly.time) || hourly.time.length === 0) {
    return { error: 'Pas de météo pour le moment.' };
  }
  const hours = hoursOfWindow(hourly);
  if (hours.length === 0) return { error: 'Pas de météo entre 8 h et 17 h.' };

  const day = summarize(hours);
  const { outfit, alt } = pickOutfit(day);
  const date = localDate(hourly.time[0]);

  const result = {
    date: date.text,
    sentence: weatherSentence(hours, day),
    chart: chartOf(hours),
    outfit,
    alt,
    mannequin: MANNEQUIN,
    kids: kidsOf(outfit, alt, date.dayOfYear),
  };
  result.dashboard = dashboardOf(input, result, air);
  return result;
}

// The approved D dashboard, rendered on the server: no browser JavaScript or SVG illustration fallback.
function dashboardOf(input, out, air) {
  const IMAGE_BASE = 'https://raw.githubusercontent.com/apare/trmnl/f3dfe4d600e2ef7a49c9a2d8e3ff6af2e870be49/plugins/how-to-dress/images/';
  const src = name => IMAGE_BASE + name + '.png';
  const W = '#ffffff', K = '#000000';
  const TZ = 'America/Toronto', LAT = 45.50, LON = -73.57;
  const ROOT = 'fill="none" stroke="#000" stroke-width="2.8" stroke-linejoin="round" stroke-linecap="round"';
  const f = n => Math.round(n * 10) / 10;
  const f3 = n => Math.round(n * 1000) / 1000;
  const deg = n => (Math.round(n) < 0 ? '\u{2212}' : '') + Math.abs(Math.round(n)) + '\u{b0}';
  const hm = min => `${Math.floor(min / 60)}\u{a0}h\u{a0}${String(Math.round(min % 60)).padStart(2, '0')}`;
  const svgOpen = (w, h) => `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" ${ROOT}>`;
  const iconAt = (name, x, y, size) => `<image href="${src(name)}" x="${f(x)}" y="${f(y)}" width="${f(size)}" height="${f(size)}"/>`;
  const mm = m => String(m).padStart(2, '0');

  const MQ = { w: 1024, h: 1536, k: 2.4, x: 176, y: 24 };
  function mannequinLayers(pieces, character) {
    const worn = pieces.map(p => p.key);
    const rain = worn.includes('impermeable');
    const out = [];
    const add = id => out.push({ name: 'mannequin/' + id });
    if (character === 'long' && !rain) add('cheveux-longs-derriere');
    if (worn.includes('hiver')) add('hiver-capuchon-derriere');
    else if (rain) add('impermeable-capuchon-derriere');
    else if (!worn.includes('misaison') && worn.includes('chandail')) add('chandail-capuchon-derriere');
    add('corps');
    const later = ['casquette', 'tuque', 'cachecou', 'gants', 'mitaines'];
    const outerTop = worn.find(k => ['hiver', 'impermeable', 'misaison'].includes(k)) || (worn.includes('chandail') ? 'chandail' : null);
    const outerPants = worn.some(k => ['neige', 'pluie'].includes(k));
    const hidden = k => (outerTop && ['tshirt', 'manches', 'chandail'].includes(k) && k !== outerTop) || (outerPants && ['short', 'pantalon', 'jupe', 'collants'].includes(k));
    worn.filter(k => !later.includes(k) && !hidden(k)).forEach(k => add(k));
    add(character === 'long' ? 'tete-longue' : 'tete-courte');
    worn.filter(k => k === 'casquette' || k === 'tuque').forEach(k => add(k));
    if (rain) add('impermeable-capuchon-devant');
    if (worn.includes('cachecou')) add('cachecou');
    if (worn.includes('gants')) add('gants'); else if (worn.includes('mitaines')) add('mitaines');
    return out;
  }
  // Where a label's line lands on each piece, in mannequin image pixels: [y, left x, right x].
  const ANCHORS = {
    tuque: [200, 392, 630], casquette: [225, 385, 638], creme: [360, 385, 640], cachecou: [540, 442, 583],
    tshirt: [640, 330, 693], manches: [760, 300, 722], chandail: [680, 308, 716], robe: [800, 390, 635],
    hiver: [720, 300, 724], misaison: [720, 300, 724], impermeable: [720, 300, 724],
    gants: [975, 240, 784], mitaines: [975, 240, 784],
    short: [1000, 390, 634], jupe: [1060, 350, 674], pantalon: [1150, 380, 645], pluie: [1150, 380, 645],
    neige: [1150, 382, 643], collants: [1260, 368, 656],
    souliers: [1415, 315, 710], bottesPluie: [1340, 355, 668], bottesHiver: [1340, 355, 668],
  };
  const VISIBLE = { left: 216, right: 807, feet: 1474 }; // drawn part of the mannequin images
  // At most two lines when it fits, cut where the longer line is shortest: "bottes / de pluie".
  function wrap(text, max) {
    const words = text.split(' ');
    if (text.length <= max || words.length === 1) return [text];
    const cuts = words.slice(1).map((_, i) => [words.slice(0, i + 1).join(' '), words.slice(i + 1).join(' ')]);
    return cuts.reduce((best, c) => Math.max(...c.map(x => x.length)) < Math.max(...best.map(x => x.length)) ? c : best);
  }
  // Spreads a column's labels apart, each as close as it can to the height of its piece.
  function relax(labels, minY, maxY) {
    labels.sort((a, b) => a.ty - b.ty);
    let y = minY;
    labels.forEach(l => { l.y = Math.max(l.ty - l.h / 2, y); y = l.y + l.h + 8; });
    let bottom = maxY;
    for (let i = labels.length - 1; i >= 0; i--) { labels[i].y = Math.min(labels[i].y, bottom - labels[i].h); bottom = labels[i].y - 8; }
  }
  // The two kids standing low on the ground, each with its clothes named on both sides.
  function kidsHTML(d, w, h) {
    const H = 340, s = H / (MQ.h - 2 * MQ.y), O = 92, G = 8, LINE = 17, FONT = 15, CHARS = 10;
    const vw = (VISIBLE.right - VISIBLE.left) * s;
    const top = h - 22 - (VISIBLE.feet - MQ.y) * s;
    const mid = w - 2 * 4 - 2 * O - 4 * G - 2 * vw;
    const vLeft = [4 + O + G, 4 + O + G + vw + G + mid + G];
    const left = vLeft.map(v => v - (VISIBLE.left - MQ.x) * s);
    const columns = { outer0: [], middle: [], outer1: [] };
    const figures = d.out.kids.map((kid, i) => {
      const layers = mannequinLayers(kid.pieces, kid.character);
      const box = `style="left:${f(-MQ.x * s)}px;top:${f(-MQ.y * s)}px" width="${f(MQ.w * s)}" height="${f(MQ.h * s)}"`;
      const img = layers.map(l => `<img src="${src(l.name)}" ${box} alt="">`).join('');
      const at = (px, py) => [left[i] + (px - MQ.x) * s, top + (py - MQ.y) * s];
      const drawn = new Set(layers.map(l => l.name.slice('mannequin/'.length)));
      const worn = kid.pieces.map(p => p.key);
      const insideKeys = new Set(d.out.kids.find(k => k.place === 'inside').pieces.map(p => p.key));
      // Inside: everything worn, even under the sweater. Outside: what shows and is added.
      const keys = kid.place === 'inside' ? worn : worn.filter(k => drawn.has(k) && !insideKeys.has(k));
      if (kid.extra) keys.push(kid.extra);
      keys.sort((a, b) => ANCHORS[a][0] - ANCHORS[b][0]).forEach((key, n) => {
        const side = (n + i) % 2 === 0 ? 'left' : 'right';
        const [py, lx, rx] = ANCHORS[key];
        const lines = wrap(LABELS[key], CHARS);
        const [ax, ay] = at(side === 'left' ? lx : rx, py);
        const column = side === 'left' ? (i === 0 ? 'outer0' : 'middle') : (i === 0 ? 'middle' : 'outer1');
        const x = side === 'left' ? vLeft[i] - 6 : vLeft[i] + vw + 6;
        columns[column].push({ lines, ax, ay, x, side, ty: ay, h: lines.length * LINE });
      });
      return `<div class="mq" data-place="${kid.place}" data-character="${kid.character}" style="left:${f(left[i])}px;top:${f(top)}px;width:${f(280 * MQ.k * s)}px;height:${H}px">${img}</div>`;
    });
    let svg = svgOpen(w, h);
    // A pill above each kid's head says where that Outfit is worn.
    d.out.kids.forEach((kid, i) => {
      const text = kid.place === 'inside' ? 'Int\u{e9}rieur' : 'Ext\u{e9}rieur', pw = 112, ph = 28;
      const cx = vLeft[i] + vw / 2, y = top - ph - 8;
      svg += `<rect x="${f(cx - pw / 2)}" y="${f(y)}" width="${pw}" height="${ph}" rx="${ph / 2}" fill="${W}" stroke-width="2.5"/>`;
      svg += `<text x="${f(cx)}" y="${f(y + 20)}" font-size="17" font-weight="800" text-anchor="middle" fill="${K}" stroke="none">${text}</text>`;
    });
    Object.values(columns).forEach(labels => {
      relax(labels, 10, h - 10);
      labels.forEach(l => {
        const ly = l.y + l.h / 2, lx = l.side === 'left' ? l.x + 4 : l.x - 4;
        svg += `<path d="M${f(lx)} ${f(ly)}L${f(l.ax)} ${f(l.ay)}" stroke="${W}" stroke-width="6"/><path d="M${f(lx)} ${f(ly)}L${f(l.ax)} ${f(l.ay)}" stroke-width="2.2"/>`;
        svg += `<circle cx="${f(l.ax)}" cy="${f(l.ay)}" r="4" fill="${K}" stroke="${W}" stroke-width="1.5"/>`;
        svg += `<text x="${f(l.x)}" y="${f(l.y + FONT - 2)}" font-size="${FONT}" font-weight="800" text-anchor="${l.side === 'left' ? 'end' : 'start'}" fill="${K}" class="halo">`
          + l.lines.map((t, n) => `<tspan x="${f(l.x)}" dy="${n ? LINE : 0}">${t}</tspan>`).join('') + '</text>';
      });
    });
    return `<div class="kids">${figures.join('')}${svg}</svg></div>`;
  }
  const SEASONS = {
    1: { arbres: ['nu', 'sapin'], sol: 'terre', decor: ['bonhomme', 'banc'], air: [] },
    2: { arbres: ['nu', 'sapin'], sol: 'terre', decor: ['banc', 'bonhomme'], air: [] },
    3: { arbres: ['erable', 'sapin'], sol: 'terre', decor: ['banc'], air: [] },
    4: { arbres: ['bourgeons', 'sapin'], sol: 'terre', decor: ['pousses'], air: ['outardes'] },
    5: { arbres: ['fleurs', 'jeune'], sol: 'herbe', decor: ['tulipes'], air: [] },
    6: { arbres: ['vert', 'vert'], sol: 'herbe', decor: ['marguerites'], air: ['papillon'] },
    7: { arbres: ['vert', 'vert'], sol: 'herbe', decor: ['marguerites'], air: ['papillon'] },
    8: { arbres: ['vert', 'vert'], sol: 'herbe', decor: ['tournesols'], air: [] },
    9: { arbres: ['pommes', 'vert'], sol: 'herbe', decor: ['pommes'], air: ['outardes'] },
    10: { arbres: ['couleurs', 'couleurs'], sol: 'herbe', decor: ['citrouilles', 'feuilles'], air: ['feuilles'] },
    11: { arbres: ['peu', 'nu'], sol: 'terre', decor: ['tas'], air: ['feuilles'] },
    12: { arbres: ['nu', 'sapin'], sol: 'terre', decor: ['banc', 'bonhomme'], air: [] },
  };
  function sceneLayers(d) {
    const sc = d.scene, season = SEASONS[d.month], snow = sc.sol === 'neige', c = sc.ciel;
    const sunny = c === 'clear' || c === 'partly', calm = c !== 'rain' && c !== 'snow';
    const n = [sunny && sc.chaud ? 'ciel-canicule' : sunny && sc.grandFroid ? 'ciel-grand-froid' : { clear: 'ciel-soleil', partly: 'ciel-nuageux', cloudy: 'ciel-couvert', rain: 'ciel-pluie', snow: 'ciel-neige' }[c]];
    n.push(snow ? 'sol-neige' : season.sol === 'herbe' ? 'sol-herbe' : 'sol-terre');
    if (sc.sol === 'flaques') n.push('flaques');
    n.push(`mois-${mm(d.month)}${snow && [1, 2, 3, 4, 10, 11, 12].includes(d.month) ? '-neige' : ''}`);
    if (calm) season.air.forEach(a => n.push({ feuilles: 'air-feuilles', outardes: 'air-outardes', papillon: 'air-papillons' }[a]));
    if (c === 'rain') n.push('tombe-pluie');
    if (c === 'snow') n.push('tombe-neige');
    if (sc.vent) n.push('vent');
    return n.map(x => 'scene/' + x);
  }
  const SC = { w: 1536, h: 1024, gy: 780 };
  function sceneStack(d, w, h, gy) {
    const k = Math.max(w / SC.w, h / SC.h, gy / SC.gy, (h - gy) / (SC.h - SC.gy));
    const box = `style="left:${f((w - SC.w * k) / 2)}px;top:${f(gy - SC.gy * k)}px" width="${f(SC.w * k)}" height="${f(SC.h * k)}"`;
    return '<div class="layers">' + sceneLayers(d).map(n => `<img src="${src(n)}" ${box} alt="">`).join('') + '</div>';
  }
  const ICON_SKY = { 'meteo-soleil': ['clear', false], 'meteo-soleil-nuage': ['partly', false], 'meteo-nuage': ['cloudy', false], 'meteo-pluie': ['rain', false], 'meteo-neige': ['snow', false], 'meteo-lune': ['clear', true], 'meteo-lune-nuage': ['partly', true] };
  const meteoName = (kind, night) => 'icones/' + Object.keys(ICON_SKY).find(n => ICON_SKY[n][0] === kind && (ICON_SKY[n][1] === night || kind === 'cloudy' || kind === 'rain' || kind === 'snow'));
  const rad = Math.PI / 180;
  // Lever et coucher du soleil, \u{e9}quation de Wikip\u{e9}dia \u{ab} Sunrise equation \u{bb} (\u{b1}2 min). Fallback for old local samples; live data uses Open-Meteo daily.sunrise/sunset.
  function sunTimes(dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const J0 = Date.UTC(y, m - 1, d) / 864e5 + 2440587.5;
    const n = Math.ceil(J0 - 2451545 + 0.0008);
    const Js = n - LON / 360;
    const Md = (357.5291 + 0.98560028 * Js) % 360, Mr = Md * rad;
    const C = 1.9148 * Math.sin(Mr) + 0.02 * Math.sin(2 * Mr) + 0.0003 * Math.sin(3 * Mr);
    const lam = ((Md + C + 180 + 102.9372) % 360) * rad;
    const Jt = 2451545 + Js + 0.0053 * Math.sin(Mr) - 0.0069 * Math.sin(2 * lam);
    const dec = Math.asin(Math.sin(lam) * Math.sin(23.4397 * rad));
    const H = Math.acos((Math.sin(-0.833 * rad) - Math.sin(LAT * rad) * Math.sin(dec)) / (Math.cos(LAT * rad) * Math.cos(dec))) / rad;
    const iso = J => { const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date((J - 2440587.5) * 864e5)).map(x => [x.type, x.value])); return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`; };
    return { sunrise: iso(Jt - H / 360), sunset: iso(Jt + H / 360) };
  }
  const isoMin = iso => Number(iso.slice(11, 13)) * 60 + Number(iso.slice(14, 16));

  const TWILIGHT = 30; // minutes de p\u{e9}nombre avant le lever et apr\u{e8}s le coucher
  // Lumi\u{e8}re 0 (nuit) \u{e0} 1 (plein soleil), estim\u{e9}e par le lever et le coucher du soleil, att\u{e9}nu\u{e9}e par les nuages et la pluie.
  function lightAt(min, sun, cloud, wet) {
    let l;
    if (min <= sun.rise - TWILIGHT || min >= sun.set + TWILIGHT) l = 0;
    else if (min < sun.rise) l = 0.3 * (min - (sun.rise - TWILIGHT)) / TWILIGHT;
    else if (min > sun.set) l = 0.3 * (sun.set + TWILIGHT - min) / TWILIGHT;
    else l = 0.3 + 0.7 * Math.sin(Math.PI * (min - sun.rise) / (sun.set - sun.rise));
    return l * (1 - 0.4 * cloud / 100) * (wet ? 0.8 : 1);
  }
  const gray = l => { const v = Math.round(255 * (0.17 + 0.83 * Math.min(1, l))); return `rgb(${v},${v},${v})`; };

  const SYNODIC = 29.530588853;
  const MOON_NAMES = ['Nouvelle lune', 'Premier croissant', 'Premier quartier', 'Lune gibbeuse croissante', 'Pleine lune', 'Lune gibbeuse d\u{e9}croissante', 'Dernier quartier', 'Dernier croissant'];
  function moonOf(dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const jd = Date.UTC(y, m - 1, d, 25) / 864e5 + 2440587.5; // mean phase near this evening in Montreal
    const age = (((jd - 2451550.1) / SYNODIC) % 1 + 1) % 1;
    const idx = Math.floor(age * 8 + 0.5) % 8;
    const toFull = ((0.5 - age + 1) % 1) * SYNODIC;
    // Mean phase, approximately one day of uncertainty; label the date as approximate.
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: TZ, month: 'numeric', day: 'numeric' }).formatToParts(new Date(Date.UTC(y, m - 1, d, 25) + toFull * 864e5)).map(x => [x.type, Number(x.value)]));
    const fullText = idx === 4 ? 'C\u{2019}est la pleine lune ce soir !' : `Pleine lune vers le ${p.day === 1 ? '1er' : p.day} ${MONTHS[p.month - 1]}.`;
    return { age: f3(age), idx, name: MOON_NAMES[idx], lit: Math.round((1 - Math.cos(2 * Math.PI * age)) / 2 * 100), growing: age < 0.5, daysToFull: f(toFull), fullText };
  }

  const hy = input.hourly;
  const dateStr = hy.time[0].slice(0, 10);
  const month = Number(dateStr.slice(5, 7));
  const hours = hoursOfWindow(hy, 0, 23);
  const daily = input.daily || {};
  const fallback = (!daily.sunrise?.[0] || !daily.sunset?.[0]) ? sunTimes(dateStr) : null;
  const sun = { rise: isoMin(daily.sunrise?.[0] || fallback.sunrise), set: isoMin(daily.sunset?.[0] || fallback.sunset) };
  const light10 = Array.from({ length: 144 }, (_, i) => {
    const h = hours.find(h => h.hour === Math.floor(i / 6));
    return f3(lightAt(i * 10 + 5, sun, h?.cloud || 0, h?.wet));
  });
  const skyOf = (from, to) => {
    const hs = hours.filter(h => h.hour >= from && h.hour < to);
    if (hs.some(h => h.wet === 'snow')) return 'snow';
    if (hs.some(h => h.wet === 'rain')) return 'rain';
    const cloud = hs.reduce((a, h) => a + h.cloud, 0) / (hs.length || 1);
    return cloud >= 80 ? 'cloudy' : cloud >= 30 ? 'partly' : 'clear';
  };
  const day = summarize(hoursOfWindow(hy));
  const d = {
    out, month, hours, sun, light10, skyOf,
    nightAt: hour => lightAt(hour * 60, sun, 0, null) < 0.2,
    scene: { ciel: skyOf(8, 18), sol: day.snow || day.snowOnGround ? 'neige' : day.rain ? 'flaques' : SEASONS[month].sol,
      vent: day.windy, chaud: day.warmest >= HEAT_WAVE, grandFroid: day.coldest < BIG_COLD },
    moon: moonOf(dateStr),
    aqi: air && Array.isArray(air.us_aqi) ? air.us_aqi.filter(v => typeof v === 'number') : [],
  };
  // One dotted pill per hour, 0 h to 23 h: from the lower to the higher of the temperature
  // and the feels-like. The sky icon sits above the first pill and each pill whose sky
  // differs from the hour before. Then the light band and the hours.
  function hourBars(d, w, h) {
    const bars = d.hours.map(x => ({
      hour: x.hour, hi: Math.round(Math.max(x.temp, x.feels)), lo: Math.round(Math.min(x.temp, x.feels)),
      icon: meteoName(d.skyOf(x.hour, x.hour + 1), d.nightAt(x.hour + .5)),
    }));
    bars.forEach((b, i) => { b.showIcon = i === 0 || b.icon !== bars[i - 1].icon; });
    const cw = w / 24, pw = 38, FONT = 16, NUM = 21, ICON = 38, head = NUM + ICON, foot = 24;
    const stripY = h - 44, stripH = 22, plotBot = stripY - 5;
    const gHi = Math.max(...bars.map(b => b.hi)), gLo = Math.min(...bars.map(b => b.lo));
    const yOf = t => gHi === gLo ? (head + plotBot - foot) / 2 : head + (gHi - t) / (gHi - gLo) * (plotBot - foot - head);
    const xOfMin = min => min / 60 * cw;
    let s = svgOpen(w, h) + `<defs><pattern id="htd-dots" width="3" height="3" patternUnits="userSpaceOnUse"><rect width="1.2" height="1.2" fill="${K}" stroke="none"/></pattern></defs>`;
    bars.forEach(b => {
      // The max's baseline sits at yOf(hi); the icon, when there is one, sits just above the pill.
      const cx = b.hour * cw + cw / 2, hiY = yOf(b.hi), bot = yOf(b.lo) + foot;
      const top = hiY - NUM;
      s += `<rect x="${f(cx - pw / 2)}" y="${f(top)}" width="${pw}" height="${f(bot - top)}" rx="${pw / 2}" fill="url(#htd-dots)" stroke-width="2"/>`;
      if (b.showIcon) s += iconAt(b.icon, cx - 20, top - ICON - 1, 40);
      s += `<text x="${f(cx)}" y="${f(hiY)}" font-size="${FONT}" font-weight="800" text-anchor="middle" fill="${K}" class="halo">${deg(b.hi)}</text>`;
      s += `<text x="${f(cx)}" y="${f(bot - 7)}" font-size="${FONT}" font-weight="800" text-anchor="middle" fill="${K}" class="halo">${deg(b.lo)}</text>`;
      s += `<text x="${f(cx)}" y="${h - 4}" font-size="13" font-weight="700" text-anchor="middle" fill="${K}" stroke="none">${b.hour} h</text>`;
    });
    for (let i = 0; i < 144; i++) s += `<rect x="${f(xOfMin(i * 10))}" y="${stripY}" width="${f(cw / 6 + .6)}" height="${stripH}" fill="${gray(d.light10[i])}" stroke="none"/>`;
    s += `<rect x="0" y="${stripY}" width="${w}" height="${stripH}" stroke-width="2"/>`;
    [[d.sun.rise, '\u{2191}'], [d.sun.set, '\u{2193}']].forEach(([m, a]) => {
      const x = Math.max(48, Math.min(w - 48, xOfMin(m)));
      s += `<rect x="${f(x - 46)}" y="${stripY + 2}" width="92" height="${stripH - 4}" rx="9" fill="${W}" stroke-width="1.5"/>`;
      s += `<text x="${f(x)}" y="${stripY + 16}" font-size="14" font-weight="800" text-anchor="middle" fill="${K}" stroke="none">\u{2600}${a} ${hm(m)}</text>`;
    });
    return s + '</svg>';
  }
  const hourText = h => h >= 24 ? 'minuit' : `${h}\u{a0}h`;
  const decimal = n => String(Math.round(n * 10) / 10).replace('.', ',');
  const wordFor = (scale, n) => scale.find(([min]) => n >= min)[1];
  // Back-to-back Wet hours, 0 h to 23 h, each stretch ending the hour after its last one.
  // A stretch with any snow is snow, counted in cm of snowfall; rain in mm of precipitation.
  function wetStretches(hours) {
    const stretches = [];
    hours.filter(h => h.wet).forEach(h => {
      const last = stretches[stretches.length - 1];
      if (last && last.to === h.hour) { last.hours.push(h); last.to = h.hour + 1; }
      else stretches.push({ from: h.hour, to: h.hour + 1, hours: [h] });
    });
    return stretches.map(s => {
      const snow = s.hours.some(h => h.wet === 'snow');
      const amount = s.hours.reduce((a, h) => a + ((snow ? h.snowfall : h.precipitation) || 0), 0);
      return { kind: snow ? 'snow' : 'rain', from: s.from, to: s.to, amount: `${decimal(amount)}\u{a0}${snow ? 'cm' : 'mm'}` };
    });
  }
  // A thunderstorm code wins; else an unstable hour (high CAPE) that also gets precipitation.
  function stormOf(hours) {
    const coded = hours.find(h => STORM_CODES.includes(h.code));
    if (coded) return `Orage pr\u{e9}vu vers ${hourText(coded.hour)}`;
    const unstable = hours.find(h => h.cape >= STORM_CAPE && (h.wet || h.precipitation > 0));
    if (unstable) return `Orage possible vers ${hourText(unstable.hour)}`;
    return 'Pas d\u{2019}orage';
  }
  function cardsHTML(d) {
    const icon = name => `${svgOpen(62, 62)}${iconAt(name, 31 - 38.9, 30 - 38.9, 77.8)}</svg>`;
    // UV: the day's max, its WHO word, and the sunscreen hours (UV 3 or more). Rounded
    // down, so 2.6 reads "2 Faible" like the Outfit, which adds sunscreen from 3.
    const uvMax = Math.floor(Math.max(0, ...d.hours.map(h => h.uv || 0)));
    const sunny = d.hours.filter(h => h.uv >= SUNSCREEN_UV);
    const cream = sunny.length ? `<div class="small">cr\u{e8}me ${hourText(sunny[0].hour)}\u{2013}${hourText(sunny[sunny.length - 1].hour + 1)}</div>` : '';
    const uv = `<div><div><div class="small">Indice UV</div><div class="big">${uvMax}</div><div class="small">${wordFor(UV_WORDS, uvMax)}</div>${cream}</div></div>`;
    // Air: the day's worst US AQI.
    const aqiMax = d.aqi.length ? Math.max(...d.aqi) : null;
    const air = `<div><div><div class="small">Qualit\u{e9} de l\u{2019}air</div><div class="big">${aqiMax === null ? '\u{2013}' : Math.round(aqiMax)}</div>`
      + `<div class="small wrap">${aqiMax === null ? 'Pas de donn\u{e9}es' : wordFor(AQI_WORDS, Math.round(aqiMax))}</div></div></div>`;
    // Precipitation: the first stretch, then the second one if any, then the storm risk.
    const [first, second] = wetStretches(d.hours);
    const word = s => s.kind === 'snow' ? 'Neige' : 'Pluie';
    const wet = first
      ? `<div class="mid">${word(first)} de ${hourText(first.from)} \u{e0} ${hourText(first.to)}</div><div class="small">${first.amount}</div>`
        + (second ? `<div class="small">puis ${word(second).toLowerCase()} de ${hourText(second.from)} \u{e0} ${hourText(second.to)} (${second.amount})</div>` : '')
      : '<div class="mid">Pas de pluie ni de neige</div>';
    const wetIcon = meteoName(first ? first.kind : d.skyOf(8, 18), false);
    let phases = svgOpen(340, 30);
    for (let i = 0; i < 8; i++) { phases += iconAt(`icones/lune-${i}`, 22 + i * 42 - 11.1, 3.9, 22.2); if (i === d.moon.idx) phases += `<circle cx="${22 + i * 42}" cy="15" r="15" stroke-width="2.5"/>`; }
    phases += '</svg>';
    return `<div class="card"><h3>UV et air</h3><div class="two tops">${uv}${air}</div></div>
          <div class="card"><h3>Pr\u{e9}cipitations</h3>
            <div class="line">${icon(wetIcon)}<div>${wet}<div class="small storm">${stormOf(d.hours)}</div></div></div></div>
          <div class="card"><h3>La lune ce soir</h3>
            <div class="line">${svgOpen(84, 84)}${iconAt(`icones/lune-${d.moon.idx}`, 0, 0, 84)}</svg>
              <div><div style="font-size:20px;font-weight:800">${d.moon.name}</div><div class="small">${d.moon.idx === 0 ? 'On ne la voit presque pas.' : d.moon.idx === 4 ? 'Elle est toute ronde.' : d.moon.growing ? 'Elle grossit chaque soir.' : 'Elle rapetisse chaque soir.'}</div><div class="small">${d.moon.fullText}</div></div></div>
            ${phases}</div>`;
  }
  return {
    scene: sceneStack(d, 618, 518, 395),
    kids: kidsHTML(d, 618, 518),
    cards: cardsHTML(d), chart: hourBars(d, 1000, 236),
    sun, moon: d.moon, sceneLayers: sceneLayers(d),
  };
}
