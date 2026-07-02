# Timesheet Hub — UX/UI Design Brief

| Campo | Valore |
|---|---|
| Versione | 0.2 |
| Data | 2026-06-30 |
| Stato | Approvata (Step 1 & Step 2 — STORY-E6-1) |
| Destinatari | Team UX/UI / Claude Design |
| Riferimenti | FUNCTIONAL-SPEC.md · ADR-001 |

---

## 1. Contesto e obiettivo del prodotto

**Timesheet Hub** è uno strumento interno web che centralizza l'importazione mensile dei timesheet dei dipendenti su più sistemi eterogenei (Jira, Odoo, Linear, Asana), eliminando l'inserimento manuale ripetuto degli stessi dati.

Il flusso core è semplice e ripetuto circa **una volta al mese** per dipendente: carica l'Excel → verifica i dati → seleziona i backend → importa → leggi il risultato.

Lo strumento non è pubblico. È accessibile solo da rete aziendale o VPN, con login Google (`@sixfeetup.it`).

---

## 2. Utenti e ruoli

| Ruolo | Chi è | Cosa fa nell'app |
|---|---|---|
| **Employee** | Dipendente standard | Importa il proprio timesheet; vede solo i propri log |
| **HR Manager** | Responsabile HR | Importa per conto di qualsiasi dipendente; vede tutti i log |
| **Admin** | IT / Operations | Configura backend, utenti, credenziali, mapping Excel |

> **Nota per il design**: i tre ruoli condividono la stessa interfaccia di base. Le differenze riguardano la visibilità di alcune sezioni e la presenza di controlli aggiuntivi (es. selezione dipendente per HR, pannello di configurazione per Admin). Preferire un **layout unificato con elementi contestuali** piuttosto che tre UI separate.

---

## 3. Sezioni principali dell'applicazione

### 3.1 — Login

Schermata unica. L'unico metodo di accesso è **Google OAuth** (`@sixfeetup.it`). Nessun form utente/password.

**Elementi necessari:**
- Logo / nome prodotto
- Bottone "Accedi con Google"
- Eventuale messaggio di errore (es. dominio non autorizzato)

**Note UX:** la schermata sarà vista raramente (sessione di 8 ore, login implicito). Deve essere essenziale e trasmettere affidabilità aziendale.

---

### 3.2 — Dashboard

Prima schermata post-login. Punto di orientamento rapido.

**Elementi:**
- Stato dell'ultima importazione (data, backend, esito sintetico)
- CTA principale: "Nuova importazione"
- Link rapido ai log recenti
- [Solo HR] Possibilità di passare a un'importazione per conto di un altro dipendente
- [Solo Admin] Indicatore di configurazione (es. backend attivi, warning se mancano credenziali)

**Note UX:** la dashboard deve essere funzionale, non decorativa. L'utente tipico arriva una volta al mese; deve capire in 3 secondi cosa fare. Il CTA "Nuova importazione" è l'azione dominante.

---

### 3.3 — Import Timesheet (flusso a step)

Flusso principale e più complesso. Articolato in **4 step sequenziali** con barra di progresso visibile.

#### Step 0 — Selezione dipendente *(solo HR)*
- Campo di ricerca/selezione dipendente (nome o email)
- Visibile solo se il ruolo è `hr` o `admin`
- Effetto: i dati del dipendente selezionato vengono usati per il log e per le credenziali

#### Step 1 — Upload file Excel

Per il ruolo **employee** il wizard ha **3 step**: Upload → Verifica e assegna → Conferma. Lo Step 0 (selezione dipendente) è visibile solo a HR/admin.

Panel dello step:
- eyebrow (font-mono, uppercase): "Step 1"
- titolo: "Carica il file Excel"
- descrizione: "Trascina o seleziona il timesheet del periodo. Il file viene letto in locale: nessun upload sul server in questa fase."

**Componente FileUpload — 4 stati visivi:**

| Stato | Trigger | Struttura visiva |
|---|---|---|
| **idle** | Stato iniziale / dopo "Rimuovi" | Box `dropzone` con bordo tratteggiato: icona upload centrata, titolo "Trascina qui il file Excel del timesheet", sub "oppure", bottone `outlined sm` "Sfoglia file", hint mono piccolo ".xlsx o .xls · max 5 MB · viene letto il primo foglio" |
| **loading** | File selezionato/droppato — parsing SheetJS in corso | Box `dropzone is-loading`: bordo solid `--primary-200`, sfondo `--primary-50`; spinner centrato; testo "Lettura del file…"; sub "Parsing del primo foglio con SheetJS" |
| **error** | File non valido (formato / dimensione / vuoto) | Box `dropzone is-error`: bordo `--error-border`, sfondo `--error-bg`, icona upload in `--error-600`; **sotto il box** (separato): div `fu-error` con icona warning + testo messaggio. Il box rimane cliccabile per riprovare. |
| **success** | Parsing completato senza errori | Il box dropzone scompare; appare una card `file-chip`: icona `fileChk` (file + checkmark), nome file in grassetto, meta `"X MB · N righe · 1° foglio"`, badge verde "Formato valido", bottone ghost "Rimuovi" con icona cestino |

Messaggi di errore esatti:
- Formato: `"Formato non supportato. Carica un file Excel (.xlsx o .xls)"`
- Dimensione: `"File troppo grande (max 5 MB)"`
- File vuoto: `"Il file non contiene dati"`

**Template hint card** (sotto il FileUpload, sempre visibile in step 1):
- Card `tmpl-card` con header "Template aziendale standard" + icona info
- Pillole colonne in font-mono: `Data` · `Progetto` · `Task` · `Ore` · `Note`

**Footer step 1:**
- Sinistra: hint "Il file resta in locale fino alla conferma." (icona info)
- Destra: bottone `btn-primary` "Avanti →" — abilitato solo dopo parsing riuscito

---

#### Step 2 — Preview e verifica dati

Panel header:
- eyebrow: "Step 2"
- titolo: "Verifica e assegna"
- descrizione: "Controlla i dati parsati e assegna ogni riga ai connettori, con progetto e task remoto. Le righe con warning restano importabili; quelle senza connettori non verranno importate."
- **summary-badges** (lato destro del panel-head): badge verde "X valide" · badge amber "Y con warning" · badge blu "X/N righe pronte"; legenda "⬡ = suggerito" visibile dalla seconda importazione

**Alert inline** (sopra la tabella, solo se ci sono righe con warning):
- Stile `alert alert-warning` con icona warning
- Titolo: `"X righe valide · Y con warning"`
- Body: `"I warning (ore, progetto, task o data mancanti) non bloccano l'importazione: assegna comunque i connettori oppure ricarica un file corretto."`

**Alert storico** (sopra la tabella, solo dalla seconda importazione):
- Stile `alert alert-info` con icona sparkle ✦
- Titolo: "Assegnazioni pre-compilate"
- Body: "Dalla seconda importazione le associazioni sono suggerite in base allo storico. Sono sempre modificabili: apri una riga per cambiarle."

**Tabella preview** (`table preview-table`) con scroll verticale:

| Colonna | Larghezza | Dettaglio |
|---|---|---|
| Data | 70 px | Font-mono, text-xs, colore muted, nowrap; `fmtDate` normalizza ISO e DD/MM/YYYY |
| Progetto | auto | Se vuoto: testo muted corsivo "— mancante" |
| Task | auto | Se vuoto: testo muted corsivo "— mancante" |
| Ore | 70 px | Allineamento destro (classe `num`); "—" se null |
| Stato | 132 px | Badge OK o warning (vedi sotto) |
| Connettori assegnati | 200 px (230 px interattiva) | Placeholder in E6; chip in E8a |

> **La colonna "Note" non è presente** in tabella: le note dell'Excel sono gestite internamente ma non mostrate nella preview.

**Righe con warning**: classe `row-warning` sulla `<tr>` (sfondo `--warning-bg` dal CSS).

**Colonna Stato:**
- Riga senza warning: `badge badge-success` con dot + "OK"
- Riga con warning: `badge badge-warning warn-badge` con icona warning + etichetta breve (se 1 warning: testo del tipo; se N: `"N warning"`); attributo `title` con lista completa dei warning (tooltip browser nativo)

**Colonna "Connettori assegnati" — predisposizione E6 / interazione E8a:**
- In E6 (non interattiva): testo corsivo muted `"— da assegnare"`
- In E8a (interattiva): bottone `"＋ Assegna"` (bordo tratteggiato, colore primary) se riga senza assegnazioni; chip connettore + bottone edit se già assegnata
- **Chip connettore**: monogramma colorato (lettera servizio) + ID task in mono; chip `is-suggested` con bordo `dashed --accent-400`, sfondo `--accent-50`, icona sparkle ✦

**Footer step 2:**
- Sinistra: bottone ghost "← Indietro" → torna allo step 1 (FileUpload torna a idle)
- Destra: hint "Assegna almeno una riga per procedere." (solo se nessun connettore assegnato) + bottone `btn-primary` "Avanti →" (disabilitato se nessuna riga ha connettori assegnati — logica implementata in E8a)

---

#### Tipi di warning — lista definitiva

I warning sono prodotti dal Normalizer (`computeWarnings`, E6-2) e visualizzati in tabella allo Step 2.

| `WarningType` | Scope | Trigger | Etichetta display |
|---|---|---|---|
| `MISSING_HOURS` | Per-riga | `hours == null` o non numerico | "Ore mancanti" |
| `MISSING_PROJECT` | Per-riga | `project` vuoto o solo spazi | "Progetto mancante" |
| `MISSING_TASK` | Per-riga | `task` vuoto o solo spazi | "Task mancante" |
| `INVALID_DATE` | Per-riga | Data presente ma non in formato `YYYY-MM-DD` né `DD/MM/YYYY` | "Data non valida" |
| `MISSING_PERIOD` | Globale | Colonna Ore assente nell'header del file (una sola volta) | "Periodo non determinato" |

`MISSING_PERIOD` è globale (non per-riga): emesso una sola volta se la colonna mappata a `hours` non esiste nell'header del file Excel.

---

#### Step 3 — Assegnazione connettori per riga
- Lista dei backend disponibili per i progetti presenti nel file: Jira, Odoo, Linear, Asana
- Ogni backend mostra: logo, nome, stato token (✓ configurato / ⚠ token mancante o scaduto)
- Checkbox multipla: l'utente sceglie su quali importare
- Se un token manca, il backend è selezionabile ma con warning; al submit viene mostrato un errore specifico

#### Step 4 — Conferma e risultato
- Riepilogo pre-invio: dipendente, periodo, n. righe, backend selezionati
- Bottone "Conferma importazione" (azione distruttiva → conferma esplicita)
- **Post-submit:** spinner durante l'invio, poi risultato per ciascun backend:
  - ✅ Successo (n righe importate)
  - ⚠️ Successo parziale (n/m righe, dettaglio errori)
  - ❌ Fallimento (messaggio di errore)
- Link al log dettagliato dell'importazione appena eseguita

**Note UX:**
- La barra di progresso deve essere persistente e mostrare sempre in quale step si è.
- Il ritorno a uno step precedente è possibile fino alla conferma.
- Il risultato finale non deve richiedere un'azione obbligatoria: l'utente può chiuderlo e tornare alla dashboard.

---

### 3.4 — Log delle importazioni

Storico delle importazioni. Accessibile dalla navbar e dalla dashboard.

**Struttura:**
- Tabella/lista con colonne: data, periodo, backend, righe ok/fail, esito
  (colonne "dipendente" e "operatore" aggiunte in E9b per la vista HR)
- Filtri: per periodo, backend, esito (successo/parziale/fallito)
- [Solo HR/Admin] Filtro per dipendente
- Click su una riga → dettaglio: tutte le informazioni del log, inclusi messaggi di errore per righe fallite

**Visibilità per ruolo:**
- `employee`: solo i propri log
- `hr`: tutti i log
- `admin`: tutti i log + filtri avanzati

**Note UX:** la tabella deve supportare dataset modesti (12 importazioni/anno × n dipendenti). Non serve paginazione aggressiva, ma il filtro per periodo è prioritario.

---

### 3.5 — Profilo utente — Token API

Sezione dove il dipendente gestisce i propri token API personali.

**Elementi per ciascun backend (Jira, Odoo, Linear, Asana):**
- Stato: "Configurato" (con data ultimo aggiornamento) o "Non configurato"
- Campo di inserimento/sostituzione token (mai visibile in chiaro dopo il salvataggio)
- Bottone "Aggiorna token"
- Eventuale messaggio di errore se il token è stato segnalato come scaduto

**Note UX:**
- I token sono sensibili: il campo input deve comportarsi come un campo password (caratteri nascosti).
- Dopo il salvataggio, mostrare solo "● ● ● ● ● ● ●" + data aggiornamento. Nessun modo di "rivelare" il token.
- Se un token è scaduto (segnalato dal sistema durante un import), mostrare un banner di warning in questa sezione.

---

### 3.6 — Pannello Admin

Accessibile solo al ruolo `admin`. Suddiviso in tre sotto-sezioni navigabili.

#### 3.6.1 — Utenti e ruoli
- Tabella utenti (email, nome, ruolo attuale, ultimo accesso)
- Modifica ruolo via dropdown inline o modal
- Gli utenti compaiono dopo il primo accesso (nessuna creazione manuale)

#### 3.6.2 — Configurazione backend
- Lista backend (Jira, Odoo, Linear, Asana)
- Per ciascuno: attivo/disattivo, URL endpoint, credenziali di sistema (inserimento/sostituzione, mai in chiaro)
- Associazione backend ↔ progetto: quale adapter usare per ciascun progetto/cliente

#### 3.6.3 — Mapping colonne Excel
- Interfaccia per associare le colonne del template Excel ai campi interni
- Visualizzazione: colonna sinistra = campi interni (fissi), colonna destra = colonne Excel (configurabili)
- Interazione preferita: drag & drop o dropdown per ciascun campo

**Note UX:** il pannello admin è usato raramente (setup iniziale + manutenzione occasionale). Priorità alla chiarezza e alla prevenzione degli errori, non alla velocità.

---

## 4. Navigazione globale

**Navbar laterale** (sidebar) o **top bar** — da valutare in base alla densità di sezioni.

Voci di navigazione:

| Voce | Visibile a |
|---|---|
| Dashboard | Tutti |
| Nuova importazione | Tutti |
| Log importazioni | Tutti |
| Profilo / Token | Tutti |
| Admin | Solo `admin` |

La sezione corrente deve essere sempre riconoscibile. L'utente loggato (nome, email, avatar Google) deve essere visibile in ogni schermata.

---

## 5. Principi UX da rispettare

**Chiarezza dello stato.** L'utente deve sempre sapere: dove si trova nel flusso, cosa è andato a buon fine, cosa è fallito e perché.

**Azioni irreversibili richiedono conferma.** Il submit dell'importazione è l'unica azione distruttiva rilevante: richiedere una conferma esplicita prima dell'invio.

**Feedback immediato.** L'upload e il parsing dell'Excel avvengono lato client: la preview deve apparire senza attendere una risposta server. Il feedback di validazione (righe anomale, token mancanti) deve essere inline, non in modal.

**Errori contestuali.** Gli errori di importazione vanno mostrati a livello di singolo backend e, dove possibile, di singola riga. Non un generico "qualcosa è andato storto".

**Accessibilità base.** Contrasto sufficiente, focus visibile, form accessibili da tastiera. Non è richiesta conformità WCAG AA completa, ma i pattern base devono essere rispettati.

**Assenza di rumore.** Lo strumento è usato una volta al mese. Non servono onboarding tour, tooltip promozionali o gamification. Ogni elemento dell'interfaccia deve guadagnarsi il suo spazio.

---

## 6. Tono visivo e identità

Lo strumento è **interno** e **professionale**, usato da persone che lo aprono per fare una cosa e chiuderlo. Il tono visivo deve riflettere questo:

- **Registro:** business tool, non consumer app. Pulito, diretto, senza decorazioni superflue.
- **Densità:** media. La preview dei dati Excel richiede spazio per leggere tabelle; non comprimere tutto.
- **Colore:** palette aziendale 6feetup (da allineare con il brand esistente). In assenza di vincoli, preferire una base neutra con un colore primario di accento ben definito.
- **Iconografia:** coerente e funzionale. I backend (Jira, Odoo, Linear, Asana) hanno loghi riconoscibili: usarli dove il contesto lo permette.

---

## 7. Specifiche tecniche rilevanti per il design

| Aspetto | Dettaglio |
|---|---|
| Framework frontend | React + Vite, MUI v7 + Mantis |
| Viewport target | Desktop (uso esclusivo da rete aziendale / VPN) |
| Mobile | Fuori scope v1 |
| Autenticazione | Google OAuth — il login è una singola schermata, nessun form custom |
| Sessione | 8 ore, poi redirect automatico al login |
| Parsing Excel | Client-side (SheetJS) — la preview non richiede round-trip server |
| Stato asincrono | TanStack Query (`@tanstack/react-query`) — gli stati loading/error/success devono essere sempre rappresentati |

---

## 8. Deliverable attesi dal team design

1. **Sitemap** — mappa di tutte le schermate e le transizioni tra di esse.
2. **Wireframe lo-fi** — struttura e gerarchia degli elementi per ogni schermata, con annotazioni di comportamento.
3. **Design system / token** — palette colori, tipografia, spaziatura, componenti base (bottoni, form, tabelle, badge di stato, step indicator).
4. **Mockup hi-fi** — le 5 schermate principali: Login, Dashboard, Import (ogni step), Log, Profilo Token.
5. **Specifiche di handoff** — dimensioni, spaziature, stati interattivi (hover, focus, disabled, loading, error) per ogni componente.

---

## 9. Fuori scope (v1) — non progettare per

- Creazione o modifica del timesheet nell'app (solo import da Excel)
- Sincronizzazione bidirezionale con i backend
- Notifiche push o reminder automatici
- App mobile nativa
- Multi-azienda
