'use client';

import type { User } from 'firebase/auth';
import type { SectorWorkspaceContext } from './workspaceContext';
import { HGESM_SECTOR_EMAIL } from './hgesmWorkspace';

export interface SectorBillingDecision {
  allowed: boolean;
  reason: string;
  referenceMonth: string;
  amountCents: number | null;
  graceUntil: string | null;
  canRequestGrace48: boolean;
  requestPending: boolean;
  requiresPayment: boolean;
}

export async function checkSectorBillingAccess(
  user: User,
  context: SectorWorkspaceContext,
): Promise<SectorBillingDecision> {
  // Sem política de cobrança homologada para Almoxarifado, nunca herdar
  // a cobrança do Aprovisionamento. O contexto setorial já passou pelo
  // resolvedor de UID/conta/workspace antes de chegar aqui.
  if (context.sectorType === 'almoxarifado' || user.email?.toLowerCase() === HGESM_SECTOR_EMAIL.toLowerCase()) {
    return {
      allowed: true, reason: 'vip', referenceMonth: '', amountCents: 0,
      graceUntil: null, canRequestGrace48: false, requestPending: false, requiresPayment: false,
    };
  }
  const token = await user.getIdToken();
  const response = await fetch('/api/billing/portal?view=access', {
    headers: { authorization: 'Bearer ' + token },
    cache: 'no-store',
  });
  if (!response.ok) throw new Error('BILLING_ACCESS_CHECK_UNAVAILABLE');
  const decision = await response.json() as SectorBillingDecision;
  if (typeof decision.allowed !== 'boolean') throw new Error('BILLING_ACCESS_INVALID_RESPONSE');
  return decision;
}
export function showBillingRequired(): void {
  window.location.replace('/regularizacao?acesso=pendente');
}
