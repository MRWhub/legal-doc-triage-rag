import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  Check,
  Database,
  FileText,
  Loader2,
  Send,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import type {
  ChatMessage,
  GlobalChatMessage,
  GlobalCitation,
  LegalDocument,
  StagedDocument,
  UrgencyLevel,
} from '../types';

export type RagChatMode = 'document' | 'global';

interface DocumentDetailProps {
  stagedDocument: StagedDocument | null;
  viewingStaged: boolean;
  isSavingStaged: boolean;
  onSaveStaged: () => Promise<void>;
  onDiscardStaged: () => void;
  document: LegalDocument | null;
  savedDocumentsCount: number;
  messages: ChatMessage[];
  globalMessages: GlobalChatMessage[];
  chatMode: RagChatMode;
  onChangeChatMode: (mode: RagChatMode) => void;
  isLoadingDetail: boolean;
  isSendingChat: boolean;
  isSendingGlobalChat: boolean;
  chatError: string | null;
  onSendQuestion: (question: string) => Promise<void>;
  onSendGlobalQuestion: (question: string) => Promise<void>;
  onClearGlobalChat: () => Promise<void>;
  onOpenCitation: (citation: GlobalCitation) => void;
  onDeleteDocument: (id: number) => Promise<void>;
  onTriggerUpload: () => void;
  jumpToPageRequest: { docId: number; page: number; nonce: number } | null;
}

const URGENCY_META: Record<UrgencyLevel, { label: string; colorClass: string }> = {
  ALTA: { label: 'Urgência Alta', colorClass: 'text-[#B91C1C]' },
  MEDIA: { label: 'Urgência Média', colorClass: 'text-[#B45309]' },
  BAIXA: { label: 'Urgência Baixa', colorClass: 'text-[#15803D]' },
};

const GLOBAL_SUGGESTED_QUERIES = [
  'Quais documentos salvos têm urgência ALTA e quais são seus prazos críticos?',
  'Liste todos os documentos da base com seus respectivos valores envolvidos e partes.',
  'Existe alguma cláusula de multa, penalidade ou rescisão nos documentos salvos?',
];

interface ParsedPage {
  pageNumber: number;
  content: string;
}

function parsePaginatedText(rawText: string): ParsedPage[] {
  const regex = /(?:\[Pág\.\s*(\d+)\]|---\s*PÁGINA\s+(\d+)\s*---)/gi;
  const matches = Array.from(rawText.matchAll(regex));

  if (matches.length === 0) {
    return [{ pageNumber: 1, content: rawText.trim() }];
  }

  return matches.map((match, index) => {
    const pageNumber = Number(match[1] || match[2]) || index + 1;
    const start = (match.index ?? 0) + match[0].length;
    const end =
      index + 1 < matches.length
        ? matches[index + 1].index ?? rawText.length
        : rawText.length;
    return {
      pageNumber,
      content: rawText.slice(start, end).trim(),
    };
  });
}

function StructuredSheet({
  item,
  processTotalTokens,
}: {
  item: StagedDocument;
  processTotalTokens?: number;
}) {
  const urgencyInfo = URGENCY_META[item.urgencia];
  const extTokens = item.token_usage;

  return (
    <div className="border border-[#E2E8F0] bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E2E8F0] px-6 py-4">
        <h2 className="font-editorial text-lg font-semibold text-[#0F172A]">
          Ficha Estruturada Normalizada
        </h2>
        <div className="tabular-data flex flex-wrap items-center gap-x-2 text-xs text-[#64748B]">
          <span>
            Extração: {extTokens.input_tokens.toLocaleString('pt-BR')} in ·{' '}
            {extTokens.output_tokens.toLocaleString('pt-BR')} out ·{' '}
            <strong className="text-[#0F172A]">
              {extTokens.total_tokens.toLocaleString('pt-BR')} tok
            </strong>
          </span>
          {typeof processTotalTokens === 'number' && processTotalTokens > extTokens.total_tokens && (
            <>
              <span aria-hidden="true">·</span>
              <span>
                Total processo:{' '}
                <strong className="text-[#1E3A5F]">
                  {processTotalTokens.toLocaleString('pt-BR')} tok
                </strong>
              </span>
            </>
          )}
        </div>
      </div>

      <dl className="grid grid-cols-1 divide-y divide-[#E2E8F0] sm:grid-cols-2 sm:divide-y-0">
        <div className="border-b border-[#E2E8F0] px-6 py-4 sm:border-r">
          <dt className="text-xs font-medium text-[#64748B]">
            Protocolo / Número CNJ
          </dt>
          <dd className="mt-1 tabular-data text-sm font-medium text-[#0F172A]">
            {item.numero_processo ?? 'Não aplicável'}
          </dd>
        </div>

        <div className="border-b border-[#E2E8F0] px-6 py-4">
          <dt className="text-xs font-medium text-[#64748B]">Valor Envolvido</dt>
          <dd className="mt-1 tabular-data text-sm font-medium text-[#0F172A]">
            {item.valor_envolvido || 'Não aplicável'}
          </dd>
        </div>

        <div className="border-b border-[#E2E8F0] px-6 py-4 sm:border-r">
          <dt className="text-xs font-medium text-[#64748B]">Prazo ou Vigência</dt>
          <dd className="mt-1 text-sm font-medium text-[#0F172A]">
            {item.prazo_ou_vigencia || 'Não aplicável'}
          </dd>
        </div>

        <div className="border-b border-[#E2E8F0] px-6 py-4">
          <dt className="text-xs font-medium text-[#64748B]">
            Classificação de Urgência
          </dt>
          <dd className={`mt-1 text-sm font-semibold ${urgencyInfo.colorClass}`}>
            {urgencyInfo.label} ({item.urgencia})
          </dd>
        </div>

        <div className="border-b border-[#E2E8F0] px-6 py-4 sm:col-span-2">
          <dt className="text-xs font-medium text-[#64748B]">
            Partes / Entidades Envolvidas
          </dt>
          <dd className="mt-2">
            {item.partes_envolvidas.length > 0 ? (
              <ul className="space-y-1 text-sm text-[#0F172A]">
                {item.partes_envolvidas.map((parte, idx) => (
                  <li key={idx} className="leading-snug">
                    {parte}
                  </li>
                ))}
              </ul>
            ) : (
              <span className="text-sm text-[#64748B]">Não aplicável</span>
            )}
          </dd>
        </div>

        <div className="px-6 py-4 sm:col-span-2">
          <dt className="text-xs font-medium text-[#64748B]">Resumo Executivo</dt>
          <dd className="mt-1.5 max-w-[70ch] text-sm leading-relaxed text-[#0F172A]">
            {item.resumo_executivo}
          </dd>
        </div>
      </dl>
    </div>
  );
}

export function DocumentDetail({
  stagedDocument,
  viewingStaged,
  isSavingStaged,
  onSaveStaged,
  onDiscardStaged,
  document,
  savedDocumentsCount,
  messages,
  globalMessages,
  chatMode,
  onChangeChatMode,
  isLoadingDetail,
  isSendingChat,
  isSendingGlobalChat,
  chatError,
  onSendQuestion,
  onSendGlobalQuestion,
  onClearGlobalChat,
  onOpenCitation,
  onDeleteDocument,
  onTriggerUpload,
  jumpToPageRequest,
}: DocumentDetailProps) {
  const [activeTab, setActiveTab] = useState<'overview_chat' | 'raw_pages'>('overview_chat');
  const [highlightedPage, setHighlightedPage] = useState<number | null>(null);
  const [questionInput, setQuestionInput] = useState('');
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const pageRefs = useRef<Record<number, HTMLElement | null>>({});

  useEffect(() => {
    setActiveTab('overview_chat');
    setHighlightedPage(null);
    setConfirmingDelete(false);
    setQuestionInput('');
  }, [document?.id, viewingStaged]);

  useEffect(() => {
    if (
      jumpToPageRequest &&
      document &&
      jumpToPageRequest.docId === document.id &&
      !viewingStaged
    ) {
      setHighlightedPage(jumpToPageRequest.page);
      setActiveTab('raw_pages');
    }
  }, [jumpToPageRequest, document, viewingStaged]);

  useEffect(() => {
    if (activeTab === 'overview_chat') {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [messages.length, globalMessages.length, isSendingChat, isSendingGlobalChat, activeTab, chatMode]);

  useEffect(() => {
    if (activeTab === 'raw_pages' && highlightedPage !== null) {
      const target = pageRefs.current[highlightedPage];
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }, [activeTab, highlightedPage]);

  const activeTextTarget = viewingStaged ? stagedDocument : document;
  const parsedPages = useMemo(
    () => (activeTextTarget ? parsePaginatedText(activeTextTarget.raw_text) : []),
    [activeTextTarget]
  );

  const handleJumpToPage = (pageNum: number) => {
    setHighlightedPage(pageNum);
    setActiveTab('raw_pages');
  };

  const handleSubmitChat = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = questionInput.trim();
    if (!trimmed) return;
    if (chatMode === 'global') {
      if (isSendingGlobalChat) return;
      setQuestionInput('');
      await onSendGlobalQuestion(trimmed);
    } else {
      if (isSendingChat) return;
      setQuestionInput('');
      await onSendQuestion(trimmed);
    }
  };

  const handleConfirmDelete = async () => {
    if (!document || isDeleting) return;
    setIsDeleting(true);
    try {
      await onDeleteDocument(document.id);
    } finally {
      setIsDeleting(false);
      setConfirmingDelete(false);
    }
  };

  // STATE 1: STAGING REVIEW VIEW (Before explicit "Salvar na Memória")
  if (viewingStaged && stagedDocument) {
    const urgencyInfo = URGENCY_META[stagedDocument.urgencia];

    return (
      <section className="flex flex-1 flex-col bg-[#F8FAFC] lg:h-[calc(100vh-4rem)] lg:overflow-y-auto">
        <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col p-6 lg:p-8">
          {/* Explicit Staging Confirmation Strip */}
          <div className="mb-6 flex flex-col gap-4 border border-[#FDE68A] bg-[#FFFBEB] p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold text-[#B45309]">
                Revisão Prévia (Staging) — Ainda não gravado na memória persistente
              </p>
              <p className="mt-1 text-sm text-[#0F172A]">
                Confira a ficha extraída abaixo. Clique em <strong>Salvar na Memória</strong> para
                persistir este documento no banco de dados e liberá-lo no chat RAG e no Cérebro.
              </p>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={onDiscardStaged}
                disabled={isSavingStaged}
                className="inline-flex h-10 items-center gap-1.5 rounded-md border border-[#CBD5E1] bg-white px-4 text-sm font-medium text-[#475569] transition-colors hover:bg-[#F8FAFC] hover:text-[#0F172A] disabled:opacity-50 whitespace-nowrap"
              >
                <X className="h-4 w-4" aria-hidden="true" />
                <span>Descartar</span>
              </button>
              <button
                type="button"
                onClick={onSaveStaged}
                disabled={isSavingStaged}
                className="inline-flex h-10 items-center gap-2 rounded-md bg-[#1E3A5F] px-4 text-sm font-medium text-white transition-colors hover:bg-[#152A45] disabled:opacity-60 whitespace-nowrap"
              >
                {isSavingStaged ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    <span>Salvando...</span>
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" aria-hidden="true" />
                    <span>Salvar na Memória</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Staged Document Header */}
          <div className="flex flex-col gap-4 border-b border-[#E2E8F0] pb-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h1 className="font-editorial text-2xl font-semibold text-[#0F172A] lg:text-3xl">
                {stagedDocument.tipo_documento}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-[#64748B]">
                <span className={`font-semibold ${urgencyInfo.colorClass}`}>
                  {urgencyInfo.label}
                </span>
                <span aria-hidden="true">·</span>
                <span className="truncate text-[#0F172A]">{stagedDocument.filename}</span>
                <span aria-hidden="true">·</span>
                <span className="tabular-data uppercase">{stagedDocument.file_format}</span>
                <span aria-hidden="true">·</span>
                <span className="tabular-data">
                  {stagedDocument.page_count}{' '}
                  {stagedDocument.page_count === 1 ? 'página' : 'páginas'}
                </span>
                {stagedDocument.extraction_model && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-data">{stagedDocument.extraction_model}</span>
                  </>
                )}
              </div>
            </div>

            <div
              role="tablist"
              aria-label="Visualização da revisão"
              className="flex items-center gap-1 rounded-md bg-[#E2E8F0]/70 p-1 shrink-0"
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'overview_chat'}
                onClick={() => setActiveTab('overview_chat')}
                className={`inline-flex h-8 items-center gap-1.5 rounded px-3 text-xs font-medium transition-colors whitespace-nowrap ${
                  activeTab === 'overview_chat'
                    ? 'bg-white text-[#0F172A] shadow-xs'
                    : 'text-[#475569] hover:text-[#0F172A]'
                }`}
              >
                <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Ficha &amp; Perguntas</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'raw_pages'}
                onClick={() => setActiveTab('raw_pages')}
                className={`inline-flex h-8 items-center gap-1.5 rounded px-3 text-xs font-medium transition-colors whitespace-nowrap ${
                  activeTab === 'raw_pages'
                    ? 'bg-white text-[#0F172A] shadow-xs'
                    : 'text-[#475569] hover:text-[#0F172A]'
                }`}
              >
                <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Texto Paginado</span>
              </button>
            </div>
          </div>

          {activeTab === 'overview_chat' ? (
            <div className="mt-6 space-y-6">
              <StructuredSheet item={stagedDocument} />

              {stagedDocument.suggested_questions.length > 0 && (
                <div className="border border-[#E2E8F0] bg-white p-6">
                  <h2 className="font-editorial text-lg font-semibold text-[#0F172A]">
                    Perguntas Contextuais Geradas pela IA
                  </h2>
                  <p className="mt-1 text-xs text-[#64748B]">
                    Estes atalhos serão vinculados ao chat RAG assim que você salvar este documento
                    na memória.
                  </p>
                  <ul className="mt-4 space-y-2">
                    {stagedDocument.suggested_questions.map((q, idx) => (
                      <li
                        key={idx}
                        className="rounded-md border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-2.5 text-sm text-[#0F172A]"
                      >
                        {q}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              {parsedPages.map((page) => (
                <article key={page.pageNumber} className="border border-[#E2E8F0] bg-white">
                  <div className="border-b border-[#E2E8F0] bg-[#F8FAFC] px-6 py-2.5">
                    <span className="tabular-data text-xs font-semibold text-[#1E3A5F]">
                      [Pág. {page.pageNumber}]
                    </span>
                  </div>
                  <pre className="overflow-x-auto whitespace-pre-wrap px-6 py-5 font-sans text-sm leading-relaxed text-[#0F172A]">
                    {page.content}
                  </pre>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    );
  }

  // STATE 2: GLOBAL KNOWLEDGE BASE ("CÉREBRO") DEDICATED VIEW
  if (chatMode === 'global') {
    return (
      <section className="flex flex-1 flex-col bg-[#F8FAFC] lg:h-[calc(100vh-4rem)] lg:overflow-y-auto">
        <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col p-6 lg:p-8">
          <div className="flex flex-col gap-4 border-b border-[#E2E8F0] pb-6 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="font-editorial text-2xl font-semibold text-[#0F172A] lg:text-3xl">
                Base de Conhecimento Geral (Cérebro)
              </h1>
              <p className="mt-2 text-xs text-[#64748B]">
                Consulta multi-documento por critérios sobre{' '}
                <strong className="tabular-data text-[#0F172A]">{savedDocumentsCount}</strong>{' '}
                {savedDocumentsCount === 1 ? 'documento salvo' : 'documentos salvos'} · Citação
                obrigatória{' '}
                <span className="tabular-data text-[#1E3A5F]">[Doc: arquivo | Pág. X]</span>
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {document && (
                <button
                  type="button"
                  onClick={() => onChangeChatMode('document')}
                  className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[#CBD5E1] bg-white px-3 text-xs font-medium text-[#0F172A] hover:bg-[#F8FAFC] whitespace-nowrap"
                >
                  <FileText className="h-3.5 w-3.5 text-[#64748B]" aria-hidden="true" />
                  <span>Voltar ao Documento Atual</span>
                </button>
              )}
              {globalMessages.length > 0 && (
                <button
                  type="button"
                  onClick={onClearGlobalChat}
                  className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[#E2E8F0] bg-white px-3 text-xs font-medium text-[#64748B] hover:border-[#FCA5A5] hover:text-[#B91C1C] whitespace-nowrap"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Limpar Histórico</span>
                </button>
              )}
            </div>
          </div>

          <div className="mt-6 flex flex-1 flex-col border border-[#E2E8F0] bg-white">
            <div className="min-h-[320px] flex-1 space-y-5 overflow-y-auto px-6 py-5">
              {savedDocumentsCount === 0 ? (
                <div className="py-6">
                  <p className="text-sm font-medium text-[#0F172A]">
                    Nenhum documento salvo na memória ainda.
                  </p>
                  <p className="mt-1.5 max-w-lg text-sm text-[#475569]">
                    Envie documentos (PDF, TXT ou Markdown) e clique em{' '}
                    <strong>Salvar na Memória</strong> para habilitar buscas cruzadas por urgência,
                    prazos, partes ou temas em toda a base.
                  </p>
                  <button
                    type="button"
                    onClick={onTriggerUpload}
                    className="mt-4 inline-flex h-10 items-center gap-2 rounded-md bg-[#1E3A5F] px-4 text-sm font-medium text-white hover:bg-[#152A45]"
                  >
                    <Upload className="h-4 w-4" aria-hidden="true" />
                    <span>Enviar Documento</span>
                  </button>
                </div>
              ) : globalMessages.length === 0 ? (
                <div>
                  <p className="text-sm text-[#475569]">
                    Consulte simultaneamente todos os documentos salvos por critério (urgência,
                    tipo, partes, prazos ou valores). Clique em uma consulta sugerida ou escreva sua
                    pergunta abaixo:
                  </p>
                  <div className="mt-4 flex flex-col gap-2">
                    {GLOBAL_SUGGESTED_QUERIES.map((q, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => onSendGlobalQuestion(q)}
                        disabled={isSendingGlobalChat}
                        className="w-full rounded-md border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-2.5 text-left text-sm text-[#0F172A] transition-colors hover:border-[#1E3A5F]/50 hover:bg-[#F1F5F9] disabled:opacity-60"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                globalMessages.map((msg) => {
                  const isUser = msg.role === 'user';
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                    >
                      <span className="mb-1 text-[11px] font-medium text-[#64748B]">
                        {isUser ? 'Usuário' : 'JurisTriage Cérebro (RAG Global)'}
                      </span>
                      <div
                        className={`max-w-[90%] rounded-md px-4 py-3 text-sm leading-relaxed ${
                          isUser
                            ? 'bg-[#1E3A5F] text-white'
                            : 'border border-[#E2E8F0] bg-[#F8FAFC] text-[#0F172A]'
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{msg.content}</p>

                        {!isUser && msg.citations.length > 0 && (
                          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[#E2E8F0] pt-2.5">
                            <span className="text-xs text-[#64748B]">Fontes verificadas:</span>
                            {msg.citations.map((cit, idx) => (
                              <button
                                key={`${cit.document_id}-${cit.page}-${idx}`}
                                type="button"
                                onClick={() => onOpenCitation(cit)}
                                className="tabular-data rounded border border-[#CBD5E1] bg-white px-2.5 py-0.5 text-xs font-medium text-[#1E3A5F] transition-colors hover:border-[#1E3A5F] hover:bg-[#F1F5F9]"
                              >
                                Doc: {cit.filename} · Pág. {cit.page}
                              </button>
                            ))}
                          </div>
                        )}

                        {!isUser && msg.token_usage.total_tokens > 0 && (
                          <div className="mt-2 tabular-data text-[11px] text-[#64748B]">
                            {msg.model_used ? `${msg.model_used} · ` : ''}
                            {msg.token_usage.input_tokens.toLocaleString('pt-BR')} in /{' '}
                            {msg.token_usage.output_tokens.toLocaleString('pt-BR')} out ·{' '}
                            {msg.token_usage.total_tokens.toLocaleString('pt-BR')} tokens
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}

              {isSendingGlobalChat && (
                <div className="flex items-center gap-2 text-xs text-[#475569]">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-[#1E3A5F]" aria-hidden="true" />
                  <span>Consultando documentos salvos na memória...</span>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {chatError && (
              <div
                role="alert"
                className="mx-6 mb-3 flex items-center gap-2 rounded-md border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-xs text-[#B91C1C]"
              >
                <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{chatError}</span>
              </div>
            )}

            <form
              onSubmit={handleSubmitChat}
              className="flex items-center gap-2 border-t border-[#E2E8F0] p-4"
            >
              <input
                type="text"
                value={questionInput}
                onChange={(e) => setQuestionInput(e.target.value)}
                placeholder="Ex.: Quais documentos têm urgência alta ou multa rescisória?"
                aria-label="Consulta na Base de Conhecimento Geral"
                disabled={isSendingGlobalChat || savedDocumentsCount === 0}
                className="h-10 flex-1 rounded-md border border-[#CBD5E1] bg-white px-3.5 text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#1E3A5F] focus:outline-none disabled:bg-[#F8FAFC]"
              />
              <button
                type="submit"
                disabled={
                  isSendingGlobalChat ||
                  savedDocumentsCount === 0 ||
                  questionInput.trim().length < 2
                }
                className="inline-flex h-10 items-center gap-2 rounded-md bg-[#1E3A5F] px-4 text-sm font-medium text-white transition-colors hover:bg-[#152A45] disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap shrink-0"
              >
                <Send className="h-4 w-4" aria-hidden="true" />
                <span>Consultar Base</span>
              </button>
            </form>
          </div>
        </div>
      </section>
    );
  }

  // STATE 3: LOADING SAVED DOCUMENT DETAIL
  if (isLoadingDetail) {
    return (
      <section className="flex-1 bg-[#F8FAFC] p-6 lg:p-10">
        <div className="mx-auto max-w-4xl animate-pulse space-y-6">
          <div className="h-8 w-2/3 rounded bg-[#E2E8F0]" />
          <div className="h-4 w-1/3 rounded bg-[#E2E8F0]" />
          <div className="grid grid-cols-2 gap-4 pt-4">
            <div className="h-20 rounded bg-white" />
            <div className="h-20 rounded bg-white" />
            <div className="h-20 rounded bg-white" />
            <div className="h-20 rounded bg-white" />
          </div>
        </div>
      </section>
    );
  }

  // STATE 4: CLEAN PRODUCTION EMPTY STATE (ZERO DEMO KIT)
  if (!document) {
    return (
      <section className="flex flex-1 items-center justify-center bg-[#F8FAFC] p-6 lg:p-12">
        <div className="max-w-xl border border-[#E2E8F0] bg-white p-8">
          <p className="text-xs font-medium text-[#64748B]">
            Área de Triagem &amp; Base de Conhecimento RAG
          </p>
          <h1 className="mt-2 font-editorial text-3xl font-semibold leading-tight text-[#0F172A]">
            Envie qualquer documento para triagem auditável por página.
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-[#475569]">
            Processe arquivos PDF, TXT ou Markdown — jurídicos, contratuais, administrativos ou
            gerais. Revise a ficha estruturada antes de salvá-la na memória persistente da IA e
            consulte cada documento ou toda a base com citações rastreáveis.
          </p>

          <div className="mt-6 grid grid-cols-1 gap-4 border-t border-[#E2E8F0] pt-6 sm:grid-cols-3">
            <div>
              <p className="tabular-data text-xs font-semibold text-[#1E3A5F]">01</p>
              <p className="mt-1 text-sm font-medium text-[#0F172A]">Upload &amp; Revisão</p>
              <p className="mt-0.5 text-xs text-[#64748B]">
                Extraia metadados, revise em staging e salve na memória.
              </p>
            </div>
            <div>
              <p className="tabular-data text-xs font-semibold text-[#1E3A5F]">02</p>
              <p className="mt-1 text-sm font-medium text-[#0F172A]">RAG Dual-Mode</p>
              <p className="mt-0.5 text-xs text-[#64748B]">
                Consulte o documento atual ou toda a base por critérios.
              </p>
            </div>
            <div>
              <p className="tabular-data text-xs font-semibold text-[#1E3A5F]">03</p>
              <p className="mt-1 text-sm font-medium text-[#0F172A]">Grounding &amp; Tokens</p>
              <p className="mt-0.5 text-xs text-[#64748B]">
                Citações [Pág. X], recusa anti-alucinação e custos reais.
              </p>
            </div>
          </div>

          <div className="mt-8">
            <button
              type="button"
              onClick={onTriggerUpload}
              className="inline-flex h-10 items-center gap-2 rounded-md bg-[#1E3A5F] px-5 text-sm font-medium text-white transition-colors hover:bg-[#152A45] whitespace-nowrap"
            >
              <Upload className="h-4 w-4" aria-hidden="true" />
              <span>Enviar Primeiro Documento</span>
            </button>
          </div>
        </div>
      </section>
    );
  }

  // STATE 5: SAVED DOCUMENT DETAIL + DYNAMIC RAG CHAT + PAGINATED AUDITOR
  const urgencyInfo = URGENCY_META[document.urgencia];
  const createdDate = new Date(document.created_at).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <section className="flex flex-1 flex-col bg-[#F8FAFC] lg:h-[calc(100vh-4rem)] lg:overflow-y-auto">
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col p-6 lg:p-8">
        {/* Document Header */}
        <div className="flex flex-col gap-4 border-b border-[#E2E8F0] pb-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="font-editorial text-2xl font-semibold text-[#0F172A] lg:text-3xl">
              {document.tipo_documento}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-[#64748B]">
              <span className={`font-semibold ${urgencyInfo.colorClass}`}>
                {urgencyInfo.label}
              </span>
              <span aria-hidden="true">·</span>
              <span className="truncate text-[#0F172A]">{document.filename}</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-data uppercase">{document.file_format}</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-data">
                {document.page_count} {document.page_count === 1 ? 'página' : 'páginas'}
              </span>
              <span aria-hidden="true">·</span>
              <span className="tabular-data">{createdDate}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <div
              role="tablist"
              aria-label="Modo de visualização do documento"
              className="flex items-center gap-1 rounded-md bg-[#E2E8F0]/70 p-1"
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'overview_chat'}
                onClick={() => setActiveTab('overview_chat')}
                className={`inline-flex h-8 items-center gap-1.5 rounded px-3 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  activeTab === 'overview_chat'
                    ? 'bg-white text-[#0F172A] shadow-xs'
                    : 'text-[#475569] hover:text-[#0F172A]'
                }`}
              >
                <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Ficha &amp; Chat RAG</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'raw_pages'}
                onClick={() => setActiveTab('raw_pages')}
                className={`inline-flex h-8 items-center gap-1.5 rounded px-3 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  activeTab === 'raw_pages'
                    ? 'bg-white text-[#0F172A] shadow-xs'
                    : 'text-[#475569] hover:text-[#0F172A]'
                }`}
              >
                <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Texto Paginado</span>
              </button>
            </div>

            {confirmingDelete ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={isDeleting}
                  className="h-9 rounded-md bg-[#B91C1C] px-3 text-xs font-medium text-white transition-colors hover:bg-[#991B1B] whitespace-nowrap"
                >
                  {isDeleting ? 'Removendo...' : 'Confirmar exclusão'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(false)}
                  className="h-9 rounded-md border border-[#CBD5E1] bg-white px-3 text-xs font-medium text-[#475569] hover:text-[#0F172A] whitespace-nowrap"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                aria-label="Remover documento da memória"
                className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[#E2E8F0] bg-white px-3 text-xs font-medium text-[#475569] transition-colors hover:border-[#FCA5A5] hover:text-[#B91C1C] whitespace-nowrap shrink-0"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Remover</span>
              </button>
            )}
          </div>
        </div>

        {activeTab === 'overview_chat' ? (
          <div className="mt-6 space-y-8">
            <StructuredSheet
              item={document}
              processTotalTokens={document.process_total_tokens}
            />

            {/* Grounded RAG Chat Panel (Dual-Mode Switcher Built-In) */}
            <div className="flex flex-col border border-[#E2E8F0] bg-white">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E2E8F0] px-6 py-4">
                <div>
                  <h2 className="font-editorial text-lg font-semibold text-[#0F172A]">
                    Consulta RAG Ancorada
                  </h2>
                  <p className="mt-0.5 text-xs text-[#64748B]">
                    Responde exclusivamente com base nas {document.page_count} páginas deste
                    documento citando <span className="tabular-data">[Pág. X]</span>.
                  </p>
                </div>

                <div
                  role="tablist"
                  aria-label="Escopo do agente RAG"
                  className="flex items-center gap-1 rounded-md bg-[#F1F5F9] p-1"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={true}
                    onClick={() => onChangeChatMode('document')}
                    className="h-8 rounded bg-white px-3 text-xs font-medium text-[#0F172A] shadow-xs whitespace-nowrap"
                  >
                    Documento Atual
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={false}
                    onClick={() => onChangeChatMode('global')}
                    className="inline-flex h-8 items-center gap-1.5 rounded px-3 text-xs font-medium text-[#64748B] hover:text-[#0F172A] whitespace-nowrap"
                  >
                    <Database className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Base Geral ({savedDocumentsCount})</span>
                  </button>
                </div>
              </div>

              {/* Messages Stream */}
              <div className="min-h-[240px] max-h-[420px] space-y-5 overflow-y-auto px-6 py-5">
                {messages.length === 0 ? (
                  <div>
                    <p className="text-sm text-[#475569]">
                      {document.suggested_questions.length > 0
                        ? 'Perguntas sugeridas dinamicamente a partir do conteúdo deste documento:'
                        : 'Faça uma pergunta objetiva sobre cláusulas, prazos, valores ou obrigações deste documento:'}
                    </p>
                    {document.suggested_questions.length > 0 && (
                      <div className="mt-4 flex flex-col gap-2">
                        {document.suggested_questions.map((suggestion, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => onSendQuestion(suggestion)}
                            disabled={isSendingChat}
                            className="w-full rounded-md border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-2.5 text-left text-sm text-[#0F172A] transition-colors hover:border-[#1E3A5F]/50 hover:bg-[#F1F5F9] disabled:opacity-60"
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isUser = msg.role === 'user';
                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                      >
                        <span className="mb-1 text-[11px] font-medium text-[#64748B]">
                          {isUser ? 'Usuário' : 'JurisTriage RAG'}
                        </span>
                        <div
                          className={`max-w-[88%] rounded-md px-4 py-3 text-sm leading-relaxed ${
                            isUser
                              ? 'bg-[#1E3A5F] text-white'
                              : 'border border-[#E2E8F0] bg-[#F8FAFC] text-[#0F172A]'
                          }`}
                        >
                          <p className="whitespace-pre-wrap">{msg.content}</p>
                          {!isUser && msg.cited_pages.length > 0 && (
                            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[#E2E8F0] pt-2.5">
                              <span className="text-xs text-[#64748B]">Fontes citadas:</span>
                              {msg.cited_pages.map((pageNum) => (
                                <button
                                  key={pageNum}
                                  type="button"
                                  onClick={() => handleJumpToPage(pageNum)}
                                  className="tabular-data rounded border border-[#CBD5E1] bg-white px-2 py-0.5 text-xs font-medium text-[#1E3A5F] transition-colors hover:border-[#1E3A5F] hover:bg-[#F1F5F9]"
                                >
                                  Ver Pág. {pageNum}
                                </button>
                              ))}
                            </div>
                          )}
                          {!isUser && msg.token_usage.total_tokens > 0 && (
                            <div className="mt-2 tabular-data text-[11px] text-[#64748B]">
                              {msg.model_used ? `${msg.model_used} · ` : ''}
                              {msg.token_usage.input_tokens.toLocaleString('pt-BR')} in /{' '}
                              {msg.token_usage.output_tokens.toLocaleString('pt-BR')} out ·{' '}
                              {msg.token_usage.total_tokens.toLocaleString('pt-BR')} tokens
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}

                {isSendingChat && (
                  <div className="flex items-center gap-2 text-xs text-[#475569]">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-[#1E3A5F]" aria-hidden="true" />
                    <span>Auditando páginas do documento...</span>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {chatError && (
                <div
                  role="alert"
                  className="mx-6 mb-3 flex items-center gap-2 rounded-md border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-xs text-[#B91C1C]"
                >
                  <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{chatError}</span>
                </div>
              )}

              <form
                onSubmit={handleSubmitChat}
                className="flex items-center gap-2 border-t border-[#E2E8F0] p-4"
              >
                <input
                  type="text"
                  value={questionInput}
                  onChange={(e) => setQuestionInput(e.target.value)}
                  placeholder="Pergunte sobre prazos, riscos, cláusulas ou obrigações deste documento..."
                  aria-label="Pergunta sobre o documento selecionado"
                  disabled={isSendingChat}
                  className="h-10 flex-1 rounded-md border border-[#CBD5E1] bg-white px-3.5 text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#1E3A5F] focus:outline-none disabled:bg-[#F8FAFC]"
                />
                <button
                  type="submit"
                  disabled={isSendingChat || questionInput.trim().length < 2}
                  className="inline-flex h-10 items-center gap-2 rounded-md bg-[#1E3A5F] px-4 text-sm font-medium text-white transition-colors hover:bg-[#152A45] disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap shrink-0"
                >
                  <Send className="h-4 w-4" aria-hidden="true" />
                  <span>Consultar</span>
                </button>
              </form>
            </div>
          </div>
        ) : (
          /* Raw Paginated Text Auditor View */
          <div className="mt-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border border-[#E2E8F0] bg-white px-5 py-3">
              <p className="text-xs text-[#475569]">
                Texto integral extraído com marcadores explícitos{' '}
                <span className="tabular-data font-medium text-[#1E3A5F]">[Pág. X]</span> para
                auditoria.
              </p>
              <div className="flex flex-wrap items-center gap-1.5">
                {parsedPages.map((p) => (
                  <button
                    key={p.pageNumber}
                    type="button"
                    onClick={() => handleJumpToPage(p.pageNumber)}
                    className={`tabular-data h-8 rounded px-2.5 text-xs font-medium transition-colors ${
                      highlightedPage === p.pageNumber
                        ? 'bg-[#1E3A5F] text-white'
                        : 'bg-[#F1F5F9] text-[#475569] hover:text-[#0F172A]'
                    }`}
                  >
                    Pág. {p.pageNumber}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              {parsedPages.map((page) => {
                const isHighlighted = highlightedPage === page.pageNumber;
                return (
                  <article
                    key={page.pageNumber}
                    ref={(el) => {
                      pageRefs.current[page.pageNumber] = el;
                    }}
                    className={`border bg-white transition-colors ${
                      isHighlighted
                        ? 'border-[#1E3A5F] ring-1 ring-[#1E3A5F]/20'
                        : 'border-[#E2E8F0]'
                    }`}
                  >
                    <div className="flex items-center justify-between border-b border-[#E2E8F0] bg-[#F8FAFC] px-6 py-2.5">
                      <span className="tabular-data text-xs font-semibold text-[#1E3A5F]">
                        [Pág. {page.pageNumber}]
                      </span>
                      {isHighlighted && (
                        <span className="text-xs font-medium text-[#1E3A5F]">
                          Trecho citado no chat
                        </span>
                      )}
                    </div>
                    <pre className="overflow-x-auto whitespace-pre-wrap px-6 py-5 font-sans text-sm leading-relaxed text-[#0F172A]">
                      {page.content}
                    </pre>
                  </article>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
