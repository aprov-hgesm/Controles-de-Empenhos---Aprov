/** Company-only navigation contract. No military operational imports. */
export const COMPANY_MODULES = [
  { slug: '', label: 'Início', description: 'Visão geral da sua operação empresarial.' },
  { slug: 'empenhos', label: 'Empenhos', description: 'Compromissos e empenhos recebidos dos clientes.' },
  { slug: 'clientes', label: 'Clientes', description: 'Organizações e clientes atendidos pela empresa.' },
  { slug: 'fornecedores', label: 'Fornecedores', description: 'Parceiros responsáveis pelo abastecimento.' },
  { slug: 'compras', label: 'Compras', description: 'Pedidos de compra e necessidades de suprimento.' },
  { slug: 'cronogramas', label: 'Cronogramas', description: 'Abastecimentos e entregas planejadas.' },
  { slug: 'logistica', label: 'Logística', description: 'Separação, transporte e distribuição.' },
  { slug: 'financeiro', label: 'Financeiro', description: 'Compromissos a pagar e valores a receber.' },
  { slug: 'configuracoes', label: 'Configurações', description: 'Identidade e preferências da empresa.' },
] as const;

export type CompanyModuleSlug = typeof COMPANY_MODULES[number]['slug'];

export function companyModuleBySlug(slug: string) {
  return COMPANY_MODULES.find((module) => module.slug === slug);
}
