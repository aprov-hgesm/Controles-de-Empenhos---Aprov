'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  onRestoreNormal: () => void;
}

interface State { failed: boolean }

/**
 * Local containment for the optional R1 text-only module. A dynamic import or
 * render error must not replace the entire authenticated Warehouse with the
 * global error screen. No permission, billing or database guard is bypassed.
 */
export class WarehouseEssentialSurfaceBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, _info: ErrorInfo) {
    console.error('WAREHOUSE_ESSENTIAL_RENDER_FAILURE', error.name || 'unknown');
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <section role="alert" data-testid="warehouse-essential-local-recovery"
        className="rounded-2xl border border-amber-200 bg-white px-5 py-6 text-slate-800">
        <h2 className="text-lg font-bold">A consulta leve encontrou um problema</h2>
        <p className="mt-2 text-sm">
          A Central permanece acessível. Você pode voltar à visualização Normal
          sem encerrar a sessão ou modificar registros.
        </p>
        <button type="button" onClick={this.props.onRestoreNormal}
          className="mt-4 rounded-lg bg-blue-800 px-4 py-2 text-sm font-bold text-white">
          Abrir no modo Normal
        </button>
      </section>
    );
  }
}
