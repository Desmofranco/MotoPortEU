// server/routes/scripts/runCountryPipeline.js

import { spawn } from "child_process";
import {
  parseCliArgs,
  getCountryConfig,
  listCountryScopes
} from "./lib/routeScopes.js";

const args = parseCliArgs();
const country = String(args.country || "IT").toUpperCase();
const onlyScope = args.scope ? String(args.scope) : null;

getCountryConfig(country);

const scopes = onlyScope ? [onlyScope] : listCountryScopes(country);

function runNodeScript(scriptPath, scriptArgs = []) {
  return new Promise((resolve, reject) => {
    const child = spawn("node", [scriptPath, ...scriptArgs], {
      stdio: "inherit",
      shell: process.platform === "win32"
    });

    child.on("error", reject);

    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${scriptPath} terminato con codice ${code}`));
    });
  });
}

async function main() {
  for (const scope of scopes) {
    console.log("\n======================================");
    console.log(`🚀 Pipeline avviata: ${country} / ${scope}`);
    console.log("======================================\n");

    const sharedArgs = [`--country=${country}`, `--scope=${scope}`];

    await runNodeScript("server/routes/scripts/googleRiderSpotsDiscovery.js", sharedArgs);
    await runNodeScript("server/routes/scripts/cleanRiderSpots.js", sharedArgs);
    await runNodeScript("server/routes/scripts/generateEuropeanRoutes.js", sharedArgs);
    await runNodeScript("server/routes/scripts/mergeRoutesIntoLiveDataset.js", sharedArgs);
  }

  console.log("\n🏁 Pipeline completata con successo.");
}

main().catch((err) => {
  console.error("\n❌ Errore pipeline:", err.message);
  process.exit(1);
});