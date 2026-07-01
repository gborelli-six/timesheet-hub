# Timesheet Hub — E2E Test Plan

| Campo | Valore |
|---|---|
| Versione | 0.1 |
| Data | 2026-05-29 |
| Stato | Bozza |
| Proprietà | QA + Engineering |
| Riferimenti | ADR-003 (decisioni architetturali) · 001-functional-spec.md · 003-timesheet-hub-ux-brief.md |

---

## Scopo

Questo documento è il **catalogo vivo** degli scenari di test E2E di Timesheet Hub e dei principi con cui i test vengono scritti. È volutamente separato dall'ADR-003: l'ADR fissa le decisioni architetturali stabili (framework, autenticazione, dati, mocking, CI), mentre questo documento **cambia con l'evolvere delle feature** — gli scenari nascono, si aggiornano e cambiano priorità ad ogni iterazione.

Le configurazioni concrete (config Playwright, struttura del codice di test, workflow CI) non sono qui: sono demandate alla sede operativa / al repository, che ne è la fonte di verità.

---

## Scenari di test (mappa funzionale → casi)

**Priorità:** `P0` percorso critico, blocca il deploy · `P1` core funzionale · `P2` RBAC e amministrazione · `P3` edge e non-funzionale.

La colonna **Esito/Dati** indica l'esito pilotato sullo stub tramite la convenzione dei marcatori `E2E__` definita in **ADR-003-D**, oppure la fixture/seed che predispone lo scenario.

| # | Area | Scenario | Pri | Esito/Dati |
|---|---|---|---|---|
| 1 | Auth/Smoke | Bypass valido → dashboard caricata per ciascun ruolo | P0 | — |
| 2 | Import | Happy path employee: upload → preview → Jira → conferma → ✅ | P0 | `E2E__OK` |
| 3 | Import | Selezione multi-backend (Jira + Odoo) con esiti misti | P1 | Jira ok / Odoo `E2E__DOWN` |
| 4 | Import | Successo parziale: dettaglio errori per-riga | P1 | riga `E2E__FAIL` |
| 5 | Import | Fallimento backend (503) con messaggio contestuale | P1 | `E2E__DOWN` |
| 6 | Import | Upload formato errato/non template → errore inline | P1 | fixture wrong-format |
| 7 | Import | Preview: warning su righe anomale (ore mancanti, progetto ignoto) | P1 | fixture anomalie |
| 8 | Import | Navigazione tra step + ritorno indietro fino alla conferma | P1 | — |
| 9 | Import | Backend con token mancante: selezionabile + warning, errore specifico al submit | P1 | token assente |
| 10 | Import | Conferma è azione esplicita; il risultato non è bloccante (chiudibile) | P1 | `E2E__OK` |
| 11 | Token | Profilo: inserimento/sostituzione token; mascherato dopo il salvataggio, nessun reveal | P1 | — |
| 12 | Token | Token segnalato scaduto durante import (401) → banner di warning nel profilo | P2 | token `E2E__EXPIRED` |
| 13 | Log | Import genera log consultabile; dettaglio con errori per-riga | P1 | riga `E2E__FAIL` |
| 14 | Log | Filtri per periodo/backend/esito | P2 | seed multi-import |
| 15 | RBAC | `employee` vede solo i propri log; nessuna voce/area Admin | P2 | — |
| 16 | RBAC | `employee` che chiama rotta/API admin → 403/redirect | P2 | — |
| 17 | HR | Step 0 selezione dipendente → import per suo conto | P2 | `E2E__OK` |
| 18 | HR | Il log registra sia il dipendente di riferimento sia l'operatore HR | P2 | — |
| 19 | HR | HR vede tutti i log + filtro per dipendente | P2 | seed multi-utente |
| 20 | Admin | Utenti & ruoli: cambio ruolo via dropdown | P2 | — |
| 21 | Admin | Config backend: attiva/disattiva, set credenziali, mai in chiaro | P2 | — |
| 22 | Admin | Mapping colonne Excel (drag & drop / dropdown) | P2 | — |
| 23 | Sessione | Scadenza 8h → redirect automatico al login (orologio simulato) | P3 | orologio simulato |
| 24 | Stato async | Stati loading/error di React Query | P3 | errore di rete `/api/*` simulato |

I test si concentrano su **comportamento osservabile dall'utente** (cosa vede, cosa è andato a buon fine, cosa è fallito e perché — i principi UX del brief), non su dettagli implementativi.

---

## Strategia dati per i test

1. **Seed stabile** (utenti, ruoli, dati con prefisso `E2E__`) applicato una volta dopo le migrazioni, all'avvio dello stack in CI. È *read-mostly*.
2. **Dati per-test univoci** per tutto ciò che viene scritto (import, token): nessun test dipende dallo stato lasciato da un altro → parallelismo sicuro.
3. **Esiti esterni deterministici** scelti via fixture Excel / seed con i marcatori `E2E__` (ADR-003-D), mai via flag nel codice di produzione.
4. **Reset mirato** (`POST /api/_test/reset`, test-only) come escape hatch per i pochi blocchi che richiedono stato pulito; azzera `imports` e `user_tokens` lasciando intatto il seed.
5. **Fixture Excel versionate**: una per ciascuna forma rilevante (happy, partial, wrong-format, anomalie, multi-progetto). Il marcatore di scenario è codificato nei dati della fixture stessa, così l'intento è leggibile aprendo il file.

---

## Principi di scrittura dei test

- **Web-first assertions**: si attende sempre la condizione attesa, mai pause a tempo fisso (`sleep`/timeout arbitrari).
- **Selettori resilienti**: ruolo/label/testo prima dei `data-testid` (convenzione in ADR-003-E); mai selettori basati su classi CSS o struttura DOM.
- **Un test = un obiettivo utente**, indipendente e idempotente; nessun ordine implicito tra test.
- **Tempo controllato**: scadenza sessione e date di import si testano con orologio simulato, mai dipendendo dall'ora reale.
- **Diagnosi riproducibile**: il fallimento deve essere ricostruibile dagli artefatti (report/trace), non dalla macchina che ha eseguito il test.
- **Retry solo in CI**: un test che fallisce in locale senza retry è un test sano; in CI i retry assorbono solo flakiness residua e sono monitorati.
- **Isolamento → parallelismo**: l'esecuzione parallela è abilitata dall'assenza di stato condiviso mutabile.
- **Nessun segreto reale**: i token sono fixture; lo stub non richiede credenziali valide.

---

## Fuori dallo scope di questo documento

- Decisioni architetturali (framework, auth-bypass, stack/DB, stub, CI, convenzioni) → **ADR-003**.
- Configurazioni concrete: `playwright.config`, struttura delle cartelle, Page Object, tagging, workflow GitHub Actions, compose file → **repository / sede operativa**.
- Visual regression: ancora in *decisioni aperte* (ADR-003), subordinata al congelamento dei mockup hi-fi.
