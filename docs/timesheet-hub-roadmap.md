# Timesheet Hub — Scaletta epiche (overview)

| Campo | Valore |
|---|---|
| Versione | 0.5 |
| Data | 2026-06-29 |
| Stato | Bozza |
| Riferimenti | 001-functional-spec.md · 003-ux-brief.md · 005-tech-spec-rbac.md · ADR-001 |

---

## Decisioni di impostazione

- **Priorità di rilascio employee-first**: si rilascia prima il **flusso completo dell'utente normale (Employee)** — self-import end-to-end — poi le funzioni **Admin**, infine le funzioni **HR**. Le epiche sono ordinate per priorità di rilascio, non per pura dipendenza tecnica. Tre milestone scandiscono il percorso: 🏁 Employee MVP → 🏁 Admin → 🏁 HR.
- **Wizard e log spezzati per ruolo**: l'import (E8) e i log (E9) sono divisi in sub-epiche **E8a/E9a** (employee-only) ed **E8b/E9b** (incrementi HR: Step 0 selezione dipendente, `POST /imports?for=<email>`, vista di tutti i log + filtri avanzati).
- **Gestione ruoli separata (E3bis)**: la promozione employee → hr/admin (oggi assente) è scorporata in un'epica dedicata **E3bis**, distinta dal flusso utente e dal pannello Admin (E3bis = backend identità, E10 = UI di amministrazione). Ogni login `@sixfeetup.it` riceve di default il ruolo `employee` (già implementato in E3).
- **Configurazione adapter per-utente**: non esiste configurazione di sistema condivisa per i backend. Ogni utente configura le proprie credenziali Odoo (URL, username, password) nel profilo personale tramite `user_tokens` (E5). Il CRUD admin dei backend (E10) riguarda esclusivamente policy e mapping Excel, non credenziali di connettore. Analogamente E6 usa `DEFAULT_COLUMN_MAPPING` hardcoded; il mapping configurabile resta in E10.
- **MVP adapter**: v1 con **solo Odoo**, ma su un'**architettura a plug-in** estendibile (interfaccia `TimesheetAdapter` + registry). Jira/Linear/Asana rinviati a epica futura a basso costo. La UI di selezione backend va comunque progettata per N backend.
- **Assegnazione multi-connettore per riga**: ogni riga del timesheet è assegnabile a **più connettori** contemporaneamente; per ciascuno si scelgono progetto e task remoto via **autocomplete live** (adapter, E7). Dalla seconda importazione il sistema **suggerisce** le associazioni dallo storico per-utente (tabella `connector_row_mappings`), sempre modificabili. Predisposizione del modello dati in E6, realizzazione nel wizard E8a; il pannello per-utente di modifica delle mappature è scorporato nell'epica post-v1 **E12**. Spec: [`007-multi-connector-row-mapping.md`](specs/007-multi-connector-row-mapping.md).
- **Design ↔ sviluppo**: sequenziali **per singola area/epica** (design dell'area → implementazione). Le fondamenta puramente backend non hanno fase design.
- **Modello dati**: niente schema up-front. Le convenzioni DB e il tooling migrazioni sono stabiliti una volta in E2; ogni feature-table nasce poi nell'epica che la possiede e ne definisce la semantica, con la propria migrazione.
- **RBAC**: il middleware è cross-cutting e vive in E2. È scaffoldabile come meccanismo generico prima dell'autenticazione, ma è pienamente esercitabile (e coperto da E2E) solo quando E3 emette JWT reali con il claim `role`.
- **Definition of Done** (standard per ogni epica): codice + review · test unit/integration · **test E2E** (verde in CI) · documentazione funzionale · documentazione utente.
- **Policy CI E2E**: non bloccanti sui commit/push (solo check veloci); **bloccanti per il merge delle PR su `main`** (required check + branch protection).

---

## Scaletta ordinata

Ordinata per **priorità di rilascio** (employee-first → admin → HR). Le tre milestone segnano i tagli di valore consegnabile.

| # | Stato | Epica | Descrizione | Possiede (DB) | Cosa definire |
|---|---|---|---|---|---|
| **E1** | ✅ Done | Fondamenta infrastrutturali & DevOps | Repo, CI/CD a due livelli, 3 servizi Railway (nginx/frontend/backend), nginx single-domain. Predispone runner E2E (Playwright), branch protection su `main`, impalcatura documentazione. | — | Tech / Operativo |
| **E2** | ✅ Done | Fondamenta dati & autorizzazione | Setup ORM + tooling migrazioni (Alembic), convenzioni condivise (naming, FK, campi audit, gestione enum). Middleware RBAC a 3 ruoli, invocato da ogni endpoint protetto. Va fatto una volta, lo usano tutti. | — (tooling + RBAC) | Tech |
| **E3** | ✅ Done | Autenticazione & identità | Google OAuth `hd=sixfeetup.it`, JWT con claim `role`, cookie httpOnly/SameSite=Strict (8h). Crea/legge l'identità utente; ruolo `employee` di default al primo login. | `users` | Tech |
| **E4** | ✅ Done | Style guide & shell applicativa | Token (palette, font, spaziatura), header/footer/menu, layout unificato, schermata login, componenti base. Sblocca tutte le UI successive. | — | UX/UI → Tech |
| **E5** | ✅ Done | Profilo & token utente | Cifratura AES-256-GCM, CRUD token per backend, campo password-like, stati. Estende `users` se servono campi profilo. Prerequisito dell'import. | `user_tokens` | UX/UI → Tech |
| **E6** | ✅ Done | Parsing Excel & Normalizer | Parsing client-side SheetJS, modello `TimesheetEntry[]`, mapping colonne (default hardcoded; config in E10), preview con warning righe anomale. | — | UX/UI → Tech |
| **E7** | ⬜ Todo | Architettura plug-in + adapter Odoo | Interfaccia adapter (`getProjects`/`getTasks` per autocomplete live), registry estendibile, integrazione Odoo (JSON-RPC), gestione errori parziali. Adapter usa credenziali per-utente da `user_tokens`. | — | Tech |
| **E8a** | ⬜ Todo | Flusso di importazione — **Employee** | Wizard self-import (step 1–4, **nessuno** Step 0): upload → preview → **assegnazione multi-connettore per riga** (progetto/task in autocomplete + suggerimenti da storico) → submit → risultato. `POST /imports` sul proprio utente. Dipende da E5, E6, E7. | `imports`, `connector_row_mappings` | UX/UI → Tech |
| **E9a** | ⬜ Todo | Log delle importazioni — **Employee** | Vista dei **propri** log + dettaglio per riga. Dipende da E8a. | — (legge `imports`) | UX/UI → Tech |
| 🏁 | — | **Milestone: Employee MVP** | Flusso utente normale completo end-to-end. | — | — |
| **E3bis** | ⬜ Todo | Gestione ruoli | Meccanismo/API di assegnazione e promozione ruoli (employee/hr/admin), oggi assente in produzione. Estende il dominio identità di E3; resta separata dalla UI Admin. | — (estende `users`) | Tech |
| **E10** | ⬜ Todo | Pannello Admin | UI utenti/ruoli (su API di E3bis), mapping Excel configurabile. Usato raramente. | — | UX/UI → Tech |
| 🏁 | — | **Milestone: Admin** | Amministrazione di utenti, ruoli e backend disponibile. | — | — |
| **E8b** | ⬜ Todo | Flusso di importazione — incremento **HR** | Step 0 selezione dipendente (solo hr/admin) + `POST /imports?for=<email>` (import per conto terzi). Dipende da E8a, E3bis. | — (usa `imports`) | UX/UI → Tech |
| **E9b** | ⬜ Todo | Log delle importazioni — incremento **HR** | Vista di **tutti** i log + filtri avanzati (periodo, backend, esito, dipendente). Dipende da E9a, E3bis. | — (legge `imports`) | UX/UI → Tech |
| 🏁 | — | **Milestone: HR** | Operatività HR completa (import per conto terzi, visibilità totale). | — | — |
| **E11** | ⬜ Todo | Adapter aggiuntivi (Jira, Linear, Asana) | Nuovi file sul pattern di E7. Differita post-v1. | — | Tech |
| **E12** | ⬜ Todo | Pannello mappature per-utente | UI di profilo per visualizzare/modificare le mappature riga↔connettore preimpostate (`connector_row_mappings`) senza avviare un import. Differita post-v1. Dipende da E8a. | — (gestisce `connector_row_mappings`) | UX/UI → Tech |

---

## Definition of Done (dettaglio)

Ogni epica è "done" solo quando:

1. **Codice** implementato e revisionato.
2. **Test unit/integration** sulla logica dell'epica.
3. **Test E2E**: almeno uno scenario completo che attraversa l'epica, verde in CI. La suite cresce in modo cumulativo.
4. **Doc funzionale**: spec/ADR aggiornati con le decisioni implementate (schema, contratti, configurazioni).
5. **Doc utente**: sezione della guida relativa all'epica, per i ruoli coinvolti (Employee / HR / Admin).
