import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, X } from 'lucide-react';
import { ArchitectureView } from './components/ArchitectureView';
import { DemoKitView } from './components/DemoKitView';
import { DocumentDetail } from './components/DocumentDetail';
import { DocumentQueue, type UrgencyFilter } from './components/DocumentQueue';
import { TopBar, type ActiveView } from './components/TopBar';
import {
  deleteDocument,
  fetchDocumentDetail,
  fetchDocuments,
  fetchModels,
  fetchSamples,
  loadSamples,
  sendChatQuestion,
  uploadPdfDocument,
} from './lib/api';
import type {
  AiModelOption,
  ChatMessage,
  LegalDocument,
  SampleDocumentInfo,
} from './types';

const URGENCY_RANK = { ALTA: 1, MEDIA: 2, BAIXA: 3 } as const;

function sortByUrgency(docs: LegalDocument[]): LegalDocument[] {
  return [...docs].sort((a, b) => {
    const rankDiff = URGENCY_RANK[a.urgencia] - URGENCY_RANK[b.urgencia];
    if (rankDiff !== 0) return rankDiff;
    return b.id - a.id;
  });
}

export default function App() {
  const [activeView, setActiveView] = useState<ActiveView>('triage');
  const [documents, setDocuments] = useState<LegalDocument[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<number | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<LegalDocument | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [samples, setSamples] = useState<SampleDocumentInfo[]>([]);
  const [models, setModels] = useState<AiModelOption[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('gemini-3.1-flash-lite');

  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isSendingChat, setIsSendingChat] = useState(false);
  const [isLoadingSamples, setIsLoadingSamples] = useState(false);
  const [loadingSlug, setLoadingSlug] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [urgencyFilter, setUrgencyFilter] = useState<UrgencyFilter>('ALL');

  const [globalError, setGlobalError] = useState<string | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);

  const hiddenFileInputRef = useRef<HTMLInputElement | null>(null);

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
        error instanceof Error ? error.message : 'Falha ao carregar a fila de documentos.'
      );
    } finally {
      setIsLoadingList(false);
    }
  }, []);

  useEffect(() => {
    void loadDocumentList();
    fetchSamples()
      .then(setSamples)
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
  }, [loadDocumentList]);

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

  const handleUploadFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setGlobalError('Selecione um arquivo válido com extensão .pdf.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setGlobalError('O arquivo excede o limite de 10 MB.');
      return;
    }

    setGlobalError(null);
    setIsUploading(true);
    setActiveView('triage');

    try {
      const created = await uploadPdfDocument(file, selectedModel);
      setDocuments((prev) => sortByUrgency([created, ...prev]));
      setSelectedDocId(created.id);
      setSelectedDoc(created);
      setMessages([]);
    } catch (error) {
      setGlobalError(
        error instanceof Error
          ? error.message
          : 'Não foi possível processar o arquivo PDF enviado.'
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleTriggerUpload = () => {
    hiddenFileInputRef.current?.click();
  };

  const handleGlobalFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      void handleUploadFile(file);
      e.target.value = '';
    }
  };

  const handleLoadAllSamples = async () => {
    setGlobalError(null);
    setIsLoadingSamples(true);
    try {
      const created = await loadSamples(undefined, selectedModel);
      const updated = await fetchDocuments();
      setDocuments(updated);
      const highPriority =
        created.find((d) => d.urgencia === 'ALTA') ?? created[0] ?? updated[0] ?? null;
      if (highPriority) {
        setSelectedDocId(highPriority.id);
      }
      setActiveView('triage');
    } catch (error) {
      setGlobalError(
        error instanceof Error
          ? error.message
          : 'Erro ao processar os 3 PDFs de demonstração.'
      );
    } finally {
      setIsLoadingSamples(false);
    }
  };

  const handleLoadSingleSample = async (slug: string) => {
    setGlobalError(null);
    setLoadingSlug(slug);
    try {
      const created = await loadSamples(slug, selectedModel);
      const updated = await fetchDocuments();
      setDocuments(updated);
      if (created[0]) {
        setSelectedDocId(created[0].id);
      }
      setActiveView('triage');
    } catch (error) {
      setGlobalError(
        error instanceof Error
          ? error.message
          : 'Erro ao processar o documento de demonstração.'
      );
    } finally {
      setLoadingSlug(null);
    }
  };

  const handleSendQuestion = async (question: string) => {
    if (selectedDocId === null) return;
    setChatError(null);
    setIsSendingChat(true);

    try {
      const result = await sendChatQuestion(selectedDocId, question, selectedModel);
      setMessages((prev) => [...prev, result.userMessage, result.assistantMessage]);
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
        accept="application/pdf,.pdf"
        onChange={handleGlobalFileChange}
        className="sr-only"
      />

      <TopBar
        activeView={activeView}
        onChangeView={setActiveView}
        onTriggerUpload={handleTriggerUpload}
        isUploading={isUploading}
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

      {activeView === 'triage' && (
        <div className="flex flex-1 flex-col lg:flex-row">
          <DocumentQueue
            documents={documents}
            selectedId={selectedDocId}
            onSelect={setSelectedDocId}
            onUploadFile={handleUploadFile}
            onLoadAllSamples={handleLoadAllSamples}
            isLoadingList={isLoadingList}
            isUploading={isUploading}
            isLoadingSamples={isLoadingSamples}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            urgencyFilter={urgencyFilter}
            onUrgencyFilterChange={setUrgencyFilter}
            models={models}
            selectedModel={selectedModel}
            onModelChange={setSelectedModel}
          />
          <DocumentDetail
            document={selectedDoc}
            messages={messages}
            isLoadingDetail={isLoadingDetail}
            isSendingChat={isSendingChat}
            chatError={chatError}
            onSendQuestion={handleSendQuestion}
            onDeleteDocument={handleDeleteDocument}
            onLoadAllSamples={handleLoadAllSamples}
            onTriggerUpload={handleTriggerUpload}
            isLoadingSamples={isLoadingSamples}
          />
        </div>
      )}

      {activeView === 'demo_kit' && (
        <DemoKitView
          samples={samples}
          isLoadingSamples={isLoadingSamples}
          loadingSlug={loadingSlug}
          onLoadAllSamples={handleLoadAllSamples}
          onLoadSingleSample={handleLoadSingleSample}
          models={models}
          selectedModel={selectedModel}
          onModelChange={setSelectedModel}
        />
      )}

      {activeView === 'architecture' && <ArchitectureView />}
    </div>
  );
}
