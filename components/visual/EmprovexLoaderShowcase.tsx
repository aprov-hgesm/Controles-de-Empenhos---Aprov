'use client';

import type { OrbRenderer } from './orbLoaderContract';
import { EmprovexOrbVisual } from './EmprovexOrbVisual';

const SIZES = ['hero', 'large', 'medium', 'small', 'mini'] as const;

interface EmprovexLoaderShowcaseProps {
  renderer?: OrbRenderer;
}

/**
 * Isolated design-review artifact. Decorative samples only: no fake loading,
 * progress, authentication, data fetches, or application route.
 */
export function EmprovexLoaderShowcase({
  renderer,
}: EmprovexLoaderShowcaseProps) {
  return (
    <section aria-label="Prévia visual das cinco dimensões do indicador">
      <p className="mb-4 text-sm">
        Prévia isolada das dimensões. Sem renderizador W1, apenas os espaços reservados são exibidos.
      </p>
      <div className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 sm:grid-cols-3 xl:grid-cols-5">
        {SIZES.map((size) => (
          <div
            key={size}
            data-showcase-size={size}
            className="flex min-w-0 flex-col items-center justify-center gap-3 rounded-xl border border-slate-300 bg-white p-4 text-slate-800"
          >
            <EmprovexOrbVisual
              size={size}
              performance="balanced"
              surface="light"
              renderer={renderer}
              fallback={renderer ? undefined : <span className="text-xs opacity-60">W1</span>}
            />
            <span className="text-xs font-medium uppercase tracking-wider">
              {size}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
