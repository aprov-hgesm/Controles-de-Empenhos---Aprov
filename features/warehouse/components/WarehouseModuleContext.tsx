'use client';

import {
  createContext,
  useContext,
  type ReactNode,
} from 'react';

import type { SectorWorkspaceContext } from '../../../lib/workspaceContext';

const WarehouseWorkspaceContext =
  createContext<SectorWorkspaceContext | null>(null);

export function WarehouseWorkspaceProvider({
  children,
  value,
}: {
  children: ReactNode;
  value: SectorWorkspaceContext;
}) {
  return (
    <WarehouseWorkspaceContext.Provider value={value}>
      {children}
    </WarehouseWorkspaceContext.Provider>
  );
}

export function useWarehouseWorkspaceContext(): SectorWorkspaceContext {
  const context = useContext(WarehouseWorkspaceContext);
  if (!context) {
    throw new Error('WAREHOUSE_WORKSPACE_CONTEXT_UNAVAILABLE');
  }
  return context;
}
