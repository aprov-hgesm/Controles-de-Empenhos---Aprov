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
