'use client';

import type { ReactNode } from 'react';

import { WarehouseAccessBoundary } from '../components/WarehouseProtectedSurface';
import { WarehouseMobileShell } from './WarehouseMobileShell';

export function WarehouseMobileProtectedLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <WarehouseAccessBoundary>
      {(workspaceContext) => (
        <WarehouseMobileShell workspaceContext={workspaceContext}>
          {children}
        </WarehouseMobileShell>
      )}
    </WarehouseAccessBoundary>
  );
}
