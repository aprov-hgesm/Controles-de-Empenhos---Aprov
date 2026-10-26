/**
 * EMPROVEX — billing administrativo exclusivamente no servidor.
 * Banco nomeado de produção, IAM no servidor, sessão Firebase Google fundadora.
 * Nenhum acesso direto do navegador; nenhuma migração de preço em leituras.
 */
import { createHash, randomUUID } from 'node:crypto';
import firebaseConfig from '../../firebase-applet-config.json';
import {
  addUtcDays, billingCycleId, buildBillingCycle, buildBillingCycleStatusTransition,
  EMPROVEX_NEW_CUSTOMER_RAMP_ID,
  buildPlatformBillingConfig, type BillingAccount, type BillingAccountStatus,
  type BillingCycle, type BillingCycleStatus, type PlatformBillingConfig,
} from '../billing';
import { HGESM_UG, HGESM_WORKSPACE_ID } from '../hgesmWorkspace';
import type { Workspace } from '../platformIdentity';
import { getGoogleAccessToken } from './sectorProvisioningAdmin';
import { quoteIndividualRamp } from './payments/emprovexRampPricing.mjs';
import { makeOrderNsu, assessPaymentCheck, callInfinitePay } from './payments/infinitepayCheckout.mjs';
import { readCheckoutUrl } from './payments/infinitepaySmokeHarness.mjs';
import { decideBillingAccess } from '../billingAccess';
import { getReferenceMonth } from '../billing';

const DOCUMENT_ROOT = `projects/${firebaseConfig.projectId}/databases/${firebaseConfig.firestoreDatabaseId}/documents`;
const ROOT = `https://firestore.googleapis.com/v1/${DOCUMENT_ROOT}`;
const CONFIG_PATH = 'platformBillingConfig/main';
const MAX_ROWS = 2000;
const ID = /^[a-z0-9][a-z0-9-]{2,47}$/;
const VALID_STATUSES = new Set(['trial', 'active', 'pending', 'suspended', 'canceled']);
const VALID_CYCLE_STATUSES = new Set(['open', 'pending', 'paid', 'waived']);

export class BillingAdminError extends Error {
  constructor(public readonly code: string, public readonly status: number) {
    super(code);
    this.name = 'BillingAdminError';
  }
}
type FireValue = Record<string, any>;
type RawDoc = { name: string; fields?: Record<string, FireValue>; updateTime?: string };
type ReadDoc = { value: Record<string, any>; updateTime: string } | null;
type Actor = { uid: string; email: string };
type Mutation = 
  | { action: 'config'; input: Record<string, unknown> }
  | { action: 'trial'; workspaceId: string; days?: number }
  | { action: 'exemption'; workspaceId: string; exempt: boolean }
  | { action: 'status'; workspaceId: string; status: BillingAccountStatus }
  | { action: 'cycle'; workspaceId: string; month: string; status: BillingCycleStatus; note?: string };

function encode(v: unknown): FireValue {
  if (v === undefined || v === null) return { nullValue: 'NULL_VALUE' };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (typeof v === 'string') return { stringValue: v };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number' && Number.isSafeInteger(v)) return { integerValue: String(v) };
  if (typeof v === 'number' && Number.isFinite(v)) return { doubleValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(encode) } };
  if (typeof v === 'object') return { mapValue: { fields: fields(v as Record<string, unknown>) } };
  throw new BillingAdminError('BILLING_INVALID_VALUE', 400);
}
function fields(v: Record<string, unknown>): Record<string, FireValue> {
  return Object.fromEntries(Object.entries(v).filter(([, x]) => x !== undefined)
    .map(([k, x]) => [k, encode(x)]));
}
function decode(v: FireValue): any {
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('nullValue' in v) return null;
  if ('mapValue' in v) return decodeFields(v.mapValue?.fields ?? {});
  if ('arrayValue' in v) return (v.arrayValue?.values ?? []).map(decode);
  throw new BillingAdminError('BILLING_INVALID_FIRESTORE_VALUE', 503);
}
function decodeFields(v: Record<string, FireValue>): Record<string, any> {
  return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, decode(x)]));
}
function documentName(path: string): string {
  if (path === CONFIG_PATH) return `${DOCUMENT_ROOT}/${path}`;
  if (/^billingAccounts\/[a-z0-9][a-z0-9-]{2,47}$/.test(path)
    || /^billingCycles\/[a-z0-9][a-z0-9-]{2,47}__\d{4}-\d{2}$/.test(path)
    || /^workspaces\/[a-z0-9][a-z0-9-]{2,47}$/.test(path)
    || /^platformAuditEvents\/[a-f0-9-]{36}$/.test(path)
    || /^billingPaymentLedger\/infinitepay_[a-f0-9]{64}$/.test(path)) return `${DOCUMENT_ROOT}/${path}`;
  throw new BillingAdminError('BILLING_PATH_REJECTED', 400);
}
async function rest(token: string, path: string, method: 'GET' | 'POST', body?: unknown) {
  const response = await fetch(ROOT + path, {
    method,
    headers: { authorization: 'Bearer ' + token, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    cache: 'no-store',
  });
  if (!response.ok) {
    if (response.status === 409 || response.status === 412) throw new BillingAdminError('BILLING_CONFLICT_RETRY', 409);
    throw new BillingAdminError('BILLING_SERVER_FIRESTORE_UNAVAILABLE', 503);
  }
  return response;
}
async function get(token: string, path: string): Promise<ReadDoc> {
  const response = await fetch('https://firestore.googleapis.com/v1/' + documentName(path), {
    headers: { authorization: 'Bearer ' + token }, cache: 'no-store',
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new BillingAdminError('BILLING_SERVER_FIRESTORE_UNAVAILABLE', 503);
  const row = await response.json() as RawDoc;
  return { value: decodeFields(row.fields ?? {}), updateTime: row.updateTime || '' };
}
async function list(token: string, collection: 'billingAccounts' | 'billingCycles') {
  const result: Record<string, any>[] = [];
  let pageToken = '';
  do {
    const params = new URLSearchParams({ pageSize: '100' });
    if (pageToken) params.set('pageToken', pageToken);
    const response = await rest(token, '/' + collection + '?' + params, 'GET');
    const page = await response.json() as { documents?: RawDoc[]; nextPageToken?: string };
    for (const entry of page.documents ?? []) {
      if (!entry.name?.startsWith(DOCUMENT_ROOT + '/' + collection + '/')) throw new BillingAdminError('BILLING_READ_SCOPE_INVALID', 503);
      result.push(decodeFields(entry.fields ?? {}));
      if (result.length > MAX_ROWS) throw new BillingAdminError('BILLING_DIRECTORY_TOO_LARGE', 503);
    }
    pageToken = page.nextPageToken || '';
  } while (pageToken);
  return result;
}
function streamRows(text: string): Record<string, any>[] {
  const data = text.trim();
  if (!data) return [];
  if (data[0] === '[') return JSON.parse(data);
  return data.split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));
}
async function transaction<T>(
  token: string, paths: string[],
  calculate: (docs: ReadonlyMap<string, ReadDoc>) => { result: T; updates: Array<{ path: string; data: object }> }
): Promise<T> {
  const names = paths.map(documentName);
  if (new Set(names).size !== names.length) throw new BillingAdminError('BILLING_DUPLICATE_PATH', 400);
  const beginResponse = await rest(token, ':beginTransaction', 'POST', { options: { readWrite: {} } });
  const begun = await beginResponse.json() as { transaction?: string };
  if (!begun.transaction) throw new BillingAdminError('BILLING_TRANSACTION_UNAVAILABLE', 503);
  let committed = false;
  try {
    const batch = await rest(token, ':batchGet', 'POST', { documents: names, transaction: begun.transaction });
    const rows = streamRows(await batch.text());
    const docs = new Map<string, ReadDoc>();
    for (const item of rows) {
      const raw = item.found as RawDoc | undefined;
      const name = raw?.name || item.missing;
      const index = names.indexOf(name);
      if (index < 0 || docs.has(paths[index])) throw new BillingAdminError('BILLING_TRANSACTION_READ_INVALID', 503);
      docs.set(paths[index], raw ? { value: decodeFields(raw.fields ?? {}), updateTime: raw.updateTime || '' } : null);
    }
    if (docs.size !== paths.length) throw new BillingAdminError('BILLING_TRANSACTION_READ_INCOMPLETE', 503);
    const { result, updates } = calculate(docs);
    if (updates.length === 0) return result;
    const writes = updates.map(({path, data}) => {
      if (!docs.has(path) && !path.startsWith('platformAuditEvents/'))
        throw new BillingAdminError('BILLING_TRANSACTION_UNREAD_WRITE', 503);
      const current = docs.get(path);
      return {
        update: { name: documentName(path), fields: fields(data as Record<string, unknown>) },
        currentDocument: current ? { updateTime: current.updateTime } : { exists: false },
      };
    });
    if (new Set(writes.map(w => w.update.name)).size !== writes.length)
      throw new BillingAdminError('BILLING_DUPLICATE_WRITE', 503);
    await rest(token, ':commit', 'POST', { transaction: begun.transaction, writes });
    committed = true;
    return result;
  } finally {
    if (!committed) await rest(token, ':rollback', 'POST', { transaction: begun.transaction }).catch(() => undefined);
  }
}
function audit(actor: Actor, operation: string, entityType: string, entityId: string, workspaceId: string, ug: string | null,
  before: Record<string, unknown>, after: Record<string, unknown>, metadata: Record<string, unknown> = {}) {
  const id = randomUUID();
  return {
    path: 'platformAuditEvents/' + id,
    data: {
      eventVersion: 'emprovex_audit_v1', eventId: id, workspaceId, ug, operation,
      source: 'admin', entityType, entityId, correlationId: randomUUID(),
      actorUid: actor.uid, actorEmail: actor.email,
      before, after, metadata, createdAt: new Date(),
    },
  };
}
function validWorkspaceId(id: unknown): asserts id is string {
  if (typeof id !== 'string' || !ID.test(id)) throw new BillingAdminError('BILLING_INVALID_WORKSPACE', 400);
}
function existingAccount(data: ReadDoc): BillingAccount {
  if (!data) throw new BillingAdminError('BILLING_ACCOUNT_NOT_PROVISIONED', 409);
  return data.value as BillingAccount;
}
function existingWorkspace(data: ReadDoc, expectedId: string): Workspace {
  if (!data || data.value.id !== expectedId || data.value.status !== 'active')
    throw new BillingAdminError('BILLING_WORKSPACE_UNAVAILABLE', 409);
  return data.value as Workspace;
}
function assertAccountWorkspace(account: BillingAccount, workspace: Workspace): void {
  if (account.workspaceId !== workspace.id || account.ug !== (workspace.ug || '')
    || account.authorizedEmail !== workspace.authorizedEmail)
    throw new BillingAdminError('BILLING_WORKSPACE_MISMATCH', 403);
}
function requireNonExempt(account: BillingAccount) {
  if (account.status === 'exempt') throw new BillingAdminError('BILLING_EXEMPT_ACCOUNT_IMMUTABLE', 409);
}
const noteValue = (input: unknown) => typeof input === 'string' ? input.trim().slice(0, 400) : '';
function clampedDays(v: unknown, defaultDays: number) {
  if (v === undefined) return defaultDays;
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 1 || v > 365)
    throw new BillingAdminError('BILLING_TRIAL_DAYS_INVALID', 400);
  return v;
}
function optionalString(v: unknown, max: number): string {
  if (typeof v !== 'string' || v.length > max) throw new BillingAdminError('BILLING_INVALID_INPUT', 400);
  return v.trim();
}
function validateUrl(v: string): string {
  if (!v) return '';
  try { const url = new URL(v); if (url.protocol === 'https:') return url.toString(); }
  catch { /* invalid */ }
  throw new BillingAdminError('BILLING_HTTPS_REQUIRED', 400);
}

export async function readBillingAdminDirectory() {
  const token = await getGoogleAccessToken();
  const [config, accounts, cycles] = await Promise.all([
    get(token, CONFIG_PATH), list(token, 'billingAccounts'), list(token, 'billingCycles'),
  ]);
  return {
    config: config?.value as PlatformBillingConfig | null,
    accounts: accounts as BillingAccount[], cycles: cycles as BillingCycle[],
  };
}

export async function mutateBillingAdmin(actor: Actor, command: Mutation): Promise<unknown> {
  if (process.env.EMPROVEX_DISABLE_ADMIN_MUTATIONS === '1' ||
      process.env.EMPROVEX_DISABLE_BILLING_ADMIN_MUTATIONS === '1')
    throw new BillingAdminError('BILLING_MUTATIONS_DISABLED', 503);
  if (!command || typeof command !== 'object') throw new BillingAdminError('BILLING_INVALID_INPUT', 400);
  const token = await getGoogleAccessToken();
  if (command.action === 'config') {
    const input = command.input;
    if (!input || typeof input !== 'object' || Array.isArray(input))
      throw new BillingAdminError('BILLING_INVALID_INPUT', 400);
    const allowed = ['billingMode','requirePayment','monthlyPriceCents','defaultTrialDays','gracePeriodDays','pixKey','pixKeyType','pixRecipientName','paymentLinkUrl','supportContact','holidayDates'];
    if (Object.keys(input).some(k => !allowed.includes(k))) throw new BillingAdminError('BILLING_INVALID_INPUT', 400);
    return transaction(token, [CONFIG_PATH], docs => {
      const current = docs.get(CONFIG_PATH)?.value as PlatformBillingConfig | undefined;
      if (!current) throw new BillingAdminError('BILLING_CONFIG_NOT_PROVISIONED', 409);
      // Legacy R$50 stays R$50. Never change contractual/global price implicitly.
      if (input.monthlyPriceCents !== undefined && input.monthlyPriceCents !== current.monthlyPriceCents)
        throw new BillingAdminError('BILLING_PRICE_CHANGE_REQUIRES_CONTRACT_FLOW', 409);
      if (input.billingMode !== undefined && input.billingMode !== 'observe')
        throw new BillingAdminError('BILLING_ENFORCEMENT_NOT_ACTIVATED', 409);
      if (input.requirePayment === true) throw new BillingAdminError('BILLING_ENFORCEMENT_NOT_ACTIVATED', 409);
      if (input.defaultTrialDays !== undefined && (typeof input.defaultTrialDays !== 'number'
        || !Number.isInteger(input.defaultTrialDays) || input.defaultTrialDays < 1 || input.defaultTrialDays > 365))
        throw new BillingAdminError('BILLING_TRIAL_DAYS_INVALID', 400);
      if (input.gracePeriodDays !== undefined && (typeof input.gracePeriodDays !== 'number'
        || !Number.isInteger(input.gracePeriodDays) || input.gracePeriodDays < 0 || input.gracePeriodDays > 90))
        throw new BillingAdminError('BILLING_GRACE_DAYS_INVALID', 400);
      const now = new Date().toISOString();
      const updated: PlatformBillingConfig = {
        ...current, billingMode: 'observe', requirePayment: false, automaticSuspension: false,
        pixKey: input.pixKey === undefined ? current.pixKey : optionalString(input.pixKey, 300),
        pixKeyType: input.pixKeyType === undefined ? current.pixKeyType :
          ['cpf', 'cnpj', 'email', 'phone', 'random', ''].includes(optionalString(input.pixKeyType, 20))
            ? input.pixKeyType as PlatformBillingConfig['pixKeyType']
            : (() => { throw new BillingAdminError('BILLING_INVALID_PIX_KEY_TYPE', 400); })(),
        pixRecipientName: input.pixRecipientName === undefined ? current.pixRecipientName : optionalString(input.pixRecipientName, 160),
        paymentLinkUrl: input.paymentLinkUrl === undefined ? current.paymentLinkUrl : validateUrl(optionalString(input.paymentLinkUrl, 2048)),
        supportContact: input.supportContact === undefined ? current.supportContact : optionalString(input.supportContact, 240),
        holidayDates: input.holidayDates === undefined ? current.holidayDates
          : Array.isArray(input.holidayDates) && input.holidayDates.length <= 200
            && input.holidayDates.every(d => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d))
            ? [...new Set(input.holidayDates as string[])].sort()
            : (() => { throw new BillingAdminError('BILLING_INVALID_HOLIDAYS', 400); })(),
        defaultTrialDays: input.defaultTrialDays === undefined ? current.defaultTrialDays : input.defaultTrialDays as number,
        gracePeriodDays: input.gracePeriodDays === undefined ? current.gracePeriodDays : input.gracePeriodDays as number,
        updatedAt: now, updatedBy: actor.email,
      };
      return { result: updated, updates: [
        { path: CONFIG_PATH, data: updated },
        audit(actor, 'billing.config_update', 'billing_config', 'main', HGESM_WORKSPACE_ID, HGESM_UG,
          { monthlyPriceCents: current.monthlyPriceCents }, { monthlyPriceCents: updated.monthlyPriceCents }),
      ] };
    });
  }
  if (!('workspaceId' in command)) throw new BillingAdminError('BILLING_INVALID_WORKSPACE', 400);
  validWorkspaceId(command.workspaceId);
  const workspaceId = command.workspaceId;
  if (command.action !== 'trial' && command.action !== 'exemption' && command.action !== 'status' && command.action !== 'cycle')
    throw new BillingAdminError('BILLING_UNKNOWN_ACTION', 400);
  if (command.action === 'trial' && workspaceId === HGESM_WORKSPACE_ID)
    throw new BillingAdminError('BILLING_FOUNDER_PERMANENTLY_EXEMPT', 409);
  if ((command.action === 'status' || command.action === 'exemption') && workspaceId === HGESM_WORKSPACE_ID)
    throw new BillingAdminError('BILLING_FOUNDER_PERMANENTLY_EXEMPT', 409);
  const accountPath = 'billingAccounts/' + workspaceId;
  const workspacePath = 'workspaces/' + workspaceId;
  const paths = [accountPath, workspacePath];
  let cyclePath = '';
  if (command.action === 'cycle') {
    if (typeof command.month !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(command.month)
      || !VALID_CYCLE_STATUSES.has(command.status))
      throw new BillingAdminError('BILLING_INVALID_CYCLE', 400);
    cyclePath = 'billingCycles/' + billingCycleId(workspaceId, command.month);
    paths.push(cyclePath, CONFIG_PATH);
  }
  return transaction<BillingAccount | BillingCycle>(token, paths, docs => {
    const workspace = existingWorkspace(docs.get(workspacePath) ?? null, workspaceId);
    const account = existingAccount(docs.get(accountPath) ?? null);
    assertAccountWorkspace(account, workspace);
    const now = new Date().toISOString();
    if (command.action === 'trial') {
      requireNonExempt(account);
      const days = clampedDays(command.days, 30);
      const updated: BillingAccount = { ...account, status: 'trial', trialGranted: true,
        trialStartedAt: now, trialEndsAt: addUtcDays(now, days).toISOString(),
        paymentRequired: false, updatedAt: now, updatedBy: actor.email };
      return { result: updated, updates: [
        { path: accountPath, data: updated },
        audit(actor, 'billing.trial_grant', 'billing_account', workspaceId, workspaceId, workspace.ug || null,
          { status: account.status, trialEndsAt: account.trialEndsAt }, { status: updated.status, trialEndsAt: updated.trialEndsAt }, { trialDays: days }),
      ] };
    }
    if (command.action === 'exemption') {
      if (typeof command.exempt !== 'boolean') throw new BillingAdminError('BILLING_INVALID_INPUT', 400);
      if (!command.exempt) throw new BillingAdminError('BILLING_EXEMPTION_REMOVAL_REQUIRES_CONTRACT', 409);
      if (account.status === 'exempt') return { result: account, updates: [] };
      const updated: BillingAccount = { ...account, status: 'exempt', monthlyPriceCents: 0,
        exemptionSource: 'manual', paymentRequired: false, updatedAt: now, updatedBy: actor.email };
      return { result: updated, updates: [
        { path: accountPath, data: updated },
        audit(actor, 'billing.status_change', 'billing_account', workspaceId, workspaceId, workspace.ug || null,
          { status: account.status, monthlyPriceCents: account.monthlyPriceCents },
          { status: updated.status, monthlyPriceCents: 0 }, { commercialExemption: true }),
      ] };
    }
    if (command.action === 'status') {
      if (!VALID_STATUSES.has(command.status)) throw new BillingAdminError('BILLING_INVALID_STATUS', 400);
      requireNonExempt(account);
      if (account.status === command.status) return { result: account, updates: [] };
      const updated: BillingAccount = { ...account, status: command.status, paymentRequired: false,
        updatedAt: now, updatedBy: actor.email };
      return { result: updated, updates: [
        { path: accountPath, data: updated },
        audit(actor, 'billing.status_change', 'billing_account', workspaceId, workspaceId, workspace.ug || null,
          { status: account.status }, { status: updated.status }),
      ] };
    }
    if (command.action === 'cycle') {
      requireNonExempt(account);
        if (!config) throw new BillingAdminError('BILLING_CONFIG_UNAVAILABLE', 409);
      const previous = docs.get(cyclePath)?.value as BillingCycle | undefined;
      const ramp = account.pricingPolicyId === EMPROVEX_NEW_CUSTOMER_RAMP_ID;
      if (account.pricingPolicyId && !ramp)
        throw new BillingAdminError('BILLING_UNKNOWN_PRICING_POLICY', 409);
      if (ramp && !account.pricingTermsAcceptedAt)
        throw new BillingAdminError('BILLING_PRICING_ACCEPTANCE_REQUIRED', 409);
      const quote = ramp
        ? quoteIndividualRamp({
            firstPaidReferenceMonth: account.firstPaidReferenceMonth,
            referenceMonth: command.month,
          })
        : null;
      if (quote && !quote.allowed)
        throw new BillingAdminError('BILLING_REFERENCE_BEFORE_RAMP_START', 409);
      const priceCents = quote?.allowed ? quote.amountCents : account.monthlyPriceCents;
      const base = previous ?? {
        ...buildBillingCycle(account, command.month, config, actor.email),
        amountCents: priceCents,
      };
      if (previous && ramp && previous.amountCents !== priceCents)
        throw new BillingAdminError('BILLING_EXISTING_CYCLE_PRICE_MISMATCH', 409);
      if (base.workspaceId !== workspaceId || base.ug !== (workspace.ug || '')
        || base.id !== billingCycleId(workspaceId, command.month))
        throw new BillingAdminError('BILLING_CYCLE_MISMATCH', 409);
      // Never change a materialized amount, even if account/config price changed.
      const transition = buildBillingCycleStatusTransition(base, command.status, actor.email, noteValue(command.note), now);
      if (!transition.changed && previous) return { result: previous, updates: [] };
      const status = command.status === 'paid' || command.status === 'waived' ? 'active' : 'pending';
      const advancesRamp = ramp && (!account.lastBilledReferenceMonth
        || command.month >= account.lastBilledReferenceMonth);
      const nextAccount: BillingAccount = { ...account, status,
        ...(command.status === 'paid' || command.status === 'waived'
          ? { grace48ReviewStatus: 'confirmed' as const }
          : {}),
        monthlyPriceCents: advancesRamp ? priceCents : account.monthlyPriceCents,
        ...(advancesRamp ? { lastBilledReferenceMonth: command.month } : {}),
        updatedAt: now, updatedBy: actor.email, paymentRequired: false };
      const accountChanged = account.status !== status || account.paymentRequired !== false
        || account.monthlyPriceCents !== nextAccount.monthlyPriceCents
        || account.lastBilledReferenceMonth !== nextAccount.lastBilledReferenceMonth
        || account.grace48ReviewStatus !== nextAccount.grace48ReviewStatus;
      const updates: Array<{ path: string; data: object }> = [{ path: cyclePath, data: transition.cycle }];
      if (accountChanged) updates.push({ path: accountPath, data: nextAccount });
      updates.push(audit(actor, command.status === 'paid' || command.status === 'waived'
        ? 'billing.payment_confirm' : 'billing.payment_reopen',
        'billing_cycle', transition.cycle.id, workspaceId, workspace.ug || null,
        { status: base.status, amountCents: base.amountCents },
        { status: transition.cycle.status, amountCents: transition.cycle.amountCents },
        { idempotentDocumentId: transition.cycle.id, manualConfirmation: true,
          pricingPolicy: account.pricingPolicyId || 'legacy', paidMonthNumber: quote && 'paidMonthNumber' in quote ? quote.paidMonthNumber : null }));
      return { result: transition.cycle, updates };
    }
    throw new BillingAdminError('BILLING_UNKNOWN_ACTION', 400);
  });
}


/**
 * The authenticated sector explicitly accepts all future price tiers.
 * Portal verification binds the caller to workspace and email BEFORE this
 * IAM transaction; the persisted workspace/account are revalidated inside it.
 * No existing customer can be silently enrolled or repriced.
 */
export async function acceptNewCustomerRamp(
  actor: Actor, workspaceId: string, authorizedEmail: string,
): Promise<{ accepted: true; pricingPolicyId: string; firstPaidReferenceMonth: string }> {
  validWorkspaceId(workspaceId);
  if (workspaceId === HGESM_WORKSPACE_ID)
    throw new BillingAdminError('BILLING_FOUNDER_PERMANENTLY_EXEMPT', 403);
  const token = await getGoogleAccessToken();
  const wp = 'workspaces/' + workspaceId;
  const ap = 'billingAccounts/' + workspaceId;
  return transaction(token, [wp, ap], docs => {
    const workspace = existingWorkspace(docs.get(wp) ?? null, workspaceId);
    const account = existingAccount(docs.get(ap) ?? null);
    assertAccountWorkspace(account, workspace);
    if (workspace.authorizedEmail !== authorizedEmail || actor.email !== authorizedEmail)
      throw new BillingAdminError('BILLING_CUSTOMER_IDENTITY_MISMATCH', 403);
    if (account.status === 'exempt' || account.pricingPolicyId !== EMPROVEX_NEW_CUSTOMER_RAMP_ID
      || !account.firstPaidReferenceMonth
      || !['trial','active'].includes(account.status))
      throw new BillingAdminError('BILLING_PRICING_NOT_OFFERED', 409);
    const result = {
      accepted: true as const,
      pricingPolicyId: EMPROVEX_NEW_CUSTOMER_RAMP_ID,
      firstPaidReferenceMonth: account.firstPaidReferenceMonth,
    };
    if (account.pricingTermsAcceptedAt) return { result, updates: [] };
    const now = new Date().toISOString();
    return { result, updates: [
      { path: ap, data: { ...account, pricingTermsAcceptedAt: now, updatedAt: now, updatedBy: actor.email } },
      audit(actor, 'billing.status_change', 'billing_account', workspaceId, workspaceId, workspace.ug || null,
        { pricingTermsAcceptedAt: null },
        { pricingTermsAcceptedAt: now, pricingPolicyId: EMPROVEX_NEW_CUSTOMER_RAMP_ID },
        { pricingConsent: true, allFiveTiersDisclosed: true }),
    ] };
  });
}

/** An entitlement check is never a write or a client-chosen month/amount. */
export async function readSectorBillingAccess(workspaceId: string, email: string) {
  validWorkspaceId(workspaceId);
  const token = await getGoogleAccessToken();
  const [workspaceDoc, accountDoc] = await Promise.all([
    get(token, 'workspaces/' + workspaceId),
    get(token, 'billingAccounts/' + workspaceId),
  ]);
  const workspace = existingWorkspace(workspaceDoc, workspaceId);
  const account = existingAccount(accountDoc);
  assertAccountWorkspace(account, workspace);
  if (workspace.authorizedEmail !== email)
    throw new BillingAdminError('BILLING_CUSTOMER_IDENTITY_MISMATCH', 403);
  const month = getReferenceMonth();
  const cycleDoc = await get(token, 'billingCycles/' + billingCycleId(workspaceId, month));
  const cycle = cycleDoc?.value as BillingCycle | undefined;
  const decision = decideBillingAccess(account, cycle ?? null);
  // Do not disclose future commercial tiers to the sector.
  return { ...decision, amountCents: account.pricingPolicyId === EMPROVEX_NEW_CUSTOMER_RAMP_ID
    ? (quoteIndividualRamp({ firstPaidReferenceMonth: account.firstPaidReferenceMonth,
        referenceMonth: month }).amountCents ?? null)
    : decision.amountCents };
}

/**
 * Immediate one-time access for 48h; founder notified by pending flag on the
 * billing account, visible in the existing admin directory. Never marks paid.
 */
export async function requestSectorGrace48(actor: Actor, workspaceId: string, email: string) {
  validWorkspaceId(workspaceId);
  if (actor.email !== email || workspaceId === HGESM_WORKSPACE_ID)
    throw new BillingAdminError('BILLING_CUSTOMER_IDENTITY_MISMATCH', 403);
  const token = await getGoogleAccessToken();
  const month = getReferenceMonth();
  const wp = 'workspaces/' + workspaceId;
  const ap = 'billingAccounts/' + workspaceId;
  const cp = 'billingCycles/' + billingCycleId(workspaceId, month);
  return transaction(token, [wp, ap, cp], docs => {
    const workspace = existingWorkspace(docs.get(wp) ?? null, workspaceId);
    const account = existingAccount(docs.get(ap) ?? null);
    assertAccountWorkspace(account, workspace);
    if (workspace.authorizedEmail !== email)
      throw new BillingAdminError('BILLING_CUSTOMER_IDENTITY_MISMATCH', 403);
    const cycle = docs.get(cp)?.value as BillingCycle | undefined;
    const decision = decideBillingAccess(account, cycle ?? null);
    if (decision.allowed) {
      if (decision.reason === 'grace48') return { result: { ...decision }, updates: [] };
      throw new BillingAdminError('BILLING_GRACE_NOT_REQUIRED', 409);
    }
    if (!decision.canRequestGrace48)
      throw new BillingAdminError('BILLING_GRACE_ALREADY_USED', 409);
    const now = new Date();
    const until = new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString();
    const updated: BillingAccount = { ...account,
      grace48ReferenceMonth: month, grace48RequestedAt: now.toISOString(),
      grace48Until: until, grace48ReviewStatus: 'pending',
      updatedAt: now.toISOString(), updatedBy: actor.email };
    const result = decideBillingAccess(updated, cycle ?? null, now);
    return { result, updates: [
      { path: ap, data: updated },
      audit(actor, 'billing.status_change', 'billing_account', workspaceId, workspaceId, workspace.ug || null,
        { grace48RequestedAt: account.grace48RequestedAt ?? null },
        { grace48RequestedAt: updated.grace48RequestedAt, grace48Until: until },
        { event: 'GRACE48_REQUEST_ADMIN_REVIEW', automaticPaymentConfirmation: false }),
    ] };
  });
}

function requireCheckoutConfig() {
  if (process.env.INFINITEPAY_BILLING_ENABLED !== '1')
    throw new BillingAdminError('BILLING_CHECKOUT_NOT_ENABLED', 503);
  const secret = process.env.INFINITEPAY_ORDER_SECRET || '';
  if (secret.length < 32 || (process.env.INFINITEPAY_API_KEY || '').length < 16
    || !process.env.INFINITEPAY_HANDLE)
    throw new BillingAdminError('BILLING_CHECKOUT_CREDENTIALS_UNAVAILABLE', 503);
  return secret;
}

/**
 * One checkout at a time for the authenticated tenant and current reference
 * month. The frozen cycle and opaque provider order are stored before any call
 * to InfinitePay. The browser cannot choose a price or workspace.
 */
export async function createSectorSubscriptionCheckout(actor: Actor, workspaceId: string, email: string) {
  validWorkspaceId(workspaceId);
  if (actor.email !== email) throw new BillingAdminError('BILLING_CUSTOMER_IDENTITY_MISMATCH', 403);
  const orderIdSecret = requireCheckoutConfig();
  const token = await getGoogleAccessToken();
  const month = getReferenceMonth();
  const wp = 'workspaces/' + workspaceId;
  const ap = 'billingAccounts/' + workspaceId;
  const cp = 'billingCycles/' + billingCycleId(workspaceId, month);
  const orderNsu = makeOrderNsu({ workspaceId, referenceMonth: month, orderIdSecret });
  const prepared = await transaction(token, [wp, ap, cp], docs => {
    const workspace = existingWorkspace(docs.get(wp) ?? null, workspaceId);
    const account = existingAccount(docs.get(ap) ?? null);
    assertAccountWorkspace(account, workspace);
    if (workspace.authorizedEmail !== email || workspaceId === HGESM_WORKSPACE_ID
      || account.status === 'exempt' || account.exemptionSource
      || !['active','pending','trial'].includes(account.status))
      throw new BillingAdminError('BILLING_ACCOUNT_NOT_BILLABLE', 409);
    if (account.status === 'trial' && account.trialEndsAt && Date.now() < Date.parse(account.trialEndsAt))
      throw new BillingAdminError('BILLING_TRIAL_ACTIVE', 409);
    if (account.pricingPolicyId !== EMPROVEX_NEW_CUSTOMER_RAMP_ID
      || !account.pricingTermsAcceptedAt)
      throw new BillingAdminError('BILLING_PRICING_ACCEPTANCE_REQUIRED', 409);
    const quote = quoteIndividualRamp({
      firstPaidReferenceMonth: account.firstPaidReferenceMonth, referenceMonth: month,
    });
    if (!quote.allowed) throw new BillingAdminError('BILLING_REFERENCE_NOT_BILLABLE', 409);
    const amount = quote.amountCents as number;
    const previous = docs.get(cp)?.value as BillingCycle | undefined;
    if (previous && (previous.status === 'paid' || previous.status === 'waived'))
      throw new BillingAdminError('BILLING_CYCLE_ALREADY_SETTLED', 409);
    if (previous && previous.amountCents !== amount)
      throw new BillingAdminError('BILLING_FROZEN_AMOUNT_MISMATCH', 409);
    if (previous?.checkoutOrderNsu && previous.checkoutOrderNsu !== orderNsu)
      throw new BillingAdminError('BILLING_OTHER_CHECKOUT_EXISTS', 409);
    if (previous?.checkoutUrl) return { result: {
      orderNsu, amountCents: amount, referenceMonth: month, checkoutUrl: previous.checkoutUrl,
      validUntil: previous.checkoutValidUntil || '', alreadyLinked: true,
    }, updates: [] };
    if (previous?.checkoutState === 'prepared' && previous.checkoutOrderNsu)
      throw new BillingAdminError('BILLING_CHECKOUT_PENDING_SUPPORT', 409);
    const now = new Date().toISOString();
    const config = docs.get(CONFIG_PATH)?.value as PlatformBillingConfig | undefined;
    // No configuration fetch is required: the pricing contract is individual;
    // the current calendar is used only to calculate due date.
    const fallback: PlatformBillingConfig = {
      ...buildPlatformBillingConfig(actor.email), gracePeriodDays: 10,
    };
    const cycle: BillingCycle = previous || buildBillingCycle(account, month, fallback, actor.email);
    const validUntil = new Date(Date.now() + 30 * 86400000).toISOString();
    const updated: BillingCycle = {
      ...cycle,
      amountCents: amount,
      dueDate: cycle.dueDate >= now.slice(0, 10) ? cycle.dueDate : now.slice(0, 10),
      status: 'pending',
      checkoutOrderNsu: orderNsu, checkoutAmountCents: amount,
      checkoutCreatedAt: now, checkoutValidUntil: validUntil,
      checkoutState: 'prepared', updatedAt: now, updatedBy: actor.email,
    };
    return { result: {
      orderNsu, amountCents: amount, referenceMonth: month, validUntil,
      checkoutUrl: '', alreadyLinked: false,
    }, updates: [
      { path: cp, data: updated },
      audit(actor, 'billing.payment_reopen', 'billing_cycle', updated.id, workspaceId, workspace.ug || null,
        { status: previous?.status ?? null }, { status: 'pending', amountCents: amount },
        { provider: 'infinitepay', checkoutPrepared: true, orderNsu }),
    ] };
  });
  if (prepared.alreadyLinked) return prepared;
  // Do not add a webhook without server-side authenticity and replay defenses:
  // the verified signed-in redirect is reconciled through payment_check.
  const payload = {
    order_nsu: orderNsu,
    redirect_url: 'https://emprovex.com.br/regularizacao',
    items: [{ quantity: 1, price: prepared.amountCents,
      description: 'EMPROVEX - Plano Completo - ' + month }],
    options: { single_payment: true, valid_until: prepared.validUntil,
      require_delivery_address: false,
      payment_methods_enabled: ['pix', 'credit_card'] },
  };
  const response = await callInfinitePay({
    operation: 'links', apiKey: process.env.INFINITEPAY_API_KEY,
    payload, allowExternalCall: true,
  });
  const checkoutUrl = readCheckoutUrl(response);
  const linked = await transaction(token, [cp], docs => {
    const cycle = docs.get(cp)?.value as BillingCycle | undefined;
    if (!cycle || cycle.checkoutOrderNsu !== orderNsu || cycle.amountCents !== prepared.amountCents
      || cycle.status === 'paid' || cycle.status === 'waived')
      throw new BillingAdminError('BILLING_CHECKOUT_CHANGED', 409);
    if (cycle.checkoutUrl && cycle.checkoutUrl !== checkoutUrl)
      throw new BillingAdminError('BILLING_CHECKOUT_LINK_CONFLICT', 409);
    if (cycle.checkoutUrl) return { result: cycle.checkoutUrl, updates: [] };
    return { result: checkoutUrl, updates: [{ path: cp, data: {
      ...cycle, checkoutUrl, checkoutState: 'linked', updatedAt: new Date().toISOString(),
    } }] };
  });
  return { orderNsu, amountCents: prepared.amountCents,
    referenceMonth: month, checkoutUrl: linked, alreadyLinked: false };
}

/**
 * Authenticated return -> official payment_check -> atomic cycle, ledger and
 * audit. No URL or webhook parameters can mark payment on their own.
 */
export async function reconcileSectorSubscriptionPayment(actor: Actor, workspaceId: string, email: string,
  input: { orderNsu: string; transactionNsu: string; slug: string }) {
  validWorkspaceId(workspaceId);
  if (actor.email !== email) throw new BillingAdminError('BILLING_CUSTOMER_IDENTITY_MISMATCH', 403);
  requireCheckoutConfig();
  if (!/^epx-[0-9]{6}-[a-f0-9]{24}$/.test(input.orderNsu)
    || !/^[a-zA-Z0-9_.:-]{1,200}$/.test(input.transactionNsu)
    || !/^[a-zA-Z0-9_.:-]{1,200}$/.test(input.slug))
    throw new BillingAdminError('BILLING_INVALID_PROVIDER_RETURN', 400);
  const month = input.orderNsu.slice(4, 8) + '-' + input.orderNsu.slice(8, 10);
  const cp = 'billingCycles/' + billingCycleId(workspaceId, month);
  const token = await getGoogleAccessToken();
  const [workspaceDoc, accountDoc, cycleDoc] = await Promise.all([
    get(token, 'workspaces/' + workspaceId), get(token, 'billingAccounts/' + workspaceId),
    get(token, cp),
  ]);
  const workspace = existingWorkspace(workspaceDoc, workspaceId);
  const account = existingAccount(accountDoc);
  assertAccountWorkspace(account, workspace);
  if (workspace.authorizedEmail !== email) throw new BillingAdminError('BILLING_CUSTOMER_IDENTITY_MISMATCH', 403);
  const cycle = cycleDoc?.value as BillingCycle | undefined;
  if (!cycle || cycle.checkoutOrderNsu !== input.orderNsu || !cycle.checkoutUrl
    || !Number.isSafeInteger(cycle.amountCents) || cycle.amountCents <= 0)
    throw new BillingAdminError('BILLING_PAYMENT_INTENT_NOT_FOUND', 409);
  const paymentCheck = await callInfinitePay({
    operation: 'payment_check', apiKey: process.env.INFINITEPAY_API_KEY,
    payload: { handle: process.env.INFINITEPAY_HANDLE, order_nsu: input.orderNsu,
      transaction_nsu: input.transactionNsu, slug: input.slug },
    allowExternalCall: true,
  });
  const checked = assessPaymentCheck({ amountCents: cycle.amountCents, paymentCheck });
  if (checked.verified !== true)
    return { verified: false, code: checked.reason };
  const ledgerId = 'infinitepay_' + createHash('sha256')
    .update(input.transactionNsu).digest('hex');
  const lp = 'billingPaymentLedger/' + ledgerId;
  return transaction(token, [cp, lp, 'billingAccounts/' + workspaceId, 'workspaces/' + workspaceId], docs => {
    const currentWorkspace = existingWorkspace(docs.get('workspaces/' + workspaceId) ?? null, workspaceId);
    const currentAccount = existingAccount(docs.get('billingAccounts/' + workspaceId) ?? null);
    assertAccountWorkspace(currentAccount, currentWorkspace);
    const current = docs.get(cp)?.value as BillingCycle | undefined;
    const existing = docs.get(lp)?.value as Record<string, unknown> | undefined;
    if (!current || current.checkoutOrderNsu !== input.orderNsu
      || current.amountCents !== cycle.amountCents || current.workspaceId !== workspaceId)
      throw new BillingAdminError('BILLING_SETTLEMENT_CHANGED', 409);
    if (existing) {
      if (existing.orderNsu === input.orderNsu && existing.workspaceId === workspaceId
        && existing.cycleId === current.id && current.status === 'paid')
        return { result: { verified: true, code: 'BILLING_PAYMENT_ALREADY_VERIFIED' }, updates: [] };
      throw new BillingAdminError('BILLING_TRANSACTION_REUSE_CONFLICT', 409);
    }
    if (current.status === 'paid' || current.status === 'waived')
      throw new BillingAdminError('BILLING_CYCLE_SETTLED_OTHER_METHOD', 409);
    if (currentAccount.status === 'exempt' || currentAccount.exemptionSource)
      throw new BillingAdminError('BILLING_EXEMPT_ACCOUNT_IMMUTABLE', 409);
    const now = new Date().toISOString();
    const settled: BillingCycle = { ...current, status: 'paid', confirmedAt: now,
      confirmedBy: 'provider:infinitepay', updatedAt: now,
      updatedBy: 'provider:infinitepay', checkoutState: 'settled',
      settlementLedgerId: ledgerId, note: 'Pagamento verificado diretamente na InfinitePay' };
    const nextAccount: BillingAccount = { ...currentAccount,
      status: 'active', monthlyPriceCents: current.amountCents,
      grace48ReviewStatus: 'confirmed', updatedAt: now, updatedBy: 'provider:infinitepay' };
    return { result: { verified: true, code: 'BILLING_PAYMENT_CONFIRMED' }, updates: [
      { path: cp, data: settled }, { path: 'billingAccounts/' + workspaceId, data: nextAccount },
      { path: lp, data: { provider: 'infinitepay', workspaceId, cycleId: current.id,
        orderNsu: input.orderNsu, transactionNsu: input.transactionNsu,
        invoiceSlug: input.slug, amountCents: current.amountCents,
        method: paymentCheck.capture_method, verifiedAt: now } },
      audit(actor, 'billing.payment_confirm', 'billing_cycle', current.id,
        workspaceId, currentWorkspace.ug || null,
        { status: current.status }, { status: 'paid', amountCents: current.amountCents },
        { provider: 'infinitepay', settlementLedgerId: ledgerId }),
    ] };
  });
}
