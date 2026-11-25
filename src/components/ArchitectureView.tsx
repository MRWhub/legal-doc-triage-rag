import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

interface CodeSnippetBlock {
  id: string;
  title: string;
  description: string;
  code: string;
}

const SNIPPETS: CodeSnippetBlock[] = [
  {
    id: 'step1-ubuntu',
    title: '01. Passo 1 no Ubuntu — Estrutura Modular, .gitignore e Commit Inicial',
    description:
      'Cria a estrutura limpa espelhando o padrão do edge-ai-offline-assistant com branches main e develop.',
    code: `mkdir -p juristriage-legal-rag/{backend,frontend,scripts} && cd juristriage-legal-rag
git init -b main
python3 -m venv venv && source venv/bin/activate
git add .gitignore .env.example LICENSE
git commit -m "chore: inicializar estrutura modular, .gitignore rigoroso e licença MIT"
git checkout -b develop`,
  },
  {
    id: 'python-fastapi',
    title: '02. Execução do Módulo Python/FastAPI Incluído em /backend e /scripts',
    description:
      'O repositório já contém o back-end equivalente completo em FastAPI + pypdf + Pydantic + SQLAlchemy + fpdf2.',
    code: `source venv/bin/activate
pip install -r backend/requirements.txt
cp .env.example .env
# Defina GOOGLE_API_KEY no arquivo .env (bloqueado pelo .gitignore)
python scripts/generate_sample_pdfs.py
uvicorn backend.main:app --reload --port 8000`,
  },
  {
    id: 'git-commits',
    title: '03. Versionamento Progressivo (Conventional Commits) & Push para MRWhub',
    description:
      'Sequência recomendada de commits semânticos na develop e consolidação limpa na main antes do push.',
    code: `git add scripts/generate_sample_pdfs.py
git commit -m "feat(data): adicionar gerador fpdf2 com 3 PDFs jurídicos fictícios"

git add backend/schemas.py backend/extractor.py backend/llm_service.py
git commit -m "feat(ai): implementar extrator paginado pypdf e triagem/RAG via Gemini Flash"

git add backend/models.py backend/main.py backend/requirements.txt
git commit -m "feat(api): criar endpoints FastAPI com persistência SQLite e SQLAlchemy"

git add src/ server.ts server/ index.html package.json
git commit -m "feat(ui): construir interface Master-Detail editorial com chat RAG clicável"

git add README.md
git commit -m "docs: adicionar README técnico com diagrama Mermaid e guia de execução"

git checkout main && git merge --no-ff develop -m "chore: consolidar MVP JurisTriage v1.0 na main"
git remote add origin https://github.com/MRWhub/juristriage-legal-rag.git
git push -u origin main develop`,
  },
];

export function ArchitectureView() {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => {
        setCopiedId((current) => (current === id ? null : current));
      }, 1800);
    } catch {
      // Clipboard API unavailable in restricted contexts
    }
  };

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10">
      <div className="border-b border-[#E2E8F0] pb-8">
        <p className="text-xs font-medium text-[#64748B]">
          Engenharia &amp; Entrega de Portfólio · Padrão MRWhub
        </p>
        <h1 className="mt-2 font-editorial text-3xl font-semibold text-[#0F172A]">
          Arquitetura Modular, Módulo Python/FastAPI e Fluxo Git
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-[#475569]">
          Além da aplicação web interativa rodando ao vivo neste ambiente, o projeto inclui a
          camada Python/FastAPI completa em <code className="tabular-data text-[#0F172A]">backend/</code>,
          o gerador de massa <code className="tabular-data text-[#0F172A]">fpdf2</code> em{' '}
          <code className="tabular-data text-[#0F172A]">scripts/</code>, a licença MIT (2026,
          Miguel Rabelo Wagner) e o <code className="tabular-data text-[#0F172A]">README.md</code>{' '}
          com diagrama Mermaid pronto para publicar no GitHub.
        </p>
      </div>

      {/* Modular Architecture Summary */}
      <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="border border-[#E2E8F0] bg-white p-6">
          <p className="tabular-data text-xs font-semibold text-[#1E3A5F]">CAMADA DE INGESTÃO</p>
          <h2 className="mt-2 font-editorial text-lg font-semibold text-[#0F172A]">
            Extração Paginada
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-[#475569]">
            Valida cabeçalho <code className="tabular-data text-xs">%PDF-</code> e injeta
            marcadores explícitos <code className="tabular-data text-xs">--- PÁGINA X ---</code>{' '}
            para auditoria direta (unpdf na versão live e pypdf no espelho FastAPI).
          </p>
        </div>

        <div className="border border-[#E2E8F0] bg-white p-6">
          <p className="tabular-data text-xs font-semibold text-[#1E3A5F]">MOTOR DE IA</p>
          <h2 className="mt-2 font-editorial text-lg font-semibold text-[#0F172A]">
            Schema &amp; RAG Ancorado
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-[#475569]">
            Gemini Flash executa extração JSON tipada (CNJ opcional + urgência) e responde dúvidas
            estritamente dentro do texto do PDF, citando páginas e recusando alucinações.
          </p>
        </div>

        <div className="border border-[#E2E8F0] bg-white p-6">
          <p className="tabular-data text-xs font-semibold text-[#1E3A5F]">PERSISTÊNCIA &amp; API</p>
          <h2 className="mt-2 font-editorial text-lg font-semibold text-[#0F172A]">
            SQLite Priorizado
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-[#475569]">
            Consultas parametrizadas ordenam a fila por severidade (ALTA, MEDIA, BAIXA) e mantêm o
            histórico de conversas vinculado por chave estrangeira com exclusão em cascata.
          </p>
        </div>
      </div>

      {/* Copyable Ubuntu & Git Workflow Commands */}
      <div className="mt-10 space-y-6">
        {SNIPPETS.map((block) => {
          const isCopied = copiedId === block.id;
          return (
            <section key={block.id} className="border border-[#E2E8F0] bg-white">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E2E8F0] px-6 py-4">
                <div>
                  <h2 className="font-editorial text-lg font-semibold text-[#0F172A]">
                    {block.title}
                  </h2>
                  <p className="mt-0.5 text-xs text-[#64748B]">{block.description}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy(block.id, block.code)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[#CBD5E1] bg-white px-3 text-xs font-medium text-[#0F172A] transition-colors hover:bg-[#F8FAFC] whitespace-nowrap shrink-0"
                >
                  {isCopied ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-[#15803D]" aria-hidden="true" />
                      <span>Copiado</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5 text-[#64748B]" aria-hidden="true" />
                      <span>Copiar comandos</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="overflow-x-auto bg-[#0F172A] px-6 py-4 font-mono text-xs leading-relaxed text-[#E2E8F0]">
                {block.code}
              </pre>
            </section>
          );
        })}
      </div>
    </main>
  );
}
