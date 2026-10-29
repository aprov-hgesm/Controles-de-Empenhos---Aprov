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
}

const STORAGE_KEY = 'emprovex:visual-mode:v1';
const VisualModeContext = createContext<VisualModeContextValue | null>(null);

export function VisualModeProvider({ children }: { children: ReactNode }) {
  const [mode, setCurrentMode] = useState<VisualMode>('premium');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = window.sessionStorage.getItem(STORAGE_KEY);
      if (stored === 'premium' || stored === 'essencial') setCurrentMode(stored);
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
    setCurrentMode(nextMode);
    try {
      window.sessionStorage.setItem(STORAGE_KEY, nextMode);
    } catch {
      // Preferência visual nunca deve bloquear o funcionamento da plataforma.
    }
  }, []);

  const clear = useCallback(() => {
    setCurrentMode('premium');
    try {
      window.sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // Em memória, o modo retorna ao Normal mesmo se o storage estiver indisponível.
    }
  }, []);

  const value = useMemo(
    () => ({ mode, hydrated, setMode, clear }),
    [mode, hydrated, setMode, clear]
  );

  return <VisualModeContext.Provider value={value}>{children}</VisualModeContext.Provider>;
}

export function useVisualMode(): VisualModeContextValue {
  const context = useContext(VisualModeContext);
  if (!context) throw new Error('VISUAL_MODE_PROVIDER_MISSING');
  return context;
}
