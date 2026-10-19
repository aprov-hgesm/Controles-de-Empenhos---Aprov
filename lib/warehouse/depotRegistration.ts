/**
 * Canonical physical catalog: five models, variable dimensions per unit.
 * Geometry is in centimeters; code prefixes match 13-digit barcode families.
 */
export type DepotUnitKind = 'SHELF' | 'REFRIGERATOR' | 'FREEZER' | 'PALLET' | 'BENCH';
export type ShelfStyle = 'METAL' | 'INOX' | 'WOOD';
export interface DepotUnit {
  kind: DepotUnitKind;
  widthCm: number;
  depthCm: number;
  heightCm: number;
  shelfCount: number;
  shelfStyle: ShelfStyle;
}
export interface DepotDraft {
  code: string;
  name: string;
  description: string;
  lengthCm: number;
  widthCm: number;
  units: DepotUnit[];
}
export interface PlannedDepotUnit extends DepotUnit {
  code: string;
  name: string;
  description: string;
  x: number;
  y: number;
}
export const DEPOT_KINDS = [
  { kind: 'SHELF', label: 'Estantes', singular: 'Estante', prefix: 'EST', width: 180, depth: 50, height: 200 },
  { kind: 'REFRIGERATOR', label: 'Geladeiras industriais de inox', singular: 'Geladeira industrial inox', prefix: 'GEL', width: 90, depth: 75, height: 200 },
  { kind: 'FREEZER', label: 'Freezers horizontais', singular: 'Freezer horizontal', prefix: 'FRZ', width: 140, depth: 75, height: 90 },
  { kind: 'PALLET', label: 'Paletes', singular: 'Palete', prefix: 'PAL', width: 120, depth: 100, height: 15 },
  { kind: 'BENCH', label: 'Mesas', singular: 'Mesa', prefix: 'MES', width: 180, depth: 70, height: 80 },
] as const;
export const DEPOT_MAX_UNITS = 120;
export const DEPOT_MAX_POSITIONS = 400;
export function defaultDepotUnit(kind: DepotUnitKind): DepotUnit {
  const model = DEPOT_KINDS.find((entry) => entry.kind === kind);
  if (!model) throw new Error('Tipo de local não permitido.');
  return { kind, widthCm: model.width, depthCm: model.depth, heightCm: model.height, shelfCount: 0, shelfStyle: 'METAL' };
}
export function setDepotUnitCount(units: DepotUnit[], kind: DepotUnitKind, count: number): DepotUnit[] {
  if (!Number.isSafeInteger(count) || count < 0 || count > DEPOT_MAX_UNITS) {
    throw new Error('Quantidade inválida de locais.');
  }
  const prior = units.filter((unit) => unit.kind === kind);
  const next = prior.slice(0, count);
  while (next.length < count) next.push(defaultDepotUnit(kind));
  return DEPOT_KINDS.flatMap((model) => model.kind === kind ? next : units.filter((unit) => unit.kind === model.kind));
}
export function planDepotDraft(draft: DepotDraft): PlannedDepotUnit[] {
  if (![draft.lengthCm, draft.widthCm].every((cm) => Number.isInteger(cm) && cm >= 240 && cm <= 50000)) {
    throw new Error('Medidas internas do depósito: 240 a 50.000 cm.');
  }
  if (!/^[A-Z0-9][A-Z0-9._-]{1,31}$/.test(draft.code.trim().toUpperCase())) throw new Error('Código do depósito inválido.');
  if (draft.name.trim().length < 2 || draft.name.trim().length > 120) throw new Error('Nome do depósito: 2 a 120 caracteres.');
  if (draft.description.trim().length > 240) throw new Error('Descrição do depósito acima de 240 caracteres.');
  if (draft.units.length === 0 || draft.units.length > DEPOT_MAX_UNITS) throw new Error('Informe de 1 a 120 locais por depósito.');
  if (draft.units.reduce((n, unit) => n + unit.shelfCount + 1, 0) > DEPOT_MAX_POSITIONS) {
    throw new Error('Limite de 400 posições. Reduza os locais/prateleiras.');
  }
  const counters: Record<DepotUnitKind, number> = { SHELF: 0, REFRIGERATOR: 0, FREEZER: 0, PALLET: 0, BENCH: 0 };
  let x = 20, y = 20, rowDepth = 0;
  return draft.units.map((unit) => {
    const model = DEPOT_KINDS.find((entry) => entry.kind === unit.kind);
    if (!model) throw new Error('Tipo de local inválido.');
    if (![unit.widthCm, unit.depthCm, unit.heightCm].every((cm) => Number.isInteger(cm) && cm >= 12 && cm <= 50000)) {
      throw new Error('Todas as dimensões individuais devem ser inteiras em cm (mínimo 12).');
    }
    if (!Number.isInteger(unit.shelfCount) || unit.shelfCount < 0 || unit.shelfCount > 30) {
      throw new Error('Cada estante pode possuir de 0 a 30 prateleiras.');
    }
    if (unit.kind !== 'SHELF' && unit.shelfCount !== 0) throw new Error('Apenas estantes possuem subposições.');
    if (unit.widthCm > draft.widthCm - 40 || unit.depthCm > draft.lengthCm - 40) {
      throw new Error('Um local supera as medidas internas do depósito.');
    }
    if (x + unit.widthCm + 20 > draft.widthCm) { x = 20; y += rowDepth + 20; rowDepth = 0; }
    if (y + unit.depthCm + 20 > draft.lengthCm) {
      throw new Error('As estruturas não cabem na disposição inicial. Amplie o depósito ou ajuste dimensões.');
    }
    const seq = String(++counters[unit.kind]).padStart(2, '0');
    const description = [
      model.singular,
      'largura: ' + unit.widthCm + ' cm',
      'profundidade: ' + unit.depthCm + ' cm',
      'altura: ' + unit.heightCm + ' cm',
      ...(unit.kind === 'SHELF' ? ['material: ' + unit.shelfStyle] : []),
    ].join(' | ');
    const result = { ...unit, code: model.prefix + '-' + seq, name: model.singular + ' ' + seq, description, x, y };
    x += unit.widthCm + 20;
    rowDepth = Math.max(rowDepth, unit.depthCm);
    return result;
  });
}
