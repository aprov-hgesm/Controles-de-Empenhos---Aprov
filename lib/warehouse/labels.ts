import type { WarehouseDepot, WarehouseLocation } from './location';
import {
  encodeWarehouseCompactLocationBarcode,
  encodeWarehouseLocationBarcode,
  tryEncodeWarehouseNumericLocationBarcode,
} from './locationBarcode';

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
  physicalBarcode: string;
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
  widthMm?: number;
  heightMm?: number;
}

export const WAREHOUSE_LABEL_PRESETS: Record<WarehouseLabelSheetPreset, WarehouseLabelLayoutPreset> = {
  COMPACT: {
    id: 'COMPACT',
    label: 'Compacta',
    description: '8 por folha · 14 × 3,5 cm · prateleiras e nichos',
    columns: 1,
    rows: 8,
    perPage: 8,
    gapMm: 0.5,
    marginMm: 6.75,
    widthMm: 140,
    heightMm: 35,
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

// Texto físico de identificação: não depende de leitor de código de barras.
 // Na subposição, códigos repetidos em estantes distintas precisam explicitar o caminho.
export function warehouseLabelReadablePath(item: WarehouseLabelItem): string {
  if (item.kind === 'SUBPOSITION') {
    return [item.code, item.parentCode ?? 'LOCAL NÃO IDENTIFICADO', item.depotCode].join(' - ');
  }
  if (item.kind === 'LOCAL') return [item.code, item.depotCode].join(' - ');
  return item.code;
}

// Ordem natural e estável: EST-2 antes de EST-10, PRAT-2 antes de PRAT-10.
const warehouseLabelCodeCollator = new Intl.Collator('pt-BR', {
  numeric: true,
  sensitivity: 'base',
});

function compareWarehouseLabelLocations(left: WarehouseLocation, right: WarehouseLocation): number {
  return warehouseLabelCodeCollator.compare(left.code, right.code)
    || warehouseLabelCodeCollator.compare(left.name, right.name)
    || left.id.localeCompare(right.id);
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
    physicalBarcode: tryEncodeWarehouseNumericLocationBarcode({
      kind: 'DEPOT',
      depotCode: depot.code,
    }) ?? encodeWarehouseCompactLocationBarcode({
      kind: 'DEPOT',
      depotCode: depot.code,
    }),
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
      physicalBarcode: tryEncodeWarehouseNumericLocationBarcode({
        kind: 'LOCAL',
        depotCode: depot.code,
        locationCode: location.code,
      }) ?? encodeWarehouseCompactLocationBarcode({
        kind: 'LOCAL',
        depotCode: depot.code,
        locationCode: location.code,
      }),
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
    physicalBarcode: parent
      ? (
          tryEncodeWarehouseNumericLocationBarcode({
            kind: 'SUBPOSITION',
            depotCode: depot.code,
            parentCode: parent.code,
            locationCode: location.code,
          }) ?? encodeWarehouseCompactLocationBarcode({
            kind: 'SUBPOSITION',
            depotCode: depot.code,
            parentCode: parent.code,
            locationCode: location.code,
          })
        )
      : encodeWarehouseLocationBarcode({
          kind: 'SUBPOSITION',
          entityId: location.id,
        }),
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
  if (input.depot.status !== 'active') return [];

  const active = input.locations.filter(
    (location) =>
      location.status === 'active'
      && location.depotId === input.depot.id
  );
  const locals = active
    .filter((location) => location.kind === 'LOCAL')
    .sort(compareWarehouseLabelLocations);
  const subpositions = active
    .filter((location) => location.kind === 'SUBPOSITION')
    .sort(compareWarehouseLabelLocations);
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
    // Etiquetas prontas para colagem em sequência: depósito, primeira estante,
    // suas prateleiras numeradas, próxima estante e assim por diante.
    const ordered: WarehouseLocation[] = [];
    const activeLocalIds = new Set(locals.map((location) => location.id));
    for (const local of locals) {
      ordered.push(local);
      ordered.push(...subpositions.filter((child) => child.parentLocationId === local.id));
    }
    // Preserva visibilidade de eventuais registros legados sem pai ativo.
    ordered.push(...subpositions.filter((child) => !child.parentLocationId
      || !activeLocalIds.has(child.parentLocationId)));
    return [
      buildDepotLabel(input.depot),
      ...ordered.map((location) => buildLocationLabel(location, input.depot, active)),
    ];
  }

  if (!selected) return [];

  if (input.scope === 'LOCATION_ONLY') {
    return [buildLocationLabel(selected, input.depot, active)];
  }

  if (selected.kind !== 'LOCAL') return [];
  return subpositions
    .filter((location) => location.parentLocationId === selected.id)
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
