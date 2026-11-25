import React, { useState } from 'react';
import { FileUp, Loader2, Search, Sparkles } from 'lucide-react';
import type { AiModelOption, LegalDocument, UrgencyLevel } from '../types';

export type UrgencyFilter = 'ALL' | UrgencyLevel;

interface DocumentQueueProps {
  documents: LegalDocument[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  onUploadFile: (file: File) => void;
  onLoadAllSamples: () => void;
  isLoadingList: boolean;
  isUploading: boolean;
  isLoadingSamples: boolean;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  urgencyFilter: UrgencyFilter;
  onUrgencyFilterChange: (f: UrgencyFilter) => void;
  models: AiModelOption[];
  selectedModel: string;
  onModelChange: (modelId: string) => void;
}

const URGENCY_LABELS: Record<UrgencyLevel, { text: string; colorClass: string }> = {
  ALTA: { text: 'Urgência Alta', colorClass: 'text-[#B91C1C]' },
  MEDIA: { text: 'Urgência Média', colorClass: 'text-[#B45309]' },
  BAIXA: { text: 'Urgência Baixa', colorClass: 'text-[#15803D]' },
};

const FILTER_OPTIONS: Array<{ id: UrgencyFilter; label: string }> = [
  { id: 'ALL', label: 'Todas' },
  { id: 'ALTA', label: 'Alta' },
  { id: 'MEDIA', label: 'Média' },
  { id: 'BAIXA', label: 'Baixa' },
];

export function DocumentQueue({
  documents,
  selectedId,
  onSelect,
  onUploadFile,
  onLoadAllSamples,
  isLoadingList,
  isUploading,
  isLoadingSamples,
  searchQuery,
  onSearchChange,
  urgencyFilter,
  onUrgencyFilterChange,
  models,
  selectedModel,
  onModelChange,
}: DocumentQueueProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      onUploadFile(file);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUploadFile(file);
      e.target.value = '';
    }
  };

  const counts = {
    ALL: documents.length,
    ALTA: documents.filter((d) => d.urgencia === 'ALTA').length,
    MEDIA: documents.filter((d) => d.urgencia === 'MEDIA').length,
    BAIXA: documents.filter((d) => d.urgencia === 'BAIXA').length,
  };

  const filteredDocuments = documents.filter((doc) => {
    if (urgencyFilter !== 'ALL' && doc.urgencia !== urgencyFilter) {
      return false;
    }
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      doc.tipo_documento.toLowerCase().includes(q) ||
      doc.filename.toLowerCase().includes(q) ||
      (doc.numero_processo ?? '').toLowerCase().includes(q) ||
      doc.partes_envolvidas.some((p) => p.toLowerCase().includes(q)) ||
      doc.prazo_ou_vigencia.toLowerCase().includes(q)
    );
  });

  return (
    <aside
      aria-label="Fila de documentos triados"
      className="flex w-full flex-col border-b border-[#E2E8F0] bg-white lg:h-[calc(100vh-4rem)] lg:w-[380px] lg:shrink-0 lg:border-r lg:border-b-0 xl:w-[410px]"
    >
      {/* Upload Dropzone */}
      <div className="border-b border-[#E2E8F0] p-4">
        <label
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-md border border-dashed px-4 py-4 text-center transition-colors ${
            isDragging
              ? 'border-[#1E3A5F] bg-[#F1F5F9]'
              : 'border-[#CBD5E1] bg-[#F8FAFC] hover:border-[#1E3A5F]/60 hover:bg-[#F1F5F9]/70'
          } ${isUploading ? 'pointer-events-none opacity-75' : ''}`}
        >
          <input
            type="file"
            accept="application/pdf,.pdf"
            onChange={handleInputChange}
            disabled={isUploading}
            className="sr-only"
          />
          {isUploading ? (
            <div className="flex items-center gap-2.5 text-sm font-medium text-[#1E3A5F]">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              <span>Extraindo páginas e classificando com IA...</span>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 text-sm font-medium text-[#0F172A]">
                <FileUp className="h-4 w-4 text-[#1E3A5F]" aria-hidden="true" />
                <span>Arraste um PDF jurídico ou clique para enviar</span>
              </div>
              <p className="mt-1 text-xs text-[#64748B]">
                Intimações, petições ou contratos sem CNJ · Máx. 10 MB
              </p>
            </>
          )}
        </label>

        {models.length > 0 && (
          <div className="mt-3 flex items-center justify-between gap-2">
            <label
              htmlFor="queue-ai-model"
              className="text-xs font-medium text-[#475569] whitespace-nowrap shrink-0"
            >
              Modelo de IA
            </label>
            <select
              id="queue-ai-model"
              value={selectedModel}
              onChange={(e) => onModelChange(e.target.value)}
              className="h-9 min-w-0 flex-1 truncate rounded-md border border-[#E2E8F0] bg-white px-2.5 text-xs font-medium text-[#0F172A] focus:border-[#1E3A5F] focus:outline-none"
            >
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                  {!m.configured ? ' (Requer chave no .env)' : ''}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Search & Urgency Filter */}
      <div className="space-y-3 border-b border-[#E2E8F0] p-4">
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[#64748B]"
            aria-hidden="true"
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar por CNJ, parte, tipo ou arquivo..."
            aria-label="Buscar documentos na fila"
            className="h-10 w-full rounded-md border border-[#E2E8F0] bg-white pr-3 pl-9 text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#1E3A5F] focus:outline-none"
          />
        </div>

        <div
          role="tablist"
          aria-label="Filtrar por urgência"
          className="grid grid-cols-4 gap-1 rounded-md bg-[#F1F5F9] p-1"
        >
          {FILTER_OPTIONS.map((option) => {
            const isActive = urgencyFilter === option.id;
            return (
              <button
                key={option.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => onUrgencyFilterChange(option.id)}
                className={`flex h-8 items-center justify-center gap-1 rounded px-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'bg-white text-[#0F172A] shadow-xs'
                    : 'text-[#64748B] hover:text-[#0F172A]'
                }`}
              >
                <span>{option.label}</span>
                <span className="tabular-data text-[11px] text-[#64748B]">
                  {counts[option.id]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Queue List */}
      <div className="flex-1 overflow-y-auto divide-y divide-[#E2E8F0]">
        {isLoadingList ? (
          <div className="space-y-4 p-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse space-y-2 py-2">
                <div className="h-4 w-3/4 rounded bg-[#E2E8F0]" />
                <div className="h-3 w-1/2 rounded bg-[#F1F5F9]" />
                <div className="h-3 w-5/6 rounded bg-[#F1F5F9]" />
              </div>
            ))}
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div className="flex flex-col items-start px-5 py-8">
            <h3 className="font-editorial text-base font-semibold text-[#0F172A]">
              {documents.length === 0
                ? 'Nenhum documento na fila'
                : 'Nenhum resultado para o filtro'}
            </h3>
            <p className="mt-1.5 text-sm leading-relaxed text-[#475569]">
              {documents.length === 0
                ? 'Envie um PDF acima ou carregue os 3 documentos jurídicos fictícios para demonstrar a triagem e o chat RAG.'
                : 'Ajuste o termo de busca ou altere o filtro de urgência para visualizar outros documentos.'}
            </p>
            {documents.length === 0 && (
              <button
                type="button"
                onClick={onLoadAllSamples}
                disabled={isLoadingSamples}
                className="mt-4 inline-flex h-10 items-center gap-2 rounded-md border border-[#1E3A5F] bg-white px-4 text-sm font-medium text-[#1E3A5F] transition-colors hover:bg-[#F1F5F9] disabled:cursor-not-allowed disabled:opacity-60 whitespace-nowrap"
              >
                {isLoadingSamples ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    <span>Processando 3 PDFs...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" aria-hidden="true" />
                    <span>Carregar 3 PDFs de Demo</span>
                  </>
                )}
              </button>
            )}
          </div>
        ) : (
          filteredDocuments.map((doc) => {
            const isSelected = doc.id === selectedId;
            const urgencyMeta = URGENCY_LABELS[doc.urgencia];

            return (
              <button
                key={doc.id}
                type="button"
                onClick={() => onSelect(doc.id)}
                className={`block w-full px-5 py-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-[#1E3A5F] ${
                  isSelected
                    ? 'bg-[#F1F5F9]'
                    : 'bg-white hover:bg-[#F8FAFC]'
                }`}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="truncate text-sm font-semibold text-[#0F172A]">
                    {doc.tipo_documento}
                  </h3>
                  <span className="tabular-data shrink-0 text-xs text-[#64748B]">
                    {doc.page_count} {doc.page_count === 1 ? 'pág.' : 'págs.'}
                  </span>
                </div>

                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                  <span className={`font-semibold ${urgencyMeta.colorClass}`}>
                    {urgencyMeta.text}
                  </span>
                  <span aria-hidden="true" className="text-[#CBD5E1]">
                    ·
                  </span>
                  <span className="tabular-data truncate text-[#475569]">
                    {doc.numero_processo ?? 'Sem número CNJ'}
                  </span>
                </div>

                <p className="mt-2 truncate text-xs text-[#475569]">
                  <span className="font-medium text-[#0F172A]">Prazo/Vigência:</span>{' '}
                  {doc.prazo_ou_vigencia}
                </p>

                <div className="mt-1 flex items-center justify-between gap-2 text-xs text-[#64748B]">
                  <span className="truncate">{doc.filename}</span>
                  <span className="tabular-data shrink-0 font-medium text-[#0F172A]">
                    {doc.valor_envolvido}
                  </span>
                </div>
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
}
