import type { WarehouseIsoView } from './isometricCamera';

/**
 * Global X/Y are the footprint axes of the original persisted object.
 * The functional FRONT is always the longer horizontal edge of the fridge.
 * Never re-evaluate the rule using view-transformed dimensions.
 */
export type WarehouseApplianceFace = 'x+' | 'x-' | 'y+' | 'y-';
export type WarehouseApplianceAxis = 'x' | 'y';

export function warehouseApplianceFrontalAxis(width: number, depth: number): WarehouseApplianceAxis {
  return width >= depth ? 'y' : 'x';
}

export function warehouseCardinalRotation(rotation: number): 0 | 90 | 180 | -90 {
  const normalized = ((Math.round(rotation / 90) * 90) % 360 + 360) % 360;
  return normalized === 270 ? -90 : normalized as 0 | 90 | 180;
}

/**
 * Frente funcional do equipamento no plano 2D (y cresce para baixo).
 * O objeto possui dimensoes ja rotacionadas em quartos de volta; a rotacao
 * persistida guarda somente a direcao. Nao rotacionar sua caixa visual novamente.
 * Sem migracao: objetos antigos rotation=0 mantem a regra do lado maior.
 */
export function warehouseObjectPhysicalFront(
  width: number,
  depth: number,
  rotation = 0
): WarehouseApplianceFace {
  const angle = warehouseCardinalRotation(rotation);
  const odd = Math.abs(angle) === 90;
  const unrotatedWidth = odd ? depth : width;
  const unrotatedDepth = odd ? width : depth;
  const base: WarehouseApplianceFace =
    warehouseApplianceFrontalAxis(unrotatedWidth, unrotatedDepth) === 'y' ? 'y+' : 'x+';
  const clockwise: WarehouseApplianceFace[] = ['y+', 'x-', 'y-', 'x+'];
  const start = clockwise.indexOf(base);
  const quarter = (((angle / 90) % 4) + 4) % 4;
  return clockwise[(start + quarter) % 4];
}

export function warehouseOppositeFace(face: WarehouseApplianceFace): WarehouseApplianceFace {
  const opposite: Record<WarehouseApplianceFace, WarehouseApplianceFace> =
    {'x+':'x-','x-':'x+','y+':'y-','y-':'y+'};
  return opposite[face];
}

export function warehouseFaceLabel(face: WarehouseApplianceFace): string {
  return ({'x+':'Leste','x-':'Oeste','y+':'Sul','y-':'Norte'})[face];
}

/** Transformacao de normais a partir do mesmo sistema das quatro cameras. */
export function warehouseApplianceFrontForView(
  originalWidth: number,
  originalDepth: number,
  view: WarehouseIsoView,
  rotation = 0
): WarehouseApplianceFace {
  const face = warehouseObjectPhysicalFront(originalWidth, originalDepth, rotation);
  if (view === 'front') return face;
  const mapping: Record<WarehouseIsoView, Record<WarehouseApplianceFace, WarehouseApplianceFace>> = {
    front: {'x+':'x+','x-':'x-','y+':'y+','y-':'y-'},
    back: {'x+':'x-','x-':'x+','y+':'y-','y-':'y+'},
    right: {'x+':'y-','x-':'y+','y+':'x+','y-':'x-'},
    left: {'x+':'y+','x-':'y-','y+':'x-','y-':'x+'},
  };
  return mapping[view][face];
}

export function warehouseApplianceVisiblePanel(
  side: 'x+' | 'y+',
  front: WarehouseApplianceFace
): 'front' | 'rear' | 'side' {
  if (front === side) return 'front';
  if (front === (side === 'x+' ? 'x-' : 'y-')) return 'rear';
  return 'side';
}
