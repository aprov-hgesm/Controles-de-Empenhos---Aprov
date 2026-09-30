import type { Item, CronogramaItemOverrides } from '../../../lib/types';

export function normalizeCronogramaItemNumber(value: unknown): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  return /^\d+$/.test(raw) ? raw.padStart(5, '0') : raw.slice(0, 40);
}

export function getDefaultCronogramaItemNumber(item: Item): string {
  if (item.itemCompraNumber) {
    return normalizeCronogramaItemNumber(item.itemCompraNumber);
  }
  const legacyId = String(item.id || '').trim();
  return /^\d+$/.test(legacyId)
    ? normalizeCronogramaItemNumber(legacyId)
    : '';
}

export function buildCronogramaItemOverrides(
  items: readonly Item[],
  saved?: CronogramaItemOverrides | null
): CronogramaItemOverrides {
  const result: CronogramaItemOverrides = {};

  for (const item of items) {
    const prior = saved?.[item.id];
    if (!prior) continue;

    const defaultNumber = getDefaultCronogramaItemNumber(item);
    const defaultName = String(item.name || '').trim();
    const next: CronogramaItemOverrides[string] = {};

    if ('itemCompraNumber' in prior) {
      const normalizedNumber = normalizeCronogramaItemNumber(prior.itemCompraNumber);
      if (normalizedNumber !== defaultNumber) {
        next.itemCompraNumber = normalizedNumber;
      }
    }

    if ('name' in prior) {
      const normalizedName = String(prior.name ?? '').trim();
      if (normalizedName && normalizedName !== defaultName) {
        next.name = normalizedName;
      }
    }

    if (Object.keys(next).length > 0) {
      result[item.id] = next;
    }
  }

  return result;
}

export function resolveCronogramaItemDisplay(
  item: Item,
  overrides: CronogramaItemOverrides
): { itemCompraNumber: string; name: string } {
  const override = overrides[item.id];
  return {
    itemCompraNumber: normalizeCronogramaItemNumber(
      override && 'itemCompraNumber' in override
        ? override.itemCompraNumber
        : getDefaultCronogramaItemNumber(item)
    ),
    name: String(
      override && 'name' in override
        ? override.name ?? ''
        : item.name
    ).trim(),
  };
}

export function validateCronogramaItemOverrides(
  items: readonly Item[],
  overrides: CronogramaItemOverrides
): string | null {
  for (const item of items) {
    const resolved = resolveCronogramaItemDisplay(item, overrides);
    if (!resolved.name) {
      return 'A descrição de todos os itens do cronograma deve ser preenchida.';
    }
  }
  return null;
}
