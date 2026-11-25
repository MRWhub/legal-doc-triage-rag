import type {
  AiModelOption,
  ChatMessage,
  DocumentDetailResponse,
  LegalDocument,
  SampleDocumentInfo,
} from '../types';

async function handleJsonResponse<T>(res: Response): Promise<T> {
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      typeof payload?.error === 'string'
        ? payload.error
        : `Erro na requisição (HTTP ${res.status}).`;
    throw new Error(message);
  }
  return payload as T;
}

export async function fetchModels(): Promise<AiModelOption[]> {
  const res = await fetch('/api/models');
  const data = await handleJsonResponse<{ models: AiModelOption[] }>(res);
  return data.models;
}

export async function fetchDocuments(): Promise<LegalDocument[]> {
  const res = await fetch('/api/documents');
  const data = await handleJsonResponse<{ documents: LegalDocument[] }>(res);
  return data.documents;
}

export async function fetchDocumentDetail(id: number): Promise<DocumentDetailResponse> {
  const res = await fetch(`/api/documents/${id}`);
  return handleJsonResponse<DocumentDetailResponse>(res);
}

export async function uploadPdfDocument(
  file: File,
  model?: string
): Promise<LegalDocument> {
  const formData = new FormData();
  formData.append('file', file);
  if (model) {
    formData.append('model', model);
  }

  const res = await fetch('/api/documents/upload', {
    method: 'POST',
    body: formData,
  });
  const data = await handleJsonResponse<{ document: LegalDocument }>(res);
  return data.document;
}

export async function deleteDocument(id: number): Promise<void> {
  const res = await fetch(`/api/documents/${id}`, {
    method: 'DELETE',
  });
  await handleJsonResponse<{ deleted: boolean }>(res);
}

export async function sendChatQuestion(
  documentId: number,
  question: string,
  model?: string
): Promise<{
  userMessage: ChatMessage;
  assistantMessage: ChatMessage;
  foundInDocument: boolean;
}> {
  const res = await fetch(`/api/documents/${documentId}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(model ? { question, model } : { question }),
  });
  return handleJsonResponse<{
    userMessage: ChatMessage;
    assistantMessage: ChatMessage;
    foundInDocument: boolean;
  }>(res);
}

export async function fetchSamples(): Promise<SampleDocumentInfo[]> {
  const res = await fetch('/api/samples');
  const data = await handleJsonResponse<{ samples: SampleDocumentInfo[] }>(res);
  return data.samples;
}

export async function loadSamples(
  slug?: string,
  model?: string
): Promise<LegalDocument[]> {
  const body: Record<string, string> = {};
  if (slug) body.slug = slug;
  if (model) body.model = model;

  const res = await fetch('/api/samples/load', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await handleJsonResponse<{ documents: LegalDocument[] }>(res);
  return data.documents;
}
