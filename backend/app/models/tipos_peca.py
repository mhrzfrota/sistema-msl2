"""Model for tipos_peca table."""

from sqlalchemy import Column, DateTime, Integer, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.models import Base


class TipoPeca(Base):
    __tablename__ = "tipos_peca"

    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String(255), nullable=False, unique=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    pecas = relationship("Peca", back_populates="tipo_peca")

    def __repr__(self) -> str:  # pragma: no cover - helper for debugging
        return f"<TipoPeca id={self.id} nome={self.nome!r}>"
