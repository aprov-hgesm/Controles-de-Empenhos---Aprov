'use client';

import { useEffect, useRef, type KeyboardEvent } from 'react';
import { EmprovexHelpCenter } from './EmprovexHelpCenter';
import type { SupportTopicId } from './tutorialCatalog';

interface EmprovexHelpOverlayProps {
  onClose: () => void;
  initialTopic?: SupportTopicId;
  supportContact?: string | null;
}

/** Ajuda autenticada sob demanda, sem tab adicional ou listener de banco de dados. */
export function EmprovexHelpOverlay({
  onClose,
  initialTopic,
  supportContact,
}: EmprovexHelpOverlayProps) {
  const dialog = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    closeButton.current?.focus();
    return () => {
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, []);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    // O player de vídeo trata seu próprio Escape primeiro.
    if (event.defaultPrevented) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== 'Tab' || !dialog.current) return;
    const focusables = Array.from(dialog.current.querySelectorAll<HTMLElement>(
      'button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )).filter(element => element.getClientRects().length > 0);
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div
      ref={dialog}
      role="dialog"
      aria-modal="true"
      aria-label="Central de Ajuda EMPROVEX"
      data-testid="emprovex-help-overlay"
      onKeyDown={onKeyDown}
      className="fixed inset-0 z-[90] overflow-y-auto bg-slate-950/85 p-3 pt-16 sm:p-6 sm:pt-20"
    >
      <div className="mx-auto max-w-6xl">
        <div className="mb-2 flex justify-end">
          <button
            ref={closeButton}
            type="button"
            onClick={onClose}
            data-testid="emprovex-help-close"
            className="min-h-11 rounded-lg bg-white px-5 py-2 font-semibold text-blue-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            Fechar Ajuda
          </button>
        </div>
        <EmprovexHelpCenter initialTopic={initialTopic} supportContact={supportContact} />
      </div>
    </div>
  );
}

export default EmprovexHelpOverlay;
