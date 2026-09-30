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
  const response = await fetch('/api/adm-deposito/intake-action', {
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

function shouldUseLegacyFallback(error: unknown): boolean {
  const code = error instanceof Error ? error.message : String(error || '');
  return code.includes('WAREHOUSE_FAST_PATH_LEGACY');
}

export async function allocateWarehousePendingItemFast(
  workspaceId: string,
  input: AllocateWarehousePendingItemInput
): Promise<AllocateWarehousePendingItemResult> {
  try {
    return await postFastAction<AllocateWarehousePendingItemResult>(
      'ALLOCATE',
      workspaceId,
      input
    );
  } catch (error) {
    if (!shouldUseLegacyFallback(error)) throw error;
    const legacy = await import('./intakeAllocationRepository');
    return legacy.allocateWarehousePendingItem(workspaceId, input);
  }
}

export async function applyWarehouseImmediateConsumptionFast(
  workspaceId: string,
  input: ApplyWarehouseImmediateConsumptionInput
): Promise<ApplyWarehouseImmediateConsumptionResult> {
  try {
    return await postFastAction<ApplyWarehouseImmediateConsumptionResult>(
      'IMMEDIATE_CONSUMPTION',
      workspaceId,
      input
    );
  } catch (error) {
    if (!shouldUseLegacyFallback(error)) throw error;
    const legacy = await import('./withdrawalRepository');
    return legacy.applyWarehouseImmediateConsumption(workspaceId, input);
  }
}
