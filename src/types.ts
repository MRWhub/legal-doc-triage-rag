export type UrgencyLevel = 'ALTA' | 'MEDIA' | 'BAIXA';

export interface LegalDocument {
  id: number;
  filename: string;
  tipo_documento: string;
  numero_processo: string | null;
  partes_envolvidas: string[];
  prazo_ou_vigencia: string;
  valor_envolvido: string;
  urgencia: UrgencyLevel;
  resumo_executivo: string;
  raw_text: string;
  page_count: number;
  created_at: string;
}

export interface ChatMessage {
  id: number;
  document_id: number;
  role: 'user' | 'assistant';
  content: string;
  cited_pages: number[];
  created_at: string;
}

export interface DocumentDetailResponse {
  document: LegalDocument;
  messages: ChatMessage[];
}

export interface SampleDocumentInfo {
  slug: string;
  filename: string;
  title: string;
  category: string;
  expectedUrgency: UrgencyLevel;
  hasCnj: boolean;
  summary: string;
  pageCount: number;
}

export interface AiModelOption {
  id: string;
  label: string;
  provider: 'google' | 'groq';
  description: string;
  configured: boolean;
  isDefault: boolean;
}
