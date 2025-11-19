"""Schemas para respostas de relatórios."""

from datetime import date
from typing import List, Optional

from pydantic import BaseModel


class RelatorioInfo(BaseModel):
    cliente: Optional[str]
    secretaria: Optional[str]
    dataInicio: date
    dataFim: date


class RelatorioStats(BaseModel):
    totalPecas: int
    totalSecretarias: int


class RelatorioLinha(BaseModel):
    secretaria: str
    tipoPeca: str
    nomePeca: str
    dataCriacao: date
    dataVeiculacao: Optional[date] = None
    quantidade: int


class RelatorioResponse(BaseModel):
    info: RelatorioInfo
    stats: RelatorioStats
    linhas: List[RelatorioLinha]

    class Config:
        orm_mode = True
