import { warehouseModuleEnabled } from '../warehouse/featureFlag';
import {
  FounderAuthError,
  verifyFounderFirebaseRequest,
} from './firebaseFounderAuth';

export class WarehouseAccessError extends Error {
  constructor(
    message: string,
    public readonly status: 403 | 404
  ) {
    super(message);
    this.name = 'WarehouseAccessError';
  }
}

/**
 * Gate server-side obrigatório para APIs do ADM Depósito durante o piloto
 * fundador. Não confiar em visibilidade de menu ou em estado do cliente.
 */
export async function verifyWarehouseFounderRequest(
  authorization: string | null
): Promise<{ uid: string; email: string }> {
  if (!warehouseModuleEnabled) {
    throw new WarehouseAccessError('Módulo ADM Depósito indisponível.', 404);
  }

  try {
    return await verifyFounderFirebaseRequest(authorization);
  } catch (error) {
    if (error instanceof FounderAuthError) throw error;
    throw new WarehouseAccessError('Acesso ao ADM Depósito negado.', 403);
  }
}
