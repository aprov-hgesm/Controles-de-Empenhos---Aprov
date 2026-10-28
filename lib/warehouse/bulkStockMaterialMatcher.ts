import type { WarehouseMaterial } from './material';

/**
 * Identidade para a carga em lote: acentos e espaços não distinguem material,
 * mas pontuação e palavras não podem ser descartadas ("A-B" != "AB").
 */
export function bulkMaterialDescriptionKey(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR').trim().replace(/\s+/g, ' ');
}

export function bulkMaterialUnitKey(value: string): string {
  const key = value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '');
  if (['und', 'un', 'unidade', 'unidades', 'unit'].includes(key)) return 'unit';
  if (['pct', 'pacote', 'pacotes', 'package'].includes(key)) return 'package';
  if (['cx', 'caixa', 'caixas', 'box'].includes(key)) return 'box';
  if (['kg', 'quilo', 'quilos', 'quilograma', 'quilogramas'].includes(key)) return 'kg';
  if (['g', 'grama', 'gramas'].includes(key)) return 'g';
  if (['l', 'litro', 'litros'].includes(key)) return 'l';
  if (['ml', 'mililitro', 'mililitros'].includes(key)) return 'ml';
  return key;
}

export function bulkMaterialGroupKey(description: string, unit: string): string {
  return bulkMaterialDescriptionKey(description) + '\u001f' + bulkMaterialUnitKey(unit);
}

/** Nunca confundir apresentações distintas só porque compartilham o código-base. */
export function bulkMaterialCandidates(
  materials: WarehouseMaterial[], description: string, unit: string
): WarehouseMaterial[] {
  const name = bulkMaterialDescriptionKey(description);
  const inputUnit = bulkMaterialUnitKey(unit);
  return materials.filter(material => {
    if (material.status !== 'active' || bulkMaterialDescriptionKey(material.description) !== name)
      return false;
    const baseUnit = bulkMaterialUnitKey(material.unit.code);
    const presentation = material.unit.label
      ? bulkMaterialUnitKey(material.unit.label) : baseUnit;
    return presentation === inputUnit;
  });
}
