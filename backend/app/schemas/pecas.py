"""Schemas for Peca entities."""

from datetime import date, datetime

from pydantic import BaseModel


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
    pass


class PecaUpdate(BaseModel):
    cliente: str | None = None
    secretaria: str | None = None
    tipoPeca: str | None = None
    nomePeca: str | None = None
    dataCriacao: date | None = None
    dataVeiculacao: date | None = None
    observacao: str | None = None
    comprovacao: str | None = None


class PecaOut(PecaBase):
    id: int
    dataCadastro: datetime

    class Config:
        orm_mode = True
