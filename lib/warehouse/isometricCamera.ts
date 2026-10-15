/**
 * Enquadramento visual da prévia isométrica. Apenas geometria de apresentação:
 * não altera planta, posição física, saldos ou persistência.
 */
export interface WarehouseIsoPoint {
  x: number;
  y: number;
}

export interface WarehouseIsoFrame {
  width: number;
  height: number;
  padding: number;
  maxZoom: number;
}

export interface WarehouseIsoViewBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Centraliza os limites renderizados com a mesma proporção do viewport SVG. */
export function fitWarehouseIsometricScene(
  points: readonly WarehouseIsoPoint[],
  frame: WarehouseIsoFrame
): WarehouseIsoViewBox {
  const fallback = { x: 0, y: 0, width: frame.width, height: frame.height };
  if (!Number.isFinite(frame.width) || !Number.isFinite(frame.height)
    || frame.width <= 0 || frame.height <= 0) return fallback;

  const finite = points.filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
  if (finite.length === 0) return fallback;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const point of finite) {
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minY = Math.min(minY, point.y);
    maxY = Math.max(maxY, point.y);
  }

  const spanX = Math.max(1, maxX - minX);
  const spanY = Math.max(1, maxY - minY);
  const padding = Math.max(0, Math.min(frame.padding, Math.min(frame.width, frame.height) * 0.3));
  const maxZoom = Number.isFinite(frame.maxZoom) && frame.maxZoom > 0 ? frame.maxZoom : 1;
  const zoom = Math.max(
    0.000001,
    Math.min(
      maxZoom,
      (frame.width - 2 * padding) / spanX,
      (frame.height - 2 * padding) / spanY
    )
  );

  const width = frame.width / zoom;
  const height = frame.height / zoom;
  return {
    x: (minX + maxX) / 2 - width / 2,
    y: (minY + maxY) / 2 - height / 2,
    width,
    height,
  };
}

/**
 * As vistas laterais trocam o comprimento e a profundidade do cômodo.
 * O mesmo eixo de escala física (max(W,H)) segue na projeção isométrica,
 * evitando que depósitos retangulares deformem pallets, locais e etiquetas.
 */
export type WarehouseIsoView = 'front' | 'right' | 'back' | 'left';

export interface WarehouseIsoRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function warehouseIsoRoomDimensions(
  logicalWidth: number,
  logicalHeight: number,
  view: WarehouseIsoView
): { width: number; height: number } {
  return view === 'right' || view === 'left'
    ? { width: logicalHeight, height: logicalWidth }
    : { width: logicalWidth, height: logicalHeight };
}

/**
 * Rotação geométrica de 0°, 90°, 180° ou 270°, sem normalização
 * independente dos eixos nem alteração dos vínculos persistidos.
 */
export function transformWarehouseIsoRectForView<T extends WarehouseIsoRect>(
  rect: T,
  logicalWidth: number,
  logicalHeight: number,
  view: WarehouseIsoView
): T {
  switch (view) {
    case 'front':
      return rect;
    case 'back':
      return { ...rect, x: logicalWidth - rect.x - rect.width, y: logicalHeight - rect.y - rect.height };
    case 'right':
      return {
        ...rect,
        x: rect.y,
        y: logicalWidth - rect.x - rect.width,
        width: rect.height,
        height: rect.width,
      };
    case 'left':
      return {
        ...rect,
        x: logicalHeight - rect.y - rect.height,
        y: rect.x,
        width: rect.height,
        height: rect.width,
      };
  }
}
