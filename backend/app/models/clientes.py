"""Models for clientes table."""

from sqlalchemy import Column, DateTime, Integer, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.models import Base


class Cliente(Base):
    __tablename__ = "clientes"

    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String(255), nullable=False, unique=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    secretarias = relationship(
        "Secretaria",
        back_populates="cliente",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    pecas = relationship("Peca", back_populates="cliente")

    def __repr__(self) -> str:  # pragma: no cover - helper for debugging
        return f"<Cliente id={self.id} nome={self.nome!r}>"
