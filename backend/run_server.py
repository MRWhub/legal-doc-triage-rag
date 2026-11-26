"""Launcher 100% Python para o JurisTriage.

- Quando FastAPI + Uvicorn estão instalados (Ubuntu / venv), executa nativamente `backend.main:app`.
- Em ambientes sem pip (ex.: sandbox Node+Python), executa um servidor HTTP nativo em Python 3.11
  com exatamente as mesmas rotas /api/*, mesmo SQLite e mesmos módulos extractor/llm_service.
- Com `--with-vite`, sobe a API Python na porta 8000 e inicia o Vite na porta 3000.
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import mimetypes
import os
import re
import signal
import subprocess
import sys
import threading
import time
import urllib.request
from email.parser import BytesParser
from email.policy import default as email_default_policy
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Dict, Optional, Tuple
from urllib.parse import urlparse

from backend import db
from backend.extractor import extract_document_with_pages
from backend.llm_service import (
    answer_document_question,
    answer_global_question,
    extract_document_metadata,
    list_available_models,
)

ROOT_DIR = Path(__file__).resolve().parent.parent
DIST_DIR = ROOT_DIR / "dist"
MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB


def _sanitize_filename(name: str) -> str:
    base = Path(name or "documento.pdf").name
    cleaned = re.sub(r"[^\w.\- ()áéíóúâêôãõçÁÉÍÓÚÂÊÔÃÕÇ]", "_", base)
    return cleaned[:140] or "documento.pdf"


def _map_error(exc: Exception) -> Tuple[int, str]:
    msg = str(exc) or "Erro interno inesperado no servidor."
    if any(code in msg for code in ("API_KEY_INVALID", "PERMISSION_DENIED", "HTTP 403")):
        return (
            502,
            "A chave de API foi recusada pelo provedor. Verifique o .env ou Settings > Secrets.",
        )
    if any(code in msg for code in ("RESOURCE_EXHAUSTED", "UNAVAILABLE", "HTTP 429", "HTTP 503")):
        return (
            429,
            "O modelo selecionado está temporariamente congestionado. Troque de modelo no seletor de IA e tente novamente.",
        )
    if "HTTP 404" in msg or "NOT_FOUND" in msg:
        return (
            400,
            "O modelo selecionado não está disponível para esta chave de API. Selecione outro modelo no seletor.",
        )
    if isinstance(exc, ValueError) or "GROQ_API_KEY" in msg:
        return (400, msg)
    return (500, msg)


def _parse_multipart(content_type: str, body: bytes) -> Tuple[Optional[str], Optional[bytes], Dict[str, str]]:
    header_block = (
        f"Content-Type: {content_type}\r\nMIME-Version: 1.0\r\n\r\n".encode("latin-1")
    )
    msg = BytesParser(policy=email_default_policy).parsebytes(header_block + body)
    filename: Optional[str] = None
    file_bytes: Optional[bytes] = None
    fields: Dict[str, str] = {}

    if not msg.is_multipart():
        return None, None, fields

    for part in msg.iter_parts():
        name = part.get_param("name", header="content-disposition")
        part_filename = part.get_filename()
        payload = part.get_payload(decode=True) or b""
        if part_filename:
            filename = part_filename
            file_bytes = payload
        elif name:
            fields[str(name)] = payload.decode("utf-8", errors="replace").strip()

    return filename, file_bytes, fields


def _validate_save_payload(data: Any) -> Dict[str, Any]:
    if not isinstance(data, dict):
        raise ValueError("Payload inválido para salvar o documento.")
    required = (
        "filename",
        "tipo_documento",
        "prazo_ou_vigencia",
        "valor_envolvido",
        "urgencia",
        "resumo_executivo",
        "raw_text",
    )
    for field in required:
        if not isinstance(data.get(field), str) or not str(data.get(field)).strip():
            raise ValueError(f"Campo obrigatório ausente ou inválido: {field}.")

    urgencia = str(data["urgencia"]).upper().strip()
    if urgencia not in ("ALTA", "MEDIA", "BAIXA"):
        raise ValueError("Urgência inválida. Utilize ALTA, MEDIA ou BAIXA.")

    partes = data.get("partes_envolvidas")
    if not isinstance(partes, list):
        partes = []
    suggested = data.get("suggested_questions")
    if not isinstance(suggested, list):
        suggested = []
    usage = data.get("token_usage")
    if not isinstance(usage, dict):
        usage = {}

    return {
        "filename": _sanitize_filename(str(data["filename"])),
        "file_format": str(data.get("file_format") or "pdf")[:16],
        "tipo_documento": str(data["tipo_documento"]).strip()[:160],
        "numero_processo": (
            str(data["numero_processo"]).strip()[:80]
            if isinstance(data.get("numero_processo"), str)
            and data["numero_processo"].strip()
            else None
        ),
        "partes_envolvidas": [str(p).strip() for p in partes if str(p).strip()],
        "prazo_ou_vigencia": str(data["prazo_ou_vigencia"]).strip()[:255],
        "valor_envolvido": str(data["valor_envolvido"]).strip()[:120],
        "urgencia": urgencia,
        "resumo_executivo": str(data["resumo_executivo"]).strip(),
        "suggested_questions": [str(q).strip() for q in suggested if str(q).strip()][:4],
        "raw_text": str(data["raw_text"]),
        "page_count": max(1, int(data.get("page_count") or 1)),
        "extraction_model": str(data.get("extraction_model") or "")[:80],
        "token_usage": {
            "input_tokens": max(0, int(usage.get("input_tokens") or 0)),
            "output_tokens": max(0, int(usage.get("output_tokens") or 0)),
            "total_tokens": max(0, int(usage.get("total_tokens") or 0)),
        },
    }


def make_handler(serve_dist: bool):
    class JurisTriageHandler(BaseHTTPRequestHandler):
        protocol_version = "HTTP/1.1"

        def log_message(self, fmt: str, *args: Any) -> None:
            sys.stdout.write(f"[python-api] {self.address_string()} - {fmt % args}\n")
            sys.stdout.flush()

        def _send_json(self, status: int, payload: Dict[str, Any]) -> None:
            body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)

        def _read_body(self, max_bytes: int = MAX_UPLOAD_BYTES + 262144) -> bytes:
            raw_len = self.headers.get("Content-Length")
            if not raw_len or not raw_len.isdigit():
                return b""
            length = int(raw_len)
            if length > max_bytes:
                raise ValueError("Conteúdo excede o limite máximo permitido (10 MB).")
            return self.rfile.read(length) if length > 0 else b""

        def _read_json(self) -> Dict[str, Any]:
            raw = self._read_body(max_bytes=2 * 1024 * 1024)
            if not raw:
                return {}
            try:
                parsed = json.loads(raw.decode("utf-8"))
            except (UnicodeDecodeError, json.JSONDecodeError) as exc:
                raise ValueError("Corpo JSON inválido.") from exc
            if not isinstance(parsed, dict):
                raise ValueError("O corpo da requisição deve ser um objeto JSON.")
            return parsed

        def _serve_static(self, req_path: str) -> None:
            if not serve_dist or not DIST_DIR.exists():
                self._send_json(404, {"error": "Rota não encontrada."})
                return

            clean_rel = req_path.lstrip("/") or "index.html"
            candidate = (DIST_DIR / clean_rel).resolve()
            dist_root = DIST_DIR.resolve()
            if not str(candidate).startswith(str(dist_root) + os.sep) and candidate != dist_root:
                self._send_json(403, {"error": "Acesso negado."})
                return
            if not candidate.is_file():
                candidate = dist_root / "index.html"
            if not candidate.is_file():
                self._send_json(404, {"error": "Build dist/ não encontrado."})
                return

            data = candidate.read_bytes()
            ctype, _ = mimetypes.guess_type(str(candidate))
            self.send_response(200)
            self.send_header("Content-Type", ctype or "application/octet-stream")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def do_GET(self) -> None:  # noqa: N802
            path = urlparse(self.path).path
            if path == "/api/health":
                self._send_json(
                    200,
                    {"status": "ok", "service": "JurisTriage Python API", "runtime": "python-stdlib"},
                )
                return
            if path == "/api/models":
                self._send_json(200, {"models": list_available_models()})
                return
            if path == "/api/metrics/tokens":
                self._send_json(200, db.get_token_metrics())
                return
            if path == "/api/documents":
                self._send_json(200, {"documents": db.list_documents()})
                return
            if path == "/api/chat/global":
                self._send_json(200, {"messages": db.list_global_chat_messages()})
                return

            match_doc = re.fullmatch(r"/api/documents/(\d+)", path)
            if match_doc:
                doc_id = int(match_doc.group(1))
                doc = db.get_document_by_id(doc_id)
                if not doc:
                    self._send_json(404, {"error": "Documento não encontrado."})
                    return
                self._send_json(200, {"document": doc, "messages": db.list_chat_messages(doc_id)})
                return

            if path.startswith("/api/"):
                self._send_json(404, {"error": "Endpoint da API não encontrado."})
                return

            self._serve_static(path)

        def do_DELETE(self) -> None:  # noqa: N802
            path = urlparse(self.path).path
            if path == "/api/chat/global":
                db.clear_global_chat_messages()
                self._send_json(200, {"cleared": True})
                return

            match_doc = re.fullmatch(r"/api/documents/(\d+)", path)
            if match_doc:
                doc_id = int(match_doc.group(1))
                if not db.delete_document_by_id(doc_id):
                    self._send_json(404, {"error": "Documento não encontrado."})
                    return
                self._send_json(200, {"deleted": True, "id": doc_id})
                return

            self._send_json(404, {"error": "Endpoint da API não encontrado."})

        def do_POST(self) -> None:  # noqa: N802
            path = urlparse(self.path).path
            try:
                if path == "/api/documents/analyze":
                    ctype = self.headers.get("Content-Type", "")
                    if "multipart/form-data" not in ctype.lower():
                        self._send_json(400, {"error": "Envie o arquivo usando multipart/form-data."})
                        return
                    raw_body = self._read_body()
                    filename, file_bytes, fields = _parse_multipart(ctype, raw_body)
                    if not filename or file_bytes is None:
                        self._send_json(400, {"error": "Nenhum arquivo foi enviado."})
                        return
                    if len(file_bytes) > MAX_UPLOAD_BYTES:
                        self._send_json(400, {"error": "Arquivo excede o limite de 10 MB."})
                        return

                    safe_name = _sanitize_filename(filename)
                    raw_text, page_count, file_format = extract_document_with_pages(
                        file_bytes, safe_name
                    )
                    extracted, usage, model_used = extract_document_metadata(
                        raw_text, safe_name, requested_model=fields.get("model")
                    )
                    staged = {
                        "filename": safe_name,
                        "file_format": file_format,
                        **extracted,
                        "raw_text": raw_text,
                        "page_count": page_count,
                        "extraction_model": model_used,
                        "token_usage": usage,
                    }
                    self._send_json(200, {"staged": staged})
                    return

                if path == "/api/documents":
                    payload = _validate_save_payload(self._read_json())
                    saved = db.create_document(payload)
                    self._send_json(201, {"document": saved})
                    return

                if path == "/api/chat/global":
                    data = self._read_json()
                    question = str(data.get("question") or "").strip()
                    model = str(data.get("model") or "").strip() or None
                    if len(question) < 2:
                        self._send_json(400, {"error": "Digite uma pergunta válida."})
                        return
                    if len(question) > 1500:
                        self._send_json(400, {"error": "A pergunta excede o limite de 1500 caracteres."})
                        return

                    documents = db.list_documents()
                    history = [(m["role"], m["content"]) for m in db.list_global_chat_messages()]
                    rag_answer, usage, model_used = answer_global_question(
                        documents=documents,
                        question=question,
                        history=history,
                        requested_model=model,
                    )
                    user_msg = db.create_global_chat_message("user", question)
                    assistant_msg = db.create_global_chat_message(
                        role="assistant",
                        content=rag_answer["resposta"],
                        citations=rag_answer["citations"],
                        token_usage=usage,
                        model_used=model_used,
                    )
                    self._send_json(
                        200,
                        {
                            "userMessage": user_msg,
                            "assistantMessage": assistant_msg,
                            "foundInBase": rag_answer["encontrado_na_base"],
                        },
                    )
                    return

                match_chat = re.fullmatch(r"/api/documents/(\d+)/chat", path)
                if match_chat:
                    doc_id = int(match_chat.group(1))
                    doc = db.get_document_by_id(doc_id)
                    if not doc:
                        self._send_json(404, {"error": "Documento não encontrado."})
                        return

                    data = self._read_json()
                    question = str(data.get("question") or "").strip()
                    model = str(data.get("model") or "").strip() or None
                    if len(question) < 2:
                        self._send_json(400, {"error": "Digite uma pergunta válida sobre o documento."})
                        return
                    if len(question) > 1500:
                        self._send_json(400, {"error": "A pergunta excede o limite de 1500 caracteres."})
                        return

                    history = [(m["role"], m["content"]) for m in db.list_chat_messages(doc_id)]
                    rag_answer, usage, model_used = answer_document_question(
                        raw_text=doc["raw_text"],
                        filename=doc["filename"],
                        question=question,
                        history=history,
                        requested_model=model,
                    )
                    user_msg = db.create_chat_message(doc_id, "user", question)
                    assistant_msg = db.create_chat_message(
                        document_id=doc_id,
                        role="assistant",
                        content=rag_answer["resposta"],
                        cited_pages=rag_answer["paginas_citadas"],
                        token_usage=usage,
                        model_used=model_used,
                    )
                    updated_doc = db.get_document_by_id(doc_id)
                    self._send_json(
                        200,
                        {
                            "userMessage": user_msg,
                            "assistantMessage": assistant_msg,
                            "foundInDocument": rag_answer["encontrado_no_documento"],
                            "processTotalTokens": (
                                updated_doc["process_total_tokens"] if updated_doc else 0
                            ),
                        },
                    )
                    return

                self._send_json(404, {"error": "Endpoint da API não encontrado."})
            except Exception as exc:  # noqa: BLE001
                status, message = _map_error(exc)
                self._send_json(status, {"error": message})

    return JurisTriageHandler


class ReusableThreadingHTTPServer(ThreadingHTTPServer):
    allow_reuse_address = True
    daemon_threads = True


def _has_fastapi_runtime() -> bool:
    return (
        importlib.util.find_spec("fastapi") is not None
        and importlib.util.find_spec("uvicorn") is not None
    )


def _wait_for_health(port: int, timeout_s: float = 8.0) -> None:
    deadline = time.time() + timeout_s
    url = f"http://127.0.0.1:{port}/api/health"
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=1.0) as resp:
                if resp.status == 200:
                    return
        except Exception:  # noqa: BLE001
            time.sleep(0.15)


def main() -> None:
    parser = argparse.ArgumentParser(description="JurisTriage Python Backend Launcher")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--with-vite", action="store_true")
    parser.add_argument("--serve-dist", action="store_true")
    args = parser.parse_args()

    db.init_db()

    use_fastapi = _has_fastapi_runtime() and not args.serve_dist

    if args.with_vite:
        backend_proc: Optional[subprocess.Popen[bytes]] = None
        http_server: Optional[ReusableThreadingHTTPServer] = None

        if use_fastapi:
            backend_proc = subprocess.Popen(
                [
                    sys.executable,
                    "-m",
                    "uvicorn",
                    "backend.main:app",
                    "--host",
                    "127.0.0.1",
                    "--port",
                    str(args.port),
                ],
                cwd=str(ROOT_DIR),
            )
            print(f"[JurisTriage] FastAPI (uvicorn) iniciado na porta {args.port}")
        else:
            http_server = ReusableThreadingHTTPServer(
                ("127.0.0.1", args.port), make_handler(serve_dist=False)
            )
            thread = threading.Thread(target=http_server.serve_forever, daemon=True)
            thread.start()
            print(f"[JurisTriage] Backend Python nativo iniciado em http://127.0.0.1:{args.port}")

        _wait_for_health(args.port)

        vite_bin = ROOT_DIR / "node_modules" / ".bin" / "vite"
        vite_cmd = (
            [str(vite_bin), "--port=3000", "--host=0.0.0.0"]
            if vite_bin.exists()
            else ["npx", "vite", "--port=3000", "--host=0.0.0.0"]
        )
        vite_proc = subprocess.Popen(vite_cmd, cwd=str(ROOT_DIR))

        def _shutdown(_signum: int, _frame: Any) -> None:
            if vite_proc.poll() is None:
                vite_proc.terminate()
            if backend_proc and backend_proc.poll() is None:
                backend_proc.terminate()
            if http_server:
                http_server.shutdown()
            sys.exit(0)

        signal.signal(signal.SIGINT, _shutdown)
        signal.signal(signal.SIGTERM, _shutdown)

        exit_code = vite_proc.wait()
        if backend_proc and backend_proc.poll() is None:
            backend_proc.terminate()
        if http_server:
            http_server.shutdown()
        sys.exit(exit_code)

    if use_fastapi:
        import uvicorn  # type: ignore[import-not-found]

        uvicorn.run("backend.main:app", host=args.host, port=args.port)
        return

    bind_host = "0.0.0.0" if args.serve_dist else args.host
    server = ReusableThreadingHTTPServer((bind_host, args.port), make_handler(args.serve_dist))
    print(f"[JurisTriage] Backend Python nativo rodando em http://{bind_host}:{args.port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
