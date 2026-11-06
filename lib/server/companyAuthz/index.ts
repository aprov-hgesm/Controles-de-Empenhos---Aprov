import {
  COMPANY_ACTIONS,
  COMPANY_ROOT_COLLECTION,
  type CompanyAction,
  type CompanyErrorCode,
  type CompanyPrincipalRole,
} from '../../company/contracts';
import {
  CompanyAccessError,
  verifyCompanySession,
  type VerifiedCompanyContext,
} from '../companySession';

/**
 * Tenant identity and rights are recomputed on the server on every request.
 * The request may SELECT an entity, but cannot assign the acting role/tenant.
 */
export interface CompanyResourceOwnership {
  companyId: string;
  workspaceId?: string;
  /** Optional self-owned operation; ordinary company records are tenant-owned. */
  createdByUid?: string;
}
export interface CompanyAuthorizationIntent {
  action: CompanyAction;
  /** Optional company route parameter; must equal server-owned workspaceId. */
  companyId?: string;
  /** Persisted record ownership, read server-side before mutation/disclosure. */
  resource?: CompanyResourceOwnership;
  requireCreator?: boolean;
}
export interface CompanyAuthorizedContext extends VerifiedCompanyContext {
  companyId: string;
  uid: string;
  role: CompanyPrincipalRole;
  action: CompanyAction;
  rootPath: string;
}
export class CompanyAuthorizationError extends Error {
  constructor(
    public readonly code: CompanyErrorCode,
    public readonly status: 401 | 403 | 503,
  ) {
    super(code);
    this.name = 'CompanyAuthorizationError';
  }
}

/** Pilot OFF by default; kill switches always take precedence. */
export function isCompanyPilotEnabled(): boolean {
  return process.env.EMPROVEX_COMPANY_PILOT_ENABLED === '1'
    && process.env.EMPROVEX_DISABLE_COMPANY_PROVISIONING !== '1'
    && process.env.EMPROVEX_DISABLE_ADMIN_MUTATIONS !== '1';
}
export function assertCompanyPilotEnabled(): void {
  if (!isCompanyPilotEnabled()) {
    throw new CompanyAuthorizationError('COMPANY_PILOT_DISABLED', 503);
  }
}
/**
 * One entry point for W1–W9 APIs. Never use client role, UG, slug, CNPJ,
 * claimed owner or document path as authorization. Bind IDs to Firestore
 * documents loaded under the verified company root.
 */
export async function requireCompanyContext(
  request: Request,
  intent: CompanyAuthorizationIntent,
): Promise<CompanyAuthorizedContext> {
  assertCompanyPilotEnabled();
  if (!(COMPANY_ACTIONS as readonly string[]).includes(intent.action)) {
    throw new CompanyAuthorizationError('COMPANY_OPERATION_FORBIDDEN', 403);
  }

  let session: VerifiedCompanyContext;
  try {
    session = await verifyCompanySession(request.headers.get('authorization'));
  } catch (error) {
    if (error instanceof CompanyAccessError) throw error;
    throw new CompanyAuthorizationError('COMPANY_SESSION_UNAVAILABLE', 503);
  }
  const companyId = session.workspaceId;
  if (
    (intent.companyId !== undefined && intent.companyId !== companyId)
    || (intent.resource !== undefined && (
      !intent.resource.companyId
      || intent.resource.companyId !== companyId
      || (intent.resource.workspaceId !== undefined && intent.resource.workspaceId !== companyId)
      || (intent.requireCreator === true && intent.resource.createdByUid !== session.firebaseUid)
    ))
  ) {
    throw new CompanyAuthorizationError('COMPANY_SCOPE_FORBIDDEN', 403);
  }
  if (intent.requireCreator && !intent.resource) {
    throw new CompanyAuthorizationError('COMPANY_INVALID_RESOURCE', 403);
  }
  // No W0 only the sole UID registered during founder provisioning can enter.
  // W3 replaces this owner-only bootstrap with verified membership and RBAC.
  return {
    ...session,
    companyId,
    uid: session.firebaseUid,
    role: 'owner',
    action: intent.action,
    rootPath: `${COMPANY_ROOT_COLLECTION}/${companyId}`,
  };
}

export function companyErrorStatus(error: unknown): 401 | 403 | 503 {
  if (error instanceof CompanyAuthorizationError) return error.status;
  if (error instanceof CompanyAccessError) return error.status;
  return 503;
}
