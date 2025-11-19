import logging
from datetime import date, datetime

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.routers import (
    auth_router,
    clientes_router,
    pecas_router,
    relatorios_router,
    secretarias_router,
    tipos_peca_router,
    usuarios_router,
)
from app.schemas.pecas import PecaOut

logger = logging.getLogger("app.main")


def create_app() -> FastAPI:
    app = FastAPI(title="MSL Backend", version="0.1.0", debug=settings.app_env == "dev")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/health")
    def health() -> dict[str, str | bool]:
        return {"status": "ok", "authDisabled": settings.auth_disabled}

    @app.get("/db-check")
    def db_check(db: Session = Depends(get_db)) -> dict[str, str]:
        try:
            db.execute(text("SELECT 1"))
        except SQLAlchemyError as exc:
            logger.exception("Database connectivity check failed")
            raise HTTPException(status_code=500, detail="Database connection error") from exc
        return {"database": "ok"}

    @app.get("/pecas/mock", response_model=PecaOut)
    def sample_peca() -> PecaOut:
        """Return a mocked piece structure so the front can validate the payload format."""
        return PecaOut(
            id=0,
            cliente="Cliente Exemplo",
            secretaria="Secretaria Exemplo",
            tipoPeca="Nota",
            nomePeca="Campanha Exemplo",
            dataCriacao=date.today(),
            dataVeiculacao=None,
            observacao=None,
            comprovacao="BASE64_PLACEHOLDER",
            dataCadastro=datetime.utcnow(),
        )

    app.include_router(auth_router)
    app.include_router(clientes_router)
    app.include_router(pecas_router)
    app.include_router(relatorios_router)
    app.include_router(secretarias_router)
    app.include_router(tipos_peca_router)
    app.include_router(usuarios_router)

    return app


app = create_app()
