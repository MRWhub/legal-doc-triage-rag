from io import BytesIO
from typing import Tuple

from pypdf import PdfReader


def extract_pdf_text_with_pages(file_bytes: bytes) -> Tuple[str, int]:
    """Extrai texto de um PDF preservando marcadores explícitos --- PÁGINA X ---."""
    if not file_bytes or not file_bytes.startswith(b"%PDF-"):
        raise ValueError("Arquivo inválido: o conteúdo não possui assinatura PDF (%PDF-).")

    reader = PdfReader(BytesIO(file_bytes))
    total_pages = len(reader.pages)
    if total_pages == 0:
        raise ValueError("O arquivo PDF enviado não possui páginas legíveis.")

    sections = []
    has_any_text = False

    for index, page in enumerate(reader.pages, start=1):
        raw_page_text = (page.extract_text() or "").strip()
        if raw_page_text:
            has_any_text = True
        page_body = raw_page_text if raw_page_text else "[Página sem texto extraível]"
        sections.append(f"--- PÁGINA {index} ---\n{page_body}")

    if not has_any_text:
        raise ValueError(
            "Não foi possível extrair texto deste PDF. Verifique se o arquivo não é uma imagem sem OCR."
        )

    return "\n\n".join(sections), total_pages
