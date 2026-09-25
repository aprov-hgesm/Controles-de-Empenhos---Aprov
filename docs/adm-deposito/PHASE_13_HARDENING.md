# MÓDULO 13 — Segurança, Firestore, Performance e Telemetria

Data: 2026-09-25.

## 1. Escopo

Este módulo é exclusivamente de hardening. Não cria novo fluxo operacional importante, não reimplementa os Módulos 1–12 e não inicia o Módulo 14.

Baseline auditada:
- branch `feat/adm-deposito-phase-11-5-visual-ux`;
- HEAD inicial real `0c35f723c87b366d2b50b3b511d0e8e356115d75`;
- nenhum commit posterior precisava ser reconciliado.

## 2. Segurança e founder-only

A proteção permanece em camadas:
- gate cliente por `canAccessWarehouseModule`;
- validação autenticada em `/api/adm-deposito/status`;
- gate server-side fundador;
- Firestore Rules founder-only;
- workspace piloto `hgesm-aprov`;
- UG piloto `160416`.

Usuários externos continuam sem acesso ao ADM, inclusive por URL direta e camada de dados.

O namespace `warehouse` não herda `canAccessWorkspace(workspaceId)` do Core.

Hardening adicional:
- delete físico de `warehouse/{workspaceId}/materials/{materialId}` passa a ser negado;
- o ciclo operacional de material continua por `status`, preservando referências históricas.

## 3. Ledger, saldos, idempotência e concorrência

Auditoria confirmou:
- movimentos permanecem append-only;
- UI não possui caminho de escrita direta em saldo;
- `warehouse_balance_v1` e `warehouse_location_balance_v1` continuam projeções do mesmo movimento;
- transferências continuam com quantidade total zero e atualização física transacional;
- inventário continua produzindo `INVENTORY_ADJUSTMENT`;
- saída continua usando `OUTBOUND`;
- NF continua usando o fluxo oficial de entrada;
- replay usa identidades determinísticas/idempotência;
- revision/lastMovementId continuam protegendo concorrência;
- relatórios não escrevem ledger ou saldos.

Nenhum lock global foi introduzido.

## 4. Core Protection

Permanece a direção:
`EMPROVEX → leitura/projeção → ADM Depósito`.

Não foi criado caminho:
- ADM → saveInvoice;
- ADM → saveEmpenho;
- ADM → saveCronograma;
- Core → transação crítica warehouse.

NF, Empenho, Cronograma, Comissão, Liquidação, Tesouraria, SAG, login, usuários e sessões continuam operáveis sem o ADM.

## 5. Firestore Rules

Alteração mínima:
- material canônico: delete físico agora é `false`.

Não foram abertas permissões para corrigir UI/relatório.

Continuam protegidos:
- workspace/UG;
- schemaVersion;
- IDs;
- campos imutáveis;
- movements append-only;
- saldos derivados;
- depots/locations;
- lots/barcodes;
- inventory + items;
- layouts;
- SISCOFIS;
- alerts/settings/intakes/withdrawals/consumptions.

## 6. Índices

`firestore.indexes.json` não existe na branch auditada e `firebase.json` não declara arquivo de índices.

Nenhum índice composto foi criado.

Motivo:
- movimentos gerais usam `orderBy(createdAt)` + limite;
- movimentos por material usam equality + limite e ordenação bounded em memória;
- demais consultas auditadas permanecem simples/bounded;
- não existe evidência de consulta legítima bloqueada que justifique novo índice.

## 7. Performance — Estoque

`WarehouseStockOperational` continua carregando fontes necessárias à visão agregada de forma bounded.

Correção:
- location balances, lots e barcodes passam a ser indexados uma vez por `materialId` em `Map`;
- montagem dos summaries deixa de filtrar coleções inteiras repetidamente para cada saldo;
- histórico de movimentos continua carregado somente após seleção do material, limitado a 50.

Nenhuma correção de performance altera a regra de saldo.

## 8. Performance — Inventário

A abertura do Inventário fazia:
- leitura de materiais para a própria tela;
- nova leitura dos mesmos materiais dentro de `listWarehouseUnlocatedStock`.

Correção:
- materiais, saldos e locationBalances são carregados uma única vez no lote base;
- `deriveWarehouseUnlocatedStock` reutiliza esses dados em memória;
- a releitura redundante de até 500 materiais por abertura foi eliminada.

Snapshot histórico de inventário continua independente do saldo atual.

## 9. Dashboard e Alertas — falha controlada

Fontes auxiliares:
- inventories;
- SISCOFIS;
- logistics settings.

Quando uma delas falha:
- o Dashboard registra a fonte como degradada;
- mantém dados principais disponíveis quando possível;
- mostra aviso explícito;
- métrica diretamente dependente da fonte aparece indisponível;
- reconciliação não resolve automaticamente alertas com contexto incompleto.

Alertas continuam no namespace warehouse e não integram a Central de Avisos do Core neste módulo.

## 10. Relatórios

`WarehouseLogisticsReports` permanece:
- somente leitura;
- sem listener;
- sem N+1 por linha;
- sem reconstrução de saldo;
- sem cache Firestore;
- com movimentos bounded a 250;
- com filtros locais;
- com CSV sobre dataset já carregado.

Materialização de relatório continua evolução futura não autorizada.

## 11. Lotes / FEFO

Permanece obrigatório reutilizar:
- `warehouseLotExpiryState`;
- `selectWarehouseFefoLot`;
- `WAREHOUSE_EXPIRY_WARNING_DAYS`.

Nenhum segundo cálculo de validade/FEFO foi criado.

## 12. SISCOFIS

Preservados:
- IA externa;
- contrato `emprovex_siscofis_inventory_v1`;
- validação + preview + confirmação humana;
- Marco Zero;
- snapshots;
- conciliação sem autocorreção;
- limite de 500 linhas.

Nenhuma IA foi embutida no EMPROVEX.

## 13. Croqui e documentos grandes

Croqui:
- persiste apenas layout;
- máximo de 160 objetos;
- `warehouseLocationId` é referência;
- não armazena saldo, lote ou quantidade;
- não escreve durante drag/resize/rotate;
- Início carrega somente layout ativo.

SISCOFIS:
- máximo de 500 linhas por snapshot/importação.

Inventário:
- itens ficam em subcoleção por sessão; não existe array histórico crescente na sessão.

Não foi identificado armazenamento warehouse de base64, PDF, blob, HTML pesado ou SVG gigante em Firestore.

## 14. Telemetria

A infraestrutura oficial existente é `lib/workspaceUsageTelemetry.ts`, com buffer e flush espaçado.

Foi criado somente um adaptador:
`lib/warehouse/telemetry.ts`.

Características:
- resolve o mesmo workspace/UG autenticado;
- registra contagem de documentos retornados por snapshots bounded;
- registra writes relevantes de reconciliação de alertas;
- reutiliza `recordWorkspaceDocumentReads/Writes`;
- não acessa Firestore diretamente;
- não possui listener;
- falha silenciosamente/best-effort;
- não bloqueia operação.

Repositories instrumentados para leituras bounded incluem material, ledger, localização, lotes, barcodes, layouts, SISCOFIS, intake, inventário, saídas/consumos e logística.

A telemetria continua sendo estimativa; transações e retries não são tratados como medição exata de billing.

## 15. Consumo qualitativo por superfície

| Fluxo | Classificação | Justificativa |
|---|---|---|
| Abrir shell do ADM | baixo | gates/autorização; nenhuma subaba operacional é pré-carregada |
| Início | potencialmente alto | materiais, depósitos, localizações e duas projeções bounded; lotes só após seleção |
| Pesquisar material já carregado | baixo | filtro/índice em memória; sem query por tecla/hover |
| Cadastro de Itens | potencialmente alto | fila pode combinar Empenhos, NFs, intakes e movimentos bounded |
| Meus Depósitos | moderado | depósitos/localizações + layout do depósito selecionado |
| Controle de Itens (shell) | baixo | somente subaba ativa monta |
| Estoque | potencialmente alto | até várias coleções bounded necessárias à visão; joins agora indexados em memória |
| Saída de Material | potencialmente alto | catálogo, saldos, barcodes, posições, lotes e destinos para checkout |
| Movimentações | moderado | materiais + histórico bounded |
| Inventário | potencialmente alto | materiais, estrutura e projeções; uma leitura redundante de materiais foi removida |
| Entregas | potencialmente alto | fontes Core bounded + saldos/movimentos para correlação |
| Alertas / Dashboard | potencialmente alto | agregação de múltiplos domínios; somente ao abrir a subaba |
| SISCOFIS | moderado a potencialmente alto | materiais/saldos + histórico bounded |
| Relatórios | variável | apenas relatório/subsuperfície aberta; herda limites da fonte correspondente |

A classificação é arquitetural, não uma medição exata de billing.

## 16. Guards e validação

Adicionado:
- `scripts/verify-adm-deposito-phase-13.mjs`;
- script npm `verify:adm-deposito-phase-13`;
- gate futuro no Application CI;
- cenário multi-tenant que nega delete físico do material;
- atualização do guard da FASE 1 para exigir o cenário.

Conforme D-057, o Módulo 13 não dispara deliberadamente a campanha pesada:
- TypeScript global;
- build;
- Firestore Emulator completo;
- Browser E2E;
- regressão global;
- Application CI.

Essa execução consolidada pertence ao Módulo 14.

## 17. Estado final

Módulo 13: **CONCLUÍDO**.

Módulo 14: **NÃO INICIADO**.

Não há autorização implícita para merge, deploy ou expansão a usuários externos.
