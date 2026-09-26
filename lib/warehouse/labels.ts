import type { WarehouseDepot, WarehouseLocation } from './location';

export type WarehouseLabelKind = 'DEPOT' | 'LOCAL' | 'SUBPOSITION';
export type WarehouseLabelSheetPreset = 'COMPACT' | 'MEDIUM' | 'LARGE';

export interface WarehouseLabelItem {
  id: string;
  kind: WarehouseLabelKind;
  code: string;
  name: string;
  depotCode: string;
  depotName: string;
  parentCode: string | null;
  parentName: string | null;
  hierarchy: string[];
  workspaceId: string;
  ug: string;
}

export interface WarehouseLabelLayoutPreset {
  id: WarehouseLabelSheetPreset;
  label: string;
  description: string;
  columns: number;
  rows: number;
  perPage: number;
  gapMm: number;
  marginMm: number;
}

export const WAREHOUSE_LABEL_PRESETS: Record<WarehouseLabelSheetPreset, WarehouseLabelLayoutPreset> = {
  COMPACT: {
    id: 'COMPACT',
    label: 'Compacta',
    description: '21 por folha · ideal para prateleiras e nichos',
    columns: 3,
    rows: 7,
    perPage: 21,
    gapMm: 3,
    marginMm: 8,
  },
  MEDIUM: {
    id: 'MEDIUM',
    label: 'Média',
    description: '12 por folha · uso geral em estantes e locais',
    columns: 2,
    rows: 6,
    perPage: 12,
    gapMm: 4,
    marginMm: 9,
  },
  LARGE: {
    id: 'LARGE',
    label: 'Grande',
    description: '8 por folha · depósitos, freezers e paletes',
    columns: 2,
    rows: 4,
    perPage: 8,
    gapMm: 5,
    marginMm: 10,
  },
};

export function warehouseLabelKindLabel(kind: WarehouseLabelKind): string {
  if (kind === 'DEPOT') return 'DEPÓSITO';
  if (kind === 'LOCAL') return 'LOCAL';
  return 'SUBPOSIÇÃO';
}

export function buildDepotLabel(depot: WarehouseDepot): WarehouseLabelItem {
  return {
    id: depot.id,
    kind: 'DEPOT',
    code: depot.code,
    name: depot.name,
    depotCode: depot.code,
    depotName: depot.name,
    parentCode: null,
    parentName: null,
    hierarchy: [depot.name],
    workspaceId: depot.workspaceId,
    ug: depot.ug,
  };
}

export function buildLocationLabel(
  location: WarehouseLocation,
  depot: WarehouseDepot,
  allLocations: WarehouseLocation[]
): WarehouseLabelItem {
  if (location.kind === 'LOCAL') {
    return {
      id: location.id,
      kind: 'LOCAL',
      code: location.code,
      name: location.name,
      depotCode: depot.code,
      depotName: depot.name,
      parentCode: depot.code,
      parentName: depot.name,
      hierarchy: [depot.name, location.name],
      workspaceId: location.workspaceId,
      ug: location.ug,
    };
  }

  const parent = allLocations.find(
    (candidate) =>
      candidate.id === location.parentLocationId
      && candidate.kind === 'LOCAL'
      && candidate.depotId === location.depotId
  );

  return {
    id: location.id,
    kind: 'SUBPOSITION',
    code: location.code,
    name: location.name,
    depotCode: depot.code,
    depotName: depot.name,
    parentCode: parent?.code ?? null,
    parentName: parent?.name ?? null,
    hierarchy: [depot.name, parent?.name ?? 'Local', location.name],
    workspaceId: location.workspaceId,
    ug: location.ug,
  };
}

export function buildWarehouseLabelsForScope(input: {
  depot: WarehouseDepot;
  locations: WarehouseLocation[];
  selectedLocationId?: string | null;
  scope:
    | 'DEPOT_ONLY'
    | 'DEPOT_LOCALS'
    | 'DEPOT_FULL'
    | 'LOCATION_ONLY'
    | 'LOCATION_SUBPOSITIONS';
}): WarehouseLabelItem[] {
  const active = input.locations.filter(
    (location) =>
      location.status === 'active'
      && location.depotId === input.depot.id
  );
  const locals = active.filter((location) => location.kind === 'LOCAL');
  const selected = input.selectedLocationId
    ? active.find((location) => location.id === input.selectedLocationId) ?? null
    : null;

  if (input.scope === 'DEPOT_ONLY') {
    return [buildDepotLabel(input.depot)];
  }

  if (input.scope === 'DEPOT_LOCALS') {
    return locals.map((location) => buildLocationLabel(location, input.depot, active));
  }

  if (input.scope === 'DEPOT_FULL') {
    return [
      buildDepotLabel(input.depot),
      ...active.map((location) => buildLocationLabel(location, input.depot, active)),
    ];
  }

  if (!selected) return [];

  if (input.scope === 'LOCATION_ONLY') {
    return [buildLocationLabel(selected, input.depot, active)];
  }

  if (selected.kind !== 'LOCAL') return [];
  return active
    .filter(
      (location) =>
        location.kind === 'SUBPOSITION'
        && location.parentLocationId === selected.id
    )
    .map((location) => buildLocationLabel(location, input.depot, active));
}

export function paginateWarehouseLabels<T>(
  items: T[],
  preset: WarehouseLabelSheetPreset
): T[][] {
  const perPage = WAREHOUSE_LABEL_PRESETS[preset].perPage;
  if (items.length === 0) return [];

  const pages: T[][] = [];
  for (let index = 0; index < items.length; index += perPage) {
    pages.push(items.slice(index, index + perPage));
  }
  return pages;
}
