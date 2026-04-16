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
SK: {
  "slovakia-tatras": [
    { name: "Podbanské", lat: 49.148, lng: 19.923, rideType: "scenic" },
    { name: "Štrbské Pleso", lat: 49.1186, lng: 20.0581, rideType: "lake" },
    { name: "Jamské Pleso Link", lat: 49.135, lng: 20.04, rideType: "scenic" },
    { name: "Vyšné Hágy", lat: 49.103, lng: 20.121, rideType: "scenic" },
    { name: "Tatranská Polianka", lat: 49.092, lng: 20.17, rideType: "scenic" },
    { name: "Starý Smokovec", lat: 49.14, lng: 20.221, rideType: "scenic" },
    { name: "Hrebienok Access Road", lat: 49.146, lng: 20.223, rideType: "mountain" },
    { name: "Tatranská Lesná", lat: 49.16, lng: 20.276, rideType: "scenic" },
    { name: "Tatranská Lomnica", lat: 49.164, lng: 20.282, rideType: "mountain" },
    { name: "Lomnický štít Viewpoint", lat: 49.166, lng: 20.29, rideType: "mountain" },
    { name: "Kežmarské Žľaby", lat: 49.181, lng: 20.308, rideType: "scenic" },
    { name: "Tatranská Kotlina", lat: 49.225, lng: 20.321, rideType: "scenic" },
    { name: "Ždiar", lat: 49.271, lng: 20.262, rideType: "mountain" },
    { name: "Belianske Tatry Panorama", lat: 49.245, lng: 20.29, rideType: "mountain" },
  ],

  "slovakia-central": [
    { name: "Donovaly", lat: 48.8778, lng: 19.2283, rideType: "mountain" },
    { name: "Donovaly Pass", lat: 48.88, lng: 19.23, rideType: "mountain" },
    { name: "Staré Hory", lat: 48.858, lng: 19.149, rideType: "scenic" },
    { name: "Banská Bystrica North", lat: 48.758, lng: 19.145, rideType: "scenic" },
    { name: "Harmanec Twisties", lat: 48.81, lng: 19.03, rideType: "scenic" },
    { name: "Turecká Ridge Road", lat: 48.842, lng: 19.06, rideType: "mountain" },
    { name: "Brezno", lat: 48.804, lng: 19.636, rideType: "scenic" },
    { name: "Mýto pod Ďumbierom", lat: 48.852, lng: 19.62, rideType: "mountain" },
    { name: "Čertovica", lat: 48.9078, lng: 19.7386, rideType: "mountain" },
    { name: "Čertovica Pass", lat: 48.91, lng: 19.74, rideType: "mountain" },
    { name: "Low Tatras Crest Road", lat: 48.895, lng: 19.69, rideType: "mountain" },
    { name: "Liptovská Osada Link", lat: 48.95, lng: 19.26, rideType: "scenic" },
    { name: "Telgárt Approach", lat: 48.847, lng: 20.189, rideType: "scenic" },
    { name: "Horehronie Scenic Link", lat: 48.88, lng: 19.92, rideType: "scenic" },
  ],
},
CZ: {
  "czech-bohemian-forest": [
    { name: "Železná Ruda", lat: 49.137, lng: 13.235, rideType: "mountain" },
    { name: "Špičák Pass", lat: 49.18, lng: 13.21, rideType: "mountain" },
    { name: "Modrava", lat: 49.02, lng: 13.5, rideType: "scenic" },
    { name: "Kvilda", lat: 49.02, lng: 13.58, rideType: "scenic" },
    { name: "Bučina Border Road", lat: 48.98, lng: 13.62, rideType: "scenic" },
    { name: "Srní", lat: 49.09, lng: 13.48, rideType: "scenic" },
    { name: "Kašperské Hory", lat: 49.14, lng: 13.56, rideType: "scenic" },
    { name: "Prášily", lat: 49.11, lng: 13.38, rideType: "scenic" },
    { name: "Šumava Ridge Road", lat: 49.05, lng: 13.5, rideType: "scenic" },
    { name: "Bavarian Forest Link", lat: 49.0, lng: 13.3, rideType: "mountain" },
  ],

  "czech-krkonose": [
    { name: "Harrachov", lat: 50.77, lng: 15.43, rideType: "mountain" },
    { name: "Špindlerův Mlýn", lat: 50.73, lng: 15.61, rideType: "mountain" },
    { name: "Pec pod Sněžkou", lat: 50.69, lng: 15.73, rideType: "mountain" },
    { name: "Sněžka Viewpoint", lat: 50.73, lng: 15.74, rideType: "mountain" },
    { name: "Janské Lázně", lat: 50.63, lng: 15.78, rideType: "scenic" },
    { name: "Trutnov", lat: 50.56, lng: 15.91, rideType: "scenic" },
    { name: "Krkonoše Scenic Loop", lat: 50.7, lng: 15.6, rideType: "scenic" },
  ],

  "czech-beskydy": [
    { name: "Čeladná", lat: 49.55, lng: 18.34, rideType: "scenic" },
    { name: "Pustevny", lat: 49.51, lng: 18.26, rideType: "mountain" },
    { name: "Radhošť Ridge", lat: 49.5, lng: 18.23, rideType: "mountain" },
    { name: "Bílá", lat: 49.45, lng: 18.45, rideType: "scenic" },
    { name: "Velké Karlovice", lat: 49.36, lng: 18.28, rideType: "scenic" },
    { name: "Javorníky Ridge Road", lat: 49.34, lng: 18.2, rideType: "mountain" },
    { name: "Rožnov pod Radhoštěm", lat: 49.46, lng: 18.14, rideType: "scenic" },
  ],

  "czech-south": [
    { name: "Český Krumlov", lat: 48.812, lng: 14.315, rideType: "scenic" },
    { name: "Lipno Lake", lat: 48.7, lng: 14.1, rideType: "lake" },
    { name: "Lipno Dam Road", lat: 48.72, lng: 14.11, rideType: "scenic" },
    { name: "Vyšší Brod", lat: 48.62, lng: 14.31, rideType: "scenic" },
    { name: "Moravian Karst Road", lat: 49.37, lng: 16.74, rideType: "scenic" },
    { name: "Macocha Gorge", lat: 49.37, lng: 16.73, rideType: "scenic" },
    { name: "Znojmo", lat: 48.86, lng: 16.05, rideType: "scenic" },
  ],
},
PL: {
  "poland-tatras": [
    { name: "Zakopane", lat: 49.2992, lng: 19.9496, rideType: "scenic" },
    { name: "Jaszczurówka Road", lat: 49.309, lng: 20.001, rideType: "scenic" },
    { name: "Toporowa Cyrhla", lat: 49.312, lng: 20.028, rideType: "mountain" },
    { name: "Brzeziny Tatra Link", lat: 49.317, lng: 20.06, rideType: "scenic" },
    { name: "Wierchporoniec", lat: 49.339, lng: 20.103, rideType: "mountain" },
    { name: "Bukowina Tatrzańska", lat: 49.3431, lng: 20.1081, rideType: "mountain" },
    { name: "Głodówka Panorama", lat: 49.352, lng: 20.12, rideType: "mountain" },
    { name: "Białka Tatrzańska", lat: 49.389, lng: 20.105, rideType: "scenic" },
    { name: "Jurgów", lat: 49.345, lng: 20.141, rideType: "scenic" },
    { name: "Oswald Balzer Road", lat: 49.29, lng: 20.08, rideType: "mountain" },
    { name: "Morskie Oko Access", lat: 49.228, lng: 20.07, rideType: "mountain" },
    { name: "Chochołów Link", lat: 49.367, lng: 19.82, rideType: "scenic" }
  ],

  "poland-beskids": [
    { name: "Żywiec", lat: 49.685, lng: 19.192, rideType: "scenic" },
    { name: "Zwardoń", lat: 49.503, lng: 18.96, rideType: "mountain" },
    { name: "Korbielów", lat: 49.568, lng: 19.349, rideType: "mountain" },
    { name: "Szczyrk", lat: 49.718, lng: 19.031, rideType: "mountain" },
    { name: "Wisła", lat: 49.656, lng: 18.859, rideType: "scenic" },
    { name: "Istebna", lat: 49.564, lng: 18.906, rideType: "scenic" },
    { name: "Koniaków Ridge", lat: 49.55, lng: 18.95, rideType: "mountain" },
    { name: "Węgierska Górka", lat: 49.607, lng: 19.116, rideType: "scenic" },
    { name: "Krynica-Zdrój", lat: 49.421, lng: 20.959, rideType: "mountain" },
    { name: "Tylicz", lat: 49.395, lng: 21.027, rideType: "scenic" },
    { name: "Muszyna", lat: 49.356, lng: 20.897, rideType: "scenic" },
    { name: "Beskid Sądecki Loop", lat: 49.41, lng: 20.91, rideType: "mountain" }
  ],

  "poland-bieszczady": [
    { name: "Lesko", lat: 49.4706, lng: 22.3304, rideType: "scenic" },
    { name: "Hoczew", lat: 49.386, lng: 22.32, rideType: "scenic" },
    { name: "Baligród", lat: 49.33, lng: 22.285, rideType: "scenic" },
    { name: "Cisna", lat: 49.211, lng: 22.327, rideType: "mountain" },
    { name: "Wetlina", lat: 49.156, lng: 22.468, rideType: "mountain" },
    { name: "Ustrzyki Górne", lat: 49.106, lng: 22.617, rideType: "mountain" },
    { name: "Wołosate", lat: 49.074, lng: 22.687, rideType: "mountain" },
    { name: "Smolnik", lat: 49.204, lng: 22.684, rideType: "scenic" },
    { name: "Czarna", lat: 49.327, lng: 22.663, rideType: "scenic" },
    { name: "Ustrzyki Dolne", lat: 49.43, lng: 22.593, rideType: "scenic" },
    { name: "Bieszczady Loop Road", lat: 49.23, lng: 22.49, rideType: "mountain" },
    { name: "Tarnica Approach", lat: 49.08, lng: 22.73, rideType: "mountain" }
  ]
},
RS: {
  "serbia-tara-zlatibor": [
    { name: "Bajina Bašta", lat: 43.971, lng: 19.567, rideType: "scenic" },
    { name: "Perućac Lake", lat: 43.95, lng: 19.42, rideType: "lake" },
    { name: "Perućac Dam Road", lat: 43.96, lng: 19.44, rideType: "scenic" },
    { name: "Zaovine Lake", lat: 43.892, lng: 19.431, rideType: "lake" },
    { name: "Mitrovac na Tari", lat: 43.899, lng: 19.39, rideType: "mountain" },
    { name: "Tara Panorama Road", lat: 43.91, lng: 19.47, rideType: "mountain" },
    { name: "Mokra Gora", lat: 43.792, lng: 19.515, rideType: "scenic" },
    { name: "Šargan Pass Road", lat: 43.79, lng: 19.54, rideType: "mountain" },
    { name: "Kremna", lat: 43.851, lng: 19.572, rideType: "scenic" },
    { name: "Zlatibor", lat: 43.729, lng: 19.699, rideType: "scenic" },
    { name: "Tornik", lat: 43.689, lng: 19.638, rideType: "mountain" },
    { name: "Zlatibor Ridge Road", lat: 43.72, lng: 19.66, rideType: "mountain" }
  ],

  "serbia-djerdap-east": [
    { name: "Kladovo", lat: 44.607, lng: 22.607, rideType: "scenic" },
    { name: "Iron Gate Dam Road", lat: 44.655, lng: 22.525, rideType: "scenic" },
    { name: "Miroč Ridge", lat: 44.55, lng: 22.25, rideType: "mountain" },
    { name: "Donji Milanovac", lat: 44.465, lng: 22.151, rideType: "scenic" },
    { name: "Veliki Štrbac View", lat: 44.55, lng: 22.15, rideType: "mountain" },
    { name: "Golubac", lat: 44.652, lng: 21.632, rideType: "scenic" },
    { name: "Golubac Fortress Road", lat: 44.655, lng: 21.63, rideType: "scenic" },
    { name: "Brza Palanka", lat: 44.37, lng: 22.47, rideType: "scenic" },
    { name: "Tekija Gorge Road", lat: 44.69, lng: 22.42, rideType: "mountain" },
    { name: "Lepenski Vir Link", lat: 44.556, lng: 22.024, rideType: "scenic" },
    { name: "Đerdap Scenic Drive", lat: 44.58, lng: 22.18, rideType: "mountain" },
    { name: "Negotin Hills Link", lat: 44.226, lng: 22.531, rideType: "scenic" }
  ]
},
BG: {
  "bulgaria-rhodope-west": [
    { name: "Batak", lat: 41.95, lng: 24.22, rideType: "scenic" },
    { name: "Batak Reservoir Road", lat: 41.93, lng: 24.17, rideType: "lake" },
    { name: "Shiroka Polyana", lat: 41.73, lng: 24.16, rideType: "lake" },
    { name: "Shiroka Polyana Forest Road", lat: 41.74, lng: 24.17, rideType: "forest" },
    { name: "Dospat", lat: 41.64, lng: 24.16, rideType: "lake" },
    { name: "Dospat Dam Road", lat: 41.66, lng: 24.12, rideType: "scenic" },
    { name: "Devin", lat: 41.74, lng: 24.4, rideType: "scenic" },
    { name: "Trigrad Link", lat: 41.6, lng: 24.38, rideType: "mountain" },
    { name: "Shiroka Laka", lat: 41.67, lng: 24.58, rideType: "scenic" },
    { name: "Pamporovo", lat: 41.66, lng: 24.69, rideType: "mountain" },
    { name: "Rozhen Pass", lat: 41.63, lng: 24.7, rideType: "mountain" },
    { name: "Smolyan Lakes Road", lat: 41.62, lng: 24.71, rideType: "scenic" }
  ],

  "bulgaria-balkan-central": [
    { name: "Gabrovo", lat: 42.874, lng: 25.318, rideType: "scenic" },
    { name: "Shipka Pass", lat: 42.748, lng: 25.324, rideType: "mountain" },
    { name: "Buzludzha Link", lat: 42.735, lng: 25.393, rideType: "mountain" },
    { name: "Shipka South Descent", lat: 42.69, lng: 25.33, rideType: "scenic" },
    { name: "Kazanlak", lat: 42.62, lng: 25.4, rideType: "scenic" },
    { name: "Troyan", lat: 42.89, lng: 24.72, rideType: "scenic" },
    { name: "Beklemeto Pass", lat: 42.786, lng: 24.618, rideType: "mountain" },
    { name: "Beklemeto Ridge Road", lat: 42.8, lng: 24.64, rideType: "mountain" },
    { name: "Karnare South Link", lat: 42.73, lng: 24.76, rideType: "scenic" },
    { name: "Karlovo", lat: 42.63, lng: 24.8, rideType: "scenic" },
    { name: "Stara Planina Crest Link", lat: 42.79, lng: 24.95, rideType: "mountain" },
    { name: "Via Trayana Twisties", lat: 42.81, lng: 24.66, rideType: "mountain" }
  ]
},
GR: {
  "greece-epirus-pindus": [
    { name: "Ioannina", lat: 39.665, lng: 20.853, rideType: "scenic" },
    { name: "Lake Pamvotida Road", lat: 39.67, lng: 20.87, rideType: "lake" },
    { name: "Metsovo", lat: 39.769, lng: 21.183, rideType: "mountain" },
    { name: "Katara Link", lat: 39.79, lng: 21.16, rideType: "mountain" },
    { name: "Anilio Ridge Road", lat: 39.8, lng: 21.12, rideType: "mountain" },
    { name: "Konitsa", lat: 40.048, lng: 20.748, rideType: "scenic" },
    { name: "Vikos Link", lat: 39.96, lng: 20.71, rideType: "mountain" },
    { name: "Tsepelovo", lat: 39.908, lng: 20.758, rideType: "scenic" },
    { name: "Tzoumerka North", lat: 39.56, lng: 21.0, rideType: "mountain" },
    { name: "Pramanta", lat: 39.52, lng: 21.12, rideType: "scenic" },
    { name: "Arachthos Gorge Road", lat: 39.5, lng: 21.08, rideType: "mountain" },
    { name: "Pindus Scenic Crest", lat: 39.74, lng: 20.98, rideType: "mountain" }
  ],

  "greece-pelion-olympus": [
    { name: "Volos", lat: 39.361, lng: 22.943, rideType: "scenic" },
    { name: "Portaria", lat: 39.385, lng: 22.995, rideType: "mountain" },
    { name: "Makrinitsa Road", lat: 39.4, lng: 23.0, rideType: "scenic" },
    { name: "Milies", lat: 39.326, lng: 23.157, rideType: "scenic" },
    { name: "Tsagarada", lat: 39.387, lng: 23.173, rideType: "mountain" },
    { name: "Pelion Coastal Link", lat: 39.42, lng: 23.18, rideType: "coastal" },
    { name: "Zagora", lat: 39.443, lng: 23.1, rideType: "scenic" },
    { name: "Litochoro", lat: 40.1, lng: 22.5, rideType: "mountain" },
    { name: "Olympus Access Road", lat: 40.08, lng: 22.46, rideType: "mountain" },
    { name: "Prionia Link", lat: 40.09, lng: 22.41, rideType: "mountain" },
    { name: "Elassona", lat: 39.894, lng: 22.188, rideType: "scenic" },
    { name: "Olympus West Panorama", lat: 39.96, lng: 22.23, rideType: "mountain" }
  ]
},
MK: {
  "macedonia-west": [
    { name: "Ohrid", lat: 41.123, lng: 20.801, rideType: "scenic" },
    { name: "Lake Ohrid Road", lat: 41.12, lng: 20.75, rideType: "lake" },
    { name: "Struga", lat: 41.177, lng: 20.678, rideType: "scenic" },
    { name: "Debar Lake", lat: 41.53, lng: 20.52, rideType: "lake" },
    { name: "Debar", lat: 41.525, lng: 20.524, rideType: "scenic" },
    { name: "Mavrovo Lake", lat: 41.65, lng: 20.73, rideType: "lake" },
    { name: "Mavrovo National Park Road", lat: 41.66, lng: 20.74, rideType: "mountain" },
    { name: "Galicnik Road", lat: 41.59, lng: 20.74, rideType: "mountain" },
    { name: "Radika Canyon", lat: 41.6, lng: 20.72, rideType: "mountain" },
    { name: "Struga-Ohrid Twisties", lat: 41.14, lng: 20.72, rideType: "scenic" }
  ],

  "macedonia-central": [
    { name: "Skopje", lat: 41.998, lng: 21.425, rideType: "scenic" },
    { name: "Matka Canyon", lat: 41.95, lng: 21.3, rideType: "mountain" },
    { name: "Veles", lat: 41.716, lng: 21.775, rideType: "scenic" },
    { name: "Babuna Mountain Road", lat: 41.68, lng: 21.6, rideType: "mountain" },
    { name: "Prilep", lat: 41.346, lng: 21.554, rideType: "scenic" },
    { name: "Treskavec Monastery Road", lat: 41.38, lng: 21.58, rideType: "mountain" },
    { name: "Kruševo", lat: 41.368, lng: 21.249, rideType: "mountain" },
    { name: "Kruševo Ridge", lat: 41.37, lng: 21.26, rideType: "mountain" },
    { name: "Pelagonia Scenic Link", lat: 41.4, lng: 21.5, rideType: "scenic" },
    { name: "Central Macedonia Loop", lat: 41.7, lng: 21.6, rideType: "scenic" }
  ]
},
HU: {
  "hungary-matra-bukk": [
    { name: "Gyöngyös", lat: 47.783, lng: 19.928, rideType: "scenic" },
    { name: "Mátraháza", lat: 47.87, lng: 19.98, rideType: "mountain" },
    { name: "Kékestető", lat: 47.872, lng: 20.011, rideType: "mountain" },
    { name: "Galya-tető Link", lat: 47.917, lng: 19.93, rideType: "mountain" },
    { name: "Parád Scenic Road", lat: 47.923, lng: 20.058, rideType: "scenic" },
    { name: "Eger North Link", lat: 47.94, lng: 20.37, rideType: "scenic" },
    { name: "Szilvásvárad", lat: 48.104, lng: 20.389, rideType: "scenic" },
    { name: "Bükk Plateau Road", lat: 48.08, lng: 20.47, rideType: "mountain" },
    { name: "Lillafüred", lat: 48.102, lng: 20.63, rideType: "scenic" },
    { name: "Lake Hámori Road", lat: 48.096, lng: 20.624, rideType: "lake" },
    { name: "Bánkút Ridge Link", lat: 48.053, lng: 20.498, rideType: "mountain" },
    { name: "Bükk Scenic Crest", lat: 48.07, lng: 20.55, rideType: "mountain" }
  ],

  "hungary-balaton-north": [
    { name: "Balatonfüred", lat: 46.961, lng: 17.886, rideType: "scenic" },
    { name: "Tihany Peninsula Road", lat: 46.913, lng: 17.889, rideType: "lake" },
    { name: "Tihany Panorama", lat: 46.91, lng: 17.89, rideType: "scenic" },
    { name: "Aszófő Link", lat: 46.93, lng: 17.83, rideType: "scenic" },
    { name: "Badacsony", lat: 46.79, lng: 17.5, rideType: "mountain" },
    { name: "Badacsony Hill Road", lat: 46.8, lng: 17.49, rideType: "mountain" },
    { name: "Szigliget", lat: 46.8, lng: 17.43, rideType: "scenic" },
    { name: "Káli Basin Road", lat: 46.89, lng: 17.55, rideType: "scenic" },
    { name: "Révfülöp North Shore Link", lat: 46.83, lng: 17.63, rideType: "lake" },
    { name: "Keszthely", lat: 46.768, lng: 17.247, rideType: "scenic" },
    { name: "Balaton Uplands Scenic", lat: 46.87, lng: 17.68, rideType: "scenic" },
    { name: "Balaton North Coastal Drive", lat: 46.89, lng: 17.76, rideType: "coastal" }
  ]
},
PT: {
  "portugal-douro-north": [
    { name: "Peso da Régua", lat: 41.161, lng: -7.787, rideType: "scenic" },
    { name: "Douro Riverside Road", lat: 41.17, lng: -7.75, rideType: "scenic" },
    { name: "Pinhão", lat: 41.19, lng: -7.545, rideType: "scenic" },
    { name: "N222 Douro Route", lat: 41.18, lng: -7.6, rideType: "scenic" },
    { name: "Sabrosa Hills", lat: 41.27, lng: -7.58, rideType: "mountain" },
    { name: "Vila Real", lat: 41.3, lng: -7.74, rideType: "scenic" },
    { name: "Alvão Natural Park Road", lat: 41.32, lng: -7.9, rideType: "mountain" },
    { name: "Bragança Scenic Link", lat: 41.8, lng: -6.75, rideType: "scenic" },
    { name: "Trás-os-Montes Ridge", lat: 41.6, lng: -7.2, rideType: "mountain" },
    { name: "Douro Valley Panorama", lat: 41.2, lng: -7.65, rideType: "scenic" }
  ],

  "portugal-algarve-west": [
    { name: "Sagres", lat: 37.008, lng: -8.943, rideType: "coastal" },
    { name: "Cape St Vincent Road", lat: 37.02, lng: -8.99, rideType: "coastal" },
    { name: "Lagos", lat: 37.102, lng: -8.674, rideType: "scenic" },
    { name: "Ponta da Piedade Road", lat: 37.08, lng: -8.67, rideType: "coastal" },
    { name: "Aljezur", lat: 37.319, lng: -8.803, rideType: "scenic" },
    { name: "Costa Vicentina Route", lat: 37.25, lng: -8.85, rideType: "coastal" },
    { name: "Monchique", lat: 37.315, lng: -8.555, rideType: "mountain" },
    { name: "Foia Peak Road", lat: 37.31, lng: -8.59, rideType: "mountain" },
    { name: "Serra de Monchique Twisties", lat: 37.33, lng: -8.55, rideType: "mountain" },
    { name: "Algarve West Scenic Drive", lat: 37.2, lng: -8.7, rideType: "scenic" }
  ]
},
BE: {
  "belgium-ardennes-south": [
    { name: "La Roche-en-Ardenne", lat: 50.183, lng: 5.576, rideType: "scenic" },
    { name: "Ourthe Valley Road", lat: 50.19, lng: 5.6, rideType: "scenic" },
    { name: "Houffalize", lat: 50.133, lng: 5.789, rideType: "scenic" },
    { name: "Bastogne", lat: 50.0, lng: 5.718, rideType: "scenic" },
    { name: "Bastogne Ridge Link", lat: 50.03, lng: 5.76, rideType: "forest" },
    { name: "Bouillon", lat: 49.794, lng: 5.067, rideType: "scenic" },
    { name: "Semois Valley Road", lat: 49.82, lng: 5.09, rideType: "scenic" },
    { name: "Rochehaut Panorama", lat: 49.84, lng: 5.01, rideType: "mountain" },
    { name: "Dinant", lat: 50.26, lng: 4.912, rideType: "scenic" },
    { name: "Meuse Cliff Road", lat: 50.28, lng: 4.9, rideType: "mountain" },
    { name: "Ardennes Crest Link", lat: 50.08, lng: 5.38, rideType: "forest" },
    { name: "Vresse-sur-Semois", lat: 49.872, lng: 4.934, rideType: "scenic" }
  ],

  "belgium-high-fens-east": [
    { name: "Spa", lat: 50.492, lng: 5.864, rideType: "scenic" },
    { name: "Spa Forest Road", lat: 50.5, lng: 5.9, rideType: "forest" },
    { name: "Stavelot", lat: 50.395, lng: 5.931, rideType: "scenic" },
    { name: "Malmedy", lat: 50.426, lng: 6.027, rideType: "scenic" },
    { name: "Signal de Botrange", lat: 50.501, lng: 6.093, rideType: "mountain" },
    { name: "High Fens Ridge", lat: 50.53, lng: 6.11, rideType: "forest" },
    { name: "Eupen Scenic Link", lat: 50.63, lng: 6.03, rideType: "scenic" },
    { name: "Warche Valley Road", lat: 50.44, lng: 6.05, rideType: "scenic" },
    { name: "Botrange Loop", lat: 50.5, lng: 6.08, rideType: "mountain" },
    { name: "Ardennes East Twisties", lat: 50.46, lng: 5.98, rideType: "scenic" }
  ]
},
GB: {
  "uk-scotland-west-highlands": [
    { name: "Loch Lomond West Road", lat: 56.08, lng: -4.64, rideType: "lake" },
    { name: "Tarbet", lat: 56.204, lng: -4.716, rideType: "scenic" },
    { name: "Arrochar Alps Link", lat: 56.203, lng: -4.746, rideType: "mountain" },
    { name: "Crianlarich", lat: 56.394, lng: -4.619, rideType: "scenic" },
    { name: "Tyndrum", lat: 56.434, lng: -4.715, rideType: "scenic" },
    { name: "Rannoch Moor Road", lat: 56.63, lng: -4.9, rideType: "mountain" },
    { name: "Glencoe", lat: 56.682, lng: -5.102, rideType: "mountain" },
    { name: "Glencoe Scenic Drive", lat: 56.69, lng: -5.04, rideType: "scenic" },
    { name: "Ballachulish", lat: 56.681, lng: -5.127, rideType: "scenic" },
    { name: "Fort William", lat: 56.819, lng: -5.105, rideType: "scenic" },
    { name: "Loch Leven Twisties", lat: 56.71, lng: -5.24, rideType: "lake" },
    { name: "Trossachs Ridge Link", lat: 56.3, lng: -4.55, rideType: "mountain" }
  ],

  "uk-wales-cambrian": [
    { name: "Llandudno", lat: 53.324, lng: -3.827, rideType: "coastal" },
    { name: "Conwy Valley Road", lat: 53.15, lng: -3.8, rideType: "scenic" },
    { name: "Betws-y-Coed", lat: 53.093, lng: -3.801, rideType: "mountain" },
    { name: "Eryri Mountain Link", lat: 53.07, lng: -3.9, rideType: "mountain" },
    { name: "Blaenau Ffestiniog Road", lat: 52.995, lng: -3.939, rideType: "scenic" },
    { name: "Machynlleth", lat: 52.589, lng: -3.852, rideType: "scenic" },
    { name: "Dyfi Forest Link", lat: 52.68, lng: -3.74, rideType: "forest" },
    { name: "Cader Idris Approach", lat: 52.699, lng: -3.907, rideType: "mountain" },
    { name: "Builth Wells", lat: 52.149, lng: -3.405, rideType: "scenic" },
    { name: "Elan Valley Road", lat: 52.27, lng: -3.6, rideType: "lake" },
    { name: "Cambrian Spine Scenic", lat: 52.65, lng: -3.65, rideType: "scenic" },
    { name: "Mid Wales Ridge Drive", lat: 52.4, lng: -3.55, rideType: "mountain" }
  ]
},
IE: {
  "ireland-west-wild-atlantic": [
    { name: "Donegal Coastal Drive", lat: 55.03, lng: -8.34, rideType: "coastal" },
    { name: "Slieve League Cliffs Road", lat: 54.63, lng: -8.68, rideType: "scenic" },
    { name: "Wild Atlantic Way North", lat: 54.5, lng: -9.2, rideType: "scenic" },
    { name: "Westport to Louisburgh", lat: 53.8, lng: -9.66, rideType: "coastal" },
    { name: "Connemara Loop", lat: 53.5, lng: -9.9, rideType: "scenic" },
    { name: "Sky Road Clifden", lat: 53.49, lng: -10.02, rideType: "coastal" },
    { name: "Leenane Mountain Pass", lat: 53.6, lng: -9.7, rideType: "mountain" },
    { name: "Galway Bay Coastal", lat: 53.2, lng: -9.3, rideType: "coastal" },
    { name: "Burren Scenic Drive", lat: 53.0, lng: -9.1, rideType: "scenic" },
    { name: "Cliffs of Moher Route", lat: 52.97, lng: -9.43, rideType: "coastal" }
  ],

  "ireland-south-kerry-cork": [
    { name: "Ring of Kerry Full Loop", lat: 51.9, lng: -10.1, rideType: "scenic" },
    { name: "Killarney National Park Drive", lat: 52.06, lng: -9.5, rideType: "scenic" },
    { name: "Gap of Dunloe", lat: 52.0, lng: -9.65, rideType: "mountain" },
    { name: "Dingle Peninsula Loop", lat: 52.14, lng: -10.27, rideType: "coastal" },
    { name: "Slea Head Drive", lat: 52.1, lng: -10.45, rideType: "coastal" },
    { name: "Connor Pass", lat: 52.23, lng: -10.25, rideType: "mountain" },
    { name: "Kenmare to Glengarriff", lat: 51.75, lng: -9.55, rideType: "scenic" },
    { name: "Beara Peninsula Route", lat: 51.7, lng: -9.9, rideType: "coastal" },
    { name: "West Cork Coastal Drive", lat: 51.6, lng: -9.5, rideType: "coastal" },
    { name: "Mizen Head Route", lat: 51.45, lng: -9.82, rideType: "coastal" }
  ]
},
NO: {
  "norway-west-fjords": [
    { name: "Bergen Coastal Road", lat: 60.39, lng: 5.32, rideType: "coastal" },
    { name: "Hardangerfjord Route", lat: 60.37, lng: 6.15, rideType: "scenic" },
    { name: "Sognefjord Scenic Drive", lat: 61.1, lng: 6.8, rideType: "scenic" },
    { name: "Aurlandsfjellet Road", lat: 60.9, lng: 7.2, rideType: "mountain" },
    { name: "Lærdal Mountain Pass", lat: 61.1, lng: 7.5, rideType: "mountain" },
    { name: "Geiranger Trollstigen Link", lat: 62.3, lng: 7.4, rideType: "mountain" },
    { name: "Trollstigen Road", lat: 62.45, lng: 7.66, rideType: "mountain" },
    { name: "Atlantic Ocean Road", lat: 63.02, lng: 7.35, rideType: "coastal" },
    { name: "Ålesund Coastal Drive", lat: 62.47, lng: 6.15, rideType: "coastal" },
    { name: "Fjord Panorama Route", lat: 61.5, lng: 6.9, rideType: "scenic" }
  ],

  "norway-south-telemark": [
    { name: "Rjukan Mountain Route", lat: 59.88, lng: 8.59, rideType: "mountain" },
    { name: "Gaustatoppen Scenic Climb", lat: 59.85, lng: 8.65, rideType: "mountain" },
    { name: "Telemark Scenic Road", lat: 59.5, lng: 8.5, rideType: "scenic" },
    { name: "Setesdal Valley Ride", lat: 59.35, lng: 7.55, rideType: "scenic" },
    { name: "Setesdal Twisties", lat: 59.2, lng: 7.7, rideType: "mountain" },
    { name: "Agder Inland Road", lat: 58.4, lng: 7.9, rideType: "scenic" },
    { name: "Southern Norway Ridge", lat: 58.9, lng: 8.2, rideType: "mountain" },
    { name: "Kristiansand Inland Loop", lat: 58.15, lng: 7.9, rideType: "scenic" },
    { name: "Telemark Forest Ride", lat: 59.3, lng: 8.0, rideType: "forest" },
    { name: "South Norway Scenic Link", lat: 59.0, lng: 8.3, rideType: "scenic" }
  ]
},
SE: {
  "sweden-south-lakes": [
    { name: "Lake Vänern Loop", lat: 58.9, lng: 13.3, rideType: "lake" },
    { name: "Vänern Scenic Drive", lat: 58.7, lng: 13.0, rideType: "scenic" },
    { name: "Lake Vättern East Road", lat: 58.4, lng: 14.6, rideType: "lake" },
    { name: "Vättern Panorama Route", lat: 58.2, lng: 14.7, rideType: "scenic" },
    { name: "Jönköping Forest Ride", lat: 57.78, lng: 14.16, rideType: "forest" },
    { name: "Småland Scenic Route", lat: 57.5, lng: 14.5, rideType: "scenic" },
    { name: "South Sweden Twisties", lat: 57.9, lng: 13.8, rideType: "scenic" },
    { name: "Halland Inland Road", lat: 56.9, lng: 13.0, rideType: "scenic" },
    { name: "Lake District Sweden Link", lat: 58.1, lng: 13.5, rideType: "lake" },
    { name: "Southern Sweden Ridge", lat: 57.7, lng: 13.6, rideType: "scenic" }
  ],

  "sweden-west-coast": [
    { name: "Gothenburg Coastal Ride", lat: 57.7, lng: 11.97, rideType: "coastal" },
    { name: "Varberg Coastal Road", lat: 57.1, lng: 12.25, rideType: "coastal" },
    { name: "Bohuslän Scenic Coast", lat: 58.8, lng: 11.2, rideType: "coastal" },
    { name: "Fjällbacka Coastal Drive", lat: 58.6, lng: 11.28, rideType: "coastal" },
    { name: "West Sweden Archipelago", lat: 57.9, lng: 11.5, rideType: "coastal" },
    { name: "Swedish Coastal Panorama", lat: 58.2, lng: 11.6, rideType: "scenic" },
    { name: "North Bohuslän Ride", lat: 58.9, lng: 11.3, rideType: "coastal" },
    { name: "West Coast Twisties", lat: 57.8, lng: 11.9, rideType: "scenic" },
    { name: "Göteborg Inland Link", lat: 57.7, lng: 12.2, rideType: "scenic" },
    { name: "Scandinavian Coast Route", lat: 58.5, lng: 11.4, rideType: "coastal" }
  ]
},
ES: {
  "spain-andalusia-coast": [
    { name: "Costa del Sol Ride", lat: 36.55, lng: -4.62, rideType: "coastal" },
    { name: "Marbella Coastal Drive", lat: 36.51, lng: -4.89, rideType: "coastal" },
    { name: "Málaga to Nerja Coast", lat: 36.75, lng: -3.88, rideType: "coastal" },
    { name: "Nerja Cliff Road", lat: 36.75, lng: -3.88, rideType: "scenic" },
    { name: "Granada Costa Scenic", lat: 36.75, lng: -3.55, rideType: "scenic" },
    { name: "Cabo de Gata Coastal Loop", lat: 36.76, lng: -2.19, rideType: "coastal" },
    { name: "Almería Coast Ride", lat: 36.84, lng: -2.46, rideType: "coastal" },
    { name: "Tarifa Wind Coast", lat: 36.01, lng: -5.61, rideType: "coastal" },
    { name: "Cádiz Atlantic Scenic", lat: 36.53, lng: -6.29, rideType: "scenic" },
    { name: "Andalusia Sea View Route", lat: 36.4, lng: -4.3, rideType: "scenic" }
  ],

  "spain-andalusia-inland": [
    { name: "Ronda Mountain Road", lat: 36.74, lng: -5.17, rideType: "mountain" },
    { name: "Grazalema Scenic Pass", lat: 36.76, lng: -5.37, rideType: "mountain" },
    { name: "White Villages Route", lat: 36.8, lng: -5.3, rideType: "scenic" },
    { name: "Antequera Twisties", lat: 37.02, lng: -4.56, rideType: "scenic" },
    { name: "Granada Sierra Link", lat: 37.18, lng: -3.6, rideType: "mountain" },
    { name: "Sierra Nevada Foothills", lat: 37.1, lng: -3.5, rideType: "mountain" },
    { name: "Córdoba Inland Scenic", lat: 37.88, lng: -4.77, rideType: "scenic" },
    { name: "Jaén Olive Road", lat: 37.77, lng: -3.79, rideType: "scenic" },
    { name: "Cazorla Natural Route", lat: 37.91, lng: -3.0, rideType: "forest" },
    { name: "Andalusia Ridge Drive", lat: 37.3, lng: -4.0, rideType: "mountain" }
  ]
},
FI: {
  "finland-south-lakes": [
    { name: "Helsinki Scenic Inland", lat: 60.2, lng: 25.0, rideType: "scenic" },
    { name: "Lahti Lake Ride", lat: 60.98, lng: 25.66, rideType: "lake" },
    { name: "Saimaa Lake Loop", lat: 61.3, lng: 28.5, rideType: "lake" },
    { name: "Lappeenranta Scenic", lat: 61.06, lng: 28.18, rideType: "scenic" },
    { name: "South Finland Lake District", lat: 61.2, lng: 27.8, rideType: "lake" },
    { name: "Kymenlaakso Scenic Route", lat: 60.8, lng: 26.5, rideType: "scenic" },
    { name: "Finnish Lake Panorama", lat: 61.1, lng: 27.5, rideType: "lake" },
    { name: "Eastern Finland Ridge", lat: 61.3, lng: 27.0, rideType: "scenic" },
    { name: "Saimaa Forest Link", lat: 61.4, lng: 28.0, rideType: "forest" },
    { name: "South Finland Scenic Drive", lat: 60.9, lng: 26.8, rideType: "scenic" }
  ],

  "finland-central-forest": [
    { name: "Jyväskylä Scenic Ride", lat: 62.24, lng: 25.75, rideType: "scenic" },
    { name: "Tampere Lake Route", lat: 61.5, lng: 23.76, rideType: "lake" },
    { name: "Lake Päijänne Loop", lat: 61.7, lng: 25.5, rideType: "lake" },
    { name: "Central Finland Forest Ride", lat: 62.0, lng: 25.0, rideType: "forest" },
    { name: "Pirkanmaa Scenic Drive", lat: 61.6, lng: 24.5, rideType: "scenic" },
    { name: "Finnish Forest Twisties", lat: 62.1, lng: 25.2, rideType: "forest" },
    { name: "Nordic Inland Route", lat: 62.0, lng: 24.8, rideType: "scenic" },
    { name: "Lake District Finland Link", lat: 61.9, lng: 25.3, rideType: "lake" },
    { name: "Central Finland Ridge", lat: 62.2, lng: 25.0, rideType: "scenic" },
    { name: "Scandinavian Forest Route", lat: 62.3, lng: 25.6, rideType: "forest" }
  ]
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