import fs from "fs/promises";
import path from "path";
import process from "process";
import {
  parseCliArgs,
  getScopeConfig,
  getScopeSuffix,
} from "./lib/routeScopes.js";

// =======================================================
// server/scripts/buildEuropeanScopeSeed.js
// MotoPortEU — Build Local Seed Dataset by Country / Scope
// Output:
// client/public/data/rider-spots.seed.{scopeSuffix}.json
// =======================================================

const args = parseCliArgs();
const country = String(args.country || "CH").toUpperCase();
const scope = args.scope ? String(args.scope) : null;
const mode = String(args.mode || "overwrite").toLowerCase(); // overwrite | append

const scopeCfg = getScopeConfig({ country, scope });
const scopeSuffix = getScopeSuffix({ country, scope });

const OUT_PATH = path.resolve(
  `client/public/data/rider-spots.seed.${scopeSuffix}.json`
);

function slugify(str = "") {
  return String(str)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function norm(str = "") {
  return String(str)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function normalizeText(str = "") {
  return norm(str).replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function uniq(arr = []) {
  return [...new Set(arr.filter(Boolean))];
}

function inferSpotType(areaName = "", scopeName = "", forcedRideType = "") {
  if (forcedRideType === "mountain") return "mountain_pass";
  if (forcedRideType === "lake") return "lake_view";
  if (forcedRideType === "coastal") return "coastal_view";
  if (forcedRideType === "forest") return "forest_road";

  const text = normalizeText(`${areaName} ${scopeName}`);

  if (
    /\b(pass|passo|col|joch|furka|grimsel|susten|nufenen|gotthard|oberalp|bernina|san bernardino|simplon|stelvio|gavia|grossglockner|timmelsjoch|galibier|izoard|bonette|tourmalet)\b/.test(
      text
    )
  ) {
    return "mountain_pass";
  }

  if (/\b(lake|lago|lac|see)\b/.test(text)) {
    return "lake_view";
  }

  if (/\b(coast|coastal|riviera|sea|mare|fjord|fiordo)\b/.test(text)) {
    return "coastal_view";
  }

  if (/\b(forest|foresta|bosco|highland)\b/.test(text)) {
    return "forest_road";
  }

  return "scenic_road";
}

function inferRideType(
  type = "",
  areaName = "",
  scopeName = "",
  forcedRideType = ""
) {
  if (forcedRideType) return forcedRideType;
  if (type === "mountain_pass") return "mountain";
  if (type === "lake_view") return "lake";
  if (type === "coastal_view") return "coastal";
  if (type === "forest_road") return "forest";

  const text = normalizeText(`${areaName} ${scopeName}`);
  if (/\b(lake|lago|lac|see)\b/.test(text)) return "lake";
  if (/\b(coast|coastal|riviera|sea|mare|fjord|fiordo)\b/.test(text)) {
    return "coastal";
  }
  if (/\b(forest|foresta|bosco|highland)\b/.test(text)) return "forest";
  if (
    /\b(pass|passo|col|joch|alps|alp|mountain|grimsel|furka|bernina|gotthard|oberalp|san bernardino|simplon)\b/.test(
      text
    )
  ) {
    return "mountain";
  }

  return "scenic";
}

function inferTags(areaName = "", scopeName = "", rideType = "") {
  const text = normalizeText(`${areaName} ${scopeName}`);
  const tags = ["rider", "seed", "local-scope"];

  if (rideType) tags.push(rideType);

  if (/\b(panorama|panoramic|view|belvedere|lookout|scenic)\b/.test(text)) {
    tags.push("panoramic", "scenic");
  }

  if (/\b(pass|passo|col|joch)\b/.test(text)) {
    tags.push("pass");
  }

  if (/\b(lake|lago|lac|see)\b/.test(text)) {
    tags.push("lake");
  }

  if (/\b(coast|coastal|riviera|sea|mare|fjord|fiordo)\b/.test(text)) {
    tags.push("coast");
  }

  if (/\b(forest|foresta|bosco)\b/.test(text)) {
    tags.push("forest");
  }

  if (
    /\b(furka|grimsel|susten|bernina|gotthard|oberalp|san bernardino|simplon|nufenen)\b/.test(
      text
    )
  ) {
    tags.push("iconic");
  }

  return uniq(tags);
}

function buildSeedRegion(areaName = "", fallbackRegions = []) {
  const name = String(areaName || "").trim();
  if (!name) return fallbackRegions?.[0] || null;

  const pieces = name
    .split("/")
    .map((x) => x.trim())
    .filter(Boolean);
  if (pieces.length > 1) return pieces[0];

  return fallbackRegions?.[0] || name;
}

function buildSeedAddress(areaName = "", scopeCfg) {
  const scopeName = scopeCfg?.scopeName || scopeCfg?.countryName || "";
  return `${areaName}, ${scopeName}`;
}

// -------------------------------------------------------
// MANUAL SEEDS
// -------------------------------------------------------

const MANUAL_SCOPE_SEEDS = {
  CH: {
    "switzerland-west": [
      { name: "Lac Léman / Lavaux", lat: 46.48, lng: 6.78, rideType: "scenic" },
      { name: "Montreux", lat: 46.4312, lng: 6.9107, rideType: "scenic" },
      { name: "Aigle", lat: 46.3176, lng: 6.9692, rideType: "scenic" },
      { name: "Col des Mosses", lat: 46.402, lng: 7.102, rideType: "mountain" },
      { name: "Col du Pillon", lat: 46.3509, lng: 7.2051, rideType: "mountain" },
      { name: "Sion", lat: 46.2331, lng: 7.3606, rideType: "scenic" },
      { name: "Crans-Montana", lat: 46.3099, lng: 7.4786, rideType: "mountain" },
      { name: "Verbier", lat: 46.0964, lng: 7.2286, rideType: "mountain" },
      { name: "Martigny", lat: 46.103, lng: 7.0724, rideType: "scenic" },
      { name: "Great St Bernard Approach", lat: 45.8689, lng: 7.1661, rideType: "mountain" },
      { name: "Neuchâtel", lat: 46.9896, lng: 6.9293, rideType: "lake" },
      { name: "Jura Sud / Vue des Alpes", lat: 47.0721, lng: 6.8643, rideType: "mountain" },
    ],

    "switzerland-central": [
      { name: "Interlaken", lat: 46.6863, lng: 7.8632, rideType: "scenic" },
      { name: "Grindelwald", lat: 46.6242, lng: 8.0414, rideType: "mountain" },
      { name: "Meiringen", lat: 46.7285, lng: 8.1872, rideType: "mountain" },
      { name: "Grimsel Pass", lat: 46.5624, lng: 8.3367, rideType: "mountain" },
      { name: "Susten Pass", lat: 46.7179, lng: 8.4376, rideType: "mountain" },
      { name: "Furka Pass", lat: 46.5722, lng: 8.4158, rideType: "mountain" },
      { name: "Andermatt", lat: 46.6356, lng: 8.5944, rideType: "mountain" },
      { name: "Gotthard Pass", lat: 46.5602, lng: 8.561, rideType: "mountain" },
      { name: "Oberalp Pass", lat: 46.6593, lng: 8.6719, rideType: "mountain" },
      { name: "Lucerne", lat: 47.0502, lng: 8.3093, rideType: "lake" },
      { name: "Vierwaldstättersee Panorama", lat: 46.9976, lng: 8.4823, rideType: "lake" },
      { name: "Brünig Pass", lat: 46.7574, lng: 8.1326, rideType: "mountain" },
    ],

    "switzerland-east": [
      { name: "Davos", lat: 46.8027, lng: 9.836, rideType: "mountain" },
      { name: "Flüela Pass", lat: 46.7495, lng: 9.9499, rideType: "mountain" },
      { name: "Albula Pass", lat: 46.5838, lng: 9.8396, rideType: "mountain" },
      { name: "Julier Pass", lat: 46.4687, lng: 9.7236, rideType: "mountain" },
      { name: "St. Moritz", lat: 46.497, lng: 9.838, rideType: "mountain" },
      { name: "Bernina Pass", lat: 46.4105, lng: 10.0207, rideType: "mountain" },
      { name: "Chur", lat: 46.8508, lng: 9.5329, rideType: "scenic" },
      { name: "Oberalp East Approach", lat: 46.7047, lng: 8.9158, rideType: "mountain" },
      { name: "Splügen Pass", lat: 46.5079, lng: 9.3237, rideType: "mountain" },
      { name: "San Bernardino North Approach", lat: 46.4633, lng: 9.1908, rideType: "mountain" },
      { name: "Walensee Panorama", lat: 47.1188, lng: 9.2873, rideType: "lake" },
      { name: "Glarus Alps Gateway", lat: 47.0411, lng: 9.0681, rideType: "mountain" },
    ],

    ticino: [
      { name: "Bellinzona", lat: 46.1946, lng: 9.0244, rideType: "scenic" },
      { name: "Monte Ceneri", lat: 46.1219, lng: 8.9096, rideType: "scenic" },
      { name: "Lugano", lat: 46.0037, lng: 8.9511, rideType: "lake" },
      { name: "Monte Generoso", lat: 45.9308, lng: 9.0219, rideType: "mountain" },
      { name: "Locarno", lat: 46.1696, lng: 8.7995, rideType: "lake" },
      { name: "Centovalli", lat: 46.1786, lng: 8.6573, rideType: "scenic" },
      { name: "Val Verzasca", lat: 46.2614, lng: 8.8402, rideType: "scenic" },
      { name: "Biasca", lat: 46.3596, lng: 8.9699, rideType: "scenic" },
      { name: "Airolo", lat: 46.5276, lng: 8.6118, rideType: "mountain" },
      { name: "Nufenen South Approach", lat: 46.4721, lng: 8.4002, rideType: "mountain" },
      { name: "San Bernardino Pass", lat: 46.4628, lng: 9.1936, rideType: "mountain" },
      { name: "Maggia Valley", lat: 46.2471, lng: 8.7083, rideType: "scenic" },
    ],
  },

  AT: {
    tyrol: [
      { name: "Innsbruck", lat: 47.2692, lng: 11.4041, rideType: "scenic" },
      { name: "Kühtai", lat: 47.2146, lng: 11.0215, rideType: "mountain" },
      { name: "Timmelsjoch", lat: 46.9052, lng: 11.0855, rideType: "mountain" },
      { name: "Ötztal", lat: 46.9597, lng: 10.9337, rideType: "mountain" },
      { name: "Silvretta Hochalpenstraße", lat: 46.9146, lng: 10.0918, rideType: "mountain" },
      { name: "Montafon", lat: 47.0804, lng: 9.9726, rideType: "scenic" },
      { name: "Arlberg Pass", lat: 47.1286, lng: 10.2014, rideType: "mountain" },
      { name: "Lech am Arlberg", lat: 47.2109, lng: 10.1424, rideType: "mountain" },
      { name: "Kaunertal Glacier Road", lat: 46.9168, lng: 10.7386, rideType: "mountain" },
      { name: "Reschenpass East Approach", lat: 46.8345, lng: 10.5072, rideType: "mountain" },
      { name: "Zillertal High Road", lat: 47.2729, lng: 11.8751, rideType: "mountain" },
      { name: "Achensee Panorama", lat: 47.4411, lng: 11.7042, rideType: "lake" },
    ],

    salzburg: [
      { name: "Grossglockner High Alpine Road", lat: 47.1232, lng: 12.815, rideType: "mountain" },
      { name: "Fusch an der Großglocknerstraße", lat: 47.2239, lng: 12.8214, rideType: "mountain" },
      { name: "Zell am See", lat: 47.3235, lng: 12.7969, rideType: "lake" },
      { name: "Kaprun", lat: 47.2711, lng: 12.7587, rideType: "mountain" },
      { name: "Saalbach", lat: 47.3914, lng: 12.6364, rideType: "mountain" },
      { name: "Tennengebirge", lat: 47.4754, lng: 13.2904, rideType: "mountain" },
      { name: "Dachstein South Access", lat: 47.4668, lng: 13.6111, rideType: "mountain" },
      { name: "Salzkammergut Panorama", lat: 47.7313, lng: 13.4472, rideType: "lake" },
      { name: "Wolfgangsee", lat: 47.7397, lng: 13.4489, rideType: "lake" },
      { name: "Obertauern", lat: 47.2525, lng: 13.5507, rideType: "mountain" },
      { name: "Nockalm North Link", lat: 47.0362, lng: 13.7346, rideType: "mountain" },
      { name: "Gerlos Alpine Link", lat: 47.2339, lng: 12.0447, rideType: "mountain" },
    ],

    carinthia: [
      { name: "Nockalmstraße", lat: 46.9449, lng: 13.7708, rideType: "mountain" },
      { name: "Bad Kleinkirchheim", lat: 46.8137, lng: 13.7813, rideType: "mountain" },
      { name: "Villach", lat: 46.6103, lng: 13.8558, rideType: "scenic" },
      { name: "Wurzenpass", lat: 46.5145, lng: 13.7487, rideType: "mountain" },
      { name: "Nassfeld Pass", lat: 46.5615, lng: 13.2762, rideType: "mountain" },
      { name: "Klagenfurt", lat: 46.6365, lng: 14.3122, rideType: "scenic" },
      { name: "Wörthersee", lat: 46.6383, lng: 14.1406, rideType: "lake" },
      { name: "Millstätter See", lat: 46.8074, lng: 13.5802, rideType: "lake" },
      { name: "Malta Hochalmstraße", lat: 46.9675, lng: 13.5094, rideType: "mountain" },
      { name: "Katschberg Pass", lat: 47.0624, lng: 13.6163, rideType: "mountain" },
      { name: "Villacher Alpenstraße", lat: 46.5627, lng: 13.6643, rideType: "mountain" },
      { name: "Turracher Höhe", lat: 46.9155, lng: 13.8747, rideType: "mountain" },
    ],

    "austria-west": [
      { name: "Bregenzerwald", lat: 47.3607, lng: 9.9347, rideType: "scenic" },
      { name: "Hochtannberg Pass", lat: 47.2582, lng: 10.1085, rideType: "mountain" },
      { name: "Faschinajoch", lat: 47.2496, lng: 9.8923, rideType: "mountain" },
      { name: "Lechtal", lat: 47.2945, lng: 10.6206, rideType: "scenic" },
      { name: "Hahntennjoch", lat: 47.2416, lng: 10.7574, rideType: "mountain" },
      { name: "Kaunertal", lat: 46.9159, lng: 10.7464, rideType: "mountain" },
      { name: "Pitztal", lat: 47.0862, lng: 10.8887, rideType: "mountain" },
      { name: "Tannheimer Tal", lat: 47.4977, lng: 10.5323, rideType: "scenic" },
      { name: "Reschenpass", lat: 46.8345, lng: 10.5072, rideType: "mountain" },
      { name: "Silvretta West Link", lat: 46.9605, lng: 10.0186, rideType: "mountain" },
      { name: "Bielerhöhe", lat: 46.9141, lng: 10.0911, rideType: "mountain" },
      { name: "Fernpass Approach", lat: 47.3658, lng: 10.8166, rideType: "mountain" },
    ],
  },
    DE: {
    "germany-alps-bavaria": [
      { name: "Berchtesgaden", lat: 47.6306, lng: 13.0006, rideType: "mountain" },
      { name: "Rossfeld Panoramastraße", lat: 47.6646, lng: 13.0484, rideType: "mountain" },
      { name: "Königssee", lat: 47.5937, lng: 12.9898, rideType: "lake" },
      { name: "Ramsau", lat: 47.6063, lng: 12.8998, rideType: "scenic" },
      { name: "Garmisch-Partenkirchen", lat: 47.4921, lng: 11.0955, rideType: "mountain" },
      { name: "Zugspitze South Approach", lat: 47.4211, lng: 10.9858, rideType: "mountain" },
      { name: "Mittenwald", lat: 47.4415, lng: 11.2612, rideType: "scenic" },
      { name: "Walchensee", lat: 47.5933, lng: 11.3513, rideType: "lake" },
      { name: "Kochel am See", lat: 47.657, lng: 11.3649, rideType: "lake" },
      { name: "Sudelfeld Pass", lat: 47.6674, lng: 12.0607, rideType: "mountain" },
      { name: "Tatzelwurmstraße", lat: 47.7049, lng: 12.0135, rideType: "mountain" },
      { name: "Allgäu Alpine Link", lat: 47.5712, lng: 10.2797, rideType: "mountain" },
    ],

    "germany-black-forest": [
      { name: "Freudenstadt", lat: 48.466, lng: 8.411, rideType: "scenic" },
      { name: "Schwarzwaldhochstraße", lat: 48.6728, lng: 8.2157, rideType: "mountain" },
      { name: "Mummelsee", lat: 48.6169, lng: 8.2004, rideType: "lake" },
      { name: "Baden-Baden Hinterland", lat: 48.7606, lng: 8.2398, rideType: "scenic" },
      { name: "Titisee", lat: 47.9002, lng: 8.1537, rideType: "lake" },
      { name: "Schluchsee", lat: 47.8214, lng: 8.1766, rideType: "lake" },
      { name: "Feldberg Pass", lat: 47.8738, lng: 8.0035, rideType: "mountain" },
      { name: "Todtnau", lat: 47.829, lng: 7.9445, rideType: "mountain" },
      { name: "Hexenloch", lat: 48.0958, lng: 8.1776, rideType: "scenic" },
      { name: "Wutach Gorge Ridge Road", lat: 47.8465, lng: 8.3423, rideType: "scenic" },
      { name: "Triberg Waterfall Road", lat: 48.1316, lng: 8.2338, rideType: "scenic" },
      { name: "Black Forest South Crest", lat: 47.7194, lng: 7.9515, rideType: "mountain" },
    ],

    "germany-eifel-mosel": [
      { name: "Eifel", lat: 50.332, lng: 6.623, rideType: "scenic" },
      { name: "Nürburgring Hinterland", lat: 50.3356, lng: 6.9475, rideType: "mountain" },
      { name: "Adenau", lat: 50.3816, lng: 6.9327, rideType: "scenic" },
      { name: "Monschau", lat: 50.5549, lng: 6.2406, rideType: "scenic" },
      { name: "Mosel Valley", lat: 49.9101, lng: 7.0744, rideType: "scenic" },
      { name: "Cochem", lat: 50.1451, lng: 7.1669, rideType: "scenic" },
      { name: "Bernkastel-Kues", lat: 49.9167, lng: 7.0667, rideType: "scenic" },
      { name: "Zell Mosel", lat: 50.0296, lng: 7.1824, rideType: "scenic" },
      { name: "Vulkaneifel Ridge", lat: 50.2146, lng: 6.8391, rideType: "mountain" },
      { name: "Laacher See", lat: 50.4178, lng: 7.2739, rideType: "lake" },
      { name: "Ahr Valley Twisties", lat: 50.5446, lng: 7.1159, rideType: "scenic" },
      { name: "Eifel High Road", lat: 50.4474, lng: 6.4815, rideType: "mountain" },
    ],
  },
    SI: {
    "slovenia-julian-alps": [
      { name: "Kranjska Gora", lat: 46.4854, lng: 13.7876, rideType: "mountain" },
      { name: "Vršič Pass", lat: 46.4346, lng: 13.7441, rideType: "mountain" },
      { name: "Bovec", lat: 46.3381, lng: 13.5524, rideType: "mountain" },
      { name: "Mangart Saddle", lat: 46.4349, lng: 13.6553, rideType: "mountain" },
      { name: "Soča Valley", lat: 46.3389, lng: 13.5529, rideType: "scenic" },
      { name: "Tolmin", lat: 46.183, lng: 13.7332, rideType: "scenic" },
      { name: "Kobarid", lat: 46.2476, lng: 13.5791, rideType: "scenic" },
      { name: "Bohinj", lat: 46.2742, lng: 13.9535, rideType: "lake" },
      { name: "Lake Bled", lat: 46.3636, lng: 14.0938, rideType: "lake" },
      { name: "Pokljuka Plateau", lat: 46.3474, lng: 13.9976, rideType: "forest" },
      { name: "Jezersko", lat: 46.3941, lng: 14.506, rideType: "mountain" },
      { name: "Predel Pass Slovenia Side", lat: 46.43, lng: 13.5786, rideType: "mountain" },
    ],

    "slovenia-north": [
      { name: "Maribor Hinterland", lat: 46.5547, lng: 15.6459, rideType: "scenic" },
      { name: "Ptuj", lat: 46.4204, lng: 15.87, rideType: "scenic" },
      { name: "Pohorje", lat: 46.4721, lng: 15.4844, rideType: "forest" },
      { name: "Slovenj Gradec", lat: 46.5105, lng: 15.0803, rideType: "scenic" },
      { name: "Logar Valley", lat: 46.3817, lng: 14.6377, rideType: "mountain" },
      { name: "Solčava Panoramic Road", lat: 46.4196, lng: 14.6948, rideType: "mountain" },
      { name: "Mozirje Hills", lat: 46.3392, lng: 14.9634, rideType: "scenic" },
      { name: "Celje Hinterland", lat: 46.2397, lng: 15.2677, rideType: "scenic" },
      { name: "Kamnik Saddle Link", lat: 46.3007, lng: 14.6121, rideType: "mountain" },
      { name: "Upper Savinja Valley", lat: 46.3358, lng: 14.9188, rideType: "scenic" },
      { name: "Drava Valley Slovenia", lat: 46.5883, lng: 15.0197, rideType: "scenic" },
      { name: "Koroška Ridge Roads", lat: 46.5168, lng: 14.9711, rideType: "forest" },
    ],

    "slovenia-karst-coast": [
      { name: "Koper", lat: 45.5481, lng: 13.7302, rideType: "coastal" },
      { name: "Izola", lat: 45.5364, lng: 13.6616, rideType: "coastal" },
      { name: "Piran", lat: 45.5283, lng: 13.5684, rideType: "coastal" },
      { name: "Portorož", lat: 45.5143, lng: 13.5921, rideType: "coastal" },
      { name: "Karst Edge Road", lat: 45.5706, lng: 13.9234, rideType: "scenic" },
      { name: "Sežana", lat: 45.7092, lng: 13.8733, rideType: "scenic" },
      { name: "Štanjel", lat: 45.8246, lng: 13.8431, rideType: "scenic" },
      { name: "Vipava Valley", lat: 45.8456, lng: 13.9637, rideType: "scenic" },
      { name: "Nanos Plateau", lat: 45.7778, lng: 14.0508, rideType: "mountain" },
      { name: "Postojna", lat: 45.7744, lng: 14.2146, rideType: "scenic" },
      { name: "Divača Karst Link", lat: 45.683, lng: 13.9684, rideType: "scenic" },
      { name: "Ankaran Coast Road", lat: 45.5786, lng: 13.7361, rideType: "coastal" },
    ],

    "slovenia-east-south": [
      { name: "Ljubljana South Link", lat: 46.0569, lng: 14.5058, rideType: "scenic" },
      { name: "Novo Mesto", lat: 45.803, lng: 15.1689, rideType: "scenic" },
      { name: "Kočevje Forest Roads", lat: 45.6428, lng: 14.8637, rideType: "forest" },
      { name: "Ribnica Backroads", lat: 45.7403, lng: 14.727, rideType: "forest" },
      { name: "Kolpa Valley", lat: 45.5704, lng: 15.0202, rideType: "scenic" },
      { name: "Bela Krajina", lat: 45.6511, lng: 15.3158, rideType: "scenic" },
      { name: "Krško Hills", lat: 45.9589, lng: 15.4917, rideType: "scenic" },
      { name: "Brežice", lat: 45.9033, lng: 15.5922, rideType: "scenic" },
      { name: "Ptuj to Haloze Ridge", lat: 46.3086, lng: 15.8831, rideType: "scenic" },
      { name: "Jeruzalem Slovenia", lat: 46.4842, lng: 16.1547, rideType: "scenic" },
      { name: "Dolenjska Hills", lat: 45.9076, lng: 15.0732, rideType: "scenic" },
      { name: "Sotla Border Twisties", lat: 46.0845, lng: 15.7003, rideType: "scenic" },
    ],
  },
    HR: {
    "croatia-velebit": [
      { name: "Karlobag", lat: 44.5275, lng: 15.0733, rideType: "coastal" },
      { name: "Velebit South Ridge", lat: 44.4918, lng: 15.2394, rideType: "mountain" },
      { name: "Baške Oštarije", lat: 44.5611, lng: 15.2068, rideType: "mountain" },
      { name: "Gospić", lat: 44.5469, lng: 15.3746, rideType: "scenic" },
      { name: "Paklenica", lat: 44.3046, lng: 15.4386, rideType: "mountain" },
      { name: "Starigrad Paklenica", lat: 44.2965, lng: 15.438, rideType: "coastal" },
      { name: "Velebit Panoramic Road", lat: 44.6102, lng: 15.2245, rideType: "mountain" },
      { name: "Ličko Lešće Backroads", lat: 44.7284, lng: 15.2216, rideType: "forest" },
      { name: "Obrovac Canyon Link", lat: 44.2008, lng: 15.6817, rideType: "scenic" },
      { name: "Maslenica Bridge Approach", lat: 44.2214, lng: 15.5392, rideType: "coastal" },
      { name: "Sveti Rok Pass", lat: 44.3381, lng: 15.6519, rideType: "mountain" },
      { name: "Tulove Grede", lat: 44.2684, lng: 15.6298, rideType: "mountain" },
    ],

    "croatia-adriatic": [
      { name: "Rijeka Hinterland", lat: 45.3271, lng: 14.4422, rideType: "scenic" },
      { name: "Opatija Riviera", lat: 45.3376, lng: 14.3052, rideType: "coastal" },
      { name: "Senj Coast Road", lat: 44.9892, lng: 14.9058, rideType: "coastal" },
      { name: "Jadranska Magistrala North", lat: 44.95, lng: 14.93, rideType: "coastal" },
      { name: "Zadar Coastal Link", lat: 44.1194, lng: 15.2314, rideType: "coastal" },
      { name: "Šibenik Riviera", lat: 43.735, lng: 15.889, rideType: "coastal" },
      { name: "Split Coast Road", lat: 43.5081, lng: 16.4402, rideType: "coastal" },
      { name: "Makarska Riviera", lat: 43.2969, lng: 17.0183, rideType: "coastal" },
      { name: "Biokovo Skyroad", lat: 43.3403, lng: 17.0552, rideType: "mountain" },
      { name: "Pelješac Peninsula", lat: 42.9195, lng: 17.4313, rideType: "coastal" },
      { name: "Dubrovnik Coast", lat: 42.6507, lng: 18.0944, rideType: "coastal" },
      { name: "Dubrovnik Hinterland", lat: 42.6708, lng: 18.1608, rideType: "scenic" },
    ],

    "croatia-istria": [
      { name: "Pazin", lat: 45.2394, lng: 13.9367, rideType: "scenic" },
      { name: "Motovun", lat: 45.3366, lng: 13.8286, rideType: "scenic" },
      { name: "Buzet Backroads", lat: 45.4078, lng: 13.9661, rideType: "scenic" },
      { name: "Učka Mountain Road", lat: 45.2949, lng: 14.2011, rideType: "mountain" },
      { name: "Rovinj", lat: 45.0812, lng: 13.6387, rideType: "coastal" },
      { name: "Lim Fjord", lat: 45.1283, lng: 13.6995, rideType: "coastal" },
      { name: "Poreč Coast", lat: 45.227, lng: 13.5956, rideType: "coastal" },
      { name: "Novigrad Coast", lat: 45.315, lng: 13.5581, rideType: "coastal" },
      { name: "Pula", lat: 44.8666, lng: 13.8496, rideType: "coastal" },
      { name: "Cape Kamenjak", lat: 44.7679, lng: 13.9122, rideType: "coastal" },
      { name: "Labin / Rabac Ridge", lat: 45.0954, lng: 14.1226, rideType: "scenic" },
      { name: "Central Istria Twisties", lat: 45.2085, lng: 13.9772, rideType: "scenic" },
    ],
  },
  ME: {
  durmitor: [
    { name: "Žabljak", lat: 43.154, lng: 19.123, rideType: "mountain" },
    { name: "Durmitor Ring Road", lat: 43.1, lng: 19.05, rideType: "mountain" },
    { name: "Sedlo Pass", lat: 43.051, lng: 18.998, rideType: "mountain" },
    { name: "Piva Canyon", lat: 43.156, lng: 18.833, rideType: "scenic" },
    { name: "Tara Canyon", lat: 43.13, lng: 19.3, rideType: "scenic" },
    { name: "Đurđevića Tara Bridge", lat: 43.146, lng: 19.293, rideType: "scenic" },
    { name: "Plužine", lat: 43.155, lng: 18.84, rideType: "scenic" },
    { name: "Šavnik", lat: 42.956, lng: 19.095, rideType: "mountain" },
    { name: "Nikšić Hinterland", lat: 42.78, lng: 18.95, rideType: "scenic" },
    { name: "Durmitor South Approach", lat: 43.02, lng: 19.08, rideType: "mountain" },
    { name: "Piva Lake Road", lat: 43.14, lng: 18.85, rideType: "lake" },
    { name: "Durmitor Ridge Line", lat: 43.08, lng: 19.02, rideType: "mountain" },
  ],

  "montenegro-coastal": [
    { name: "Kotor Bay", lat: 42.4247, lng: 18.7712, rideType: "coastal" },
    { name: "Kotor Serpentine Road", lat: 42.39, lng: 18.77, rideType: "mountain" },
    { name: "Lovćen National Park", lat: 42.398, lng: 18.836, rideType: "mountain" },
    { name: "Cetinje", lat: 42.39, lng: 18.92, rideType: "scenic" },
    { name: "Budva Riviera", lat: 42.286, lng: 18.84, rideType: "coastal" },
    { name: "Petrovac Coast", lat: 42.205, lng: 18.94, rideType: "coastal" },
    { name: "Bar Coastal Road", lat: 42.1, lng: 19.1, rideType: "coastal" },
    { name: "Ulcinj South Coast", lat: 41.92, lng: 19.21, rideType: "coastal" },
    { name: "Skadar Lake North", lat: 42.2, lng: 19.1, rideType: "lake" },
    { name: "Skadar Lake Panorama", lat: 42.25, lng: 19.05, rideType: "scenic" },
    { name: "Lovćen Serpentine", lat: 42.38, lng: 18.79, rideType: "mountain" },
    { name: "Adriatic Coastal Ridge", lat: 42.3, lng: 18.9, rideType: "coastal" },
  ],
},
BA: {
  "bosnia-dinaric-west": [
    { name: "Bihać", lat: 44.8167, lng: 15.8708, rideType: "scenic" },
    { name: "Una Valley Road", lat: 44.75, lng: 15.95, rideType: "scenic" },
    { name: "Kulen Vakuf", lat: 44.6661, lng: 16.0167, rideType: "scenic" },
    { name: "Martin Brod", lat: 44.4878, lng: 16.1433, rideType: "scenic" },
    { name: "Drvar", lat: 44.3739, lng: 16.3975, rideType: "mountain" },
    { name: "Bosansko Grahovo", lat: 44.1794, lng: 16.3647, rideType: "mountain" },
    { name: "Livno Plateau", lat: 43.8269, lng: 17.0042, rideType: "scenic" },
    { name: "Kupres Highlands", lat: 43.9925, lng: 17.2767, rideType: "mountain" },
    { name: "Šator Mountain Road", lat: 44.1495, lng: 16.5734, rideType: "mountain" },
    { name: "Glamoč Backroads", lat: 44.0458, lng: 16.8486, rideType: "scenic" },
    { name: "Una National Park Edge", lat: 44.65, lng: 16.05, rideType: "scenic" },
    { name: "West Bosnia Ridge", lat: 44.11, lng: 16.62, rideType: "mountain" },
  ],

  "bosnia-dinaric-south": [
    { name: "Mostar Hinterland", lat: 43.3438, lng: 17.8078, rideType: "scenic" },
    { name: "Blidinje Nature Park", lat: 43.6247, lng: 17.5722, rideType: "mountain" },
    { name: "Rakitno Plateau", lat: 43.5331, lng: 17.4311, rideType: "mountain" },
    { name: "Jablanica Lake Road", lat: 43.6603, lng: 17.7614, rideType: "lake" },
    { name: "Konjic Canyon Link", lat: 43.6514, lng: 17.9614, rideType: "scenic" },
    { name: "Nevesinje Ridge Road", lat: 43.2586, lng: 18.1133, rideType: "mountain" },
    { name: "Trebinje", lat: 42.7119, lng: 18.3436, rideType: "scenic" },
    { name: "Trebinje / Herzegovina Twisties", lat: 42.79, lng: 18.28, rideType: "scenic" },
    { name: "Sutjeska Approach", lat: 43.5, lng: 18.68, rideType: "mountain" },
    { name: "Boračko Lake", lat: 43.7981, lng: 17.8875, rideType: "lake" },
    { name: "Herzegovina Karst Road", lat: 43.14, lng: 17.95, rideType: "scenic" },
    { name: "South Dinaric Crest", lat: 43.38, lng: 18.02, rideType: "mountain" },
  ],
},
AL: {
  "albania-alps": [
    { name: "Theth", lat: 42.3956, lng: 19.7742, rideType: "mountain" },
    { name: "Valbonë Valley", lat: 42.4575, lng: 19.8958, rideType: "mountain" },
    { name: "Bajram Curri", lat: 42.3575, lng: 20.0783, rideType: "scenic" },
    { name: "Shkodër Hinterland", lat: 42.0683, lng: 19.5126, rideType: "scenic" },
    { name: "Koman Lake Road", lat: 42.11, lng: 19.83, rideType: "lake" },
    { name: "Koman Ferry Approach", lat: 42.13, lng: 19.82, rideType: "scenic" },
    { name: "Albanian Alps Ridge", lat: 42.45, lng: 19.8, rideType: "mountain" },
    { name: "Valbona Pass Area", lat: 42.47, lng: 19.88, rideType: "mountain" },
    { name: "Tropojë Backroads", lat: 42.39, lng: 20.07, rideType: "scenic" },
    { name: "Shala River Access", lat: 42.25, lng: 19.83, rideType: "scenic" },
    { name: "North Albania Highlands", lat: 42.3, lng: 19.7, rideType: "mountain" },
    { name: "Alps Scenic Loop Albania", lat: 42.4, lng: 19.85, rideType: "scenic" },
  ],

  "albania-riviera": [
    { name: "Llogara Pass", lat: 40.2031, lng: 19.5933, rideType: "mountain" },
    { name: "Himarë", lat: 40.1017, lng: 19.7447, rideType: "coastal" },
    { name: "Dhërmi Coast Road", lat: 40.1503, lng: 19.6397, rideType: "coastal" },
    { name: "Vlorë", lat: 40.4661, lng: 19.4914, rideType: "coastal" },
    { name: "Sarandë", lat: 39.8753, lng: 20.0048, rideType: "coastal" },
    { name: "Ksamil", lat: 39.7683, lng: 20.0031, rideType: "coastal" },
    { name: "Butrint National Park", lat: 39.745, lng: 20.0208, rideType: "scenic" },
    { name: "Albanian Riviera Panoramic", lat: 40.05, lng: 19.7, rideType: "coastal" },
    { name: "Borsh Coastal Road", lat: 40.0647, lng: 19.8561, rideType: "coastal" },
    { name: "Qeparo Village Road", lat: 40.0544, lng: 19.8256, rideType: "scenic" },
    { name: "Porto Palermo Bay", lat: 40.0642, lng: 19.7928, rideType: "coastal" },
    { name: "Riviera Twisties Albania", lat: 40.12, lng: 19.7, rideType: "coastal" },
  ],
},
RO: {
  "romania-transfagarasan": [
    { name: "Curtea de Argeș", lat: 45.1417, lng: 24.6742, rideType: "scenic" },
    { name: "Vidraru Lake", lat: 45.3894, lng: 24.6406, rideType: "lake" },
    { name: "Vidraru Dam Road", lat: 45.3744, lng: 24.6289, rideType: "mountain" },
    { name: "Transfăgărășan South Climb", lat: 45.46, lng: 24.62, rideType: "mountain" },
    { name: "Bâlea Lake", lat: 45.6111, lng: 24.6178, rideType: "lake" },
    { name: "Bâlea Pass", lat: 45.6042, lng: 24.6167, rideType: "mountain" },
    { name: "Transfăgărășan Summit", lat: 45.6, lng: 24.61, rideType: "mountain" },
    { name: "Cârțișoara North Approach", lat: 45.72, lng: 24.57, rideType: "scenic" },
    { name: "Făgăraș Ridge Road", lat: 45.58, lng: 24.68, rideType: "mountain" },
    { name: "Sibiu South", lat: 45.67, lng: 24.15, rideType: "scenic" },
    { name: "Argeș Mountain Link", lat: 45.29, lng: 24.66, rideType: "mountain" },
    { name: "Făgăraș Scenic Loop", lat: 45.55, lng: 24.55, rideType: "scenic" },
  ],

  "romania-transalpina": [
    { name: "Rânca", lat: 45.3086, lng: 23.6861, rideType: "mountain" },
    { name: "Transalpina High Point", lat: 45.3569, lng: 23.6719, rideType: "mountain" },
    { name: "Urdele Pass", lat: 45.3553, lng: 23.6758, rideType: "mountain" },
    { name: "Novaci", lat: 45.18, lng: 23.67, rideType: "scenic" },
    { name: "Obârșia Lotrului", lat: 45.3722, lng: 23.6314, rideType: "mountain" },
    { name: "Sebeș North Access", lat: 45.96, lng: 23.57, rideType: "scenic" },
    { name: "Șugag", lat: 45.77, lng: 23.63, rideType: "scenic" },
    { name: "Parâng Ridge Road", lat: 45.35, lng: 23.66, rideType: "mountain" },
    { name: "Lotru Mountains", lat: 45.42, lng: 23.7, rideType: "mountain" },
    { name: "Transalpina Panoramic Crest", lat: 45.34, lng: 23.69, rideType: "mountain" },
    { name: "Alba Backroads", lat: 45.83, lng: 23.58, rideType: "scenic" },
    { name: "South Carpathian Link", lat: 45.28, lng: 23.74, rideType: "scenic" },
  ],

  "romania-bucegi": [
    { name: "Brașov", lat: 45.6579, lng: 25.6012, rideType: "scenic" },
    { name: "Sinaia", lat: 45.35, lng: 25.55, rideType: "mountain" },
    { name: "Bucegi Plateau Road", lat: 45.41, lng: 25.47, rideType: "mountain" },
    { name: "Bran", lat: 45.5156, lng: 25.3675, rideType: "scenic" },
    { name: "Rucăr Pass", lat: 45.39, lng: 25.18, rideType: "mountain" },
    { name: "Fundata Ridge", lat: 45.44, lng: 25.3, rideType: "mountain" },
    { name: "Predeal", lat: 45.5, lng: 25.57, rideType: "mountain" },
    { name: "Prahova Valley Twisties", lat: 45.42, lng: 25.55, rideType: "scenic" },
    { name: "Moieciu Backroads", lat: 45.48, lng: 25.32, rideType: "scenic" },
    { name: "Bucegi Scenic Loop", lat: 45.47, lng: 25.45, rideType: "scenic" },
    { name: "Bran to Râșnov Link", lat: 45.54, lng: 25.39, rideType: "scenic" },
    { name: "Carpathian Crest Bucegi", lat: 45.46, lng: 25.42, rideType: "mountain" },
  ],
},
};

function buildManualSeeds(country, scope) {
  const scoped = MANUAL_SCOPE_SEEDS?.[country]?.[scope] || [];

  return scoped.map((seed, index) => {
    const type = inferSpotType(seed.name, scopeCfg.scopeName || "", seed.rideType);
    const rideType = inferRideType(
      type,
      seed.name,
      scopeCfg.scopeName || "",
      seed.rideType
    );
    const slug = slugify(seed.name);

    return {
      id: `seed-${scopeSuffix.toLowerCase()}-manual-${slug || index + 1}`,
      sourceId: `seed-${scopeSuffix.toLowerCase()}-manual-${slug || index + 1}`,
      googlePlaceId: null,
      name: seed.name,
      slug,
      type,
      rideType,
      country,
      scope,
      scopeName: scopeCfg.scopeName,
      lat: Number(seed.lat),
      lng: Number(seed.lng),
      region: seed.region || buildSeedRegion(seed.name, scopeCfg.regions || []),
      regionHint: (scopeCfg.regions || []).join(" / ") || null,
      address: seed.address || buildSeedAddress(seed.name, scopeCfg),
      rating: Number(seed.rating || 4.7),
      userRatingCount: Number(seed.userRatingCount || 120),
      rawTypes: ["point_of_interest", "natural_feature", "route"],
      types: ["point_of_interest", "natural_feature", "route"],
      source: "local_scope_manual_seed",
      tags: inferTags(seed.name, scopeCfg.scopeName || "", rideType),
      aliases: uniq([
        seed.name,
        `${seed.name} Ride`,
        `${seed.name} Route`,
        rideType === "mountain" ? `${seed.name} Pass` : null,
      ]),
      seedMeta: {
        generatedFrom: "manual_scope_seed",
      },
    };
  });
}

function buildAreaSeedItem(area, index) {
  const areaName = String(area?.name || `Area ${index + 1}`).trim();
  const type = inferSpotType(areaName, scopeCfg.scopeName || "");
  const rideType = inferRideType(type, areaName, scopeCfg.scopeName || "");
  const tags = inferTags(areaName, scopeCfg.scopeName || "", rideType);
  const slug = slugify(areaName);

  return {
    id: `seed-${scopeSuffix.toLowerCase()}-${slug || index + 1}`,
    sourceId: `seed-${scopeSuffix.toLowerCase()}-${slug || index + 1}`,
    googlePlaceId: null,
    name: areaName,
    slug,
    type,
    rideType,
    country,
    scope,
    scopeName: scopeCfg.scopeName,
    lat: Number(area.lat),
    lng: Number(area.lng),
    region: buildSeedRegion(areaName, scopeCfg.regions || []),
    regionHint: (scopeCfg.regions || []).join(" / ") || null,
    address: buildSeedAddress(areaName, scopeCfg),
    rating: 4.6,
    userRatingCount: 80,
    rawTypes: ["point_of_interest", "natural_feature", "route"],
    types: ["point_of_interest", "natural_feature", "route"],
    source: "local_scope_seed",
    tags,
    aliases: uniq([
      areaName,
      `${areaName} Ride`,
      `${areaName} Route`,
      rideType === "mountain" ? `${areaName} Pass` : null,
    ]),
    seedMeta: {
      areaRadiusMeters: Number(area.radius || 0),
      generatedFrom: "routeScopes.js",
    },
  };
}

async function readExistingIfAny(filePath) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function dedupeByIdOrName(items = []) {
  const map = new Map();

  for (const item of items) {
    const keyByNameCoords = `${country}|${scope}|${normalizeText(item.name)}|${Number(
      item.lat
    ).toFixed(4)}|${Number(item.lng).toFixed(4)}`;

    const key = item.id || keyByNameCoords;
    const prev = map.get(key);

    if (!prev) {
      map.set(key, item);
      continue;
    }

    const prevScore =
      Number(prev.userRatingCount || 0) + Number(prev.rating || 0) * 10;
    const currScore =
      Number(item.userRatingCount || 0) + Number(item.rating || 0) * 10;

    if (currScore >= prevScore) {
      map.set(key, item);
    }
  }

  const secondPass = [];
  for (const item of map.values()) {
    const existing = secondPass.find((ex) => {
      const sameName = normalizeText(ex.name) === normalizeText(item.name);
      const closeLat = Math.abs(Number(ex.lat) - Number(item.lat)) < 0.01;
      const closeLng = Math.abs(Number(ex.lng) - Number(item.lng)) < 0.01;
      return sameName && closeLat && closeLng;
    });

    if (!existing) {
      secondPass.push(item);
      continue;
    }

    const exScore =
      Number(existing.userRatingCount || 0) + Number(existing.rating || 0) * 10;
    const itScore =
      Number(item.userRatingCount || 0) + Number(item.rating || 0) * 10;

    if (itScore > exScore) {
      Object.assign(existing, item);
    } else {
      existing.aliases = uniq([...(existing.aliases || []), ...(item.aliases || [])]);
      existing.tags = uniq([...(existing.tags || []), ...(item.tags || [])]);
    }
  }

  return secondPass;
}

async function main() {
  console.log("====================================");
  console.log("MotoPortEU — Build European Scope Seed");
  console.log("====================================");
  console.log(`🌍 Country: ${scopeCfg.countryName} (${country})`);
  console.log(`🧭 Scope: ${scopeCfg.scopeName}`);
  console.log(`🗂️ Areas: ${(scopeCfg.areas || []).length}`);
  console.log(`💾 Output: ${OUT_PATH}`);
  console.log(`⚙️ Mode: ${mode}`);

  const areaSeeds = (scopeCfg.areas || [])
    .filter(
      (area) =>
        Number.isFinite(Number(area?.lat)) && Number.isFinite(Number(area?.lng))
    )
    .map((area, index) => buildAreaSeedItem(area, index));

  const manualSeeds = buildManualSeeds(country, scope);
  const seeds = dedupeByIdOrName([...areaSeeds, ...manualSeeds]);

  let finalItems = seeds;

  if (mode === "append") {
    const existing = await readExistingIfAny(OUT_PATH);
    finalItems = dedupeByIdOrName([...existing, ...seeds]);
    console.log(`📥 Existing: ${existing.length}`);
  }

  finalItems.sort((a, b) =>
    String(a.name || "").localeCompare(String(b.name || ""), "it")
  );

  await fs.mkdir(path.dirname(OUT_PATH), { recursive: true });
  await fs.writeFile(OUT_PATH, JSON.stringify(finalItems, null, 2), "utf8");

  console.log("------------------------------------");
  console.log(`✅ Area seeds:      ${areaSeeds.length}`);
  console.log(`✅ Manual seeds:    ${manualSeeds.length}`);
  console.log(`✅ Output items:    ${finalItems.length}`);
  console.log("------------------------------------");
  console.log(`📁 Salvato in: ${OUT_PATH}`);
  console.log("====================================");
}

main().catch((err) => {
  console.error("❌ Errore buildEuropeanScopeSeed:", err);
  process.exit(1);
});