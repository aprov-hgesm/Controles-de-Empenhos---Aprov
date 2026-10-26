'use client';

/**
 * Billing admin browser bridge: all reads/writes go through a founder-authenticated
 * server endpoint. There are no client Firestore collection listeners or writes.
 */
import { getIdToken } from 'firebase/auth';
import { auth } from './firebase';
import type {
  BillingAccount, BillingAccountStatus, BillingCycle, BillingCycleStatus,
  PlatformBillingConfig,
} from './billing';
import type { Workspace } from './platformIdentity';

export interface PlatformBillingDirectory {
  config: PlatformBillingConfig | null;
  accounts: BillingAccount[];
  cycles: BillingCycle[];
}
export interface UpdatePlatformBillingConfigInput {
  billingMode?: PlatformBillingConfig['billingMode'];
  requirePayment?: boolean;
  monthlyPriceCents?: number;
  defaultTrialDays?: number;
  gracePeriodDays?: number;
  pixKey?: string;
  pixKeyType?: PlatformBillingConfig['pixKeyType'];
  pixRecipientName?: string;
  paymentLinkUrl?: string;
  supportContact?: string;
  holidayDates?: string[];
}
async function billingRequest<T>(command?: Record<string, unknown>): Promise<T> {
  const user = auth.currentUser;
  if (!user) throw new Error('BILLING_AUTH_REQUIRED');
  const idToken = await getIdToken(user);
  const response = await fetch('/api/admin/billing', {
    method: command ? 'POST' : 'GET',
    headers: {
      authorization: 'Bearer ' + idToken,
      ...(command ? { 'content-type': 'application/json' } : {}),
    },
    ...(command ? { body: JSON.stringify(command) } : {}),
    cache: 'no-store',
  });
  const payload: any = await response.json().catch(() => null);
  if (!response.ok) throw new Error(typeof payload?.code === 'string' ? payload.code : 'BILLING_SERVER_UNAVAILABLE');
  return (command ? payload?.result : payload) as T;
}
function assertFounderActor(adminEmail: string) {
  const signed = auth.currentUser?.email?.trim().toLowerCase();
  if (!signed || signed !== adminEmail.trim().toLowerCase()) throw new Error('BILLING_ADMIN_SESSION_CHANGED');
}
export function getPlatformBillingDirectory(): Promise<PlatformBillingDirectory> {
  return billingRequest<PlatformBillingDirectory>();
}
export async function updatePlatformBillingConfig(
  input: UpdatePlatformBillingConfigInput, adminEmail: string
): Promise<PlatformBillingConfig> {
  assertFounderActor(adminEmail);
  return billingRequest<PlatformBillingConfig>({ action: 'config', input });
}
export async function grantBillingTrial(
  workspace: Workspace, adminEmail: string, trialDays?: number
): Promise<BillingAccount> {
  assertFounderActor(adminEmail);
  return billingRequest<BillingAccount>({ action: 'trial', workspaceId: workspace.id, days: trialDays });
}
export async function setBillingExemption(
  workspace: Workspace, exempt: boolean, adminEmail: string
): Promise<BillingAccount> {
  assertFounderActor(adminEmail);
  return billingRequest<BillingAccount>({ action: 'exemption', workspaceId: workspace.id, exempt });
}
export async function setBillingCommercialStatus(
  workspace: Workspace, status: Exclude<BillingAccountStatus, 'exempt'>, adminEmail: string
): Promise<BillingAccount> {
  assertFounderActor(adminEmail);
  return billingRequest<BillingAccount>({ action: 'status', workspaceId: workspace.id, status });
}
export async function setBillingCycleStatus(
  workspace: Workspace, _account: BillingAccount, _config: PlatformBillingConfig,
  referenceMonth: string, status: BillingCycleStatus, adminEmail: string, note = ''
): Promise<BillingCycle> {
  assertFounderActor(adminEmail);
  return billingRequest<BillingCycle>({ action: 'cycle', workspaceId: workspace.id, month: referenceMonth, status, note });
}
