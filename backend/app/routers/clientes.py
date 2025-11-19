"""Clientes API routes."""

from typing import List

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user, require_permission
from app.models import Cliente
from app.schemas import ClienteCreate, ClienteOut

router = APIRouter(prefix="/api/clientes", tags=["Clientes"])


def serialize_cliente(cliente: Cliente) -> ClienteOut:
    return ClienteOut(
        id=cliente.id,
        nome=cliente.nome,
        createdAt=cliente.created_at,
        updatedAt=cliente.updated_at,
    )


@router.get("", response_model=List[ClienteOut], dependencies=[Depends(get_current_user)])
def list_clientes(db: Session = Depends(get_db)) -> List[ClienteOut]:
    clientes = db.query(Cliente).order_by(Cliente.nome).all()
    return [serialize_cliente(cliente) for cliente in clientes]


@router.post(
    "",
    response_model=ClienteOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("podeConfig"))],
)
def create_cliente(payload: ClienteCreate, db: Session = Depends(get_db)) -> ClienteOut:
    cliente = Cliente(nome=payload.nome)
    db.add(cliente)
    try:
        db.commit()
        db.refresh(cliente)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Cliente já existe.")
    return serialize_cliente(cliente)


@router.delete(
    "/{cliente_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_permission("podeConfig"))],
)
def delete_cliente(cliente_id: int, db: Session = Depends(get_db)) -> Response:
    cliente = db.get(Cliente, cliente_id)
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente não encontrado.")
    db.delete(cliente)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
