"""Model for secretarias table."""

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.models import Base


class Secretaria(Base):
    __tablename__ = "secretarias"

    id = Column(Integer, primary_key=True, index=True)
    cliente_id = Column(Integer, ForeignKey("clientes.id", ondelete="CASCADE"), nullable=False)
    nome = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    cliente = relationship("Cliente", back_populates="secretarias")
    pecas = relationship("Peca", back_populates="secretaria")

    def __repr__(self) -> str:  # pragma: no cover - helper for debugging
        return f"<Secretaria id={self.id} nome={self.nome!r} cliente_id={self.cliente_id}>"
