/**
 * Fixtures totalmente sintéticas para o laboratório de 20 m × 6 m.
 * Não importa Firebase, SDK, repositórios ou ações de gravação.
 */
import type { WarehouseDepotLayoutObject } from './layout';
import type { WarehouseLocation, WarehouseLocationBalance } from './location';
import type { WarehouseMaterial } from './material';

export const DEMO_20X6_WIDTH_CM = 2000;
export const DEMO_20X6_DEPTH_CM = 600;
export const DEMO_20X6_DEPOT_ID = 'dep_' + 'd'.repeat(32);
const WORKSPACE = 'workspace-demo-3d';
const UG = '000001';

export type Demo20x6Scenario = 'simple' | 'dense';

type FixtureKind = 'SHELF' | 'PALLET' | 'FREEZER' | 'REFRIGERATOR' | 'BENCH';
type FixtureSlot = {
  code: string;
  kind: FixtureKind;
  x: number;
  y: number;
  width: number;
  height: number;
  simple: boolean;
};
type Demo20x6Fixture = {
  objects: WarehouseDepotLayoutObject[];
  locations: WarehouseLocation[];
  materials: WarehouseMaterial[];
  balances: WarehouseLocationBalance[];
};

const hexId = (prefix: string, number: number) =>
  prefix + number.toString(16).padStart(32, '0');

const slots: FixtureSlot[] = [
  ...Array.from({ length: 10 }, (_, i): FixtureSlot => ({
    code: 'EST-' + String(i + 1).padStart(2, '0'), kind: 'SHELF',
    x: 65 + i * 182, y: 55, width: 130, height: 70,
    simple: [0, 3, 6, 9].includes(i),
  })),
  ...Array.from({ length: 8 }, (_, i): FixtureSlot => ({
    code: 'EST-' + String(i + 11).padStart(2, '0'), kind: 'SHELF',
    x: 75 + i * 198, y: 260, width: 148, height: 78,
    simple: i === 1 || i === 5,
  })),
  ...Array.from({ length: 6 }, (_, i): FixtureSlot => ({
    code: 'PAL-' + String(i + 1).padStart(2, '0'), kind: 'PALLET',
    x: 80 + i * 245, y: 448, width: 145, height: 95,
    simple: i === 1,
  })),
  { code: 'GEL-01', kind: 'REFRIGERATOR', x: 1680, y: 200, width: 125, height: 85, simple: true },
  { code: 'GEL-02', kind: 'REFRIGERATOR', x: 1835, y: 205, width: 105, height: 80, simple: false },
  { code: 'FRZ-01', kind: 'FREEZER', x: 1680, y: 335, width: 125, height: 82, simple: false },
  { code: 'FRZ-02', kind: 'FREEZER', x: 1835, y: 335, width: 105, height: 82, simple: false },
  { code: 'BAN-01', kind: 'BENCH', x: 1500, y: 448, width: 140, height: 90, simple: true },
  { code: 'BAN-02', kind: 'BENCH', x: 1680, y: 460, width: 145, height: 82, simple: false },
];

const material = (n: number, description: string): WarehouseMaterial => ({
  schemaVersion: 'warehouse_material_v1',
  id: hexId('mat_', n), workspaceId: WORKSPACE, ug: UG,
  description, aliases: [], status: 'active', conversions: [],
  unit: { code: 'unit', label: 'UN' },
});

const MATERIALS: WarehouseMaterial[] = [
  material(1, 'Gêneros alimentícios (fictício)'),
  material(2, 'Material de limpeza (fictício)'),
  material(3, 'Suprimentos diversos (fictício)'),
];

function local(
  id: string, code: string, kind: WarehouseLocation['kind'],
  parentLocationId: string | null
): WarehouseLocation {
  return {
    schemaVersion: 'warehouse_location_v1',
    id, workspaceId: WORKSPACE, ug: UG,
    depotId: DEMO_20X6_DEPOT_ID, kind, parentLocationId, code,
    name: kind === 'SUBPOSITION' ? 'Prateleira ' + code : code,
    description: null, status: 'active',
    createdBy: 'demo-only', updatedBy: 'demo-only',
  };
}

function makeScenario(includeAll: boolean): Demo20x6Fixture {
  const objects: WarehouseDepotLayoutObject[] = [];
  const locations: WarehouseLocation[] = [];
  const balances: WarehouseLocationBalance[] = [];

  slots.forEach((slot, slotIndex) => {
    if (!includeAll && !slot.simple) return;
    const index = slotIndex + 1;
    const locationId = hexId('loc_', index);
    const subpositionIds: string[] = [];
    locations.push(local(locationId, slot.code, 'LOCAL', null));

    if (slot.kind === 'SHELF') {
      for (let level = 1; level <= 4; level += 1) {
        const subId = hexId('sub_', index * 10 + level);
        subpositionIds.push(subId);
        locations.push(local(subId, 'P' + level, 'SUBPOSITION', locationId));
      }
    }

    objects.push({
      id: hexId('obj_', index),
      kind: slot.kind, label: slot.code,
      x: slot.x, y: slot.y, width: slot.width, height: slot.height,
      rotation: 0, layer: 1, elevation: 1,
      visualVariant: 'solid', warehouseLocationId: locationId,
    });

    // Ocupação fictícia para visualizar caixas e busca por materiais.
    // Alguns locais continuam vazios de propósito.
    if (index % 4 !== 0) {
      const materialId = MATERIALS[index % MATERIALS.length].id;
      const subpositionId = subpositionIds.length
        ? subpositionIds[index % subpositionIds.length] : null;
      balances.push({
        schemaVersion: 'warehouse_location_balance_v1',
        id: 'locbal_' + index.toString(16).padStart(64, '0'),
        workspaceId: WORKSPACE, ug: UG,
        materialId,
        position: subpositionId
          ? { kind: 'SUBPOSITION', depotId: DEMO_20X6_DEPOT_ID, locationId, subpositionId }
          : { kind: 'LOCATION', depotId: DEMO_20X6_DEPOT_ID, locationId, subpositionId: null },
        quantity: index % 5 + 6,
        revision: 1, lastMovementId: 'mov_' + 'a'.repeat(64),
      });
    }
  });

  return { objects, locations, materials: MATERIALS, balances };
}

export const WAREHOUSE_20X6_SCENARIOS: Record<Demo20x6Scenario, Demo20x6Fixture> = {
  simple: makeScenario(false),
  dense: makeScenario(true),
};
