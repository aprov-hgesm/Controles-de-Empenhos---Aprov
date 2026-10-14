'use client';

import type { EmprovexOrbVisualProps } from './EmprovexOrbVisual';
import { EmprovexOrbVisual } from './EmprovexOrbVisual';

export interface EmprovexOrbLoaderProps extends EmprovexOrbVisualProps {
  /** Must correspond to an actual pending operation owned by the caller. */
  loading: boolean;
  /** Use the real operation's existing status copy. */
  label: string;
  description?: string;
  testId?: string;
}

/**
 * A presentational loading indicator, not an async state machine.
 * It never fetches data, delays completion, or overrides error handling.
 */
export function EmprovexOrbLoader({
  loading,
  label,
  description,
  size = 'medium',
  performance = 'balanced',
  renderer,
  fallback,
  className = '',
  surface = 'light',
  testId,
}: EmprovexOrbLoaderProps) {
  if (!loading) return null;

  const inlineLayout = size === 'mini' || size === 'small';
  const textScale = size === 'mini' ? 'text-xs' : 'text-sm';

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      data-testid={testId}
      data-loading-variant={size}
      className={
        'max-w-full items-center text-current ' +
        (inlineLayout
          ? 'inline-flex flex-row gap-3 text-left'
          : 'flex flex-col gap-3 text-center') +
        (className ? ' ' + className : '')
      }
    >
      <EmprovexOrbVisual
        size={size}
        performance={performance}
        surface={surface}
        renderer={renderer}
        fallback={fallback}
      />
      <div className="min-w-0 max-w-full">
        <p className={'font-semibold leading-snug ' + textScale}>{label}</p>
        {description ? (
          <p className="mt-1 text-xs leading-relaxed opacity-70">{description}</p>
        ) : null}
      </div>
    </div>
  );
}
