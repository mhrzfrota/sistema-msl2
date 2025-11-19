"""Schemas for Cliente entities."""

from datetime import datetime

from pydantic import BaseModel


class ClienteBase(BaseModel):
    nome: str


class ClienteCreate(ClienteBase):
    pass


class ClienteUpdate(BaseModel):
    nome: str | None = None


class ClienteOut(ClienteBase):
    id: int
    createdAt: datetime
    updatedAt: datetime

    class Config:
        orm_mode = True
