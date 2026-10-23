/**
 * Distribuicao deterministica de etiquetas compactas da planta isometrica.
 * Somente apresentacao: nao altera locais, coordenadas, saldos ou persistencia.
 * Os candidatos que nao couberem sao consultaveis via hover/Tab/painel lateral.
 */
export interface WarehouseIsoLabelCandidate {
  id: string;
  x: number;
  y: number;
  highlighted: boolean;
  priority?: number;
}

export interface WarehouseIsoLabelPlacement {
  offsetX: number;
  offsetY: number;
  bounds: { x: number; y: number; width: number; height: number };
}

export function layoutWarehouseIsoLabels(
  labels: readonly WarehouseIsoLabelCandidate[]
): Map<string, WarehouseIsoLabelPlacement> {
  const placements = new Map<string, WarehouseIsoLabelPlacement>();
  const reserved: WarehouseIsoLabelPlacement['bounds'][] = [];
  const ordered = labels.slice().sort((a, b) =>
    (b.priority || 0) - (a.priority || 0)
      || a.y - b.y || a.x - b.x || a.id.localeCompare(b.id)
  );
  // Nao afastar os codigos do equipamento nem tracar conectores longos.
  const offsets: ReadonlyArray<readonly [number, number]> = [
    [0, -5], [-49, -5], [49, -5], [0, -32],
    [-42, -32], [42, -32], [0, 18],
  ];
  for (const label of ordered) {
    if (!Number.isFinite(label.x) || !Number.isFinite(label.y)) continue;
    const width = label.highlighted ? 72 : 58;
    const height = label.highlighted ? 24 : 20;
    for (const [offsetX, offsetY] of offsets) {
      const rect = {
        x: label.x + offsetX - width / 2,
        y: label.y + offsetY - height - 9,
        width, height,
      };
      const overlaps = reserved.some((other) =>
        rect.x < other.x + other.width + 5
        && rect.x + rect.width + 5 > other.x
        && rect.y < other.y + other.height + 4
        && rect.y + rect.height + 4 > other.y
      );
      if (overlaps) continue;
      placements.set(label.id, { offsetX, offsetY, bounds: rect });
      reserved.push(rect);
      break;
    }
  }
  return placements;
}
