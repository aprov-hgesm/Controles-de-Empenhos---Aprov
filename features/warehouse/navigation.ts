export type WarehouseSectionId =
  | 'overview'
  | 'stock'
  | 'outbound'
  | 'movements'
  | 'locations'
  | 'warehouseView'
  | 'inventory'
  | 'siscofis'
  | 'deliveries'
  | 'settings';

export interface WarehouseSectionDefinition {
  id: WarehouseSectionId;
  label: string;
  href: string;
  eyebrow: string;
  description: string;
  futurePhase: string | null;
}

export const WAREHOUSE_SECTIONS: readonly WarehouseSectionDefinition[] = [
  { id: 'overview', label: 'Visão Geral', href: '/adm-deposito', eyebrow: 'Estrutura do módulo', description: 'Ponto de entrada do ADM Depósito e visão honesta das fundações já disponíveis.', futurePhase: null },
  { id: 'stock', label: 'Estoque', href: '/adm-deposito/estoque', eyebrow: 'Consulta logística', description: 'Consulta operacional de saldo, barcodes, lotes, validade, localização, origem, pendências e recomendação FEFO.', futurePhase: null },
  { id: 'outbound', label: 'Saída Expressa', href: '/adm-deposito/saida-expressa', eyebrow: 'Scanner e retirada', description: 'Leitura HID/teclado, apresentações, conversão e saída auditável com proteção contra saldo negativo.', futurePhase: null },
  { id: 'movements', label: 'Movimentações', href: '/adm-deposito/movimentacoes', eyebrow: 'Ledger auditável', description: 'Superfície estrutural para consulta futura do ledger canônico criado na FASE 2.', futurePhase: 'FASES 4–10' },
  { id: 'locations', label: 'Localizações', href: '/adm-deposito/localizacoes', eyebrow: 'Estrutura física operacional', description: 'Depósitos, locais, subposições, distribuição física e transferências internas auditáveis.', futurePhase: null },
  { id: 'warehouseView', label: 'Visão do Depósito', href: '/adm-deposito/visao-do-deposito', eyebrow: 'Croqui operacional', description: 'Espaço reservado ao croqui 2D com perspectiva tridimensional e destaque de locais.', futurePhase: 'FASE 9' },
  { id: 'inventory', label: 'Inventário', href: '/adm-deposito/inventario', eyebrow: 'Contagem física', description: 'Base para esperado x contado, divergências e ajustes auditáveis.', futurePhase: 'FASE 10' },
  { id: 'siscofis', label: 'SISCOFIS / Conciliação', href: '/adm-deposito/siscofis-conciliacao', eyebrow: 'Referência externa', description: 'Prompt externo, JSON versionado, Marco Zero auditável, snapshots e conciliação sem autocorreção.', futurePhase: null },
  { id: 'deliveries', label: 'Entregas', href: '/adm-deposito/entregas', eyebrow: 'Planejamento logístico', description: 'Ponto futuro de integração com o Planejamento/Cronograma já existente no EMPROVEX.', futurePhase: 'FASE 11' },
  { id: 'settings', label: 'Configurações', href: '/adm-deposito/configuracoes', eyebrow: 'Parâmetros do módulo', description: 'Área estrutural para configurações logísticas futuras sem criar permissões fictícias.', futurePhase: 'FASES 12–14' },
] as const;

export function getWarehouseSection(sectionId: WarehouseSectionId): WarehouseSectionDefinition {
  const section = WAREHOUSE_SECTIONS.find((candidate) => candidate.id === sectionId);
  if (!section) throw new Error('WAREHOUSE_SECTION_NOT_FOUND');
  return section;
}
