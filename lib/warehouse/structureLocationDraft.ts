import type { WarehouseLocation } from './location';
import { warehouseShelfCanonicalCode, warehouseSubpositionSequencePrefix } from './subpositionCode';

type ExistingCode = Pick<WarehouseLocation, 'code' | 'depotId' | 'kind' | 'parentLocationId'>;

/**
 * Sugere um código livre para o novo local em um depósito JÁ EXISTENTE.
 * Consulta os códigos previamente carregados (inclusive inativos), sem
 * leitura extra no Firestore. O repositório valida unicidade na gravação.
 */
export function suggestWarehouseLocalCode(
  locations: readonly ExistingCode[],
  depotId: string,
  prefix: string
): string {
  if (!depotId) return '';
  const codes = new Set(
    locations.filter((location) =>
      location.depotId === depotId && location.kind === 'LOCAL'
    ).map((location) => location.code.trim().toUpperCase())
  );
  const normalized = prefix.trim().toUpperCase();
  for (let number = 1; number <= 9999; number += 1) {
    const code = normalized + '-' + String(number).padStart(2, '0');
    if (!codes.has(code)) return code;
  }
  return '';
}

/** Sugere o próximo código de prateleira para um local selecionado. */
export function suggestWarehouseSubpositionCode(
  locations: readonly ExistingCode[],
  parentLocationId: string,
  localCode: string
): string {
  if (!parentLocationId) return '';
  const codes = new Set(
    locations.filter((location) =>
      location.kind === 'SUBPOSITION' && location.parentLocationId === parentLocationId
    ).flatMap((location) => [
      location.code.trim().toUpperCase(),
      warehouseShelfCanonicalCode(localCode, location.code),
    ].filter((code): code is string => code !== null))
  );
  const prefix = warehouseSubpositionSequencePrefix(localCode).slice(0, -2);
  for (let number = 1; number <= 9999; number += 1) {
    const code = prefix + String(number).padStart(2, '0');
    if (code.length > 32) return '';
    if (!codes.has(code)) return code;
  }
  return '';
}
