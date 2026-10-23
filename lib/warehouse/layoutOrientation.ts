import type { WarehouseDepotLayoutObject } from './layout';
import { warehouseCardinalRotation, warehouseObjectPhysicalFront, warehouseFaceLabel, warehouseOppositeFace, type WarehouseApplianceFace } from './applianceOrientation';

const clip = (value: number, lower: number, upper: number) => Math.min(upper, Math.max(lower, value));

/**
 * Rotacao ortogonal em planta, com ponto central e area em cm preservados.
 * A orientacao permanece gravada no campo rotation existente; a caixa 2D
 * continua alinhada aos eixos e NAO deve receber outra transformacao CSS.
 */
export function turnWarehouseLayoutObject(
  object: WarehouseDepotLayoutObject,
  quarters: number,
  logicalWidth: number,
  logicalHeight: number
): WarehouseDepotLayoutObject {
  if (!Number.isInteger(quarters) || Math.abs(quarters) !== 1)
    throw new Error('WAREHOUSE_ORIENTATION_TURN_INVALID');
  const newRotation = warehouseCardinalRotation(object.rotation + quarters * 90);
  const centerX = object.x + object.width / 2;
  const centerY = object.y + object.height / 2;
  const width = object.height;
  const height = object.width;
  if (width > logicalWidth || height > logicalHeight)
    throw new Error('WAREHOUSE_ORIENTATION_OUT_OF_BOUNDS');
  return {
    ...object, width, height, rotation: newRotation,
    x: clip(centerX - width / 2, 0, logicalWidth - width),
    y: clip(centerY - height / 2, 0, logicalHeight - height),
  };
}
export function warehouseObjectFaceLabels(object: Pick<WarehouseDepotLayoutObject, 'width'|'height'|'rotation'>): {
  front: WarehouseApplianceFace; back: WarehouseApplianceFace;
  right: WarehouseApplianceFace; left: WarehouseApplianceFace;
  frontLabel: string; backLabel: string; rightLabel: string; leftLabel: string;
} {
  const front = warehouseObjectPhysicalFront(object.width, object.height, object.rotation);
  const back = warehouseOppositeFace(front);
  // Para a pessoa olhando na mesma direcao que o equipamento, o lado direito
  // fica 90 graus no sentido anti-horario da normal da frente em tela.
  const rightFaces: Record<WarehouseApplianceFace, WarehouseApplianceFace> = {
    'y+':'x-','x-':'y-','y-':'x+','x+':'y+',
  };
  const right = rightFaces[front];
  const left = warehouseOppositeFace(right);
  return {front,back,right,left,
    frontLabel: warehouseFaceLabel(front),backLabel:warehouseFaceLabel(back),
    rightLabel:warehouseFaceLabel(right),leftLabel:warehouseFaceLabel(left)};
}
