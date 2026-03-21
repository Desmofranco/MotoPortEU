#!/usr/bin/env node
/**
 * MotoPortEU — Descrizioni Rider Reali
 * ---------------------------------------------------------
 * Normalizza le descrizioni di tracks / routes:
 * - touring / road / asphalt -> tono rider stradale
 * - cross / enduro / offroad / dirt -> tono rider off-road
 * - sport / supersport / circuit / track -> tono sportivo
 *
 * ✅ Fa backup automatico
 * ✅ Aggiorna solo descrizioni vuote / deboli / troppo turistiche
 * ✅ Mantiene intatta la struttura degli oggetti
 *
 * USO:
 * node scripts/normalizeRiderDescriptions.js public/data/routes.json public/data/tracks.json
 *
 * oppure:
 * node scripts/normalizeRiderDescriptions.js public/data/routes.json
 */

const fs = require("fs");
const path = require("path");

const inputFiles = process.argv.slice(2);

if (!inputFiles.length) {
  console.log(`
Uso:
  node scripts/normalizeRiderDescriptions.js public/data/routes.json public/data/tracks.json
`);
  process.exit(1);
}

// ---------------------------------------------------------
// CONFIG
// ---------------------------------------------------------
const BACKUP_SUFFIX = ".backup-rider-descriptions";
const GENERIC_MIN_LEN = 90;

// parole chiave utili per classificazione
const ROAD_KEYS = [
  "touring",
  "tour",
  "road",
  "street",
  "asphalt",
  "paved",
  "scenic road",
  "mountain pass",
  "passo",
  "strada",
  "curve",
  "tornanti",
];

const OFFROAD_KEYS = [
  "cross",
  "enduro",
  "offroad",
  "off-road",
  "dirt",
  "gravel",
  "trail",
  "mx",
  "sterrato",
  "ghiaia",
  "terra",
  "sassi",
  "fango",
];

const SPORT_KEYS = [
  "supersport",
  "sport",
  "circuit",
  "track",
  "racetrack",
  "race",
  "motorsport",
  "circuito",
  "pista",
  "cordolo",
  "staccata",
];

const GENERIC_TOURISM_PATTERNS = [
  /paesagg/i,
  /panoram/i,
  /natura/i,
  /suggestiv/i,
  /ideale per una gita/i,
  /escursione/i,
  /relax/i,
  /rilassante/i,
  /alla scoperta/i,
  /luoghi incantevoli/i,
  /territorio/i,
  /bellissimi scorci/i,
  /perfetto per ammirare/i,
];

const GENERIC_WEAK_PATTERNS = [
  /^$/,
  /^n\/a$/i,
  /^no description$/i,
  /^description unavailable$/i,
  /^coming soon$/i,
  /^to be updated$/i,
  /^todo$/i,
  /^test$/i,
];

const DESCRIPTION_FIELDS = [
  "description",
  "desc",
  "summary",
  "details",
  "longDescription",
];

// ---------------------------------------------------------
// HELPERS
// ---------------------------------------------------------
function safeReadJSON(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw);
}

function safeWriteJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf8");
}

function ensureBackup(filePath) {
  const backupPath = `${filePath}${BACKUP_SUFFIX}`;
  if (!fs.existsSync(backupPath)) {
    fs.copyFileSync(filePath, backupPath);
    console.log(`🛟 Backup creato: ${backupPath}`);
  } else {
    console.log(`ℹ️ Backup già presente: ${backupPath}`);
  }
}

function norm(value) {
  if (value == null) return "";
  if (Array.isArray(value)) return value.join(" ").toLowerCase();
  return String(value).toLowerCase().trim();
}

function pickDescriptionField(item) {
  for (const key of DESCRIPTION_FIELDS) {
    if (key in item) return key;
  }
  return "description";
}

function getTextBlob(item) {
  return [
    item.name,
    item.title,
    item.type,
    item.category,
    item.surface,
    item.style,
    item.discipline,
    item.tags,
    item.terrain,
    item.kind,
    item.mode,
    item.description,
    item.desc,
    item.summary,
  ]
    .map(norm)
    .join(" | ");
}

function containsAny(text, keywords) {
  return keywords.some((k) => text.includes(k));
}

function scoreMatches(text, keywords) {
  return keywords.reduce((acc, k) => acc + (text.includes(k) ? 1 : 0), 0);
}

function classifyItem(item) {
  const blob = getTextBlob(item);

  const roadScore = scoreMatches(blob, ROAD_KEYS);
  const offroadScore = scoreMatches(blob, OFFROAD_KEYS);
  const sportScore = scoreMatches(blob, SPORT_KEYS);

  // precedenze sensate
  if (sportScore > roadScore && sportScore >= offroadScore && sportScore > 0) {
    return "sport";
  }

  if (offroadScore > roadScore && offroadScore >= sportScore && offroadScore > 0) {
    return "offroad";
  }

  if (roadScore > 0) return "road";

  // fallback per campi espliciti
  const surface = norm(item.surface);
  if (surface.includes("gravel") || surface.includes("dirt") || surface.includes("mud")) {
    return "offroad";
  }
  if (surface.includes("asphalt") || surface.includes("paved")) {
    return "road";
  }

  const type = norm(item.type);
  if (type.includes("track") || type.includes("circuit")) return "sport";
  if (type.includes("enduro") || type.includes("cross")) return "offroad";
  if (type.includes("tour") || type.includes("road")) return "road";

  return "road";
}

function isWeakDescription(text) {
  const t = norm(text);

  if (!t) return true;
  if (GENERIC_WEAK_PATTERNS.some((rx) => rx.test(t))) return true;
  if (t.length < GENERIC_MIN_LEN) return true;

  const tourismHits = GENERIC_TOURISM_PATTERNS.filter((rx) => rx.test(t)).length;
  if (tourismHits >= 2) return true;

  // se non contiene parole rider e sembra vago, la trattiamo come debole
  const hasRiderSignals =
    /(curve|tornanti|asfalto|carreggiata|ritmo|trazione|ghiaia|terra|sterrato|fondo|sassi|staccate|cordoli|traiettorie|aderenza|tecnico|off-road|offroad)/i.test(
      t
    );

  if (!hasRiderSignals && t.length < 220) return true;

  return false;
}

function buildRoadDescription(item) {
  const name = item.name || item.title || "Questo itinerario";
  const surface = norm(item.surface);
  const hasMountainHints = /(pass|alp|mountain|dolomit|stelvio|gavia|futa|muraglione|col|summit|peak|step)/i.test(
    getTextBlob(item)
  );

  const line1 = `${name} è pensato per una guida stradale coinvolgente, con un ritmo da vero rider e non da semplice turista.`;

  const line2 = hasMountainHints
    ? "Il percorso alterna curve, cambi di direzione e tratti panoramici che premiano precisione, fluidità e piacere di guida, soprattutto nei passaggi più guidati."
    : "Il percorso offre una guida fluida e appagante, con curve scorrevoli, ritmo regolare e tratti che valorizzano il piacere motociclistico più della semplice destinazione.";

  const line3 =
    surface.includes("asphalt") || surface.includes("paved")
      ? "Il fondo è prevalentemente asfaltato e generalmente regolare, con possibili variazioni di aderenza o traffico nei periodi più frequentati."
      : "L’asfalto è in genere valido per il mototurismo e la guida dinamica, pur con possibili variazioni di fondo o traffico a seconda della zona e della stagione.";

  const line4 =
    "Ideale per rider che cercano curve, panorama e continuità di guida in un contesto adatto a uscite medio-lunghe.";

  return [line1, line2, line3, line4].join(" ");
}

function buildOffroadDescription(item) {
  const name = item.name || item.title || "Questo tracciato";
  const terrain = norm(item.terrain);
  const surface = norm(item.surface);

  const line1 = `${name} ha un’impronta chiaramente off-road, con una guida più fisica e tecnica rispetto a un normale percorso touring.`;

  const line2 =
    terrain.includes("rock") || surface.includes("rock") || surface.includes("stone")
      ? "Il fondo può alternare terra, ghiaia e passaggi più sconnessi, con pietre, irregolarità e tratti che richiedono attenzione nella scelta della traiettoria."
      : "Il fondo può alternare terra, ghiaia e sezioni irregolari, con punti che richiedono trazione, controllo della moto e buona sensibilità sullo sterrato.";

  const line3 =
    "La difficoltà può cambiare rapidamente in base a meteo, polvere, fango o usura del terreno, quindi è un percorso da affrontare con approccio rider e non turistico.";

  const line4 =
    "Adatto a enduro, dual sport e maxi-enduro con esperienza, soprattutto nei tratti più impegnativi o scivolosi.";

  return [line1, line2, line3, line4].join(" ");
}

function buildSportDescription(item) {
  const name = item.name || item.title || "Questo tracciato";

  const line1 = `${name} è orientato a una guida sportiva, precisa e intensa, pensata per chi cerca tecnica, ritmo e controllo.`;

  const line2 =
    "Il layout valorizza ingressi puliti, cambi di direzione, accelerazioni decise e gestione accurata delle traiettorie, con sezioni che mettono alla prova concentrazione e feeling.";

  const line3 =
    "Il fondo e la configurazione invitano a una lettura più aggressiva del percorso, dove staccate, percorrenza e uscita di curva fanno la differenza.";

  const line4 =
    "Ideale per rider sportivi che vogliono una descrizione coerente con la guida reale e non un testo generico da catalogo turistico.";

  return [line1, line2, line3, line4].join(" ");
}

function buildDescriptionByClass(item, cls) {
  switch (cls) {
    case "offroad":
      return buildOffroadDescription(item);
    case "sport":
      return buildSportDescription(item);
    case "road":
    default:
      return buildRoadDescription(item);
  }
}

function processItem(item) {
  if (!item || typeof item !== "object" || Array.isArray(item)) {
    return { item, changed: false, reason: "not-object" };
  }

  const descField = pickDescriptionField(item);
  const currentDescription = item[descField] ?? "";
  const classification = classifyItem(item);

  if (!isWeakDescription(currentDescription)) {
    return { item, changed: false, reason: "already-good", classification };
  }

  const nextDescription = buildDescriptionByClass(item, classification);

  return {
    item: {
      ...item,
      [descField]: nextDescription,
    },
    changed: true,
    reason: "normalized",
    classification,
  };
}

function processArray(data) {
  let changedCount = 0;
  let roadCount = 0;
  let offroadCount = 0;
  let sportCount = 0;

  const next = data.map((item) => {
    const result = processItem(item);

    if (result.changed) {
      changedCount += 1;
      if (result.classification === "road") roadCount += 1;
      if (result.classification === "offroad") offroadCount += 1;
      if (result.classification === "sport") sportCount += 1;
    }

    return result.item;
  });

  return {
    next,
    stats: {
      changedCount,
      roadCount,
      offroadCount,
      sportCount,
      total: data.length,
    },
  };
}

// supporta sia array puro sia oggetti tipo { routes: [...] } o { tracks: [...] }
function processJsonRoot(data) {
  if (Array.isArray(data)) {
    return processArray(data);
  }

  if (data && typeof data === "object") {
    const clone = { ...data };
    let globalChanged = 0;
    let globalRoad = 0;
    let globalOffroad = 0;
    let globalSport = 0;
    let foundArray = false;

    for (const key of Object.keys(clone)) {
      if (Array.isArray(clone[key])) {
        foundArray = true;
        const { next, stats } = processArray(clone[key]);
        clone[key] = next;
        globalChanged += stats.changedCount;
        globalRoad += stats.roadCount;
        globalOffroad += stats.offroadCount;
        globalSport += stats.sportCount;
      }
    }

    if (foundArray) {
      return {
        next: clone,
        stats: {
          changedCount: globalChanged,
          roadCount: globalRoad,
          offroadCount: globalOffroad,
          sportCount: globalSport,
          total: "multi-array-root",
        },
      };
    }
  }

  throw new Error("Formato JSON non supportato: atteso array oppure oggetto con array interni.");
}

// ---------------------------------------------------------
// RUN
// ---------------------------------------------------------
for (const relativeFile of inputFiles) {
  const filePath = path.resolve(process.cwd(), relativeFile);

  if (!fs.existsSync(filePath)) {
    console.error(`❌ File non trovato: ${filePath}`);
    continue;
  }

  try {
    console.log(`\n📂 Elaboro: ${filePath}`);

    ensureBackup(filePath);

    const data = safeReadJSON(filePath);
    const { next, stats } = processJsonRoot(data);

    safeWriteJSON(filePath, next);

    console.log(`✅ File aggiornato: ${filePath}`);
    console.log(`   - Record modificati: ${stats.changedCount}`);
    console.log(`   - Road/Touring:      ${stats.roadCount}`);
    console.log(`   - Offroad/Cross:     ${stats.offroadCount}`);
    console.log(`   - Sport/Pista:       ${stats.sportCount}`);
    console.log(`   - Totale:            ${stats.total}`);
  } catch (err) {
    console.error(`❌ Errore su ${filePath}: ${err.message}`);
  }
}

console.log("\n🏁 Normalizzazione completata.");