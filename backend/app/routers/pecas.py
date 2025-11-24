"""Rotas para CRUD de peças."""

from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.security import get_current_user, require_permission
from app.models import Cliente, Peca, Secretaria, TipoPeca
from app.schemas import PecaCreate, PecaOut, PecaUpdate

router = APIRouter(prefix="/api/pecas", tags=["Peças"])


# Helpers --------------------------------------------------------------------

def _normalize_name(value: str) -> str:
    return value.strip()


def _get_cliente_by_nome(nome: str, db: Session) -> Cliente:
    cliente = (
        db.query(Cliente)
        .filter(func.lower(Cliente.nome) == func.lower(_normalize_name(nome)))
        .first()
    )
    if not cliente:
        raise HTTPException(status_code=400, detail=f"Cliente '{nome}' não encontrado.")
    return cliente


def _get_tipo_by_nome(nome: str, db: Session) -> TipoPeca:
    tipo = (
        db.query(TipoPeca)
        .filter(func.lower(TipoPeca.nome) == func.lower(_normalize_name(nome)))
        .first()
    )
    if not tipo:
        raise HTTPException(status_code=400, detail=f"Tipo de peça '{nome}' não encontrado.")
    return tipo


def _get_secretaria(nome: str, cliente_id: int, db: Session) -> Secretaria:
    secretaria = (
        db.query(Secretaria)
        .filter(Secretaria.cliente_id == cliente_id)
        .filter(func.lower(Secretaria.nome) == func.lower(_normalize_name(nome)))
        .first()
    )
    if not secretaria:
        raise HTTPException(
            status_code=400,
            detail=f"Secretaria '{nome}' não encontrada para o cliente informado.",
        )
    return secretaria


def _serialize_peca(peca: Peca, include_comprovacao: bool = False) -> PecaOut:
    return PecaOut(
        id=peca.id,
        cliente=peca.cliente.nome,
        secretaria=peca.secretaria.nome,
        tipoPeca=peca.tipo_peca.nome,
        nomePeca=peca.nome_peca,
        dataCriacao=peca.data_criacao,
        dataVeiculacao=peca.data_veiculacao,
        observacao=peca.observacao or "",
        comprovacao=peca.comprovacao_base64 if include_comprovacao else None,
        dataCadastro=peca.data_cadastro,
        hasComprovacao=bool(peca.comprovacao_base64),
    )


# Routes ---------------------------------------------------------------------


@router.post(
    "",
    response_model=PecaOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("podeInserir"))],
)
def create_peca(payload: PecaCreate, db: Session = Depends(get_db)) -> PecaOut:
    cliente = _get_cliente_by_nome(payload.cliente, db)
    secretaria = _get_secretaria(payload.secretaria, cliente.id, db)
    tipo = _get_tipo_by_nome(payload.tipoPeca, db)

    peca = Peca(
        cliente_id=cliente.id,
        secretaria_id=secretaria.id,
        tipo_peca_id=tipo.id,
        nome_peca=payload.nomePeca,
        data_criacao=payload.dataCriacao,
        data_veiculacao=payload.dataVeiculacao,
        observacao=payload.observacao,
        comprovacao_base64=payload.comprovacao,
    )
    db.add(peca)
    db.commit()
    db.refresh(peca)
    return _serialize_peca(peca, include_comprovacao=True)


@router.get("", response_model=List[PecaOut], dependencies=[Depends(get_current_user)])
def list_pecas(
    cliente: Optional[str] = Query(None),
    secretaria: Optional[str] = Query(None),
    tipoPeca: Optional[str] = Query(None),
    dataInicio: Optional[date] = Query(None),
    dataFim: Optional[date] = Query(None),
    page: Optional[int] = Query(None, ge=1, description="Página (opcional)"),
    pageSize: Optional[int] = Query(
        None, ge=1, le=200, description="Quantidade de itens por página (opcional)"
    ),
    db: Session = Depends(get_db),
) -> List[PecaOut]:
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
    )

    if cliente:
        query = query.filter(func.lower(Cliente.nome) == func.lower(_normalize_name(cliente)))
    if secretaria:
        query = query.filter(
            func.lower(Secretaria.nome) == func.lower(_normalize_name(secretaria))
        )
    if tipoPeca:
        query = query.filter(func.lower(TipoPeca.nome) == func.lower(_normalize_name(tipoPeca)))
    if dataInicio:
        query = query.filter(Peca.data_criacao >= dataInicio)
    if dataFim:
        query = query.filter(Peca.data_criacao <= dataFim)

    if page and pageSize:
        query = query.limit(pageSize).offset((page - 1) * pageSize)

    pecas = query.order_by(Peca.data_criacao.desc(), Peca.id.desc()).all()
    return [_serialize_peca(peca, include_comprovacao=False) for peca in pecas]


@router.get(
    "/{peca_id}",
    response_model=PecaOut,
    dependencies=[Depends(get_current_user)],
)
def get_peca(peca_id: int, db: Session = Depends(get_db)) -> PecaOut:
    peca = (
        db.query(Peca)
        .options(joinedload(Peca.cliente), joinedload(Peca.secretaria), joinedload(Peca.tipo_peca))
        .filter(Peca.id == peca_id)
        .first()
    )
    if not peca:
        raise HTTPException(status_code=404, detail="Peça não encontrada.")
    return _serialize_peca(peca, include_comprovacao=True)


@router.put(
    "/{peca_id}",
    response_model=PecaOut,
    dependencies=[Depends(require_permission("podeEditar"))],
)
def update_peca(peca_id: int, payload: PecaUpdate, db: Session = Depends(get_db)) -> PecaOut:
    peca = (
        db.query(Peca)
        .options(joinedload(Peca.cliente), joinedload(Peca.secretaria), joinedload(Peca.tipo_peca))
        .filter(Peca.id == peca_id)
        .first()
    )
    if not peca:
        raise HTTPException(status_code=404, detail="Peça não encontrada.")

    cliente_obj = peca.cliente
    if payload.cliente:
        if payload.secretaria is None:
            raise HTTPException(
                status_code=400,
                detail="Ao alterar o cliente é necessário informar a nova secretaria correspondente.",
            )
        cliente_obj = _get_cliente_by_nome(payload.cliente, db)
        peca.cliente_id = cliente_obj.id

    if payload.secretaria:
        secretaria_obj = _get_secretaria(payload.secretaria, cliente_obj.id, db)
        peca.secretaria_id = secretaria_obj.id

    if payload.tipoPeca:
        tipo_obj = _get_tipo_by_nome(payload.tipoPeca, db)
        peca.tipo_peca_id = tipo_obj.id

    if payload.nomePeca is not None:
        peca.nome_peca = payload.nomePeca
    if payload.dataCriacao is not None:
        peca.data_criacao = payload.dataCriacao
    if payload.dataVeiculacao is not None:
        peca.data_veiculacao = payload.dataVeiculacao
    if payload.observacao is not None:
        peca.observacao = payload.observacao
    if payload.comprovacao is not None:
        peca.comprovacao_base64 = payload.comprovacao

    db.add(peca)
    db.commit()
    db.refresh(peca)
    return _serialize_peca(peca, include_comprovacao=True)


@router.delete(
    "/{peca_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_permission("podeDeletar"))],
)
def delete_peca(peca_id: int, db: Session = Depends(get_db)) -> Response:
    peca = db.get(Peca, peca_id)
    if not peca:
        raise HTTPException(status_code=404, detail="Peça não encontrada.")
    db.delete(peca)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
