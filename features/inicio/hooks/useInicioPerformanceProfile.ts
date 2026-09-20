'use client';

import { useEffect, useState } from 'react';

export type InicioPerformanceMode = 'full' | 'balanced' | 'static';

interface InicioPerformanceProfile {
  mode: InicioPerformanceMode;
  ambientPaused: boolean;
}

interface NavigatorWithMemory extends Navigator {
  deviceMemory?: number;
}

function resolvePerformanceMode(): InicioPerformanceMode {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reducedMotion) return 'static';

  const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
  const cores = navigator.hardwareConcurrency || 8;
  const memory = (navigator as NavigatorWithMemory).deviceMemory ?? 8;

  if (coarsePointer || cores <= 4 || memory <= 4) {
    return 'balanced';
  }

  return 'full';
}

export function useInicioPerformanceProfile(): InicioPerformanceProfile {
  const [profile, setProfile] = useState<InicioPerformanceProfile>({
    mode: 'full',
    ambientPaused: false,
  });

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const coarsePointer = window.matchMedia('(pointer: coarse)');

    const syncProfile = () => {
      setProfile({
        mode: resolvePerformanceMode(),
        ambientPaused: document.visibilityState !== 'visible',
      });
    };

    syncProfile();
    document.addEventListener('visibilitychange', syncProfile);
    reducedMotion.addEventListener('change', syncProfile);
    coarsePointer.addEventListener('change', syncProfile);

    return () => {
      document.removeEventListener('visibilitychange', syncProfile);
      reducedMotion.removeEventListener('change', syncProfile);
      coarsePointer.removeEventListener('change', syncProfile);
    };
  }, []);

  return profile;
}
