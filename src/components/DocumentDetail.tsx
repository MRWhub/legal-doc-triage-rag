import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  FileText,
  Loader2,
  Send,
  Sparkles,
  Trash2,
} from 'lucide-react';
import type { ChatMessage, LegalDocument, UrgencyLevel } from '../types';

interface DocumentDetailProps {
  document: LegalDocument | null;
  messages: ChatMessage[];
  isLoadingDetail: boolean;
  isSendingChat: boolean;
  chatError: string | null;
  onSendQuestion: (question: string) => Promise<void>;
  onDeleteDocument: (id: number) => Promise<void>;
  onLoadAllSamples: () => void;
  onTriggerUpload: () => void;
  isLoadingSamples: boolean;
}

const URGENCY_META: Record<UrgencyLevel, { label: string; colorClass: string }> = {
  ALTA: { label: 'Urgência Alta', colorClass: 'text-[#B91C1C]' },
  MEDIA: { label: 'Urgência Média', colorClass: 'text-[#B45309]' },
  BAIXA: { label: 'Urgência Baixa', colorClass: 'text-[#15803D]' },
};

interface ParsedPage {
  pageNumber: number;
  content: string;
}

function parsePaginatedText(rawText: string): ParsedPage[] {
  const regex = /---\s*PÁGINA\s+(\d+)\s*---/gi;
  const matches = Array.from(rawText.matchAll(regex));

  if (matches.length === 0) {
    return [{ pageNumber: 1, content: rawText.trim() }];
  }

  return matches.map((match, index) => {
    const pageNumber = Number(match[1]) || index + 1;
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

function getSuggestedQuestions(doc: LegalDocument): string[] {
  if (doc.urgencia === 'ALTA') {
    return [
      'Qual é o prazo fatal e quais penalidades constam no documento?',
      'Qual o valor da multa diária e em qual página ela aparece?',
      'Qual é o nome do fiador ou avalista citado nos autos? (Teste anti-alucinação)',
    ];
  }
  if (!doc.numero_processo) {
    return [
      'Qual é o prazo de vigência e a regra de renovação automática?',
      'Qual é a multa por rescisão antecipada e o foro eleito?',
      'Qual o número do processo judicial CNJ deste contrato? (Teste anti-alucinação)',
    ];
  }
  return [
    'Quais são os pedidos principais e seus valores estimados?',
    'Qual é o prazo ou previsão de audiência indicado no texto?',
    'O documento menciona pagamento de comissão de corretagem? (Teste anti-alucinação)',
  ];
}

export function DocumentDetail({
  document,
  messages,
  isLoadingDetail,
  isSendingChat,
  chatError,
  onSendQuestion,
  onDeleteDocument,
  onLoadAllSamples,
  onTriggerUpload,
  isLoadingSamples,
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
  }, [document?.id]);

  useEffect(() => {
    if (activeTab === 'overview_chat') {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [messages.length, isSendingChat, activeTab]);

  useEffect(() => {
    if (activeTab === 'raw_pages' && highlightedPage !== null) {
      const target = pageRefs.current[highlightedPage];
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }, [activeTab, highlightedPage]);

  const parsedPages = useMemo(
    () => (document ? parsePaginatedText(document.raw_text) : []),
    [document]
  );

  const suggestedQuestions = useMemo(
    () => (document ? getSuggestedQuestions(document) : []),
    [document]
  );

  const handleSubmitChat = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = questionInput.trim();
    if (!trimmed || isSendingChat) return;
    setQuestionInput('');
    await onSendQuestion(trimmed);
  };

  const handleJumpToPage = (pageNum: number) => {
    setHighlightedPage(pageNum);
    setActiveTab('raw_pages');
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

  if (!document) {
    return (
      <section className="flex flex-1 items-center justify-center bg-[#F8FAFC] p-6 lg:p-12">
        <div className="max-w-xl border border-[#E2E8F0] bg-white p-8">
          <p className="text-xs font-medium text-[#64748B]">
            Triagem Documental &amp; RAG Jurídico
          </p>
          <h1 className="mt-2 font-editorial text-3xl font-semibold leading-tight text-[#0F172A]">
            Transforme PDFs jurídicos em triagem auditável por página.
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-[#475569]">
            Envie qualquer intimação, petição inicial ou contrato comercial (mesmo sem número CNJ).
            O JurisTriage preserva marcadores de página, preenche automaticamente a ficha estruturada
            via Gemini Flash e habilita um chat ancorado que cita a página exata de cada resposta.
          </p>

          <div className="mt-6 grid grid-cols-1 gap-4 border-t border-[#E2E8F0] pt-6 sm:grid-cols-3">
            <div>
              <p className="tabular-data text-xs font-semibold text-[#1E3A5F]">01</p>
              <p className="mt-1 text-sm font-medium text-[#0F172A]">Ingestão Paginada</p>
              <p className="mt-0.5 text-xs text-[#64748B]">
                Extração de texto preservando marcadores por página.
              </p>
            </div>
            <div>
              <p className="tabular-data text-xs font-semibold text-[#1E3A5F]">02</p>
              <p className="mt-1 text-sm font-medium text-[#0F172A]">Schema Estruturado</p>
              <p className="mt-0.5 text-xs text-[#64748B]">
                Classificação de urgência, CNJ opcional, prazos e valores.
              </p>
            </div>
            <div>
              <p className="tabular-data text-xs font-semibold text-[#1E3A5F]">03</p>
              <p className="mt-1 text-sm font-medium text-[#0F172A]">RAG Anti-Alucinação</p>
              <p className="mt-0.5 text-xs text-[#64748B]">
                Respostas restritas ao texto com citação clicável de página.
              </p>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onLoadAllSamples}
              disabled={isLoadingSamples}
              className="inline-flex h-10 items-center gap-2 rounded-md bg-[#1E3A5F] px-4 text-sm font-medium text-white transition-colors hover:bg-[#152A45] disabled:cursor-not-allowed disabled:opacity-60 whitespace-nowrap"
            >
              {isLoadingSamples ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  <span>Processando 3 PDFs...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                  <span>Carregar 3 PDFs de Demonstração</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onTriggerUpload}
              className="inline-flex h-10 items-center gap-2 rounded-md border border-[#CBD5E1] bg-white px-4 text-sm font-medium text-[#0F172A] transition-colors hover:bg-[#F8FAFC] whitespace-nowrap"
            >
              <span>Enviar PDF do Computador</span>
            </button>
          </div>
        </div>
      </section>
    );
  }

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
                aria-label="Remover documento da base"
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
            {/* Structured Extraction Sheet (Flat Single Elevation Surface) */}
            <div className="border border-[#E2E8F0] bg-white">
              <div className="border-b border-[#E2E8F0] px-6 py-4">
                <h2 className="font-editorial text-lg font-semibold text-[#0F172A]">
                  Ficha Estruturada Extraída
                </h2>
              </div>

              <dl className="grid grid-cols-1 divide-y divide-[#E2E8F0] sm:grid-cols-2 sm:divide-y-0">
                <div className="border-b border-[#E2E8F0] px-6 py-4 sm:border-r">
                  <dt className="text-xs font-medium text-[#64748B]">
                    Número do Processo (CNJ)
                  </dt>
                  <dd className="mt-1 tabular-data text-sm font-medium text-[#0F172A]">
                    {document.numero_processo ?? 'Não aplicável (Documento sem CNJ)'}
                  </dd>
                </div>

                <div className="border-b border-[#E2E8F0] px-6 py-4">
                  <dt className="text-xs font-medium text-[#64748B]">Valor Envolvido</dt>
                  <dd className="mt-1 tabular-data text-sm font-medium text-[#0F172A]">
                    {document.valor_envolvido}
                  </dd>
                </div>

                <div className="border-b border-[#E2E8F0] px-6 py-4 sm:border-r">
                  <dt className="text-xs font-medium text-[#64748B]">Prazo ou Vigência</dt>
                  <dd className="mt-1 text-sm font-medium text-[#0F172A]">
                    {document.prazo_ou_vigencia}
                  </dd>
                </div>

                <div className="border-b border-[#E2E8F0] px-6 py-4">
                  <dt className="text-xs font-medium text-[#64748B]">
                    Classificação de Urgência
                  </dt>
                  <dd className={`mt-1 text-sm font-semibold ${urgencyInfo.colorClass}`}>
                    {urgencyInfo.label} ({document.urgencia})
                  </dd>
                </div>

                <div className="border-b border-[#E2E8F0] px-6 py-4 sm:col-span-2">
                  <dt className="text-xs font-medium text-[#64748B]">Partes Envolvidas</dt>
                  <dd className="mt-2">
                    {document.partes_envolvidas.length > 0 ? (
                      <ul className="space-y-1 text-sm text-[#0F172A]">
                        {document.partes_envolvidas.map((parte, idx) => (
                          <li key={idx} className="leading-snug">
                            {parte}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-sm text-[#64748B]">
                        Partes não identificadas explicitamente no documento.
                      </span>
                    )}
                  </dd>
                </div>

                <div className="px-6 py-4 sm:col-span-2">
                  <dt className="text-xs font-medium text-[#64748B]">Resumo Executivo</dt>
                  <dd className="mt-1.5 max-w-[70ch] text-sm leading-relaxed text-[#0F172A]">
                    {document.resumo_executivo}
                  </dd>
                </div>
              </dl>
            </div>

            {/* Grounded RAG Chat Panel */}
            <div className="flex flex-col border border-[#E2E8F0] bg-white">
              <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[#E2E8F0] px-6 py-4">
                <div>
                  <h2 className="font-editorial text-lg font-semibold text-[#0F172A]">
                    Consulta RAG Ancorada no Documento
                  </h2>
                  <p className="mt-0.5 text-xs text-[#64748B]">
                    Responde exclusivamente com base nas {document.page_count} páginas extraídas,
                    citando a página de origem e recusando informações ausentes.
                  </p>
                </div>
              </div>

              {/* Messages Stream */}
              <div className="min-h-[240px] max-h-[420px] space-y-5 overflow-y-auto px-6 py-5">
                {messages.length === 0 ? (
                  <div>
                    <p className="text-sm text-[#475569]">
                      Faça uma pergunta objetiva sobre cláusulas, prazos, valores ou obrigações
                      deste arquivo, ou teste uma das sugestões abaixo:
                    </p>
                    <div className="mt-4 flex flex-col gap-2">
                      {suggestedQuestions.map((suggestion, idx) => (
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
                          {isUser ? 'Advogado' : 'JurisTriage RAG'}
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
                                  Ver Página {pageNum}
                                </button>
                              ))}
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
                    <span>Verificando evidências nas páginas do documento...</span>
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

              {/* Chat Input */}
              <form
                onSubmit={handleSubmitChat}
                className="flex items-center gap-2 border-t border-[#E2E8F0] p-4"
              >
                <input
                  type="text"
                  value={questionInput}
                  onChange={(e) => setQuestionInput(e.target.value)}
                  placeholder="Pergunte sobre prazos, multas, cláusulas ou partes deste documento..."
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
                Texto integral extraído com marcadores explícitos de rastreabilidade por página.
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
                        --- PÁGINA {page.pageNumber} ---
                      </span>
                      {isHighlighted && (
                        <span className="text-xs font-medium text-[#1E3A5F]">
                          Página citada no chat
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
