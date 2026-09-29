import firebaseConfig from '../../firebase-applet-config.json';
import { HGESM_SECTOR_EMAIL, HGESM_UG, HGESM_WORKSPACE_ID } from '../hgesmWorkspace';
import {
  FOUNDER_AUTH_PROVIDER,
  SECTOR_AUTH_PROVIDER,
  isValidUnitUg,
  isValidWorkspaceId,
  normalizePlatformEmail,
  normalizeUnitUg,
  normalizeWorkspaceId,
} from '../platformIdentity';
import { warehouseModuleEnabled } from '../warehouse/featureFlag';
import {
  FounderAuthError,
  verifyFirebaseRequest,
  type VerifiedFirebaseRequest,
} from './firebaseFounderAuth';
import {
  ensureSectorWarehouseClaims,
  SectorProvisioningFailure,
} from './sectorProvisioningAdmin';

type WarehouseAccessStatus = 401 | 403 | 404 | 503;

export interface VerifiedWarehouseRequest {
  uid: string;
  email: string;
  workspaceId: string;
  ug: string;
  claimsUpdated: boolean;
}

export class WarehouseAccessError extends Error {
  constructor(
    message: string,
    public readonly status: WarehouseAccessStatus
  ) {
    super(message);
    this.name = 'WarehouseAccessError';
  }
}

interface FirestoreValue {
  stringValue?: string;
}

interface FirestoreDocumentPayload {
  fields?: Record<string, FirestoreValue>;
}

function coreFirestoreBaseUrl(): string {
  const emulatorEnabled = process.env.EMPROVEX_E2E_SERVER_AUTH === '1';
  const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST?.trim();
  const projectId = emulatorEnabled
    ? process.env.NEXT_PUBLIC_EMPROVEX_E2E_PROJECT_ID?.trim() || firebaseConfig.projectId
    : firebaseConfig.projectId;
  const databaseId = emulatorEnabled ? '(default)' : firebaseConfig.firestoreDatabaseId;

  if (emulatorEnabled && emulatorHost) {
    return `http://${emulatorHost}/v1/projects/${encodeURIComponent(projectId)}/databases/${encodeURIComponent(databaseId)}/documents`;
  }

  return `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/${encodeURIComponent(databaseId)}/documents`;
}

function encodeDocumentPath(path: string): string {
  return path.split('/').map((segment) => encodeURIComponent(segment)).join('/');
}

function stringField(
  document: FirestoreDocumentPayload | null,
  field: string
): string {
  return document?.fields?.[field]?.stringValue || '';
}

async function readCoreDocument(
  path: string,
  idToken: string
): Promise<FirestoreDocumentPayload | null> {
  const response = await fetch(
    `${coreFirestoreBaseUrl()}/${encodeDocumentPath(path)}`,
    {
      headers: {
        authorization: `Bearer ${idToken}`,
      },
      cache: 'no-store',
    }
  );

  if (response.status === 404) return null;

  if (!response.ok) {
    throw new WarehouseAccessError(
      'Não foi possível validar a autorização operacional do setor.',
      response.status >= 500 ? 503 : 403
    );
  }

  return await response.json() as FirestoreDocumentPayload;
}

function currentClaimsMatchWorkspace(
  verified: VerifiedFirebaseRequest,
  workspaceId: string,
  ug: string
): boolean {
  const claims = verified.claims as Record<string, unknown>;

  return claims.emprovexWarehouse === true
    && claims.emprovexWarehouseVersion === 'v1'
    && claims.emprovexRole === 'sector'
    && claims.emprovexWorkspaceId === workspaceId
    && claims.emprovexUg === ug;
}

async function resolveExternalWarehouseAccess(
  verified: VerifiedFirebaseRequest
): Promise<VerifiedWarehouseRequest> {
  if (verified.signInProvider !== SECTOR_AUTH_PROVIDER) {
    throw new WarehouseAccessError('Provedor de autenticação do setor inválido.', 403);
  }

  const account = await readCoreDocument(
    `platformAccounts/${verified.email}`,
    verified.idToken
  );

  if (!account) {
    throw new WarehouseAccessError('Conta operacional do setor não localizada.', 403);
  }

  const workspaceId = normalizeWorkspaceId(stringField(account, 'workspaceId'));
  const accountUg = normalizeUnitUg(stringField(account, 'ug'));
  const accountEmail = normalizePlatformEmail(stringField(account, 'email'));
  const accountUid = stringField(account, 'firebaseUid');
  const accountType = stringField(account, 'accountType');
  const accountStatus = stringField(account, 'status');
  const accountProvider = stringField(account, 'authProvider') || SECTOR_AUTH_PROVIDER;

  if (
    accountType !== 'sector'
    || accountStatus !== 'active'
    || accountEmail !== verified.email
    || accountUid !== verified.uid
    || accountProvider !== SECTOR_AUTH_PROVIDER
    || !isValidWorkspaceId(workspaceId)
    || !isValidUnitUg(accountUg)
  ) {
    throw new WarehouseAccessError('Conta operacional sem autorização para a Central de Depósitos.', 403);
  }

  const workspace = await readCoreDocument(
    `workspaces/${workspaceId}`,
    verified.idToken
  );

  if (!workspace) {
    throw new WarehouseAccessError('Workspace operacional não localizado.', 403);
  }

  const workspaceRecordId = normalizeWorkspaceId(stringField(workspace, 'id'));
  const workspaceStatus = stringField(workspace, 'status');
  const workspaceEmail = normalizePlatformEmail(stringField(workspace, 'authorizedEmail'));
  const workspaceUg = normalizeUnitUg(stringField(workspace, 'ug'));

  if (
    workspaceStatus !== 'active'
    || workspaceRecordId !== workspaceId
    || workspaceEmail !== verified.email
    || workspaceUg !== accountUg
  ) {
    throw new WarehouseAccessError('Workspace sem autorização para a Central de Depósitos.', 403);
  }

  let claimsUpdated = false;
  if (!currentClaimsMatchWorkspace(verified, workspaceId, workspaceUg)) {
    try {
      await ensureSectorWarehouseClaims(verified.uid, workspaceId, workspaceUg);
      claimsUpdated = true;
    } catch (error) {
      if (error instanceof SectorProvisioningFailure) {
        throw new WarehouseAccessError(
          'Não foi possível materializar a autorização da Central de Depósitos.',
          error.httpStatus === 403 ? 403 : 503
        );
      }
      throw new WarehouseAccessError(
        'Não foi possível materializar a autorização da Central de Depósitos.',
        503
      );
    }
  }

  return {
    uid: verified.uid,
    email: verified.email,
    workspaceId,
    ug: workspaceUg,
    claimsUpdated,
  };
}

/**
 * Gate server-side da Central de Depósitos.
 *
 * O fundador mantém o acesso Google ao workspace HGeSM. Setores externos são
 * validados novamente contra o diretório operacional do Firestore principal e,
 * depois disso, recebem claims Firebase assinadas com workspace + UG. O banco
 * emprovex-warehouse usa essas claims para isolar cada setor sem depender de
 * dados de autorização armazenados no próprio namespace logístico.
 */
export async function verifyWarehouseRequest(
  authorization: string | null
): Promise<VerifiedWarehouseRequest> {
  if (!warehouseModuleEnabled) {
    throw new WarehouseAccessError('Central de Depósitos indisponível.', 404);
  }

  const verified = await verifyFirebaseRequest(authorization);

  if (
    verified.email === HGESM_SECTOR_EMAIL
    && verified.signInProvider === FOUNDER_AUTH_PROVIDER
  ) {
    return {
      uid: verified.uid,
      email: verified.email,
      workspaceId: HGESM_WORKSPACE_ID,
      ug: HGESM_UG,
      claimsUpdated: false,
    };
  }

  return resolveExternalWarehouseAccess(verified);
}

/**
 * Compatibilidade temporária para chamadas server-side antigas que ainda exijam
 * explicitamente a identidade fundadora.
 */
export async function verifyWarehouseFounderRequest(
  authorization: string | null
): Promise<{ uid: string; email: string }> {
  const verified = await verifyWarehouseRequest(authorization);
  if (
    verified.workspaceId !== HGESM_WORKSPACE_ID
    || verified.email !== HGESM_SECTOR_EMAIL
  ) {
    throw new FounderAuthError('Acesso reservado à conta fundadora.', 403);
  }
  return {
    uid: verified.uid,
    email: verified.email,
  };
}
