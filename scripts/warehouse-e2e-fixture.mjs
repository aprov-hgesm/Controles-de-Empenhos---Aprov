#!/usr/bin/env node

const PROJECT_ID = 'demo-emprovex-security';
const DATABASE_ID = 'emprovex-warehouse';
const FIRESTORE_BASE =
  `http://127.0.0.1:8080/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents`;

const WORKSPACE_ID = 'hgesm-aprov';
const UG = '160416';
const MATERIAL_ID = 'mat_123e4567e89b12d3a456426614174000';
const DEPOT_ID = 'dep_' + '6'.repeat(32);
const LOCATION_ID = 'loc_' + '6'.repeat(32);
const SUBPOSITION_ID = 'sub_' + '6'.repeat(32);
const MOVEMENT_ID = 'mov_' + '7'.repeat(64);
const UNASSIGNED_BALANCE_ID =
  'locbal_1f4db6d13593019e244c182002ecfbbb2764d28ce246c65fa31daa5bcb60c43f';
const LOCATION_BALANCE_ID =
  'locbal_44d9ac45e4e3ccec26b4bd88bb4d76964dbeb04f4716483f486329c99e96d722';
const LAYOUT_ID = 'lay_' + '1'.repeat(32);
const ACTOR_UID = 'warehouse-e2e-fixture';

function encodeValue(value) {
  if (value === null) return { nullValue: null };
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') {
    return Number.isInteger(value)
      ? { integerValue: String(value) }
      : { doubleValue: value };
  }
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(encodeValue) } };
  }
  if (typeof value === 'object') {
    return { mapValue: { fields: encodeFields(value) } };
  }
  throw new Error('Tipo Firestore não suportado: ' + typeof value);
}

function encodeFields(record) {
  return Object.fromEntries(
    Object.entries(record)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, encodeValue(value)])
  );
}

async function ownerSet(path, data) {
  const encodedPath = path.split('/').map(encodeURIComponent).join('/');
  const response = await fetch(`${FIRESTORE_BASE}/${encodedPath}`, {
    method: 'PATCH',
    headers: {
      Authorization: 'Bearer owner',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields: encodeFields(data) }),
  });

  if (!response.ok) {
    throw new Error(
      `Seed warehouse falhou em ${path} (${response.status}): ${await response.text()}`
    );
  }
}

const timestamp = new Date('2026-09-29T12:00:00.000Z');

await ownerSet(`warehouse/${WORKSPACE_ID}/materials/${MATERIAL_ID}`, {
  schemaVersion: 'warehouse_material_v1',
  id: MATERIAL_ID,
  workspaceId: WORKSPACE_ID,
  ug: UG,
  description: 'Arroz parboilizado',
  aliases: ['Arroz beneficiado'],
  unit: { code: 'kg', label: null },
  status: 'active',
  conversions: [
    { presentation: { code: 'g', label: null }, factorToBaseUnit: 0.001 },
    { presentation: { code: 'box', label: 'Caixa 30 kg' }, factorToBaseUnit: 30 },
  ],
});

await ownerSet(`warehouse/${WORKSPACE_ID}/depots/${DEPOT_ID}`, {
  schemaVersion: 'warehouse_depot_v1',
  id: DEPOT_ID,
  workspaceId: WORKSPACE_ID,
  ug: UG,
  code: 'DEP-06',
  name: 'Depósito FASE 6 renomeado',
  description: 'Estrutura física operacional E2E',
  visualType: 'CONTAINER',
  sizeProfile: 'MEDIUM',
  status: 'active',
  createdBy: ACTOR_UID,
  updatedBy: ACTOR_UID,
  createdAt: timestamp,
  updatedAt: timestamp,
});

await ownerSet(`warehouse/${WORKSPACE_ID}/locations/${LOCATION_ID}`, {
  schemaVersion: 'warehouse_location_v1',
  id: LOCATION_ID,
  workspaceId: WORKSPACE_ID,
  ug: UG,
  depotId: DEPOT_ID,
  kind: 'LOCAL',
  parentLocationId: null,
  code: 'LOC-06',
  name: 'Local FASE 6',
  description: null,
  status: 'active',
  createdBy: ACTOR_UID,
  updatedBy: ACTOR_UID,
  createdAt: timestamp,
  updatedAt: timestamp,
});

await ownerSet(`warehouse/${WORKSPACE_ID}/locations/${SUBPOSITION_ID}`, {
  schemaVersion: 'warehouse_location_v1',
  id: SUBPOSITION_ID,
  workspaceId: WORKSPACE_ID,
  ug: UG,
  depotId: DEPOT_ID,
  kind: 'SUBPOSITION',
  parentLocationId: LOCATION_ID,
  code: 'SUB-06',
  name: 'Subposição FASE 6',
  description: null,
  status: 'active',
  createdBy: ACTOR_UID,
  updatedBy: ACTOR_UID,
  createdAt: timestamp,
  updatedAt: timestamp,
});

await ownerSet(`warehouse/${WORKSPACE_ID}/movements/${MOVEMENT_ID}`, {
  schemaVersion: 'warehouse_movement_v1',
  id: MOVEMENT_ID,
  workspaceId: WORKSPACE_ID,
  ug: UG,
  materialId: MATERIAL_ID,
  type: 'TRANSFER',
  quantityDelta: 0,
  idempotencyKeyHash: '7'.repeat(64),
  reversesMovementId: null,
  note: 'Fixture física inicial do Browser E2E',
  source: {
    kind: 'LOCATION_TRANSFER',
    actorUid: ACTOR_UID,
    quantity: 3,
    from: { kind: 'UNASSIGNED' },
    to: {
      kind: 'LOCATION',
      depotId: DEPOT_ID,
      locationId: LOCATION_ID,
      subpositionId: null,
    },
    fromBalanceId: UNASSIGNED_BALANCE_ID,
    toBalanceId: LOCATION_BALANCE_ID,
  },
  createdAt: timestamp,
});

await ownerSet(`warehouse/${WORKSPACE_ID}/balances/${MATERIAL_ID}`, {
  schemaVersion: 'warehouse_balance_v1',
  workspaceId: WORKSPACE_ID,
  ug: UG,
  materialId: MATERIAL_ID,
  quantity: 8,
  revision: 3,
  lastMovementId: MOVEMENT_ID,
  updatedAt: timestamp,
});

await ownerSet(
  `warehouse/${WORKSPACE_ID}/locationBalances/${UNASSIGNED_BALANCE_ID}`,
  {
    schemaVersion: 'warehouse_location_balance_v1',
    id: UNASSIGNED_BALANCE_ID,
    workspaceId: WORKSPACE_ID,
    ug: UG,
    materialId: MATERIAL_ID,
    position: { kind: 'UNASSIGNED' },
    quantity: 5,
    revision: 1,
    lastMovementId: MOVEMENT_ID,
    updatedAt: timestamp,
  }
);

await ownerSet(
  `warehouse/${WORKSPACE_ID}/locationBalances/${LOCATION_BALANCE_ID}`,
  {
    schemaVersion: 'warehouse_location_balance_v1',
    id: LOCATION_BALANCE_ID,
    workspaceId: WORKSPACE_ID,
    ug: UG,
    materialId: MATERIAL_ID,
    position: {
      kind: 'LOCATION',
      depotId: DEPOT_ID,
      locationId: LOCATION_ID,
      subpositionId: null,
    },
    quantity: 3,
    revision: 1,
    lastMovementId: MOVEMENT_ID,
    updatedAt: timestamp,
  }
);

await ownerSet(`warehouse/${WORKSPACE_ID}/layouts/${LAYOUT_ID}`, {
  schemaVersion: 'warehouse_depot_layout_v1',
  id: LAYOUT_ID,
  workspaceId: WORKSPACE_ID,
  ug: UG,
  name: 'Croqui principal FASE 9',
  depotId: DEPOT_ID,
  logicalWidth: 1000,
  logicalHeight: 620,
  objects: [
    {
      id: 'obj_' + '9'.repeat(32),
      kind: 'SHELF',
      label: 'Estante FASE 9',
      x: 32,
      y: 40,
      width: 180,
      height: 80,
      rotation: 0,
      layer: 1,
      elevation: 1,
      visualVariant: 'solid',
      warehouseLocationId: LOCATION_ID,
    },
  ],
  version: 1,
  status: 'active',
  previousVersionId: null,
  createdBy: ACTOR_UID,
  updatedBy: ACTOR_UID,
  createdAt: timestamp,
  updatedAt: timestamp,
});

await ownerSet(`warehouse/${WORKSPACE_ID}/settings/logistics-alerts`, {
  schemaVersion: 'warehouse_logistics_alert_settings_v1',
  workspaceId: WORKSPACE_ID,
  ug: UG,
  lowStockThreshold: null,
  updatedBy: ACTOR_UID,
  updatedAt: timestamp,
});

console.log('WAREHOUSE BROWSER E2E FIXTURE: READY');
