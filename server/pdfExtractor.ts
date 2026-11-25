import { extractText } from 'unpdf';

export interface ExtractedPdfResult {
  text: string;
  pageCount: number;
  pages: string[];
}

export function isValidPdfBuffer(buffer: Buffer): boolean {
  if (!buffer || buffer.length < 5) {
    return false;
  }
  const header = buffer.subarray(0, 5).toString('ascii');
  return header === '%PDF-';
}

export async function extractPdfWithPages(buffer: Buffer): Promise<ExtractedPdfResult> {
  if (!isValidPdfBuffer(buffer)) {
    throw new Error('Arquivo inválido: o conteúdo enviado não possui cabeçalho PDF válido (%PDF-).');
  }

  const uint8 = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const { totalPages, text } = await extractText(uint8, { mergePages: false });

  const rawPages = Array.isArray(text) ? text : [String(text ?? '')];
  const normalizedPages = rawPages.map((pageText) =>
    pageText
      .replace(/\r\n/g, '\n')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  );

  const nonEmptyPages = normalizedPages.filter((p) => p.length > 0);
  if (nonEmptyPages.length === 0) {
    throw new Error(
      'Não foi possível extrair texto deste PDF. Verifique se o documento não é apenas uma imagem digitalizada sem OCR.'
    );
  }

  const formattedText = normalizedPages
    .map((pageText, index) => `--- PÁGINA ${index + 1} ---\n${pageText || '[Página sem texto extraível]'}`)
    .join('\n\n');

  return {
    text: formattedText,
    pageCount: totalPages || normalizedPages.length,
    pages: normalizedPages,
  };
}
