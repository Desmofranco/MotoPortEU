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
          { name: "Umbria Centrale", lat: 42.95, lng: 12.55, radius: 50000 },
          { name: "Sibillini", lat: 42.9, lng: 13.2, radius: 50000 },
          { name: "Gran Sasso / Majella", lat: 42.25, lng: 13.75, radius: 50000 },
          { name: "Terminillo / Lazio Nord", lat: 42.47, lng: 12.98, radius: 50000 }
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

      "italy-coastal": {
        name: "Italia Coste",
        regions: ["Liguria", "Campania", "Puglia", "Calabria", "Sicilia", "Sardegna", "Abruzzo", "Marche"],
        areas: [
          { name: "Liguria Coast", lat: 44.2, lng: 8.4, radius: 50000 },
          { name: "Cinque Terre / Levante", lat: 44.15, lng: 9.72, radius: 40000 },
          { name: "Amalfi Coast", lat: 40.63, lng: 14.6, radius: 40000 },
          { name: "Salento Coast", lat: 40.17, lng: 18.2, radius: 50000 },
          { name: "Calabria Tyrrhenian", lat: 38.68, lng: 15.9, radius: 50000 },
          { name: "Calabria Ionian", lat: 38.91, lng: 16.73, radius: 50000 },
          { name: "Conero / Adriatic Coast", lat: 43.54, lng: 13.62, radius: 40000 }
        ]
      },

      "italy-lakes": {
        name: "Italia Laghi",
        regions: ["Lombardia", "Piemonte", "Veneto", "Trentino-Alto Adige", "Umbria"],
        areas: [
          { name: "Lake Garda", lat: 45.65, lng: 10.64, radius: 45000 },
          { name: "Lake Como", lat: 46.0, lng: 9.26, radius: 40000 },
          { name: "Lake Maggiore", lat: 45.94, lng: 8.54, radius: 40000 },
          { name: "Lake Iseo", lat: 45.71, lng: 10.07, radius: 30000 },
          { name: "Lake Orta", lat: 45.8, lng: 8.42, radius: 25000 },
          { name: "Lake Trasimeno", lat: 43.13, lng: 12.13, radius: 30000 }
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
  },

  FR: {
    country: "FR",
    name: "France",
    scopes: {
      "france-alps-north": {
        name: "France Alpes Nord",
        regions: ["Auvergne-Rhône-Alpes"],
        areas: [
          { name: "Annecy / Aravis", lat: 45.88, lng: 6.33, radius: 50000 },
          { name: "Beaufortain / Roselend", lat: 45.69, lng: 6.64, radius: 50000 },
          { name: "Maurienne", lat: 45.29, lng: 6.35, radius: 50000 },
          { name: "Vanoise", lat: 45.38, lng: 6.7, radius: 50000 },
          { name: "Lac du Bourget / Chartreuse", lat: 45.72, lng: 5.86, radius: 50000 }
        ]
      },

      "france-alps-south": {
        name: "France Alpes Sud",
        regions: ["Provence-Alpes-Côte d'Azur", "Auvergne-Rhône-Alpes"],
        areas: [
          { name: "Briançon / Izoard", lat: 44.9, lng: 6.64, radius: 50000 },
          { name: "Barcelonnette / Bonette", lat: 44.39, lng: 6.65, radius: 50000 },
          { name: "Mercantour", lat: 44.17, lng: 7.23, radius: 50000 },
          { name: "Verdon", lat: 43.74, lng: 6.36, radius: 50000 },
          { name: "Gap / Dévoluy", lat: 44.56, lng: 6.08, radius: 50000 }
        ]
      },

      "france-pyrenees-east": {
        name: "France Pyrénées Est",
        regions: ["Occitanie"],
        areas: [
          { name: "Foix / Ax-les-Thermes", lat: 42.72, lng: 1.84, radius: 50000 },
          { name: "Andorra Border", lat: 42.57, lng: 1.6, radius: 40000 },
          { name: "Canigou / Conflent", lat: 42.53, lng: 2.45, radius: 50000 }
        ]
      },

      "france-pyrenees-center": {
        name: "France Pyrénées Centre",
        regions: ["Occitanie"],
        areas: [
          { name: "Saint-Girons", lat: 42.99, lng: 1.15, radius: 50000 },
          { name: "Luchon / Peyresourde", lat: 42.79, lng: 0.59, radius: 50000 },
          { name: "Arreau / Aspin / Tourmalet", lat: 42.91, lng: 0.36, radius: 50000 }
        ]
      },

      "france-pyrenees-west": {
        name: "France Pyrénées Ouest",
        regions: ["Nouvelle-Aquitaine", "Occitanie"],
        areas: [
          { name: "Oloron / Aubisque", lat: 43.18, lng: -0.61, radius: 50000 },
          { name: "Luz-Saint-Sauveur / Tourmalet", lat: 42.87, lng: -0.01, radius: 50000 },
          { name: "Saint-Jean-Pied-de-Port", lat: 43.16, lng: -1.24, radius: 40000 }
        ]
      },

      "france-cote-d-azur": {
        name: "France Côte d'Azur",
        regions: ["Provence-Alpes-Côte d'Azur"],
        areas: [
          { name: "Nice Hinterland", lat: 43.85, lng: 7.24, radius: 50000 },
          { name: "Esterel Coast", lat: 43.44, lng: 6.85, radius: 40000 },
          { name: "Route Napoléon South", lat: 43.95, lng: 6.52, radius: 50000 }
        ]
      },

      corsica: {
        name: "Corse",
        regions: ["Corse"],
        areas: [
          { name: "Bastia / Cap Corse", lat: 42.7, lng: 9.45, radius: 50000 },
          { name: "Corte / Central Mountains", lat: 42.3, lng: 9.15, radius: 50000 },
          { name: "Ajaccio / Gulf", lat: 41.92, lng: 8.74, radius: 50000 },
          { name: "Bonifacio / South Coast", lat: 41.39, lng: 9.16, radius: 50000 }
        ]
      }
    }
  },

  CH: {
    country: "CH",
    name: "Switzerland",
    scopes: {
      "switzerland-west": {
        name: "Svizzera Ovest",
        regions: ["Vaud", "Valais", "Fribourg", "Neuchâtel", "Geneva"],
        areas: [
          { name: "Lac Léman / Lavaux", lat: 46.48, lng: 6.78, radius: 50000 },
          { name: "Valais / Sion", lat: 46.23, lng: 7.36, radius: 50000 },
          { name: "Neuchâtel / Jura Sud", lat: 46.99, lng: 6.93, radius: 50000 }
        ]
      },

      "switzerland-central": {
        name: "Svizzera Centrale",
        regions: ["Bern", "Uri", "Obwalden", "Nidwalden", "Schwyz"],
        areas: [
          { name: "Interlaken / Jungfrau", lat: 46.69, lng: 7.86, radius: 50000 },
          { name: "Andermatt / Furka", lat: 46.63, lng: 8.59, radius: 50000 },
          { name: "Lucerne / Vierwaldstättersee", lat: 47.05, lng: 8.31, radius: 50000 }
        ]
      },

      "switzerland-east": {
        name: "Svizzera Est",
        regions: ["Graubünden", "St. Gallen", "Glarus"],
        areas: [
          { name: "Davos / Flüela", lat: 46.8, lng: 9.84, radius: 50000 },
          { name: "Sankt Moritz / Bernina", lat: 46.5, lng: 9.84, radius: 50000 },
          { name: "Chur / Oberalp", lat: 46.85, lng: 9.53, radius: 50000 }
        ]
      },

      ticino: {
        name: "Ticino",
        regions: ["Ticino"],
        areas: [
          { name: "Bellinzona / San Bernardino", lat: 46.19, lng: 9.02, radius: 50000 },
          { name: "Lugano / Monte Generoso", lat: 45.98, lng: 8.95, radius: 40000 },
          { name: "Locarno / Centovalli", lat: 46.17, lng: 8.8, radius: 40000 }
        ]
      }
    }
  },

  AT: {
    country: "AT",
    name: "Austria",
    scopes: {
      tyrol: {
        name: "Tirol",
        regions: ["Tirol", "Vorarlberg"],
        areas: [
          { name: "Innsbruck / Kühtai", lat: 47.26, lng: 11.39, radius: 50000 },
          { name: "Ötztal / Timmelsjoch", lat: 46.91, lng: 11.03, radius: 50000 },
          { name: "Silvretta / Montafon", lat: 46.93, lng: 10.09, radius: 50000 },
          { name: "Arlberg", lat: 47.13, lng: 10.22, radius: 50000 }
        ]
      },

      salzburg: {
        name: "Salzburg",
        regions: ["Salzburg"],
        areas: [
          { name: "Grossglockner North", lat: 47.12, lng: 12.8, radius: 50000 },
          { name: "Tennengebirge / Dachstein", lat: 47.45, lng: 13.38, radius: 50000 },
          { name: "Salzkammergut West", lat: 47.73, lng: 13.44, radius: 50000 }
        ]
      },

      carinthia: {
        name: "Carinthia",
        regions: ["Carinthia", "Styria"],
        areas: [
          { name: "Nockalmstraße", lat: 46.94, lng: 13.77, radius: 50000 },
          { name: "Villach / Wurzenpass", lat: 46.62, lng: 13.85, radius: 50000 },
          { name: "Klagenfurt Lakes", lat: 46.62, lng: 14.31, radius: 50000 }
        ]
      },

      "austria-west": {
        name: "Austria Ovest",
        regions: ["Vorarlberg", "Tirol"],
        areas: [
          { name: "Bregenzerwald", lat: 47.36, lng: 9.93, radius: 50000 },
          { name: "Lechtal", lat: 47.29, lng: 10.62, radius: 50000 },
          { name: "Kaunertal", lat: 46.92, lng: 10.72, radius: 50000 }
        ]
      }
    }
  },

  DE: {
    country: "DE",
    name: "Germany",
    scopes: {
      "germany-alps-bavaria": {
        name: "Germania Alpi Bavaresi",
        regions: ["Bavaria"],
        areas: [
          { name: "Berchtesgaden", lat: 47.63, lng: 13.0, radius: 50000 },
          { name: "Garmisch / Zugspitze", lat: 47.49, lng: 11.1, radius: 50000 },
          { name: "Allgäu", lat: 47.57, lng: 10.28, radius: 50000 }
        ]
      },

      "germany-black-forest": {
        name: "Germania Foresta Nera",
        regions: ["Baden-Württemberg"],
        areas: [
          { name: "Freudenstadt", lat: 48.47, lng: 8.41, radius: 50000 },
          { name: "Titisee / Schluchsee", lat: 47.91, lng: 8.16, radius: 50000 },
          { name: "Baden-Baden / Mummelsee", lat: 48.67, lng: 8.21, radius: 50000 }
        ]
      },

      "germany-eifel-mosel": {
        name: "Germania Eifel / Mosella",
        regions: ["Rhineland-Palatinate", "North Rhine-Westphalia"],
        areas: [
          { name: "Eifel", lat: 50.33, lng: 6.62, radius: 50000 },
          { name: "Mosel Valley", lat: 49.91, lng: 7.07, radius: 50000 },
          { name: "Nürburgring Hinterland", lat: 50.34, lng: 6.95, radius: 50000 }
        ]
      }
    }
  },

  ES: {
    country: "ES",
    name: "Spain",
    scopes: {
      "spain-pyrenees-east": {
        name: "Spagna Pirenei Est",
        regions: ["Catalonia", "Aragon"],
        areas: [
          { name: "Vielha / Val d'Aran", lat: 42.7, lng: 0.79, radius: 50000 },
          { name: "Andorra Access / La Seu", lat: 42.36, lng: 1.46, radius: 50000 },
          { name: "Ripollès / Cerdanya", lat: 42.37, lng: 2.17, radius: 50000 }
        ]
      },

      "spain-pyrenees-west": {
        name: "Spagna Pirenei Ovest",
        regions: ["Aragon", "Navarre"],
        areas: [
          { name: "Jaca / Somport", lat: 42.57, lng: -0.55, radius: 50000 },
          { name: "Aínsa / Ordesa", lat: 42.41, lng: 0.14, radius: 50000 },
          { name: "Roncal / Navarra", lat: 42.81, lng: -0.96, radius: 50000 }
        ]
      },

      "spain-picos-europa": {
        name: "Spagna Picos de Europa",
        regions: ["Asturias", "Cantabria", "Castile and León"],
        areas: [
          { name: "Cangas de Onís", lat: 43.35, lng: -5.13, radius: 50000 },
          { name: "Potes / Fuente Dé", lat: 43.16, lng: -4.62, radius: 50000 },
          { name: "Riaño", lat: 42.97, lng: -5.0, radius: 50000 }
        ]
      },

      "spain-sierra-nevada": {
        name: "Spagna Sierra Nevada",
        regions: ["Andalusia"],
        areas: [
          { name: "Granada / Sierra Nevada", lat: 37.1, lng: -3.53, radius: 50000 },
          { name: "Alpujarras", lat: 36.95, lng: -3.23, radius: 50000 },
          { name: "Cabo de Gata Hinterland", lat: 36.81, lng: -2.13, radius: 50000 }
        ]
      },

      "spain-costa-brava": {
        name: "Spagna Costa Brava",
        regions: ["Catalonia"],
        areas: [
          { name: "Girona Coast", lat: 41.98, lng: 3.17, radius: 50000 },
          { name: "Tossa / Sant Feliu", lat: 41.77, lng: 2.95, radius: 40000 },
          { name: "Cap de Creus", lat: 42.31, lng: 3.32, radius: 40000 }
        ]
      },

      "spain-basque-navarra": {
        name: "Spagna Baschi / Navarra",
        regions: ["Basque Country", "Navarre"],
        areas: [
          { name: "Pamplona Hinterland", lat: 42.81, lng: -1.64, radius: 50000 },
          { name: "Urkiola / Basque Mountains", lat: 43.1, lng: -2.63, radius: 50000 },
          { name: "Jaizkibel / Coast", lat: 43.36, lng: -1.8, radius: 40000 }
        ]
      }
    }
  },

  PT: {
    country: "PT",
    name: "Portugal",
    scopes: {
      "portugal-north": {
        name: "Portogallo Nord",
        regions: ["Norte"],
        areas: [
          { name: "Peneda-Gerês", lat: 41.78, lng: -8.17, radius: 50000 },
          { name: "Douro Valley", lat: 41.18, lng: -7.54, radius: 50000 },
          { name: "Serra da Estrela North Access", lat: 40.4, lng: -7.61, radius: 50000 }
        ]
      },

      "portugal-center": {
        name: "Portogallo Centro",
        regions: ["Centro"],
        areas: [
          { name: "Serra da Estrela", lat: 40.32, lng: -7.61, radius: 50000 },
          { name: "Lousã / Açor", lat: 40.1, lng: -8.25, radius: 50000 },
          { name: "Nazaré Hinterland", lat: 39.61, lng: -9.07, radius: 50000 }
        ]
      },

      "portugal-south": {
        name: "Portogallo Sud",
        regions: ["Alentejo", "Algarve"],
        areas: [
          { name: "Monchique", lat: 37.32, lng: -8.56, radius: 50000 },
          { name: "Alentejo Interior", lat: 38.18, lng: -7.52, radius: 50000 },
          { name: "Algarve West Coast", lat: 37.1, lng: -8.95, radius: 50000 }
        ]
      }
    }
  },

  SI: {
    country: "SI",
    name: "Slovenia",
    scopes: {
      "slovenia-julian-alps": {
        name: "Slovenia Alpi Giulie",
        regions: ["Upper Carniola", "Gorizia"],
        areas: [
          { name: "Kranjska Gora / Vršič", lat: 46.49, lng: 13.79, radius: 50000 },
          { name: "Bovec / Soča", lat: 46.34, lng: 13.55, radius: 50000 },
          { name: "Bled / Bohinj", lat: 46.36, lng: 14.09, radius: 50000 }
        ]
      },

      "slovenia-karst-coast": {
        name: "Slovenia Carso / Costa",
        regions: ["Littoral", "Inner Carniola"],
        areas: [
          { name: "Postojna / Predjama", lat: 45.77, lng: 14.21, radius: 50000 },
          { name: "Koper / Coast", lat: 45.55, lng: 13.73, radius: 40000 },
          { name: "Vipava Valley", lat: 45.84, lng: 13.96, radius: 50000 }
        ]
      }
    }
  },

  HR: {
    country: "HR",
    name: "Croatia",
    scopes: {
      "croatia-velebit": {
        name: "Croazia Velebit",
        regions: ["Lika-Senj", "Zadar"],
        areas: [
          { name: "Karlobag / Velebit", lat: 44.53, lng: 15.07, radius: 50000 },
          { name: "Gospić Interior", lat: 44.54, lng: 15.37, radius: 50000 },
          { name: "Paklenica", lat: 44.31, lng: 15.44, radius: 50000 }
        ]
      },

      "croatia-adriatic": {
        name: "Croazia Adriatico",
        regions: ["Primorje-Gorski Kotar", "Zadar", "Split-Dalmatia", "Dubrovnik-Neretva"],
        areas: [
          { name: "Rijeka Hinterland", lat: 45.33, lng: 14.44, radius: 50000 },
          { name: "Makarska Riviera", lat: 43.3, lng: 17.02, radius: 50000 },
          { name: "Dubrovnik Coast", lat: 42.65, lng: 18.09, radius: 50000 }
        ]
      },

      "croatia-istria": {
        name: "Croazia Istria",
        regions: ["Istria"],
        areas: [
          { name: "Pazin Interior", lat: 45.24, lng: 13.94, radius: 50000 },
          { name: "Pula / Cape Kamenjak", lat: 44.84, lng: 13.84, radius: 40000 },
          { name: "Rovinj / Lim Fjord", lat: 45.08, lng: 13.64, radius: 40000 }
        ]
      }
    }
  },

  BA: {
    country: "BA",
    name: "Bosnia and Herzegovina",
    scopes: {
      "bosnia-dinaric-west": {
        name: "Bosnia Dinariche Ovest",
        regions: ["Una-Sana", "West Bosnia"],
        areas: [
          { name: "Bihać / Una", lat: 44.81, lng: 15.87, radius: 50000 },
          { name: "Drvar / Bosansko Grahovo", lat: 44.37, lng: 16.39, radius: 50000 },
          { name: "Livno Plateau", lat: 43.83, lng: 17.0, radius: 50000 }
        ]
      },

      "bosnia-dinaric-south": {
        name: "Bosnia Dinariche Sud",
        regions: ["Herzegovina-Neretva"],
        areas: [
          { name: "Mostar Hinterland", lat: 43.34, lng: 17.81, radius: 50000 },
          { name: "Blidinje", lat: 43.63, lng: 17.57, radius: 50000 },
          { name: "Trebinje / Herzegovina", lat: 42.71, lng: 18.35, radius: 50000 }
        ]
      }
    }
  },

  ME: {
    country: "ME",
    name: "Montenegro",
    scopes: {
      durmitor: {
        name: "Montenegro Durmitor",
        regions: ["Northern Montenegro"],
        areas: [
          { name: "Žabljak / Durmitor", lat: 43.15, lng: 19.12, radius: 50000 },
          { name: "Piva Canyon", lat: 43.16, lng: 18.83, radius: 50000 },
          { name: "Tara Canyon", lat: 43.13, lng: 19.3, radius: 50000 }
        ]
      },

      "montenegro-coastal": {
        name: "Montenegro Costa",
        regions: ["Coastal Montenegro"],
        areas: [
          { name: "Kotor Bay", lat: 42.43, lng: 18.77, radius: 50000 },
          { name: "Lovćen / Cetinje", lat: 42.39, lng: 18.83, radius: 50000 },
          { name: "Budva / Bar Coast", lat: 42.1, lng: 19.1, radius: 50000 }
        ]
      }
    }
  },

  AL: {
    country: "AL",
    name: "Albania",
    scopes: {
      "albania-alps": {
        name: "Albania Alps",
        regions: ["Shkodër", "Kukës"],
        areas: [
          { name: "Theth / Valbonë", lat: 42.4, lng: 19.77, radius: 50000 },
          { name: "Bajram Curri", lat: 42.36, lng: 20.08, radius: 50000 },
          { name: "Shkodër Hinterland", lat: 42.07, lng: 19.52, radius: 50000 }
        ]
      },

      "albania-riviera": {
        name: "Albania Riviera",
        regions: ["Vlorë", "Sarandë"],
        areas: [
          { name: "Llogara Pass", lat: 40.2, lng: 19.59, radius: 50000 },
          { name: "Himarë / Riviera", lat: 40.1, lng: 19.75, radius: 50000 },
          { name: "Sarandë / Butrint", lat: 39.84, lng: 20.01, radius: 50000 }
        ]
      }
    }
  },

  RO: {
    country: "RO",
    name: "Romania",
    scopes: {
      "romania-transfagarasan": {
        name: "Romania Transfăgărășan",
        regions: ["Argeș", "Sibiu"],
        areas: [
          { name: "Curtea de Argeș", lat: 45.14, lng: 24.67, radius: 50000 },
          { name: "Bâlea Lake", lat: 45.61, lng: 24.62, radius: 50000 },
          { name: "Sibiu South", lat: 45.67, lng: 24.15, radius: 50000 }
        ]
      },

      "romania-transalpina": {
        name: "Romania Transalpina",
        regions: ["Gorj", "Vâlcea", "Alba"],
        areas: [
          { name: "Rânca", lat: 45.3, lng: 23.68, radius: 50000 },
          { name: "Sebeș / North Access", lat: 45.95, lng: 23.57, radius: 50000 },
          { name: "Novaci", lat: 45.17, lng: 23.67, radius: 50000 }
        ]
      },

      "romania-bucegi": {
        name: "Romania Bucegi",
        regions: ["Brașov", "Prahova", "Dâmbovița"],
        areas: [
          { name: "Brașov", lat: 45.66, lng: 25.61, radius: 50000 },
          { name: "Sinaia / Bucegi", lat: 45.35, lng: 25.55, radius: 50000 },
          { name: "Bran / Rucăr", lat: 45.51, lng: 25.37, radius: 50000 }
        ]
      }
    }
  },

  SK: {
    country: "SK",
    name: "Slovakia",
    scopes: {
      "slovakia-tatras": {
        name: "Slovacchia Tatras",
        regions: ["Prešov", "Žilina"],
        areas: [
          { name: "Poprad / High Tatras", lat: 49.05, lng: 20.3, radius: 50000 },
          { name: "Štrbské Pleso", lat: 49.12, lng: 20.06, radius: 40000 },
          { name: "Liptov / Low Tatras", lat: 49.08, lng: 19.57, radius: 50000 }
        ]
      },

      "slovakia-central": {
        name: "Slovacchia Centrale",
        regions: ["Banská Bystrica"],
        areas: [
          { name: "Donovaly", lat: 48.88, lng: 19.23, radius: 50000 },
          { name: "Muránska Planina", lat: 48.75, lng: 20.05, radius: 50000 },
          { name: "Kremnica Hills", lat: 48.7, lng: 18.92, radius: 50000 }
        ]
      }
    }
  },

  CZ: {
    country: "CZ",
    name: "Czech Republic",
    scopes: {
      "czech-beskydy": {
        name: "Cechia Beskydy",
        regions: ["Moravian-Silesian", "Zlín"],
        areas: [
          { name: "Beskydy", lat: 49.49, lng: 18.43, radius: 50000 },
          { name: "Javorníky", lat: 49.33, lng: 18.19, radius: 50000 },
          { name: "Hostýnské vrchy", lat: 49.39, lng: 17.73, radius: 50000 }
        ]
      },

      "czech-south": {
        name: "Cechia Sud",
        regions: ["South Bohemia", "South Moravia"],
        areas: [
          { name: "Šumava", lat: 48.97, lng: 13.62, radius: 50000 },
          { name: "Moravian Karst", lat: 49.37, lng: 16.74, radius: 50000 },
          { name: "Podyjí", lat: 48.83, lng: 15.9, radius: 50000 }
        ]
      }
    }
  },

  PL: {
    country: "PL",
    name: "Poland",
    scopes: {
      "poland-tatras": {
        name: "Polonia Tatras",
        regions: ["Lesser Poland"],
        areas: [
          { name: "Zakopane", lat: 49.3, lng: 19.95, radius: 50000 },
          { name: "Nowy Targ", lat: 49.48, lng: 20.03, radius: 50000 },
          { name: "Pieniny", lat: 49.41, lng: 20.44, radius: 50000 }
        ]
      },

      "poland-beskids": {
        name: "Polonia Beskidy",
        regions: ["Silesian", "Lesser Poland"],
        areas: [
          { name: "Żywiec / Beskid Żywiecki", lat: 49.69, lng: 19.2, radius: 50000 },
          { name: "Szczyrk / Beskid Śląski", lat: 49.72, lng: 19.03, radius: 50000 },
          { name: "Beskid Sądecki", lat: 49.42, lng: 20.89, radius: 50000 }
        ]
      }
    }
  },

  NO: {
    country: "NO",
    name: "Norway",
    scopes: {
      "norway-fjords-west": {
        name: "Norvegia Fiordi Ovest",
        regions: ["Vestland", "Møre og Romsdal"],
        areas: [
          { name: "Geiranger", lat: 62.1, lng: 7.21, radius: 50000 },
          { name: "Sognefjord", lat: 61.1, lng: 6.58, radius: 50000 },
          { name: "Aurlandsfjellet", lat: 60.9, lng: 7.22, radius: 50000 }
        ]
      },

      "norway-trollstigen": {
        name: "Norvegia Trollstigen",
        regions: ["Møre og Romsdal"],
        areas: [
          { name: "Trollstigen", lat: 62.46, lng: 7.66, radius: 50000 },
          { name: "Atlantic Road", lat: 63.02, lng: 7.35, radius: 50000 },
          { name: "Romsdalen", lat: 62.56, lng: 7.69, radius: 50000 }
        ]
      },

      "norway-south": {
        name: "Norvegia Sud",
        regions: ["Agder", "Telemark", "Vestfold og Telemark"],
        areas: [
          { name: "Setesdal", lat: 58.96, lng: 7.54, radius: 50000 },
          { name: "Telemark", lat: 59.46, lng: 8.6, radius: 50000 },
          { name: "Hardangervidda South Access", lat: 60.18, lng: 8.0, radius: 50000 }
        ]
      }
    }
  },

  SE: {
    country: "SE",
    name: "Sweden",
    scopes: {
      "sweden-south": {
        name: "Svezia Sud",
        regions: ["Skåne", "Småland", "Halland"],
        areas: [
          { name: "Österlen", lat: 55.58, lng: 14.27, radius: 50000 },
          { name: "Småland Lakes", lat: 57.22, lng: 14.12, radius: 50000 },
          { name: "Halland Coast", lat: 56.67, lng: 12.86, radius: 50000 }
        ]
      },

      "sweden-mid": {
        name: "Svezia Centrale",
        regions: ["Dalarna", "Värmland"],
        areas: [
          { name: "Siljan", lat: 60.92, lng: 14.55, radius: 50000 },
          { name: "Värmland Forest Roads", lat: 59.72, lng: 13.17, radius: 50000 },
          { name: "Bergslagen", lat: 59.83, lng: 15.0, radius: 50000 }
        ]
      }
    }
  },

  UK: {
    country: "UK",
    name: "United Kingdom",
    scopes: {
      "uk-highlands": {
        name: "UK Highlands",
        regions: ["Scotland"],
        areas: [
          { name: "Glencoe", lat: 56.68, lng: -5.1, radius: 50000 },
          { name: "Cairngorms", lat: 57.08, lng: -3.67, radius: 50000 },
          { name: "NC500 West", lat: 57.89, lng: -5.16, radius: 50000 }
        ]
      },

      "uk-lake-district": {
        name: "UK Lake District",
        regions: ["England"],
        areas: [
          { name: "Keswick / Borrowdale", lat: 54.6, lng: -3.14, radius: 50000 },
          { name: "Windermere", lat: 54.38, lng: -2.91, radius: 50000 },
          { name: "Hardknott / Wrynose", lat: 54.4, lng: -3.2, radius: 50000 }
        ]
      },

      "uk-wales": {
        name: "UK Wales",
        regions: ["Wales"],
        areas: [
          { name: "Snowdonia", lat: 53.07, lng: -3.82, radius: 50000 },
          { name: "Brecon Beacons", lat: 51.88, lng: -3.44, radius: 50000 },
          { name: "Pembrokeshire Coast", lat: 51.85, lng: -5.06, radius: 50000 }
        ]
      }
    }
  },

  IE: {
    country: "IE",
    name: "Ireland",
    scopes: {
      "ireland-southwest": {
        name: "Irlanda Sud-Ovest",
        regions: ["Kerry", "Cork"],
        areas: [
          { name: "Ring of Kerry", lat: 51.95, lng: -9.68, radius: 50000 },
          { name: "Beara Peninsula", lat: 51.75, lng: -9.87, radius: 50000 },
          { name: "Killarney National Park", lat: 52.02, lng: -9.51, radius: 50000 }
        ]
      },

      "ireland-west": {
        name: "Irlanda Ovest",
        regions: ["Galway", "Mayo", "Clare"],
        areas: [
          { name: "Connemara", lat: 53.54, lng: -9.95, radius: 50000 },
          { name: "Wild Atlantic Way Clare", lat: 52.95, lng: -9.42, radius: 50000 },
          { name: "Achill Island", lat: 53.96, lng: -10.07, radius: 50000 }
        ]
      }
    }
  },

  BE: {
    country: "BE",
    name: "Belgium",
    scopes: {
      ardennes: {
        name: "Belgio Ardenne",
        regions: ["Wallonia"],
        areas: [
          { name: "Spa / Stavelot", lat: 50.49, lng: 5.86, radius: 50000 },
          { name: "La Roche-en-Ardenne", lat: 50.18, lng: 5.58, radius: 50000 },
          { name: "Bouillon", lat: 49.79, lng: 5.07, radius: 50000 }
        ]
      }
    }
  },

  NL: {
    country: "NL",
    name: "Netherlands",
    scopes: {
      "netherlands-south": {
        name: "Olanda Sud",
        regions: ["Limburg", "Brabant"],
        areas: [
          { name: "South Limburg Hills", lat: 50.82, lng: 5.94, radius: 50000 },
          { name: "Maas Valley", lat: 51.44, lng: 5.48, radius: 50000 },
          { name: "Brabant Woods", lat: 51.57, lng: 5.18, radius: 50000 }
        ]
      }
    }
  },

  LU: {
    country: "LU",
    name: "Luxembourg",
    scopes: {
      luxembourg: {
        name: "Lussemburgo",
        regions: ["Luxembourg"],
        areas: [
          { name: "Mullerthal", lat: 49.79, lng: 6.31, radius: 50000 },
          { name: "Ardennes North", lat: 50.05, lng: 6.03, radius: 50000 },
          { name: "Moselle Valley", lat: 49.6, lng: 6.34, radius: 50000 }
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

export function listSupportedCountries() {
  return Object.keys(COUNTRY_SCOPES);
}