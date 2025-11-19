"""SQLAlchemy models package."""

from sqlalchemy.orm import declarative_base

Base = declarative_base()

# Import models so Alembic/metadata can discover them easily
from .clientes import Cliente  # noqa: E402,F401
from .secretarias import Secretaria  # noqa: E402,F401
from .tipos_peca import TipoPeca  # noqa: E402,F401
from .pecas import Peca  # noqa: E402,F401
from .usuarios import Usuario  # noqa: E402,F401

__all__ = [
    "Base",
    "Cliente",
    "Secretaria",
    "TipoPeca",
    "Peca",
    "Usuario",
]
