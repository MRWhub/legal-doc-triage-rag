import type {
  AiModelOption,
  ChatMessage,
  DocumentDetailResponse,
  GlobalChatMessage,
  LegalDocument,
  StagedDocument,
  TokenMetrics,
} from '../types';

async function handleJsonResponse<T>(res: Response): Promise<T> {
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      typeof payload?.error === 'string'
        ? payload.error
        : typeof payload?.detail === 'string'
          ? payload.detail
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

export async function fetchTokenMetrics(): Promise<TokenMetrics> {
  const res = await fetch('/api/metrics/tokens');
  return handleJsonResponse<TokenMetrics>(res);
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

export async function analyzeDocumentFile(
  file: File,
  model?: string
): Promise<StagedDocument> {
  const formData = new FormData();
  formData.append('file', file);
  if (model) {
    formData.append('model', model);
  }

  const res = await fetch('/api/documents/analyze', {
    method: 'POST',
    body: formData,
  });
  const data = await handleJsonResponse<{ staged: StagedDocument }>(res);
  return data.staged;
}

export async function saveStagedDocument(
  staged: StagedDocument
): Promise<LegalDocument> {
  const res = await fetch('/api/documents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(staged),
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
  processTotalTokens: number;
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
    processTotalTokens: number;
  }>(res);
}

export async function fetchGlobalChatMessages(): Promise<GlobalChatMessage[]> {
  const res = await fetch('/api/chat/global');
  const data = await handleJsonResponse<{ messages: GlobalChatMessage[] }>(res);
  return data.messages;
}

export async function sendGlobalChatQuestion(
  question: string,
  model?: string
): Promise<{
  userMessage: GlobalChatMessage;
  assistantMessage: GlobalChatMessage;
  foundInBase: boolean;
}> {
  const res = await fetch('/api/chat/global', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(model ? { question, model } : { question }),
  });
  return handleJsonResponse<{
    userMessage: GlobalChatMessage;
    assistantMessage: GlobalChatMessage;
    foundInBase: boolean;
  }>(res);
}

export async function clearGlobalChatMessages(): Promise<void> {
  const res = await fetch('/api/chat/global', { method: 'DELETE' });
  await handleJsonResponse<{ cleared: boolean }>(res);
}
