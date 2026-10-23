/**
 * Distribuição determinística das etiquetas da planta isométrica.
 * Apenas apresentação: não muda locais, posições, saldos ou persistência.
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
  // Sempre priorizar a etiqueta do local selecionado ou inspecionado.
  const ordered = labels.slice().sort((a, b) =>
    (b.priority || 0) - (a.priority || 0)
      || a.y - b.y || a.x - b.x || a.id.localeCompare(b.id)
  );
  const offsets: ReadonlyArray<readonly [number, number]> = [
    [0, -10], [-76, -10], [76, -10], [0, -68],
    [-82, -62], [82, -62], [-152, -14], [152, -14],
    [-150, -82], [150, -82], [0, -132],
  ];
  for (const label of ordered) {
    if (!Number.isFinite(label.x) || !Number.isFinite(label.y)) continue;
    const width = label.highlighted ? 132 : 68;
    const height = label.highlighted ? 52 : 24;
    for (const [offsetX, offsetY] of offsets) {
      // O cartão começa 20 unidades acima do ponto ao qual a linha aponta.
      const rect = {
        x: label.x + offsetX - width / 2,
        y: label.y + offsetY - 20 - height,
        width,
        height,
      };
      // Distância visual mínima entre etiquetas para evitar blocos justapostos.
      const overlaps = reserved.some((other) =>
        rect.x < other.x + other.width + 7
        && rect.x + rect.width + 7 > other.x
        && rect.y < other.y + other.height + 6
        && rect.y + rect.height + 6 > other.y
      );
      if (overlaps) continue;
      placements.set(label.id, { offsetX, offsetY, bounds: rect });
      reserved.push(rect);
      break;
    }
    // Em cenas densas, algumas etiquetas são omitidas. Seus locais continuam
    // inteiramente clicáveis e consultáveis por hover/Tab/pesquisa.
  }
  return placements;
}
