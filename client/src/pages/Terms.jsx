import React from "react";

export default function Terms() {
  return (
    <div style={{ padding: 16, maxWidth: 950, margin: "0 auto" }}>
      <h1 style={{ margin: "6px 0 0", fontSize: 34, letterSpacing: -0.5 }}>
        Condizioni d’uso 📜
      </h1>

      <p style={{ opacity: 0.75, marginTop: 6 }}>
        Utilizzando MotoPortEU accetti le seguenti condizioni di utilizzo della piattaforma.
      </p>

      <div
        style={{
          marginTop: 14,
          borderRadius: 18,
          border: "1px solid rgba(0,0,0,0.12)",
          background: "white",
          padding: 14,
          lineHeight: 1.55,
          opacity: 0.92,
        }}
      >
        <h3>1. Natura del servizio</h3>
        <p>
          MotoPortEU è una piattaforma digitale dedicata al motociclismo che
          permette di esplorare itinerari, consultare circuiti, pianificare
          percorsi e utilizzare strumenti di navigazione e pianificazione
          viaggio.
        </p>

        <p>
          Le informazioni presenti nella piattaforma sono fornite a scopo
          informativo e possono includere dati provenienti da fonti pubbliche o
          da contributi degli utenti.
        </p>

        <h3>2. Utilizzo della piattaforma</h3>
        <p>
          L’utente si impegna a utilizzare MotoPortEU in modo responsabile e nel
          rispetto delle normative vigenti, in particolare del Codice della
          Strada.
        </p>

        <p>
          MotoPortEU non è un sistema di navigazione certificato e non sostituisce
          strumenti professionali di navigazione o valutazioni personali delle
          condizioni di guida.
        </p>

        <h3>3. Accuratezza delle informazioni</h3>
        <p>
          Sebbene venga prestata la massima attenzione nella gestione dei dati,
          MotoPortEU non garantisce che tutte le informazioni presenti (itinerari,
          tempi di percorrenza, condizioni meteo, tracciati o percorsi) siano
          sempre complete, accurate o aggiornate.
        </p>

        <h3>4. Responsabilità dell’utente</h3>
        <p>
          L’utente è responsabile delle proprie decisioni di guida e deve sempre
          verificare le condizioni reali della strada, del traffico e del meteo
          prima e durante l’utilizzo dei percorsi suggeriti.
        </p>

        <p>
          MotoPortEU non è responsabile per eventuali danni, incidenti o problemi
          derivanti dall’utilizzo delle informazioni presenti nella piattaforma.
        </p>

        <h3>5. Contenuti dell’utente</h3>
        <p>
          Gli utenti possono salvare itinerari, percorsi o note personali.
          L’utente rimane responsabile dei contenuti inseriti nella piattaforma.
        </p>

        <h3>6. Evoluzione del servizio</h3>
        <p>
          MotoPortEU è un progetto in continua evoluzione. Alcune funzionalità
          possono essere modificate, aggiornate o rimosse nel tempo per motivi
          tecnici o di sviluppo.
        </p>

        <h3>7. Contatti</h3>
        <p>
          Per domande, supporto o segnalazioni puoi contattarci all’indirizzo:
          <br />
          <a href="mailto:motoporteu@gmail.com" style={{ fontWeight: 900 }}>
            motoporteu@gmail.com
          </a>
        </p>

        <p style={{ opacity: 0.65, marginTop: 10 }}>
          Ultimo aggiornamento: {new Date().toLocaleDateString()}
        </p>
      </div>
    </div>
  );
}