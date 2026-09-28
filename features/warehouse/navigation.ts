export type WarehouseSectionId =
  | 'home'
  | 'overview'
  | 'registration'
  | 'outbound'
  | 'depots'
  | 'control';

export interface WarehouseSectionDefinition {
  id: WarehouseSectionId;
  label: string;
  href: string;
  eyebrow: string;
  description: string;
}

export const WAREHOUSE_SECTIONS: readonly WarehouseSectionDefinition[] = [
  {
    id: 'home',
    label: 'Início',
    href: '/adm-deposito',
    eyebrow: 'Visão geral',
    description: 'Visão visual consolidada dos depósitos e das pendências de alocação.'
  },
  {
    id: 'overview',
    label: 'Meus Depósitos',
    href: '/adm-deposito/meus-depositos',
    eyebrow: 'Central visual do depósito',
    description: 'Central visual com Visão 3D do depósito, consulta de materiais, saldo, localização e validade.'
  },
  {
    id: 'registration',
    label: 'Alocação de Material',
    href: '/adm-deposito/cadastro-de-itens',
    eyebrow: 'Alocação e migração',
    description: 'Notas fiscais pendentes de tratamento logístico, alocação física de materiais e migração do inventário SISCOFIS.',
  },
  {
    id: 'outbound',
    label: 'Saída de Material',
    href: '/adm-deposito/saida-de-material',
    eyebrow: 'Retirada e SISCOFIS',
    description: 'Separação física, baixa de estoque, destino, responsável e documentos auxiliares para retirada e Pedido de Material no SISCOFIS.',
  },
  {
    id: 'depots',
    label: 'Controle de Depósitos',
    href: '/adm-deposito/controle-de-depositos',
    eyebrow: 'Estrutura física',
    description: 'Cadastro de depósitos, localizações e croquis com estruturas físicas personalizadas.',
  },
  {
    id: 'control',
    label: 'Controle de Materiais',
    href: '/adm-deposito/controle-de-itens',
    eyebrow: 'Estoque e rastreabilidade',
    description: 'Consulta permanente de estoque, posições físicas, validade, movimentações, inventários e relatórios.'
  },
] as const;

export function getWarehouseSection(sectionId: WarehouseSectionId): WarehouseSectionDefinition {
  const section = WAREHOUSE_SECTIONS.find((candidate) => candidate.id === sectionId);
  if (!section) throw new Error('WAREHOUSE_SECTION_NOT_FOUND');
  return section;
}
