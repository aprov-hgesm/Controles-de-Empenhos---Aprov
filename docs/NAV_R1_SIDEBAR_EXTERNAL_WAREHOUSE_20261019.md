# Navegação R1 — barra lateral EMPROVEX e acesso externo à Central de Depósitos

Data: 19/10/2026  
Branch: \`feat/sidebar-navigation-external-warehouse-r1\`  
Base: \`feat/warehouse-cold-appliances-3d-premium@153d2349\`

## Pedido do Fundador

Após o aceite gráfico da geladeira e do freezer 3D, melhorar a arquitetura de informação da barra lateral e **devolver o acesso visível à Central de Depósitos aos setores externos autorizados**, sem enfraquecer isolamento multiworkspace.

## Organização do menu principal

- **Visão geral:** Início, Painel.
- **Gestão de empenhos:** Empenhos, Notas Fiscais, Consulta de Itens, Fornecedores.
- **Acompanhamento:** Cronogramas, Relatórios, Central de Avisos.
- **Gestão de depósitos:** Central de Depósitos, em área separada e visualmente destacada, somente quando permitida ao setor.

A hierarquia visual usa títulos acessíveis de grupos, divisores sutis e um bloco de chamada funcional para a Central. Continuam os dez controles nativos, o foco por teclado, a animação Border Beam, o indicador de aba ativa, o contador de avisos, o menu móvel e a saída.

## Correção do atalho para setores externos

Causa demonstrada: \`app/page.tsx\` condicionava a exibição do atalho a \`workspaceContext.workspaceId === HGESM_WORKSPACE_ID\` mesmo após \`canAccessWarehouseModule(workspaceContext)\`, bloqueando a apresentação para setores externos.

Correção: \`warehouseModuleEnabled={canAccessWarehouseModule(workspaceContext)}\`. A função exige setor autenticado, \`canLoadOperationalData\` e workspace. A página da Central permanece protegida por \`WarehouseAccessBoundary\` e pela rota \`/api/central-depositos/status\`. O backend \`lib/server/warehouseAccess.ts\` verifica conta e workspace ativo, UID, email, provedor, UG e claims para setores externos.

**A exibição do botão não é uma autorização adicional.** Se um setor não passar no gate do backend, o acesso permanece negado.

## Impacto

Arquivos alterados: \`components/layout/AppSidebar.tsx\`, \`app/globals.css\`, \`app/page.tsx\`, \`scripts/visual-r1-w4-sidebar-border-beam.test.mjs\`. Nenhum documento Firestore, Rule, schema, workspace ou registro logístico é modificado. Sem leituras adicionais do Firestore. A branch inclui a prévia 3D aprovada do PR #342 como base, para avaliação conjunta no localhost:3001.

## Aceite

1. Verificar ordem dos nove destinos principais, indicador da aba ativa, contador de avisos e menu mobile.
2. Confirmar que conta externa ativa e autorizada vê \`Central de Depósitos\`, e que o link abre a Central correspondente ao seu próprio workspace.
3. Confirmar que conta desautorizada/inativa ainda falha no gate do servidor e não recebe dados de outro workspace.
4. Validar filtros e as abas da Central, incluindo geladeira e freezer 3D nas quatro vistas.
5. Conferir Application CI, Core Protection e QA isolado no HEAD final; smoke humano antes de merge.

## Handoff

- **Onde estamos:** branch isolada pronta para CI e preview local; a versão pública não muda.
- **O que estamos fazendo:** validação de usabilidade e retorno do link externo.
- **Quem está fazendo:** executor GitHub no código e Fundador no navegador.
- **O que fazer a seguir:** carregar a branch no projeto local, executar testes e navegar com conta externa de teste sem usar dados de terceiros.
- **Quem fará:** Fundador executa smoke em \`localhost:3001\`; executor corrige eventuais problemas.
