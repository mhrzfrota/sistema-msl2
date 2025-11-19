"""Schemas for Secretaria entities."""

from datetime import datetime

from pydantic import BaseModel


class SecretariaBase(BaseModel):
    nome: str
    clienteId: int


class SecretariaCreate(SecretariaBase):
    pass


class SecretariaUpdate(BaseModel):
    nome: str | None = None
    clienteId: int | None = None


class SecretariaOut(SecretariaBase):
    id: int
    createdAt: datetime
    updatedAt: datetime

    class Config:
        orm_mode = True
