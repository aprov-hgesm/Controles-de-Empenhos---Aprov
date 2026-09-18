'use client';

import { useCallback, useEffect, useState } from 'react';
import type { User } from 'firebase/auth';

import {
  ensureFoundingPlatformMetadata,
  setSectorWorkspaceStatus,
  subscribePlatformAdminDirectory,
  updateSectorWorkspaceProfile,
  type CreateSectorWorkspaceInput,
  type PlatformAdminDirectory,
  type SectorLifecycleStatus,
  type UpdateSectorWorkspaceInput,
} from '../lib/platformAdminStore';
import type { SectorProvisioningResult } from '../lib/sectorProvisioning';

const EMPTY_DIRECTORY: PlatformAdminDirectory = {
  workspaces: [],
  accounts: [],
};

function describeDirectoryError(error: unknown): string {
  const code = typeof error === 'object' && error && 'code' in error
    ? String((error as { code?: unknown }).code || '')
    : '';

  if (code.includes('permission-denied')) {
    return 'O Firestore recusou esta operação administrativa por permissão. Atualize a página e tente novamente; se persistir, valide as Rules publicadas e o vínculo da conta administrativa.';
  }

  if (error instanceof Error && error.message) return error.message;
  return 'Não foi possível carregar o diretório administrativo da plataforma.';
}

export function usePlatformAdminDirectory(adminUser: User | null) {
  const adminEmail = adminUser?.email || null;
  const [directory, setDirectory] = useState<PlatformAdminDirectory>(EMPTY_DIRECTORY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [updatingWorkspaceId, setUpdatingWorkspaceId] = useState<string | null>(null);
  const [changingStatusWorkspaceId, setChangingStatusWorkspaceId] = useState<string | null>(null);
  const [deletingWorkspaceId, setDeletingWorkspaceId] = useState<string | null>(null);

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

  const createSector = useCallback(async (
    input: CreateSectorWorkspaceInput
  ): Promise<SectorProvisioningResult> => {
    if (!adminUser || !adminEmail) {
      throw new Error('Sessão administrativa inválida.');
    }

    setCreating(true);
    setError(null);

    try {
      const idToken = await adminUser.getIdToken();
      const response = await fetch('/api/admin/provision-sector', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${idToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(input),
      });

      const payload = await response.json() as {
        ok?: boolean;
        result?: SectorProvisioningResult;
        error?: string;
        code?: string;
        recoveryRequired?: boolean;
      };

      if (!response.ok || !payload.ok || !payload.result) {
        if (payload.recoveryRequired) {
          throw new Error(
            'O provisionamento não pôde ser revertido integralmente. A operação foi marcada para recuperação administrativa.'
          );
        }
        throw new Error(payload.error || 'Não foi possível provisionar o setor.');
      }

      return payload.result;
    } catch (createError) {
      const message = describeDirectoryError(createError);
      setError(message);
      throw new Error(message);
    } finally {
      setCreating(false);
    }
  }, [adminEmail, adminUser]);

  const updateSector = useCallback(async (input: UpdateSectorWorkspaceInput) => {
    if (!adminEmail) throw new Error('Sessão administrativa inválida.');

    setUpdatingWorkspaceId(input.workspaceId);
    setError(null);
    try {
      return await updateSectorWorkspaceProfile(input, adminEmail);
    } catch (updateError) {
      const message = describeDirectoryError(updateError);
      setError(message);
      throw new Error(message);
    } finally {
      setUpdatingWorkspaceId(null);
    }
  }, [adminEmail]);

  const changeSectorStatus = useCallback(async (
    workspaceId: string,
    status: SectorLifecycleStatus
  ) => {
    if (!adminEmail) throw new Error('Sessão administrativa inválida.');

    setChangingStatusWorkspaceId(workspaceId);
    setError(null);
    try {
      return await setSectorWorkspaceStatus(workspaceId, status, adminEmail);
    } catch (statusError) {
      const message = describeDirectoryError(statusError);
      setError(message);
      throw new Error(message);
    } finally {
      setChangingStatusWorkspaceId(null);
    }
  }, [adminEmail]);

  const deleteSector = useCallback(async (
    workspaceId: string,
    email: string
  ) => {
    if (!adminUser || !adminEmail) {
      throw new Error('Sessão administrativa inválida.');
    }

    setDeletingWorkspaceId(workspaceId);
    setError(null);

    try {
      const idToken = await adminUser.getIdToken();
      const response = await fetch('/api/admin/delete-sector', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${idToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ workspaceId, email }),
      });

      const payload = await response.json() as {
        ok?: boolean;
        result?: {
          workspaceId: string;
          email: string;
          firebaseAuthDeleted: boolean;
        };
        error?: string;
        recoveryRequired?: boolean;
      };

      if (!response.ok || !payload.ok || !payload.result) {
        if (payload.recoveryRequired) {
          throw new Error(
            'A exclusão foi iniciada, mas alguns resíduos exigem recuperação administrativa antes de reutilizar este cadastro.'
          );
        }
        throw new Error(payload.error || 'Não foi possível excluir o setor.');
      }

      return payload.result;
    } catch (deleteError) {
      const message = describeDirectoryError(deleteError);
      setError(message);
      throw new Error(message);
    } finally {
      setDeletingWorkspaceId(null);
    }
  }, [adminEmail, adminUser]);

  return {
    directory,
    loading,
    error,
    creating,
    updatingWorkspaceId,
    changingStatusWorkspaceId,
    deletingWorkspaceId,
    createSector,
    updateSector,
    changeSectorStatus,
    deleteSector,
  };
}
