export interface WarehouseWithdrawalPersistedDraft<TLine> {
  withdrawalId: string;
  cart: TLine[];
  destinationId: string;
  withdrawnBy: string;
  retryRequired: boolean;
}

function draftStorageKey(workspaceId: string): string {
  return 'emprovex:warehouse:material-withdrawal:v1:' + workspaceId;
}

function recoveryStorageKey(workspaceId: string): string {
  return 'emprovex:warehouse:material-withdrawal:recovery:v1:' + workspaceId;
}

function parsePersistedDraft<TLine>(
  raw: string | null
): WarehouseWithdrawalPersistedDraft<TLine> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as WarehouseWithdrawalPersistedDraft<TLine>;
    if (
      !parsed
      || typeof parsed.withdrawalId !== 'string'
      || !Array.isArray(parsed.cart)
      || typeof parsed.destinationId !== 'string'
      || typeof parsed.withdrawnBy !== 'string'
      || typeof parsed.retryRequired !== 'boolean'
    ) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function readWarehouseWithdrawalDraft<TLine>(
  workspaceId: string
): WarehouseWithdrawalPersistedDraft<TLine> | null {
  if (typeof window === 'undefined') return null;
  const sessionDraft = parsePersistedDraft<TLine>(
    window.sessionStorage.getItem(draftStorageKey(workspaceId))
  );
  if (sessionDraft) return sessionDraft;

  const recoveryDraft = parsePersistedDraft<TLine>(
    window.localStorage.getItem(recoveryStorageKey(workspaceId))
  );
  return recoveryDraft
    ? { ...recoveryDraft, retryRequired: true }
    : null;
}

export function persistWarehouseWithdrawalDraft<TLine>(
  workspaceId: string,
  draft: WarehouseWithdrawalPersistedDraft<TLine>
): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(
    draftStorageKey(workspaceId),
    JSON.stringify(draft)
  );
}

export function clearWarehouseWithdrawalDraft(workspaceId: string): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(draftStorageKey(workspaceId));
}

export function persistWarehouseWithdrawalRecovery<TLine>(
  workspaceId: string,
  draft: WarehouseWithdrawalPersistedDraft<TLine>
): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(
    recoveryStorageKey(workspaceId),
    JSON.stringify({ ...draft, retryRequired: true })
  );
}

export function clearWarehouseWithdrawalRecovery(workspaceId: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(recoveryStorageKey(workspaceId));
}
