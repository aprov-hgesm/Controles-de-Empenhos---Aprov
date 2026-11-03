/**
 * Compatibilidade sem regravação de IDs ou saldos: os cadastros antigos
 * EST-01-01 equivalem à prateleira PRAT-01 da EST-01.
 * Somente estantes EST-01..EST-99 e prateleiras 01..99 entram nessa regra.
 */
export function warehouseShelfCanonicalCode(parentCode: string, childCode: string): string | null {
  const parent = parentCode.trim().toUpperCase();
  const child = childCode.trim().toUpperCase();
  if (!/^EST-\d{1,2}$/.test(parent)) return null;
  const match = /^EST-(\d{1,2})-(\d{1,2})$/.exec(child);
  if (!match || Number(match[1]) !== Number(parent.slice(4))) return null;
  const number = Number(match[2]);
  return number >= 1 && number <= 99 ? 'PRAT-' + String(number).padStart(2, '0') : null;
}

export function warehouseShelfLegacyCode(parentCode: string, childCode: string): string | null {
  const parent = parentCode.trim().toUpperCase();
  const child = childCode.trim().toUpperCase();
  if (!/^EST-\d{1,2}$/.test(parent)) return null;
  const match = /^PRAT-(\d{1,2})$/.exec(child);
  if (!match) return null;
  const number = Number(match[1]);
  return number >= 1 && number <= 99
    ? parent + '-' + String(number).padStart(2, '0') : null;
}

export function warehouseSubpositionSequencePrefix(parentCode: string): string {
  return /^EST-\d{1,2}$/.test(parentCode.trim().toUpperCase())
    ? 'PRAT-00'
    : parentCode.trim().toUpperCase() + '-00';
}
