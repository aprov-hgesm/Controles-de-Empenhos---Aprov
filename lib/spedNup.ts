export const SPED_NUP_CANONICAL_PATTERN = /^\d{5}\.\d{6}\/\d{4}-\d{2}$/;

export function normalizeSpedNup(value: unknown): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '';

  const compact = raw.replace(/\s+/g, '');
  if (SPED_NUP_CANONICAL_PATTERN.test(compact)) {
    return compact;
  }

  const digits = compact.replace(/\D/g, '');
  if (digits.length === 17) {
    return `${digits.slice(0, 5)}.${digits.slice(5, 11)}/${digits.slice(11, 15)}-${digits.slice(15, 17)}`;
  }

  return compact;
}

export function isValidSpedNup(value: unknown): boolean {
  return SPED_NUP_CANONICAL_PATTERN.test(normalizeSpedNup(value));
}

export function isValidOptionalSpedNup(value: unknown): boolean {
  const raw = String(value ?? '').trim();
  return raw.length === 0 || isValidSpedNup(raw);
}
