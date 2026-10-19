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

export function warehouseApplianceFrontForView(
  originalWidth: number,
  originalDepth: number,
  view: WarehouseIsoView
): WarehouseApplianceFace {
  const axis = warehouseApplianceFrontalAxis(originalWidth, originalDepth);
  // Right view: x'=y, y'=W-x. Left view: x'=H-y, y'=x.
  // Reapply these directional rotations to the physical door normal.
  if (axis === 'y') {
    switch (view) {
      case 'front': return 'y+';
      case 'right': return 'x+';
      case 'back': return 'y-';
      case 'left': return 'x-';
    }
  }
  switch (view) {
    case 'front': return 'x+';
    case 'right': return 'y-';
    case 'back': return 'x-';
    case 'left': return 'y+';
  }
}

export function warehouseApplianceVisiblePanel(
  side: 'x+' | 'y+',
  front: WarehouseApplianceFace
): 'front' | 'rear' | 'side' {
  if (front === side) return 'front';
  if (front === (side === 'x+' ? 'x-' : 'y-')) return 'rear';
  return 'side';
}
