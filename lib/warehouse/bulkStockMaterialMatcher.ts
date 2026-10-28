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
  if (['und', 'un', 'unid', 'unidade', 'unidades', 'unit'].includes(key)) return 'unit';
  if (['pct', 'pc', 'pac', 'pacote', 'pacotes', 'package'].includes(key)) return 'package';
  if (['cx', 'caixa', 'caixas', 'box'].includes(key)) return 'box';
  if (['kg', 'quilo', 'quilos', 'quilograma', 'quilogramas'].includes(key)) return 'kg';
  if (['g', 'gr', 'grama', 'gramas'].includes(key)) return 'g';
  if (['l', 'lt', 'litro', 'litros'].includes(key)) return 'l';
  if (['ml', 'mililitro', 'mililitros'].includes(key)) return 'ml';
  if (['fd', 'fardo', 'fardos', 'bundle'].includes(key)) return 'bundle';
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

/** Índice para planilhas grandes: prepara os materiais uma vez, não por linha. */
export function indexBulkStockMaterials(materials: WarehouseMaterial[]):Map<string,WarehouseMaterial[]> {
  const index=new Map<string,WarehouseMaterial[]>();
  for(const material of materials) {
    if(material.status!=='active')continue;
    const key=bulkMaterialGroupKey(material.description,material.unit.label||material.unit.code);
    const existing=index.get(key)||[];
    existing.push(material);
    index.set(key,existing);
  }
  return index;
}
