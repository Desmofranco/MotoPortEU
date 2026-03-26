// =======================================================
// client/scripts/cleanup-route-files.cjs
// MotoPortEU — pulizia finale file routes/tracks
//
// USO:
//   node .\client\scripts\cleanup-route-files.cjs
//
// COSA FA:
// - sposta i backup/json intermedi in una cartella _archive
// - lascia puliti routes.json e tracks.json
// - non tocca i file finali attivi
// =======================================================

const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(process.cwd(), "client", "public", "data");
const ARCHIVE_DIR = path.join(DATA_DIR, "_archive");

const KEEP_FILES = new Set([
  "routes.json",
  "tracks.json",
]);

const MOVE_PATTERNS = [
  /^routes\.cleaned\.json$/i,
  /^tracks\.extracted\.json$/i,
  /^routes\.review\.json$/i,
  /^routes\.final\.json$/i,
  /^tracks\.final\.json$/i,
  /^routes\.json\.backup/i,
  /^tracks\.json\.backup/i,
  /^.*backup.*\.json$/i,
];

function shouldMove(filename) {
  if (KEEP_FILES.has(filename)) return false;
  return MOVE_PATTERNS.some((rx) => rx.test(filename));
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function moveFileSafe(src, dest) {
  if (fs.existsSync(dest)) {
    const ext = path.extname(dest);
    const base = dest.slice(0, dest.length - ext.length);
    const next = `${base}-${Date.now()}${ext}`;
    fs.renameSync(src, next);
    return next;
  }
  fs.renameSync(src, dest);
  return dest;
}

function main() {
  if (!fs.existsSync(DATA_DIR)) {
    console.error(`Cartella non trovata: ${DATA_DIR}`);
    process.exit(1);
  }

  ensureDir(ARCHIVE_DIR);

  const files = fs.readdirSync(DATA_DIR);
  const moved = [];

  for (const file of files) {
    const full = path.join(DATA_DIR, file);
    if (!fs.statSync(full).isFile()) continue;
    if (!shouldMove(file)) continue;

    const dest = path.join(ARCHIVE_DIR, file);
    const actualDest = moveFileSafe(full, dest);
    moved.push({ from: full, to: actualDest });
  }

  console.log("====================================");
  console.log("MotoPortEU — Cleanup completato");
  console.log("====================================");
  console.log(`Cartella archivio: ${ARCHIVE_DIR}`);
  console.log(`File spostati: ${moved.length}`);
  console.log("------------------------------------");

  if (!moved.length) {
    console.log("Nessun file da spostare.");
    return;
  }

  moved.forEach((m, i) => {
    console.log(`${i + 1}. ${path.basename(m.from)} -> ${m.to}`);
  });
}

main();