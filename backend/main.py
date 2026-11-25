import json
from pathlib import Path

from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import case
from sqlalchemy.orm import Session

from backend.extractor import extract_pdf_text_with_pages
from backend.llm_service import (
    answer_document_question,
    extract_legal_metadata,
    list_available_models,
)
from backend.models import ChatMessageModel, DocumentModel, get_db, init_db
from backend.schemas import (
    ChatMessageResponse,
    ChatRequest,
    DocumentDetailResponse,
    DocumentResponse,
)

MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB

app = FastAPI(
    title="JurisTriage API",
    description="Triagem inteligente de documentos jurídicos em PDF + Chat RAG ancorado por página.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["Content-Type"],
)


@app.on_event("startup")
def on_startup() -> None:
    init_db()


def _serialize_document(doc: DocumentModel) -> DocumentResponse:
    return DocumentResponse(
        id=doc.id,
        filename=doc.filename,
        tipo_documento=doc.tipo_documento,
        numero_processo=doc.numero_processo,
        partes_envolvidas=json.loads(doc.partes_envolvidas or "[]"),
        prazo_ou_vigencia=doc.prazo_ou_vigencia,
        valor_envolvido=doc.valor_envolvido,
        urgencia=doc.urgencia,  # type: ignore[arg-type]
        resumo_executivo=doc.resumo_executivo,
        raw_text=doc.raw_text,
        page_count=doc.page_count,
        created_at=doc.created_at,
    )


def _serialize_message(msg: ChatMessageModel) -> ChatMessageResponse:
    return ChatMessageResponse(
        id=msg.id,
        document_id=msg.document_id,
        role=msg.role,
        content=msg.content,
        cited_pages=json.loads(msg.cited_pages or "[]"),
        created_at=msg.created_at,
    )


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "JurisTriage FastAPI"}


@app.get("/api/models")
def get_models() -> dict[str, object]:
    return {"models": list_available_models()}


@app.get("/api/documents")
def list_documents(db: Session = Depends(get_db)) -> dict[str, list[DocumentResponse]]:
    urgency_order = case(
        (DocumentModel.urgencia == "ALTA", 1),
        (DocumentModel.urgencia == "MEDIA", 2),
        else_=3,
    )
    rows = db.query(DocumentModel).order_by(urgency_order.asc(), DocumentModel.id.desc()).all()
    return {"documents": [_serialize_document(row) for row in rows]}


@app.get("/api/documents/{document_id}", response_model=DocumentDetailResponse)
def get_document(document_id: int, db: Session = Depends(get_db)) -> DocumentDetailResponse:
    doc = db.query(DocumentModel).filter(DocumentModel.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Documento não encontrado.")
    return DocumentDetailResponse(
        document=_serialize_document(doc),
        messages=[_serialize_message(m) for m in doc.messages],
    )


@app.delete("/api/documents/{document_id}")
def delete_document(document_id: int, db: Session = Depends(get_db)) -> dict[str, object]:
    doc = db.query(DocumentModel).filter(DocumentModel.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Documento não encontrado.")
    db.delete(doc)
    db.commit()
    return {"deleted": True, "id": document_id}


@app.post("/api/documents/upload", status_code=201)
async def upload_document(
    file: UploadFile = File(...),
    model: str | None = Form(default=None),
    db: Session = Depends(get_db),
) -> dict[str, DocumentResponse]:
    safe_name = Path(file.filename or "documento.pdf").name
    if not safe_name.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Envie apenas arquivos PDF (.pdf).")

    content = await file.read()
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=400, detail="Arquivo excede o limite de 10 MB.")

    try:
        raw_text, page_count = extract_pdf_text_with_pages(content)
        extracted = extract_legal_metadata(raw_text, safe_name, requested_model=model)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    doc = DocumentModel(
        filename=safe_name,
        tipo_documento=extracted.tipo_documento,
        numero_processo=extracted.numero_processo,
        partes_envolvidas=json.dumps(extracted.partes_envolvidas, ensure_ascii=False),
        prazo_ou_vigencia=extracted.prazo_ou_vigencia,
        valor_envolvido=extracted.valor_envolvido,
        urgencia=extracted.urgencia.value,
        resumo_executivo=extracted.resumo_executivo,
        raw_text=raw_text,
        page_count=page_count,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return {"document": _serialize_document(doc)}


@app.post("/api/documents/{document_id}/chat")
def chat_with_document(
    document_id: int,
    payload: ChatRequest,
    db: Session = Depends(get_db),
) -> dict[str, object]:
    doc = db.query(DocumentModel).filter(DocumentModel.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Documento não encontrado.")

    history = [(m.role, m.content) for m in doc.messages]

    try:
        rag_answer = answer_document_question(
            raw_text=doc.raw_text,
            filename=doc.filename,
            question=payload.question.strip(),
            history=history,
            requested_model=payload.model,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    user_msg = ChatMessageModel(
        document_id=doc.id,
        role="user",
        content=payload.question.strip(),
        cited_pages="[]",
    )
    assistant_msg = ChatMessageModel(
        document_id=doc.id,
        role="assistant",
        content=rag_answer.resposta,
        cited_pages=json.dumps(rag_answer.paginas_citadas),
    )
    db.add_all([user_msg, assistant_msg])
    db.commit()
    db.refresh(user_msg)
    db.refresh(assistant_msg)

    return {
        "userMessage": _serialize_message(user_msg),
        "assistantMessage": _serialize_message(assistant_msg),
        "foundInDocument": rag_answer.encontrado_no_documento,
    }
