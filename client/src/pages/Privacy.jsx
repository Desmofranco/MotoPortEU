import React from "react";

export default function Privacy() {
  return (
    <div style={{ padding: 16, maxWidth: 950, margin: "0 auto" }}>
      <h1 style={{ margin: "6px 0 0", fontSize: 34, letterSpacing: -0.5 }}>
        Privacy Policy 🔒
      </h1>

      <p style={{ opacity: 0.75, marginTop: 6 }}>
        Informativa sul trattamento dei dati personali degli utenti di MotoPortEU.
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
        <h3>1. Titolare del trattamento</h3>
        <p>
          MotoPortEU è un progetto digitale indipendente.  
          Per qualsiasi richiesta relativa alla privacy è possibile contattare:
          <br />
          <a href="mailto:motoporteu@gmail.com" style={{ fontWeight: 900 }}>
            motoporteu@gmail.com
          </a>
        </p>

        <h3>2. Dati raccolti</h3>
        <p>
          Durante l'utilizzo della piattaforma MotoPortEU possono essere raccolti
          alcuni dati necessari al funzionamento del servizio, tra cui:
        </p>

        <ul>
          <li>dati di registrazione (email e credenziali di accesso)</li>
          <li>dati tecnici del dispositivo e del browser</li>
          <li>dati di geolocalizzazione quando l’utente utilizza il GPS</li>
          <li>itinerari o percorsi salvati dall’utente</li>
        </ul>

        <h3>3. Finalità del trattamento</h3>
        <p>I dati raccolti vengono utilizzati esclusivamente per:</p>

        <ul>
          <li>fornire le funzionalità della piattaforma</li>
          <li>gestire l’account utente</li>
          <li>migliorare il servizio</li>
          <li>gestire eventuali pagamenti o funzionalità premium</li>
        </ul>

        <h3>4. Geolocalizzazione</h3>
        <p>
          Alcune funzionalità dell’app (come il navigatore e il GPS) richiedono
          l’accesso alla posizione dell’utente.  
          L’accesso alla geolocalizzazione avviene solo previo consenso
          dell’utente tramite il browser o il dispositivo.
        </p>

        <h3>5. Servizi di terze parti</h3>
        <p>
          MotoPortEU utilizza alcuni servizi esterni per il funzionamento della
          piattaforma, tra cui:
        </p>

        <ul>
          <li>servizi di hosting e infrastruttura cloud</li>
          <li>servizi di pagamento online</li>
          <li>servizi di mappe e meteo</li>
        </ul>

        <p>
          Tali servizi possono trattare alcuni dati tecnici necessari al loro
          funzionamento.
        </p>

        <h3>6. Conservazione dei dati</h3>
        <p>
          I dati vengono conservati solo per il tempo necessario a fornire il
          servizio o fino alla cancellazione dell’account da parte dell’utente.
        </p>

        <h3>7. Diritti dell’utente</h3>
        <p>
          Gli utenti hanno il diritto di richiedere in qualsiasi momento:
        </p>

        <ul>
          <li>accesso ai propri dati</li>
          <li>rettifica dei dati</li>
          <li>cancellazione dei dati</li>
          <li>limitazione del trattamento</li>
        </ul>

        <p>
          Per esercitare questi diritti è possibile contattare il progetto tramite
          email.
        </p>

        <h3>8. Sicurezza</h3>
        <p>
          MotoPortEU adotta misure tecniche e organizzative per proteggere i dati
          degli utenti e prevenire accessi non autorizzati.
        </p>

        <h3>9. Modifiche alla privacy policy</h3>
        <p>
          Questa informativa può essere aggiornata nel tempo per riflettere
          eventuali modifiche al servizio o alla normativa.
        </p>

        <p style={{ opacity: 0.65, marginTop: 10 }}>
          Ultimo aggiornamento: {new Date().toLocaleDateString()}
        </p>
      </div>
    </div>
  );
}