import { createHash } from 'node:crypto';

import { getGoogleAccessToken } from './sectorProvisioningAdmin';
import { warehouseAdminTransaction, WarehouseStoreError } from './warehouseFirestoreTransaction';
import type { VerifiedWarehouseRequest } from './warehouseAccess';
import { createWarehouseMaterial, validateWarehouseMaterial, type WarehouseMaterial } from '../warehouse/material';
import { warehouseUnitFromOperationalLabel } from '../warehouse/invoiceIntegration';
import {
  createWarehouseMovementId, applyWarehouseMovementToBalance,
  validateWarehouseBalance, validateWarehouseMovement, warehouseMovementMatchesReplay,
  WAREHOUSE_MOVEMENT_SCHEMA_VERSION, type WarehouseMovement, type WarehouseBalance,
} from '../warehouse/movement';
import {
  createWarehouseLocationBalanceId, applyWarehouseLocationDelta,
  validateWarehouseStockPosition, validateWarehouseLocationBalance,
  warehouseStockPositionKey, type WarehouseStockPosition, type WarehouseLocationBalance,
} from '../warehouse/location';
import {
  createWarehouseBarcodeId, normalizeWarehouseBarcode,
  validateWarehouseBarcodeAssociation, warehousePresentationFactor,
  barcodeAssociationMatchesMaterial, WAREHOUSE_BARCODE_SCHEMA_VERSION,
  type WarehouseBarcodeAssociation,
} from '../warehouse/barcode';
import { isWarehouseLocationBarcode } from '../warehouse/locationBarcode';
import {
  normalizeWarehouseExpiryDate, createWarehousePendingLotCode, normalizeWarehouseLotCode,
  validateWarehouseLot, WAREHOUSE_LOT_SCHEMA_VERSION, type WarehouseLot,
} from '../warehouse/lot';
import {
  warehouseCanonicalMaterialReadInput,
  warehouseCanonicalLocationBalanceReadInput,
  warehouseCanonicalBarcodeReadInput,
  warehouseCanonicalLotReadInput,
} from '../warehouse/readCompatibility';
import type {
  RegisterWarehouseManualEntryInput, RegisterWarehouseManualEntryResult,
} from '../warehouse/manualEntryRepository';

function bad(code: string, status = 400): never {
  throw new WarehouseStoreError(code, status);
}
function string(input: unknown, max: number, required = true): string {
  if (typeof input !== 'string') {
    if (!required && (input == null || input === '')) return '';
    return bad('WAREHOUSE_MANUAL_ENTRY_INVALID_INPUT');
  }
  const value = input.trim().replace(/\s+/g, ' ');
  if (value.length > max || (required && !value)) bad('WAREHOUSE_MANUAL_ENTRY_INVALID_INPUT');
  return value;
}
function digest(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}
function requireValid<T>(result: {ok: boolean;data?: T}, code: string): T {
  if (!result.ok || !result.data) bad(code, 409);
  return result.data;
}
function root(workspaceId: string, domain: string, id: string): string {
  return `warehouse/${workspaceId}/${domain}/${id}`;
}
function parse<T>(
  row: {data:Record<string,unknown>} | null | undefined,
  transform: (data: Record<string,unknown>) => {ok:boolean;data?:T},
  code: string
): T | null {
  if (!row) return null;
  return requireValid(transform(row.data), code);
}
function assertPosition(
  access: VerifiedWarehouseRequest, position: Exclude<WarehouseStockPosition, {kind:'UNASSIGNED'}>,
  depot: {data:Record<string,unknown>} | null | undefined,
  local: {data:Record<string,unknown>} | null | undefined,
  sub: {data:Record<string,unknown>} | null | undefined,
): void {
  if (!depot || !local
    || depot.data.status !== 'active' || local.data.status !== 'active'
    || depot.data.workspaceId !== access.workspaceId || local.data.workspaceId !== access.workspaceId
    || depot.data.ug !== access.ug || local.data.ug !== access.ug
    || depot.data.id !== position.depotId
    || local.data.id !== position.locationId
    || local.data.depotId !== position.depotId || local.data.kind !== 'LOCAL') {
    bad('WAREHOUSE_MANUAL_ENTRY_POSITION_REQUIRED', 409);
  }
  if (position.kind === 'SUBPOSITION' && (!sub
    || sub.data.id !== position.subpositionId
    || sub.data.workspaceId !== access.workspaceId || sub.data.ug !== access.ug
    || sub.data.status !== 'active' || sub.data.kind !== 'SUBPOSITION'
    || sub.data.parentLocationId !== position.locationId
    || sub.data.depotId !== position.depotId)) {
    bad('WAREHOUSE_MANUAL_ENTRY_POSITION_REQUIRED', 409);
  }
}

export async function registerWarehouseManualEntryServer(
  access: VerifiedWarehouseRequest,
  raw: unknown
): Promise<RegisterWarehouseManualEntryResult> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) bad('WAREHOUSE_MANUAL_ENTRY_INVALID_INPUT');
  const input = raw as Record<string, unknown>;
  const operationId = string(input.operationId, 96);
  if (!/^[a-zA-Z0-9_-]{8,96}$/.test(operationId)) bad('WAREHOUSE_MANUAL_ENTRY_INVALID_OPERATION_ID');
  const description = string(input.description, 240, false);
  const unitLabel = string(input.unitLabel, 80, false);
  const provenance = string(input.provenance, 180);
  const reference = string(input.reference, 160, false) || null;
  const quantity = Number(input.quantity);
  if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 1000000000
      || Math.abs(quantity - Math.round(quantity * 1000000) / 1000000) > 1e-9) {
    bad('WAREHOUSE_MANUAL_ENTRY_INVALID_QUANTITY');
  }
  const position = validateWarehouseStockPosition(input.position);
  if (!position || position.kind === 'UNASSIGNED') bad('WAREHOUSE_MANUAL_ENTRY_POSITION_REQUIRED');
  const expiry = normalizeWarehouseExpiryDate(input.expiresOn ?? null);
  if (expiry === undefined) bad('WAREHOUSE_MANUAL_ENTRY_INVALID_EXPIRY');
  const rawLotCode = string(input.lotCode, 80, false);
  const lotCode = rawLotCode ? normalizeWarehouseLotCode(rawLotCode) : null;
  if (rawLotCode && (!lotCode || lotCode.startsWith('__EMPROVEX_PENDING_LOT__:'))) {
    bad('WAREHOUSE_MANUAL_ENTRY_INVALID_LOT');
  }
  const barcode = string(input.barcode, 128, false);
  const normalizedBarcode = barcode ? normalizeWarehouseBarcode(barcode) : null;
  if (barcode && !normalizedBarcode) bad('WAREHOUSE_INVALID_BARCODE');
  if (normalizedBarcode && isWarehouseLocationBarcode(normalizedBarcode)) {
    bad('WAREHOUSE_BARCODE_RESERVED_LOCATION_NAMESPACE');
  }
  const existingId = string(input.existingMaterialId, 80, false).toLowerCase();
  if (existingId && !/^mat_[a-f0-9]{32}$/.test(existingId)) bad('WAREHOUSE_MANUAL_ENTRY_MATERIAL_NOT_FOUND', 404);
  if (!existingId && (!description || !unitLabel)) bad('WAREHOUSE_MANUAL_ENTRY_INVALID_DESCRIPTION');
  const materialId = existingId || 'mat_' + digest(
    [access.workspaceId, 'MANUAL_ENTRY_MATERIAL', operationId].join('\n')
  ).slice(0,32);
  const created = !existingId ? requireValid(
    createWarehouseMaterial({
      id: materialId, workspaceId: access.workspaceId, ug: access.ug,
      description, aliases: [], unit: warehouseUnitFromOperationalLabel(unitLabel),
      status: 'active', conversions: [],
    }), 'WAREHOUSE_MANUAL_ENTRY_MATERIAL_INVALID'
  ) : null;

  const movementId = await createWarehouseMovementId(
    access.workspaceId, ['manual-entry', operationId, 'ledger'].join(':')
  );
  const positionKey = warehouseStockPositionKey(position);
  const locationBalanceId = await createWarehouseLocationBalanceId(
    access.workspaceId, materialId, position
  );
  const intent = digest(JSON.stringify({
    workspaceId: access.workspaceId, ug: access.ug, actorUid: access.uid,
    materialId, description, unitLabel, quantity, provenance, reference,
    positionKey, expiry, lotCode, barcode: normalizedBarcode,
  })).slice(0, 16);
  const candidate = requireValid(validateWarehouseMovement({
    schemaVersion: WAREHOUSE_MOVEMENT_SCHEMA_VERSION,
    id: movementId, workspaceId: access.workspaceId, ug: access.ug,
    materialId, type: 'MANUAL_ENTRY', quantityDelta: quantity,
    idempotencyKeyHash: movementId.slice(4), reversesMovementId: null,
    note: `Entrada avulsa · ${provenance} · ${intent}`,
    source: {
      kind: 'MANUAL_ENTRY', actorUid: access.uid, provenance, reference,
      position, locationBalanceId,
    },
  }, {
    expectedWorkspaceId: access.workspaceId, expectedUg: access.ug,
    expectedMaterialId: materialId,
  }), 'WAREHOUSE_MANUAL_ENTRY_MOVEMENT_INVALID');

  const lotId = (expiry || lotCode)
    ? 'lot_' + digest([access.workspaceId, 'MANUAL_ENTRY_LOT', operationId].join('\n')).slice(0,32)
    : null;
  const barcodeId = normalizedBarcode ? await createWarehouseBarcodeId(access.workspaceId, normalizedBarcode) : null;
  const paths = {
    depot: root(access.workspaceId,'depots',position.depotId),
    local: root(access.workspaceId,'locations',position.locationId),
    sub: position.kind === 'SUBPOSITION' ? root(access.workspaceId,'locations',position.subpositionId) : null,
    material: root(access.workspaceId,'materials',materialId),
    movement: root(access.workspaceId,'movements',movementId),
    balance: root(access.workspaceId,'balances',materialId),
    located: root(access.workspaceId,'locationBalances',locationBalanceId),
    lot: lotId ? root(access.workspaceId,'lots',lotId) : null,
    barcode: barcodeId ? root(access.workspaceId,'barcodes',barcodeId) : null,
  };
  const reads = Object.values(paths).filter((p):p is string=>p!==null);
  // Credencial exclusivamente server-side. Um erro de configuração não gera fallback client-side.
  const token = process.env.EMPROVEX_WAREHOUSE_ADMIN_EMULATOR === '1'
    ? 'emulator'
    : await getGoogleAccessToken();
  return warehouseAdminTransaction<RegisterWarehouseManualEntryResult>(token, reads, (rows) => {
    const read = (path: string | null) => path ? rows.get(path) : null;
    assertPosition(access,position,read(paths.depot),read(paths.local),read(paths.sub));

    let material = parse(read(paths.material),
      data=>validateWarehouseMaterial(warehouseCanonicalMaterialReadInput(materialId,data),
        {expectedWorkspaceId:access.workspaceId,expectedUg:access.ug}),
      'WAREHOUSE_MANUAL_ENTRY_MATERIAL_INVALID');
    if (!material && !created) bad('WAREHOUSE_MANUAL_ENTRY_MATERIAL_NOT_FOUND',404);
    if (material && created && (material.description !== created.description
      || JSON.stringify(material.unit) !== JSON.stringify(created.unit))) {
      bad('WAREHOUSE_MANUAL_ENTRY_MATERIAL_CONFLICT',409);
    }
    const materialNew = !material;
    material = material || created;
    if (!material || material.status !== 'active' || material.ug !== access.ug) {
      bad('WAREHOUSE_MANUAL_ENTRY_MATERIAL_INACTIVE',409);
    }

    const prevBalance = parse(read(paths.balance),
      data=>validateWarehouseBalance({
        schemaVersion:data.schemaVersion,workspaceId:data.workspaceId,ug:data.ug,
        materialId:data.materialId,quantity:data.quantity,revision:data.revision,
        lastMovementId:data.lastMovementId,
      },{expectedWorkspaceId:access.workspaceId,expectedMaterialId:materialId}),
      'WAREHOUSE_MANUAL_ENTRY_BALANCE_INVALID');
    const prevLocation = parse(read(paths.located),
      data=>validateWarehouseLocationBalance(
        warehouseCanonicalLocationBalanceReadInput(locationBalanceId,data),
        {expectedWorkspaceId:access.workspaceId,expectedMaterialId:materialId}),
      'WAREHOUSE_MANUAL_ENTRY_LOCATION_BALANCE_INVALID');

    const oldMovement = parse(read(paths.movement),
      data=>validateWarehouseMovement({
        schemaVersion: data.schemaVersion,
        id:movementId, workspaceId:data.workspaceId, ug:data.ug,
        materialId:data.materialId, type:data.type, quantityDelta:data.quantityDelta,
        idempotencyKeyHash:data.idempotencyKeyHash,
        reversesMovementId:data.reversesMovementId ?? null,
        note:data.note ?? null, source:data.source ?? null,
      }, {expectedWorkspaceId:access.workspaceId}),
      'WAREHOUSE_MANUAL_ENTRY_MOVEMENT_INVALID');
    // Verifique primeiro o replay divergente: nenhuma validação auxiliar
    // de lote/barcode deve mascarar o conflito da operação principal.
    if (oldMovement && !warehouseMovementMatchesReplay(oldMovement,candidate)) {
      bad('WAREHOUSE_IDEMPOTENCY_CONFLICT',409);
    }
    const existingBarcode = barcodeId ? parse(read(paths.barcode),
      data=>validateWarehouseBarcodeAssociation(warehouseCanonicalBarcodeReadInput(barcodeId,data),
        {expectedWorkspaceId:access.workspaceId, expectedUg:access.ug}),
      'WAREHOUSE_MANUAL_ENTRY_BARCODE_INVALID') : null;
    if (existingBarcode && (
      existingBarcode.materialId !== materialId || existingBarcode.status !== 'active'
      || existingBarcode.barcode !== normalizedBarcode
      || existingBarcode.factorToBaseUnit !== 1
      || !barcodeAssociationMatchesMaterial(existingBarcode,material)
    )) bad('WAREHOUSE_BARCODE_ALREADY_LINKED',409);

    const existingLot = lotId ? parse(read(paths.lot),
      data=>validateWarehouseLot(warehouseCanonicalLotReadInput(lotId,data),
        {expectedWorkspaceId:access.workspaceId,expectedUg:access.ug}),
      'WAREHOUSE_MANUAL_ENTRY_LOT_INVALID') : null;

    const lot = lotId ? requireValid(validateWarehouseLot({
      schemaVersion:WAREHOUSE_LOT_SCHEMA_VERSION,
      id:lotId,workspaceId:access.workspaceId,ug:access.ug,materialId,
      code:lotCode || createWarehousePendingLotCode('manual-'+operationId),
      expiresOn:expiry, quantity, position,
      origin:{kind:'MANUAL_ENRICHMENT',movementId,invoiceRecordKey:null,
        invoiceId:null,supplier:null,supplierCnpj:null},
      status:'active',createdBy:access.uid,updatedBy:access.uid,
    },{expectedWorkspaceId:access.workspaceId,expectedUg:access.ug,expectedMaterialId:materialId}),
    'WAREHOUSE_MANUAL_ENTRY_LOT_INVALID') : null;
    if (existingLot && JSON.stringify(existingLot)!==JSON.stringify(lot)) {
      bad('WAREHOUSE_MANUAL_ENTRY_LOT_CONFLICT',409);
    }
    const candidateBarcode = barcodeId && normalizedBarcode && !existingBarcode
      ? requireValid(validateWarehouseBarcodeAssociation({
          schemaVersion:WAREHOUSE_BARCODE_SCHEMA_VERSION,id:barcodeId,
          workspaceId:access.workspaceId,ug:access.ug,materialId,
          barcode:normalizedBarcode,presentation:material.unit,
          factorToBaseUnit:warehousePresentationFactor(material,material.unit),
          status:'active',createdBy:access.uid,updatedBy:access.uid,
        },{expectedWorkspaceId:access.workspaceId,expectedUg:access.ug,
          expectedMaterialId:materialId}),'WAREHOUSE_MANUAL_ENTRY_BARCODE_INVALID')
      : null;

    if (oldMovement) {
      if (!warehouseMovementMatchesReplay(oldMovement,candidate)) {
        bad('WAREHOUSE_IDEMPOTENCY_CONFLICT',409);
      }
      if (!prevBalance || !prevLocation || materialNew || (lot && !existingLot)
        || candidateBarcode) bad('WAREHOUSE_MANUAL_ENTRY_PROJECTION_INCONSISTENT',409);
      return {result:{
        material, entry:{applied:false,movement:oldMovement,balance:prevBalance},
        transfer:null,locationBalance:prevLocation,validity:lot,
        barcodeLinked:Boolean(normalizedBarcode),warnings:[],
      },writes:[]};
    }

    if (existingLot) bad('WAREHOUSE_MANUAL_ENTRY_LOT_CONFLICT',409);
    if (prevLocation && warehouseStockPositionKey(prevLocation.position)!==positionKey) {
      bad('WAREHOUSE_MANUAL_ENTRY_POSITION_CONFLICT',409);
    }
    const balance = applyWarehouseMovementToBalance(candidate,prevBalance);
    const located = applyWarehouseLocationDelta(prevLocation,{
      id:locationBalanceId,workspaceId:access.workspaceId,ug:access.ug,
      materialId,position,quantityDelta:quantity,movementId,
    });
    const now = new Date();
    const writes:Array<{path:string;data:Record<string,unknown>}> = [];
    if (materialNew) writes.push({path:paths.material,data:material as unknown as Record<string,unknown>});
    writes.push(
      {path:paths.movement,data:{...candidate,createdAt:now}},
      {path:paths.balance,data:{...balance,updatedAt:now}},
      {path:paths.located,data:{...located,updatedAt:now}},
    );
    if (lot && paths.lot) writes.push({
      path:paths.lot,data:{...lot,createdAt:now,updatedAt:now},
    });
    if (candidateBarcode && paths.barcode) writes.push({
      path:paths.barcode,data:{...candidateBarcode,createdAt:now,updatedAt:now},
    });
    return {result:{
      material,entry:{applied:true,movement:candidate,balance},
      transfer:null,locationBalance:located,validity:lot,
      barcodeLinked:Boolean(normalizedBarcode),warnings:[],
    },writes};
  });
}
