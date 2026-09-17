'use client';

import { useCallback, useEffect, useState } from 'react';

import {
  createSectorWorkspace,
  ensureFoundingPlatformMetadata,
  subscribePlatformAdminDirectory,
  type CreateSectorWorkspaceInput,
  type PlatformAdminDirectory,
} from '../lib/platformAdminStore';

const EMPTY_DIRECTORY: PlatformAdminDirectory = {
  workspaces: [],
  accounts: [],
};

function describeDirectoryError(error: unknown): string {
  const code = typeof error === 'object' && error && 'code' in error
    ? String((error as { code?: unknown }).code || '')
    : '';

  if (code.includes('permission-denied')) {
    return 'As regras administrativas do Firestore ainda não estão publicadas. O painel está pronto, mas o cadastro persistente permanece bloqueado até a publicação das novas regras.';
  }

  if (error instanceof Error && error.message) return error.message;
  return 'Não foi possível carregar o diretório administrativo da plataforma.';
}

export function usePlatformAdminDirectory(adminEmail: string | null) {
  const [directory, setDirectory] = useState<PlatformAdminDirectory>(EMPTY_DIRECTORY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!adminEmail) {
      setDirectory(EMPTY_DIRECTORY);
      setLoading(false);
      return;
    }

    let cancelled = false;
    let unsubscribe: (() => void) | null = null;

    setLoading(true);
    setError(null);

    void ensureFoundingPlatformMetadata()
      .then(() => {
        if (cancelled) return;
        unsubscribe = subscribePlatformAdminDirectory(
          (nextDirectory) => {
            if (cancelled) return;
            setDirectory(nextDirectory);
            setLoading(false);
            setError(null);
          },
          (subscriptionError) => {
            if (cancelled) return;
            setLoading(false);
            setError(describeDirectoryError(subscriptionError));
          }
        );
      })
      .catch((bootstrapError) => {
        if (cancelled) return;
        setLoading(false);
        setError(describeDirectoryError(bootstrapError));
      });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [adminEmail]);

  const createSector = useCallback(async (input: CreateSectorWorkspaceInput) => {
    if (!adminEmail) throw new Error('Sessão administrativa inválida.');

    setCreating(true);
    setError(null);
    try {
      return await createSectorWorkspace(input, adminEmail);
    } catch (createError) {
      const message = describeDirectoryError(createError);
      setError(message);
      throw new Error(message);
    } finally {
      setCreating(false);
    }
  }, [adminEmail]);

  return {
    directory,
    loading,
    error,
    creating,
    createSector,
  };
}
