# ADR-003 — Strategia di testing End-to-End con Playwright

| Campo | Valore |
|---|---|
| ID | ADR-003 |
| Titolo | Architettura, autenticazione, mocking e CI dei test E2E |
| Stato | Proposto |
| Data | 2026-05-29 |
| Autori | 6feetup Engineering |
| Riferimenti | ADR-001 · 001-functional-spec.md · 003-timesheet-hub-ux-brief.md · 004-e2e-test-plan.md |

---

## Contesto

Timesheet Hub è uno strumento interno il cui valore risiede in un flusso critico e poco frequente (import mensile su backend eterogenei). Gli errori in produzione sono costosi perché: (a) toccano dati di rendicontazione reali, (b) si manifestano una volta al mese, quando un regression bug è già a contatto con i clienti, (c) coinvolgono integrazioni esterne difficili da diagnosticare a posteriori.

Il flusso utente attraversa più step (upload → preview → selezione backend → conferma → risultato), tre ruoli con permessi distinti e quattro adapter esterni. Questa combinazione di *flusso multi-step + RBAC + integrazioni* è esattamente il dominio in cui i test E2E rendono di più: validano l'integrazione reale dei livelli, non singole unità.

Questo ADR fissa le **decisioni architetturali** sul testing E2E (framework, autenticazione, dati, mocking, CI). Il catalogo degli **scenari di test** e i **principi operativi di scrittura** vivono nel documento separato `004-e2e-test-plan.md`, che evolve con le feature; le **configurazioni concrete** (config Playwright, struttura del codice, workflow CI) sono demandate alla sede operativa.

### Vincoli architetturali decisi (input a questo ADR)

| Area | Decisione |
|---|---|
| Autenticazione nei test | **Bypass OAuth**: endpoint test-only che emette il cookie JWT di sessione |
| Backend e dati | **Stack reale** in esecuzione + **DB di test seedato**; mock confinato ai **soli adapter esterni** |
| Ambiente target | **CI effimera** (GitHub Actions): build + stack in container, distrutto a fine run |

---

## Decisioni

### ADR-003-A — Playwright come framework E2E

**Decisione:** Playwright (runner ufficiale `@playwright/test`, TypeScript) è il framework E2E unico.

**Motivazione:** auto-waiting e web-first assertions riducono la flakiness senza `sleep` manuali; il supporto nativo a `route` interception serve solo come rete di sicurezza (il mocking primario è lato backend, vedi ADR-003-D); `storageState` rende l'auth-bypass per-ruolo banale; trace viewer e parallelismo per-worker sono integrati. Cypress è stato considerato ma penalizzato dal modello a singolo browser-tab e dal parallelismo a pagamento; Selenium è scartato per verbosità e fragilità.

---

### ADR-003-B — Autenticazione: bypass via endpoint test-only + `storageState` per ruolo

**Decisione:** il backend espone, **solo** quando `E2E_TEST_MODE=true`, un endpoint test-only (`POST /api/_test/session`) che, ricevuti email e ruolo, emette lo stesso cookie di sessione JWT della produzione (`httpOnly`, `Secure`, `SameSite=Strict`). L'endpoint riusa la **stessa funzione di firma JWT** del flusso OAuth reale (ADR-001-D): l'unica cosa bypassata è lo scambio con Google, non l'emissione del token né il middleware RBAC. In questo modo i test esercitano il vero meccanismo di sessione e autorizzazione.

**Guardia di sicurezza (non negoziabile):**
- L'endpoint è registrato solo se `E2E_TEST_MODE=true`; in assenza del flag la rotta **non esiste** (404), non è solo disabilitata.
- `E2E_TEST_MODE` non è mai impostato negli ambienti di produzione/staging; il deploy fallisce se il flag è attivo fuori da CI (check in pipeline).
- L'endpoint accetta solo email `@sixfeetup.it` (coerenza col constraint `hd`).

**Uso in Playwright:** un *setup project* autentica una volta per ruolo e salva lo `storageState` (cookie inclusi). I test successivi caricano lo state del ruolo richiesto — zero login per-test, massima velocità. Per scenari che richiedono un'identità specifica o il cambio ruolo a runtime (es. HR che opera per un dipendente preciso) è disponibile una fixture `loginAs(role, email?)`.

---

### ADR-003-C — Stack reale in CI con DB di test effimero

**Decisione:** ogni run CI avvia lo stack completo in container (nginx + frontend + backend + stub adapter), con un DB di test **dedicato e usa-e-getta**, e vi punta `baseURL`.

**Database in CI:** **Postgres in container**, non SQLite. Motivazione: i test E2E scrivono `imports`/`user_tokens` in parallelo su più worker; SQLite serializza le scritture e produce lock → flakiness. Dato che l'ADR-001 prevede comunque la migrazione a Postgres, testare su Postgres aumenta la fedeltà e rimuove una classe di falsi negativi. SQLite resta valido per il dev locale a worker singolo.

**Seed deterministico** applicato dopo le migrazioni:
- Utenti fissi per ruolo (`employee@`, `hr@`, `admin@sixfeetup.it`).
- `backend_configs` per i quattro adapter, con `base_url` che punta allo **stub** (vedi ADR-003-D).
- Progetti/task/token con prefisso riservato `E2E__` che pilotano gli scenari di esito (vedi ADR-003-D).

**Isolamento tra test:** i dati di seed sono *read-mostly*. Ogni test che muta lo stato (un import, un token) crea **entità proprie e univoche** (nessun dato condiviso a scrittura). Per i blocchi che necessitano di stato pulito è disponibile `POST /api/_test/reset` (test-only, stesse guardie di B) che azzera `imports` e `user_tokens` lasciando intatto il seed.

---

### ADR-003-D — Mock dei soli adapter esterni via stub HTTP programmabile, pilotato dai dati

**Decisione:** i sistemi esterni (Jira, Odoo, Linear, Asana) sono sostituiti da **un singolo stub HTTP** che espone le rotte attese da ciascuna API. **Il codice degli adapter resta quello di produzione** e non viene modificato per i test: cambia solo la `base_url` (da seed) che li fa puntare allo stub. Così testiamo davvero il mapping `TimesheetEntry → payload esterno` e la gestione degli errori (401, parziali, timeout) dell'adapter reale.

**Controllo degli esiti guidato dai dati (data-driven), non da branch test-only:** lo stub decide la risposta in base al *contenuto* della richiesta, che a sua volta dipende dal file Excel di fixture e dal seed. L'esito è quindi **leggibile direttamente dai dati di test**, senza comandi esterni.

**Convenzione dei marcatori (vincolante).** Tutti i marcatori usano il **prefisso riservato `E2E__`**, che non può comparire in dati reali e ne garantisce l'isolamento. Il marcatore vive su tre campi distinti, scelti perché ciascuno esprime in modo naturale lo scenario corrispondente:

| Campo che porta il marcatore | Valore | Risposta dello stub | Scenario UI esercitato |
|---|---|---|---|
| Progetto | `E2E__OK` (o qualsiasi valore non riservato) | `200/201` su tutte le righe | ✅ Successo |
| Task (su una singola riga) | `E2E__FAIL` | `2xx` parziale: righe normali accettate, riga marcata rifiutata con messaggio | ⚠️ Successo parziale (per-riga) |
| Token utente (seedato) | `E2E__EXPIRED` | `401` | ❌ Token scaduto → notifica + banner profilo |
| Progetto | `E2E__DOWN` | `503` / timeout simulato | ❌ Fallimento backend |

Lo scenario combinato (es. riga `E2E__FAIL` su progetto `E2E__DOWN`) è valido e composabile: lo stub valuta i campi in modo indipendente.

**Motivazione:** lo scenario è selezionato scegliendo la fixture Excel/seed, non iniettando header speciali o `if (test)` nel codice. Gli adapter non sanno di essere in test; la copertura del loro path d'errore è autentica e gli scenari sono deterministici e leggibili. Il prefisso unico (`E2E__`) rende impossibile la collisione con dati di produzione e auto-documenta l'intento del test a chi legge la fixture.

**Implementazione consigliata dello stub:** servizio leggero nello stesso linguaggio del backend (un singolo file di rotte), così da non aggiungere dipendenze di runtime estranee. Le rotte mappano i tracciati REST/GraphQL/JSON-RPC minimi che ciascun adapter invoca.

`route` interception lato Playwright **non** è il meccanismo primario (lo stack è reale): resta disponibile solo per simulare condizioni di rete del *frontend* (es. latenza/errore di `/api/imports` per testare gli stati loading/error di React Query) senza coinvolgere il backend.

---

### ADR-003-E — Convenzione dei selettori e dei `data-testid`

**Decisione:** i selettori dei test danno priorità a `getByRole`/`getByLabel`/`getByText`; i `data-testid` si usano **solo** dove il ruolo accessibile non identifica univocamente l'elemento e costituiscono una **API di test stabile** — la loro modifica è un cambiamento contrattuale che passa per review condivisa frontend + QA.

- **Naming:** `area-elemento[-variante]` in kebab-case (es. `import-step-indicator`, `backend-result-jira`, `token-field-jira`, `log-row`, `admin-role-select`).
- **Elementi che lo richiedono** (lista chiusa, estendibile solo via review): step indicator del wizard; blocco risultato e badge di esito per ciascun backend (`backend-result-{service}`); campo token mascherato per backend (`token-field-{service}`); riga di log e dettaglio (`log-row`, `log-detail`); controlli del pannello admin (`admin-role-select`, `admin-backend-toggle-{service}`, `admin-mapping-{field}`).
- **shadcn/ui:** i `data-testid` vanno propagati esplicitamente sui componenti wrapper (non tutti li inoltrano di default); ove necessario il componente espone una prop `data-testid` passthrough.

La struttura del codice di test (layout delle cartelle, organizzazione dei Page Object, tagging, configurazione dei project Playwright) è demandata alla definizione operativa in sede separata.

---

### ADR-003-F — Integrazione CI (GitHub Actions) e gating

**Decisione:** i test E2E girano in un workflow CI dedicato (GitHub Actions) che builda le immagini, avvia lo stack completo in container con `E2E_TEST_MODE=true` e Postgres effimero, esegue la suite e **funge da gate bloccante** sul deploy nella pipeline `test → build → deploy` dell'ADR-001.

- Lo **smoke** gira per primo come fail-fast; la suite completa è prerequisito al deploy in produzione.
- Gli **artefatti di diagnosi** (report, trace) sono prodotti sui fallimenti per garantire la riproducibilità fuori dalla macchina di esecuzione.
- I **retry** sono abilitati solo in CI, accompagnati da un *budget di flakiness* monitorato.

I dettagli di configurazione del workflow (sharding, valori di retry, modalità di trace, compose file) sono demandati alla sede operativa.

---

## Conseguenze

**Positive:**
- Il percorso critico mensile è protetto da regressioni con esiti deterministici e riproducibili.
- Nessuna dipendenza da Google o da sistemi esterni reali in CI → suite veloce e stabile.
- Il codice degli adapter di produzione è testato sul path d'errore reale, senza branch test-only.
- La pipeline `test → build → deploy` dell'ADR-001 acquisisce un gate E2E significativo.

**Trade-off accettati:**
- Lo stub adapter va mantenuto allineato ai tracciati delle API esterne reali (rischio di drift: lo stub potrebbe restare indietro rispetto a Jira/Odoo/Linear/Asana). Mitigazione: contratti minimi e revisione allo scoprire di una divergenza.
- L'endpoint test-only è una superficie sensibile: la sua sicurezza dipende dalla rigidità della guardia `E2E_TEST_MODE` e dal check di pipeline.
- Postgres in CI diverge dallo SQLite del dev locale iniziale (mitigato dalla migrazione a Postgres già prevista).

---

## Decisioni aperte

- Visual regression testing (screenshot diff) sui mockup hi-fi: incluso o fuori scope v1?
- Smoke test post-deploy contro produzione reale (con auth-bypass disabilitato, quindi richiederebbe una strategia OAuth diversa)?
- Soglia formale del *budget di flakiness* e policy di quarantena dei test instabili.
- Estensione dello stub per coprire i rate-limit / retry degli adapter reali.
