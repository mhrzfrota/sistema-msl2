"""Tipos de peça API routes."""

from typing import List

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user, require_permission
from app.models import TipoPeca
from app.schemas import TipoPecaCreate, TipoPecaOut

router = APIRouter(prefix="/api/tipos-peca", tags=["Tipos de Peça"])


def serialize_tipo(tipo: TipoPeca) -> TipoPecaOut:
    return TipoPecaOut(
        id=tipo.id,
        nome=tipo.nome,
        createdAt=tipo.created_at,
        updatedAt=tipo.updated_at,
    )


@router.get("", response_model=List[TipoPecaOut], dependencies=[Depends(get_current_user)])
def list_tipos(db: Session = Depends(get_db)) -> List[TipoPecaOut]:
    tipos = db.query(TipoPeca).order_by(TipoPeca.nome).all()
    return [serialize_tipo(tipo) for tipo in tipos]


@router.post(
    "",
    response_model=TipoPecaOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("podeConfig"))],
)
def create_tipo(payload: TipoPecaCreate, db: Session = Depends(get_db)) -> TipoPecaOut:
    tipo = TipoPeca(nome=payload.nome)
    db.add(tipo)
    try:
        db.commit()
        db.refresh(tipo)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Tipo de peça já existe.")
    return serialize_tipo(tipo)


@router.delete(
    "/{tipo_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_permission("podeConfig"))],
)
def delete_tipo(tipo_id: int, db: Session = Depends(get_db)) -> Response:
    tipo = db.get(TipoPeca, tipo_id)
    if not tipo:
        raise HTTPException(status_code=404, detail="Tipo de peça não encontrado.")
    db.delete(tipo)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
