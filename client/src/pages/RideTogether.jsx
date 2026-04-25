import React, { useEffect, useMemo, useState } from "react";

const API_BASE =
  import.meta.env.VITE_API_URL || "https://motoporteu.onrender.com";

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

const EMPTY_FORM = {
  type: "ride-buddy",
  name: "",
  region: "Lombardia",
  city: "Lecco",
  bike: "",
  style: "",
  availability: "",
  contact: "",
  text: "",
};

function getToken() {
  return localStorage.getItem("token") || "";
}

function getUserIdFromToken() {
  try {
    const token = getToken();
    if (!token || !token.includes(".")) return "";

    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload?.id || payload?._id || payload?.userId || "";
  } catch {
    return "";
  }
}

function getOwnerId(profile) {
  if (!profile) return "";

  const raw =
    profile.userId ||
    profile.user ||
    profile.owner ||
    profile.createdBy ||
    profile.authorId ||
    "";

  if (typeof raw === "object") {
    return raw._id || raw.id || "";
  }

  return raw || "";
}

function isOwner(profile, currentUserId) {
  const ownerId = getOwnerId(profile);
  return Boolean(
    ownerId && currentUserId && String(ownerId) === String(currentUserId)
  );
}

function normalizeImageUrl(url) {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  return `${API_BASE}${url}`;
}

function openContact(contact) {
  if (!contact) {
    alert("Questo annuncio non ha ancora un contatto pubblico.");
    return;
  }

  const value = contact.trim();

  if (value.includes("@") && !value.startsWith("@")) {
    window.location.href = `mailto:${value}`;
    return;
  }

  const onlyNumbers = value.replace(/[^\d+]/g, "");
  if (onlyNumbers.length >= 8) {
    window.open(`https://wa.me/${onlyNumbers.replace("+", "")}`, "_blank");
    return;
  }

  if (value.startsWith("@")) {
    window.open(`https://instagram.com/${value.replace("@", "")}`, "_blank");
    return;
  }

  if (value.includes("instagram.com") || value.startsWith("http")) {
    window.open(value.startsWith("http") ? value : `https://${value}`, "_blank");
    return;
  }

  alert(`Contatto indicato:\n\n${value}`);
}

export default function RideTogether() {
  const [category, setCategory] = useState("all");
  const [region, setRegion] = useState("Tutte");
  const [city, setCity] = useState("Tutte");
  const [query, setQuery] = useState("");

  const [profiles, setProfiles] = useState([]);
  const [currentUserId, setCurrentUserId] = useState("");
  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [error, setError] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editingPostId, setEditingPostId] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [imageFile, setImageFile] = useState(null);

  const isEditing = Boolean(editingPostId);

  const availableCities =
    region !== "Tutte" ? CITIES[region] || ["Tutte"] : ["Tutte"];

  const loadCommunity = async () => {
    try {
      setLoading(true);
      setError("");

      const token = getToken();

      const res = await fetch(`${API_BASE}/api/community`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      const data = await res.json();

      if (data?.ok && Array.isArray(data.posts)) {
        setProfiles(data.posts);

        const backendUserId = data.currentUserId || "";
        const tokenUserId = getUserIdFromToken();

        setCurrentUserId(backendUserId || tokenUserId || "");
      } else {
        setProfiles([]);
        setCurrentUserId(getUserIdFromToken());
      }
    } catch (err) {
      console.error("Community load error:", err);
      setProfiles([]);
      setCurrentUserId(getUserIdFromToken());
      setError("Errore collegamento server.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCommunity();
  }, []);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();

    return profiles.filter((p) => {
      if (category !== "all" && p.type !== category) return false;
      if (region !== "Tutte" && p.region !== region) return false;
      if (city !== "Tutte" && p.city !== city) return false;

      if (!q) return true;

      return [
        p.name,
        p.region,
        p.city,
        p.bike,
        p.style,
        p.availability,
        p.contact,
        p.text,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [profiles, category, region, city, query]);

  const openCreateForm = () => {
    if (!getToken()) {
      alert("Devi effettuare il login per creare un annuncio.");
      return;
    }

    setEditingPostId("");
    setForm(EMPTY_FORM);
    setImageFile(null);
    setShowForm(true);
  };

  const openEditForm = (post) => {
    if (!isOwner(post, currentUserId)) {
      alert("Puoi modificare solo i tuoi annunci.");
      return;
    }

    setEditingPostId(post._id);
    setForm({
      type: post.type || "ride-buddy",
      name: post.name || "",
      region: post.region || "Lombardia",
      city: post.city || "Lecco",
      bike: post.bike || "",
      style: post.style || "",
      availability: post.availability || "",
      contact: post.contact || "",
      text: post.text || "",
    });
    setImageFile(null);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingPostId("");
    setForm(EMPTY_FORM);
    setImageFile(null);
  };

  const submitPost = async () => {
    try {
      if (!form.name || !form.region || !form.city || !form.text) {
        alert("Compila nome, regione, città e descrizione.");
        return;
      }

      const token = getToken();
      if (!token) {
        alert("Login richiesto.");
        return;
      }

      setPublishing(true);

      const body = new FormData();
      Object.entries(form).forEach(([key, value]) => {
        body.append(key, value || "");
      });

      if (imageFile) {
        body.append("image", imageFile);
      }

      const url = isEditing
        ? `${API_BASE}/api/community/${editingPostId}`
        : `${API_BASE}/api/community`;

      const method = isEditing ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body,
      });

      const data = await res.json();

      if (!data?.ok) {
        alert(data?.message || "Errore salvataggio annuncio");
        return;
      }

      if (isEditing) {
        setProfiles((prev) =>
          prev.map((p) => (p._id === editingPostId ? data.post : p))
        );
      } else {
        setProfiles((prev) => [data.post, ...prev]);
      }

      const backendUserId = data.currentUserId || "";
      if (backendUserId) setCurrentUserId(backendUserId);

      closeForm();
      loadCommunity();
    } catch (err) {
      console.error("Community submit error:", err);
      alert("Errore collegamento server.");
    } finally {
      setPublishing(false);
    }
  };

  const deletePost = async (post) => {
    if (!post?._id) return;

    if (!isOwner(post, currentUserId)) {
      alert("Puoi eliminare solo i tuoi annunci.");
      return;
    }

    const ok = window.confirm(
      `Vuoi eliminare l'annuncio "${post.name}" dalla Community?`
    );

    if (!ok) return;

    try {
      const token = getToken();
      if (!token) {
        alert("Login richiesto.");
        return;
      }

      setDeletingId(post._id);

      const res = await fetch(`${API_BASE}/api/community/${post._id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();

      if (!data?.ok) {
        alert(data?.message || "Errore eliminazione annuncio");
        return;
      }

      setProfiles((prev) => prev.filter((p) => p._id !== post._id));
    } catch (err) {
      console.error("Community delete error:", err);
      alert("Errore collegamento server.");
    } finally {
      setDeletingId("");
    }
  };

  return (
    <div style={styles.page}>
      <section style={styles.hero}>
        <div style={styles.heroOverlay} />
        <div style={styles.heroContent}>
          <div style={styles.kicker}>MotoPortEU Community</div>
          <h1 style={styles.title}>Ride Together</h1>

          <p style={styles.subtitle}>
            Trova biker nella tua zona, organizza giri veri e incontra compagni
            di strada divisi per regione e città.
          </p>

          <div style={styles.heroActions}>
            <button style={styles.primaryBtn} onClick={openCreateForm}>
              + Crea annuncio
            </button>

            <button
              style={styles.secondaryBtn}
              onClick={() => {
                setRegion("Tutte");
                setCity("Tutte");
                setCategory("all");
                setQuery("");
              }}
            >
              Scopri biker vicini
            </button>
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

        <select
          value={city}
          onChange={(e) => setCity(e.target.value)}
          style={styles.select}
        >
          {availableCities.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </section>

      {error ? <div style={styles.notice}>{error}</div> : null}
      {loading ? <div style={styles.notice}>Carico annunci Community…</div> : null}

      {showForm ? (
        <section style={styles.formBox}>
          <div style={styles.formHeader}>
            <h2 style={{ margin: 0 }}>
              {isEditing ? "Modifica annuncio" : "Crea annuncio Community"}
            </h2>

            <button style={styles.closeBtn} onClick={closeForm}>
              ✕
            </button>
          </div>

          <div style={styles.formGrid}>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              style={styles.select}
            >
              <option value="ride-buddy">Compagni di giro</option>
              <option value="biker-passenger">Biker cerca zavorrina</option>
              <option value="passenger-biker">Zavorrina cerca biker</option>
              <option value="event">Uscita organizzata</option>
            </select>

            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Nome / nickname"
              style={styles.input}
            />

            <input
              value={form.region}
              onChange={(e) => setForm({ ...form, region: e.target.value })}
              placeholder="Regione"
              style={styles.input}
            />

            <input
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              placeholder="Città"
              style={styles.input}
            />

            <input
              value={form.bike}
              onChange={(e) => setForm({ ...form, bike: e.target.value })}
              placeholder="Moto / ruolo"
              style={styles.input}
            />

            <input
              value={form.style}
              onChange={(e) => setForm({ ...form, style: e.target.value })}
              placeholder="Stile guida"
              style={styles.input}
            />

            <input
              value={form.availability}
              onChange={(e) =>
                setForm({ ...form, availability: e.target.value })
              }
              placeholder="Disponibilità"
              style={styles.input}
            />

            <input
              value={form.contact}
              onChange={(e) => setForm({ ...form, contact: e.target.value })}
              placeholder="Email, telefono, WhatsApp o Instagram"
              style={styles.input}
            />

            <label style={styles.fileBox}>
              <span>{imageFile ? imageFile.name : "Carica foto dal telefono"}</span>
              <input
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={(e) => setImageFile(e.target.files?.[0] || null)}
              />
            </label>
          </div>

          <textarea
            value={form.text}
            onChange={(e) => setForm({ ...form, text: e.target.value })}
            placeholder="Scrivi il tuo annuncio..."
            style={styles.textarea}
            rows={4}
            maxLength={800}
          />

          <div style={styles.formFooter}>
            <button
              style={{
                ...styles.primaryBtn,
                opacity: publishing ? 0.65 : 1,
                cursor: publishing ? "not-allowed" : "pointer",
              }}
              onClick={submitPost}
              disabled={publishing}
            >
              {publishing
                ? "Salvataggio…"
                : isEditing
                ? "Salva modifiche"
                : "Pubblica annuncio"}
            </button>

            {isEditing ? (
              <button style={styles.secondaryBtn} onClick={closeForm}>
                Annulla modifica
              </button>
            ) : null}
          </div>
        </section>
      ) : null}

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
        {filtered.map((profile) => {
          const owner = isOwner(profile, currentUserId);

          return (
            <article key={profile._id} style={styles.card}>
              {profile.imageUrl ? (
                <div
                  style={{
                    ...styles.cardImage,
                    backgroundImage: `url('${normalizeImageUrl(
                      profile.imageUrl
                    )}')`,
                  }}
                />
              ) : null}

              <div style={styles.cardTop}>
                <div style={styles.avatar}>
                  {String(profile.name || "?").slice(0, 1).toUpperCase()}
                </div>

                <div>
                  <h3 style={styles.cardTitle}>{profile.name}</h3>
                  <div style={styles.location}>
                    📍 {profile.city}, {profile.region}
                  </div>
                </div>

                <span style={styles.badge}>{profile.badge || "Community"}</span>
              </div>

              <div style={styles.infoGrid}>
                <div>
                  <small>Moto</small>
                  <strong>{profile.bike || "—"}</strong>
                </div>
                <div>
                  <small>Stile</small>
                  <strong>{profile.style || "—"}</strong>
                </div>
                <div>
                  <small>Disponibilità</small>
                  <strong>{profile.availability || "—"}</strong>
                </div>
              </div>

              <p style={styles.text}>{profile.text}</p>

              {profile.contact ? (
                <div style={styles.contactBox}>
                  <small>Contatto</small>
                  <strong>{profile.contact}</strong>
                </div>
              ) : null}

              <div style={styles.cardActions}>
                <button
                  style={styles.contactBtn}
                  onClick={() => openContact(profile.contact)}
                >
                  Contatta
                </button>

                {owner ? (
                  <>
                    <button
                      style={styles.saveBtn}
                      onClick={() => openEditForm(profile)}
                    >
                      Modifica
                    </button>

                    <button
                      style={{
                        ...styles.deleteBtn,
                        opacity: deletingId === profile._id ? 0.6 : 1,
                        cursor:
                          deletingId === profile._id
                            ? "not-allowed"
                            : "pointer",
                      }}
                      onClick={() => deletePost(profile)}
                      disabled={deletingId === profile._id}
                    >
                      {deletingId === profile._id ? "..." : "Elimina"}
                    </button>
                  </>
                ) : null}
              </div>
            </article>
          );
        })}
      </section>

      {!loading && !filtered.length && (
        <div style={styles.empty}>
          Nessun annuncio trovato. Crea il primo annuncio oppure cambia regione,
          città o categoria.
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

  fileBox: {
    padding: "13px 14px",
    borderRadius: 16,
    border: "1px dashed rgba(255,106,0,0.45)",
    background: "rgba(255,106,0,0.08)",
    color: "#ffd3b0",
    outline: "none",
    cursor: "pointer",
    fontWeight: 850,
  },

  select: {
    padding: "13px 14px",
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "#1b1b1b",
    color: "white",
    outline: "none",
  },

  notice: {
    marginTop: 12,
    padding: "12px 14px",
    borderRadius: 16,
    background: "rgba(255,106,0,0.12)",
    border: "1px solid rgba(255,106,0,0.28)",
    color: "#ffd3b0",
    fontSize: 14,
  },

  formBox: {
    marginTop: 14,
    padding: 16,
    borderRadius: 24,
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.14)",
  },

  formHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },

  closeBtn: {
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.08)",
    color: "white",
    borderRadius: 12,
    padding: "8px 10px",
    cursor: "pointer",
    fontWeight: 900,
  },

  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 10,
  },

  textarea: {
    marginTop: 10,
    width: "100%",
    padding: "13px 14px",
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.08)",
    color: "white",
    outline: "none",
    resize: "vertical",
    boxSizing: "border-box",
  },

  formFooter: {
    marginTop: 12,
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
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
    overflow: "hidden",
  },

  cardImage: {
    height: 170,
    margin: "-16px -16px 14px",
    backgroundSize: "cover",
    backgroundPosition: "center",
    borderBottom: "1px solid rgba(255,255,255,0.12)",
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
    flex: "0 0 auto",
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

  contactBox: {
    marginTop: 12,
    padding: "10px 12px",
    borderRadius: 14,
    background: "rgba(255,106,0,0.10)",
    border: "1px solid rgba(255,106,0,0.22)",
    display: "grid",
    gap: 4,
  },

  cardActions: {
    marginTop: 14,
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
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

  deleteBtn: {
    padding: "11px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255,80,80,0.35)",
    background: "rgba(255,80,80,0.12)",
    color: "#ffb0b0",
    fontWeight: 900,
    cursor: "pointer",
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