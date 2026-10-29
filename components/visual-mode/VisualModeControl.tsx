'use client';

import { MonitorCog } from 'lucide-react';
import { useId } from 'react';

import { useVisualMode } from './VisualModeProvider';

export function VisualModeControl() {
  const { mode, hydrated, setMode } = useVisualMode();
  const id = useId();

  return (
    <div
      className="emprovex-header-control inline-flex items-center gap-1.5"
      data-testid="visual-mode-control"
      title="Preferência visual somente nesta sessão; não altera a organização militar."
    >
      <MonitorCog className="h-4 w-4 shrink-0" aria-hidden="true" />
      <label htmlFor={id} className="sr-only">Modo de visualização</label>
      <select
        id={id}
        data-testid="visual-mode-select"
        value={mode}
        disabled={!hydrated}
        onChange={(event) => setMode(event.target.value === 'essencial' ? 'essencial' : 'premium')}
        aria-label="Modo de visualização nesta sessão"
        className="max-w-[94px] cursor-pointer bg-transparent text-[11px] font-bold outline-offset-2 focus-visible:outline focus-visible:outline-2"
      >
        <option value="premium" className="text-slate-950">Normal</option>
        <option value="essencial" className="text-slate-950">Essencial</option>
      </select>
    </div>
  );
}
