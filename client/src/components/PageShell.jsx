export default function PageShell({ title, subtitle, right, children }) {
  return (
    <div style={{ padding: "16px", paddingBottom: "88px", maxWidth: 1100, margin: "0 auto" }}>
      {(title || subtitle || right) && (
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
          <div>
            {title && <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900 }}>{title}</h1>}
            {subtitle && <p style={{ margin: "6px 0 0", opacity: 0.8 }}>{subtitle}</p>}
          </div>
          {right && <div>{right}</div>}
        </div>
      )}
      {children}
    </div>
  );
}