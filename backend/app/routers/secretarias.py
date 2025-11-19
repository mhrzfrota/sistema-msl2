"""Secretarias API routes."""

from typing import List

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user, require_permission
from app.models import Cliente, Secretaria
from app.schemas import SecretariaCreate, SecretariaOut

router = APIRouter(prefix="/api", tags=["Secretarias"])


def serialize_secretaria(secretaria: Secretaria) -> SecretariaOut:
    return SecretariaOut(
        id=secretaria.id,
        nome=secretaria.nome,
        clienteId=secretaria.cliente_id,
        createdAt=secretaria.created_at,
        updatedAt=secretaria.updated_at,
    )


def ensure_cliente_exists(cliente_id: int, db: Session) -> None:
    exists = db.query(Cliente.id).filter(Cliente.id == cliente_id).first()
    if not exists:
        raise HTTPException(status_code=404, detail="Cliente não encontrado.")


@router.get(
    "/clientes/{cliente_id}/secretarias",
    response_model=List[SecretariaOut],
    dependencies=[Depends(get_current_user)],
)
def list_secretarias(cliente_id: int, db: Session = Depends(get_db)) -> List[SecretariaOut]:
    ensure_cliente_exists(cliente_id, db)
    secretarias = (
        db.query(Secretaria)
        .filter(Secretaria.cliente_id == cliente_id)
        .order_by(Secretaria.nome)
        .all()
    )
    return [serialize_secretaria(secretaria) for secretaria in secretarias]


@router.post(
    "/secretarias",
    response_model=SecretariaOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("podeConfig"))],
)
def create_secretaria(payload: SecretariaCreate, db: Session = Depends(get_db)) -> SecretariaOut:
    ensure_cliente_exists(payload.clienteId, db)
    secretaria = Secretaria(cliente_id=payload.clienteId, nome=payload.nome)
    db.add(secretaria)
    try:
        db.commit()
        db.refresh(secretaria)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Secretaria já existe para este cliente.")
    return serialize_secretaria(secretaria)


@router.delete(
    "/secretarias/{secretaria_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_permission("podeConfig"))],
)
def delete_secretaria(secretaria_id: int, db: Session = Depends(get_db)) -> Response:
    secretaria = db.get(Secretaria, secretaria_id)
    if not secretaria:
        raise HTTPException(status_code=404, detail="Secretaria não encontrada.")
    db.delete(secretaria)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
