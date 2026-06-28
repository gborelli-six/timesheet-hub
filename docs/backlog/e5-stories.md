# E5 — Profilo & token utente: dettaglio storie

> Epica che implementa la gestione sicura delle credenziali dei connettori per-utente definita in [`ADR-005`](../adr/ADR-005-connector-credentials-security.md). Prerequisito dell'import (E8). Riusa lo scaffolding di E2: `TimestampMixin` (`ADR-004`), workflow Alembic (STORY-012), `require_role` (`ADR-001-G`).
>
> **Nota sugli ID**: gli `STORY-NNN` sono globali e sequenziali; E2 arriva a STORY-016 ed E3/E4 occuperanno i numeri intermedi. Gli ID `STORY-E5-N` qui sotto sono **provvisori**: assegnare i numeri definitivi all'inserimento in sprint, coordinandosi con il backlog-manager.

---

## STORY-E5-1 — Modulo cifratura segreti (`encrypt_secret` / `decrypt_secret`)

- **Stato**: ⬜ Todo
- **Tipo**: Backend
- **Dipende da**: —

**Obiettivo**: esiste un modulo riusabile che cifra/decifra segreti con AES-256-GCM secondo `ADR-005-B`, indipendente dal modello dati.

**Criteri di accettazione**:
- `cryptography` aggiunto a `backend/pyproject.toml`.
- In `backend/app/core/security.py` (oggi stub):
  - `encrypt_secret(plaintext, user_id, service) -> (secret_enc, nonce, key_version)` — nonce `os.urandom(12)`, AAD `f"{user_id}:{service}"`, chiave da `settings.token_encrypt_key`.
  - `decrypt_secret(secret_enc, nonce, user_id, service, key_version) -> plaintext`.
- Test unit:
  - round-trip cifra → decifra restituisce il plaintext originale;
  - due cifrature dello stesso plaintext producono `nonce` e `secret_enc` diversi;
  - tamper detection: `secret_enc`, `nonce` o AAD (`user_id`/`service`) alterati → `InvalidTag`;
  - verifica che nessun segreto finisca in log/repr/eccezioni.

---

## STORY-E5-2 — Modello `UserToken` + migrazione Alembic

- **Stato**: ⬜ Todo
- **Tipo**: Backend
- **Dipende da**: STORY-E5-1, STORY-012 (workflow Alembic)

**Obiettivo**: la tabella `user_tokens` esiste secondo lo schema di `ADR-005-A`.

**Criteri di accettazione**:
- Modello in `backend/app/models/` che eredita `TimestampMixin` con i campi: `id`, `user_id` (FK → `users`), `service` (enum nativo `user_tokens_service_enum`: `jira`/`odoo`/`linear`/`asana`, pattern `ADR-004-B`), `account_identifier` (`String(255)`, nullable), `secret_enc` (`LargeBinary`), `nonce` (`LargeBinary(12)`), `key_version` (`SmallInteger`, default 1).
- `UniqueConstraint(user_id, service)` → `uq_user_tokens_user_id`.
- Migrazione `NNNN_create_user_tokens.py` con `upgrade`/`downgrade` reversibili (crea anche il tipo enum; checklist STORY-012).
- Modello registrato in `app/models/__init__.py` così che Alembic `--autogenerate` e `Base.metadata` lo vedano.

---

## STORY-E5-3 — API connettori write-only (GET / PUT / DELETE)

- **Stato**: ⬜ Todo
- **Tipo**: Backend
- **Dipende da**: STORY-E5-2

**Obiettivo**: l'utente gestisce i propri connettori via API rispettando il contratto write-only di `ADR-005-C`.

**Criteri di accettazione**:
- Nuovo router `backend/app/routers/connectors.py` montato sotto `/api/me/connectors`, protetto da `require_role` e scopato sul `user_id` di sessione.
- `GET` → lista `{service, account_identifier, configured, updated_at}`; **mai** il segreto.
- `PUT /{service}` → upsert: `secret` valorizzato cifra e sostituisce (nuovo nonce via STORY-E5-1); `secret` assente preserva il segreto; `account_identifier` aggiornabile.
- `DELETE /{service}` → rimuove il connettore.
- Schemi Pydantic con `secret` solo-input (assente da ogni response model).
- Test integrazione: il segreto non compare in nessuna risposta; `PUT` senza `secret` preserva il valore cifrato; un utente non può leggere/scrivere i connettori di un altro (403/404).

---

## STORY-E5-4 — UI profilo connettori

- **Stato**: ⬜ Todo
- **Tipo**: Frontend
- **Dipende da**: STORY-E5-3

**Obiettivo**: l'utente configura i propri connettori da una schermata di profilo.

**Criteri di accettazione**:
- Schermata profilo con un riquadro per servizio: campo `account_identifier` (testo normale, valorizzato dal `GET`) + campo segreto `type=password` write-only con placeholder tipo "•••• già configurato" quando `configured` è true.
- Salvataggio invia `secret` solo se l'utente lo digita; altrimenti aggiorna il solo identificativo.
- Stato per connettore: "configurato" / "non configurato" / "da aggiornare" (vedi STORY-E5-5).
- Stato asincrono via TanStack Query (`@tanstack/react-query`), con invalidazione dopo il salvataggio.

---

## STORY-E5-5 — Stato "token da aggiornare" su errore di autenticazione

- **Stato**: ⬜ Todo
- **Tipo**: Backend + Frontend
- **Dipende da**: STORY-E5-3

**Obiettivo**: un segreto non più valido è segnalato chiaramente all'utente.

**Criteri di accettazione**:
- Quando un import riceve `401` dal backend esterno (E8), il connettore è marcato "da aggiornare".
- Il profilo mostra un banner di warning sul connettore interessato, invitando a sostituire la credenziale.
- Allineato allo scenario E2E `E2E__EXPIRED` ([`004-e2e-test-plan.md`](../specs/004-e2e-test-plan.md) #12).

---

## STORY-E5-6 — Documentazione E5

- **Stato**: ⬜ Todo
- **Tipo**: Docs
- **Dipende da**: STORY-E5-1 … STORY-E5-5

**Obiettivo**: le decisioni implementate in E5 sono coerenti con la documentazione permanente.

**Criteri di accettazione**:
- Coerenza verificata tra `ADR-005`, `docs/specs/001-functional-spec.md` (sezione "Gestione dei token per-utente") e `docs/specs/002-tech-spec-auth-google.md` (variabili `TOKEN_ENCRYPT_KEY`).
- Aggiornata la nota in `ADR-001-H` per puntare ad `ADR-005` come riferimento operativo (sostituzione `token_enc` → `secret_enc` + `account_identifier` + `nonce` + `key_version`).
- Doc utente "Configurare i connettori" in `docs/guides/`.
- `docs/backlog/README.md` aggiornato: storie E5 spostate a "E5 — Completata" dopo merge su `main`.
