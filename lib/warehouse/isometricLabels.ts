/**
 * Distribuicao deterministica das etiquetas na planta isometrica.
 * Apenas apresentacao. Nenhuma leitura/escrita de dominio.
 * Em cenas densas um codigo pode ser omitido; o local permanece acessivel
 * por cursor, teclado, busca e painel de informacoes.
 */
export type WarehouseIsoLabelVariant = 'standard' | 'compact';

export interface WarehouseIsoLabelCandidate {
  id: string;
  x: number;
  y: number;
  highlighted: boolean;
  priority?: number;
  code?: string;
}

export interface WarehouseIsoLabelPlacement {
  offsetX: number;
  offsetY: number;
  bounds: { x: number; y: number; width: number; height: number };
}

export function warehouseIsoLabelText(code: string, variant: WarehouseIsoLabelVariant): string {
  return variant === 'compact' && code.length > 7 ? code.slice(0, 6) + '…' : code;
}

export function warehouseIsoLabelSize(
  highlighted: boolean,
  variant: WarehouseIsoLabelVariant = 'standard'
): { width: number; height: number; fontSize: number } {
  if (variant === 'compact') {
    return highlighted
      ? { width: 52, height: 18, fontSize: 9 }
      : { width: 42, height: 16, fontSize: 7.8 };
  }
  return highlighted
    ? { width: 72, height: 24, fontSize: 10.5 }
    : { width: 58, height: 20, fontSize: 9.2 };
}

export function layoutWarehouseIsoLabels(
  labels: readonly WarehouseIsoLabelCandidate[],
  options: { variant?: WarehouseIsoLabelVariant; avoidOtherAnchors?: boolean } = {}
): Map<string, WarehouseIsoLabelPlacement> {
  const variant = options.variant || 'standard';
  const placements = new Map<string, WarehouseIsoLabelPlacement>();
  const reserved: WarehouseIsoLabelPlacement['bounds'][] = [];
  const ordered = labels.slice().sort((a, b) =>
    (b.priority || 0) - (a.priority || 0)
      || a.y - b.y || a.x - b.x || a.id.localeCompare(b.id)
  );
  // O modo compacto tenta mais posicoes, mas nenhuma muito distante do local.
  // Assim os codigos continuam reconheciveis mesmo em depositos longos.
  const offsets: ReadonlyArray<readonly [number, number]> = variant === 'compact'
    ? [
      [0, -4], [0, -25], [-30, -4], [30, -4],
      [-33, -24], [33, -24], [0, 16], [-32, 14], [32, 14],
    ]
    : [
      [0, -5], [-49, -5], [49, -5], [0, -32],
      [-42, -32], [42, -32], [0, 18],
    ];

  for (const label of ordered) {
    if (!Number.isFinite(label.x) || !Number.isFinite(label.y)) continue;
    const { width, height } = warehouseIsoLabelSize(label.highlighted, variant);
    for (const [offsetX, offsetY] of offsets) {
      const rect = {
        x: label.x + offsetX - width / 2,
        y: label.y + offsetY - height - 9,
        width, height,
      };
      const gapX = variant === 'compact' ? 3 : 5;
      const gapY = variant === 'compact' ? 3 : 4;
      const overlapsLabel = reserved.some((other) =>
        rect.x < other.x + other.width + gapX
        && rect.x + rect.width + gapX > other.x
        && rect.y < other.y + other.height + gapY
        && rect.y + rect.height + gapY > other.y
      );
      if (overlapsLabel) continue;
      // Nao cobrir o centro projetado de outro equipamento na vista atual.
      // Checagem de ancoras, sem custo com detecao poligonal no render.
      if (options.avoidOtherAnchors && labels.some((other) =>
        other.id !== label.id
        && Number.isFinite(other.x) && Number.isFinite(other.y)
        && other.x >= rect.x - 5 && other.x <= rect.x + rect.width + 5
        && other.y >= rect.y - 5 && other.y <= rect.y + rect.height + 5
      )) continue;
      placements.set(label.id, { offsetX, offsetY, bounds: rect });
      reserved.push(rect);
      break;
    }
    // Prioridade de leitura, sem nunca encobrir um segundo cartao.
  }
  return placements;
}
