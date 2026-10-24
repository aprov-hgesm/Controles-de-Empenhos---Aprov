import { HGESM_SECTOR_EMAIL, HGESM_UG, HGESM_WORKSPACE_ID } from '../hgesmWorkspace';
import { warehouseModuleEnabled } from '../warehouse/featureFlag';
import { evaluateServerAuthorization, type ServerAuthorizationRequest } from './authorizationPolicy';
import { FounderAuthError } from './firebaseFounderAuth';
import { verifyPlatformPrincipal, PlatformAuthorizationError } from './platformAuthorization';
import { ensureSectorWarehouseClaims, SectorProvisioningFailure } from './sectorProvisioningAdmin';

type WarehouseAccessStatus = 401 | 403 | 404 | 503;

export interface VerifiedWarehouseRequest {
  uid: string;
  email: string;
  workspaceId: string;
  ug: string;
  claimsUpdated: boolean;
}

export class WarehouseAccessError extends Error {
  constructor(message: string, public readonly status: WarehouseAccessStatus) {
    super(message);
    this.name = 'WarehouseAccessError';
  }
}

function currentClaimsMatchWorkspace(
  claims: Record<string, unknown>, workspaceId: string, ug: string,
): boolean {
  return claims.emprovexWarehouse === true
    && claims.emprovexWarehouseVersion === 'v1'
    && claims.emprovexRole === 'sector'
    && claims.emprovexWorkspaceId === workspaceId
    && claims.emprovexUg === ug;
}

/**
 * A autorização é decidida pelo servidor, com principal Firebase verificado
 * e conta/UG/workspace ativos consultados via IAM (sem Firestore Rules do cliente).
 * Claims Warehouse servem apenas à compatibilidade temporária das leituras SDK.
 */
export async function verifyWarehouseRequest(
  authorization: string | null,
): Promise<VerifiedWarehouseRequest> {
  if (!warehouseModuleEnabled) {
    throw new WarehouseAccessError('Central de Depósitos indisponível.', 404);
  }

  let actor: Awaited<ReturnType<typeof verifyPlatformPrincipal>>;
  try {
    actor = await verifyPlatformPrincipal(authorization);
  } catch (error) {
    if (error instanceof PlatformAuthorizationError) {
      throw new WarehouseAccessError('Autorização operacional negada.', error.status);
    }
    throw error;
  }

  let claimsUpdated = false;
  if (actor.role === 'sector' &&
      !currentClaimsMatchWorkspace(actor.claims as Record<string, unknown>,
        actor.workspaceId, actor.ug)) {
    try {
      await ensureSectorWarehouseClaims(actor.uid, actor.workspaceId, actor.ug);
      claimsUpdated = true;
    } catch (error) {
      if (error instanceof SectorProvisioningFailure) {
        throw new WarehouseAccessError('Não foi possível vincular a conta ao Warehouse.',
          error.httpStatus === 403 ? 403 : 503);
      }
      throw new WarehouseAccessError('Não foi possível vincular a conta ao Warehouse.', 503);
    }
  }

  return {
    uid: actor.uid,
    email: actor.email,
    workspaceId: actor.workspaceId,
    ug: actor.ug,
    claimsUpdated,
  };
}

/** Compatibilidade temporária com diagnósticos exclusivos do fundador. */
export async function verifyWarehouseFounderRequest(
  authorization: string | null,
): Promise<{ uid: string; email: string }> {
  const actor = await verifyWarehouseRequest(authorization);
  if (actor.email !== HGESM_SECTOR_EMAIL ||
      actor.workspaceId !== HGESM_WORKSPACE_ID ||
      actor.ug !== HGESM_UG) {
    throw new FounderAuthError('Acesso reservado à conta fundadora.', 403);
  }
  return { uid: actor.uid, email: actor.email };
}

/** O principal é verificado no servidor. O body não determina role/UG/workspace. */
export function assertWarehouseAuthorization(
  access: VerifiedWarehouseRequest,
  request: Omit<ServerAuthorizationRequest, 'capability'> & { capability: 'warehouse.read' | 'warehouse.command' },
): void {
  const isFounder = access.email === HGESM_SECTOR_EMAIL
    && access.workspaceId === HGESM_WORKSPACE_ID && access.ug === HGESM_UG;
  const decision = evaluateServerAuthorization({
    uid: access.uid,
    email: access.email,
    role: isFounder ? 'founder' : 'sector',
    workspaceId: access.workspaceId,
    ug: access.ug,
  }, request);
  if (!decision.allowed) throw new WarehouseAccessError('Operação não autorizada.', 403);
}
