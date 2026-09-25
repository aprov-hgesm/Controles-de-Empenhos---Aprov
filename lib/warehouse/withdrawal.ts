import type { WarehouseMaterialUnit } from './material';
import type { WarehouseBarcodeAssociation } from './barcode';
import type { WarehouseStockPosition } from './location';

export const WAREHOUSE_DESTINATION_SCHEMA_VERSION = 'warehouse_destination_v1' as const;
export const WAREHOUSE_WITHDRAWAL_SCHEMA_VERSION = 'warehouse_material_withdrawal_v1' as const;
export const WAREHOUSE_CONSUMPTION_SCHEMA_VERSION = 'warehouse_consumption_record_v1' as const;
export const WAREHOUSE_WITHDRAWAL_MAX_LINES = 40;

export type WarehouseDestinationStatus = 'active' | 'inactive';
export type WarehouseWithdrawalStatus =
  | 'FINALIZING'
  | 'PARTIALLY_APPLIED'
  | 'FINALIZED';
export type WarehouseConsumptionOrigin =
  | 'STOCK_OUTBOUND'
  | 'IMMEDIATE_CONSUMPTION';
export type WarehouseSiscofisOperationalStatus =
  | 'PENDING'
  | 'PREPARED'
  | 'POSTED';

export interface WarehouseDestination {
  schemaVersion: typeof WAREHOUSE_DESTINATION_SCHEMA_VERSION;
  id: string;
  workspaceId: string;
  ug: string;
  name: string;
  status: WarehouseDestinationStatus;
  createdBy: string;
  updatedBy: string;
}

export interface WarehouseDestinationListItem {
  destination: WarehouseDestination;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface WarehouseMaterialWithdrawal {
  schemaVersion: typeof WAREHOUSE_WITHDRAWAL_SCHEMA_VERSION;
  id: string;
  workspaceId: string;
  ug: string;
  destinationId: string;
  destinationName: string;
  withdrawnBy: string;
  payloadHash: string;
  expectedLineCount: number;
  appliedLineCount: number;
  status: WarehouseWithdrawalStatus;
  createdBy: string;
  createdAt: string | null;
  updatedAt: string | null;
  finalizedAt: string | null;
}

export interface WarehouseWithdrawalLineInput {
  lineId: string;
  materialId: string;
  materialDescription: string;
  requestedQuantity: number;
  presentation: WarehouseMaterialUnit;
  presentationLabel: string;
  baseQuantity: number;
  unitLabel: string;
  position: WarehouseStockPosition;
  positionLabel: string;
  barcodeAssociation: WarehouseBarcodeAssociation | null;
  barcode: string | null;
  lotId: string | null;
  lotCode: string | null;
}

export interface WarehouseConsumptionRecord {
  schemaVersion: typeof WAREHOUSE_CONSUMPTION_SCHEMA_VERSION;
  id: string;
  workspaceId: string;
  ug: string;
  origin: WarehouseConsumptionOrigin;
  materialId: string;
  materialDescription: string;
  unitLabel: string;
  quantity: number;
  requestedQuantity: number;
  presentationLabel: string;
  destinationId: string;
  destinationName: string;
  withdrawnBy: string;
  operatorUid: string;
  movementId: string;
  withdrawalId: string | null;
  lineId: string | null;
  intakeId: string | null;
  invoiceRecordKey: string | null;
  barcode: string | null;
  lotCode: string | null;
  positionLabel: string;
  siscofisStatus: WarehouseSiscofisOperationalStatus;
  occurredAt: string | null;
  updatedAt: string | null;
  siscofisUpdatedBy: string | null;
  siscofisUpdatedAt: string | null;
  legacy: boolean;
}

export interface WarehouseConsumptionReportQuery {
  startAt: Date;
  endAt: Date;
  maxResults?: number;
  includeLegacy?: boolean;
}

export interface WarehouseConsumptionReportResult {
  records: WarehouseConsumptionRecord[];
  truncated: boolean;
  legacyCoverageLimited: boolean;
}

function compactText(value: string, max: number): string {
  return value.trim().replace(/\s+/g, ' ').slice(0, max);
}

export function normalizeWarehouseDestinationName(value: string): string {
  return compactText(value, 120);
}

export function normalizeWarehouseWithdrawnBy(value: string): string {
  return compactText(value, 160);
}

export function createWarehouseDestinationId(): string {
  return 'dest_' + crypto.randomUUID().replace(/-/g, '').slice(0, 32);
}

export function createWarehouseWithdrawalId(): string {
  return 'wd_' + crypto.randomUUID().replace(/-/g, '').slice(0, 32);
}

export function createWarehouseWithdrawalLineId(): string {
  return 'wline_' + crypto.randomUUID().replace(/-/g, '').slice(0, 32);
}

export function isWarehouseDestinationId(value: unknown): value is string {
  return typeof value === 'string' && /^dest_[a-f0-9]{32}$/.test(value);
}

export function isWarehouseWithdrawalId(value: unknown): value is string {
  return typeof value === 'string' && /^wd_[a-f0-9]{32}$/.test(value);
}

export function isWarehouseWithdrawalLineId(value: unknown): value is string {
  return typeof value === 'string' && /^wline_[a-f0-9]{32}$/.test(value);
}
