"""Geração de relatórios de peças."""

from datetime import date
from typing import Any, Dict, List, Optional, Tuple

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.security import require_permission
from app.models import Cliente, Peca, Secretaria, TipoPeca
from app.schemas import RelatorioInfo, RelatorioLinha, RelatorioResponse, RelatorioStats

router = APIRouter(prefix="/api/relatorios", tags=["Relatórios"])


@router.get(
    "/pecas",
    response_model=RelatorioResponse,
    dependencies=[Depends(require_permission("podeRelatorio"))],
)
def relatorio_pecas(
    cliente: Optional[str] = Query(None),
    secretaria: Optional[str] = Query(None),
    dataInicio: date = Query(..., description="Data inicial obrigatória"),
    dataFim: date = Query(..., description="Data final obrigatória"),
    db: Session = Depends(get_db),
) -> RelatorioResponse:
    if dataInicio > dataFim:
        raise HTTPException(status_code=400, detail="A data inicial não pode ser maior que a final.")

    query = (
        db.query(Peca)
        .join(Peca.cliente)
        .join(Peca.secretaria)
        .join(Peca.tipo_peca)
        .options(
            joinedload(Peca.cliente),
            joinedload(Peca.secretaria),
            joinedload(Peca.tipo_peca),
        )
        .filter(Peca.data_criacao >= dataInicio)
        .filter(Peca.data_criacao <= dataFim)
        .order_by(Peca.data_cadastro.asc(), Peca.id.asc())
    )

    if cliente:
        query = query.filter(func.lower(Cliente.nome) == func.lower(cliente.strip()))
    if secretaria:
        query = query.filter(func.lower(Secretaria.nome) == func.lower(secretaria.strip()))

    pecas = query.all()

    total_pecas = len(pecas)
    secretarias_unicas = len({peca.secretaria.nome for peca in pecas})

    linhas: List[Dict[str, Any]] = []
    linhas_index: Dict[Tuple[str, str, str], Dict[str, Any]] = {}

    for peca in pecas:
        key = (peca.secretaria.nome, peca.tipo_peca.nome, peca.nome_peca)
        if key not in linhas_index:
            entry: Dict[str, Any] = {
                "secretaria": peca.secretaria.nome,
                "tipoPeca": peca.tipo_peca.nome,
                "nomePeca": peca.nome_peca,
                "dataCriacao": peca.data_criacao,
                "dataVeiculacao": peca.data_veiculacao,
                "quantidade": 0,
            }
            linhas_index[key] = entry
            linhas.append(entry)

        entry = linhas_index[key]
        if peca.data_criacao < entry["dataCriacao"]:
            entry["dataCriacao"] = peca.data_criacao
        if entry["dataVeiculacao"] is None and peca.data_veiculacao is not None:
            entry["dataVeiculacao"] = peca.data_veiculacao
        entry["quantidade"] = int(entry["quantidade"]) + 1

    relatorio = RelatorioResponse(
        info=RelatorioInfo(
            cliente=cliente,
            secretaria=secretaria,
            dataInicio=dataInicio,
            dataFim=dataFim,
        ),
        stats=RelatorioStats(totalPecas=total_pecas, totalSecretarias=secretarias_unicas),
        linhas=[RelatorioLinha(**linha) for linha in linhas],
    )

    return relatorio
