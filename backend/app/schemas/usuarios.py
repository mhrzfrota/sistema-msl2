"""Schemas for Usuario entities."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, constr

RoleLiteral = Literal["master", "social_media", "financeiro"]


class UsuarioBase(BaseModel):
    username: constr(strip_whitespace=True, min_length=3, max_length=150)
    nome: str
    role: RoleLiteral
    isActive: bool = True


class UsuarioCreate(UsuarioBase):
    password: str


class UsuarioUpdate(BaseModel):
    nome: str | None = None
    role: RoleLiteral | None = None
    isActive: bool | None = None
    password: str | None = None


class UsuarioOut(UsuarioBase):
    id: int
    createdAt: datetime
    updatedAt: datetime

    class Config:
        orm_mode = True


class UsuarioAuthOut(BaseModel):
    id: int
    username: str
    nome: str
    role: RoleLiteral

    class Config:
        orm_mode = True


class UsuarioLogin(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UsuarioAuthOut
