/** Read-only SISCOFIS -> warehouse correspondence. Free text is never authority. */
import type { MaterialCorrespondenceV1, RequestLineV1, TypedIssueV1 } from './contracts';
import type { WarehouseMaterial } from '../warehouse/material';
import { bulkMaterialDescriptionKey, bulkMaterialUnitKey } from '../warehouse/bulkStockMaterialMatcher';
import { normalizeWarehouseLocationQuantity } from '../warehouse/location';

export interface MaterialMatchInput {
  workspaceId: string;
  line: RequestLineV1;
  materials: readonly WarehouseMaterial[];
  correspondences: readonly MaterialCorrespondenceV1[];
}
export interface MaterialMatchResult {
  line: RequestLineV1;
  material: WarehouseMaterial | null;
  /** Suggestions are informational, never confirmed. */
  suggestedMaterialIds: string[];
  issues: TypedIssueV1[];
}
const key = (v: string) => v.normalize('NFKC').trim().toLocaleUpperCase('pt-BR');
const issue = (line: RequestLineV1, code: TypedIssueV1['code'], details: string): TypedIssueV1 =>
  ({ code, severity: 'BLOCKING', sourceRowId: line.sourceRowId, details });

/** Identical source presentations only; ambiguous aliases do not silently convert. */
export function configuredMaterialFactor(material: WarehouseMaterial, sourceUnit: string): number | null {
  const source = bulkMaterialUnitKey(sourceUnit);
  if (!source) return null;
  const candidates = [
    { unit: material.unit, factor: 1 },
    ...material.conversions.map(c => ({ unit: c.presentation, factor: c.factorToBaseUnit })),
  ].filter(entry => {
    // A named/other presentation cannot be reduced to a generic package/box name.
    if (entry.unit.code === 'other' || entry.unit.label) {
      return entry.unit.label ? bulkMaterialUnitKey(entry.unit.label) === source : false;
    }
    return bulkMaterialUnitKey(entry.unit.code) === source;
  });
  if (candidates.length !== 1) return null;
  const factor = candidates[0].factor;
  return Number.isFinite(factor) && factor > 0 && normalizeWarehouseLocationQuantity(factor) !== null
    ? factor : null;
}

export function matchRequestMaterial(input: MaterialMatchInput): MaterialMatchResult {
  const { line, workspaceId } = input;
  const result: MaterialMatchResult = {
    line: { ...line, matchStatus: 'UNRESOLVED', canonicalMaterialId: null,
      canonicalQuantity: null, factorToBaseUnit: null },
    material: null, suggestedMaterialIds: [], issues: [],
  };
  const scoped = input.materials.filter(m => m.workspaceId === workspaceId && m.status === 'active');
  const description = bulkMaterialDescriptionKey(line.description || '');
  result.suggestedMaterialIds = scoped.filter(m =>
    description && [m.description, ...m.aliases].some(n => bulkMaterialDescriptionKey(n) === description)
    && (!line.sourceUnit || configuredMaterialFactor(m, line.sourceUnit) !== null)
  ).map(m => m.id).sort();

  if (!Number.isFinite(line.sourceQuantity) || line.sourceQuantity === null || line.sourceQuantity <= 0) {
    result.issues.push(issue(line, 'INVALID_QUANTITY', 'Quantidade solicitada ausente ou inválida.'));
    result.line.matchStatus = 'INVALID';
    return result;
  }
  if (line.quantityMeaning !== 'REQUESTED' && line.quantityMeaning !== 'AUTHORIZED') {
    result.issues.push(issue(line, 'UNKNOWN_QUANTITY_MEANING', 'Semântica da quantidade exige confirmação.'));
    return result;
  }
  if (!line.sourceItemCode?.trim() || !line.sourceUnit?.trim()) {
    result.issues.push(issue(line, 'MATERIAL_UNRESOLVED', 'Código ou unidade SISCOFIS não informado; sugestão textual não vincula.'));
    return result;
  }

  const matches = input.correspondences.filter(c => c.workspaceId === workspaceId
    && key(c.sourceItemCode) === key(line.sourceItemCode!)
    && key(c.sourceUnit) === key(line.sourceUnit!)
    && c.approvedByUid.trim().length > 0 && c.approvedAt.trim().length > 0
    && Number.isSafeInteger(c.revision) && c.revision > 0);
  if (matches.length !== 1) {
    result.issues.push(issue(line, 'MATERIAL_UNRESOLVED', matches.length > 1
      ? 'Correspondências aprovadas conflitantes exigem resolução humana.'
      : 'Não existe correspondência SISCOFIS aprovada para código e unidade.'));
    return result;
  }
  const approved = matches[0];
  const material = scoped.find(m => m.id === approved.materialId);
  if (!material) {
    result.issues.push(issue(line, 'MATERIAL_UNRESOLVED', 'Material vinculado inexistente, inativo ou fora do workspace.'));
    return result;
  }
  const factor = configuredMaterialFactor(material, line.sourceUnit);
  if (factor === null || approved.factorToBaseUnit !== factor) {
    result.issues.push(issue(line, 'UNIT_INCOMPATIBLE', 'Unidade ou fator aprovado diverge do catálogo atual.'));
    result.line.matchStatus = 'INVALID';
    return result;
  }
  const canonicalQuantity = normalizeWarehouseLocationQuantity(line.sourceQuantity * factor);
  if (canonicalQuantity === null || canonicalQuantity <= 0) {
    result.issues.push(issue(line, 'INVALID_QUANTITY', 'Conversão excede a precisão ou o limite do estoque.'));
    result.line.matchStatus = 'INVALID';
    return result;
  }
  result.line = { ...line, canonicalMaterialId: material.id, factorToBaseUnit: factor,
    canonicalQuantity, matchStatus: 'CONFIRMED' };
  result.material = material;
  return result;
}
