# Timesheet Hub — Scaletta epiche (overview)

| Campo | Valore |
|---|---|
| Versione | 0.4 |
| Data | 2026-06-27 |
| Stato | Bozza |
| Riferimenti | 001-functional-spec.md · 003-ux-brief.md · ADR-001 |

---

## Decisioni di impostazione

- **MVP adapter**: v1 con **solo Odoo**, ma su un'**architettura a plug-in** estendibile (interfaccia `TimesheetAdapter` + registry). Jira/Linear/Asana rinviati a epica futura a basso costo. La UI di selezione backend va comunque progettata per N backend.
- **Design ↔ sviluppo**: sequenziali **per singola area/epica** (design dell'area → implementazione). Le fondamenta puramente backend non hanno fase design.
- **Modello dati**: niente schema up-front. Le convenzioni DB e il tooling migrazioni sono stabiliti una volta in E2; ogni feature-table nasce poi nell'epica che la possiede e ne definisce la semantica, con la propria migrazione.
- **RBAC**: il middleware è cross-cutting e vive in E2. È scaffoldabile come meccanismo generico prima dell'autenticazione, ma è pienamente esercitabile (e coperto da E2E) solo quando E3 emette JWT reali con il claim `role`.
- **Definition of Done** (standard per ogni epica): codice + review · test unit/integration · **test E2E** (verde in CI) · documentazione funzionale · documentazione utente.
- **Policy CI E2E**: non bloccanti sui commit/push (solo check veloci); **bloccanti per il merge delle PR su `main`** (required check + branch protection).

---

## Scaletta ordinata

| # | Stato | Epica | Descrizione | Possiede (DB) | Cosa definire |
|---|---|---|---|---|---|
| **E1** | ✅ Done | Fondamenta infrastrutturali & DevOps | Repo, CI/CD a due livelli, 3 servizi Railway (nginx/frontend/backend), nginx single-domain. Predispone runner E2E (Playwright), branch protection su `main`, impalcatura documentazione. | — | Tech / Operativo |
| **E2** | ⬜ Todo | Fondamenta dati & autorizzazione | Setup ORM + tooling migrazioni (Alembic), convenzioni condivise (naming, FK, campi audit, gestione enum). Middleware RBAC a 3 ruoli, invocato da ogni endpoint protetto. Va fatto una volta, lo usano tutti. | — (tooling + RBAC) | Tech |
| **E3** | ⬜ Todo | Autenticazione & identità | Google OAuth `hd=sixfeetup.it`, JWT con claim `role`, cookie httpOnly/SameSite=Strict (8h). Crea/legge l'identità utente. | `users` | Tech |
| **E4** | ⬜ Todo | Style guide & shell applicativa | Token (palette, font, spaziatura), header/footer/menu, layout unificato, schermata login, componenti base. Sblocca tutte le UI successive. | — | UX/UI → Tech |
| **E5** | ⬜ Todo | Profilo & token utente | Cifratura AES-256-GCM, CRUD token per backend, campo password-like, stati. Estende `users` se servono campi profilo. Prerequisito dell'import. | `user_tokens` | UX/UI → Tech |
| **E6** | ⬜ Todo | Parsing Excel & Normalizer | Parsing client-side SheetJS, modello `TimesheetEntry[]`, mapping colonne configurabile, preview con warning righe anomale. | — | UX/UI → Tech |
| **E7** | ⬜ Todo | Architettura plug-in + adapter Odoo | Interfaccia adapter, registry estendibile, integrazione Odoo (JSON-RPC), gestione errori parziali. | `backend_configs` | Tech |
| **E8** | ⬜ Todo | Flusso di importazione (wizard 4 step) | Orchestrazione end-to-end: (HR) selezione dipendente → upload → preview → selezione backend → submit → risultato. Dipende da E5, E6, E7. | `imports` | UX/UI → Tech |
| **E9** | ⬜ Todo | Log delle importazioni | Vista con filtri, dettaglio, visibilità per ruolo. Dipende da E8. | — (legge `imports`) | UX/UI → Tech |
| **E10** | ⬜ Todo | Pannello Admin | Utenti/ruoli, config backend↔progetto, mapping Excel. Usato raramente, bassa priorità. | — | UX/UI → Tech |
| **E11** | ⬜ Todo | Adapter aggiuntivi (Jira, Linear, Asana) | Nuovi file sul pattern di E7. Differita post-v1. | — | Tech |

---

## Definition of Done (dettaglio)

Ogni epica è "done" solo quando:

1. **Codice** implementato e revisionato.
2. **Test unit/integration** sulla logica dell'epica.
3. **Test E2E**: almeno uno scenario completo che attraversa l'epica, verde in CI. La suite cresce in modo cumulativo.
4. **Doc funzionale**: spec/ADR aggiornati con le decisioni implementate (schema, contratti, configurazioni).
5. **Doc utente**: sezione della guida relativa all'epica, per i ruoli coinvolti (Employee / HR / Admin).
