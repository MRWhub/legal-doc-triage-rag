import { Download, Loader2, Play, Sparkles } from 'lucide-react';
import type { SampleDocumentInfo, UrgencyLevel } from '../types';

interface DemoKitViewProps {
  samples: SampleDocumentInfo[];
  isLoadingSamples: boolean;
  loadingSlug: string | null;
  onLoadAllSamples: () => void;
  onLoadSingleSample: (slug: string) => void;
}

const URGENCY_META: Record<UrgencyLevel, { label: string; colorClass: string }> = {
  ALTA: { label: 'Urgência Alta', colorClass: 'text-[#B91C1C]' },
  MEDIA: { label: 'Urgência Média', colorClass: 'text-[#B45309]' },
  BAIXA: { label: 'Urgência Baixa', colorClass: 'text-[#15803D]' },
};

export function DemoKitView({
  samples,
  isLoadingSamples,
  loadingSlug,
  onLoadAllSamples,
  onLoadSingleSample,
}: DemoKitViewProps) {
  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10">
      <div className="flex flex-col gap-5 border-b border-[#E2E8F0] pb-8 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          <p className="text-xs font-medium text-[#64748B]">
            Massa de Teste Realista · 3 PDFs Jurídicos Fictícios
          </p>
          <h1 className="mt-2 font-editorial text-3xl font-semibold text-[#0F172A]">
            Kit de Demonstração para Entrevista
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-[#475569]">
            Baixe os arquivos PDF gerados dinamicamente para simular o upload manual ao vivo diante
            da banca, ou carregue os três documentos de uma vez diretamente pelo pipeline real de
            extração paginada, classificação via Gemini Flash e persistência SQLite.
          </p>
        </div>

        <button
          type="button"
          onClick={onLoadAllSamples}
          disabled={isLoadingSamples || loadingSlug !== null}
          className="inline-flex h-10 items-center gap-2 rounded-md bg-[#1E3A5F] px-4 text-sm font-medium text-white transition-colors hover:bg-[#152A45] disabled:cursor-not-allowed disabled:opacity-60 whitespace-nowrap shrink-0"
        >
          {isLoadingSamples ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              <span>Processando os 3 PDFs...</span>
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              <span>Carregar os 3 PDFs no Sistema</span>
            </>
          )}
        </button>
      </div>

      <div className="mt-8 divide-y divide-[#E2E8F0] border border-[#E2E8F0] bg-white">
        {samples.map((sample, index) => {
          const urgency = URGENCY_META[sample.expectedUrgency];
          const isSingleLoading = loadingSlug === sample.slug;

          return (
            <div
              key={sample.slug}
              className="flex flex-col gap-5 p-6 lg:flex-row lg:items-center lg:justify-between"
            >
              <div className="min-w-0 max-w-2xl">
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-[#64748B]">
                  <span className="tabular-data font-semibold text-[#1E3A5F]">
                    0{index + 1}.
                  </span>
                  <span className={`font-semibold ${urgency.colorClass}`}>
                    {urgency.label}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{sample.hasCnj ? 'Com número CNJ' : 'Sem número CNJ (Opcional)'}</span>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-data">{sample.pageCount} páginas</span>
                </div>

                <h2 className="mt-2 font-editorial text-xl font-semibold text-[#0F172A]">
                  {sample.title}
                </h2>
                <p className="mt-1.5 text-sm leading-relaxed text-[#475569]">
                  {sample.summary}
                </p>
                <p className="mt-2 tabular-data text-xs text-[#64748B]">{sample.filename}</p>
              </div>

              <div className="flex flex-wrap items-center gap-3 shrink-0">
                <a
                  href={`/api/samples/${sample.slug}/pdf`}
                  download={sample.filename}
                  className="inline-flex h-10 items-center gap-2 rounded-md border border-[#CBD5E1] bg-white px-4 text-sm font-medium text-[#0F172A] transition-colors hover:bg-[#F8FAFC] whitespace-nowrap shrink-0"
                >
                  <Download className="h-4 w-4 text-[#475569]" aria-hidden="true" />
                  <span>Baixar PDF</span>
                </a>

                <button
                  type="button"
                  onClick={() => onLoadSingleSample(sample.slug)}
                  disabled={isLoadingSamples || loadingSlug !== null}
                  className="inline-flex h-10 items-center gap-2 rounded-md bg-[#1E3A5F] px-4 text-sm font-medium text-white transition-colors hover:bg-[#152A45] disabled:cursor-not-allowed disabled:opacity-60 whitespace-nowrap shrink-0"
                >
                  {isSingleLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      <span>Processando...</span>
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4" aria-hidden="true" />
                      <span>Processar Agora</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-8 border border-[#E2E8F0] bg-white p-6">
        <h3 className="font-editorial text-lg font-semibold text-[#0F172A]">
          Roteiro Rápido para a Demonstração Ao Vivo
        </h3>
        <ol className="mt-4 space-y-3 text-sm leading-relaxed text-[#475569]">
          <li>
            <span className="font-semibold text-[#0F172A]">1. Prove o Schema Flexível:</span>{' '}
            Envie a intimação urgente (CNJ presente, urgência ALTA) e depois o contrato comercial
            (sem CNJ, urgência BAIXA) mostrando que a fila se reordena automaticamente por
            severidade no SQLite.
          </li>
          <li>
            <span className="font-semibold text-[#0F172A]">2. Audite a Rastreabilidade:</span>{' '}
            Pergunte no chat qual o valor da multa diária ou a multa rescisória, clique em{' '}
            <span className="font-medium text-[#0F172A]">Ver Página X</span> na resposta e mostre o
            marcador <span className="tabular-data text-xs text-[#1E3A5F]">--- PÁGINA X ---</span>{' '}
            no texto extraído.
          </li>
          <li>
            <span className="font-semibold text-[#0F172A]">3. Prove a Trava Anti-Alucinação:</span>{' '}
            Clique na sugestão fora do documento no chat e demonstre o modelo recusando inventar
            dados inexistentes nos autos.
          </li>
        </ol>
      </div>
    </main>
  );
}
