import type { WarehouseDepot, WarehouseLocation, WarehouseLocationBalance } from './location';
import type { WarehouseMaterial } from './material';

export type GlobalMaterialPosition = {
  depotId: string;
  depotCode: string;
  depotName: string;
  locationId: string;
  locationCode: string;
  locationName: string;
  subpositionId: string | null;
  subpositionCode: string | null;
  subpositionName: string | null;
  quantity: number;
  unit: string;
};

export type GlobalMaterialResult = {
  materialId: string;
  description: string;
  positions: GlobalMaterialPosition[];
  depotCount: number;
};

function normalizeSearchText(value: string): string {
  return value.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .trim();
}

/**
 * Índice apenas de leitura de materiais alocados em TODOS os depósitos do
 * workspace. O saldo físico por posição é a única autoridade de quantidade.
 * Não soma quantidades de materiais diferentes nem unidades distintas.
 */
export function findWarehouseMaterialsAcrossDepots(input: {
  query: string;
  depots: WarehouseDepot[];
  locations: WarehouseLocation[];
  balances: WarehouseLocationBalance[];
  materials: WarehouseMaterial[];
  maxMaterials?: number;
}): GlobalMaterialResult[] {
  const query = normalizeSearchText(input.query);
  if (!query) return [];

  const depotById = new Map(
    input.depots.filter((depot) => depot.status === 'active').map((depot) => [depot.id, depot])
  );
  const locationById = new Map(
    input.locations.filter((location) => location.status === 'active')
      .map((location) => [location.id, location])
  );
  const materials = new Map(
    input.materials.filter((material) => material.status === 'active')
      .map((material) => [material.id, material])
  );
  const grouped = new Map<string, GlobalMaterialResult>();

  for (const balance of input.balances) {
    if (balance.quantity <= 0 || balance.position.kind === 'UNASSIGNED') continue;
    const material = materials.get(balance.materialId);
    if (!material || !normalizeSearchText(
      [material.id, material.description, ...material.aliases].join(' ')
    ).includes(query)) continue;

    const position = balance.position;
    const depot = depotById.get(position.depotId);
    const location = locationById.get(position.locationId);
    if (
      !depot || !location || location.kind !== 'LOCAL'
      || location.depotId !== depot.id
    ) continue;

    const subposition = position.kind === 'SUBPOSITION'
      ? locationById.get(position.subpositionId)
      : null;
    if (
      position.kind === 'SUBPOSITION'
      && (
        !subposition || subposition.kind !== 'SUBPOSITION'
        || subposition.depotId !== depot.id
        || subposition.parentLocationId !== location.id
      )
    ) continue;

    let result = grouped.get(material.id);
    if (!result) {
      result = { materialId: material.id, description: material.description, positions: [], depotCount: 0 };
      grouped.set(material.id, result);
    }
    result.positions.push({
      depotId: depot.id,
      depotCode: depot.code,
      depotName: depot.name,
      locationId: location.id,
      locationCode: location.code,
      locationName: location.name,
      subpositionId: subposition?.id || null,
      subpositionCode: subposition?.code || null,
      subpositionName: subposition?.name || null,
      quantity: balance.quantity,
      unit: material.unit.label || material.unit.code.toUpperCase(),
    });
  }

  const matches = [...grouped.values()];
  for (const match of matches) {
    match.depotCount = new Set(match.positions.map((item) => item.depotId)).size;
    match.positions.sort((a, b) =>
      a.depotName.localeCompare(b.depotName, 'pt-BR', { numeric: true })
      || a.locationCode.localeCompare(b.locationCode, 'pt-BR', { numeric: true })
      || (a.subpositionCode || '').localeCompare(b.subpositionCode || '', 'pt-BR', { numeric: true })
    );
  }
  matches.sort((a, b) =>
    a.description.localeCompare(b.description, 'pt-BR', { numeric: true })
  );

  return matches.slice(0, Math.max(1, input.maxMaterials ?? 8));
}
