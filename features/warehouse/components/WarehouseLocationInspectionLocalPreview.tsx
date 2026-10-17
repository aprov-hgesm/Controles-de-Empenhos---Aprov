'use client';

import { useState } from 'react';
import type { WarehouseDepotLayoutObject } from '../../../lib/warehouse/layout';
import type { WarehouseLocation, WarehouseLocationBalance } from '../../../lib/warehouse/location';
import type { WarehouseMaterial } from '../../../lib/warehouse/material';
import type { WarehouseLot } from '../../../lib/warehouse/lot';
import { WarehouseIsometricPreview } from './WarehouseIsometricPreview';

// Cenário fictício e somente local. Não lê, cria nem modifica dados reais.
const depotId = 'dep_' + 'a'.repeat(32);
const shelfId = 'loc_' + '1'.repeat(32);
const fridgeId = 'loc_' + '2'.repeat(32);
const palletId = 'loc_' + '3'.repeat(32);
const p1 = 'sub_' + '1'.repeat(32);
const p2 = 'sub_' + '2'.repeat(32);
const p3 = 'sub_' + '3'.repeat(32);
const matRice = 'mat_' + '1'.repeat(32);
const matMilk = 'mat_' + '2'.repeat(32);
const matOil = 'mat_' + '3'.repeat(32);

const loc = (
  id: string, code: string, name: string,
  kind: WarehouseLocation['kind'], parentLocationId: string | null
): WarehouseLocation => ({
  schemaVersion: 'warehouse_location_v1',
  id, workspaceId: 'workspace_demo', ug: '000001', depotId, kind,
  parentLocationId, code, name, description: null,
  status: 'active', createdBy: 'demo', updatedBy: 'demo',
});

const LOCATIONS: WarehouseLocation[] = [
  loc(shelfId, 'EST-01', 'Estante de gêneros', 'LOCAL', null),
  loc(fridgeId, 'GEL-01', 'Geladeira inox', 'LOCAL', null),
  loc(palletId, 'PLT-01', 'Palete de reserva', 'LOCAL', null),
  loc(p1, 'P1', 'Prateleira inferior', 'SUBPOSITION', shelfId),
  loc(p2, 'P2', 'Prateleira central', 'SUBPOSITION', shelfId),
  loc(p3, 'P3', 'Prateleira superior', 'SUBPOSITION', shelfId),
];

const objects: WarehouseDepotLayoutObject[] = [
  {
    id: 'obj_' + '1'.repeat(32), kind: 'SHELF', label: 'EST-01',
    x: 90, y: 105, width: 190, height: 80, rotation: 0, layer: 0,
    elevation: 0, visualVariant: 'solid', warehouseLocationId: shelfId,
  },
  {
    id: 'obj_' + '2'.repeat(32), kind: 'REFRIGERATOR', label: 'GEL-01',
    x: 365, y: 105, width: 155, height: 88, rotation: 0, layer: 0,
    elevation: 0, visualVariant: 'solid', warehouseLocationId: fridgeId,
  },
  {
    id: 'obj_' + '3'.repeat(32), kind: 'PALLET', label: 'PLT-01',
    x: 220, y: 280, width: 180, height: 110, rotation: 0, layer: 0,
    elevation: 0, visualVariant: 'solid', warehouseLocationId: palletId,
  },
];

function material(id: string, description: string, unit: string): WarehouseMaterial {
  return {
    schemaVersion: 'warehouse_material_v1',
    id, workspaceId: 'workspace_demo', ug: '000001',
    description, aliases: [], status: 'active', conversions: [],
    unit: { code: 'unit', label: unit },
  };
}

const MATERIALS: WarehouseMaterial[] = [
  material(matRice, 'Arroz branco tipo 1 · pacote 5 kg', 'PCT'),
  material(matMilk, 'Leite integral UHT · caixa 1 L', 'CX'),
  material(matOil, 'Óleo de soja · garrafa 900 ml', 'UN'),
];

function balance(materialId: string, locationId: string, quantity: number, subpositionId?: string): WarehouseLocationBalance {
  return {
    schemaVersion: 'warehouse_location_balance_v1',
    id: 'locbal_' + materialId.slice(-32) + String(quantity).padStart(32, '0'),
    workspaceId: 'workspace_demo', ug: '000001', materialId,
    position: subpositionId
      ? { kind: 'SUBPOSITION', depotId, locationId, subpositionId }
      : { kind: 'LOCATION', depotId, locationId, subpositionId: null },
    quantity, revision: 1, lastMovementId: 'mov_' + 'a'.repeat(64),
  };
}

const BALANCES: WarehouseLocationBalance[] = [
  balance(matRice, shelfId, 48, p1),
  balance(matOil, shelfId, 15, p2),
  balance(matMilk, shelfId, 24, p3),
  balance(matMilk, fridgeId, 12),
  balance(matRice, palletId, 35),
];

function lot(
  id: string, materialId: string, locationId: string,
  quantity: number, expiresOn: string | null, subpositionId?: string
): WarehouseLot {
  return {
    schemaVersion: 'warehouse_lot_v1', id, workspaceId: 'workspace_demo', ug: '000001',
    materialId, code: 'L-' + id.slice(-4), expiresOn, quantity,
    position: subpositionId
      ? { kind: 'SUBPOSITION', depotId, locationId, subpositionId }
      : { kind: 'LOCATION', depotId, locationId, subpositionId: null },
    origin: {
      kind: 'LEGACY', movementId: null, invoiceRecordKey: null, invoiceId: null,
      supplier: null, supplierCnpj: null,
    },
    status: 'active', createdBy: 'demo', updatedBy: 'demo',
  };
}

const LOTS: WarehouseLot[] = [
  lot('lot_' + '1'.repeat(32), matRice, shelfId, 20, '2027-03-12', p1),
  lot('lot_' + '2'.repeat(32), matRice, shelfId, 28, '2027-08-22', p1),
  lot('lot_' + '3'.repeat(32), matOil, shelfId, 15, '2027-01-20', p2),
  lot('lot_' + '4'.repeat(32), matMilk, shelfId, 24, '2026-12-01', p3),
  lot('lot_' + '5'.repeat(32), matMilk, fridgeId, 12, '2026-11-30'),
  lot('lot_' + '6'.repeat(32), matRice, palletId, 20, null),
];

export function WarehouseLocationInspectionLocalPreview() {
  const [queryText, setQueryText] = useState('');
  const [selectedMaterialId, setSelectedMaterialId] = useState('');
  const [inspected, setInspected] = useState(false);

  return (
    <div className="space-y-4" data-testid="warehouse-location-inspection-lab">
      <WarehouseIsometricPreview
        logicalWidth={720}
        logicalHeight={480}
        objects={objects}
        locations={LOCATIONS}
        balances={BALANCES}
        materials={MATERIALS}
        selectedMaterialId={selectedMaterialId}
        queryText={queryText}
        onQueryTextChange={setQueryText}
        onSelectedMaterialIdChange={setSelectedMaterialId}
        depotId={depotId}
        depotName="Depósito demonstrativo"
        inspectionLots={inspected ? LOTS : []}
        inspectionLotState={inspected ? 'ready' : 'idle'}
        inspectionAvailable
        inspectionComplete
        onInspectLocation={() => setInspected(true)}
        onRefreshInspection={() => setInspected(true)}
      />
      <p className="text-xs leading-5 text-slate-600">
        Passe o cursor na estante para consultar itens separados em P1, P2 e P3. Clique para
        conferir todos os lotes e gerar um PDF demonstrativo. A geladeira e o palete também
        são consultáveis. Nenhum dado real do EMPROVEX é acessado neste laboratório.
      </p>
    </div>
  );
}
