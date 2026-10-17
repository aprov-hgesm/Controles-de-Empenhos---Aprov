'use client';

import { useState } from 'react';
import type { WarehouseDepot, WarehouseLocation, WarehouseLocationBalance } from '../../../lib/warehouse/location';
import type { WarehouseDepotLayoutObject } from '../../../lib/warehouse/layout';
import type { WarehouseMaterial } from '../../../lib/warehouse/material';
import { WarehouseIsometricPreview } from './WarehouseIsometricPreview';

// Laboratório inteiramente fictício: nenhuma importação Firebase ou rede.
const ws = 'demo';
const ug = '000001';
const depot1 = 'dep_' + '1'.repeat(32);
const depot2 = 'dep_' + '2'.repeat(32);
const loc1 = 'loc_' + '1'.repeat(32);
const loc2 = 'loc_' + '2'.repeat(32);
const sub1 = 'sub_' + '1'.repeat(32);
const milkId = 'mat_' + '1'.repeat(32);
const riceId = 'mat_' + '2'.repeat(32);

const depots: WarehouseDepot[] = [
  {
    schemaVersion: 'warehouse_depot_v1', workspaceId: ws, ug,
    id: depot1, code: 'D01', name: 'Depósito Central',
    description: null, visualType: 'STANDARD', sizeProfile: 'MEDIUM',
    status: 'active', createdBy: 'demo', updatedBy: 'demo',
  },
  {
    schemaVersion: 'warehouse_depot_v1', workspaceId: ws, ug,
    id: depot2, code: 'D02', name: 'Depósito Reserva',
    description: null, visualType: 'STANDARD', sizeProfile: 'MEDIUM',
    status: 'active', createdBy: 'demo', updatedBy: 'demo',
  },
];

const loc = (
  id: string, depotId: string, code: string, name: string,
  kind: WarehouseLocation['kind'], parentLocationId: string | null
): WarehouseLocation => ({
  schemaVersion: 'warehouse_location_v1',
  id, workspaceId: ws, ug, depotId, code, name, kind,
  parentLocationId, description: null, status: 'active', createdBy: 'demo', updatedBy: 'demo',
});
const locations: WarehouseLocation[] = [
  loc(loc1, depot1, 'EST01', 'Estante de alimentos', 'LOCAL', null),
  loc(sub1, depot1, 'P01', 'Prateleira superior', 'SUBPOSITION', loc1),
  loc(loc2, depot2, 'EST03', 'Estante de reserva', 'LOCAL', null),
];

const material = (id: string, description: string): WarehouseMaterial => ({
  schemaVersion: 'warehouse_material_v1',
  id, workspaceId: ws, ug, description, aliases: [], status: 'active',
  unit: { code: 'unit', label: 'CX' }, conversions: [],
});
const materials: WarehouseMaterial[] = [
  material(milkId, 'Leite integral UHT · caixa 1 L'),
  material(riceId, 'Arroz branco tipo 1'),
];

const balance = (
  id: string, materialId: string, depotId: string, locationId: string,
  quantity: number, subpositionId?: string
): WarehouseLocationBalance => ({
  schemaVersion: 'warehouse_location_balance_v1',
  id, workspaceId: ws, ug, materialId, quantity, revision: 1,
  lastMovementId: 'mov_' + '3'.repeat(64),
  position: subpositionId
    ? { kind: 'SUBPOSITION', depotId, locationId, subpositionId }
    : { kind: 'LOCATION', depotId, locationId, subpositionId: null },
});
const balances: WarehouseLocationBalance[] = [
  balance('locbal_' + '1'.repeat(64), milkId, depot1, loc1, 12, sub1),
  balance('locbal_' + '2'.repeat(64), milkId, depot2, loc2, 7),
  balance('locbal_' + '3'.repeat(64), riceId, depot2, loc2, 19),
];

const objects: WarehouseDepotLayoutObject[] = [
  {
    id: 'obj_' + '1'.repeat(32), kind: 'SHELF', label: 'EST01',
    x: 130, y: 125, width: 200, height: 90, layer: 0, rotation: 0,
    elevation: 0, visualVariant: 'solid', warehouseLocationId: loc1,
  },
  {
    id: 'obj_' + '2'.repeat(32), kind: 'SHELF', label: 'EST03',
    x: 130, y: 125, width: 200, height: 90, layer: 0, rotation: 0,
    elevation: 0, visualVariant: 'solid', warehouseLocationId: loc2,
  },
];

export function WarehouseGlobalMaterialSearchLocalPreview() {
  const [depotId, setDepotId] = useState(depot1);
  const [query, setQuery] = useState('leite');
  const [materialId, setMaterialId] = useState('');
  const [focusedLocationId, setFocusedLocationId] = useState<string | null>(null);
  const depot = depots.find((item) => item.id === depotId)!;

  return (
    <div className="space-y-3" data-testid="warehouse-global-search-lab">
      <div className="rounded-xl border border-blue-100 bg-white p-3 text-xs font-bold text-slate-700">
        Depósito visualizado: {depot.code} · {depot.name}
      </div>
      <WarehouseIsometricPreview
        logicalWidth={720}
        logicalHeight={440}
        objects={objects.filter((object) => object.warehouseLocationId === (
          depotId === depot1 ? loc1 : loc2
        ))}
        locations={locations.filter((location) => location.depotId === depotId)}
        balances={balances.filter((item) =>
          item.position.kind !== 'UNASSIGNED' && item.position.depotId === depotId
        )}
        materials={materials}
        selectedMaterialId={materialId}
        queryText={query}
        onQueryTextChange={setQuery}
        onSelectedMaterialIdChange={setMaterialId}
        depotId={depotId}
        depotName={depot.name}
        globalDepots={depots}
        globalLocations={locations}
        globalBalances={balances}
        globalLoaded
        globalComplete
        focusedLocationId={focusedLocationId}
        onNavigateToGlobalLocation={(nextDepotId, nextLocationId) => {
          setDepotId(nextDepotId);
          setFocusedLocationId(nextLocationId);
        }}
      />
      <p className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600">
        Digite "leite". O mesmo material aparece na estante do Depósito Central
        e no Depósito Reserva, com quantidades diferentes. Clique em cada posição
        para trocar o depósito exibido e destacar o material encontrado.
        Esta demonstração não usa contas reais nem acessa o Firestore.
      </p>
    </div>
  );
}
