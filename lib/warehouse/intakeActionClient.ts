'use client';

import { auth } from '../firebase';
import type {
  AllocateWarehousePendingItemInput,
  AllocateWarehousePendingItemResult,
} from './intakeAllocationRepository';
import type {
  ApplyWarehouseImmediateConsumptionInput,
  ApplyWarehouseImmediateConsumptionResult,
} from './withdrawalRepository';

type FastAction = 'ALLOCATE' | 'IMMEDIATE_CONSUMPTION';

async function postFastAction<T>(
  action: FastAction,
  workspaceId: string,
  input: unknown
): Promise<T> {
  const user = auth.currentUser;
  if (!user) throw new Error('WAREHOUSE_INTAKE_ACTION_AUTH_REQUIRED');
  const token = await user.getIdToken();
  const response = await fetch('/api/central-depositos/intake-action', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ action, workspaceId, input }),
  });
  const payload = await response.json().catch(() => ({})) as {
    result?: T;
    error?: string;
  };
  if (!response.ok || !payload.result) {
    throw new Error(payload.error || 'WAREHOUSE_FAST_PATH_UNAVAILABLE');
  }
  return payload.result;
}

export async function allocateWarehousePendingItemFast(
  workspaceId: string,
  input: AllocateWarehousePendingItemInput
): Promise<AllocateWarehousePendingItemResult> {
  // Nenhum fallback de gravação via SDK cliente.
  return postFastAction<AllocateWarehousePendingItemResult>(
    'ALLOCATE',workspaceId,input
  );
}

export async function applyWarehouseImmediateConsumptionFast(
  workspaceId: string,
  input: ApplyWarehouseImmediateConsumptionInput
): Promise<ApplyWarehouseImmediateConsumptionResult> {
  // Se a API falhar, propagar o erro sem executar uma escrita insegura.
  return postFastAction<ApplyWarehouseImmediateConsumptionResult>(
    'IMMEDIATE_CONSUMPTION',workspaceId,input
  );
}
