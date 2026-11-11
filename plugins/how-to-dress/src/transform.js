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

// Where each piece sits on the mannequin, as [x, y, width, height, mirrored] in a
// 200 × 414 drawing (viewBox 0 -14 200 414). Pieces are listed in drawing order.
const MANNEQUIN = { viewBox: '0 -14 200 414', width: 200, height: 414 };
const BOXES = {
  legs: [[55, 200, 90, 150]],
  bottom: [[50, 195, 100, 160]],
  short: [[50, 195, 100, 100]],
  jupe: [[38, 182, 124, 112]],
  feet: [[40, 336, 62, 58, true], [98, 336, 62, 58, false]],
  top: [[25, 82, 150, 150]],
  robe: [[38, 80, 124, 236]],
  warm: [[22, 80, 156, 156]],
  pants: [[44, 168, 112, 196]],
  coat: [[16, 76, 168, 186]],
  neck: [[76, 60, 48, 42]],
  head: [[54, -16, 92, 76]],
  hands: [[12, 196, 46, 46, false], [142, 196, 46, 46, true]],
};
const DRAW_ORDER = ['legs', 'bottom', 'feet', 'top', 'warm', 'pants', 'coat', 'neck', 'head', 'hands'];

// ---------- Reading the forecast ----------

function hoursOfWindow(hourly) {
  const hours = [];
  hourly.time.forEach((time, i) => {
    const hour = Number(time.slice(11, 13));
    if (hour < OUTDOOR_WINDOW.first || hour > OUTDOOR_WINDOW.last) return;
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
  const list = [];
  DRAW_ORDER.forEach(slot => {
    const key = items[slot];
    if (!key) return;
    const boxes = slot === 'bottom' && (key === 'short' || key === 'jupe') ? BOXES[key]
      : slot === 'top' && key === 'robe' ? BOXES.robe
        : BOXES[slot];
    boxes.forEach(([x, y, w, h, mirrored]) => list.push({ key, x, y, w, h, mirrored: !!mirrored }));
  });
  return list;
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

  return {
    date: date.text,
    friendly: lines[date.dayOfYear % lines.length],
    sentence: weatherSentence(hours, day),
    chart: chartOf(hours),
    outfit,
    alt,
    mannequin: MANNEQUIN,
    stages: stagesOf(outfit, alt),
  };
}
