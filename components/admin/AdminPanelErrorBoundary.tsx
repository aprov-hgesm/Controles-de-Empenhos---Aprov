'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = {
  children: ReactNode;
  onOpenOverview: () => void;
};
type State = { failed: boolean };

/**
 * Isola a cena 3D opcional: erro de render não deve desmontar o Admin,
 * sessões, cadastro ou os painéis financeiros. Não altera autorização.
 */
export class AdminPanelErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Diagnóstico local de desenvolvedor: nunca grava token, usuário ou dados no servidor.
    console.error('EMPROVEX_ADMIN_HOME_RENDER_FAILURE', error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <section role="alert" className="rounded-2xl border border-amber-300/30 bg-slate-900 p-6 text-slate-100">
        <h2 className="text-lg font-extrabold">A visão 3D não pôde ser aberta</h2>
        <p className="mt-2 text-sm text-slate-300">
          O restante da administração continua disponível. Esta falha visual não altera seus dados.
        </p>
        <button type="button" onClick={this.props.onOpenOverview}
          className="mt-4 rounded-xl bg-blue-700 px-4 py-2 text-sm font-bold text-white">
          Abrir Visão Geral
        </button>
      </section>
    );
  }
}
