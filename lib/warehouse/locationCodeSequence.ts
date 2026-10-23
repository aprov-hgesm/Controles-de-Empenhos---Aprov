/**
 * A numeracao visivel de locais usa o menor numero livre na familia.
 * O ID imutavel do local e o que garante rastreabilidade; nunca e reutilizado.
 * Ex.: EST-01..EST-10 => EST-11; sem EST-02 => EST-02.
 */
export function warehouseNextAvailableLocationCode(
  sourceCode: string,
  usedCodes: ReadonlySet<string>,
): string {
  const clean = sourceCode.trim().toUpperCase();
  const match = /^(.*?)(\d+)$/.exec(clean);
  const prefix = match ? match[1] : clean.endsWith('-') ? clean : clean + '-';
  const width = Math.max(2, match?.[2]?.length ?? 2);
  if (!prefix || !/^[A-Z0-9][A-Z0-9._-]*$/.test(prefix)) {
    throw new Error('WAREHOUSE_SEQUENCE_INVALID_PREFIX');
  }
  for (let number = 1; number <= 99999; number++) {
    const suffix = String(number).padStart(width, '0');
    if (prefix.length + suffix.length > 32) break;
    const code = prefix + suffix;
    if (!usedCodes.has(code)) return code;
  }
  throw new Error('WAREHOUSE_SEQUENCE_EXHAUSTED');
}

export function warehouseCodeFromVisualLabel(label: string, defaultPrefix: string): string {
  const first = label.split(' · ')[0]?.trim().toUpperCase() ?? '';
  if (/^[A-Z0-9][A-Z0-9._-]{1,31}\d$/.test(first)) return first;
  return defaultPrefix + '01';
}
