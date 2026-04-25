import React, { useMemo, useState } from "react";

const REGIONS = [
  "Tutte",
  "Lombardia",
  "Piemonte",
  "Liguria",
  "Veneto",
  "Emilia-Romagna",
  "Toscana",
  "Lazio",
  "Campania",
  "Puglia",
  "Sicilia",
  "Sardegna",
];

const CITIES = {
  Lombardia: ["Tutte", "Milano", "Lecco", "Como", "Bergamo", "Brescia"],
  Piemonte: ["Tutte", "Torino", "Cuneo", "Novara"],
  Liguria: ["Tutte", "Genova", "Savona", "La Spezia"],
  Veneto: ["Tutte", "Verona", "Vicenza", "Treviso", "Belluno"],
  Toscana: ["Tutte", "Firenze", "Lucca", "Siena", "Pisa"],
};

const CATEGORIES = [
  { key: "all", label: "Tutti", icon: "🌍" },
  { key: "ride-buddy", label: "Compagni di giro", icon: "🏍️" },
  { key: "biker-passenger", label: "Biker cerca zavorrina", icon: "🔥" },
  { key: "passenger-biker", label: "Zavorrina cerca biker", icon: "💫" },
  { key: "event", label: "Uscite organizzate", icon: "📅" },
];

const SAMPLE_PROFILES = [
  {
    id: 1,
    type: "ride-buddy",
    name: "MarcoRider87",
    region: "Lombardia",
    city: "Lecco",
    bike: "BMW GS 1250",
    style: "Touring / Passi Alpini",
    availability: "Weekend",
    text: "Cerco compagni per giri veri tra lago, Valtellina e passi alpini. Ritmo allegro ma testa accesa.",
    badge: "Rider verificato",
  },
  {
    id: 2,
    type: "biker-passenger",
    name: "DucaMonster",
    region: "Lombardia",
    city: "Milano",
    bike: "Ducati Monster",
    style: "Sportivo soft",
    availability: "Sabato pomeriggio",
    text: "Biker cerca zavorrina per giri tranquilli, aperitivo rider e qualche curva fatta bene.",
    badge: "Nuovo",
  },
  {
    id: 3,
    type: "passenger-biker",
    name: "ZavorrinaSmile",
    region: "Piemonte",
    city: "Torino",
    bike: "Zavorrina",
    style: "Panoramico / Relax",
    availability: "Domenica",
    text: "Cerco biker affidabile per uscite panoramiche, lago, montagna e zero guida da fenomeni.",
    badge: "Community",
  },
  {
    id: 4,
    type: "event",
    name: "Giro Lago di Como",
    region: "Lombardia",
    city: "Como",
    bike: "Evento aperto",
    style: "Touring panoramico",
    availability: "Domenica ore 9:30",
    text: "Ritrovo a Como, giro lago, pausa caffè e rientro soft. Ideale per conoscere altri rider.",
    badge: "Uscita",
  },
];

export default function RideTogether() {
  const [category, setCategory] = useState("all");
  const [region, setRegion] = useState("Tutte");
  const [city, setCity] = useState("Tutte");
  const [query, setQuery] = useState("");

  const availableCities = region !== "Tutte" ? CITIES[region] || ["Tutte"] : ["Tutte"];

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();

    return SAMPLE_PROFILES.filter((p) => {
      if (category !== "all" && p.type !== category) return false;
      if (region !== "Tutte" && p.region !== region) return false;
      if (city !== "Tutte" && p.city !== city) return false;

      if (!q) return true;

      return [p.name, p.region, p.city, p.bike, p.style, p.text]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [category, region, city, query]);

  return (
    <div style={styles.page}>
      <section style={styles.hero}>
        <div style={styles.heroOverlay} />
        <div style={styles.heroContent}>
          <div style={styles.kicker}>MotoPortEU Community</div>
          <h1 style={styles.title}>Ride Together</h1>
          <p style={styles.subtitle}>
            Trova biker nella tua zona, organizza giri veri e incontra compagni di strada
            divisi per regione e città.
          </p>
<div style={styles.earlyAccess}>
  🚧 <strong>Community in Early Access</strong><br />
  Stiamo completando le funzionalità social.<br />
  Presto potrai creare il tuo profilo e contattare altri rider.
</div>
          <div style={styles.heroActions}>
            <button style={styles.primaryBtn}>+ Crea annuncio</button>
            <button style={styles.secondaryBtn}>Scopri biker vicini</button>
          </div>
        </div>
      </section>

      <section style={styles.filters}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cerca: Lecco, Stelvio, Ducati, zavorrina..."
          style={styles.input}
        />

        <select
          value={region}
          onChange={(e) => {
            setRegion(e.target.value);
            setCity("Tutte");
          }}
          style={styles.select}
        >
          {REGIONS.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>

        <select value={city} onChange={(e) => setCity(e.target.value)} style={styles.select}>
          {availableCities.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </section>

      <section style={styles.tabs}>
        {CATEGORIES.map((c) => (
          <button
            key={c.key}
            onClick={() => setCategory(c.key)}
            style={{
              ...styles.tab,
              ...(category === c.key ? styles.tabActive : {}),
            }}
          >
            <span>{c.icon}</span>
            {c.label}
          </button>
        ))}
      </section>

      <section style={styles.grid}>
        {filtered.map((profile) => (
          <article key={profile.id} style={styles.card}>
            <div style={styles.cardTop}>
              <div style={styles.avatar}>{profile.name.slice(0, 1)}</div>
              <div>
                <h3 style={styles.cardTitle}>{profile.name}</h3>
                <div style={styles.location}>
                  📍 {profile.city}, {profile.region}
                </div>
              </div>
              <span style={styles.badge}>{profile.badge}</span>
            </div>

            <div style={styles.infoGrid}>
              <div>
                <small>Moto</small>
                <strong>{profile.bike}</strong>
              </div>
              <div>
                <small>Stile</small>
                <strong>{profile.style}</strong>
              </div>
              <div>
                <small>Disponibilità</small>
                <strong>{profile.availability}</strong>
              </div>
            </div>

            <p style={styles.text}>{profile.text}</p>

            <div style={styles.cardActions}>
              <button style={styles.contactBtn}>Contatta</button>
              <button style={styles.saveBtn}>Salva</button>
            </div>
          </article>
        ))}
      </section>

      {!filtered.length && (
        <div style={styles.empty}>
          Nessun biker trovato. Prova a cambiare regione, città o categoria.
        </div>
      )}
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    padding: "14px",
    background:
      "radial-gradient(circle at top, rgba(255,106,0,0.18), transparent 34%), #101010",
    color: "white",
  },

  hero: {
    position: "relative",
    minHeight: 300,
    borderRadius: 28,
    overflow: "hidden",
    backgroundImage:
      "url('https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=1600&q=80')",
    backgroundSize: "cover",
    backgroundPosition: "center",
    boxShadow: "0 18px 45px rgba(0,0,0,0.35)",
  },

  heroOverlay: {
    position: "absolute",
    inset: 0,
    background:
      "linear-gradient(90deg, rgba(0,0,0,0.88), rgba(0,0,0,0.45), rgba(0,0,0,0.18))",
  },

  heroContent: {
    position: "relative",
    zIndex: 1,
    padding: 26,
    maxWidth: 680,
  },

  kicker: {
    display: "inline-flex",
    padding: "7px 12px",
    borderRadius: 999,
    background: "rgba(255,106,0,0.18)",
    border: "1px solid rgba(255,106,0,0.35)",
    color: "#ffb06b",
    fontWeight: 900,
    fontSize: 13,
  },

  title: {
    margin: "18px 0 8px",
    fontSize: "clamp(38px, 7vw, 70px)",
    lineHeight: 0.95,
    letterSpacing: -2,
  },

  subtitle: {
    maxWidth: 560,
    margin: 0,
    fontSize: 17,
    lineHeight: 1.45,
    color: "rgba(255,255,255,0.82)",
  },

  heroActions: {
    marginTop: 22,
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
  },

  primaryBtn: {
    padding: "12px 16px",
    borderRadius: 16,
    border: "1px solid rgba(255,106,0,0.45)",
    background: "#ff6a00",
    color: "white",
    fontWeight: 950,
    cursor: "pointer",
  },

  secondaryBtn: {
    padding: "12px 16px",
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.08)",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
  },

  filters: {
    marginTop: 14,
    display: "grid",
    gridTemplateColumns: "2fr 1fr 1fr",
    gap: 10,
  },

  input: {
    padding: "13px 14px",
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.08)",
    color: "white",
    outline: "none",
  },

  select: {
    padding: "13px 14px",
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "#1b1b1b",
    color: "white",
    outline: "none",
  },

  tabs: {
    marginTop: 14,
    display: "flex",
    gap: 10,
    overflowX: "auto",
    paddingBottom: 4,
  },

  tab: {
    flex: "0 0 auto",
    padding: "10px 13px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.07)",
    color: "white",
    fontWeight: 850,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 7,
  },

  tabActive: {
    background: "rgba(255,106,0,0.22)",
    border: "1px solid rgba(255,106,0,0.50)",
    color: "#ffb06b",
  },

  grid: {
    marginTop: 16,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: 14,
  },

  card: {
    borderRadius: 24,
    padding: 16,
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0.055))",
    border: "1px solid rgba(255,255,255,0.12)",
    boxShadow: "0 16px 36px rgba(0,0,0,0.28)",
  },

  cardTop: {
    display: "flex",
    gap: 12,
    alignItems: "center",
    position: "relative",
  },

  avatar: {
    width: 52,
    height: 52,
    borderRadius: 18,
    background: "linear-gradient(135deg, #ff6a00, #3a1b05)",
    display: "grid",
    placeItems: "center",
    fontWeight: 950,
    fontSize: 24,
  },

  cardTitle: {
    margin: 0,
    fontSize: 19,
  },

  location: {
    marginTop: 4,
    fontSize: 13,
    color: "rgba(255,255,255,0.68)",
  },

  badge: {
    marginLeft: "auto",
    padding: "6px 9px",
    borderRadius: 999,
    background: "rgba(255,106,0,0.16)",
    color: "#ffb06b",
    fontSize: 11,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },

  infoGrid: {
    marginTop: 14,
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: 8,
  },

  text: {
    marginTop: 14,
    color: "rgba(255,255,255,0.82)",
    lineHeight: 1.45,
    fontSize: 14,
  },

  cardActions: {
    marginTop: 14,
    display: "flex",
    gap: 10,
  },

  contactBtn: {
    flex: 1,
    padding: "11px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255,106,0,0.45)",
    background: "#ff6a00",
    color: "white",
    fontWeight: 950,
    cursor: "pointer",
  },

  saveBtn: {
    padding: "11px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.08)",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
  },
earlyAccess: {
  marginTop: 16,
  padding: "12px 14px",
  borderRadius: 16,
  background: "rgba(255,106,0,0.12)",
  border: "1px solid rgba(255,106,0,0.28)",
  color: "#ffd3b0",
  fontSize: 14,
  lineHeight: 1.45,
  maxWidth: 520,
},
  empty: {
    marginTop: 18,
    padding: 18,
    borderRadius: 20,
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.12)",
    color: "rgba(255,255,255,0.78)",
    textAlign: "center",
  },
};