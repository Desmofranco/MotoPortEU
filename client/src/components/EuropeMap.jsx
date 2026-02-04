import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";

// Bounds Europa
const EUROPE_BOUNDS = [
  [34.5, -11.0],
  [72.5, 40.0],
];
const EUROPE_CENTER = [50.5, 10.0];

// Icona base Leaflet (placeholder)
const baseIcon = (color = "blue") =>
  new L.Icon({
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
    className: `marker-${color}`,
  });

const icons = {
  fuel: baseIcon("blue"),
  bar: baseIcon("green"),
  restaurant: baseIcon("red"),
  accessories: baseIcon("orange"),
  apparel: baseIcon("violet"),
};

const CATEGORY_LABELS = {
  bar: "Bar",
  restaurant: "Ristoranti",
  accessories: "Accessori",
  apparel: "Abbigliamento",
};

export default function EuropeMap() {
  const [fuelPoints, setFuelPoints] = useState([]);
  const [suppliers, setSuppliers] = useState([]);

  const [showFuel, setShowFuel] = useState(true);
  const [showSuppliers, setShowSuppliers] = useState(true);

  // Filtri categoria fornitori
  const [catFilter, setCatFilter] = useState({
    bar: true,
    restaurant: true,
    accessories: true,
    apparel: true,
  });

  useEffect(() => {
    fetch("/data/fuel_points.json")
      .then((r) => r.json())
      .then((d) => setFuelPoints(Array.isArray(d) ? d : []))
      .catch(() => setFuelPoints([]));

    fetch("/data/suppliers.json")
      .then((r) => r.json())
      .then((d) => setSuppliers(Array.isArray(d) ? d : []))
      .catch(() => setSuppliers([]));
  }, []);

  // Conteggi fornitori per categoria
  const supplierCountsByCat = useMemo(() => {
    const counts = { bar: 0, restaurant: 0, accessories: 0, apparel: 0 };
    for (const s of suppliers) {
      if (counts[s.category] !== undefined) counts[s.category] += 1;
    }
    return counts;
  }, [suppliers]);

  // Lista filtrata fornitori
  const filteredSuppliers = useMemo(() => {
    return suppliers.filter((s) => !!catFilter[s.category]);
  }, [suppliers, catFilter]);

  const counts = useMemo(
    () => ({
      fuel: fuelPoints.length,
      suppliersTotal: suppliers.length,
      suppliersVisible: filteredSuppliers.length,
    }),
    [fuelPoints, suppliers, filteredSuppliers]
  );

  const setAllCats = (value) => {
    setCatFilter({
      bar: value,
      restaurant: value,
      accessories: value,
      apparel: value,
    });
  };

  const allCatsOn =
    catFilter.bar &&
    catFilter.restaurant &&
    catFilter.accessories &&
    catFilter.apparel;

  const allCatsOff =
    !catFilter.bar &&
    !catFilter.restaurant &&
    !catFilter.accessories &&
    !catFilter.apparel;

  return (
    <div style={{ height: "calc(100vh - 64px)", width: "100%" }}>
      <MapContainer
        center={EUROPE_CENTER}
        zoom={5}
        minZoom={4}
        maxZoom={18}
        maxBounds={EUROPE_BOUNDS}
        maxBoundsViscosity={1.0}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Pannello layer + filtri */}
        <div
          style={{
            position: "absolute",
            top: 12,
            left: 12,
            zIndex: 1000,
            background: "white",
            padding: 10,
            borderRadius: 10,
            border: "1px solid rgba(0,0,0,0.12)",
            fontSize: 12,
            minWidth: 220,
          }}
        >
          <strong>Layer</strong>

          <div style={{ marginTop: 6 }}>
            <label>
              <input
                type="checkbox"
                checked={showFuel}
                onChange={(e) => setShowFuel(e.target.checked)}
              />{" "}
              ⛽ Benzinai ({counts.fuel})
            </label>
          </div>

          <div style={{ marginTop: 6 }}>
            <label>
              <input
                type="checkbox"
                checked={showSuppliers}
                onChange={(e) => setShowSuppliers(e.target.checked)}
              />{" "}
              ⭐ Fornitori ({counts.suppliersVisible}/{counts.suppliersTotal})
            </label>
          </div>

          {/* Filtri categoria (solo se fornitori attivi) */}
          {showSuppliers && (
            <div
              style={{
                marginTop: 10,
                paddingTop: 10,
                borderTop: "1px solid rgba(0,0,0,0.10)",
              }}
            >
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <strong>Categorie</strong>
                <button
                  type="button"
                  onClick={() => setAllCats(true)}
                  disabled={allCatsOn}
                  style={{
                    marginLeft: "auto",
                    fontSize: 11,
                    padding: "4px 8px",
                    borderRadius: 8,
                    border: "1px solid rgba(0,0,0,0.15)",
                    background: allCatsOn ? "rgba(0,0,0,0.06)" : "white",
                    cursor: allCatsOn ? "not-allowed" : "pointer",
                  }}
                >
                  Tutte
                </button>
                <button
                  type="button"
                  onClick={() => setAllCats(false)}
                  disabled={allCatsOff}
                  style={{
                    fontSize: 11,
                    padding: "4px 8px",
                    borderRadius: 8,
                    border: "1px solid rgba(0,0,0,0.15)",
                    background: allCatsOff ? "rgba(0,0,0,0.06)" : "white",
                    cursor: allCatsOff ? "not-allowed" : "pointer",
                  }}
                >
                  Nessuna
                </button>
              </div>

              <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
                {Object.keys(CATEGORY_LABELS).map((key) => (
                  <label key={key} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input
                      type="checkbox"
                      checked={catFilter[key]}
                      onChange={(e) =>
                        setCatFilter((prev) => ({ ...prev, [key]: e.target.checked }))
                      }
                    />
                    <span>
                      {CATEGORY_LABELS[key]}{" "}
                      <span style={{ opacity: 0.7 }}>
                        ({supplierCountsByCat[key] || 0})
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Benzinai */}
        {showFuel &&
          fuelPoints.map((p) => (
            <Marker
              key={p.id || `${p.lat},${p.lng}`}
              position={[p.lat, p.lng]}
              icon={icons.fuel}
            >
              <Popup>
                <strong>⛽ {p.name}</strong>
                {p.brand && <div>Brand: {p.brand}</div>}
              </Popup>
            </Marker>
          ))}

        {/* Fornitori filtrati */}
        {showSuppliers &&
          filteredSuppliers.map((s) => (
            <Marker
              key={s.id}
              position={[s.lat, s.lng]}
              icon={icons[s.category] || icons.bar}
            >
<Popup>
  <div style={{ minWidth: 220 }}>
    <div style={{ fontWeight: 700 }}>⭐ {s.name}</div>
    <div style={{ fontSize: 12, opacity: 0.8 }}>
      {s.city} · {CATEGORY_LABELS[s.category] || s.category}
    </div>
    {s.description && <p style={{ marginTop: 6 }}>{s.description}</p>}

    <a
      href={`/supplier/${s.id}`}
      style={{
        display: "inline-block",
        marginTop: 8,
        padding: "6px 10px",
        borderRadius: 10,
        border: "1px solid rgba(0,0,0,0.15)",
        textDecoration: "none",
        color: "inherit",
        background: "white",
        fontSize: 12,
      }}
    >
      Apri scheda →
    </a>
  </div>
</Popup>
            </Marker>
          ))}
      </MapContainer>
    </div>
  );
}
