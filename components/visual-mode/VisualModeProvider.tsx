'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type VisualMode = 'premium' | 'essencial';

interface VisualModeContextValue {
  mode: VisualMode;
  hydrated: boolean;
  setMode: (mode: VisualMode) => void;
  clear: () => void;
  recoveryActive: boolean;
  recoverToNormal: () => void;
}

const STORAGE_KEY = 'emprovex:visual-mode:v1';
const RECOVERY_KEY = 'emprovex:visual-mode:recovery:v1';

// Somente falhas de carregamento do código de apresentação. Erros de rede,
// autorização, pagamento e operações não significam falha do Modo Essencial.
export function isVisualChunkFailure(value: unknown): boolean {
  const message = value instanceof Error ? value.message : String(value ?? '');
  return /ChunkLoadError|Loading chunk [^ ]+ failed|Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(message);
}
const VisualModeContext = createContext<VisualModeContextValue | null>(null);

export function VisualModeProvider({ children }: { children: ReactNode }) {
  const [mode, setCurrentMode] = useState<VisualMode>('premium');
  const [hydrated, setHydrated] = useState(false);
  const [recoveryActive, setRecoveryActive] = useState(false);

  useEffect(() => {
    try {
      const failed = window.sessionStorage.getItem(RECOVERY_KEY) === '1';
      setRecoveryActive(failed);
      const stored = window.sessionStorage.getItem(STORAGE_KEY);
      if (failed) {
        window.sessionStorage.setItem(STORAGE_KEY, 'premium');
        setCurrentMode('premium');
      } else if (stored === 'premium' || stored === 'essencial') {
        setCurrentMode(stored);
      }
    } catch {
      // Navegadores podem bloquear sessionStorage: manter o modo Normal.
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    document.documentElement.dataset.visualMode = mode;
  }, [mode, hydrated]);

  const setMode = useCallback((nextMode: VisualMode) => {
    if (nextMode === 'essencial' && recoveryActive) return;
    setCurrentMode(nextMode);
    try {
      window.sessionStorage.setItem(STORAGE_KEY, nextMode);
    } catch {
      // Preferência visual nunca deve bloquear o funcionamento da plataforma.
    }
  }, [recoveryActive]);

  const recoverToNormal = useCallback(() => {
    // Falha visual é somente client-side: sem logout, reload ou mutações Firebase.
    setRecoveryActive(true);
    setCurrentMode('premium');
    document.documentElement.dataset.visualMode = 'premium';
    try {
      window.sessionStorage.setItem(RECOVERY_KEY, '1');
      window.sessionStorage.setItem(STORAGE_KEY, 'premium');
    } catch {
      // A recuperação em memória funciona mesmo sem sessionStorage.
    }
  }, []);

  useEffect(() => {
    if (!hydrated || mode !== 'essencial' || recoveryActive) return;
    const onChunkError = (event: ErrorEvent) => {
      if (isVisualChunkFailure(event.error ?? event.message)) recoverToNormal();
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      if (isVisualChunkFailure(event.reason)) recoverToNormal();
    };
    window.addEventListener('error', onChunkError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onChunkError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, [hydrated, mode, recoveryActive, recoverToNormal]);

  const clear = useCallback(() => {
    setCurrentMode('premium');
    setRecoveryActive(false);
    try {
      window.sessionStorage.removeItem(RECOVERY_KEY);
      window.sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // Em memória, o modo retorna ao Normal mesmo se o storage estiver indisponível.
    }
  }, []);

  const value = useMemo(
    () => ({ mode, hydrated, setMode, clear, recoveryActive, recoverToNormal }),
    [mode, hydrated, setMode, clear, recoveryActive, recoverToNormal]
  );

  return <VisualModeContext.Provider value={value}>{children}</VisualModeContext.Provider>;
}

export function useVisualMode(): VisualModeContextValue {
  const context = useContext(VisualModeContext);
  if (!context) throw new Error('VISUAL_MODE_PROVIDER_MISSING');
  return context;
}
