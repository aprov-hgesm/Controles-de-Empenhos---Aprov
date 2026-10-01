# Performance R3 — PERF-X — Dados quentes vs. histórico de invoices

Data: **2026-10-01**  
Branch trabalhadora: `perf-r3-x-hot-vs-history`  
Base funcional: `feat/performance-r3-commercializacao@f4d9b848735d6ea58e7057ff5f7616bd535f643e`

## Objetivo

Separar o conjunto de Notas Fiscais que precisa permanecer em realtime do histórico concluído, sem reduzir a informação disponível ao operador e sem usar corte temporal arbitrário.

A PERF-X v1 é restrita a `invoices`. Empenhos, alerts, comissões, cronogramas, ledger e demais domínios permanecem fora de escopo.

## Contrato hot/history

A fonte canônica continua sendo o próprio documento de NF.

Estado operacional:

- `APROVISIONAMENTO`;
- `COMISSAO`.

Estado histórico/concluído:

- `TESOURARIA`.

Nenhuma decisão depende de ano, exercício, idade da NF ou quantidade fixa de documentos recentes.

O helper `lib/invoiceHotHistory.ts` preserva a compatibilidade dos registros antigos:

1. `localizacaoAtual`, quando existe;
2. `tesourariaDate` implica `TESOURARIA`;
3. `comissaoDate` implica `COMISSAO`;
4. ausência dos três implica `APROVISIONAMENTO`.

## Compatibilidade legada e ativação segura

Queries Firestore por `localizacaoAtual` não podem representar corretamente documentos legados nos quais o campo ainda não existe. Por isso o runtime **não ativa automaticamente** o listener seletivo.

Antes do backfill certificado, `useOperationalRealtimeCollections` conserva o listener completo anterior.

O utilitário administrativo:

`scripts/performance-r3-invoice-hot-history.mjs`

faz somente o backfill do campo moderno já existente no contrato `Invoice`.

Características:

- workspace obrigatório;
- idempotente;
- não apaga documentos;
- não renomeia IDs;
- não altera Rules;
- PATCH somente de `localizacaoAtual`;
- precondição por `updateTime`;
- bloqueia localizações modernas inválidas;
- grava o marcador `settings/perf-r3-invoice-hot-history` somente depois de verificar integralmente o workspace.

Comandos:

```bash
npm run perf:r3:invoice-hot-history:plan -- --workspace=<workspaceId>
npm run perf:r3:invoice-hot-history:status -- --workspace=<workspaceId>
npm run perf:r3:invoice-hot-history:backfill -- --workspace=<workspaceId> --confirm=BACKFILL_INVOICE_HOT_HISTORY:<project>:<database>:<workspaceId>
```

O comando `plan` não escreve.

## Realtime após marcador READY

Com o marcador certificado:

```text
invoices realtime = localizacaoAtual IN [APROVISIONAMENTO, COMISSAO]
```

A NF concluída não permanece no listener.

Quando uma NF sai do conjunto operacional, o cliente faz uma revalidação pontual do seu `recordKey`:

- se ela virou `TESOURARIA`, a versão concluída é preservada em memória;
- se foi apagada, ela não é reintroduzida;
- não é necessário refresh manual.

Uma NF histórica reaberta legitimamente volta a satisfazer a query operacional e entra novamente no realtime.

## Empenhos

Abrir a superfície de Empenhos não depende mais de todos os documentos históricos de NF.

Cards:

- quantidades de NFs são obtidas por agregação `count()` no servidor;
- enquanto a contagem exata não chegou, a interface mostra estado pendente em vez de um número parcial.

Detalhe:

- usa `useHistoricalInvoices(mode='empenho')`;
- consulta server-side por `empenhoId`;
- pagina em blocos de 250;
- combina o histórico consultado com qualquer versão operacional realtime, usando `recordKey` como identidade;
- exibe loader e erro explícitos;
- relatório gerado a partir de Empenhos carrega o histórico do empenho se nenhuma fonte histórica já tiver sido fornecida.

## Nova NF / Notas Fiscais

A abertura inicial prioriza trabalho operacional pendente.

Filtro inicial:

`FaltaTesouraria`

Isso permite que a superfície abra apenas com o conjunto operacional.

Os filtros:

- `Todas`;
- `Concluídas / Tesouraria`;

acionam `loadAllInvoicesHistory()` sob demanda.

Contagens de `Todas` e `Concluídas` são obtidas com aggregation queries e não exigem carregar os documentos históricos somente para contar.

Enquanto uma contagem exata não está disponível, a interface exibe `…`; nunca apresenta o tamanho parcial do conjunto quente como se fosse o total histórico.

O histórico solicitado é combinado ao estado em memória e permanece disponível durante a sessão, mas não fica conectado a um listener realtime.

## Mutações e integridade

Operações que realmente precisam conhecer o histórico completo o consultam explicitamente no momento da ação:

- cadastro/edição de NF — validação de identidade;
- exclusão de todas as NFs;
- alteração de CNPJ de empenho com migração de NFs;
- reserva da numeração de Termo de Recebimento;
- geração de relatório de empenho quando chamado sem fonte histórica já carregada.

Se a consulta histórica atingir o teto de segurança, a mutação abrangente é bloqueada em vez de operar sobre um subconjunto silenciosamente.

Ações sobre uma NF já carregada continuam usando `recordKey` e a persistência canônica existente.

## Histórico de relatórios

A infraestrutura pré-existente `lib/historicalInvoiceQueries.ts` continua sendo a única camada de consulta histórica.

Foram adicionadas somente operações complementares:

- histórico completo paginado;
- lookup por `recordKey`;
- count por empenho;
- counts agregados total/concluído.

Os relatórios por empenho, fornecedor e SAG continuam reutilizando a mesma infraestrutura.

## Métrica reproduzível

A evidência automatizada é sintética e não representa produção.

Cenário controlado:

- conjunto operacional fixo: 20 NFs;
- massas totais: 100, 1.000 e 10.000 NFs.

Antes:

`realtime inicial = N`

Depois do backfill/marker:

`realtime inicial = 20`

e:

`histórico carregado antes de solicitação = 0`

Reduções teóricas do cenário:

- 100 → 20: 80%;
- 1.000 → 20: 98%;
- 10.000 → 20: 99,8%.

Esses valores são **sintéticos**. Não devem ser apresentados como consumo de produção.

## Validação

Comandos específicos:

```bash
npm run test:performance-r3-hot-history
npm run verify:performance-r3-hot-history
npm run verify:block-17-4-operational-listeners
npm run verify:block-17-5-historical-scalability
```

Os guards 17.4/17.5 também protegem o contrato PERF-X dentro do Application CI já existente, sem alterar a configuração do workflow.

## Limites da v1

PERF-X não altera:

- `empenhos`, `alerts`, `comissoes` ou `cronogramas` realtime;
- ledger/movimentos;
- Rules;
- schema canônico de NF;
- autenticação, sessão, workspace/UG;
- Central de Depósitos;
- budgets;
- configuração do Application CI.

O achado antigo de `listWarehouseMovementsForMaterial` continua apenas documentado e fora do escopo.
