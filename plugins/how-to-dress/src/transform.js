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
const BIG_COLD = -15; // coldest feels-like for the "grand froid" friendly line
const HEAT_WAVE = 28; // warmest feels-like for the "canicule" friendly line

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

// Friendly lines: the first matching type wins; the line rotates by date.
const FRIENDLY = {
  grandFroid: [
    'Grand froid ! On s\u{2019}habille comme un bonhomme de neige.',
    'Brrr ! Même les pingouins mettent leur tuque aujourd\u{2019}hui.',
    'Il fait très très froid : on cache bien son nez.',
  ],
  neige: [
    'Il neige ! C\u{2019}est le temps de faire un bonhomme de neige.',
    'Des flocons partout ! On sort les bottes d\u{2019}hiver.',
    'Neige au menu : attrape un flocon avec ta langue !',
  ],
  pluie: [
    'Les flaques t\u{2019}attendent ! Saute dedans avec tes bottes.',
    'Il pleut ! Les vers de terre vont sortir.',
    'Jour de pluie : l\u{2019}imperméable est ton super-héros.',
  ],
  canicule: [
    'Il fait chaud chaud chaud ! Bois beaucoup d\u{2019}eau.',
    'Grosse chaleur : reste à l\u{2019}ombre quand tu peux.',
    'Il fait aussi chaud qu\u{2019}en vacances ! N\u{2019}oublie pas ta gourde.',
  ],
  soleil: [
    'Grand soleil ! Une belle journée pour jouer dehors.',
    'Le soleil brille : casquette et crème, et c\u{2019}est parti !',
  ],
  tranquille: [
    'Bonne journée ! Tu vas briller comme une étoile.',
    'Une journée tranquille : amuse-toi bien !',
    'C\u{2019}est l\u{2019}heure de l\u{2019}école : on s\u{2019}habille et on y va !',
  ],
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

function friendlyType(day) {
  if (day.coldest < BIG_COLD) return 'grandFroid';
  if (day.snow) return 'neige';
  if (day.rain) return 'pluie';
  if (day.warmest >= HEAT_WAVE) return 'canicule';
  if (day.uv >= SUNSCREEN_UV) return 'soleil';
  return 'tranquille';
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

const names = keys => keys.filter(Boolean).map(k => LABELS[k]).join(' · ');

// One mannequin per dressing step: under-clothes, then the warm layer, then what goes outside.
function stagesOf(outfit, alt) {
  const base = { top: outfit.top, bottom: outfit.bottom, legs: outfit.legs };
  const hasWarm = !!outfit.warm;
  const hasOutside = !!(outfit.coat || outfit.pants);
  const accessories = ['head', 'neck', 'hands', 'feet'].map(s => outfit[s]);
  let stages;
  if (!hasWarm && !hasOutside) {
    stages = [{ title: 'Aujourd\u{2019}hui', items: outfit, added: names([outfit.top, outfit.bottom, outfit.legs, ...accessories]) }];
  } else {
    stages = [{ title: 'En dessous', items: base, added: names([outfit.top, outfit.bottom, outfit.legs]) }];
    if (hasWarm) {
      stages.push(hasOutside
        ? { title: `Le ${LABELS[outfit.warm]}`, items: { ...base, warm: outfit.warm }, added: '' }
        : { title: `Le ${LABELS[outfit.warm]}`, items: outfit, added: names(accessories) });
    }
    if (hasOutside) {
      stages.push({ title: 'Pour sortir', items: outfit, added: names([outfit.coat, outfit.pants, ...accessories]) });
    }
  }
  return stages.map((stage, i) => {
    const out = { number: stages.length > 1 ? i + 1 : null, title: stage.title, added: stage.added, pieces: pieces(stage.items) };
    if (i === 0 && alt) {
      const altItems = { ...stage.items };
      if (alt.includes('robe')) { altItems.top = 'robe'; altItems.bottom = null; }
      if (alt.includes('jupe')) altItems.bottom = 'jupe';
      if (alt.includes('collants')) altItems.legs = 'collants';
      out.alt = { added: names(alt), pieces: pieces(altItems) };
    }
    if (i === stages.length - 1 && outfit.extra) out.extra = { key: outfit.extra, label: LABELS[outfit.extra] };
    return out;
  });
}

// ---------- Entry point ----------

function run(input) {
  const hourly = input && input.hourly;
  if (!hourly || !Array.isArray(hourly.time) || hourly.time.length === 0) {
    return { error: 'Pas de météo pour le moment.' };
  }
  const hours = hoursOfWindow(hourly);
  if (hours.length === 0) return { error: 'Pas de météo entre 8 h et 17 h.' };

  const day = summarize(hours);
  const { outfit, alt } = pickOutfit(day);
  const date = localDate(hourly.time[0]);
  const lines = FRIENDLY[friendlyType(day)];

  const result = {
    date: date.text,
    friendly: lines[date.dayOfYear % lines.length],
    sentence: weatherSentence(hours, day),
    chart: chartOf(hours),
    outfit,
    alt,
    mannequin: MANNEQUIN,
    stages: stagesOf(outfit, alt),
  };
  result.dashboard = dashboardOf(input, result);
  return result;
}

// The approved D dashboard, rendered on the server: no browser JavaScript or SVG illustration fallback.
function dashboardOf(input, out) {
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
  function mannequin(pieces, character, h) {
    const s = h / (620 * MQ.k);
    const box = `style="left:${f(-MQ.x * s)}px;top:${f(-MQ.y * s)}px" width="${f(MQ.w * s)}" height="${f(MQ.h * s)}"`;
    const layers = mannequinLayers(pieces, character).map(l => `<img src="${src(l.name)}" ${box} alt="">`).join('');
    return `<div class="mq" data-character="${character}" style="position:relative;flex:none;width:${f(280 * MQ.k * s)}px;height:${h}px">${layers}</div>`;
  }
  const extraIcon = (key, h) => `<img src="${src('icones/' + key)}" width="${h}" height="${h}" alt="">`;
  function stagesRow(d, h, opts = {}) {
    return d.out.stages.map(s => {
      const alt = s.alt ? `<div class="alt"><b>ou</b>${mannequin(s.alt.pieces, 'long', Math.round(h * 0.55))}<span class="lbl">${s.alt.added}</span></div>` : '';
      const extra = s.extra ? `<div class="extra">${extraIcon(s.extra.key, Math.round(h * 0.22))}<span class="lbl">${s.extra.label}</span></div>` : '';
      return `<div class="stage-m"><div class="mrow">${mannequin(s.pieces, 'short', h)}${alt}${extra}</div>
        <div class="st">${s.number ? `<span class="n">${s.number}</span>` : ''}${s.title}</div>
        <div class="added">${s.added.split(' \u{b7} ').map(x => `<span class="it">${x}</span>`).join(' \u{b7} ')}</div></div>`;
    }).join(`<div class="arrow"${opts.arrowLift ? ` style="align-self:flex-end;margin-bottom:${Math.round(opts.arrowLift)}px"` : ''}>\u{2192}</div>`);
  }
  function twoLines(text) {
    const t = text.replace(/ !/g, '\u{a0}!').replace(/ \?/g, '\u{a0}?').replace(/ :/g, '\u{a0}:');
    const m = t.match(/^(.+?[!?:.])[ ]+(\S.*)$/);
    if (m) return [m[1], m[2]];
    const words = t.split(' ');
    let best = 1, diff = Infinity;
    for (let i = 1; i < words.length; i++) { const dd = Math.abs(words.slice(0, i).join(' ').length - words.slice(i).join(' ').length); if (dd < diff) { diff = dd; best = i; } }
    return [words.slice(0, best).join(' '), words.slice(best).join(' ')];
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
    at: hour => hours.find(h => h.hour === hour),
    nightAt: hour => lightAt(hour * 60, sun, 0, null) < 0.2,
    scene: { ciel: skyOf(8, 18), sol: day.snow || day.snowOnGround ? 'neige' : day.rain ? 'flaques' : SEASONS[month].sol,
      vent: day.windy, chaud: day.warmest >= HEAT_WAVE, grandFroid: day.coldest < BIG_COLD },
    moon: moonOf(dateStr),
    daylight: `${Math.floor((sun.set - sun.rise) / 60)}\u{a0}h\u{a0}${String((sun.set - sun.rise) % 60).padStart(2, '0')} de clart\u{e9}`,
  };
  const xOf = (hr, w) => f(hr / 24 * w);
  function smooth(pts) {
    let d = `M${pts[0][0]} ${pts[0][1]}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      d += `C${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])} ${f(p2[1])}`;
    }
    return d;
  }
  const extremes = temps => { const r = temps.map(Math.round); return { min: Math.min(...r), max: Math.max(...r), iMin: r.indexOf(Math.min(...r)), iMax: r.indexOf(Math.max(...r)) }; };
  function curve24(d, w, h) {
    const plotTop = 30, plotBot = h - 58, stripY = h - 48, stripH = 24, cw = w / 24;
    const temps = d.hours.map(x => x.temp); const e = extremes(temps);
    const yOf = t => e.max === e.min ? (plotTop + plotBot) / 2 : plotBot - 10 - (t - e.min) / (e.max - e.min) * (plotBot - plotTop - 30);
    const pts = d.hours.map((hr, i) => [f(hr.hour * cw + cw / 2), f(yOf(hr.temp))]);
    let s = svgOpen(w, h);
    s += `<rect x="${xOf(8, w)}" y="${plotTop - 26}" width="${f(cw * 10)}" height="${plotBot - plotTop + 26}" fill="#ececec" stroke="none"/>`;
    s += `<text x="${f(xOf(18, w) - 6)}" y="${plotBot - 6}" font-size="14" font-weight="700" text-anchor="end" fill="${K}" class="halo">dehors, 8 h \u{e0} 17 h</text>`;
    d.hours.forEach((hr, i) => {
      const x = hr.hour * cw + cw / 2, y = plotTop - 12;
      if (hr.wet === 'rain') s += iconAt('icones/goutte', x - 6.6, y - 8.3, 13.2);
      if (hr.wet === 'snow') s += iconAt('icones/flocon', x - 8.75, y - 8.75, 17.5);
    });
    s += `<line x1="0" y1="${plotBot}" x2="${w}" y2="${plotBot}" stroke-width="2"/>`;
    s += `<path d="${smooth(pts)}" stroke-width="4"/>`;
    d.hours.forEach((hr, i) => {
      if (i % 3 === 0 || i === e.iMax || i === e.iMin) {
        const big = i === e.iMax || i === e.iMin;
        s += `<circle cx="${pts[i][0]}" cy="${pts[i][1]}" r="${big ? 6 : 4}" fill="${big ? K : W}" stroke-width="2"/>`;
        s += `<text x="${pts[i][0]}" y="${f(pts[i][1] - 11)}" font-size="${big ? 18 : 15}" font-weight="800" text-anchor="middle" fill="${K}" class="halo">${deg(hr.temp)}</text>`;
      }
    });
    for (let i = 0; i < 144; i++) s += `<rect x="${f(i * w / 144)}" y="${stripY}" width="${f(w / 144 + .6)}" height="${stripH}" fill="${gray(d.light10[i])}" stroke="none"/>`;
    s += `<rect x="0" y="${stripY}" width="${w}" height="${stripH}" stroke-width="2"/>`;
    [[d.sun.rise, '\u{2191}'], [d.sun.set, '\u{2193}']].forEach(([m, a]) => {
      const x = +xOf(m / 60, w);
      s += `<rect x="${f(x - 46)}" y="${stripY + 2}" width="92" height="${stripH - 4}" rx="10" fill="${W}" stroke-width="1.5"/>`;
      s += `<text x="${f(x)}" y="${stripY + 17}" font-size="14" font-weight="800" text-anchor="middle" fill="${K}" stroke="none">\u{2600}${a} ${hm(m)}</text>`;
    });
    for (let hr = 0; hr <= 24; hr += 3) s += `<text x="${xOf(hr, w)}" y="${h - 4}" font-size="14" text-anchor="${hr === 0 ? 'start' : hr === 24 ? 'end' : 'middle'}" fill="${K}" stroke="none">${hr} h</text>`;
    return s + '</svg>';
  }
  function cardsHTML(d) {
    const mini = (label, hour) => {
      const h = d.at(hour); if (!h) return '';
      const kind = d.skyOf(hour, hour + 1);
      return `<div>${svgOpen(62, 62)}${iconAt(meteoName(kind, d.nightAt(hour + .5)), 31 - 38.9, 30 - 38.9, 77.8)}</svg>
        <div><div class="small">${label}</div><div class="big">${deg(h.temp)}</div><div class="small">ressenti ${deg(h.feels)}</div></div></div>`;
    };
    // Arc du soleil : position \u{e0} 8 h, quand on part.
    const p = (8 * 60 - d.sun.rise) / (d.sun.set - d.sun.rise);
    const th = Math.PI * (1 - Math.max(-0.08, Math.min(1, p)));
    let arc = svgOpen(350, 104) + `<path d="M40 86A135 72 0 0 1 310 86" stroke-dasharray="6 6" stroke-width="2"/><line x1="10" y1="86" x2="340" y2="86" stroke-width="2.5"/>`;
    const sx = 175 + 135 * Math.cos(th), sy = 86 - 72 * Math.sin(th);
    arc += iconAt('icones/soleil', sx - 24.5, sy - 24.5, 49);
    arc += `<text x="${f(175 + 135 * Math.cos(th))}" y="${f(86 - 72 * Math.sin(th) - 26)}" font-size="13" font-weight="800" text-anchor="middle" fill="${K}" class="halo">\u{e0} 8 h</text>`;
    arc += `<text x="40" y="103" font-size="15" font-weight="800" text-anchor="middle" fill="${K}" stroke="none">${hm(d.sun.rise)}</text><text x="310" y="103" font-size="15" font-weight="800" text-anchor="middle" fill="${K}" stroke="none">${hm(d.sun.set)}</text>`;
    arc += `<text x="175" y="72" font-size="15" font-weight="700" text-anchor="middle" fill="${K}" stroke="none">${d.daylight}</text></svg>`;
    let phases = svgOpen(340, 30);
    for (let i = 0; i < 8; i++) { phases += iconAt(`icones/lune-${i}`, 22 + i * 42 - 11.1, 3.9, 22.2); if (i === d.moon.idx) phases += `<circle cx="${22 + i * 42}" cy="15" r="15" stroke-width="2.5"/>`; }
    phases += '</svg>';
    return `<div class="card"><h3>Le ciel</h3><div class="two">${mini('Ce matin', 8)}${mini('Cet apr\u{e8}s-midi', 15)}</div></div>
          <div class="card"><h3>Le soleil</h3>${arc}</div>
          <div class="card"><h3>La lune ce soir</h3>
            <div class="line">${svgOpen(84, 84)}${iconAt(`icones/lune-${d.moon.idx}`, 0, 0, 84)}</svg>
              <div><div style="font-size:20px;font-weight:800">${d.moon.name}</div><div class="small">${d.moon.idx === 0 ? 'On ne la voit presque pas.' : d.moon.idx === 4 ? 'Elle est toute ronde.' : d.moon.growing ? 'Elle grossit chaque soir.' : 'Elle rapetisse chaque soir.'}</div><div class="small">${d.moon.fullText}</div></div></div>
            ${phases}</div>`;
  }
  const n = out.stages.length, alt = out.stages.some(s => s.alt);
  const height = n >= 3 && alt ? 236 : n >= 3 ? 262 : 282;
  return {
    friendlyLines: twoLines(out.friendly),
    scene: sceneStack(d, 618, 448, 340),
    mannequins: stagesRow(d, height, { arrowLift: 102 + height * .42 }),
    cards: cardsHTML(d), chart: curve24(d, 1000, 196),
    sun, moon: d.moon, sceneLayers: sceneLayers(d),
  };
}
