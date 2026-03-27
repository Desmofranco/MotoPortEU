// server/scripts/googlePassDiscovery.js

import fetch from "node-fetch";

const API_KEY = process.env.GOOGLE_PLACES_KEY;

const KEYWORDS = [
  "passo",
  "pass",
  "col",
  "joch"
];

const AREAS = [
  { name: "Alpi Italia", lat: 46.5, lng: 10.5 },
  { name: "Alpi Francia", lat: 45.8, lng: 6.5 },
  { name: "Svizzera", lat: 46.8, lng: 8.2 },
  { name: "Austria", lat: 47.3, lng: 13.3 }
];

async function searchPlaces(keyword, lat, lng) {
  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${keyword}&location=${lat},${lng}&radius=50000&key=${API_KEY}`;

  const res = await fetch(url);
  const data = await res.json();

  return data.results || [];
}

function isRealPass(name) {
  const n = name.toLowerCase();

  return (
    n.includes("passo") ||
    n.includes("pass") ||
    n.includes("col") ||
    n.includes("joch")
  );
}

async function run() {
  let all = [];

  for (const area of AREAS) {
    console.log(`→ ${area.name}`);

    for (const k of KEYWORDS) {
      const results = await searchPlaces(k, area.lat, area.lng);

      const filtered = results.filter(p =>
        isRealPass(p.name)
      );

      console.log(`   ${k}: ${filtered.length}`);

      all.push(...filtered);
    }
  }

  // dedup
  const unique = {};
  all.forEach(p => {
    unique[p.place_id] = p;
  });

  const final = Object.values(unique);

  console.log(`\nTotale trovati: ${final.length}`);

  return final;
}

run();