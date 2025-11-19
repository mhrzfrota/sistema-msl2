"""Model for pecas table."""

from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.models import Base


class Peca(Base):
    __tablename__ = "pecas"

    id = Column(Integer, primary_key=True, index=True)
    cliente_id = Column(Integer, ForeignKey("clientes.id", ondelete="RESTRICT"), nullable=False)
    secretaria_id = Column(Integer, ForeignKey("secretarias.id", ondelete="RESTRICT"), nullable=False)
    tipo_peca_id = Column(Integer, ForeignKey("tipos_peca.id", ondelete="RESTRICT"), nullable=False)
    nome_peca = Column(String(255), nullable=False)
    data_criacao = Column(Date, nullable=False)
    data_veiculacao = Column(Date)
    observacao = Column(Text)
    comprovacao_base64 = Column(Text, nullable=False)
    data_cadastro = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    cliente = relationship("Cliente", back_populates="pecas")
    secretaria = relationship("Secretaria", back_populates="pecas")
    tipo_peca = relationship("TipoPeca", back_populates="pecas")

    def __repr__(self) -> str:  # pragma: no cover - helper for debugging
        return f"<Peca id={self.id} nome={self.nome_peca!r}>"
