import React, { useEffect, useState } from "react";

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [installed, setInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const wasDismissed = localStorage.getItem("mp_install_dismissed") === "true";
    if (wasDismissed) {
      setDismissed(true);
    }

    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
      localStorage.removeItem("mp_install_dismissed");
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;

    if (choice?.outcome === "accepted") {
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem("mp_install_dismissed", "true");
  };

  if (installed || dismissed || !deferredPrompt) {
    return null;
  }

  return (
    <div
      style={{
        position: "fixed",
        left: "50%",
        bottom: 18,
        transform: "translateX(-50%)",
        width: "min(420px, calc(100vw - 24px))",
        zIndex: 9999,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
          padding: 14,
          borderRadius: 18,
          background: "rgba(15,18,25,0.94)",
          backdropFilter: "blur(14px)",
          border: "1px solid rgba(255,255,255,0.14)",
          boxShadow: "0 16px 40px rgba(0,0,0,0.35)",
          color: "white",
        }}
      >
        <div>
          <div style={{ fontWeight: 900, fontSize: 15 }}>
            📲 Installa MotoPortEU
          </div>
          <div style={{ fontSize: 13, opacity: 0.82, marginTop: 4, lineHeight: 1.35 }}>
            Aggiungi l’app alla schermata iniziale per usarla più velocemente come una vera app.
          </div>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            onClick={handleInstall}
            style={{
              flex: 1,
              border: "none",
              borderRadius: 12,
              padding: "12px 14px",
              background: "white",
              color: "black",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            Installa
          </button>

          <button
            type="button"
            onClick={handleDismiss}
            style={{
              border: "1px solid rgba(255,255,255,0.22)",
              borderRadius: 12,
              padding: "12px 14px",
              background: "transparent",
              color: "white",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            Dopo
          </button>
        </div>
      </div>
    </div>
  );
}