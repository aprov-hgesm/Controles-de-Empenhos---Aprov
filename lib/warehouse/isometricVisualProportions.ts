/**
 * Dimensoes apenas VISUAIS expressas em centimetros.
 * O croqui 2D (x, y, largura e profundidade) permanece a fonte de verdade.
 * Nao interpretar caixas ilustrativas como quantidade/volume real de estoque.
 */
export interface IsoVisualCartonMetrics {
  width: number;
  depth: number;
  height: number;
}

/** Caixas em coordenadas fisicas: cabem sempre em uma celula (u/v = 0,32/0,68). */
export function warehouseIsoCartonMetrics(
  footprintWidth: number,
  footprintDepth: number,
  scale = 1
): IsoVisualCartonMetrics {
  const factor = Number.isFinite(scale) ? Math.max(0.3, Math.min(1, scale)) : 1;
  const width = Math.max(0, Math.min(30, footprintWidth * 0.24) * factor);
  const depth = Math.max(0, Math.min(26, footprintDepth * 0.24) * factor);
  // Limita pilhas a duas camadas proporcionais, sem caixas gigantes em racks estreitos.
  const height = Math.min(14, width * 0.76, depth * 0.82);
  return { width, depth, height: Math.max(0, height) };
}

/**
 * Espessuras puramente decorativas (SVG), com ajuste à escala projetada da
 * estrutura, e não apenas ao tamanho do viewport. Não altera área útil.
 */
export function warehouseIsoDetailScale(
  footprintWidth: number,
  footprintDepth: number,
  logicalWidth: number,
  logicalDepth: number
): number {
  const base = Math.max(1, logicalWidth, logicalDepth);
  const footprint = Math.max(0, footprintWidth, footprintDepth);
  const projectedExtent = footprint / base * 470;
  return Math.min(1, Math.max(0.42, projectedExtent / 44));
}
