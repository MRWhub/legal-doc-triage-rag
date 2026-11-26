import { useEffect, useState } from 'react';
import { BookOpen, Check, Copy, Layers, X } from 'lucide-react';

interface HelpDocsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

type DrawerTab = 'architecture' | 'business_rules';

const UBUNTU_COMMANDS = `# 1. Ambiente virtual Python + dependências FastAPI
python3 -m venv venv && source venv/bin/activate
pip install -r backend/requirements.txt

# 2. Configure suas chaves no .env (bloqueado pelo .gitignore)
cp .env.example .env

# 3. Inicie o backend Python (porta 8000) + front-end React/Vite (porta 3000)
npm install
npm run dev

# Ou rode separadamente em dois terminais:
# Terminal 1: uvicorn backend.main:app --reload --port 8000
# Terminal 2: npm run dev:ui`;

const GIT_COMMANDS = `git checkout -b develop

git add vite.config.ts package.json
git commit -m "refactor(backend): remover backend TS e configurar proxy Vite para Python"

git add backend/extractor.py
git commit -m "feat(ingest): implementar extrator universal Python (PDF, TXT, MD) com [Pág. X]"

git add backend/db.py backend/models.py backend/schemas.py backend/llm_service.py
git commit -m "feat(ai): normalizar ficha universal, perguntas dinâmicas e usage_metadata"

git add backend/main.py backend/run_server.py
git commit -m "feat(rag): adicionar staging/salvar, RAG Dual-Mode e métricas de tokens"

git add src/
git commit -m "feat(ui): remover Kit de Demo, adicionar staging Salvar, Cérebro e Drawer Ajuda"

git add README.md docs/
git commit -m "docs: criar documentação de Regras de Negócio e sincronizar README"`;

export function HelpDocsDrawer({ isOpen, onClose }: HelpDocsDrawerProps) {
  const [activeTab, setActiveTab] = useState<DrawerTab>('business_rules');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleCopy = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      setTimeout(() => {
        setCopiedKey((curr) => (curr === key ? null : curr));
      }, 1800);
    } catch {
      // Clipboard unavailable
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Ajuda e Documentação do JurisTriage"
      className="fixed inset-0 z-50 flex justify-end"
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        aria-hidden="true"
        className="fixed inset-0 bg-[#0F172A]/35 backdrop-blur-[1px] transition-opacity"
      />

      {/* Sliding Drawer */}
      <div className="relative z-10 flex h-full w-full max-w-2xl flex-col border-l border-[#E2E8F0] bg-white shadow-xl">
        {/* Drawer Header */}
        <div className="flex items-center justify-between gap-4 border-b border-[#E2E8F0] px-6 py-4">
          <div>
            <h2 className="font-editorial text-xl font-semibold text-[#0F172A]">
              Ajuda &amp; Documentação
            </h2>
            <p className="mt-0.5 text-xs text-[#64748B]">
              Referência operacional e arquitetural do JurisTriage
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar painel de ajuda"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[#E2E8F0] text-[#475569] transition-colors hover:bg-[#F8FAFC] hover:text-[#0F172A]"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Two Navigable Sections */}
        <div
          role="tablist"
          aria-label="Seções da documentação"
          className="grid grid-cols-2 gap-1 border-b border-[#E2E8F0] bg-[#F8FAFC] px-6 py-2.5"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'business_rules'}
            onClick={() => setActiveTab('business_rules')}
            className={`inline-flex h-9 items-center justify-center gap-2 rounded-md px-3 text-xs font-medium transition-colors whitespace-nowrap ${
              activeTab === 'business_rules'
                ? 'bg-white text-[#0F172A] shadow-xs ring-1 ring-[#E2E8F0]'
                : 'text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Regras de Negócio &amp; Triagem</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'architecture'}
            onClick={() => setActiveTab('architecture')}
            className={`inline-flex h-9 items-center justify-center gap-2 rounded-md px-3 text-xs font-medium transition-colors whitespace-nowrap ${
              activeTab === 'architecture'
                ? 'bg-white text-[#0F172A] shadow-xs ring-1 ring-[#E2E8F0]'
                : 'text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            <Layers className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Arquitetura do Sistema</span>
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {activeTab === 'business_rules' ? (
            <div className="space-y-6 text-sm leading-relaxed text-[#475569]">
              <section className="space-y-2">
                <h3 className="font-editorial text-lg font-semibold text-[#0F172A]">
                  1. Fluxo de Ingestão Universal (PDF, TXT e Markdown)
                </h3>
                <p>
                  A Área de Triagem aceita qualquer documento nos formatos{' '}
                  <span className="tabular-data text-xs font-medium text-[#0F172A]">.pdf</span>,{' '}
                  <span className="tabular-data text-xs font-medium text-[#0F172A]">.txt</span> e{' '}
                  <span className="tabular-data text-xs font-medium text-[#0F172A]">.md</span> (até
                  10 MB em memória). PDFs passam por validação da assinatura binária{' '}
                  <span className="tabular-data text-xs text-[#0F172A]">%PDF-</span> e extração
                  página a página via <span className="tabular-data text-xs">pypdf</span>; arquivos
                  texto/Markdown são segmentados logicamente por parágrafos em blocos padronizados
                  com marcadores <span className="tabular-data text-xs font-semibold text-[#1E3A5F]">[Pág. X]</span>.
                </p>
              </section>

              <section className="space-y-2 border-t border-[#E2E8F0] pt-5">
                <h3 className="font-editorial text-lg font-semibold text-[#0F172A]">
                  2. Revisão em Staging &amp; Persistência Explícita na Memória
                </h3>
                <p>
                  O envio de um arquivo aciona{' '}
                  <span className="tabular-data text-xs text-[#0F172A]">POST /api/documents/analyze</span>,
                  que extrai a ficha estruturada, gera as perguntas sugeridas e contabiliza os
                  tokens reais gastos <strong>sem gravar automaticamente no banco</strong>. O
                  documento abre em pré-visualização com duas decisões explícitas:
                </p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>
                    <strong className="text-[#0F172A]">Salvar na Memória:</strong> persiste o
                    documento, os blocos paginados e o consumo de tokens no SQLite (
                    <span className="tabular-data text-xs">POST /api/documents</span>), tornando-o
                    disponível na fila priorizada e nas buscas globais do Cérebro.
                  </li>
                  <li>
                    <strong className="text-[#0F172A]">Descartar:</strong> limpa o rascunho da
                    sessão sem poluir a base persistente.
                  </li>
                </ul>
              </section>

              <section className="space-y-2 border-t border-[#E2E8F0] pt-5">
                <h3 className="font-editorial text-lg font-semibold text-[#0F172A]">
                  3. Critérios de Classificação de Urgência &amp; Priorização
                </h3>
                <p>
                  A fila lateral ordena todos os registros diretamente em SQL por severidade (
                  <span className="tabular-data text-xs">ALTA → MEDIA → BAIXA</span>) e ordem
                  cronológica inversa:
                </p>
                <dl className="mt-2 space-y-2">
                  <div>
                    <dt className="text-xs font-semibold text-[#B91C1C]">Urgência Alta (ALTA)</dt>
                    <dd className="text-xs text-[#475569]">
                      Prazos curtos/fatais (≤ 10 dias), risco imediato de multa diária, bloqueio
                      judicial (SISBAJUD), liminar, tutela de urgência ou vencimento crítico.
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold text-[#B45309]">Urgência Média (MEDIA)</dt>
                    <dd className="text-xs text-[#475569]">
                      Petições iniciais, audiências agendadas, obrigações de médio prazo (15 a 30
                      dias) ou pendências administrativas com ação planejada.
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold text-[#15803D]">Urgência Baixa (BAIXA)</dt>
                    <dd className="text-xs text-[#475569]">
                      Contratos de longa vigência sem alerta imediato, políticas internas, manuais,
                      atas informativas ou textos gerais de consulta.
                    </dd>
                  </div>
                </dl>
              </section>

              <section className="space-y-2 border-t border-[#E2E8F0] pt-5">
                <h3 className="font-editorial text-lg font-semibold text-[#0F172A]">
                  4. Normalização Universal &amp; Perguntas Sugeridas Dinâmicas
                </h3>
                <p>
                  Qualquer tipo de documento (judicial, contratual, administrativo ou texto geral)
                  é normalizado em uma ficha única. Metadados inexistentes (como número CNJ ou valor
                  monetário) recebem fallback limpo (<strong className="text-[#0F172A]">Não aplicável</strong>).
                  Durante a própria análise inicial, o Structured Output gera de{' '}
                  <strong className="text-[#0F172A]">3 a 4 perguntas sugeridas</strong> baseadas nos
                  prazos, riscos, cláusulas e obrigações literais daquele arquivo para acelerar o
                  chat RAG.
                </p>
              </section>

              <section className="space-y-2 border-t border-[#E2E8F0] pt-5">
                <h3 className="font-editorial text-lg font-semibold text-[#0F172A]">
                  5. Agente RAG Dual-Mode &amp; Guardrails Anti-Alucinação
                </h3>
                <ul className="list-disc space-y-1.5 pl-5">
                  <li>
                    <strong className="text-[#0F172A]">Modo Documento Atual:</strong> responde
                    estritamente sobre o documento aberto, citando{' '}
                    <span className="tabular-data text-xs text-[#1E3A5F]">[Pág. X]</span> para cada
                    afirmação factual e recusando literalmente com{' '}
                    <em>&ldquo;Esta informação não consta no documento analisado.&rdquo;</em> quando
                    não houver lastro no texto.
                  </li>
                  <li>
                    <strong className="text-[#0F172A]">Modo Base de Conhecimento (Cérebro):</strong>{' '}
                    executa consultas cruzadas e filtros por critério (urgência, tipo, partes,
                    prazos, valores ou temas) sobre todos os documentos salvos na memória, exigindo
                    citação clicável{' '}
                    <span className="tabular-data text-xs text-[#1E3A5F]">
                      [Doc: arquivo | Pág. X]
                    </span>{' '}
                    verificada no servidor contra os registros existentes.
                  </li>
                  <li>
                    <strong className="text-[#0F172A]">Parâmetros Determinísticos:</strong>{' '}
                    <span className="tabular-data text-xs">temperature = 0.0</span> na extração e{' '}
                    <span className="tabular-data text-xs">0.1</span> no RAG nos modelos compatíveis
                    (Gemini 3.1 Flash Lite, Gemini 2.5 Flash e Groq Llama 3.3),{' '}
                    <span className="tabular-data text-xs">seed = 42</span> e proteção contra{' '}
                    <em>prompt injection</em> embutido em documentos.
                  </li>
                </ul>
              </section>

              <section className="space-y-2 border-t border-[#E2E8F0] pt-5">
                <h3 className="font-editorial text-lg font-semibold text-[#0F172A]">
                  6. Governança &amp; Rastreabilidade Real de Tokens
                </h3>
                <p>
                  Cada operação de IA captura os contadores reais de{' '}
                  <span className="tabular-data text-xs text-[#0F172A]">usage_metadata</span>{' '}
                  (entrada, saída e total) retornados pelo provedor. O consumo da extração é
                  gravado junto ao documento; cada interação de chat grava seu consumo próprio, e o
                  sistema soma automaticamente o total acumulado por processo e da base inteira (
                  <span className="tabular-data text-xs text-[#0F172A]">GET /api/metrics/tokens</span>).
                </p>
              </section>
            </div>
          ) : (
            <div className="space-y-6 text-sm leading-relaxed text-[#475569]">
              <section className="space-y-2">
                <h3 className="font-editorial text-lg font-semibold text-[#0F172A]">
                  Stack Unificada: React/Vite + Backend 100% Python
                </h3>
                <p>
                  Todo o processamento de negócio, extração documental, chamadas LLM, RAG e
                  persistência SQLite reside exclusivamente em{' '}
                  <span className="tabular-data text-xs font-medium text-[#0F172A]">backend/</span>{' '}
                  (Python nativo na porta 8000). O front-end React + Vite roda na porta 3000 e
                  encaminha chamadas <span className="tabular-data text-xs">/api/*</span> via proxy
                  reverso transparente.
                </p>
              </section>

              <section className="border border-[#E2E8F0] bg-[#F8FAFC] p-4">
                <p className="tabular-data text-[11px] font-semibold text-[#1E3A5F]">
                  FLUXO DE DADOS EM PRODUÇÃO
                </p>
                <pre className="mt-2 overflow-x-auto font-mono text-[11px] leading-relaxed text-[#0F172A]">{`React SPA (:3000) ── proxy /api/* ──▶ Backend Python (:8000)
                                        ├── extractor.py   (PDF/TXT/MD → [Pág. X])
                                        ├── llm_service.py (Gemini/Groq + Grounding + Tokens)
                                        ├── db.py          (SQLite WAL + Migrações)
                                        └── main.py        (FastAPI + OpenAPI /docs)`}</pre>
              </section>

              <section className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-editorial text-base font-semibold text-[#0F172A]">
                    Execução Local no Ubuntu (FastAPI + React)
                  </h3>
                  <button
                    type="button"
                    onClick={() => handleCopy('ubuntu', UBUNTU_COMMANDS)}
                    className="inline-flex h-8 items-center gap-1.5 rounded border border-[#CBD5E1] bg-white px-2.5 text-xs font-medium text-[#0F172A] hover:bg-[#F8FAFC]"
                  >
                    {copiedKey === 'ubuntu' ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-[#15803D]" aria-hidden="true" />
                        <span>Copiado</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5 text-[#64748B]" aria-hidden="true" />
                        <span>Copiar</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="overflow-x-auto rounded-md bg-[#0F172A] p-4 font-mono text-xs leading-relaxed text-[#E2E8F0]">
                  {UBUNTU_COMMANDS}
                </pre>
              </section>

              <section className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-editorial text-base font-semibold text-[#0F172A]">
                    Fluxo Conventional Commits (MRWhub)
                  </h3>
                  <button
                    type="button"
                    onClick={() => handleCopy('git', GIT_COMMANDS)}
                    className="inline-flex h-8 items-center gap-1.5 rounded border border-[#CBD5E1] bg-white px-2.5 text-xs font-medium text-[#0F172A] hover:bg-[#F8FAFC]"
                  >
                    {copiedKey === 'git' ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-[#15803D]" aria-hidden="true" />
                        <span>Copiado</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5 text-[#64748B]" aria-hidden="true" />
                        <span>Copiar</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="overflow-x-auto rounded-md bg-[#0F172A] p-4 font-mono text-xs leading-relaxed text-[#E2E8F0]">
                  {GIT_COMMANDS}
                </pre>
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
