"""Contratos Pydantic v2 para a API FastAPI do JurisTriage."""

from __future__ import annotations

from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field


class UrgencyLevel(str, Enum):
    ALTA = "ALTA"
    MEDIA = "MEDIA"
    BAIXA = "BAIXA"


class TokenUsage(BaseModel):
    input_tokens: int = Field(default=0, ge=0)
    output_tokens: int = Field(default=0, ge=0)
    total_tokens: int = Field(default=0, ge=0)


class StagedDocumentResponse(BaseModel):
    filename: str
    file_format: str
    tipo_documento: str
    numero_processo: Optional[str] = None
    partes_envolvidas: List[str] = Field(default_factory=list)
    prazo_ou_vigencia: str
    valor_envolvido: str
    urgencia: UrgencyLevel
    resumo_executivo: str
    suggested_questions: List[str] = Field(default_factory=list)
    raw_text: str
    page_count: int = Field(ge=1)
    extraction_model: str = ""
    token_usage: TokenUsage = Field(default_factory=TokenUsage)


class SaveDocumentRequest(StagedDocumentResponse):
    """Payload enviado quando o usuário confirma o botão 'Salvar na Memória'."""


class DocumentResponse(StagedDocumentResponse):
    id: int
    process_total_tokens: int = Field(default=0, ge=0)
    created_at: str


class ChatRequest(BaseModel):
    question: str = Field(..., min_length=2, max_length=1500)
    model: Optional[str] = Field(default=None, max_length=80)


class ChatMessageResponse(BaseModel):
    id: int
    document_id: int
    role: str
    content: str
    cited_pages: List[int] = Field(default_factory=list)
    token_usage: TokenUsage = Field(default_factory=TokenUsage)
    model_used: str = ""
    created_at: str


class DocumentDetailResponse(BaseModel):
    document: DocumentResponse
    messages: List[ChatMessageResponse]


class GlobalCitation(BaseModel):
    document_id: int
    filename: str
    page: int


class GlobalChatMessageResponse(BaseModel):
    id: int
    role: str
    content: str
    citations: List[GlobalCitation] = Field(default_factory=list)
    token_usage: TokenUsage = Field(default_factory=TokenUsage)
    model_used: str = ""
    created_at: str


class TokenMetricsResponse(BaseModel):
    document_count: int
    chat_operations: int
    total_input_tokens: int
    total_output_tokens: int
    total_tokens: int
