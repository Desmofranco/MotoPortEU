import React from "react";

export default function Faq() {
  return (
    <div style={{ padding: 16, maxWidth: 950, margin: "0 auto" }}>
      <h1 style={{ margin: "6px 0 0", fontSize: 34, letterSpacing: -0.5 }}>
        FAQ ❓
      </h1>

      <p style={{ opacity: 0.75, marginTop: 6 }}>
        Tutto quello che devi sapere su MotoPortEU: itinerari, navigatore e
        strumenti per motociclisti.
      </p>

      <div style={{ marginTop: 14, display: "grid", gap: 12 }}>

        <Card
          q="MotoPortEU è gratuito?"
          a="Sì. MotoPortEU può essere utilizzato gratuitamente. Alcune funzionalità avanzate potrebbero essere introdotte in futuro come servizi Premium."
        />

        <Card
          q="Cosa posso fare con MotoPortEU?"
          a="MotoPortEU ti permette di creare itinerari motociclistici, scoprire circuiti, pianificare percorsi su mappa, usare il navigatore rider e salvare i tuoi viaggi."
        />

        <Card
          q="Come creo un itinerario?"
          a="Apri la sezione Mappa, inserisci i punti del percorso oppure clicca sulla mappa per aggiungere tappe. Quando il percorso è completo puoi salvarlo tra i tuoi itinerari."
        />

        <Card
          q="Come avvio la navigazione?"
          a="Apri un itinerario salvato e premi 'Apri navigazione'. Il navigatore utilizzerà la tua posizione GPS per guidarti lungo il percorso."
        />

        <Card
          q="Posso salvare i miei percorsi?"
          a="Sì. Puoi salvare i tuoi itinerari e riaprirli quando vuoi, modificarli oppure esportarli in formato GPX."
        />

        <Card
          q="Il GPS non parte"
          a="Assicurati di aver autorizzato l'accesso alla posizione sul tuo dispositivo. Il GPS richiede il consenso del browser o del telefono per funzionare correttamente."
        />

        <Card
          q="MotoPortEU funziona su smartphone?"
          a="Sì. MotoPortEU è una Progressive Web App e può essere installata direttamente sul tuo telefono Android o iPhone per essere usata come una vera applicazione."
        />

        <Card
          q="Come installo l'app sul telefono?"
          a="Apri il menu e seleziona 'Installa MotoPortEU'. Il browser ti proporrà l'installazione dell'app sul tuo dispositivo."
        />

        <Card
          q="Come posso contattare il supporto?"
          a={
            <>
              Per domande o segnalazioni puoi scriverci a{" "}
              <a
                href="mailto:motoporteu@gmail.com"
                style={{ fontWeight: 900 }}
              >
                motoporteu@gmail.com
              </a>
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