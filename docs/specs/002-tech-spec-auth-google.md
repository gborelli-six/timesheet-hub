# TECH-SPEC-002 — Autenticazione Google OAuth

| Campo | Valore |
|---|---|
| ID | TECH-SPEC-002 |
| Titolo | Autenticazione Google OAuth: componenti, flusso e configurazione |
| Versione | 0.1 |
| Stato | Bozza |
| Data | 2026-05-28 |
| Autori | 6feetup Engineering |
| Riferimenti | ADR-001-D, ADR-001-E, ADR-001-F |

---

## Scopo

Questo documento dettaglia l'implementazione dell'autenticazione Google OAuth per Timesheet Hub. Le decisioni architetturali (scelta di Google OAuth, cookie httpOnly, vincolo di dominio, topologia nginx) sono già motivate in ADR-001-D/E/F, qui non vengono ridiscusse. L'obiettivo è fornire una specifica implementativa sufficiente a sviluppare e configurare il sistema senza ambiguità.

---

## Componenti Frontend

### `LoginPage`

Pagina minimale, non autenticata. Contiene un singolo bottone che avvia il flusso OAuth.

```tsx
// src/pages/LoginPage.tsx
export function LoginPage() {
  const handleLogin = () => {
    window.location.href = '/api/auth/login';
  };

  return (
    <button onClick={handleLogin}>
      Accedi con Google
    </button>
  );
}
```

Non gestisce token, non scrive in storage. Il redirect è navigazione intera (`window.location.href`), non una chiamata `fetch`, perché il browser deve seguire la catena di redirect verso Google.

---

### `useAuth` hook

Fonte di verità dell'identità nel client. Chiama `GET /api/me` all'avvio tramite React Query.

```tsx
// src/hooks/useAuth.ts
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/apiClient';

interface User {
  email: string;
  role: 'employee' | 'hr' | 'admin';
}

export function useAuth() {
  return useQuery<User>({
    queryKey: ['me'],
    queryFn: () => apiClient.get('/api/me'),
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minuti
  });
}
```

---

### `AuthGuard`

Wrapper che protegge le route autenticate. Se `useAuth` restituisce `401`, redirige a `/login`.

```tsx
// src/components/AuthGuard.tsx
import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { data: user, isLoading, isError } = useAuth();

  if (isLoading) return <LoadingSpinner />;
  if (isError) return <Navigate to="/login" replace />;

  return <>{children}</>;
}
```

---

### `apiClient`

Wrapper globale di `fetch` con `credentials: 'include'` impostato su ogni richiesta. Gestisce la risposta `401` invalidando la cache di React Query.

```tsx
// src/lib/apiClient.ts
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient();

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...options,
    credentials: 'include', // invia sempre il cookie di sessione
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (res.status === 401) {
    queryClient.clear();
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export const apiClient = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
};
```

---

## Componenti Backend

### `GET /auth/login`

Costruisce il redirect URL verso Google e risponde con `302`.

```python
# app/routers/auth.py
import secrets
from fastapi import APIRouter, Response
from fastapi.responses import RedirectResponse
from app.config import settings

router = APIRouter(prefix="/auth")

@router.get("/login")
def login(response: Response):
    state = secrets.token_urlsafe(32)
    # In produzione: salva state in cache/sessione temporanea per verifica CSRF
    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": settings.GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": "openid email profile",
        "hd": "sixfeetup.it",          # vincolo dominio Google (UX)
        "state": state,
        "access_type": "online",
    }
    url = "https://accounts.google.com/o/oauth2/v2/auth?" + urlencode(params)
    return RedirectResponse(url)
```

---

### `GET /auth/callback`

Gestisce il redirect di ritorno da Google. È il cuore del flusso OAuth.

```python
@router.get("/callback")
async def callback(code: str, state: str, db: Session = Depends(get_db)):
    # 1. Verifica state (CSRF)
    verify_state(state)  # solleva 400 se non valido

    # 2. Scambia code con token Google
    token_response = await exchange_code(code)
    id_token = token_response["id_token"]

    # 3. Decodifica e verifica id_token con chiavi pubbliche Google (JWKS)
    claims = verify_google_id_token(id_token, settings.GOOGLE_CLIENT_ID)

    # 4. Verifica hd claim (sicurezza, non solo UX)
    if claims.get("hd") != "sixfeetup.it":
        return RedirectResponse("/login?error=unauthorized_domain", status_code=302)

    # 5. Upsert utente nel DB
    user = upsert_user(db, email=claims["email"], name=claims.get("name"))

    # 6. Firma JWT
    jwt_token = create_jwt(
        payload={"sub": str(user.id), "email": user.email, "role": user.role},
        expires_hours=8,
    )

    # 7. Set-Cookie + redirect
    response = RedirectResponse("/", status_code=302)
    response.set_cookie(
        key="session",
        value=jwt_token,
        httponly=True,
        secure=True,
        samesite="strict",
        max_age=28800,  # 8 ore
        path="/",
    )
    return response
```

---

### `GET /auth/logout`

Cancella il cookie di sessione.

```python
@router.get("/logout")
def logout():
    response = RedirectResponse("/login", status_code=302)
    response.delete_cookie("session", path="/")
    return response
```

---

### `GET /me`

Restituisce l'identità dell'utente corrente. Non fa query al DB: legge dal JWT.

```python
# app/routers/users.py
@router.get("/me")
def me(current_user: CurrentUser = Depends(require_auth)):
    return {"email": current_user.email, "role": current_user.role}
```

---

### `JWTMiddleware` / `require_auth`

Dependency FastAPI riutilizzabile su tutti gli endpoint protetti.

```python
# app/dependencies.py
from fastapi import Cookie, HTTPException, Depends
from app.security import decode_jwt

def require_auth(session: str | None = Cookie(default=None)) -> CurrentUser:
    if not session:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = decode_jwt(session)
    except JWTExpiredError:
        raise HTTPException(status_code=401, detail="Session expired")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    return CurrentUser(**payload)

def require_role(*roles: str):
    def _check(user: CurrentUser = Depends(require_auth)):
        if user.role not in roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return user
    return _check

# Utilizzo su un endpoint protetto:
# @router.post("/imports")
# def create_import(user = Depends(require_role("employee", "hr", "admin"))):
#     ...
```

---

### `verify_google_id_token`

Verifica la firma dell'`id_token` usando le chiavi pubbliche Google (JWKS). Da non reimplementare: usare una libreria (`google-auth` per Python).

```python
# app/security.py
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

def verify_google_id_token(token: str, client_id: str) -> dict:
    """
    Verifica firma, scadenza e audience dell'id_token Google.
    Solleva ValueError se non valido.
    """
    claims = id_token.verify_oauth2_token(
        token,
        google_requests.Request(),
        client_id,
    )
    return claims
```

Dipendenza: `pip install google-auth`.

---

### `create_jwt` / `decode_jwt`

```python
import jwt
from datetime import datetime, timedelta, timezone
from app.config import settings

ALGORITHM = "HS256"

def create_jwt(payload: dict, expires_hours: int = 8) -> str:
    data = {
        **payload,
        "exp": datetime.now(timezone.utc) + timedelta(hours=expires_hours),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(data, settings.JWT_SECRET, algorithm=ALGORITHM)

def decode_jwt(token: str) -> dict:
    return jwt.decode(token, settings.JWT_SECRET, algorithms=[ALGORITHM])
```

Dipendenza: `pip install PyJWT`.

---

## Sequence Diagram

```
Browser          Nginx            Backend           Google OAuth          DB
   |                |                |                    |                |
   |─GET /auth/login→               |                    |                |
   |                |─proxy_pass───→|                    |                |
   |                |               |─build redirect URL |                |
   |                |               |  (hd=sixfeetup.it,  |                |
   |                |               |   state=signed_tok)|                |
   |←─────────────────── 302 ───────|                    |                |
   |                                                      |                |
   |──── GET accounts.google.com/o/oauth2/v2/auth ──────→|                |
   |                              [consent screen]        |                |
   |←─────────────────── 302 ────────────────────────────|                |
   |  /auth/callback?code=AUTH_CODE&state=...             |                |
   |                |                |                    |                |
   |─GET /auth/callback?code=...────→                    |                |
   |                |─proxy_pass───→|                    |                |
   |                |               |─1. verify state    |                |
   |                |               |─2. POST token endpoint ────────────→|
   |                |               |←── { id_token, access_token } ──────|
   |                |               |─3. verify id_token (JWKS)           |
   |                |               |─4. check hd=="sixfeetup.it"          |
   |                |               |─5. upsert user ──────────────────────────────→|
   |                |               |←──────────────────────── { id, role } ────────|
   |                |               |─6. sign JWT {email, role, exp+8h}   |                |
   |←────────────────── 302 + Set-Cookie: session=JWT ──|                |
   |                    HttpOnly; Secure; SameSite=Strict                  |
   |                    Path=/; Max-Age=28800                              |
   |                |                |                    |                |
   |─GET / ─────────→               |                    |                |
   |                |─serve frontend→                    |                |
   |←── 200 HTML + React bundle ────|                    |                |
   |                                                      |                |
   |─GET /api/me (cookie auto-attached) ─────────────────→               |
   |                |─proxy_pass───→|                    |                |
   |                |               |─JWT middleware: verify + extract role
   |←─────────── 200 { email, role } ───────────────────|                |

Percorso di errore:
  hd ≠ "sixfeetup.it"  →  302 /login?error=unauthorized_domain
  JWT assente/scaduto  →  401 Unauthorized
  ruolo insufficiente  →  403 Forbidden
```

---

## Variabili d'ambiente

| Variabile | Provenienza | Esempio |
|---|---|---|
| `GOOGLE_CLIENT_ID` | Google Cloud Console | `123456789.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | Google Cloud Console | `GOCSPX-...` |
| `GOOGLE_REDIRECT_URI` | config | `https://6feetup-timeshees.up.railway.app/auth/callback` |
| `JWT_SECRET` | generato (256-bit random) | `openssl rand -hex 32` |
| `TOKEN_ENCRYPT_KEY` | generato (AES-256) | `openssl rand -hex 32` |

In sviluppo locale aggiungere:

| Variabile | Valore locale |
|---|---|
| `GOOGLE_REDIRECT_URI` | `http://localhost:8000/auth/callback` |

Gestione: variabili cifrate su Railway oppure Infisical (vedi ADR-001-H). Mai nel repository.

---

## Configurazione Google Cloud Console

### 1. Progetto GCP

Creare (o riutilizzare) un progetto GCP dedicato: **"Timesheet Hub"**.

### 2. OAuth Consent Screen

Percorso: **APIs & Services → OAuth consent screen**

| Campo | Valore | Note |
|---|---|---|
| User Type | **Internal** | Limita accesso al solo Workspace `sixfeetup.it`; nessuna verifica Google richiesta |
| App name | Timesheet Hub | |
| User support email | team IT | |
| Authorized domains | `sixfeetup.it` | |
| Scopes | `openid`, `email`, `profile` | Nessuno scope aggiuntivo necessario |

Con **Internal**, solo gli utenti `@sixfeetup.it` del Google Workspace vedono la consent screen. Il warning "app non verificata" non appare.

### 3. Credenziali OAuth 2.0

Percorso: **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID**

| Campo | Produzione | Sviluppo locale |
|---|---|---|
| Application type | Web application | Web application |
| Authorized JavaScript origins | `https://6feetup-timeshees.up.railway.app` | `http://localhost:5173` |
| Authorized redirect URIs | `https://6feetup-timeshees.up.railway.app/auth/callback` | `http://localhost:8000/auth/callback` |

Annotare **Client ID** e **Client Secret** e caricarli nelle variabili d'ambiente (non nel repository).

### 4. API da abilitare

Nessuna API aggiuntiva richiesta. Le claim necessarie (`email`, `name`, `hd`) sono incluse nell'`id_token` standard senza dover chiamare la Google People API.

### 5. Verifica del vincolo di dominio

Il parametro `hd=sixfeetup.it` nella richiesta verso Google è un controllo UX (filtra il selettore account). La verifica di sicurezza avviene lato backend sulla claim `hd` dell'`id_token` decodificato. Entrambi i controlli sono necessari e indipendenti.

### 6. Rotazione del Client Secret

Quando necessario (ogni 12 mesi o in caso di compromissione):
1. Generare un nuovo secret in **Cloud Console → Credentials**.
2. Aggiornare la variabile `GOOGLE_CLIENT_SECRET` su Railway / Infisical.
3. Rideploy del backend.
4. Il `GOOGLE_CLIENT_ID` non cambia.

---

## Dipendenze

**Backend (Python)**

```
google-auth>=2.0
PyJWT>=2.8
fastapi>=0.111
```

**Frontend (npm)**

```
@tanstack/react-query>=5.0
react-router-dom>=6.0
```

---

## Decisioni aperte

- Strategia di persistenza del `state` anti-CSRF (cache in-memory vs Redis vs cookie firmato separato).
- Gestione del `refresh_token` Google se in futuro si richiedesse accesso offline.
- Comportamento alla scadenza della sessione durante un'importazione in corso (mid-flight).
