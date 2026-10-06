'use client';

import { useEffect, type ReactNode } from 'react';

import { EmprovexAuthLoading } from '../../../components/auth/EmprovexAuthLoading';
import { HGESM_SECTOR_EMAIL } from '../../../lib/hgesmWorkspace';
import { normalizePlatformEmail } from '../../../lib/platformIdentity';
import type { SectorWorkspaceContext } from '../../../lib/workspaceContext';
import { WarehouseAccessBoundary } from '../components/WarehouseProtectedSurface';
import { WarehouseMobileShell } from './WarehouseMobileShell';

function FounderOnlyMobileSurface({
  children,
  workspaceContext,
}: {
  children: ReactNode;
  workspaceContext: SectorWorkspaceContext;
}) {
  const allowed =
    normalizePlatformEmail(workspaceContext.email) === HGESM_SECTOR_EMAIL;

  useEffect(() => {
    if (!allowed) {
      window.location.replace('/');
    }
  }, [allowed]);

  if (!allowed) {
    return <EmprovexAuthLoading hasAuthenticatedIdentity />;
  }

  return (
    <WarehouseMobileShell workspaceContext={workspaceContext}>
      {children}
    </WarehouseMobileShell>
  );
}

export function WarehouseMobileProtectedLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <WarehouseAccessBoundary>
      {(workspaceContext) => (
        <FounderOnlyMobileSurface workspaceContext={workspaceContext}>
          {children}
        </FounderOnlyMobileSurface>
      )}
    </WarehouseAccessBoundary>
  );
}
