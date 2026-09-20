'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import type { OperationalActiveTab } from '../../../lib/operationalSubscriptionPlan';

export type InicioResumeTab =
  | 'painel'
  | 'empenhos'
  | 'itens'
  | 'nova_nf'
  | 'relatorios'
  | 'cronogramas';

export interface InicioResumeTarget {
  tab: InicioResumeTab;
  empenhoId: string | null;
  recordedAt: string;
}

interface UseInicioWorkMemoryParams {
  workspaceKey: string | null;
  activeTab: OperationalActiveTab;
  selectedEmpenhoDetailId: string | null;
}

const STORAGE_PREFIX = 'emprovex.inicio.work-memory.v1';
const TRACKABLE_TABS = new Set<InicioResumeTab>([
  'painel',
  'empenhos',
  'itens',
  'nova_nf',
  'relatorios',
  'cronogramas',
]);

function buildStorageKey(workspaceKey: string): string {
  return `${STORAGE_PREFIX}:${encodeURIComponent(workspaceKey)}`;
}

function isResumeTab(value: unknown): value is InicioResumeTab {
  return typeof value === 'string' && TRACKABLE_TABS.has(value as InicioResumeTab);
}

function readResumeTarget(workspaceKey: string): InicioResumeTarget | null {
  try {
    const raw = sessionStorage.getItem(buildStorageKey(workspaceKey));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<InicioResumeTarget>;
    if (!isResumeTab(parsed.tab)) return null;

    return {
      tab: parsed.tab,
      empenhoId:
        parsed.tab === 'empenhos' && typeof parsed.empenhoId === 'string'
          ? parsed.empenhoId
          : null,
      recordedAt:
        typeof parsed.recordedAt === 'string'
          ? parsed.recordedAt
          : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function useInicioWorkMemory({
  workspaceKey,
  activeTab,
  selectedEmpenhoDetailId,
}: UseInicioWorkMemoryParams) {
  const [resumeTarget, setResumeTarget] = useState<InicioResumeTarget | null>(null);
  const initializedWorkspaceRef = useRef<string | null>(null);
  const lastObservedRef = useRef('');

  useEffect(() => {
    if (!workspaceKey) {
      initializedWorkspaceRef.current = null;
      lastObservedRef.current = '';
      setResumeTarget(null);
      return;
    }

    const signature = `${activeTab}:${selectedEmpenhoDetailId || ''}`;

    if (initializedWorkspaceRef.current !== workspaceKey) {
      initializedWorkspaceRef.current = workspaceKey;
      lastObservedRef.current = signature;
      setResumeTarget(readResumeTarget(workspaceKey));
      return;
    }

    if (lastObservedRef.current === signature) return;
    lastObservedRef.current = signature;

    if (!isResumeTab(activeTab)) return;

    const nextTarget: InicioResumeTarget = {
      tab: activeTab,
      empenhoId:
        activeTab === 'empenhos' && selectedEmpenhoDetailId
          ? selectedEmpenhoDetailId
          : null,
      recordedAt: new Date().toISOString(),
    };

    try {
      sessionStorage.setItem(
        buildStorageKey(workspaceKey),
        JSON.stringify(nextTarget)
      );
    } catch {
      // Retomada é conveniência de interface; falha de storage nunca bloqueia a operação.
    }

    setResumeTarget(nextTarget);
  }, [activeTab, selectedEmpenhoDetailId, workspaceKey]);

  const clearWorkMemory = useCallback(() => {
    if (workspaceKey) {
      try {
        sessionStorage.removeItem(buildStorageKey(workspaceKey));
      } catch {
        // No-op: autorização e dados operacionais não dependem desta memória.
      }
    }
    setResumeTarget(null);
  }, [workspaceKey]);

  return {
    resumeTarget,
    clearWorkMemory,
  };
}
