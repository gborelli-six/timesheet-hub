# 005 — Spec Tecnica RBAC

- **Versione**: 1.0
- **Data**: 2026-06-28
- **Contesto**: STORY-013 / STORY-016 (E2 — Fondamenta dati & autorizzazione)
- **Riferimenti**: `backend/app/core/rbac.py`, ADR-001-D, ADR-001-E

---

## Overview

Timesheet Hub usa un RBAC statico a tre ruoli. Ogni endpoint protetto dichiara i ruoli
ammessi tramite `Depends(require_role([...]))` — una FastAPI Dependency che verifica il JWT
presente nell'header `Authorization: Bearer <token>`.

La struttura è definitiva come contratto di interfaccia; il JWT decode reale (JWKS Google)
è implementato in E3. In E2 il decode usa HS256 con `JWT_SECRET` da `settings`.

---

## Ruoli

| Ruolo | Descrizione |
|-------|-------------|
| `employee` | Dipendente — può caricare e vedere solo i propri timesheet |
| `hr` | HR Manager — può caricare timesheet per conto di qualsiasi dipendente |
| `admin` | Amministratore — gestisce utenti, backend config, mapping colonne |

I ruoli sono definiti come `StrEnum` in `backend/app/core/rbac.py`:

```python
class UserRole(StrEnum):
    employee = "employee"
    hr = "hr"
    admin = "admin"
```

---

## Tabella permessi (stato E2)

| Endpoint | employee | hr | admin | Note |
|----------|----------|----|-------|------|
| `GET /health` | ✅ | ✅ | ✅ | Pubblico, nessun token richiesto |
| `GET /users/me` | ✅ | ✅ | ✅ | Qualsiasi ruolo autenticato |
| `POST /_test/session` | — | — | — | Solo in `E2E_TEST_MODE`, stub in E2 |
| (E3+) `GET /auth/login` | — | — | — | Pubblico, redirect Google |
| (E3+) `POST /auth/callback` | — | — | — | Pubblico, scambio code → JWT |
| (E3+) `POST /imports` | ✅ | ✅ | ✅ | Upload proprio timesheet |
| (E3+) `POST /imports?for=<email>` | ❌ | ✅ | ✅ | Upload per conto terzi |
| (E3+) `GET /admin/*` | ❌ | ❌ | ✅ | Solo admin |

Aggiornare questa tabella ad ogni nuovo endpoint protetto.

---

## Struttura JWT attesa

```
Authorization: Bearer <token>
```

**Payload minimo** (HS256 in E2, RS256 JWKS Google in E3):

```json
{
  "email": "user@sixfeetup.it",
  "role": "employee",
  "exp": 1234567890
}
```

**Chiave**: `settings.jwt_secret` (variabile `JWT_SECRET` nell'ambiente).

In E3 la verifica passerà alle chiavi pubbliche JWKS di Google (`hd=sixfeetup.it` obbligatorio).

---

## Pattern `require_role`

```
Request
  └─► require_role(["hr", "admin"])          ← dichiarato nell'endpoint
        └─► get_current_user(credentials)    ← estrae e verifica JWT
              ├─ nessun token          → 401 Unauthorized
              ├─ token malformato      → 401 Unauthorized
              ├─ token scaduto         → 401 Unauthorized
              └─ token valido
                    ├─ role non in lista → 403 Forbidden
                    └─ role in lista     → CurrentUser restituito
```

**Risposte di errore**:

| Caso | Status | Body |
|------|--------|------|
| Token assente | `401 Unauthorized` | `{"detail": "Not authenticated"}` |
| Token malformato o firma errata | `401 Unauthorized` | `{"detail": "Invalid token"}` |
| Token scaduto | `401 Unauthorized` | `{"detail": "Invalid token"}` |
| Role non ammesso | `403 Forbidden` | `{"detail": "Insufficient permissions"}` |

---

## Come aggiungere un endpoint protetto

1. **Importare** `require_role` e `CurrentUser` da `app.core.rbac`:

   ```python
   from app.core.rbac import require_role, CurrentUser
   ```

2. **Dichiarare il Dependency** nella firma della funzione:

   ```python
   @router.get("/my-resource")
   def get_resource(
       user: CurrentUser = Depends(require_role(["hr", "admin"])),
   ) -> dict:
       return {"accessed_by": user.email}
   ```

3. **Aggiornare la tabella permessi** in questo documento (sezione "Tabella permessi").

4. **Scrivere i test** in `backend/tests/integration/` (vedi STORY-014):
   - `Bearer` valido + ruolo corretto → `2xx`
   - `Bearer` valido + ruolo non ammesso → `403`
   - Nessun token → `401`
   - Token malformato → `401`

---

## File di riferimento

| File | Contenuto |
|------|-----------|
| `backend/app/core/rbac.py` | `UserRole`, `CurrentUser`, `get_current_user`, `require_role` |
| `backend/app/routers/users.py` | Esempio endpoint protetto (`GET /users/me`) |
| `backend/app/core/config.py` | `settings.jwt_secret` |
| `backend/tests/unit/test_rbac.py` | Test unitari RBAC (6 casi) |
