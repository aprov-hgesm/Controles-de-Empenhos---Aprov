# Handoff W8 R1-D — Relatórios e experiência informacional

**Projeto:** EMPROVEX Almoxarifado
**Branch:** feat/emprovex-almox-r1d-w8-reports
**Base:** PR #441, commit d89781d5347d04173af98bcc50c71d99bfb8f663
**Estado:** branch isolada, PR DRAFT, sem merge/deploy.
**Memorial:** docs/EMPROVEX_ALMOXARIFADO_MEMORIAL_OFICIAL.md (somente leitura no W8; consolidação pelo W9).

## 1. Inventário e escolhas

- RelatoriosView, RelatorioPorEmpenhoView, RelatorioPorFornecedorView e HistoricalConsistencyView são interfaces ligadas ao Aprovisionamento; o relatório por empenho permite editar NS, e o de integridade permite reparos. Não foram incorporadas diretamente ao Almoxarifado para não habilitar mutações nem vocabulário alimentar.
- lib/supplierReporting.ts: reaproveitado sem modificação para agrupamento por CNPJ e cálculos vigentes. A apresentação setorial usa os mesmos contratos Empenho e Invoice.
- WarehouseLogisticsReports, WarehouseConsumptionReports e WarehouseStockOperational contêm caminhos de escrita (status, retorno, transferência, barcode/lotes). Não montar estas superfícies diretamente em relatório somente leitura.
- WarehouseInventoryHistoryReport e WarehouseSiscofisHistoryReport: reaproveitados via import dinâmico quando selecionados; SISCOFIS se refere ao Mapa de Existência/snapshots, NÃO aos pedidos futuros.
- SAG/NS e saneamento ficam fora do W8. Histórico por exercício inclui apenas empenhos fornecidos pelo integrador, sem varredura global.

## 2. Arquivos criados

1. features/almoxarifado/relatorios/reportModel.ts — modelos financeiros/logísticos puros e bloqueio de workspace cruzado.
2. features/almoxarifado/relatorios/AlmoxarifadoReportsView.tsx — interface de relatório com filtros, indicadores, CSV financeiro, consultas logísticas sob demanda e componentes históricos existentes.
3. scripts/emprovex-almox-w8-reports.test.mjs — testes direcionados de NE, fornecedor, materiais, valores versus quantidades, vazio, parcial, acesso cruzado, regressão e ausência de escrita.
4. .github/workflows/emprovex-almox-w8-r1d.yml — TypeScript, testes W8/W1/W5 e build, sem deploy.
5. docs/almoxarifado/handoffs/W8_R1D.md — este handoff exclusivo W8.

## 3. Contrato obrigatório para o W9

Importar AlmoxarifadoReportsView e montar APENAS no portal autenticado /almoxarifado, passando:
- workspaceId: scope.workspaceId, obtido da sessão setorial, nunca da URL.
- mode: normal ou essential, conforme o seletor do portal.
- financial: {status:'ready',snapshot:{workspaceId:scope.workspaceId,empenhos:scopedEmpenhos,invoices:scopedInvoices,completeness:'partial'}}. Alterar para complete SOMENTE com comprovação de leitura integral do recorte. Os arrays devem provir das fontes autorizadas do W6/W9 no MESMO workspace.
- Enquanto W6 ainda não conectou os dados, financial: {status:'unavailable'}; em erro, {status:'error',message:'...'}; durante consulta, {status:'loading'}.

Nunca utilizar fixtures, dados globais, outro workspace, nem valores de Aprovisionamento para preencher telas operacionais. W9 é o único responsável por app/almoxarifado/page.tsx.

## 4. Segurança

- getCurrentOperationalScope valida a sessão ativa versus workspaceId antes da exibição e antes/depois das consultas.
- O reportModel valida workspaceId em materiais, depósitos, locais, posições, lotes e movimentos. Divergência gera erro e rejeita o conjunto.
- Empenho/Invoice não possuem workspaceId no esquema legado: por isso o W8 recebe estes dados do loader autenticado do portal. O W9 deve garantir a origem e não misturar arrays entre workspaces.
- As consultas warehouse usam repositórios e regras já existentes; nenhuma ampliação de permissões.
- O W8 não chama APIs de escrita, baixa, pedido SISCOFIS, ledger, ajustes, saldos ou reparos.

## 5. Matriz de fontes e cálculos

| Indicador | Fonte e cálculo | Observação |
| --- | --- | --- |
| Empenhos | Empenho[] autorizado, contagem | Recorte pode ser parcial |
| Valor empenhado | soma item.quantity × item.unitPrice por NE | R$ |
| Valor de NFs | soma Invoice.totalValue com empenho presente no recorte | R$; não provar liquidação apenas com NF |
| Saldo financeiro | soma max(0, valor NE − valor NF vinculada), por NE | Não é estoque físico |
| Fornecedores | buildSupplierReports por CNPJ normalizado | Empenhos sem CNPJ fora do agrupamento |
| Materiais ativos | listWarehouseMaterials, status active | Limite 250 |
| Depósitos/locais ativos | listWarehouseDepotsStrict e listWarehouseLocationsStrict | Limites 100/250 |
| Posições positivas | listWarehouseLocationBalances, quantity > 0 | Limite 500; NÃO somar unidades diferentes |
| Movimentações | listWarehouseMovementsInPeriod | Últimos 30 dias; limite 100 |
| Lotes vencidos | listWarehouseLots, ativos positivos com validade menor que hoje | Limite 150, data local |
| Inventários | WarehouseInventoryHistoryReport | Consulta sob demanda |
| SISCOFIS | WarehouseSiscofisHistoryReport | Snapshots / Mapa de Existência |

Limites atingidos mostram sinal + ou aviso de cobertura parcial. Indicadores indisponíveis não são preenchidos com zero artificial. Valores de NFs não são declarados automaticamente liquidados. Quantidades em unidades distintas não são somadas. Não são criados pedidos sintéticos no relatório.

CSV financeiro é exportação local do recorte filtrado, com proteção contra fórmulas; não grava no banco ou gera documentos oficiais. Componentes warehouse históricos mantêm seus formatos existentes.

## 6. Desempenho e UX

- Financeiro só recebe arrays do portal: sem listener adicionado pelo W8.
- Materiais e movimentos consultam ao entrar na aba e mediante clique Atualizar; sem polling.
- Inventários e SISCOFIS montados só na aba respectiva, via import dinâmico.
- Tabelas limitam exibição a 100 linhas e aceitam pesquisa; CSV financeiro exporta todo o recorte filtrado.
- Visual simples, responsivo, sem efeitos pesados no modo essential.

## 7. Testes, estado e handoff

O workflow isolado W8 é responsável por TypeScript, testes determinísticos W8, regressão W1/W5 e Next build. A publicação de um workflow não comprova PASS. Conferir status de cada execução no GitHub antes de certificar. Não há acesso de rede para clonar o repositório no ambiente de testes local desta execução; o CI será a fonte de evidência remota.

W9 deve: plugar W6 como fonte financeira com identidade setorial comprovada, montar a view no portal, integrar com W7 sem modificar W7, conferir Normal/Essencial, testar workspace vazio, carregado e cruzado na navegação, e consolidar o memorial oficial.

Pendências conhecidas: o relatório financeiro não faz consulta histórica ad hoc; exibe somente registros recebidos do integrador. Listagens logísticas são limitadas; se atingirem limite, os números são parciais. Não integrar até conferir o workflow e dados autorizados.

**Proibição:** nenhum merge, produção, tráfego, Rules, IAM, cobrança nem baixa de pedido por este Worker.
