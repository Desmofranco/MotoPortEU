// =======================================================
// server/scripts/runCountryPipeline.js
// MotoPortEU — Country Pipeline Orchestrator
// Esegue in sequenza:
// 1) Discovery
// 2) Clean
// 3) Generate routes
// 4) Merge into dataset
// 5) Publish opzionale su routes.json
// =======================================================

import path from "path";
import fs from "fs/promises";
import process from "process";
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { COUNTRY_SCOPES } from "./lib/routeScopes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "../..");

function parseArgs(argv) {
  const out = {};
  for (const raw of argv) {
    if (!raw.startsWith("--")) continue;
    const eq = raw.indexOf("=");
    if (eq === -1) {
      out[raw.slice(2)] = true;
    } else {
      const key = raw.slice(2, eq);
      const value = raw.slice(eq + 1);
      out[key] = value;
    }
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));

const country = String(args.country || "").trim().toUpperCase();
const singleScope = args.scope ? String(args.scope).trim() : null;
const allScopes = Boolean(args["all-scopes"] || !singleScope);
const publish = Boolean(args.publish);
const continueOnError = Boolean(args["continue-on-error"]);
const fromStep = String(args.from || "discovery").trim().toLowerCase();

const VALID_STEPS = ["discovery", "clean", "generate", "merge", "publish"];
const STEP_INDEX = Object.fromEntries(VALID_STEPS.map((s, i) => [s, i]));

if (!country) {
  console.error("❌ Manca --country=IT|FR|CH...");
  process.exit(1);
}

if (!COUNTRY_SCOPES[country]) {
  console.error(`❌ Country non supportato: ${country}`);
  process.exit(1);
}

if (!VALID_STEPS.includes(fromStep)) {
  console.error(
    `❌ --from non valido: ${fromStep}. Valori ammessi: ${VALID_STEPS.join(", ")}`
  );
  process.exit(1);
}

function getCountryScopes(countryCode) {
  const cfg = COUNTRY_SCOPES[countryCode] || {};

  // Caso moderno: COUNTRY_SCOPES.FR.scopes = { ... }
  if (cfg.scopes && typeof cfg.scopes === "object" && !Array.isArray(cfg.scopes)) {
    return Object.keys(cfg.scopes);
  }

  // Fallback legacy: scope direttamente sull'oggetto paese
  return Object.keys(cfg).filter((k) => !["country", "name", "scopes"].includes(k));
}
function shouldRun(stepName) {
  return STEP_INDEX[stepName] >= STEP_INDEX[fromStep];
}

function rel(p) {
  return path.relative(ROOT, p) || ".";
}

async function fileExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function readJsonSafe(p) {
  try {
    const raw = await fs.readFile(p, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function writeJson(p, data) {
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, JSON.stringify(data, null, 2), "utf8");
}

function buildArgs(scriptRel, extraArgs = []) {
  return [scriptRel, ...extraArgs];
}

function runNodeScript(scriptRel, extraArgs = []) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      buildArgs(scriptRel, extraArgs),
      {
        cwd: ROOT,
        stdio: "inherit",
        env: process.env,
      }
    );

    child.on("error", reject);

    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Script failed (${scriptRel}) with exit code ${code}`));
    });
  });
}

async function copyFileSafe(src, dest) {
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.copyFile(src, dest);
}

function getMergedScopeFile(countryCode, scopeName) {
  return path.resolve(
    ROOT,
    `client/public/data/routes.merged.${countryCode}.${scopeName}.json`
  );
}

function getCountryDatasetFile(countryCode) {
  return path.resolve(ROOT, `client/public/data/routes.country.${countryCode}.json`);
}

function getLiveRoutesFile() {
  return path.resolve(ROOT, "client/public/data/routes.json");
}

function getBackupLiveRoutesFile(countryCode) {
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  return path.resolve(
    ROOT,
    `client/public/data/_archive/routes.backup-before-${countryCode}-${ts}.json`
  );
}

async function mergeCountryOutputs(countryCode, scopes) {
  const countryOut = getCountryDatasetFile(countryCode);
  const mergedAll = [];
  const seen = new Set();

  for (const scopeName of scopes) {
    const fp = getMergedScopeFile(countryCode, scopeName);
    const exists = await fileExists(fp);
    if (!exists) {
      console.warn(`⚠️ File merged non trovato per scope ${scopeName}: ${rel(fp)}`);
      continue;
    }

    const arr = await readJsonSafe(fp);
    if (!Array.isArray(arr)) {
      console.warn(`⚠️ JSON non valido o non-array: ${rel(fp)}`);
      continue;
    }

    for (const route of arr) {
      const key =
        route?.id ||
        route?.slug ||
        [
          route?.name || "",
          route?.country || countryCode,
          route?.region || "",
          route?.start?.lat ?? route?.lat ?? "",
          route?.start?.lng ?? route?.lng ?? "",
          route?.end?.lat ?? "",
          route?.end?.lng ?? "",
        ].join("|");

      if (seen.has(key)) continue;
      seen.add(key);
      mergedAll.push(route);
    }
  }

  await writeJson(countryOut, mergedAll);
  return {
    file: countryOut,
    count: mergedAll.length,
  };
}

async function publishCountryDataset(countryCode) {
  const countryFile = getCountryDatasetFile(countryCode);
  const liveFile = getLiveRoutesFile();

  if (!(await fileExists(countryFile))) {
    throw new Error(`Dataset paese non trovato: ${rel(countryFile)}`);
  }

  if (await fileExists(liveFile)) {
    const backup = getBackupLiveRoutesFile(countryCode);
    await copyFileSafe(liveFile, backup);
    console.log(`🗂️ Backup live creato: ${rel(backup)}`);
  }

  await copyFileSafe(countryFile, liveFile);
  console.log(`🚀 Pubblicato su live: ${rel(liveFile)}`);
}

async function runScopePipeline(countryCode, scopeName) {
  console.log("====================================");
  console.log(`🏁 MotoPortEU — Pipeline Scope`);
  console.log(`🌍 Country: ${countryCode}`);
  console.log(`🧭 Scope: ${scopeName}`);
  console.log("====================================");

  if (shouldRun("discovery")) {
    console.log(`\n🔎 [1/4] Discovery → ${scopeName}`);
    await runNodeScript("server/scripts/googleRiderSpotsDiscovery.js", [
      `--country=${countryCode}`,
      `--scope=${scopeName}`,
    ]);
  } else {
    console.log(`⏭️ Discovery saltata (--from=${fromStep})`);
  }

  if (shouldRun("clean")) {
    console.log(`\n🧼 [2/4] Clean → ${scopeName}`);
    await runNodeScript("server/scripts/cleanRiderSpots.js", [
      `--country=${countryCode}`,
      `--scope=${scopeName}`,
    ]);
  } else {
    console.log(`⏭️ Clean saltata (--from=${fromStep})`);
  }

  if (shouldRun("generate")) {
    console.log(`\n🛣️ [3/4] Generate → ${scopeName}`);
    await runNodeScript("server/scripts/generateEuropeanRoutes.js", [
      `--country=${countryCode}`,
      `--scope=${scopeName}`,
    ]);
  } else {
    console.log(`⏭️ Generate saltata (--from=${fromStep})`);
  }

  if (shouldRun("merge")) {
    console.log(`\n🧩 [4/4] Merge → ${scopeName}`);
    await runNodeScript("server/scripts/mergeRoutesIntoLiveDataset.js", [
      `--country=${countryCode}`,
      `--scope=${scopeName}`,
    ]);
  } else {
    console.log(`⏭️ Merge saltato (--from=${fromStep})`);
  }

  const mergedFile = getMergedScopeFile(countryCode, scopeName);
  const mergedJson = await readJsonSafe(mergedFile);

  console.log("\n✅ Scope completato");
  console.log(`📄 Output merged: ${rel(mergedFile)}`);
  console.log(`📦 Rotte scope: ${Array.isArray(mergedJson) ? mergedJson.length : "n/d"}`);
}

async function main() {
  const scopes = singleScope
    ? [singleScope]
    : allScopes
      ? getCountryScopes(country)
      : [];

  if (!scopes.length) {
    console.error(`❌ Nessuno scope trovato per ${country}`);
    process.exit(1);
  }

  console.log("==================================================");
  console.log("MotoPortEU — Country Pipeline Orchestrator");
  console.log("==================================================");
  console.log(`Country:            ${country}`);
  console.log(`Scopes:             ${scopes.join(", ")}`);
  console.log(`From step:          ${fromStep}`);
  console.log(`Publish:            ${publish ? "YES" : "NO"}`);
  console.log(`Continue on error:  ${continueOnError ? "YES" : "NO"}`);
  console.log("==================================================\n");

  const summary = {
    country,
    scopesTotal: scopes.length,
    ok: [],
    failed: [],
  };

  for (const scopeName of scopes) {
    try {
      await runScopePipeline(country, scopeName);
      summary.ok.push(scopeName);
    } catch (err) {
      console.error(`\n❌ Errore nello scope ${scopeName}`);
      console.error(err?.message || err);

      summary.failed.push({
        scope: scopeName,
        error: err?.message || String(err),
      });

      if (!continueOnError) {
        throw err;
      }
    }

    console.log("\n");
  }

  console.log("====================================");
  console.log("🧱 Merge finale dataset paese");
  console.log("====================================");

  const mergeResult = await mergeCountryOutputs(country, summary.ok);

  console.log(`📄 File paese: ${rel(mergeResult.file)}`);
  console.log(`📦 Rotte paese: ${mergeResult.count}`);

  if (publish && shouldRun("publish")) {
    console.log("\n====================================");
    console.log("🚀 Publish LIVE");
    console.log("====================================");
    await publishCountryDataset(country);
  }

  console.log("\n====================================");
  console.log("✅ PIPELINE COMPLETATA");
  console.log("====================================");
  console.log(`Country: ${country}`);
  console.log(`Scope OK: ${summary.ok.length}/${summary.scopesTotal}`);
  if (summary.ok.length) {
    console.log(`✔ ${summary.ok.join(", ")}`);
  }
  if (summary.failed.length) {
    console.log(`✖ Failed: ${summary.failed.length}`);
    for (const f of summary.failed) {
      console.log(`- ${f.scope}: ${f.error}`);
    }
  }
  console.log(`📄 Dataset paese: ${rel(getCountryDatasetFile(country))}`);
  if (publish) {
    console.log(`🌐 LIVE: ${rel(getLiveRoutesFile())}`);
  }
}

main().catch((err) => {
  console.error("\n💥 Pipeline fallita");
  console.error(err?.stack || err?.message || err);
  process.exit(1);
});