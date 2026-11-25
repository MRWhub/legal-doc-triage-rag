import { Upload } from 'lucide-react';

export type ActiveView = 'triage' | 'demo_kit' | 'architecture';

interface TopBarProps {
  activeView: ActiveView;
  onChangeView: (view: ActiveView) => void;
  onTriggerUpload: () => void;
  isUploading: boolean;
}

const NAV_ITEMS: Array<{ id: ActiveView; label: string }> = [
  { id: 'triage', label: 'Triagem' },
  { id: 'demo_kit', label: 'Kit de Demo' },
  { id: 'architecture', label: 'Arquitetura' },
];

export function TopBar({
  activeView,
  onChangeView,
  onTriggerUpload,
  isUploading,
}: TopBarProps) {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-8 border-b border-[#E2E8F0] bg-white px-6">
      <button
        type="button"
        onClick={() => onChangeView('triage')}
        className="font-editorial text-xl font-semibold tracking-tight text-[#0F172A] whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1E3A5F]"
      >
        JurisTriage
      </button>

      <nav
        aria-label="Navegação principal"
        className="flex items-center gap-6 text-sm font-medium"
      >
        {NAV_ITEMS.map((item) => {
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChangeView(item.id)}
              className={`relative py-2 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1E3A5F] ${
                isActive
                  ? 'text-[#0F172A]'
                  : 'text-[#64748B] hover:text-[#0F172A]'
              }`}
            >
              {item.label}
              {isActive && (
                <span
                  aria-hidden="true"
                  className="absolute inset-x-0 bottom-0 h-0.5 bg-[#1E3A5F]"
                />
              )}
            </button>
          );
        })}
      </nav>

      <div className="flex items-center shrink-0">
        <button
          type="button"
          onClick={onTriggerUpload}
          disabled={isUploading}
          className="inline-flex h-10 items-center gap-2 rounded-md bg-[#1E3A5F] px-4 text-sm font-medium text-white transition-colors hover:bg-[#152A45] disabled:cursor-not-allowed disabled:opacity-60 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1E3A5F]"
        >
          <Upload className="h-4 w-4" aria-hidden="true" />
          <span>{isUploading ? 'Processando...' : 'Enviar PDF'}</span>
        </button>
      </div>
    </header>
  );
}
