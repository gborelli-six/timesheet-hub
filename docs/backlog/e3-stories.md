# E3 — Autenticazione & identità: dettaglio storie

> Implementa il flusso Google OAuth completo: Google OAuth `hd=sixfeetup.it`, cookie `httpOnly/SameSite=Strict` (8h), JWT con claim `role`. Crea e possiede la tabella `users`. Riusa lo scaffolding di E2: `TimestampMixin` (ADR-004), workflow Alembic (STORY-012), `require_role` / `get_current_user` (STORY-013).
>
> Spec tecnica: [`002-tech-spec-auth-google.md`](../specs/002-tech-spec-auth-google.md). ADR rilevanti: ADR-001-D/E/F, ADR-003, ADR-004.
>
> **Nota sugli ID**: STORY-017…023 riprendono subito dopo E2 (termina a STORY-016). E4 occuperà i numeri immediatamente successivi; E5 ha ID `STORY-E5-N` provvisori da rinumerare all'inserimento in sprint.

---

## STORY-017 — Modello `User` + migrazione `0002_create_users`

- **Stato**: ⬜ Todo
- **Tipo**: Backend
- **Dipende da**: STORY-012

**Obiettivo**: la tabella `users` esiste nel DB e sarà la sorgente dell'identità per tutti gli endpoint successivi.

**Criteri di accettazione**:
- Modello `User` in `backend/app/models/user.py` che eredita `TimestampMixin`:
  - `id`: `UUID`, PK, `default=uuid4`, `server_default` non necessario (generato lato Python)
  - `email`: `String(255)`, `unique=True`, `nullable=False`
  - `name`: `String(255)`, `nullable=True`
  - `role`: enum nativo `user_role_enum` (valori: `employee`, `hr`, `admin`), `nullable=False`, default `employee` — naming convention `%(table_name)s_%(column_0_name)s_enum` (ADR-004-B)
- Modello registrato in `backend/app/models/__init__.py` così che `Base.metadata` e Alembic `--autogenerate` lo vedano.
- Migrazione `backend/alembic/versions/0002_create_users.py` con `upgrade` e `downgrade` reversibili:
  - `upgrade`: crea enum nativo, crea tabella `users`
  - `downgrade`: dropa tabella `users`, dropa enum nativo
  - Checklist STORY-012: reversibilità verificata, `downgrade` implementato, nessun dato distrutto senza WARNING, tipi Postgres compatibili

---

## STORY-018 — JWT reale (`create_jwt` / `decode_jwt`) + `get_current_user` da cookie

- **Stato**: ⬜ Todo
- **Tipo**: Backend
- **Dipende da**: STORY-013, STORY-017

**Obiettivo**: il sistema emette e verifica JWT HS256 firmati con `JWT_SECRET`; il middleware RBAC legge l'identità dal cookie `session` invece che dall'header `Authorization: Bearer`.

**Criteri di accettazione**:
- `PyJWT>=2.8` aggiunto a `backend/pyproject.toml`.
- In `backend/app/core/security.py` (oggi stub):
  - `create_jwt(payload: dict, expires_hours: int = 8) -> str`: aggiunge `exp` e `iat`, firma con `settings.JWT_SECRET`, algoritmo `HS256`
  - `decode_jwt(token: str) -> dict`: verifica firma e scadenza; solleva `jwt.ExpiredSignatureError` o `jwt.InvalidTokenError` su token non valido
- `get_current_user` in `backend/app/core/rbac.py` aggiornato:
  - Legge da `Cookie: session` (parametro `session: str | None = Cookie(default=None)`) invece di `Authorization: Bearer`
  - Chiama `decode_jwt(session)`, restituisce `CurrentUser`
  - Token assente → 401; token scaduto → 401 con detail `"Session expired"`; token invalido → 401
- I test integrazione RBAC esistenti (STORY-014) continuano a passare (aggiornare se necessario la forgiatura del JWT di test per usare `create_jwt` o passare direttamente il cookie)

---

## STORY-019 — Router OAuth (`/login`, `/callback`, `/logout`) + `GET /api/me`

- **Stato**: ⬜ Todo
- **Tipo**: Backend
- **Dipende da**: STORY-017, STORY-018

**Obiettivo**: il flusso OAuth Google è completamente implementato lato backend; l'identità utente è upsertata su `users` e restituita come JWT nel cookie di sessione.

**Criteri di accettazione**:
- `google-auth>=2.0` aggiunto a `backend/pyproject.toml`.
- Nuovo file `backend/app/routers/auth.py` montato sotto `/api/auth` in `backend/app/main.py`:
  - `GET /api/auth/login`: costruisce redirect URL Google con `client_id`, `redirect_uri`, `scope="openid email profile"`, `hd="sixfeetup.it"`, `state=secrets.token_urlsafe(32)`, risponde `302`
  - `POST /api/auth/callback`: riceve `{code: str, state: str}`, scambia `code` con Google (`POST https://oauth2.googleapis.com/token`), verifica `id_token` con `google.oauth2.id_token.verify_oauth2_token`, verifica `claims["hd"] == "sixfeetup.it"` (403 se no), upsert su `users` (`email`, `name` da claims), `create_jwt({sub, email, role})`, `Set-Cookie: session=<jwt> HttpOnly Secure SameSite=Strict Max-Age=28800 Path=/`, risponde `{"ok": True}`
  - `GET /api/auth/logout`: `delete_cookie("session", path="/")`, redirect `302` a `/login`
- `GET /api/me` in `backend/app/routers/users.py`: usa `Depends(get_current_user)`, risponde `{"email": user.email, "role": user.role}` senza query DB
- Nuove variabili d'ambiente aggiunte a `backend/app/core/config.py` (Settings): `GOOGLE_CLIENT_ID: str`, `GOOGLE_CLIENT_SECRET: str`, `GOOGLE_REDIRECT_URI: str`, `JWT_SECRET: str`
- `.env.example` aggiornato con le nuove variabili (valori placeholder)

---

## STORY-020 — Endpoint test-only `POST /api/_test/session` + E2E storageState per-ruolo

- **Stato**: ⬜ Todo
- **Tipo**: Backend + E2E
- **Dipende da**: STORY-019

**Obiettivo**: i test E2E possono autenticarsi senza passare per Google OAuth reale; lo scenario #1 (Auth/Smoke P0) è verde per tutti e 3 i ruoli.

**Criteri di accettazione**:
- In `backend/app/routers/e2e_test_router.py` (già esistente, guardia `E2E_TEST_MODE`):
  - `POST /api/_test/session`: riceve `{"role": "employee" | "hr" | "admin", "email": str}`, crea `CurrentUser` sintetico, chiama `create_jwt({sub: "test-<role>", email, role})`, imposta `Set-Cookie: session=<jwt>` identico a `/api/auth/callback`, risponde `{"ok": True}`
- In `e2e/` (Playwright):
  - Fixture `loginAs(role)` (o `globalSetup`) chiama `POST /api/_test/session` con `request.post(...)`, verifica il cookie impostato
  - `storageState` per-ruolo salvato in `e2e/fixtures/storageState/{role}.json` (gitignored o generato a runtime prima della suite)
  - Test `e2e/tests/rbac.spec.ts` (già esistente per STORY-015) aggiornato per usare storageState reale invece del bypass precedente
- Nuovo file `e2e/tests/auth.spec.ts`:
  - Scenario #1 (P0): per ciascun ruolo (`employee`, `hr`, `admin`) → `loginAs(role)` → naviga a `/` → verifica che la dashboard sia caricata (assenza di redirect a `/login`)

---

## STORY-021 — Test integrazione & unit E3

- **Stato**: ⬜ Todo
- **Tipo**: Test
- **Dipende da**: STORY-017, STORY-018, STORY-019

**Obiettivo**: la CI verifica le invarianti di sicurezza del flusso OAuth senza dipendere da Google reale.

**Criteri di accettazione**:
- Test unit in `backend/tests/unit/test_security.py`:
  - `create_jwt` + `decode_jwt` round-trip restituisce il payload originale
  - Token scaduto (exp nel passato) → `jwt.ExpiredSignatureError`
  - Token con firma alterata → `jwt.InvalidTokenError`
- Test unit in `backend/tests/unit/test_user_model.py`:
  - `upsert_user(db, email, name)` crea nuovo utente se non esiste
  - Seconda chiamata con stesso `email` aggiorna `name` senza duplicare la riga
- Test integrazione in `backend/tests/integration/test_auth.py`:
  - `POST /api/auth/callback` con `verify_google_id_token` monkeypatched → 200 + cookie `session` presente
  - `POST /api/auth/callback` con `hd` errato (es. `"gmail.com"`) nel mock → 403
  - `GET /api/me` con cookie valido → 200 `{email, role}`
  - `GET /api/me` senza cookie → 401
  - `GET /api/auth/logout` con cookie → 302 a `/login` + cookie cancellato

---

## STORY-022 — Frontend auth (LoginPage, CallbackPage, useAuth, AuthGuard, apiClient)

- **Stato**: ⬜ Todo
- **Tipo**: Frontend
- **Dipende da**: STORY-019

**Obiettivo**: il flusso di login è completo lato browser; le route autenticate redirigono a `/login` se la sessione è assente o scaduta.

**Criteri di accettazione**:
- `@tanstack/react-query>=5.0` e `react-router-dom>=6.0` presenti in `frontend/package.json` (probabilmente già presenti; verificare)
- `frontend/src/lib/apiClient.ts`: wrapper `fetch` con `credentials: 'include'` su ogni richiesta; su risposta `401` chiama `queryClient.clear()` e `window.location.href = '/login'`
- `frontend/src/hooks/useAuth.ts`: `useQuery({ queryKey: ['me'], queryFn: () => apiClient.get('/api/me'), retry: false, staleTime: 5 * 60 * 1000 })`
- `frontend/src/components/AuthGuard.tsx`: se `isLoading` → spinner; se `isError` → `<Navigate to="/login" replace />`; altrimenti renderizza children
- `frontend/src/pages/LoginPage.tsx`: bottone "Accedi con Google" → `window.location.href = '/api/auth/login'`
- `frontend/src/pages/CallbackPage.tsx`: estrae `code` e `state` da `useSearchParams`, chiama `apiClient.post('/api/auth/callback', {code, state})`, naviga a `/`; su errore mostra `role="alert"` con messaggio dominio non autorizzato; usa `useRef(false)` per evitare doppia esecuzione in StrictMode
- Router in `frontend/src/App.tsx` (o equivalente): `/login` e `/auth/callback` fuori da `AuthGuard`; `/*` dentro `AuthGuard`

---

## STORY-023 — Documentazione funzionale E3

- **Stato**: ⬜ Todo
- **Tipo**: Docs
- **Dipende da**: STORY-017, STORY-018, STORY-019, STORY-020, STORY-021, STORY-022

**Obiettivo**: le decisioni implementate in E3 sono tracciate in modo permanente; l'utente finale sa come accedere.

**Criteri di accettazione**:
- `docs/specs/002-tech-spec-auth-google.md` aggiornato: sezione "Decisioni aperte" chiusa per i punti implementati; stato documento aggiornato da "Bozza" a "Implementata"
- ADR-001 sezioni D, E, F marcate come implementate (o nota di implementazione aggiunta)
- `docs/guides/` — nuovo file `accesso-e-login.md` con:
  - Come accedere (ruolo Employee / HR / Admin): apri URL app → "Accedi con Google" → usa account `@sixfeetup.it`
  - Cosa succede alla scadenza (8h): redirect automatico al login, nessun dato perso
  - Come fare logout: voce menu o URL `/api/auth/logout`
- `docs/backlog/README.md` aggiornato: storie E3 spostate a "E3 — Completata" dopo merge su `main` (per ora rimane come sezione Todo)
