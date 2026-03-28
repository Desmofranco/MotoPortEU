// server/routes/scripts/lib/routeScopes.js

export const COUNTRY_SCOPES = {
  IT: {
    country: "IT",
    name: "Italy",
    scopes: {
      "italy-nw": {
        name: "Italia Nord-Ovest",
        regions: ["Valle d'Aosta", "Piemonte", "Liguria", "Lombardia"],
        areas: [
          { name: "Aosta / Monte Bianco", lat: 45.85, lng: 7.1, radius: 50000 },
          { name: "Canavese / Gran Paradiso", lat: 45.45, lng: 7.35, radius: 50000 },
          { name: "Cuneese / Alpi Marittime", lat: 44.25, lng: 7.3, radius: 50000 },
          { name: "Lago Maggiore", lat: 45.95, lng: 8.55, radius: 50000 },
          { name: "Lago di Como / Stelvio", lat: 46.25, lng: 9.9, radius: 50000 },
          { name: "Lago di Garda Ovest", lat: 45.75, lng: 10.45, radius: 50000 },
          { name: "Appennino Ligure", lat: 44.45, lng: 9.1, radius: 50000 }
        ]
      },

      "italy-ne": {
        name: "Italia Nord-Est",
        regions: ["Trentino-Alto Adige", "Veneto", "Friuli-Venezia Giulia", "Emilia-Romagna"],
        areas: [
          { name: "Dolomiti Ovest", lat: 46.45, lng: 11.75, radius: 50000 },
          { name: "Sellaronda", lat: 46.52, lng: 11.78, radius: 40000 },
          { name: "Dolomiti Est / Cortina", lat: 46.53, lng: 12.13, radius: 50000 },
          { name: "Trentino Laghi", lat: 46.0, lng: 10.95, radius: 50000 },
          { name: "Lessinia / Monte Baldo", lat: 45.7, lng: 10.9, radius: 50000 },
          { name: "Friuli Carnia", lat: 46.45, lng: 12.85, radius: 50000 },
          { name: "Appennino Tosco-Emiliano", lat: 44.2, lng: 10.25, radius: 50000 }
        ]
      },

      "italy-center": {
        name: "Italia Centro",
        regions: ["Toscana", "Umbria", "Marche", "Lazio", "Abruzzo", "Molise"],
        areas: [
          { name: "Chianti / Crete Senesi", lat: 43.35, lng: 11.3, radius: 50000 },
          { name: "Garfagnana / Apuane", lat: 44.1, lng: 10.35, radius: 50000 },
          { name: "Casentino / Foreste", lat: 43.8, lng: 11.85, radius: 50000 },
          { name: "Val d'Orcia / Amiata", lat: 43.02, lng: 11.62, radius: 50000 },
          { name: "Umbria centrale", lat: 42.95, lng: 12.55, radius: 50000 },
          { name: "Sibillini", lat: 42.9, lng: 13.2, radius: 50000 },
          { name: "Gran Sasso / Majella", lat: 42.25, lng: 13.75, radius: 50000 },
          { name: "Terminillo / Lazio nord", lat: 42.47, lng: 12.98, radius: 50000 }
        ]
      },

      "italy-south": {
        name: "Italia Sud",
        regions: ["Campania", "Basilicata", "Puglia", "Calabria"],
        areas: [
          { name: "Costiera Amalfitana", lat: 40.63, lng: 14.6, radius: 40000 },
          { name: "Cilento", lat: 40.2, lng: 15.2, radius: 50000 },
          { name: "Irpinia / Sannio", lat: 41.0, lng: 15.0, radius: 50000 },
          { name: "Pollino", lat: 39.92, lng: 16.15, radius: 50000 },
          { name: "Dolomiti Lucane", lat: 40.53, lng: 15.87, radius: 50000 },
          { name: "Gargano", lat: 41.75, lng: 16.05, radius: 50000 },
          { name: "Murge / Valle d'Itria", lat: 40.8, lng: 17.2, radius: 50000 },
          { name: "Sila / Aspromonte", lat: 39.2, lng: 16.6, radius: 50000 }
        ]
      },

      sicily: {
        name: "Sicilia",
        regions: ["Sicilia"],
        areas: [
          { name: "Etna", lat: 37.75, lng: 14.99, radius: 50000 },
          { name: "Nebrodi", lat: 37.95, lng: 14.7, radius: 50000 },
          { name: "Madonie", lat: 37.87, lng: 14.02, radius: 50000 },
          { name: "Palermo / Trapani Coast", lat: 38.0, lng: 13.1, radius: 50000 },
          { name: "Ragusa / Val di Noto", lat: 36.95, lng: 14.73, radius: 50000 },
          { name: "Messina / Peloritani", lat: 38.1, lng: 15.45, radius: 50000 }
        ]
      },

      sardinia: {
        name: "Sardegna",
        regions: ["Sardegna"],
        areas: [
          { name: "Costa Smeralda / Gallura", lat: 41.08, lng: 9.55, radius: 50000 },
          { name: "Supramonte", lat: 40.18, lng: 9.5, radius: 50000 },
          { name: "Ogliastra", lat: 39.8, lng: 9.65, radius: 50000 },
          { name: "Sulcis / Iglesiente", lat: 39.25, lng: 8.5, radius: 50000 },
          { name: "Alghero / Bosa Coast", lat: 40.35, lng: 8.42, radius: 50000 },
          { name: "Barbagia", lat: 40.03, lng: 9.18, radius: 50000 }
        ]
      }
    }
  }
};

export function parseCliArgs(argv = process.argv.slice(2)) {
  const out = {};
  for (const arg of argv) {
    if (!arg.startsWith("--")) continue;
    const [key, ...rest] = arg.slice(2).split("=");
    out[key] = rest.length ? rest.join("=") : true;
  }
  return out;
}

export function getCountryConfig(country = "IT") {
  const upper = String(country || "IT").toUpperCase();
  const cfg = COUNTRY_SCOPES[upper];
  if (!cfg) {
    throw new Error(`Paese non supportato: ${upper}`);
  }
  return cfg;
}

export function getScopeConfig({ country = "IT", scope = null } = {}) {
  const countryCfg = getCountryConfig(country);

  if (!scope) {
    return {
      country: countryCfg.country,
      countryName: countryCfg.name,
      scope: null,
      scopeName: countryCfg.name,
      areas: Object.values(countryCfg.scopes).flatMap((x) => x.areas),
      regions: [...new Set(Object.values(countryCfg.scopes).flatMap((x) => x.regions))]
    };
  }

  const scopeCfg = countryCfg.scopes[scope];
  if (!scopeCfg) {
    throw new Error(`Scope non supportato per ${countryCfg.country}: ${scope}`);
  }

  return {
    country: countryCfg.country,
    countryName: countryCfg.name,
    scope,
    scopeName: scopeCfg.name,
    areas: scopeCfg.areas,
    regions: scopeCfg.regions
  };
}

export function getScopeSuffix({ country = "IT", scope = null } = {}) {
  const upper = String(country || "IT").toUpperCase();
  return scope ? `${upper}.${scope}` : `${upper}.all`;
}

export function listCountryScopes(country = "IT") {
  const cfg = getCountryConfig(country);
  return Object.keys(cfg.scopes);
}