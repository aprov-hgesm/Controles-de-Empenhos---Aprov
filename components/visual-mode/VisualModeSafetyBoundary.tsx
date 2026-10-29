'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useVisualMode, type VisualMode } from './VisualModeProvider';

interface BoundaryProps {
  mode: VisualMode;
  onEssentialFailure: () => void;
  children: ReactNode;
}

interface BoundaryState { failed: boolean }

/**
 * Último recurso de renderização: captura erro React no modo Essencial, volta
 * ao Normal sem reload e impede loop na mesma sessão. Não captura falhas de
 * autorização, rede ou Firebase como "falha visual".
 *
 * React desmonta a subárvore que lançou exceção; drafts devem permanecer
 * preservados nos providers/hooks acima da fronteira, quando disponíveis.
 */
class ModeRenderBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { failed: false };

  static getDerivedStateFromError(): BoundaryState {
    return { failed: true };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {
    if (this.props.mode === 'essencial') {
      this.props.onEssentialFailure();
    } else {
      console.error('EMPROVEX: falha de renderização no modo Normal.');
    }
  }

  componentDidUpdate(previousProps: BoundaryProps) {
    if (this.state.failed && previousProps.mode !== this.props.mode && this.props.mode === 'premium') {
      this.setState({ failed: false });
    }
  }

  render() {
    if (!this.state.failed) return this.props.children;
    if (this.props.mode === 'essencial') {
      return <main role="status" className="flex min-h-screen items-center justify-center bg-slate-50 p-6 text-sm text-slate-700">Restaurando o modo Normal…</main>;
    }
    return (
      <main role="alert" className="flex min-h-screen items-center justify-center bg-slate-50 px-5 text-slate-800">
        <div className="max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-lg font-bold">Não foi possível abrir esta tela</h1>
          <p className="mt-2 text-sm">Acesso e dados não foram alterados pela recuperação visual. Revise os dados não salvos antes de continuar.</p>
          <button className="mt-4 rounded-lg bg-blue-800 px-4 py-2 font-semibold text-white" onClick={() => window.location.reload()} type="button">Recarregar tela</button>
        </div>
      </main>
    );
  }
}

export function VisualModeSafetyBoundary({ children }: { children: ReactNode }) {
  const { mode, recoveryActive, recoverToNormal } = useVisualMode();

  return (
    <>
      {recoveryActive && (
        <div role="status" data-testid="visual-mode-recovery-notice"
          className="fixed inset-x-0 top-0 z-[9999] border-b border-amber-300 bg-amber-50 px-4 py-2 text-center text-xs font-semibold text-amber-950 shadow-sm">
          O modo Essencial apresentou uma falha. O modo Normal foi restaurado nesta sessão.
        </div>
      )}
      <ModeRenderBoundary mode={mode} onEssentialFailure={recoverToNormal}>
        {children}
      </ModeRenderBoundary>
    </>
  );
}
