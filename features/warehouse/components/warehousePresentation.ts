export function normalizeWarehouseSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .trim();
}

export function formatWarehouseNumber(value: number): string {
  return value.toLocaleString('pt-BR', { maximumFractionDigits: 6 });
}

export function formatWarehouseDateOnly(
  value: string | null,
  fallback = 'não informada'
): string {
  if (!value) return fallback;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? match[3] + '/' + match[2] + '/' + match[1] : value;
}

export function formatWarehouseDate(value: string | null): string {
  if (!value) return '—';
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dateOnly) {
    return dateOnly[3] + '/' + dateOnly[2] + '/' + dateOnly[1];
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? value : new Date(parsed).toLocaleDateString('pt-BR');
}

export function formatWarehouseQuantity(value: number, unitLabel: string): string {
  return formatWarehouseNumber(value) + (unitLabel ? ' ' + unitLabel : '');
}
