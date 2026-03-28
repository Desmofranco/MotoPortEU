const fs = require("fs");
const fetch = require("node-fetch");

const OVERPASS = "https://overpass-api.de/api/interpreter";

// Bounding boxes (EU zone principali)
const AREAS = [
  { name: "Alpi", bbox: "44.0,5.0,48.5,15.5" },
  { name: "Dolomiti", bbox: "45.5,10.5,47.5,13.5" },
  { name: "Pirenei", bbox: "42.0,-2.0,43.5,3.5" },
  { name: "Balcani", bbox: "41.0,13.0,46.5,22.5" }
];

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function fetchArea(area) {
  console.log(`→ Fetch ${area.name}`);

  const query = `
  [out:json][timeout:25];
  (
    node["mountain_pass"="yes"](${area.bbox});
    way["mountain_pass"="yes"](${area.bbox});
    relation["mountain_pass"="yes"](${area.bbox});
  );
  out center;
  `;

  const res = await fetch(OVERPASS, {
    method: "POST",
    body: query
  });

  const data = await res.json();

  return data.elements
    .filter(e => e.tags && e.tags.name)
    .map(e => ({
      id: `pass-${e.id}`,
      name: e.tags.name,
      lat: e.lat || e.center?.lat,
      lon: e.lon || e.center?.lon,
      ele: e.tags.ele || null,
      region: area.name,
      type: "pass"
    }))
    .filter(p => p.lat && p.lon);
}

(async () => {
  let all = [];

  for (const area of AREAS) {
    try {
      const data = await fetchArea(area);
      console.log(`   trovati: ${data.length}`);
      all = all.concat(data);
      await sleep(2000);
    } catch (err) {
      console.log("❌ errore area", area.name);
    }
  }

  // dedup per nome + coords
  const map = new Map();
  all.forEach(p => {
    const key = `${p.name}-${p.lat.toFixed(3)}-${p.lon.toFixed(3)}`;
    map.set(key, p);
  });

  const cleaned = Array.from(map.values());

fs.writeFileSync(
  "./public/data/passes.generated.json",
  JSON.stringify(cleaned, null, 2)
);
  console.log("✅ Salvato passes.generated.json:", cleaned.length);
})();