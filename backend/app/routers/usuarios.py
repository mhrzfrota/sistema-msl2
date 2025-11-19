"""Administração de usuários."""

from typing import List

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user, hash_password, require_role
from app.models import Usuario
from app.schemas import UsuarioCreate, UsuarioOut

router = APIRouter(
    prefix="/api/usuarios",
    tags=["Usuários"],
    dependencies=[Depends(require_role(["master"]))],
)


@router.get("", response_model=List[UsuarioOut])
def list_usuarios(db: Session = Depends(get_db)) -> List[UsuarioOut]:
    usuarios = db.query(Usuario).order_by(Usuario.username).all()
    return [
        UsuarioOut(
            id=user.id,
            username=user.username,
            nome=user.nome,
            role=user.role,
            isActive=user.is_active,
            createdAt=user.created_at,
            updatedAt=user.updated_at,
        )
        for user in usuarios
    ]


@router.post("", response_model=UsuarioOut, status_code=status.HTTP_201_CREATED)
def create_usuario(payload: UsuarioCreate, db: Session = Depends(get_db)) -> UsuarioOut:
    usuario = Usuario(
        username=payload.username,
        nome=payload.nome,
        role=payload.role,
        password_hash=hash_password(payload.password),
        is_active=payload.isActive,
    )
    db.add(usuario)
    try:
        db.commit()
        db.refresh(usuario)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Username já existe.")

    return UsuarioOut(
        id=usuario.id,
        username=usuario.username,
        nome=usuario.nome,
        role=usuario.role,
        isActive=usuario.is_active,
        createdAt=usuario.created_at,
        updatedAt=usuario.updated_at,
    )


@router.delete("/{usuario_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_usuario(
    usuario_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
) -> Response:
    if usuario_id == 1:
        raise HTTPException(status_code=400, detail="Não é permitido deletar o administrador padrão.")
    if usuario_id == current_user.id:
        raise HTTPException(status_code=400, detail="Você não pode deletar o próprio usuário.")

    usuario = db.get(Usuario, usuario_id)
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")
    db.delete(usuario)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
