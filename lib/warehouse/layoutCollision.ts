import type { WarehouseDepotLayoutObject } from './layout';

/**
 * Duas estruturas fisicas nao podem ocupar a mesma area da planta (cm).
 * Portas, paredes, corredores e zonas de desenho nao reservam superficie.
 * Um item legado OTHER com warehouseLocationId tambem e considerado fisico.
 */
export type WarehouseFloorRect = Pick<
  WarehouseDepotLayoutObject, 'id' | 'kind' | 'warehouseLocationId' |
    'x' | 'y' | 'width' | 'height'
> & Partial<Pick<WarehouseDepotLayoutObject,'visualVariant'>>;
const PHYSICAL_KINDS = new Set<string>([
  'SHELF', 'RACK', 'CABINET', 'CHAMBER', 'FREEZER',
  'REFRIGERATOR', 'PALLET', 'BENCH',
]);
export function warehouseIsPhysicalLocal(object: WarehouseFloorRect): boolean {
  return object.warehouseLocationId !== null || PHYSICAL_KINDS.has(object.kind)
    || (object.kind === 'OTHER' && object.visualVariant === 'solid');
}
export function warehouseFloorRectsOverlap(
  left: Pick<WarehouseFloorRect, 'x' | 'y' | 'width' | 'height'>,
  right: Pick<WarehouseFloorRect, 'x' | 'y' | 'width' | 'height'>
): boolean {
  const values = [left.x, left.y, left.width, left.height,
    right.x, right.y, right.width, right.height];
  if (values.some(value => !Number.isFinite(value)) ||
    left.width <= 0 || left.height <= 0 || right.width <= 0 || right.height <= 0) return false;
  // Faces encostadas, sem intersecao positiva, sao permitidas.
  const epsilon = 0.000001;
  return left.x < right.x + right.width - epsilon &&
    left.x + left.width > right.x + epsilon &&
    left.y < right.y + right.height - epsilon &&
    left.y + left.height > right.y + epsilon;
}
export function warehouseLocalHasCollision(
  candidate: WarehouseFloorRect,
  objects: readonly WarehouseFloorRect[]
): boolean {
  return warehouseIsPhysicalLocal(candidate) && objects.some(other =>
    other.id !== candidate.id && warehouseIsPhysicalLocal(other) &&
    warehouseFloorRectsOverlap(candidate, other)
  );
}
export function warehouseFindOverlappingLocals(
  objects: readonly WarehouseFloorRect[]
): Array<{ firstId: string; secondId: string }> {
  const physical = objects.filter(warehouseIsPhysicalLocal);
  const overlaps: Array<{ firstId: string; secondId: string }> = [];
  for (let i = 0; i < physical.length; i++) {
    for (let j = i + 1; j < physical.length; j++) {
      if (physical[i].id !== physical[j].id &&
        warehouseFloorRectsOverlap(physical[i], physical[j])) {
        overlaps.push({ firstId: physical[i].id, secondId: physical[j].id });
      }
    }
  }
  return overlaps;
}

/** Busca posicao livre perto da origem, sem leitura remota nem loop ilimitado. */
export function warehouseFindFreePosition(
  template: WarehouseFloorRect,
  objects: readonly WarehouseFloorRect[],
  logicalWidth: number,
  logicalHeight: number,
  origin: { x: number; y: number } = { x: template.x, y: template.y }
): { x: number; y: number } | null {
  const maxX = logicalWidth - template.width;
  const maxY = logicalHeight - template.height;
  if (!Number.isFinite(maxX) || !Number.isFinite(maxY) || maxX < 0 || maxY < 0) return null;
  const usable = objects.filter(object =>
    object.id !== template.id && warehouseIsPhysicalLocal(object));
  const anchor = (value: number, max: number) =>
    Math.max(0, Math.min(max, Math.round(value * 100) / 100));
  const xValues = new Set<number>([0, anchor(origin.x, maxX), anchor(maxX, maxX)]);
  const yValues = new Set<number>([0, anchor(origin.y, maxY), anchor(maxY, maxY)]);
  for (const object of usable) {
    for (const x of [object.x + object.width, object.x - template.width, object.x]) {
      xValues.add(anchor(x, maxX));
    }
    for (const y of [object.y + object.height, object.y - template.height, object.y]) {
      yValues.add(anchor(y, maxY));
    }
  }
  const xs = [...xValues].sort((a, b) =>
    Math.abs(a - origin.x) - Math.abs(b - origin.x) || a - b);
  const ys = [...yValues].sort((a, b) =>
    Math.abs(a - origin.y) - Math.abs(b - origin.y) || a - b);
  const best = { x: anchor(origin.x, maxX), y: anchor(origin.y, maxY) };
  if (!warehouseLocalHasCollision({ ...template, ...best }, usable)) return best;
  // Combina bordas e corredores livres antes de desistir; limitado para UI responsiva.
  let attempts = 0;
  for (const x of xs) {
    for (const y of ys) {
      if (++attempts > 25000) return null;
      if (!warehouseLocalHasCollision({ ...template, x, y }, usable)) return { x, y };
    }
  }
  return null;
}
