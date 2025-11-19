"""Pydantic schemas for API payloads."""

from .clientes import ClienteBase, ClienteCreate, ClienteOut, ClienteUpdate
from .secretarias import SecretariaBase, SecretariaCreate, SecretariaOut, SecretariaUpdate
from .tipos_peca import TipoPecaBase, TipoPecaCreate, TipoPecaOut, TipoPecaUpdate
from .pecas import PecaBase, PecaCreate, PecaOut, PecaUpdate
from .relatorios import RelatorioInfo, RelatorioLinha, RelatorioResponse, RelatorioStats
from .usuarios import (
    TokenResponse,
    UsuarioAuthOut,
    UsuarioBase,
    UsuarioCreate,
    UsuarioLogin,
    UsuarioOut,
    UsuarioUpdate,
)

__all__ = [
    "ClienteBase",
    "ClienteCreate",
    "ClienteUpdate",
    "ClienteOut",
    "SecretariaBase",
    "SecretariaCreate",
    "SecretariaUpdate",
    "SecretariaOut",
    "TipoPecaBase",
    "TipoPecaCreate",
    "TipoPecaUpdate",
    "TipoPecaOut",
    "PecaBase",
    "PecaCreate",
    "PecaUpdate",
    "PecaOut",
    "UsuarioBase",
    "UsuarioCreate",
    "UsuarioLogin",
    "UsuarioUpdate",
    "UsuarioOut",
    "UsuarioAuthOut",
    "TokenResponse",
    "RelatorioInfo",
    "RelatorioStats",
    "RelatorioLinha",
    "RelatorioResponse",
]
