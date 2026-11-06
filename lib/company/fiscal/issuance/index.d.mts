export type NfeState = 'draft' | 'ready_for_review' | 'approved' | 'submitted'
  | 'processing' | 'authorized' | 'rejected' | 'uncertain';
export type NfeEnvironment = 'homologacao';
export interface IssuanceContext {
  uid: string;
  companyId: string;
  workspaceId: string;
  cnpj: string;
  active: true;
  emailVerified: true;
}
export interface FiscalIssue {
  id: string;
  companyId: string;
  workspaceId: string;
  issuerCnpj: string;
  connectionId: string;
  environment: NfeEnvironment;
  series: number;
  number: number;
  orderId: string;
  /** Revision of verified W1 order, rechecked before fiscal POST. */
  orderRevision: number;
  payload: Record<string, unknown>;
  status: NfeState;
  revision: number;
  idempotencyKey: string;
  fingerprint: string;
  reservationId: string;
  createdByUid: string;
  createdAt: string;
  updatedAt: string;
  pollCount: number;
  nextPollAt: number | null;
  audit: Array<Record<string, unknown>>;
  approvedByUid?: string;
  approvalFingerprint?: string;
  operationId?: string;
  reconciliationRequired?: boolean;
  accessKey?: string;
  authorizationProtocol?: string;
  authorizedAt?: string;
  documents?: Array<{ kind: 'authorized_xml' | 'danfe'; sha256: string; privateRef: string }>;
}
export interface FiscalStore {
  /** Atomic durable reservation: (company,CNPJ,env,series,number) AND idempotency+hash. */
  reserve(record: FiscalIssue, reservation: {
    numberKey: string; idempotencyKey: string; fingerprint: string;
  }): Promise<FiscalIssue | null>;
  read(companyId: string, id: string): Promise<FiscalIssue | null>;
  /** CAS must persist record, revision and audit atomically, never in local memory. */
  cas(companyId: string, id: string, expectedRevision: number,
    next: FiscalIssue): Promise<FiscalIssue | null>;
}
export interface NfeConnection {
  provider: 'wlg'; companyId: string; workspaceId: string; connectionId: string;
  cnpj: string; providerEmpresaId: string; environment: 'homologacao' | 'producao';
  status: 'connected' | 'pending_verification' | 'disconnected' | 'revoked';
  credentialRef: string; credentialVersion: number;
  verification: { issuerCnpj: string; providerEmpresaId: string;
    credentialVersion: number; verifiedAt: string; verificationMethod?: string };
}
export interface NfeDependencies {
  /** Source MUST be W10 server-side live guard, not any body/cookie selector. */
  authorize(action: 'fiscal:read' | 'fiscal:write' | 'fiscal:approve' | 'fiscal:issue'): Promise<IssuanceContext>;
  resolveConnection(context: IssuanceContext): Promise<NfeConnection>;
  /** W10 must live-check ownership + remaining/partial item quantities against W1. */
  verifyOrder(context: IssuanceContext, orderId: string, items: unknown[]): Promise<{
    companyId: string; workspaceId: string; id?: string;
    fiscalAllocationVerified: true; revision: number;
  } | null>;
  store: FiscalStore;
  provider: {
    submitHomologation(connection: NfeConnection, actor: IssuanceContext, command: {
      humanApprovalVerified: true; reviewedIntentId: string; reservationId: string;
      reviewedByUid: string; payload: Record<string, unknown>;
    }): Promise<{ kind: 'processing'; operationId: string }>;
    getOperation(connection: NfeConnection, actor: IssuanceContext, operationId: string):
      Promise<{kind: 'processing'} | {kind: 'rejected'; reason: string}
        | {kind: 'provider_success_unverified'; chaveNfe: string; dataAutorizacao?: string | null}>;
    downloadXml(connection: NfeConnection, actor: IssuanceContext, chaveNfe: string):
      Promise<{bytes: Uint8Array; verifiedIssuerCnpj: string}>;
  };
  /** Independently verifies XML signature, trusted SEFAZ protocol and issuer. */
  verifyXml(bytes: Uint8Array, expected: NfeXmlInspection, ctx: IssuanceContext):
    Promise<{signatureValid: true; protocolValid: true; trustedSefaz: true;
      key: string; issuerCnpj: string; protocol: string; authorizedAt: string} | null>;
  /** Never returns public URLs; archive under strictly authorized workspace only. */
  archivePrivate(ctx: IssuanceContext, issue: FiscalIssue, document: {
    kind: 'authorized_xml' | 'danfe'; bytes: Uint8Array;
    mime: 'application/xml' | 'application/pdf'; sha256: string;
  }): Promise<{privateRef: string; sha256: string}>;
  now?: () => string;
  newId?: () => string;
}
export interface NfeXmlInspection {
  key: string; issuerCnpj: string; environment: 'homologacao';
  protocol: string; authorizedAt: string; sha256: string;
}
export interface NfeEngine {
  createDraft(input: {idempotencyKey: string; companyId?: string; workspaceId?: string;
    series: number; number: number; orderId: string; payload: Record<string, unknown>}):
    Promise<FiscalIssue>;
  getStatus(id: string): Promise<Omit<FiscalIssue, 'payload'>>;
  requestReview(id: string): Promise<FiscalIssue>;
  approve(id: string, confirmation: {confirmed: true; fingerprint: string; issuerCnpj: string}):
    Promise<FiscalIssue>;
  submit(id: string): Promise<FiscalIssue>;
  poll(id: string): Promise<FiscalIssue>;
  archiveDanfe(id: string, bytes: Uint8Array): Promise<FiscalIssue>;
  cancelOrCorrect(): Promise<never>;
}
export class NfeIssueError extends Error {
  constructor(code: string, status?: number);
  readonly code: string; readonly status: number;
}
export const ISSUE_STATES: ReadonlyArray<NfeState>;
export function createNfeIssuanceEngine(deps: NfeDependencies): NfeEngine;
export function validNfeAccessKey(key: string, issuerCnpj: string,
  series: number, number: number): boolean;
export function inspectAuthorizedXml(bytes: Uint8Array, expected: {
  key: string; issuerCnpj: string; series: number; number: number;
}): NfeXmlInspection;
