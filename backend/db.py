"""Camada de persistência SQLite parametrizada (WAL + FK + migrações automáticas)."""

from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

DB_PATH = Path(__file__).resolve().parent.parent / "juristriage.db"


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode = WAL;")
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


def _ensure_column(conn: sqlite3.Connection, table: str, column: str, definition: str) -> None:
    existing = {
        row["name"] for row in conn.execute(f"PRAGMA table_info({table})").fetchall()
    }
    if column not in existing:
        conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")


def init_db() -> None:
    with _connect() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS documents (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                filename TEXT NOT NULL,
                file_format TEXT NOT NULL DEFAULT 'pdf',
                tipo_documento TEXT NOT NULL,
                numero_processo TEXT,
                partes_envolvidas TEXT NOT NULL DEFAULT '[]',
                prazo_ou_vigencia TEXT NOT NULL,
                valor_envolvido TEXT NOT NULL,
                urgencia TEXT NOT NULL CHECK (urgencia IN ('ALTA', 'MEDIA', 'BAIXA')),
                resumo_executivo TEXT NOT NULL,
                suggested_questions TEXT NOT NULL DEFAULT '[]',
                raw_text TEXT NOT NULL,
                page_count INTEGER NOT NULL DEFAULT 1,
                extraction_input_tokens INTEGER NOT NULL DEFAULT 0,
                extraction_output_tokens INTEGER NOT NULL DEFAULT 0,
                extraction_total_tokens INTEGER NOT NULL DEFAULT 0,
                extraction_model TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS chat_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                document_id INTEGER NOT NULL,
                role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
                content TEXT NOT NULL,
                cited_pages TEXT NOT NULL DEFAULT '[]',
                input_tokens INTEGER NOT NULL DEFAULT 0,
                output_tokens INTEGER NOT NULL DEFAULT 0,
                total_tokens INTEGER NOT NULL DEFAULT 0,
                model_used TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL,
                FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS global_chat_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
                content TEXT NOT NULL,
                citations TEXT NOT NULL DEFAULT '[]',
                input_tokens INTEGER NOT NULL DEFAULT 0,
                output_tokens INTEGER NOT NULL DEFAULT 0,
                total_tokens INTEGER NOT NULL DEFAULT 0,
                model_used TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_chat_messages_doc_id ON chat_messages(document_id);
            """
        )

        # Migração segura caso um juristriage.db anterior já exista
        _ensure_column(conn, "documents", "file_format", "TEXT NOT NULL DEFAULT 'pdf'")
        _ensure_column(conn, "documents", "suggested_questions", "TEXT NOT NULL DEFAULT '[]'")
        _ensure_column(conn, "documents", "extraction_input_tokens", "INTEGER NOT NULL DEFAULT 0")
        _ensure_column(conn, "documents", "extraction_output_tokens", "INTEGER NOT NULL DEFAULT 0")
        _ensure_column(conn, "documents", "extraction_total_tokens", "INTEGER NOT NULL DEFAULT 0")
        _ensure_column(conn, "documents", "extraction_model", "TEXT NOT NULL DEFAULT ''")

        _ensure_column(conn, "chat_messages", "input_tokens", "INTEGER NOT NULL DEFAULT 0")
        _ensure_column(conn, "chat_messages", "output_tokens", "INTEGER NOT NULL DEFAULT 0")
        _ensure_column(conn, "chat_messages", "total_tokens", "INTEGER NOT NULL DEFAULT 0")
        _ensure_column(conn, "chat_messages", "model_used", "TEXT NOT NULL DEFAULT ''")
        conn.commit()


def _safe_json_list(raw: Optional[str]) -> List[Any]:
    if not raw:
        return []
    try:
        parsed = json.loads(raw)
        return parsed if isinstance(parsed, list) else []
    except (json.JSONDecodeError, TypeError):
        return []


def _serialize_document_row(row: sqlite3.Row, chat_tokens: int = 0) -> Dict[str, Any]:
    ext_in = int(row["extraction_input_tokens"] or 0)
    ext_out = int(row["extraction_output_tokens"] or 0)
    ext_total = int(row["extraction_total_tokens"] or (ext_in + ext_out))
    return {
        "id": int(row["id"]),
        "filename": str(row["filename"]),
        "file_format": str(row["file_format"] or "pdf"),
        "tipo_documento": str(row["tipo_documento"]),
        "numero_processo": row["numero_processo"],
        "partes_envolvidas": [str(x) for x in _safe_json_list(row["partes_envolvidas"])],
        "prazo_ou_vigencia": str(row["prazo_ou_vigencia"]),
        "valor_envolvido": str(row["valor_envolvido"]),
        "urgencia": str(row["urgencia"]),
        "resumo_executivo": str(row["resumo_executivo"]),
        "suggested_questions": [str(x) for x in _safe_json_list(row["suggested_questions"])],
        "raw_text": str(row["raw_text"]),
        "page_count": int(row["page_count"] or 1),
        "extraction_model": str(row["extraction_model"] or ""),
        "token_usage": {
            "input_tokens": ext_in,
            "output_tokens": ext_out,
            "total_tokens": ext_total,
        },
        "process_total_tokens": ext_total + int(chat_tokens),
        "created_at": str(row["created_at"]),
    }


def _serialize_chat_row(row: sqlite3.Row) -> Dict[str, Any]:
    cited = [
        int(p)
        for p in _safe_json_list(row["cited_pages"])
        if isinstance(p, (int, str)) and str(p).isdigit() and int(p) > 0
    ]
    return {
        "id": int(row["id"]),
        "document_id": int(row["document_id"]),
        "role": str(row["role"]),
        "content": str(row["content"]),
        "cited_pages": cited,
        "token_usage": {
            "input_tokens": int(row["input_tokens"] or 0),
            "output_tokens": int(row["output_tokens"] or 0),
            "total_tokens": int(row["total_tokens"] or 0),
        },
        "model_used": str(row["model_used"] or ""),
        "created_at": str(row["created_at"]),
    }


def _serialize_global_chat_row(row: sqlite3.Row) -> Dict[str, Any]:
    citations = _safe_json_list(row["citations"])
    return {
        "id": int(row["id"]),
        "role": str(row["role"]),
        "content": str(row["content"]),
        "citations": citations,
        "token_usage": {
            "input_tokens": int(row["input_tokens"] or 0),
            "output_tokens": int(row["output_tokens"] or 0),
            "total_tokens": int(row["total_tokens"] or 0),
        },
        "model_used": str(row["model_used"] or ""),
        "created_at": str(row["created_at"]),
    }


def create_document(payload: Dict[str, Any]) -> Dict[str, Any]:
    now = _utc_now_iso()
    token_usage = payload.get("token_usage") or {}
    in_tok = int(token_usage.get("input_tokens") or 0)
    out_tok = int(token_usage.get("output_tokens") or 0)
    tot_tok = int(token_usage.get("total_tokens") or (in_tok + out_tok))

    with _connect() as conn:
        cur = conn.execute(
            """
            INSERT INTO documents (
                filename,
                file_format,
                tipo_documento,
                numero_processo,
                partes_envolvidas,
                prazo_ou_vigencia,
                valor_envolvido,
                urgencia,
                resumo_executivo,
                suggested_questions,
                raw_text,
                page_count,
                extraction_input_tokens,
                extraction_output_tokens,
                extraction_total_tokens,
                extraction_model,
                created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                str(payload["filename"]),
                str(payload.get("file_format") or "pdf"),
                str(payload["tipo_documento"]),
                payload.get("numero_processo"),
                json.dumps(payload.get("partes_envolvidas") or [], ensure_ascii=False),
                str(payload["prazo_ou_vigencia"]),
                str(payload["valor_envolvido"]),
                str(payload["urgencia"]),
                str(payload["resumo_executivo"]),
                json.dumps(payload.get("suggested_questions") or [], ensure_ascii=False),
                str(payload["raw_text"]),
                int(payload.get("page_count") or 1),
                in_tok,
                out_tok,
                tot_tok,
                str(payload.get("extraction_model") or ""),
                now,
            ),
        )
        doc_id = cur.lastrowid
        conn.commit()
        row = conn.execute("SELECT * FROM documents WHERE id = ?", (doc_id,)).fetchone()
        return _serialize_document_row(row, chat_tokens=0)


def list_documents() -> List[Dict[str, Any]]:
    with _connect() as conn:
        rows = conn.execute(
            """
            SELECT
                d.*,
                COALESCE(SUM(c.total_tokens), 0) AS chat_tokens_sum
            FROM documents d
            LEFT JOIN chat_messages c ON c.document_id = d.id
            GROUP BY d.id
            ORDER BY
                CASE d.urgencia
                    WHEN 'ALTA' THEN 1
                    WHEN 'MEDIA' THEN 2
                    ELSE 3
                END ASC,
                d.id DESC
            """
        ).fetchall()
        return [_serialize_document_row(row, chat_tokens=int(row["chat_tokens_sum"] or 0)) for row in rows]


def get_document_by_id(doc_id: int) -> Optional[Dict[str, Any]]:
    with _connect() as conn:
        row = conn.execute(
            """
            SELECT
                d.*,
                COALESCE(SUM(c.total_tokens), 0) AS chat_tokens_sum
            FROM documents d
            LEFT JOIN chat_messages c ON c.document_id = d.id
            WHERE d.id = ?
            GROUP BY d.id
            """,
            (doc_id,),
        ).fetchone()
        if not row:
            return None
        return _serialize_document_row(row, chat_tokens=int(row["chat_tokens_sum"] or 0))


def delete_document_by_id(doc_id: int) -> bool:
    with _connect() as conn:
        cur = conn.execute("DELETE FROM documents WHERE id = ?", (doc_id,))
        conn.commit()
        return cur.rowcount > 0


def list_chat_messages(doc_id: int) -> List[Dict[str, Any]]:
    with _connect() as conn:
        rows = conn.execute(
            "SELECT * FROM chat_messages WHERE document_id = ? ORDER BY id ASC",
            (doc_id,),
        ).fetchall()
        return [_serialize_chat_row(row) for row in rows]


def create_chat_message(
    doc_id: int,
    role: str,
    content: str,
    cited_pages: Optional[List[int]] = None,
    token_usage: Optional[Dict[str, int]] = None,
    model_used: str = "",
) -> Dict[str, Any]:
    now = _utc_now_iso()
    usage = token_usage or {}
    in_tok = int(usage.get("input_tokens") or 0)
    out_tok = int(usage.get("output_tokens") or 0)
    tot_tok = int(usage.get("total_tokens") or (in_tok + out_tok))

    with _connect() as conn:
        cur = conn.execute(
            """
            INSERT INTO chat_messages (
                document_id, role, content, cited_pages,
                input_tokens, output_tokens, total_tokens, model_used, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                doc_id,
                role,
                content,
                json.dumps(cited_pages or []),
                in_tok,
                out_tok,
                tot_tok,
                model_used,
                now,
            ),
        )
        msg_id = cur.lastrowid
        conn.commit()
        row = conn.execute("SELECT * FROM chat_messages WHERE id = ?", (msg_id,)).fetchone()
        return _serialize_chat_row(row)


def list_global_chat_messages() -> List[Dict[str, Any]]:
    with _connect() as conn:
        rows = conn.execute("SELECT * FROM global_chat_messages ORDER BY id ASC").fetchall()
        return [_serialize_global_chat_row(row) for row in rows]


def create_global_chat_message(
    role: str,
    content: str,
    citations: Optional[List[Dict[str, Any]]] = None,
    token_usage: Optional[Dict[str, int]] = None,
    model_used: str = "",
) -> Dict[str, Any]:
    now = _utc_now_iso()
    usage = token_usage or {}
    in_tok = int(usage.get("input_tokens") or 0)
    out_tok = int(usage.get("output_tokens") or 0)
    tot_tok = int(usage.get("total_tokens") or (in_tok + out_tok))

    with _connect() as conn:
        cur = conn.execute(
            """
            INSERT INTO global_chat_messages (
                role, content, citations,
                input_tokens, output_tokens, total_tokens, model_used, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                role,
                content,
                json.dumps(citations or [], ensure_ascii=False),
                in_tok,
                out_tok,
                tot_tok,
                model_used,
                now,
            ),
        )
        msg_id = cur.lastrowid
        conn.commit()
        row = conn.execute(
            "SELECT * FROM global_chat_messages WHERE id = ?", (msg_id,)
        ).fetchone()
        return _serialize_global_chat_row(row)


def clear_global_chat_messages() -> None:
    with _connect() as conn:
        conn.execute("DELETE FROM global_chat_messages")
        conn.commit()


def get_token_metrics() -> Dict[str, int]:
    with _connect() as conn:
        doc_row = conn.execute(
            """
            SELECT
                COUNT(*) AS doc_count,
                COALESCE(SUM(extraction_input_tokens), 0) AS in_tok,
                COALESCE(SUM(extraction_output_tokens), 0) AS out_tok,
                COALESCE(SUM(extraction_total_tokens), 0) AS tot_tok
            FROM documents
            """
        ).fetchone()
        chat_row = conn.execute(
            """
            SELECT
                COUNT(*) AS msg_count,
                COALESCE(SUM(input_tokens), 0) AS in_tok,
                COALESCE(SUM(output_tokens), 0) AS out_tok,
                COALESCE(SUM(total_tokens), 0) AS tot_tok
            FROM chat_messages
            WHERE role = 'assistant'
            """
        ).fetchone()
        global_row = conn.execute(
            """
            SELECT
                COUNT(*) AS msg_count,
                COALESCE(SUM(input_tokens), 0) AS in_tok,
                COALESCE(SUM(output_tokens), 0) AS out_tok,
                COALESCE(SUM(total_tokens), 0) AS tot_tok
            FROM global_chat_messages
            WHERE role = 'assistant'
            """
        ).fetchone()

    total_in = int(doc_row["in_tok"]) + int(chat_row["in_tok"]) + int(global_row["in_tok"])
    total_out = int(doc_row["out_tok"]) + int(chat_row["out_tok"]) + int(global_row["out_tok"])
    total_all = int(doc_row["tot_tok"]) + int(chat_row["tot_tok"]) + int(global_row["tot_tok"])

    return {
        "document_count": int(doc_row["doc_count"]),
        "chat_operations": int(chat_row["msg_count"]) + int(global_row["msg_count"]),
        "total_input_tokens": total_in,
        "total_output_tokens": total_out,
        "total_tokens": total_all,
    }
