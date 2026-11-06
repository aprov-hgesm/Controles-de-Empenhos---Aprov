/** W13 handshake: W10 supplies live authorization, verified issuer and secret vault.
 * None of these shapes authorizes a WLG account on its own.
 */
export type WlgEnvironment = 'homologacao' | 'producao';
export type WlgConnectionStatus = 'pending_verification' | 'connected' | 'disconnected' | 'revoked';
export interface WlgConnection {
  provider: 'wlg';
  companyId: string;
  workspaceId: string;
  cnpj: string;
  providerEmpresaId: string;
  environment: WlgEnvironment;
  status: WlgConnectionStatus;
  credentialRef: string; // server-side reference, NEVER a secret
  credentialVersion: number;
  verification: {
    issuerCnpj: string;
    providerEmpresaId: string;
    credentialVersion: number;
    verifiedAt: string;
    /** W10 must document provider-specific proof, not browser assertion. */
    verificationMethod: string;
  };
  rotatedAt?: string;
  revokedAt?: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
}
export interface WlgActor { companyId: string; workspaceId: string; uid: string }
export interface WlgSecret { clientId: string; clientSecret: string }
export interface WlgSecretSelector {
  companyId: string; workspaceId: string; environment: WlgEnvironment;
  credentialRef: string; credentialVersion: number;
}
export type FiscalProviderOperation =
  | { kind: 'processing'; rawStatus?: string; operationId?: string }
  | { kind: 'rejected'; reason: string }
  | { kind: 'provider_success_unverified'; chaveNfe: string; dataAutorizacao: string | null };
export interface FiscalProvider {
  readonly provider: 'wlg';
  getOperation(connection: WlgConnection, actor: WlgActor, operationId: string): Promise<FiscalProviderOperation>;
  submitHomologation(connection: WlgConnection, actor: WlgActor, command: {
    humanApprovalVerified: true;
    reviewedIntentId: string; reservationId: string; reviewedByUid: string;
    payload: Record<string, unknown>;
  }): Promise<{ kind: 'processing'; operationId: string }>;
  downloadXml(connection: WlgConnection, actor: WlgActor, chaveNfe: string): Promise<{
    bytes: Uint8Array; mime: 'application/xml'; verifiedIssuerCnpj: string;
  }>;
  revokeLocalToken(connection: WlgConnection): void;
}
export class WlgError extends Error {
  constructor(code: string, status?: number);
  readonly code: string;
  readonly status: number;
}
export function normalizeCnpj(value: unknown): string;
export function assertBoundConnection(connection: WlgConnection, actor: WlgActor): WlgConnection;
export function publicConnection(connection: WlgConnection, actor: WlgActor): Readonly<{
  provider: 'wlg'; companyId: string; environment: WlgEnvironment;
  status: WlgConnectionStatus; issuerCnpj: string;
  verifiedAt: string; credentialVersion: number;
}>;
export function assertProviderIssuer(connection: WlgConnection, providerIssuerCnpj: unknown): true;
export function createWlgProvider(options: {
  secretResolver: (selector: WlgSecretSelector) => Promise<WlgSecret>;
  fetchImpl?: typeof fetch;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  timeoutMs?: number;
  minIntervalMs?: number;
}): FiscalProvider;
