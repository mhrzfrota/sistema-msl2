"""Password hashing, JWT helpers, and permission dependencies."""

from datetime import datetime, timedelta
from typing import Any, Callable, Dict, Iterable, Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.models import Usuario

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=not settings.auth_disabled)

ROLE_PERMISSIONS: Dict[str, Dict[str, bool]] = {
    "master": {
        "podeInserir": True,
        "podeEditar": True,
        "podeDeletar": True,
        "podeRelatorio": True,
        "podeAdmin": True,
        "podeConfig": True,
    },
    "social_media": {
        "podeInserir": True,
        "podeEditar": True,
        "podeDeletar": False,
        "podeRelatorio": False,
        "podeAdmin": False,
        "podeConfig": False,
    },
    "financeiro": {
        "podeInserir": False,
        "podeEditar": True,
        "podeDeletar": False,
        "podeRelatorio": True,
        "podeAdmin": False,
        "podeConfig": False,
    },
}


def _default_admin_user() -> Usuario:
    """Return a mock master user when auth is disabled."""
    return Usuario(
        id=0,
        username="dev-admin",
        nome="Administrador (modo teste)",
        password_hash="",
        role="master",
        is_active=True,
    )


# Password helpers -----------------------------------------------------------

def hash_password(plain_password: str) -> str:
    return pwd_context.hash(plain_password)


def verify_password(plain_password: str, password_hash: str) -> bool:
    return pwd_context.verify(plain_password, password_hash)


# JWT helpers ----------------------------------------------------------------

def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(hours=2))
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.jwt_secret, algorithm=settings.jwt_algorithm)
    return encoded_jwt


def decode_token(token: str) -> Dict[str, Any]:
    return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])


# Dependencies ---------------------------------------------------------------

def get_current_user(
    token: str | None = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> Usuario:
    if settings.auth_disabled:
        return _default_admin_user()

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Credenciais inválidas.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not token:
        raise credentials_exception
    try:
        payload = decode_token(token)
    except JWTError as exc:  # pragma: no cover - depends on runtime token
        raise credentials_exception from exc

    username: str | None = payload.get("sub")
    if not username:
        raise credentials_exception

    user = db.query(Usuario).filter(Usuario.username == username).first()
    if not user:
        raise credentials_exception
    if not user.is_active:
        raise credentials_exception
    return user


def require_role(roles: Iterable[str]) -> Callable[[Usuario], Usuario]:
    def dependency(user: Usuario = Depends(get_current_user)) -> Usuario:
        if user.role not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso negado.")
        return user

    return dependency


def require_permission(permission: str) -> Callable[[Usuario], Usuario]:
    def dependency(user: Usuario = Depends(get_current_user)) -> Usuario:
        role_perms = ROLE_PERMISSIONS.get(user.role, {})
        if not role_perms.get(permission, False):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permissão insuficiente.")
        return user

    return dependency
