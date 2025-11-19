"""Schemas for TipoPeca entities."""

from datetime import datetime

from pydantic import BaseModel


class TipoPecaBase(BaseModel):
    nome: str


class TipoPecaCreate(TipoPecaBase):
    pass


class TipoPecaUpdate(BaseModel):
    nome: str | None = None


class TipoPecaOut(TipoPecaBase):
    id: int
    createdAt: datetime
    updatedAt: datetime

    class Config:
        orm_mode = True
