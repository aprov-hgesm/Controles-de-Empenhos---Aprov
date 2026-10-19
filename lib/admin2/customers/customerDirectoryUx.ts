import type { CustomerWorkspaceQuery } from './customerWorkspaceDirectory';
import type { CustomerWorkspaceRecord } from './customerWorkspaceContract';
import { isValidUnitUg, normalizeUnitUg } from '../../platformIdentity';

/**
 * O ID do Firestore continua obrigatório e imutável, mas não é digitado pelo
 * administrador. A UG já é única na provisão atual; logo, UG -> ID estável.
 * Não alteramos identificadores dos workspaces já existentes.
 */
export function deriveNewWorkspaceId(ugInput: string): string {
  const ug = normalizeUnitUg(ugInput);
  if (!isValidUnitUg(ug)) throw new Error('Informe a UG com seis dígitos.');
  return 'ug-' + ug;
}

/** Workspaces simulados ficam separados e são filtrados sem leituras adicionais. */
export function matchesPreviewWorkspace(
  item: CustomerWorkspaceRecord,
  search: CustomerWorkspaceQuery
): boolean {
  const term = search.term.trim();
  if (!term) return true;
  if (search.field === 'ug') return item.ug === term;
  if (search.field === 'workspaceId') return item.workspaceId.toLowerCase() === term.toLowerCase();
  return item.name.toLocaleLowerCase('pt-BR').startsWith(term.toLocaleLowerCase('pt-BR'));
}
