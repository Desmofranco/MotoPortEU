import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const DATA_DIR = path.resolve(ROOT, "client/public/data");

const PREVIEW_PATH = path.resolve(DATA_DIR, "routes.generated.preview.json");
const ROUTES_PATH = path.resolve(DATA_DIR, "routes.json");
const ARCHIVE_DIR = path.resolve(DATA_DIR, "_archive");

function readJSON(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function writeJSON(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2), "utf8");
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function timestamp() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${yyyy}${mm}${dd}-${hh}${mi}${ss}`;
}

function asArray(maybe) {
  if (Array.isArray(maybe)) return maybe;
  if (Array.isArray(maybe?.routes)) return maybe.routes;
  if (Array.isArray(maybe?.items)) return maybe.items;
  if (Array.isArray(maybe?.data)) return maybe.data;
  return [];
}

function summarizeByType(items) {
  const map = new Map();
  for (const item of items) {
    const key = String(item?.type || "unknown");
    map.set(key, (map.get(key) || 0) + 1);
  }
  return Object.fromEntries([...map.entries()].sort((a, b) => a[0].localeCompare(b[0])));
}

function main() {
  if (!fs.existsSync(DATA_DIR)) {
    console.error("❌ DATA_DIR non trovata:", DATA_DIR);
    process.exit(1);
  }

  if (!fs.existsSync(PREVIEW_PATH)) {
    console.error("❌ Preview non trovata:", PREVIEW_PATH);
    process.exit(1);
  }

  const previewRaw = readJSON(PREVIEW_PATH);
  const preview = asArray(previewRaw);

  if (!preview.length) {
    console.error("❌ Preview vuota, pubblicazione annullata.");
    process.exit(1);
  }

  ensureDir(ARCHIVE_DIR);

  let previousRoutes = [];
  let backupPath = null;

  if (fs.existsSync(ROUTES_PATH)) {
    const routesRaw = readJSON(ROUTES_PATH);
    previousRoutes = asArray(routesRaw);

    backupPath = path.resolve(
      ARCHIVE_DIR,
      `routes.backup-before-publish-${timestamp()}.json`
    );

    writeJSON(backupPath, previousRoutes);
  }

  writeJSON(ROUTES_PATH, preview);

  const summary = summarizeByType(preview);

  console.log("✅ publishGeneratedRoutes completato");
  console.log("Preview letta:", path.basename(PREVIEW_PATH));
  console.log("Nuovo routes.json scritto:", path.basename(ROUTES_PATH));
  console.log("Elementi pubblicati:", preview.length);

  if (backupPath) {
    console.log("Backup creato:", path.basename(backupPath));
    console.log("Routes precedenti:", previousRoutes.length);
  } else {
    console.log("ℹ️ Nessun routes.json precedente da salvare.");
  }

  console.log("Breakdown per type:");
  for (const [type, count] of Object.entries(summary)) {
    console.log(`- ${type}: ${count}`);
  }
}

main();