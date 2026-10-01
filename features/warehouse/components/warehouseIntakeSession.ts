export type WarehouseIntakeBulkMode = 'storage' | 'immediate' | 'remove';

export interface WarehouseInvoiceDefaultDestination {
  depotId: string;
  locationId: string;
  subpositionId: string;
}

function allocationOperationStorageKey(
  workspaceId: string,
  intakeId: string
): string {
  return ['emprovex', 'warehouse', 'intake-allocation', workspaceId, intakeId].join(':');
}

export function getOrCreateWarehouseAllocationOperationId(
  workspaceId: string,
  intakeId: string
): string {
  const key = allocationOperationStorageKey(workspaceId, intakeId);
  const existing = window.sessionStorage.getItem(key);
  if (existing) return existing;
  const created = window.crypto.randomUUID();
  window.sessionStorage.setItem(key, created);
  return created;
}

export function clearWarehouseAllocationOperationId(
  workspaceId: string,
  intakeId: string
): void {
  window.sessionStorage.removeItem(
    allocationOperationStorageKey(workspaceId, intakeId)
  );
}

function invoiceDestinationStorageKey(
  workspaceId: string,
  invoiceRecordKey: string
): string {
  return ['emprovex', 'warehouse', 'invoice-destination', workspaceId, invoiceRecordKey].join(':');
}

export function readWarehouseInvoiceDefaultDestination(
  workspaceId: string,
  invoiceRecordKey: string
): WarehouseInvoiceDefaultDestination {
  try {
    const raw = window.sessionStorage.getItem(
      invoiceDestinationStorageKey(workspaceId, invoiceRecordKey)
    );
    if (!raw) return { depotId: '', locationId: '', subpositionId: '' };
    const parsed = JSON.parse(raw) as Partial<WarehouseInvoiceDefaultDestination>;
    return {
      depotId: typeof parsed.depotId === 'string' ? parsed.depotId : '',
      locationId: typeof parsed.locationId === 'string' ? parsed.locationId : '',
      subpositionId: typeof parsed.subpositionId === 'string' ? parsed.subpositionId : '',
    };
  } catch {
    return { depotId: '', locationId: '', subpositionId: '' };
  }
}

export function saveWarehouseInvoiceDefaultDestination(
  workspaceId: string,
  invoiceRecordKey: string,
  destination: WarehouseInvoiceDefaultDestination
): void {
  window.sessionStorage.setItem(
    invoiceDestinationStorageKey(workspaceId, invoiceRecordKey),
    JSON.stringify(destination)
  );
}

function bulkOperationStorageKey(
  workspaceId: string,
  subjectKey: string,
  mode: WarehouseIntakeBulkMode,
  intakeId: string
): string {
  return [
    'emprovex',
    'warehouse',
    'intake-bulk',
    workspaceId,
    subjectKey,
    mode,
    intakeId,
  ].join(':');
}

export function getOrCreateWarehouseBulkOperationId(
  workspaceId: string,
  subjectKey: string,
  mode: WarehouseIntakeBulkMode,
  intakeId: string
): string {
  const key = bulkOperationStorageKey(
    workspaceId,
    subjectKey,
    mode,
    intakeId
  );
  const existing = window.sessionStorage.getItem(key);
  if (existing) return existing;
  const created = window.crypto.randomUUID();
  window.sessionStorage.setItem(key, created);
  return created;
}

export function clearWarehouseBulkOperationId(
  workspaceId: string,
  subjectKey: string,
  mode: WarehouseIntakeBulkMode,
  intakeId: string
): void {
  window.sessionStorage.removeItem(
    bulkOperationStorageKey(
      workspaceId,
      subjectKey,
      mode,
      intakeId
    )
  );
}
