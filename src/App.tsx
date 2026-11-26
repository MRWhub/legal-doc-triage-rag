import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, X } from 'lucide-react';
import { DocumentDetail, type RagChatMode } from './components/DocumentDetail';
import { DocumentQueue, type UrgencyFilter } from './components/DocumentQueue';
import { HelpDocsDrawer } from './components/HelpDocsDrawer';
import { TopBar } from './components/TopBar';
import {
  analyzeDocumentFile,
  clearGlobalChatMessages,
  deleteDocument,
  fetchDocumentDetail,
  fetchDocuments,
  fetchGlobalChatMessages,
  fetchModels,
  fetchTokenMetrics,
  saveStagedDocument,
  sendChatQuestion,
  sendGlobalChatQuestion,
} from './lib/api';
import type {
  AiModelOption,
  ChatMessage,
  GlobalChatMessage,
  GlobalCitation,
  LegalDocument,
  StagedDocument,
  TokenMetrics,
} from './types';

const URGENCY_RANK = { ALTA: 1, MEDIA: 2, BAIXA: 3 } as const;
const ALLOWED_EXT_REGEX = /\.(pdf|txt|md)$/i;

function sortByUrgency(docs: LegalDocument[]): LegalDocument[] {
  return [...docs].sort((a, b) => {
    const rankDiff = URGENCY_RANK[a.urgencia] - URGENCY_RANK[b.urgencia];
    if (rankDiff !== 0) return rankDiff;
    return b.id - a.id;
  });
}

export default function App() {
  const [documents, setDocuments] = useState<LegalDocument[]>([]);
  const [stagedDocument, setStagedDocument] = useState<StagedDocument | null>(null);
  const [viewingStaged, setViewingStaged] = useState(false);

  const [selectedDocId, setSelectedDocId] = useState<number | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<LegalDocument | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [globalMessages, setGlobalMessages] = useState<GlobalChatMessage[]>([]);
  const [chatMode, setChatMode] = useState<RagChatMode>('document');

  const [models, setModels] = useState<AiModelOption[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('gemini-3.1-flash-lite');
  const [tokenMetrics, setTokenMetrics] = useState<TokenMetrics | null>(null);

  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSavingStaged, setIsSavingStaged] = useState(false);
  const [isSendingChat, setIsSendingChat] = useState(false);
  const [isSendingGlobalChat, setIsSendingGlobalChat] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [urgencyFilter, setUrgencyFilter] = useState<UrgencyFilter>('ALL');
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [jumpToPageRequest, setJumpToPageRequest] = useState<{
    docId: number;
    page: number;
    nonce: number;
  } | null>(null);

  const [globalError, setGlobalError] = useState<string | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);

  const hiddenFileInputRef = useRef<HTMLInputElement | null>(null);

  const refreshTokenMetrics = useCallback(async () => {
    try {
      const metrics = await fetchTokenMetrics();
      setTokenMetrics(metrics);
    } catch {
      // Non-blocking
    }
  }, []);

  const loadDocumentList = useCallback(async (preferredId?: number | null) => {
    setIsLoadingList(true);
    try {
      const docs = await fetchDocuments();
      setDocuments(docs);
      setSelectedDocId((current) => {
        if (preferredId && docs.some((d) => d.id === preferredId)) {
          return preferredId;
        }
        if (current && docs.some((d) => d.id === current)) {
          return current;
        }
        return docs[0]?.id ?? null;
      });
    } catch (error) {
      setGlobalError(
        error instanceof Error ? error.message : 'Falha ao carregar a memória documental.'
      );
    } finally {
      setIsLoadingList(false);
    }
  }, []);

  useEffect(() => {
    void loadDocumentList();
    void refreshTokenMetrics();
    fetchGlobalChatMessages()
      .then(setGlobalMessages)
      .catch(() => {
        // Non-blocking
      });
    fetchModels()
      .then((available) => {
        setModels(available);
        const defaultOption = available.find((m) => m.isDefault) ?? available[0];
        if (defaultOption) {
          setSelectedModel(defaultOption.id);
        }
      })
      .catch(() => {
        // Non-blocking
      });
  }, [loadDocumentList, refreshTokenMetrics]);

  useEffect(() => {
    if (selectedDocId === null) {
      setSelectedDoc(null);
      setMessages([]);
      setChatError(null);
      return;
    }

    let cancelled = false;
    setIsLoadingDetail(true);
    setChatError(null);

    fetchDocumentDetail(selectedDocId)
      .then((detail) => {
        if (cancelled) return;
        setSelectedDoc(detail.document);
        setMessages(detail.messages);
      })
      .catch((error) => {
        if (cancelled) return;
        setGlobalError(
          error instanceof Error ? error.message : 'Erro ao carregar detalhes do documento.'
        );
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingDetail(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedDocId]);

  const handleAnalyzeFile = async (file: File) => {
    if (!ALLOWED_EXT_REGEX.test(file.name)) {
      setGlobalError('Formato não suportado. Envie arquivos PDF (.pdf), Texto (.txt) ou Markdown (.md).');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setGlobalError('O arquivo excede o limite de 10 MB.');
      return;
    }

    setGlobalError(null);
    setIsAnalyzing(true);

    try {
      const staged = await analyzeDocumentFile(file, selectedModel);
      setStagedDocument(staged);
      setViewingStaged(true);
    } catch (error) {
      setGlobalError(
        error instanceof Error
          ? error.message
          : 'Não foi possível analisar o documento enviado.'
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSaveStaged = async () => {
    if (!stagedDocument || isSavingStaged) return;
    setGlobalError(null);
    setIsSavingStaged(true);

    try {
      const saved = await saveStagedDocument(stagedDocument);
      setDocuments((prev) => sortByUrgency([saved, ...prev]));
      setStagedDocument(null);
      setViewingStaged(false);
      setChatMode('document');
      setSelectedDocId(saved.id);
      setSelectedDoc(saved);
      setMessages([]);
      await refreshTokenMetrics();
    } catch (error) {
      setGlobalError(
        error instanceof Error
          ? error.message
          : 'Erro ao salvar o documento na memória persistente.'
      );
    } finally {
      setIsSavingStaged(false);
    }
  };

  const handleDiscardStaged = () => {
    setStagedDocument(null);
    setViewingStaged(false);
  };

  const handleTriggerUpload = () => {
    hiddenFileInputRef.current?.click();
  };

  const handleGlobalFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      void handleAnalyzeFile(file);
      e.target.value = '';
    }
  };

  const handleSelectDocument = (id: number) => {
    setViewingStaged(false);
    setChatMode('document');
    setSelectedDocId(id);
    setChatError(null);
  };

  const handleOpenGlobalBrain = () => {
    setViewingStaged(false);
    setChatMode('global');
    setChatError(null);
  };

  const handleSendQuestion = async (question: string) => {
    if (selectedDocId === null) return;
    setChatError(null);
    setIsSendingChat(true);

    try {
      const result = await sendChatQuestion(selectedDocId, question, selectedModel);
      setMessages((prev) => [...prev, result.userMessage, result.assistantMessage]);
      setSelectedDoc((prev) =>
        prev ? { ...prev, process_total_tokens: result.processTotalTokens } : prev
      );
      setDocuments((prev) =>
        prev.map((d) =>
          d.id === selectedDocId
            ? { ...d, process_total_tokens: result.processTotalTokens }
            : d
        )
      );
      await refreshTokenMetrics();
    } catch (error) {
      setChatError(
        error instanceof Error
          ? error.message
          : 'Não foi possível consultar o documento neste momento.'
      );
    } finally {
      setIsSendingChat(false);
    }
  };

  const handleSendGlobalQuestion = async (question: string) => {
    setChatError(null);
    setIsSendingGlobalChat(true);

    try {
      const result = await sendGlobalChatQuestion(question, selectedModel);
      setGlobalMessages((prev) => [...prev, result.userMessage, result.assistantMessage]);
      await refreshTokenMetrics();
    } catch (error) {
      setChatError(
        error instanceof Error
          ? error.message
          : 'Não foi possível consultar a Base de Conhecimento neste momento.'
      );
    } finally {
      setIsSendingGlobalChat(false);
    }
  };

  const handleClearGlobalChat = async () => {
    try {
      await clearGlobalChatMessages();
      setGlobalMessages([]);
      await refreshTokenMetrics();
    } catch (error) {
      setGlobalError(
        error instanceof Error ? error.message : 'Erro ao limpar histórico da Base Geral.'
      );
    }
  };

  const handleOpenCitation = (citation: GlobalCitation) => {
    setViewingStaged(false);
    setChatMode('document');
    setSelectedDocId(citation.document_id);
    setJumpToPageRequest({
      docId: citation.document_id,
      page: citation.page,
      nonce: Date.now(),
    });
  };

  const handleDeleteDocument = async (id: number) => {
    setGlobalError(null);
    try {
      await deleteDocument(id);
      setDocuments((prev) => {
        const next = prev.filter((d) => d.id !== id);
        if (selectedDocId === id) {
          setSelectedDocId(next[0]?.id ?? null);
        }
        return next;
      });
      await refreshTokenMetrics();
    } catch (error) {
      setGlobalError(
        error instanceof Error ? error.message : 'Erro ao remover o documento.'
      );
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#F8FAFC] text-[#0F172A]">
      <input
        ref={hiddenFileInputRef}
        type="file"
        accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown"
        onChange={handleGlobalFileChange}
        className="sr-only"
      />

      <TopBar
        onOpenHelp={() => setIsHelpOpen(true)}
        onTriggerUpload={handleTriggerUpload}
        isAnalyzing={isAnalyzing}
      />

      {globalError && (
        <div
          role="alert"
          className="flex items-center justify-between gap-4 border-b border-[#FECACA] bg-[#FEF2F2] px-6 py-3 text-sm text-[#B91C1C]"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{globalError}</span>
          </div>
          <button
            type="button"
            onClick={() => setGlobalError(null)}
            aria-label="Fechar aviso"
            className="rounded p-1 text-[#B91C1C] hover:bg-[#FEE2E2]"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}

      <div className="flex flex-1 flex-col lg:flex-row">
        <DocumentQueue
          documents={documents}
          stagedDocument={stagedDocument}
          viewingStaged={viewingStaged}
          selectedId={selectedDocId}
          isGlobalMode={chatMode === 'global'}
          onSelect={handleSelectDocument}
          onSelectStaged={() => setViewingStaged(true)}
          onOpenGlobalBrain={handleOpenGlobalBrain}
          onAnalyzeFile={handleAnalyzeFile}
          isLoadingList={isLoadingList}
          isAnalyzing={isAnalyzing}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          urgencyFilter={urgencyFilter}
          onUrgencyFilterChange={setUrgencyFilter}
          models={models}
          selectedModel={selectedModel}
          onModelChange={setSelectedModel}
          tokenMetrics={tokenMetrics}
        />

        <DocumentDetail
          stagedDocument={stagedDocument}
          viewingStaged={viewingStaged}
          isSavingStaged={isSavingStaged}
          onSaveStaged={handleSaveStaged}
          onDiscardStaged={handleDiscardStaged}
          document={selectedDoc}
          savedDocumentsCount={documents.length}
          messages={messages}
          globalMessages={globalMessages}
          chatMode={chatMode}
          onChangeChatMode={(mode) => {
            setViewingStaged(false);
            setChatMode(mode);
            setChatError(null);
          }}
          isLoadingDetail={isLoadingDetail}
          isSendingChat={isSendingChat}
          isSendingGlobalChat={isSendingGlobalChat}
          chatError={chatError}
          onSendQuestion={handleSendQuestion}
          onSendGlobalQuestion={handleSendGlobalQuestion}
          onClearGlobalChat={handleClearGlobalChat}
          onOpenCitation={handleOpenCitation}
          onDeleteDocument={handleDeleteDocument}
          onTriggerUpload={handleTriggerUpload}
          jumpToPageRequest={jumpToPageRequest}
        />
      </div>

      <HelpDocsDrawer isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
    </div>
  );
}
