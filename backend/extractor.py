"""Extrator universal de documentos (PDF, TXT e Markdown) com marcadores [Pág. X]."""

from __future__ import annotations

import re
import zlib
from io import BytesIO
from pathlib import Path
from typing import List, Tuple

ALLOWED_EXTENSIONS = {".pdf", ".txt", ".md"}
MAX_CHARS_PER_TEXT_PAGE = 2800


def _normalize_text(text: str) -> str:
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"[ \t]+\n", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _decode_pdf_string(raw: bytes) -> str:
    """Decodifica string literal PDF lidando com escapes octais e padrão."""
    out = bytearray()
    i = 0
    length = len(raw)
    while i < length:
        ch = raw[i]
        if ch == 0x5C and i + 1 < length:  # backslash
            nxt = raw[i + 1]
            if nxt in (ord("n"), ord("r"), ord("t"), ord("b"), ord("f")):
                mapping = {
                    ord("n"): b"\n",
                    ord("r"): b"\r",
                    ord("t"): b"\t",
                    ord("b"): b"\b",
                    ord("f"): b"\f",
                }
                out.extend(mapping[nxt])
                i += 2
            elif nxt in (ord("("), ord(")"), ord("\\")):
                out.append(nxt)
                i += 2
            elif nxt in (0x0A, 0x0D):
                i += 2
                if i < length and raw[i - 1] == 0x0D and raw[i] == 0x0A:
                    i += 1
            elif 0x30 <= nxt <= 0x37:
                oct_digits = raw[i + 1 : i + 4]
                match = re.match(rb"[0-7]{1,3}", oct_digits)
                if match:
                    out.append(int(match.group(0), 8) & 0xFF)
                    i += 1 + len(match.group(0))
                else:
                    i += 2
            else:
                out.append(nxt)
                i += 2
        else:
            out.append(ch)
            i += 1

    try:
        return out.decode("utf-8")
    except UnicodeDecodeError:
        return out.decode("cp1252", errors="replace")


def _decode_pdf_hex(hex_bytes: bytes) -> str:
    cleaned = re.sub(rb"\s+", b"", hex_bytes)
    if len(cleaned) % 2 == 1:
        cleaned += b"0"
    try:
        data = bytes.fromhex(cleaned.decode("ascii"))
    except ValueError:
        return ""
    if data.startswith(b"\xfe\xff"):
        return data[2:].decode("utf-16-be", errors="replace")
    if data.startswith(b"\xff\xfe"):
        return data[2:].decode("utf-16-le", errors="replace")
    try:
        return data.decode("utf-8")
    except UnicodeDecodeError:
        return data.decode("cp1252", errors="replace")


def _extract_text_from_pdf_stream(stream_data: bytes) -> str:
    """Extrai operadores de texto (Tj, TJ, ', \") de um stream de conteúdo PDF."""
    pieces: List[str] = []
    i = 0
    n = len(stream_data)

    def read_literal(pos: int) -> Tuple[bytes, int]:
        depth = 0
        buf = bytearray()
        pos += 1  # skip '('
        while pos < n:
            b = stream_data[pos]
            if b == 0x5C and pos + 1 < n:
                buf.append(b)
                buf.append(stream_data[pos + 1])
                pos += 2
                continue
            if b == 0x28:  # '('
                depth += 1
                buf.append(b)
            elif b == 0x29:  # ')'
                if depth == 0:
                    return bytes(buf), pos + 1
                depth -= 1
                buf.append(b)
            else:
                buf.append(b)
            pos += 1
        return bytes(buf), pos

    # Captura blocos BT ... ET quando presentes; caso contrário varre stream inteiro
    bt_blocks = re.findall(rb"BT\b(.*?)\bET", stream_data, flags=re.DOTALL)
    targets = bt_blocks if bt_blocks else [stream_data]

    for block in targets:
        block_pieces: List[str] = []
        i = 0
        n = len(block)
        stream_data = block
        while i < n:
            b = stream_data[i]
            if b == 0x28:  # '('
                lit, i = read_literal(i)
                text = _decode_pdf_string(lit)
                if text:
                    block_pieces.append(text)
            elif b == 0x3C and i + 1 < n and stream_data[i + 1] != 0x3C:  # '<' hex string
                end = stream_data.find(b">", i + 1)
                if end != -1:
                    text = _decode_pdf_hex(stream_data[i + 1 : end])
                    if text:
                        block_pieces.append(text)
                    i = end + 1
                else:
                    i += 1
            elif b in (ord("T"), ord("'")):
                if stream_data[i : i + 2] in (b"Td", b"TD", b"T*"):
                    block_pieces.append("\n")
                    i += 2
                else:
                    i += 1
            else:
                i += 1
        joined = "".join(block_pieces).strip()
        if joined:
            pieces.append(joined)

    return _normalize_text("\n".join(pieces))


def _extract_pdf_stdlib_fallback(file_bytes: bytes) -> List[str]:
    """Extrator PDF puro em Python stdlib usado quando pypdf não está instalado."""
    objects: dict[int, bytes] = {}
    for match in re.finditer(rb"(\d+)\s+\d+\s+obj\b(.*?)endobj", file_bytes, flags=re.DOTALL):
        obj_num = int(match.group(1))
        objects[obj_num] = match.group(2)

    def get_stream_text(obj_num: int) -> str:
        body = objects.get(obj_num, b"")
        m = re.search(rb"stream\r?\n(.*?)\r?\n?endstream", body, flags=re.DOTALL)
        if not m:
            return ""
        raw_stream = m.group(1)
        if b"/FlateDecode" in body:
            try:
                raw_stream = zlib.decompress(raw_stream)
            except zlib.error:
                try:
                    raw_stream = zlib.decompress(raw_stream.strip())
                except zlib.error:
                    return ""
        return _extract_text_from_pdf_stream(raw_stream)

    pages_text: List[str] = []
    # Localiza objetos /Type /Page (não /Pages)
    for obj_num in sorted(objects.keys()):
        body = objects[obj_num]
        if not re.search(rb"/Type\s*/Page\b(?!s)", body):
            continue
        contents_refs: List[int] = []
        array_match = re.search(rb"/Contents\s*\[(.*?)\]", body, flags=re.DOTALL)
        if array_match:
            contents_refs = [int(x) for x in re.findall(rb"(\d+)\s+\d+\s+R", array_match.group(1))]
        else:
            single_match = re.search(rb"/Contents\s+(\d+)\s+\d+\s+R", body)
            if single_match:
                contents_refs = [int(single_match.group(1))]

        page_parts = [get_stream_text(ref) for ref in contents_refs]
        page_content = _normalize_text("\n".join(p for p in page_parts if p))
        pages_text.append(page_content)

    # Fallback amplo se os /Page estiverem dentro de ObjStm compactado
    if not any(pages_text):
        fallback_streams: List[str] = []
        for match in re.finditer(rb"stream\r?\n(.*?)\r?\n?endstream", file_bytes, flags=re.DOTALL):
            chunk = match.group(1)
            for candidate in (chunk,):
                try:
                    decompressed = zlib.decompress(candidate)
                except zlib.error:
                    decompressed = candidate
                if b"BT" in decompressed and b"ET" in decompressed:
                    extracted = _extract_text_from_pdf_stream(decompressed)
                    if extracted:
                        fallback_streams.append(extracted)
        if fallback_streams:
            pages_text = fallback_streams

    return pages_text


def _extract_pdf_pages(file_bytes: bytes) -> List[str]:
    if not file_bytes or not file_bytes.startswith(b"%PDF-"):
        raise ValueError("Arquivo inválido: o conteúdo não possui assinatura PDF (%PDF-).")

    try:
        from pypdf import PdfReader  # type: ignore[import-not-found]

        reader = PdfReader(BytesIO(file_bytes))
        if len(reader.pages) == 0:
            raise ValueError("O arquivo PDF enviado não possui páginas legíveis.")
        return [_normalize_text(page.extract_text() or "") for page in reader.pages]
    except ImportError:
        pages = _extract_pdf_stdlib_fallback(file_bytes)
        if not pages:
            raise ValueError(
                "Não foi possível extrair texto deste PDF no modo sem pypdf. "
                "Instale as dependências com 'pip install -r backend/requirements.txt' ou envie um arquivo .txt/.md."
            )
        return pages


def _extract_text_file_pages(file_bytes: bytes) -> List[str]:
    if not file_bytes:
        raise ValueError("O arquivo enviado está vazio.")
    if b"\x00" in file_bytes[:4096]:
        raise ValueError("Arquivo inválido: conteúdo binário detectado em arquivo de texto.")

    try:
        decoded = file_bytes.decode("utf-8")
    except UnicodeDecodeError:
        decoded = file_bytes.decode("latin-1", errors="replace")

    normalized = _normalize_text(decoded)
    if not normalized:
        raise ValueError("O arquivo não contém texto legível para análise.")

    # Paginação lógica respeitando quebras de parágrafo para manter rastreabilidade [Pág. X]
    paragraphs = re.split(r"\n{2,}", normalized)
    pages: List[str] = []
    current_parts: List[str] = []
    current_len = 0

    for para in paragraphs:
        para_clean = para.strip()
        if not para_clean:
            continue
        if current_parts and current_len + len(para_clean) + 2 > MAX_CHARS_PER_TEXT_PAGE:
            pages.append("\n\n".join(current_parts))
            current_parts = [para_clean]
            current_len = len(para_clean)
        else:
            current_parts.append(para_clean)
            current_len += len(para_clean) + 2

    if current_parts:
        pages.append("\n\n".join(current_parts))

    return pages or [normalized]


def extract_document_with_pages(file_bytes: bytes, filename: str) -> Tuple[str, int, str]:
    """Extrai texto de PDF, TXT ou Markdown preservando marcadores padronizados [Pág. X].

    Retorna: (raw_text_paginado, page_count, file_format)
    """
    ext = Path(filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise ValueError(
            "Formato não suportado. Envie arquivos nos formatos PDF (.pdf), Texto (.txt) ou Markdown (.md)."
        )

    if ext == ".pdf":
        pages = _extract_pdf_pages(file_bytes)
        file_format = "pdf"
    else:
        pages = _extract_text_file_pages(file_bytes)
        file_format = ext.lstrip(".")

    if not any(page.strip() for page in pages):
        raise ValueError(
            "Não foi possível extrair texto deste documento. Verifique se o PDF não é apenas imagem digitalizada sem OCR."
        )

    formatted_sections = [
        f"[Pág. {index}]\n{page if page else '[Página sem texto extraível]'}"
        for index, page in enumerate(pages, start=1)
    ]
    return "\n\n".join(formatted_sections), len(pages), file_format
