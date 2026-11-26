import { HelpCircle, Upload } from 'lucide-react';

interface TopBarProps {
  onOpenHelp: () => void;
  onTriggerUpload: () => void;
  isAnalyzing: boolean;
}

export function TopBar({
  onOpenHelp,
  onTriggerUpload,
  isAnalyzing,
}: TopBarProps) {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-8 border-b border-[#E2E8F0] bg-white px-6">
      <span className="font-editorial text-xl font-semibold tracking-tight text-[#0F172A] whitespace-nowrap shrink-0">
        JurisTriage
      </span>

      <div className="flex items-center gap-3 shrink-0">
        <button
          type="button"
          onClick={onOpenHelp}
          className="inline-flex h-10 items-center gap-1.5 rounded-md border border-[#E2E8F0] bg-white px-3.5 text-sm font-medium text-[#475569] transition-colors hover:border-[#CBD5E1] hover:bg-[#F8FAFC] hover:text-[#0F172A] whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1E3A5F]"
        >
          <HelpCircle className="h-4 w-4 text-[#64748B]" aria-hidden="true" />
          <span>Ajuda &amp; Docs</span>
        </button>

        <button
          type="button"
          onClick={onTriggerUpload}
          disabled={isAnalyzing}
          className="inline-flex h-10 items-center gap-2 rounded-md bg-[#1E3A5F] px-4 text-sm font-medium text-white transition-colors hover:bg-[#152A45] disabled:cursor-not-allowed disabled:opacity-60 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1E3A5F]"
        >
          <Upload className="h-4 w-4" aria-hidden="true" />
          <span>{isAnalyzing ? 'Analisando...' : 'Enviar Documento'}</span>
        </button>
      </div>
    </header>
  );
}
