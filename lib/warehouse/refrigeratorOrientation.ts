import type { WarehouseIsoView } from './isometricCamera';

/**
 * A porta da geladeira fica na face de maior comprimento da planta.
 * O croqui persiste o retângulo original (largura X, profundidade Y).
 * As vistas direita/esquerda trocam os eixos para apresentação, sem
 * girar ou sobrescrever a posição/medidas salvas no Firestore.
 *
 * Retorna true se a frente física original é +X (face lateral).
 * Em medidas iguais, a convenção histórica (+Y) é preservada.
 */
export function warehouseRefrigeratorFrontOnOriginalSide(
  projectedWidth: number,
  projectedDepth: number,
  view: WarehouseIsoView
): boolean {
  const quarterTurn = view === 'right' || view === 'left';
  const originalWidth = quarterTurn ? projectedDepth : projectedWidth;
  const originalDepth = quarterTurn ? projectedWidth : projectedDepth;
  return originalDepth > originalWidth;
}
