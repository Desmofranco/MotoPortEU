export default function RiderModePanel({ route, score }) {
  if (!route) return null;

  const riderScore =
    typeof score === "number"
      ? score
      : typeof score === "string"
        ? score
        : score?.riderScore ?? null;

  const riderProfile =
    typeof score === "object" && score?.profile
      ? score.profile
      : null;

  const riderHighlights =
    Array.isArray(score?.highlights) ? score.highlights : [];

  return (
    <div
      style={{
        padding: 12,
        borderRadius: 14,
        background: "rgba(255,255,255,0.8)",
        border: "1px solid rgba(0,0,0,0.08)",
      }}
    >
      <div style={{ fontWeight: 900 }}>Rider Mode</div>

      <div style={{ marginTop: 6 }}>
        📏 {Number(route?.distanceKm || 0).toFixed(1)} km
      </div>

      <div>
        ⏱ {Math.round(Number(route?.durationMin || 0))} min
      </div>

      {riderScore !== null && (
        <div style={{ marginTop: 6 }}>
          Rider Score: <b>{riderScore}</b>
        </div>
      )}

      {riderProfile && (
        <div style={{ marginTop: 6 }}>
          Profilo: <b style={{ textTransform: "capitalize" }}>{riderProfile}</b>
        </div>
      )}

      {riderHighlights.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontWeight: 800, fontSize: 13 }}>Highlights</div>
          <div
            style={{
              marginTop: 6,
              display: "flex",
              gap: 6,
              flexWrap: "wrap",
            }}
          >
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
    </div>
  );
}