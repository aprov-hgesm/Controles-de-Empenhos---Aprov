export interface WarehouseWithdrawalPersistedDraft<TLine> {
  withdrawalId: string;
  cart: TLine[];
  destinationId: string;
  withdrawnBy: string;
  retryRequired: boolean;
  /** Liberacao local exibida somente apos resposta conclusiva do servidor. */
  safeRestartAvailable?: boolean;
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
      || (parsed.safeRestartAvailable !== undefined
        && typeof parsed.safeRestartAvailable !== 'boolean')
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
  const recoveryDraft = parsePersistedDraft<TLine>(
    window.localStorage.getItem(recoveryStorageKey(workspaceId))
  );
  if (sessionDraft) {
    // Uma resposta conclusiva de rejeicao pode ter sido salva no recovery
    // imediatamente antes do reload. Nunca herdar sinal de outra retirada.
    return recoveryDraft?.withdrawalId === sessionDraft.withdrawalId
      && recoveryDraft.safeRestartAvailable === true
      ? { ...sessionDraft, safeRestartAvailable: true }
      : sessionDraft;
  }
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
