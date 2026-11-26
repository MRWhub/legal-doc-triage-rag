"""Definições SQLAlchemy ORM espelhando o schema SQLite de juristriage.db."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, create_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship, sessionmaker

DATABASE_URL = "sqlite:///./juristriage.db"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


class DocumentModel(Base):
    __tablename__ = "documents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    file_format: Mapped[str] = mapped_column(String(16), nullable=False, default="pdf")
    tipo_documento: Mapped[str] = mapped_column(String(160), nullable=False)
    numero_processo: Mapped[str | None] = mapped_column(String(80), nullable=True)
    partes_envolvidas: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    prazo_ou_vigencia: Mapped[str] = mapped_column(String(255), nullable=False)
    valor_envolvido: Mapped[str] = mapped_column(String(120), nullable=False)
    urgencia: Mapped[str] = mapped_column(String(16), nullable=False, index=True)
    resumo_executivo: Mapped[str] = mapped_column(Text, nullable=False)
    suggested_questions: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    raw_text: Mapped[str] = mapped_column(Text, nullable=False)
    page_count: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    extraction_input_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    extraction_output_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    extraction_total_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    extraction_model: Mapped[str] = mapped_column(String(80), nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    messages: Mapped[list["ChatMessageModel"]] = relationship(
        back_populates="document",
        cascade="all, delete-orphan",
        order_by="ChatMessageModel.id",
    )


class ChatMessageModel(Base):
    __tablename__ = "chat_messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    document_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True
    )
    role: Mapped[str] = mapped_column(String(20), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    cited_pages: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    input_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    output_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    model_used: Mapped[str] = mapped_column(String(80), nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    document: Mapped[DocumentModel] = relationship(back_populates="messages")


class GlobalChatMessageModel(Base):
    __tablename__ = "global_chat_messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    role: Mapped[str] = mapped_column(String(20), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    citations: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    input_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    output_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    model_used: Mapped[str] = mapped_column(String(80), nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
