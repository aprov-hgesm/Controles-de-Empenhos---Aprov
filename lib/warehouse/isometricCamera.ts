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

/**
 * Camera comum para as miniaturas do Início.
 *
 * Usa a projeção geométrica do croqui oficial, sem incluir etiquetas/objetos no
 * enquadramento. A compressão vertical ajusta somente a miniatura para os
 * 24° do plano do Ambiente Logístico; Meus Depósitos mantém a câmera original.
 * A âncora é o centro do piso, não o centro arbitrário do SVG.
 */
export const WAREHOUSE_LANDING_ISO = {
  sourceOriginX: 600,
  sourceOriginY: 160,
  sourceHalfWidth: 470,
  sourceHalfHeight: 245,
  worldSlope: 320 / 720,
  sceneWidthFactor: 1.32,
  sceneAspect: 0.72,
  wallAnchorOffset: 77,
} as const;

export interface WarehouseLandingIsoFrame {
  viewBox: WarehouseIsoViewBox;
  floorCenter: WarehouseIsoPoint;
  floorCorners: [WarehouseIsoPoint, WarehouseIsoPoint, WarehouseIsoPoint, WarehouseIsoPoint];
}

/** Quadro estável, independente de quantidade de itens, labels e ocupação. */
export function warehouseLandingIsoFrame(
  logicalWidth: number,
  logicalHeight: number
): WarehouseLandingIsoFrame {
  const width = Number.isFinite(logicalWidth) && logicalWidth > 0 ? logicalWidth : 1;
  const height = Number.isFinite(logicalHeight) && logicalHeight > 0 ? logicalHeight : 1;
  const denominator = Math.max(width, height);
  const {
    sourceOriginX, sourceOriginY, sourceHalfWidth, sourceHalfHeight,
    worldSlope, sceneWidthFactor, sceneAspect, wallAnchorOffset,
  } = WAREHOUSE_LANDING_ISO;
  const project = (x: number, y: number): WarehouseIsoPoint => ({
    x: sourceOriginX + (x - y) / denominator * sourceHalfWidth,
    y: sourceOriginY + (x + y) / denominator * sourceHalfHeight,
  });
  const floorCorners: WarehouseLandingIsoFrame['floorCorners'] = [
    project(0, 0), project(width, 0),
    project(width, height), project(0, height),
  ];
  const floorCenter = project(width / 2, height / 2);
  const floorSpan = sourceHalfWidth * (width + height) / denominator;
  const viewBoxWidth = floorSpan * sceneWidthFactor;
  const verticalCompression = worldSlope / (sourceHalfHeight / sourceHalfWidth);
  const viewBoxHeight = viewBoxWidth * sceneAspect / verticalCompression;

  return {
    floorCorners,
    floorCenter,
    viewBox: {
      x: floorCenter.x - viewBoxWidth / 2,
      y: floorCenter.y - wallAnchorOffset - viewBoxHeight / 2,
      width: viewBoxWidth,
      height: viewBoxHeight,
    },
  };
}

/**
 * Posiciona o croqui no mundo 3D sem distorcer suas medidas no eixo horizontal,
 * alinhando os quatro cantos do piso com a inclinação do tabuleiro externo.
 */
export function placeWarehouseLandingIsoFrame(
  frame: WarehouseLandingIsoFrame,
  center: WarehouseIsoPoint,
  floorSpan: number
): {
  x: number; y: number; width: number; height: number;
  floorCorners: WarehouseLandingIsoFrame['floorCorners'];
} {
  const safeSpan = Number.isFinite(floorSpan) && floorSpan > 0 ? floorSpan : 1;
  const width = safeSpan * WAREHOUSE_LANDING_ISO.sceneWidthFactor;
  const height = width * WAREHOUSE_LANDING_ISO.sceneAspect;
  const scaleX = width / frame.viewBox.width;
  const scaleY = height / frame.viewBox.height;
  const toWorld = (point: WarehouseIsoPoint): WarehouseIsoPoint => ({
    x: center.x + (point.x - frame.floorCenter.x) * scaleX,
    y: center.y + (point.y - frame.floorCenter.y) * scaleY,
  });
  return {
    x: center.x - (frame.floorCenter.x - frame.viewBox.x) * scaleX,
    y: center.y - (frame.floorCenter.y - frame.viewBox.y) * scaleY,
    width,
    height,
    floorCorners: frame.floorCorners.map(toWorld) as WarehouseLandingIsoFrame['floorCorners'],
  };
}
