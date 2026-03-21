const fs = require("fs");

const FILE = "client/public/data/routes.json";
const BACKUP = `${FILE}.backup-routes-rider-v2`;

function readJSON(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n", "utf8");
}

function ensureBackup() {
  if (!fs.existsSync(BACKUP)) {
    fs.copyFileSync(FILE, BACKUP);
    console.log(`🛟 Backup creato: ${BACKUP}`);
  } else {
    console.log(`ℹ️ Backup già presente: ${BACKUP}`);
  }
}

function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function text(v) {
  return String(v || "").trim();
}

function lower(v) {
  return text(v).toLowerCase();
}

function classifyRoute(route) {
  const name = lower(route.name);
  const region = lower(route.region);
  const pace = lower(route.pace);
  const curves = num(route.curvesScore);
  const asphalt = num(route.asphaltScore);
  const distance = num(route.distanceKm);

  const blob = `${name} ${region} ${pace}`;

  const alpineHints = [
    "stelvio", "gavia", "pordoi", "sella", "fedaia", "falzarego", "gardena",
    "giau", "mortirolo", "bernina", "tonale", "manghen", "rolle", "dolomiti",
    "dolomites", "alpi", "alp", "passo", "col", "mountain"
  ];

  const scenicHints = [
    "lake", "lago", "coast", "coastal", "riviera", "mare", "sea", "valley",
    "vallata", "panorama", "panoramic", "costa"
  ];

  const fastHints = [
    "fast", "veloce", "rapido", "sweep", "sweeper", "sport", "sportivo"
  ];

  const isAlpine = alpineHints.some(k => blob.includes(k));
  const isScenic = scenicHints.some(k => blob.includes(k));
  const isFast = fastHints.some(k => blob.includes(k)) || (curves >= 7 && asphalt >= 8 && pace.includes("scorrevole"));
  const isTechnical = pace.includes("tecnico") || curves >= 8;
  const isLong = distance >= 120;
  const isShort = distance > 0 && distance <= 70;

  return {
    isAlpine,
    isScenic,
    isFast,
    isTechnical,
    isLong,
    isShort,
    curves,
    asphalt,
    distance,
    pace: pace || "scorrevole",
  };
}

function curvesText(score) {
  if (score >= 9) return "una sequenza continua di curve e tornanti da affrontare con precisione";
  if (score >= 7) return "un buon ritmo di curve, cambi di direzione e tratti guidati";
  if (score >= 5) return "una guida piacevole con curve ben distribuite e ritmo regolare";
  return "una percorrenza più scorrevole che tecnica, adatta a chi cerca fluidità";
}

function asphaltText(score) {
  if (score >= 9) return "L’asfalto è di ottimo livello e permette una guida pulita e molto appagante.";
  if (score >= 7) return "L’asfalto è generalmente buono, con fondo adatto a una guida dinamica e continua.";
  if (score >= 5) return "Il fondo resta discreto, ma in alcuni punti può richiedere più attenzione e una guida più rotonda.";
  return "Il fondo può essere irregolare o variabile e richiede maggiore attenzione, soprattutto nei tratti più rovinati.";
}

function distanceText(distance) {
  if (distance >= 180) return "È un itinerario importante, da vivere con tempo, testa libera e voglia di macinare chilometri veri.";
  if (distance >= 120) return "È una tratta adatta a una giornata piena in sella, con buon equilibrio tra piacere di guida e resistenza.";
  if (distance >= 70) return "La lunghezza lo rende perfetto per una mezza giornata intensa o come segmento centrale di un giro più ampio.";
  return "La distanza contenuta lo rende ideale anche per un’uscita breve ma molto soddisfacente.";
}

function introText(route, cls) {
  const name = text(route.name) || "Questo itinerario";
  const region = text(route.region);
  const where = region ? ` tra ${region}` : "";

  if (cls.isAlpine) {
    return `${name} è una delle strade più iconiche per chi ama la montagna in moto${where}.`;
  }

  if (cls.isFast) {
    return `${name} è un itinerario pensato per chi cerca guida fluida, ritmo e tanto piacere tra una curva e l’altra${where}.`;
  }

  if (cls.isScenic) {
    return `${name} unisce il piacere della moto a uno scenario molto forte dal punto di vista paesaggistico${where}.`;
  }

  if (cls.isTechnical) {
    return `${name} ha un carattere tecnico e coinvolgente, adatto a rider che amano guidare davvero${where}.`;
  }

  return `${name} è un itinerario stradale costruito per il piacere motociclistico, non per il semplice spostamento${where}.`;
}

function ridingText(cls) {
  const base = curvesText(cls.curves);

  if (cls.isAlpine) {
    return `Qui il protagonista è il ritmo della salita e della discesa, con ${base}.`;
  }

  if (cls.isFast) {
    return `Il percorso privilegia una guida rotonda e continua, con ${base}.`;
  }

  if (cls.isTechnical) {
    return `Richiede attenzione nella scelta della traiettoria e buon feeling con la moto, grazie a ${base}.`;
  }

  return `La guida resta appagante per tutta la percorrenza, con ${base}.`;
}

function paceText(cls) {
  if (cls.pace.includes("tecnico")) {
    return "Il ritmo ideale è tecnico e preciso, più da impostazione pulita che da velocità improvvisata.";
  }
  if (cls.pace.includes("scorrevole")) {
    return "Il ritmo migliore è scorrevole, con una guida rilassata ma sempre presente sul manubrio.";
  }
  if (cls.pace.includes("veloce")) {
    return "Invita a una guida più brillante, ma sempre con margine e lettura corretta della strada.";
  }
  return "Si presta bene a una guida da vero rider, mantenendo fluidità e attenzione per tutta la tratta.";
}

function buildDescription(route) {
  const cls = classifyRoute(route);

  return [
    introText(route, cls),
    ridingText(cls),
    asphaltText(cls.asphalt),
    paceText(cls),
    distanceText(cls.distance),
  ].join(" ");
}

function main() {
  ensureBackup();

  const data = readJSON(FILE);
  if (!Array.isArray(data)) {
    throw new Error("routes.json non è un array.");
  }

  const next = data.map(route => ({
    ...route,
    description: buildDescription(route),
  }));

  writeJSON(FILE, next);

  console.log(`✅ File aggiornato: ${FILE}`);
  console.log(`   - Route elaborate: ${next.length}`);
  console.log("🏁 Descrizioni rider v2 completate.");
}

main();