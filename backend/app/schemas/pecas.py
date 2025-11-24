"""Schemas for Peca entities."""

import base64
from datetime import date, datetime

from pydantic import BaseModel, validator

MAX_COMPROVATION_BYTES = 5 * 1024 * 1024  # 5MB


def _validate_comprovacao(value: str) -> str:
    if not value:
        raise ValueError("Comprovação é obrigatória.")

    payload = value
    if value.startswith("data:"):
        header, _, data_part = value.partition(",")
        if not header.lower().startswith("data:image/"):
            raise ValueError("A comprovação deve ser uma imagem (data URL).")
        payload = data_part

    try:
        decoded = base64.b64decode(payload, validate=True)
    except (ValueError, base64.binascii.Error) as exc:  # pragma: no cover - depends on user input
        raise ValueError("Comprovação deve ser um base64 válido.") from exc

    if len(decoded) > MAX_COMPROVATION_BYTES:
        raise ValueError("Comprovação deve ter no máximo 5MB.")

    return value


class PecaBase(BaseModel):
    cliente: str
    secretaria: str
    tipoPeca: str
    nomePeca: str
    dataCriacao: date
    dataVeiculacao: date | None = None
    observacao: str | None = None
    comprovacao: str


class PecaCreate(PecaBase):
    @validator("comprovacao")
    def comprovacao_is_valid(cls, value: str) -> str:  # noqa: N805 - Pydantic validator signature
        return _validate_comprovacao(value)


class PecaUpdate(BaseModel):
    cliente: str | None = None
    secretaria: str | None = None
    tipoPeca: str | None = None
    nomePeca: str | None = None
    dataCriacao: date | None = None
    dataVeiculacao: date | None = None
    observacao: str | None = None
    comprovacao: str | None = None

    @validator("comprovacao")
    def comprovacao_is_valid(cls, value: str | None) -> str | None:  # noqa: N805 - Pydantic validator signature
        if value is None:
            return value
        return _validate_comprovacao(value)


class PecaOut(PecaBase):
    id: int
    dataCadastro: datetime
    comprovacao: str | None = None
    hasComprovacao: bool = True

    class Config:
        orm_mode = True
