'use client';

import type { ReactNode } from 'react';

import {
  EmprovexOrbLoader,
  type EmprovexOrbLoaderProps,
} from './EmprovexOrbLoader';

type LoadingViewProps = Omit<EmprovexOrbLoaderProps, 'loading'>;

type LoadingState =
  | { state: 'loading'; error?: never }
  | { state: 'ready'; error?: never }
  | { state: 'error'; error: ReactNode };

export type EmprovexLoadingBoundaryProps = LoadingViewProps &
  LoadingState & {
    children: ReactNode;
    /** Optional wrapper supplied by caller for existing section layouts. */
    loadingContainerClassName?: string;
  };

/**
 * Explicit states avoid interpreting a failed operation as ongoing loading.
 * Caller exclusively controls when data is ready or a real error occurred.
 */
export function EmprovexLoadingBoundary({
  state,
  error,
  children,
  loadingContainerClassName = '',
  ...loaderProps
}: EmprovexLoadingBoundaryProps) {
  if (state === 'error') return <>{error}</>;
  if (state === 'ready') return <>{children}</>;

  return (
    <div className={loadingContainerClassName}>
      <EmprovexOrbLoader {...loaderProps} loading />
    </div>
  );
}
