"""Aplicação FastAPI oficial do JurisTriage (execução nativa via uvicorn)."""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any, Dict

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from backend import db
from backend.extractor import extract_document_with_pages
from backend.llm_service import (
    answer_document_question,
    answer_global_question,
    extract_document_metadata,
    list_available_models,
)
from backend.schemas import (
    ChatRequest,
    DocumentDetailResponse,
    DocumentResponse,
    SaveDocumentRequest,
    StagedDocumentResponse,
    TokenMetricsResponse,
)

MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB

app = FastAPI(
    title="JurisTriage API",
    description="Triagem documental universal, staging com gravação explícita, RAG Dual-Mode anti-alucinação e telemetria real de tokens.",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:5173"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["Content-Type"],
)


def _sanitize_filename(name: str) -> str:
    base = Path(name or "documento.pdf").name
    cleaned = re.sub(r"[^\w.\- ()áéíóúâêôãõçÁÉÍÓÚÂÊÔÃÕÇ]", "_", base)
    return cleaned[:140] or "documento.pdf"


def _map_upstream_error(exc: Exception) -> HTTPException:
    msg = str(exc)
    if any(code in msg for code in ("API_KEY_INVALID", "PERMISSION_DENIED", "HTTP 403")):
        return HTTPException(
            status_code=502,
            detail="A chave de API foi recusada pelo provedor. Verifique o .env ou Settings > Secrets.",
        )
    if any(code in msg for code in ("RESOURCE_EXHAUSTED", "UNAVAILABLE", "HTTP 429", "HTTP 503")):
        return HTTPException(
            status_code=429,
            detail="O modelo selecionado está temporariamente congestionado. Troque de modelo no seletor de IA e tente novamente.",
        )
    if "HTTP 404" in msg or "NOT_FOUND" in msg:
        return HTTPException(
            status_code=400,
            detail="O modelo selecionado não está disponível para esta chave de API. Selecione outro modelo no seletor.",
        )
    if "GROQ_API_KEY" in msg:
        return HTTPException(status_code=400, detail=msg)
    return HTTPException(status_code=500, detail=msg)


@app.on_event("startup")
def on_startup() -> None:
    db.init_db()


@app.get("/api/health")
def health() -> Dict[str, str]:
    return {"status": "ok", "service": "JurisTriage Python API", "runtime": "fastapi"}


@app.get("/api/models")
def get_models() -> Dict[str, Any]:
    return {"models": list_available_models()}


@app.get("/api/metrics/tokens", response_model=TokenMetricsResponse)
def get_metrics() -> Dict[str, int]:
    return db.get_token_metrics()


@app.get("/api/documents")
def list_documents() -> Dict[str, Any]:
    return {"documents": db.list_documents()}


@app.post("/api/documents/analyze", response_model=Dict[str, StagedDocumentResponse])
async def analyze_document(
    file: UploadFile = File(...),
    model: str | None = Form(default=None),
) -> Dict[str, Any]:
    """Processa o documento e devolve o resultado em staging SEM gravar no banco ainda."""
    safe_name = _sanitize_filename(file.filename or "documento.pdf")
    content = await file.read()
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=400, detail="Arquivo excede o limite de 10 MB.")

    try:
        raw_text, page_count, file_format = extract_document_with_pages(content, safe_name)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    try:
        extracted, usage, model_used = extract_document_metadata(
            raw_text, safe_name, requested_model=model
        )
    except Exception as exc:  # noqa: BLE001
        raise _map_upstream_error(exc) from exc

    staged = {
        "filename": safe_name,
        "file_format": file_format,
        **extracted,
        "raw_text": raw_text,
        "page_count": page_count,
        "extraction_model": model_used,
        "token_usage": usage,
    }
    return {"staged": staged}


@app.post("/api/documents", status_code=201, response_model=Dict[str, DocumentResponse])
def save_document(payload: SaveDocumentRequest) -> Dict[str, Any]:
    """Grava definitivamente na memória persistente (SQLite) um documento revisado."""
    saved = db.create_document(payload.model_dump(mode="json"))
    return {"document": saved}


@app.get("/api/documents/{document_id}", response_model=DocumentDetailResponse)
def get_document(document_id: int) -> Dict[str, Any]:
    doc = db.get_document_by_id(document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Documento não encontrado.")
    return {"document": doc, "messages": db.list_chat_messages(document_id)}


@app.delete("/api/documents/{document_id}")
def delete_document(document_id: int) -> Dict[str, Any]:
    if not db.delete_document_by_id(document_id):
        raise HTTPException(status_code=404, detail="Documento não encontrado.")
    return {"deleted": True, "id": document_id}


@app.post("/api/documents/{document_id}/chat")
def chat_with_document(document_id: int, payload: ChatRequest) -> Dict[str, Any]:
    doc = db.get_document_by_id(document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Documento não encontrado.")

    history = [(m["role"], m["content"]) for m in db.list_chat_messages(document_id)]

    try:
        rag_answer, usage, model_used = answer_document_question(
            raw_text=doc["raw_text"],
            filename=doc["filename"],
            question=payload.question.strip(),
            history=history,
            requested_model=payload.model,
        )
    except Exception as exc:  # noqa: BLE001
        raise _map_upstream_error(exc) from exc

    user_msg = db.create_chat_message(document_id, "user", payload.question.strip())
    assistant_msg = db.create_chat_message(
        document_id=document_id,
        role="assistant",
        content=rag_answer["resposta"],
        cited_pages=rag_answer["paginas_citadas"],
        token_usage=usage,
        model_used=model_used,
    )
    updated_doc = db.get_document_by_id(document_id)
    return {
        "userMessage": user_msg,
        "assistantMessage": assistant_msg,
        "foundInDocument": rag_answer["encontrado_no_documento"],
        "processTotalTokens": updated_doc["process_total_tokens"] if updated_doc else 0,
    }


@app.get("/api/chat/global")
def list_global_chat() -> Dict[str, Any]:
    return {"messages": db.list_global_chat_messages()}


@app.delete("/api/chat/global")
def clear_global_chat() -> Dict[str, bool]:
    db.clear_global_chat_messages()
    return {"cleared": True}


@app.post("/api/chat/global")
def chat_with_global_brain(payload: ChatRequest) -> Dict[str, Any]:
    documents = db.list_documents()
    history = [(m["role"], m["content"]) for m in db.list_global_chat_messages()]

    try:
        rag_answer, usage, model_used = answer_global_question(
            documents=documents,
            question=payload.question.strip(),
            history=history,
            requested_model=payload.model,
        )
    except Exception as exc:  # noqa: BLE001
        raise _map_upstream_error(exc) from exc

    user_msg = db.create_global_chat_message("user", payload.question.strip())
    assistant_msg = db.create_global_chat_message(
        role="assistant",
        content=rag_answer["resposta"],
        citations=rag_answer["citations"],
        token_usage=usage,
        model_used=model_used,
    )
    return {
        "userMessage": user_msg,
        "assistantMessage": assistant_msg,
        "foundInBase": rag_answer["encontrado_na_base"],
    }
