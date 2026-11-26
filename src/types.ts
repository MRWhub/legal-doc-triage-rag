export type UrgencyLevel = 'ALTA' | 'MEDIA' | 'BAIXA';

export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
}

export interface StagedDocument {
  filename: string;
  file_format: string;
  tipo_documento: string;
  numero_processo: string | null;
  partes_envolvidas: string[];
  prazo_ou_vigencia: string;
  valor_envolvido: string;
  urgencia: UrgencyLevel;
  resumo_executivo: string;
  suggested_questions: string[];
  raw_text: string;
  page_count: number;
  extraction_model: string;
  token_usage: TokenUsage;
}

export interface LegalDocument extends StagedDocument {
  id: number;
  process_total_tokens: number;
  created_at: string;
}

export interface ChatMessage {
  id: number;
  document_id: number;
  role: 'user' | 'assistant';
  content: string;
  cited_pages: number[];
  token_usage: TokenUsage;
  model_used: string;
  created_at: string;
}

export interface DocumentDetailResponse {
  document: LegalDocument;
  messages: ChatMessage[];
}

export interface GlobalCitation {
  document_id: number;
  filename: string;
  page: number;
}

export interface GlobalChatMessage {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  citations: GlobalCitation[];
  token_usage: TokenUsage;
  model_used: string;
  created_at: string;
}

export interface TokenMetrics {
  document_count: number;
  chat_operations: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_tokens: number;
}

export interface AiModelOption {
  id: string;
  label: string;
  provider: 'google' | 'groq';
  description: string;
  configured: boolean;
  isDefault: boolean;
}
