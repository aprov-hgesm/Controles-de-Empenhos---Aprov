export type WarehouseSectionId =
  | 'overview'
  | 'registration'
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
    id: 'overview',
    label: 'Início',
    href: '/adm-deposito',
    eyebrow: 'Central visual do depósito',
    description: 'Croqui do depósito selecionado, consulta de itens e localização visual do material.',
  },
  {
    id: 'registration',
    label: 'Cadastro de Itens',
    href: '/adm-deposito/cadastro-de-itens',
    eyebrow: 'Entrada e migração',
    description: 'Notas fiscais pendentes de tratamento logístico, alocação de itens e migração do inventário SISCOFIS.',
  },
  {
    id: 'depots',
    label: 'Meus Depósitos',
    href: '/adm-deposito/meus-depositos',
    eyebrow: 'Estrutura física',
    description: 'Cadastro de depósitos, localizações e croquis com estruturas físicas personalizadas.',
  },
  {
    id: 'control',
    label: 'Controle de Itens',
    href: '/adm-deposito/controle-de-itens',
    eyebrow: 'Estoque e operação',
    description: 'Consulta de saldo, lotes, validade, saídas, inventário, entregas, alertas e histórico.',
  },
] as const;

export function getWarehouseSection(sectionId: WarehouseSectionId): WarehouseSectionDefinition {
  const section = WAREHOUSE_SECTIONS.find((candidate) => candidate.id === sectionId);
  if (!section) throw new Error('WAREHOUSE_SECTION_NOT_FOUND');
  return section;
}
