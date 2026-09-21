import type { WorkspaceInstitutionalProfile } from './platformIdentity';

export interface InstitutionalDocumentIdentity {
  organizationName: string;
  organizationShortName: string;
  sectionName: string;
  documentHeaderLines: string[];
  defaultDeliveryLocation: string;
  defaultResponsibleRole: string;
}

/**
 * Normaliza a identidade institucional usada pelos documentos operacionais.
 *
 * A origem deve ser sempre o perfil do workspace autenticado. Os fallbacks são
 * deliberadamente genéricos para impedir que um tenant herde identificação do
 * workspace fundador por acidente.
 */
export function resolveInstitutionalDocumentIdentity(
  profile?: WorkspaceInstitutionalProfile | null
): InstitutionalDocumentIdentity {
  const organizationName = profile?.organizationName?.trim() || 'Organização Militar';
  const organizationShortName =
    profile?.organizationShortName?.trim() || organizationName;
  const sectionName = profile?.sectionName?.trim() || 'Seção de Aprovisionamento';

  const configuredHeaderLines = (profile?.documentHeaderLines || [])
    .map((line) => line.trim())
    .filter(Boolean);

  const documentHeaderLines = configuredHeaderLines.length > 0
    ? configuredHeaderLines
    : [
        'MINISTÉRIO DA DEFESA',
        'EXÉRCITO BRASILEIRO',
        organizationName.toLocaleUpperCase('pt-BR'),
      ];

  const suffix = organizationShortName ? ` - ${organizationShortName}` : '';

  return {
    organizationName,
    organizationShortName,
    sectionName,
    documentHeaderLines,
    defaultDeliveryLocation:
      profile?.defaultDeliveryLocation?.trim()
      || `Almoxarifado Geral / ${sectionName}${suffix}`,
    defaultResponsibleRole:
      profile?.defaultResponsibleRole?.trim()
      || `Fiscal de Contrato / ${sectionName}${suffix}`,
  };
}
