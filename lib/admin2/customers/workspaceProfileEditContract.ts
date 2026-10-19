import type { UpdateSectorWorkspaceInput } from '../../platformAdminStore';
import type { CustomerWorkspaceRecord } from './customerWorkspaceContract';

/**
 * O fluxo de update já existente impede alteração de UG anteriormente registrada,
 * ID, conta Google, status e autoria. Este contrato reutiliza o mesmo recorte.
 */
export function workspaceEditInitialValues(record: CustomerWorkspaceRecord): UpdateSectorWorkspaceInput {
  return {
    workspaceId: record.workspaceId,
    workspaceName: record.name,
    ug: record.ug || '',
    organizationName: record.organizationName,
    organizationShortName: record.organizationShortName,
    sectionName: record.sectionName,
  };
}

export function validateWorkspaceProfileEdit(
  original: CustomerWorkspaceRecord,
  input: UpdateSectorWorkspaceInput
): string[] {
  const errors: string[] = [];
  if (input.workspaceId !== original.workspaceId) errors.push('ID do workspace não pode ser alterado.');
  if (original.legacyWorkspace) errors.push('Workspace fundador/legado protegido contra edição por este fluxo.');
  if (!input.workspaceName.trim() || input.workspaceName.length > 120) errors.push('Nome do setor obrigatório (máximo 120 caracteres).');
  if (!input.organizationName.trim() || input.organizationName.length > 160) errors.push('Nome institucional obrigatório (máximo 160 caracteres).');
  if (!input.sectionName.trim() || input.sectionName.length > 120) errors.push('Nome da seção obrigatório (máximo 120 caracteres).');
  if ((input.organizationShortName || '').length > 30) errors.push('Sigla excede 30 caracteres.');
  if (!/^\d{6}$/.test(input.ug)) errors.push('UG deve ter exatamente seis dígitos.');
  if (original.ug && input.ug !== original.ug) {
    errors.push('A UG já vinculada ao workspace é imutável.');
  }
  return errors;
}

export function previewUpdatedWorkspace(
  original: CustomerWorkspaceRecord,
  input: UpdateSectorWorkspaceInput,
  now: string
): CustomerWorkspaceRecord {
  const errors = validateWorkspaceProfileEdit(original, input);
  if (errors.length) throw new Error(errors.join(' '));
  return {
    ...original,
    name: input.workspaceName.trim(),
    ug: input.ug,
    organizationName: input.organizationName.trim(),
    organizationShortName: (input.organizationShortName || '').trim(),
    sectionName: input.sectionName.trim(),
    updatedAt: now,
    // Nunca alterar ID, status, e-mail operacional ou origem de criação.
  };
}
