'use client';

import { auth } from '../firebase';
import { getCurrentOperationalScope } from '../operationalPaths';
import { normalizeWorkspaceId } from '../platformIdentity';

export interface WarehouseServerCommandPayload<T> {
  ok?: boolean;
  result?: T;
  error?: string;
}

/**
 * Único transporte autenticado para comandos do Warehouse.
 * Nunca envia uid, ug ou saldos finais: o servidor determina o escopo e
 * calcula novamente todas as transições com leituras na transação.
 */
export async function warehouseServerCommand<T>(
  workspaceId: string,
  operation: string,
  input: unknown
): Promise<T> {
  const user = auth.currentUser;
  if (!user) throw new Error('WAREHOUSE_SERVER_AUTH_REQUIRED');
  const normalized = normalizeWorkspaceId(workspaceId);
  const scope = getCurrentOperationalScope(user.uid);
  if (!normalized || scope.workspaceId !== normalized || !scope.ug) {
    throw new Error('WAREHOUSE_SERVER_SCOPE_MISMATCH');
  }
  const token = await user.getIdToken();
  let response: Response;
  try {
    response = await fetch('/api/central-depositos/operations', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer ' + token,
      },
      body: JSON.stringify({ workspaceId: normalized, operation, input }),
      cache: 'no-store',
    });
  } catch {
    throw new Error('WAREHOUSE_SERVER_UNAVAILABLE');
  }
  const body = await response.json().catch(() => null) as WarehouseServerCommandPayload<T> | null;
  if (!response.ok || !body?.ok) {
    throw new Error(body?.error || 'WAREHOUSE_SERVER_UNAVAILABLE');
  }
  return body.result as T;
}
