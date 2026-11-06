/** W4-owned presentation routes: never imply that business data APIs are active. */
export type CompanySectionGroup = 'Operação' | 'Relacionamento' | 'Gestão';
export type CompanySection = { slug: string; label: string; description: string; group: CompanySectionGroup; icon: string; kind: 'home' | 'preparing' | 'identity' | 'active' };
export const COMPANY_SHELL_MODULES: readonly CompanySection[] = [
  { slug:'', label:'Início', description:'Visão geral e acesso aos módulos.', group:'Gestão', icon:'home', kind:'home' },
  { slug:'pedidos-om', label:'Pedidos de OM', description:'Solicitações dos clientes públicos, separadas das notas de empenho.', group:'Operação', icon:'orders', kind:'active' },
  { slug:'empenhos', label:'Empenhos', description:'Notas de empenho dos clientes públicos.', group:'Operação', icon:'commitments', kind:'active' },
  { slug:'compras', label:'Compras', description:'Abastecimento com fornecedores de origem.', group:'Operação', icon:'purchases', kind:'active' },
  { slug:'fornecedores', label:'Fornecedores', description:'Fornecedores de origem da empresa.', group:'Relacionamento', icon:'suppliers', kind:'active' },
  { slug:'catalogo', label:'Catálogo', description:'Produtos e referências de preços e unidades.', group:'Relacionamento', icon:'catalog', kind:'active' },
  { slug:'cronogramas', label:'Cronogramas', description:'Prazos previstos de abastecimento e entrega.', group:'Operação', icon:'schedule', kind:'active' },
  { slug:'estoque', label:'Estoque', description:'Saldo e reservas do estoque empresarial independente.', group:'Operação', icon:'stock', kind:'active' },
  { slug:'entregas', label:'Entregas', description:'Expedição, transporte e comprovantes.', group:'Operação', icon:'deliveries', kind:'active' },
  { slug:'notas-fiscais', label:'Notas Fiscais', description:'Documentos fiscais de compras e vendas.', group:'Gestão', icon:'invoices', kind:'active' },
  { slug:'financeiro', label:'Financeiro', description:'Contas a pagar e receber, sem baixa automática.', group:'Gestão', icon:'finance', kind:'active' },
  { slug:'clientes', label:'Clientes', description:'OMs e órgãos compradores atendidos.', group:'Relacionamento', icon:'customers', kind:'active' },
  { slug:'relatorios', label:'Relatórios', description:'Indicadores empresariais.', group:'Gestão', icon:'reports', kind:'preparing' },
  { slug:'configuracoes', label:'Configurações', description:'Identidade e preferências do ambiente.', group:'Gestão', icon:'settings', kind:'identity' },
] as const;
export const companyShellHref = (slug: string) => slug ? '/empresa/' + slug : '/empresa';
export const companyShellModuleBySlug = (slug: string) =>
  COMPANY_SHELL_MODULES.find((module) => module.slug === (slug === 'logistica' ? 'entregas' : slug));
export function filterCompanyShellModules(modules: readonly CompanySection[], query: string, group: CompanySectionGroup | 'Todos' = 'Todos') {
  const term = query.trim().toLocaleLowerCase('pt-BR');
  return modules.filter((module) => (group === 'Todos' || module.group === group)
    && [module.label, module.description].some((value) => value.toLocaleLowerCase('pt-BR').includes(term)));
}
