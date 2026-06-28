import secrets
from typing import Annotated
from urllib.parse import urlencode

import requests as http_requests
from fastapi import APIRouter, Cookie, Depends, HTTPException, Response, status
from fastapi.responses import RedirectResponse
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import create_jwt
from app.db.session import get_db
from app.models.user import upsert_user

router = APIRouter(prefix="/auth", tags=["auth"])

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
REQUIRED_HD = "sixfeetup.it"


class CallbackRequest(BaseModel):
    code: str
    state: str


@router.get("/login", status_code=302)
def login() -> RedirectResponse:
    state = secrets.token_urlsafe(32)
    params = {
        "client_id": settings.google_client_id,
        "redirect_uri": settings.google_redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "hd": REQUIRED_HD,
        "state": state,
    }
    url = f"{GOOGLE_AUTH_URL}?{urlencode(params)}"
    redirect = RedirectResponse(url, status_code=302)
    # Persiste lo state per la verifica anti-CSRF in /callback.
    redirect.set_cookie(
        key="oauth_state",
        value=state,
        httponly=True,
        secure=True,
        samesite="strict",
        max_age=600,
        path="/",
    )
    return redirect


@router.post("/callback")
def callback(
    body: CallbackRequest,
    response: Response,
    oauth_state: Annotated[str | None, Cookie()] = None,
    db: Session = Depends(get_db),
) -> dict:
    # Verifica anti-CSRF: lo state nel body deve combaciare col cookie di /login.
    if not oauth_state or not secrets.compare_digest(oauth_state, body.state):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Parametro state non valido o assente",
        )

    token_resp = http_requests.post(
        GOOGLE_TOKEN_URL,
        data={
            "code": body.code,
            "client_id": settings.google_client_id,
            "client_secret": settings.google_client_secret,
            "redirect_uri": settings.google_redirect_uri,
            "grant_type": "authorization_code",
        },
        timeout=10,
    )
    if not token_resp.ok:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Errore scambio token con Google",
        )
    token_data = token_resp.json()
    id_token_str = token_data.get("id_token")
    if not id_token_str:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="id_token assente nella risposta Google",
        )

    try:
        claims = google_id_token.verify_oauth2_token(
            id_token_str,
            google_requests.Request(),
            settings.google_client_id,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token Google non valido",
        ) from exc

    if claims.get("hd") != REQUIRED_HD:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Dominio non autorizzato. Richiesto: {REQUIRED_HD}",
        )

    user = upsert_user(db, email=claims["email"], name=claims.get("name"))
    jwt_token = create_jwt(
        {"sub": str(user.id), "email": user.email, "role": user.role}
    )
    response.set_cookie(
        key="session",
        value=jwt_token,
        httponly=True,
        secure=True,
        samesite="strict",
        max_age=28800,
        path="/",
    )
    # Lo state è monouso: rimuove il cookie una volta consumato.
    response.delete_cookie("oauth_state", path="/")
    return {"ok": True}


@router.get("/logout", status_code=302)
def logout() -> RedirectResponse:
    redirect = RedirectResponse("/login", status_code=302)
    redirect.delete_cookie("session", path="/")
    return redirect
