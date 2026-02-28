import React from "react";

export default function Faq() {
  return (
    <div style={{ padding: 16, maxWidth: 950, margin: "0 auto" }}>
      <h1 style={{ margin: "6px 0 0", fontSize: 34, letterSpacing: -0.5 }}>FAQ ❓</h1>
      <p style={{ opacity: 0.75, marginTop: 6 }}>
        Risposte rapide su MotoPortEU: itinerari, circuiti, mappa e garage.
      </p>

      <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
        <Card q="MotoPortEU è gratis?" a="Sì. Alcune funzioni avanzate potranno diventare Premium in futuro." />
        <Card
          q="Come creo un itinerario?"
          a="Vai su Mappa, aggiungi punti con la ricerca (Invio) o incolla coordinate, poi salva l’itinerario."
        />
        <Card
          q="Come avvio la navigazione?"
          a="Apri un itinerario e usa “Avvia verso START” per partire dalla tua posizione attuale."
        />
        <Card
          q="Il meteo non si vede."
          a="Verifica la chiave OpenWeather (VITE_OWM_KEY) e la connessione."
        />
        <Card
          q="Contatti / supporto"
          a={
            <>
              Scrivici a{" "}
              <a href="mailto:motoporteu@gmail.com" style={{ fontWeight: 900 }}>
                motoporteu@gmail.com
              </a>
              .
            </>
          }
        />
      </div>
    </div>
  );
}

function Card({ q, a }) {
  return (
    <div
      style={{
        borderRadius: 18,
        border: "1px solid rgba(0,0,0,0.12)",
        background: "white",
        padding: 14,
      }}
    >
      <div style={{ fontWeight: 950, marginBottom: 6 }}>{q}</div>
      <div style={{ opacity: 0.9, lineHeight: 1.4 }}>{a}</div>
    </div>
  );
}