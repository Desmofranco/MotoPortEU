import React from "react";

export default function Terms() {
  return (
    <div style={{ padding: 16, maxWidth: 950, margin: "0 auto" }}>
      <h1 style={{ margin: "6px 0 0", fontSize: 34, letterSpacing: -0.5 }}>Condizioni d’uso 📜</h1>
      <p style={{ opacity: 0.75, marginTop: 6 }}>
        Versione base – testo informativo. Potremo raffinarlo prima del go-live.
      </p>

      <div
        style={{
          marginTop: 14,
          borderRadius: 18,
          border: "1px solid rgba(0,0,0,0.12)",
          background: "white",
          padding: 14,
          lineHeight: 1.5,
          opacity: 0.92,
        }}
      >
        <p>
          MotoPortEU fornisce strumenti informativi (mappe, itinerari, circuiti, meteo). L’uso è a tuo rischio:
          guida sempre con prudenza e rispetta il codice della strada.
        </p>
        <p>
          I dati possono essere incompleti o non aggiornati. Non garantiamo l’accuratezza assoluta di percorsi,
          condizioni meteo o informazioni su strade/piste.
        </p>
        <p>
          L’utente è responsabile dei contenuti che salva (itinerari, note). Per segnalazioni o richieste:
          <a href="mailto:motoporteu@gmail.com" style={{ fontWeight: 900 }}> motoporteu@gmail.com</a>.
        </p>
        <p style={{ opacity: 0.75 }}>Ultimo aggiornamento: {new Date().toLocaleDateString()}.</p>
      </div>
    </div>
  );
}