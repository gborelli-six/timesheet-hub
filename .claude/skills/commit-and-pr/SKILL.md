---
name: commit-and-pr
description: >
  Prepara un commit e (su richiesta) apre una Pull Request per Timesheet Hub,
  seguendo le convenzioni osservate nel repo — hook pre-commit, gate CI,
  Definition of Done, formato PR consolidato, footer di attribuzione. Usala
  quando l'utente chiede di committare le modifiche, fare commit, aprire una
  PR, creare la pull request, o preparare il lavoro per il merge.
---

# Commit e Pull Request — Timesheet Hub

Runbook per portare delle modifiche dal working tree a una PR pronta per la
review, coerente con le convenzioni reali di questo repo (non solo con le
buone pratiche generiche di git).

**Autonomia**: il commit locale è a basso rischio e va eseguito senza
fermarsi a chiedere conferma preventiva (mostra comunque il messaggio
proposto nell'output prima di lanciarlo). `git push` e `gh pr create`
invece sono azioni visibili al team: **fermati sempre e chiedi conferma
esplicita** prima di eseguirle, anche se il resto del flusso è filato
liscio.

Se l'utente ha chiesto esplicitamente solo il commit (non la PR), fermati
dopo la sezione 4.

---

## 1. Stato e controlli pre-commit

- `git status` + `git diff --stat` per capire cosa è cambiato **prima** di
  stagare qualunque cosa. Mai `git add -A` / `git add .` alla cieca: elenca i
  file toccati e verifica che non ci sia nulla di inatteso (secrets, file di
  sistema, artefatti di build).
- Se sono toccati file sotto `backend/`:
  ```bash
  cd backend && uv run ruff check . && uv run ruff format --check . && uv run pytest
  ```
  (rispecchia il job `backend` di `backend-ci.yml` e gli hook `ruff`/`ruff-format`
  di `.pre-commit-config.yaml`).
- Se sono toccati file sotto `frontend/` (`.ts`/`.tsx`/`.json`/`.css`):
  **prima** di tutto
  ```bash
  cd frontend && npx prettier --write .
  ```
  L'hook pre-commit di prettier fa solo `--check`, **non autofix**: senza
  questo passaggio il commit fallisce quasi sempre su qualunque file toccato
  a mano. Poi:
  ```bash
  npm run lint && npm run type-check && npm run build
  ```
  (rispecchia il job `frontend` di `frontend-ci.yml`).
- Se ci sono migrazioni Alembic nuove in `backend/alembic/versions/`:
  verifica che `downgrade()` sia implementato per intero e che eventuali
  `ALTER TYPE ... ADD VALUE` siano scritte a mano, non autogenerate (regola
  esplicita in `CLAUDE.md`, sezione Alembic).
- L'E2E smoke (`make e2e` oppure `cd e2e && npx playwright test --grep
  "@smoke|@rbac"`) gira comunque in CI su ogni PR: non è un passaggio
  obbligatorio prima di ogni commit locale, ma **suggeriscilo** se il diff
  tocca aree E2E-sensibili (auth, RBAC, wizard di importazione, connettori).

Se uno di questi controlli fallisce, correggi la causa reale (non
bypassarla) e ripeti il controllo prima di passare al commit.

## 2. Checklist Definition of Done

Prima di committare, verifica mentalmente questa checklist (fusa dalla DoD
per-storia in `docs/backlog/README.md`/`backlog-manager.md` e da quella
per-epica in `CLAUDE.md`) — è anche la base del "Test plan" della PR (§5):

- [ ] Codice implementato e rivisto
- [ ] Test unit/integration verdi
- [ ] Test E2E smoke verdi in CI (`@smoke`/`@rbac`)
- [ ] Documentazione tecnica aggiornata (ADR/spec) se l'epica lo richiede
- [ ] Guida utente aggiornata in `docs/guides/` se cambia un comportamento
      visibile
- [ ] **Security review obbligatoria** se il diff tocca autenticazione, JWT,
      cookie di sessione, RBAC o cifratura dei token (indicativamente
      `app/core/security.py`, `app/core/rbac.py`, la tabella `user_tokens`,
      il flusso OAuth): segnalalo esplicitamente all'utente e ricorda che va
      passato dall'agente `security-reviewer` prima del merge — **non
      bloccare da solo il commit per questo**, è un promemoria, non un gate
      automatico.

Non serve spuntarle tutte per forza (dipende dalla natura della modifica),
ma ogni voce saltata va giustificabile a colpo d'occhio.

## 3. Branch

- Se sei su `main` (o un branch condiviso equivalente): crea un nuovo branch
  **prima** di committare, con nome `feature/<slug-kebab-case>` — è il
  prefisso usato storicamente in tutte le PR mergiate del repo (es.
  `feature/e9a-import-log-employee`, `feature/security-data-segregation-review`).
  Non committare mai direttamente su `main`.
- Se sei già su un branch di lavoro (anche con un prefisso diverso, es.
  `feat/...`), non rinominarlo: si continua su quello che c'è.

## 4. Messaggio di commit

Lo stile osservato nello storico reale del repo **non è Conventional
Commits rigoroso** — non forzarlo se non calza:

- Prima riga: descrittiva, imperativa o nominale, indicativamente 40–90
  caratteri. Aggiungi il tag dell'epica/storia tra parentesi quando
  pertinente (es. `(E13)`, `(#21)`). Un prefisso minuscolo tipo `feat:`/
  `fix:`/`docs:` è opzionale: usalo solo se il cambiamento è isolato a una
  categoria chiara, coerente con i commit più recenti del repo.
- Corpo opzionale: prosa breve o bullet tecnici che spiegano cosa e perché,
  non oltre ~10 righe. Non serve se il titolo è già autoesplicativo.
- Lingua: italiano o inglese, anche mescolati nello stesso repo — usa quella
  già prevalente nei file toccati o nella conversazione con l'utente, non
  serve uniformare a forza.
- Chiudi sempre con le righe di attribuzione indicate nel system-reminder
  attivo in questa sessione per i commit git. **Non hardcodare qui un nome
  di modello**: quella riga cambia da sessione a sessione (dipende da quale
  Claude sta girando in quel momento) — prendila sempre dal reminder
  corrente, non da questo file.
- Passa il messaggio via HEREDOC:
  ```bash
  git commit -m "$(cat <<'EOF'
  <titolo>

  <corpo opzionale>

  <riga/e di attribuzione dal system-reminder>
  EOF
  )"
  ```
  Mai `--no-verify` / `--no-gpg-sign`. Se l'hook pre-commit fallisce, il
  commit **non è avvenuto**: correggi la causa (es. lancia il formatter
  mancato), ristaga, e ripeti con un commit **nuovo** — mai `--amend` in
  questo caso, perché non staresti modificando un commit precedente ma
  creandone uno per la prima volta.
- Esegui il commit senza fermarti a chiedere conferma preventiva, come da
  decisione concordata — ma mostra comunque il messaggio proposto
  nell'output prima di lanciare il comando, così l'utente lo vede.

## 5. Push e Pull Request — richiede conferma esplicita

**Fermati e chiedi conferma esplicita prima di `git push` e prima di `gh pr
create`.** Non procedere oltre il commit locale senza che l'utente lo abbia
confermato in questo turno.

Una volta confermato:

- Push: `git push -u origin <branch>`. Mai `--force` senza richiesta
  esplicita dell'utente.
- Il remote è `github.sixfeetup:gborelli-six/timesheet-hub` (owner reale
  `gborelli-six`). Su questa macchina `gh` risulta autenticato con più
  account: **passa sempre `--repo gborelli-six/timesheet-hub` esplicitamente**
  su ogni comando `gh` (es. `gh pr create --repo gborelli-six/timesheet-hub
  ...`) invece di affidarti o cambiare l'account attivo — evita side-effect
  sullo stato globale di `gh` e ambiguità tra i due account.
- Titolo PR: stesso stile del titolo di commit (§4).
- Corpo PR: usa il formato più recente e consolidato osservato nelle ultime
  PR mergiate (quello più allineato alla DoD):
  ```markdown
  ## Summary
  - punto elenco 1
  - punto elenco 2

  ## Test plan
  - [ ] voce derivata dalla checklist DoD (§2), solo quelle pertinenti
  - [ ] comando/passaggio concreto per verificarla (es. `uv run pytest`,
        `npx playwright test --grep @smoke`)
  ```
  seguito dalla riga di attribuzione per le PR indicata nel system-reminder
  attivo in questa sessione (anche qui: non hardcodarla, prendila dal
  reminder corrente). Passa il body via HEREDOC come per il commit.
- Dopo la creazione, restituisci il link della PR all'utente.
- Chiusura storie nel backlog (`backlog-manager`) e aggiornamento della
  documentazione permanente (`docs-writer`) avvengono **dopo il merge** e
  non sono nello scope di questa skill — nominali solo come promemoria, non
  eseguirli qui.
