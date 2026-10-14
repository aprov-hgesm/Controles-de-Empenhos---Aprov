'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useReducedMotion } from 'motion/react';

import {
  resolveOrbLoaderProfile,
  type OrbLoaderPerformance,
  type OrbLoaderSize,
  type OrbRenderer,
} from './orbLoaderContract';

export interface EmprovexOrbVisualProps {
  size?: OrbLoaderSize;
  performance?: OrbLoaderPerformance;
  renderer?: OrbRenderer;
  fallback?: ReactNode;
  className?: string;
  /** Light surfaces use a matte graphite tile; dark surfaces remain transparent. */
  surface?: 'light' | 'dark';
}

/**
 * Visual-only slot. Not itself a loading state or an ARIA live region.
 * The approved W1 renderer is injected by the integrating worker.
 */
export function EmprovexOrbVisual({
  size = 'medium',
  performance = 'balanced',
  renderer: Renderer,
  fallback,
  className = '',
  surface = 'light',
}: EmprovexOrbVisualProps) {
  const reduceMotion = useReducedMotion();
  const [pageHidden, setPageHidden] = useState(false);

  useEffect(() => {
    const syncVisibility = () => {
      setPageHidden(document.visibilityState === 'hidden');
    };
    syncVisibility();
    document.addEventListener('visibilitychange', syncVisibility);
    return () => {
      document.removeEventListener('visibilitychange', syncVisibility);
    };
  }, []);

  const paused = pageHidden || reduceMotion === true || performance === 'static';
  const profile = resolveOrbLoaderProfile(size, performance, paused);
  const fallbackDiameter = Math.max(14, Math.min(40, Math.round(profile.pixelSize / 3)));

  return (
    <span
      aria-hidden="true"
      data-orb-loader-size={size}
      data-orb-loader-performance={performance}
      className={'relative inline-flex shrink-0 items-center justify-center overflow-hidden ' + className}
      style={{ width: profile.pixelSize, height: profile.pixelSize, maxWidth: '100%' }}
    >
      {Renderer ? (
        <Renderer {...profile} surface={surface} />
      ) : fallback !== undefined ? (
        fallback
      ) : (
        <span
          className={
            'block rounded-full border-2 border-current border-r-transparent opacity-70 ' +
            (paused ? '' : 'animate-spin motion-reduce:animate-none')
          }
          style={{ width: fallbackDiameter, height: fallbackDiameter }}
        />
      )}
    </span>
  );
}
