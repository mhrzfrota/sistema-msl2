"""API routers for domain resources."""

from .auth import router as auth_router
from .clientes import router as clientes_router
from .pecas import router as pecas_router
from .relatorios import router as relatorios_router
from .secretarias import router as secretarias_router
from .tipos_peca import router as tipos_peca_router
from .usuarios import router as usuarios_router

__all__ = [
    "auth_router",
    "clientes_router",
    "pecas_router",
    "relatorios_router",
    "secretarias_router",
    "tipos_peca_router",
    "usuarios_router",
]
