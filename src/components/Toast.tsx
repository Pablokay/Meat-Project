import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { CircleCheck as CheckCircle2, Info, CircleAlert as AlertCircle, X } from 'lucide-react';

type ToastKind = 'success' | 'info' | 'error';
type Toast = { id: number; message: string; kind: ToastKind };

const ToastContext = createContext<(message: string, kind?: ToastKind) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

const ICON: Record<ToastKind, ReactNode> = {
  success: <CheckCircle2 size={18} className="text-forest-700" />,
  info: <Info size={18} className="text-forest-700" />,
  error: <AlertCircle size={18} className="text-clay" />,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((message: string, kind: ToastKind = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3000);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex flex-col items-center gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto flex items-center gap-2.5 bg-paper border border-forest-700/10 rounded-full pl-4 pr-3 py-2.5 animate-[toastIn_0.2s_ease-out]">
            {ICON[t.kind]}
            <span className="text-sm font-medium text-forest-900">{t.message}</span>
            <button onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))} className="text-forest-800/40 hover:text-forest-800"><X size={14} /></button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
