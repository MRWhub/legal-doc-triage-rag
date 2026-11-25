from datetime import datetime
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


class UrgencyLevel(str, Enum):
    ALTA = "ALTA"
    MEDIA = "MEDIA"
    BAIXA = "BAIXA"


class DocumentExtraction(BaseModel):
    tipo_documento: str = Field(
        ..., description="Classificação jurídica do documento (ex.: Intimação Judicial, Contrato Comercial)."
    )
    numero_processo: Optional[str] = Field(
        default=None,
        description="Número CNJ do processo judicial, ou null quando inexistente (ex.: contratos).",
    )
    partes_envolvidas: List[str] = Field(
        default_factory=list,
        description="Lista das partes envolvidas com seus respectivos papéis.",
    )
    prazo_ou_vigencia: str = Field(
        ..., description="Prazo fatal processual ou período de vigência contratual."
    )
    valor_envolvido: str = Field(
        ..., description="Valor da causa, condenação, multa ou valor do contrato."
    )
    urgencia: UrgencyLevel = Field(
        ..., description="Severidade operacional da triagem: ALTA, MEDIA ou BAIXA."
    )
    resumo_executivo: str = Field(
        ..., description="Síntese objetiva em 2 a 3 frases sobre objeto, risco e ação recomendada."
    )


class DocumentResponse(DocumentExtraction):
    model_config = ConfigDict(from_attributes=True)

    id: int
    filename: str
    raw_text: str
    page_count: int
    created_at: datetime


class ChatRequest(BaseModel):
    question: str = Field(..., min_length=2, max_length=1500)


class RagStructuredAnswer(BaseModel):
    resposta: str = Field(
        ...,
        description="Resposta estritamente baseada no documento citando [Página X], ou recusa clara se ausente.",
    )
    paginas_citadas: List[int] = Field(
        default_factory=list,
        description="Lista ordenada dos números de páginas usadas como evidência.",
    )
    encontrado_no_documento: bool = Field(
        ...,
        description="True quando a resposta consta explicitamente no texto; False quando ausente.",
    )


class ChatMessageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    document_id: int
    role: str
    content: str
    cited_pages: List[int]
    created_at: datetime


class DocumentDetailResponse(BaseModel):
    document: DocumentResponse
    messages: List[ChatMessageResponse]
