'use client';

import { EmprovexOrbVisual } from '../visual/EmprovexOrbVisual';
import { EmprovexThinkingOrbRenderer } from '../visual/EmprovexThinkingOrbRenderer';

/**
 * Preserves the existing data-readiness/Suspense contract in app/page.tsx.
 * This component is rendered only while that caller is actually waiting.
 * The loader is intentionally monochrome on this light operational surface.
 */
export function OperationalSurfaceLoading() {
  return (
    <section
      data-testid="operational-section-loading"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="flex min-h-[320px] items-center justify-center rounded-2xl border border-blue-100 bg-white/75 p-8 text-center shadow-sm backdrop-blur"
    >
      <div className="flex max-w-full flex-col items-center">
        <EmprovexOrbVisual
          size="medium"
          performance="balanced"
          surface="light"
          renderer={EmprovexThinkingOrbRenderer}
        />
        <p className="mt-4 text-sm font-extrabold text-[#00288e]">
          Sincronizando dados desta seção
        </p>
        <p className="mt-1 text-xs font-medium text-gray-500">
          O EMPROVEX mantém em tempo real somente as coleções necessárias à tela atual.
        </p>
      </div>
    </section>
  );
}
