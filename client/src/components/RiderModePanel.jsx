export default function RiderModePanel({ route, score, weather, loading }) {
  if (!route && !loading) return null;

  const riderScore =
    typeof score === "number"
      ? score
      : typeof score === "string"
        ? score
        : score?.riderScore ?? null;

  const riderProfile =
    typeof score === "object" && score?.profile ? score.profile : null;

  const riderHighlights = Array.isArray(score?.highlights) ? score.highlights : [];
  const riderWarnings = Array.isArray(score?.warnings) ? score.warnings : [];
  const riderSummary = score?.summary || "";

  if (loading) {
    return (
      <div
        style={{
          padding: 12,
          borderRadius: 14,
          background: "rgba(255,255,255,0.8)",
          border: "1px solid rgba(0,0,0,0.08)",
        }}
      >
        <div style={{ fontWeight: 900 }}>Rider Engine</div>
        <div style={{ marginTop: 8, opacity: 0.8 }}>Analisi rotta in corso...</div>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: 12,
        borderRadius: 14,
        background: "rgba(255,255,255,0.8)",
        border: "1px solid rgba(0,0,0,0.08)",
      }}
    >
      <div style={{ fontWeight: 900 }}>Rider Engine</div>

      <div style={{ marginTop: 8 }}>
        📏 {Number(route?.distanceKm || 0).toFixed(1)} km
      </div>

      <div>
        ⏱ {Math.round(Number(route?.durationMin || 0))} min
      </div>

      {riderScore !== null && (
        <div style={{ marginTop: 8 }}>
          Rider Score: <b>{riderScore}/100</b>
        </div>
      )}

      {riderProfile && (
        <div style={{ marginTop: 6 }}>
          Profilo: <b>{riderProfile}</b>
        </div>
      )}

      {riderSummary && (
        <div style={{ marginTop: 8, fontWeight: 700 }}>
          {riderSummary}
        </div>
      )}

      {riderHighlights.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontWeight: 800, fontSize: 13 }}>Highlights</div>
          <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap" }}>
            {riderHighlights.map((item, idx) => (
              <span
                key={`${item}-${idx}`}
                style={{
                  padding: "6px 10px",
                  borderRadius: 999,
                  border: "1px solid rgba(0,0,0,0.10)",
                  background: "rgba(255,255,255,0.65)",
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      )}

      {riderWarnings.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontWeight: 800, fontSize: 13 }}>Warning</div>
          <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 6 }}>
            {riderWarnings.map((item, idx) => (
              <div
                key={`${item}-${idx}`}
                style={{
                  padding: "6px 10px",
                  borderRadius: 10,
                  border: "1px solid rgba(202,138,4,0.20)",
                  background: "rgba(202,138,4,0.08)",
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                ⚠️ {item}
              </div>
            ))}
          </div>
        </div>
      )}

      {weather?.summary ? (
        <div style={{ marginTop: 10, fontSize: 12, opacity: 0.8 }}>
          Meteo: {weather.summary}
        </div>
      ) : null}
    </div>
  );
}