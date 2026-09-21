import type { Empenho } from '../../../lib/types';
import { normalizeEmpenhoClassCode } from '../../../lib/empenhoClasses';

export type EmpenhoExerciseKind = 'vigente' | 'rpnp' | 'historico' | 'indeterminado';

export function getCurrentExerciseYear(referenceDate: Date = new Date()): number {
  return referenceDate.getFullYear();
}

export function getPreviousExerciseYear(referenceDate: Date = new Date()): number {
  return getCurrentExerciseYear(referenceDate) - 1;
}

export function getEmpenhoExerciseYear(
  empenho: Pick<Empenho, 'id' | 'date'>
): number | null {
  const rawDate = String(empenho.date || '').trim();

  const isoMatch = rawDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return Number(isoMatch[1]);

  const brMatch = rawDate.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (brMatch) return Number(brMatch[3]);

  const idMatch = String(empenho.id || '').trim().match(/^(\d{4})NE/i);
  if (idMatch) return Number(idMatch[1]);

  return null;
}

export function getEmpenhoExerciseKind(
  empenho: Pick<Empenho, 'id' | 'date'>,
  referenceDate: Date = new Date()
): EmpenhoExerciseKind {
  const exerciseYear = getEmpenhoExerciseYear(empenho);
  if (!exerciseYear) return 'indeterminado';

  const currentYear = getCurrentExerciseYear(referenceDate);
  if (exerciseYear === currentYear) return 'vigente';
  if (exerciseYear === currentYear - 1) return 'rpnp';
  if (exerciseYear < currentYear - 1) return 'historico';

  return 'indeterminado';
}

export function isRpnpEmpenho(
  empenho: Pick<Empenho, 'id' | 'date'>,
  referenceDate: Date = new Date()
): boolean {
  return getEmpenhoExerciseKind(empenho, referenceDate) === 'rpnp';
}

export function getEmpenhoBaseClassification(
  empenho: Pick<Empenho, 'classification'>
): string {
  return normalizeEmpenhoClassCode(empenho.classification || 'QR') || 'QR';
}

export function getEmpenhoDisplayClassification(
  empenho: Pick<Empenho, 'id' | 'date' | 'classification'>,
  referenceDate: Date = new Date()
): string {
  const classification = getEmpenhoBaseClassification(empenho);
  return isRpnpEmpenho(empenho, referenceDate)
    ? `${classification} RPNP`
    : classification;
}

export function getEmpenhoYearFilterLabel(
  yearInput: string,
  referenceDate: Date = new Date()
): string {
  const year = Number(yearInput);
  if (!Number.isFinite(year)) return yearInput;

  const currentYear = getCurrentExerciseYear(referenceDate);
  if (year === currentYear) return `${year} — exercício vigente`;
  if (year === currentYear - 1) return `${year} — RPNP`;
  return String(year);
}

export function compareEmpenhosByRpnpPriority(
  a: Pick<Empenho, 'id' | 'date'>,
  b: Pick<Empenho, 'id' | 'date'>,
  referenceDate: Date = new Date()
): number {
  const aRpnp = isRpnpEmpenho(a, referenceDate);
  const bRpnp = isRpnpEmpenho(b, referenceDate);
  if (aRpnp !== bRpnp) return aRpnp ? -1 : 1;

  const aYear = getEmpenhoExerciseYear(a) || 0;
  const bYear = getEmpenhoExerciseYear(b) || 0;
  if (aYear !== bYear) return bYear - aYear;

  return String(a.id || '').localeCompare(String(b.id || ''), 'pt-BR');
}
