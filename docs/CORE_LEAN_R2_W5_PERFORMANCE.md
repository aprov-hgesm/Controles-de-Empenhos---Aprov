# CORE LEAN R2 — Worker 5: Performance, Firestore, Compatibilidade

**Estado: DRAFT / NO-GO para integração.** Branch perf/core-lean-r2-w5-benchmarks, partindo de main afe163139089a1af8ffc81804464429d4d0f9528. SHA W1 consultado: 122d61a1510d4f3d177c0acb25cfc885010b69f9 (#375). Referências: #370, #372, #373, #374, #375. Sem merge, deploy, Rules, custo recorrente ou dados de produção.

## Código executável

1. scripts/core-lean-r2-w5-profile.mjs: CPU benchmark do planejador canônico de validade, com cenários fictícios 1, 12 e 60 lotes, repetição, mediana, p95, cold e warm; e sondas REST reais do Firestore Emulator (barcode, posição, pré-planejamento v3 e leitura de replay). Sondas NÃO executam retirada, transação financeira ou v2/v3 E2E. Não são economia em reais.
2. scripts/core-lean-r2-w5-profile.test.mjs: valida percentis, deduplicação estável, chunk em 30 docs, limite 120, falha fechada 121, saldo atribuído/livre/vencido, determinismo; teste v3 condicional ao código W1 estar presente no SHA composto.
3. scripts/core-lean-r2-w5-historical.test.ts: tests reais EPX1, EPX2, código 981 de 13 dígitos, barcode material escopado por workspace, wd_/wline_.
4. .github/workflows/core-lean-r2-w5.yml: typecheck + suite + Emulator em DRAFT; publica JSON de medições como artifact, sem segredo de produção.

**Execução Fast:** node --test scripts/core-lean-r2-w5-profile.test.mjs

**Execução Domain:** npx --yes tsx --test scripts/core-lean-r2-w5-historical.test.ts

**CPU:** node scripts/core-lean-r2-w5-profile.mjs --cpu --out w5-cpu.json

**Emulator isolado:** configurar EMPROVEX_WAREHOUSE_ADMIN_EMULATOR=1, NEXT_PUBLIC_EMPROVEX_E2E_PROJECT_ID=demo-emprovex-security e FIRESTORE_EMULATOR_HOST=127.0.0.1:8080; executar npx --yes firebase-tools emulators:exec --config firebase.warehouse-security-test.json --project demo-emprovex-security --only firestore "node scripts/core-lean-r2-w5-profile.mjs --emulator --out w5-emulator.json"

Guardas locais impedem execução fora do projeto fictício e host loopback. Documentos seed ficam em workspace fictício w5-benchmark dentro do Emulator. O registro conta chamadas HTTP REST, documentos pedidos e retornados; NÃO é faturamento exato do Firestore, não mede entradas no índice, nem latência da API real.

## Baseline executado — 25/10/2026 (em SHA 3bca6a634ce7)

CI completo específico W5 **PASS**: https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/runs/40158004979. TypeScript PASS, testes das fixtures/CPU PASS, testes históricos PASS e sondas Firestore Emulator PASS. Fast CI e Core Protection PASS neste SHA; Application CI SKIPPED por ser DRAFT.

Algoritmo de alocação real, 150 iterações aquecidas, milissegundos (mediana/p95): cenário pequeno 1 lote = **0,003 / 0,007**; médio 12 lotes = **0,008 / 0,011**; grande 60 lotes = **0,009 / 0,025**. CPU em runner compartilhado, não equivale à latência do navegador nem à latência da retirada E2E.

Firebase Emulator demo, 94 documentos fictícios seed, 15 iterações por cenário, mediana/p95 em milissegundos:

| Operação (sonda) | Pequeno | Médio | Grande | Chamadas REST por execução |
|---|---:|---:|---:|---:|
| Barcode material (batchGet) | 6,131 / 18,840 | 3,406 / 5,415 | 1,697 / 2,323 | 1 |
| Material + saldo global + saldo local | 6,613 / 9,859 | 3,555 / 5,909 | 2,352 / 7,448 | 1 |
| Leituras de pré-planejamento v3 (header, lock, runQuery lots, lock, referências) | 18,161 / 26,912 | 20,723 / 32,696 | 23,103 / 31,485 | 5 |
| Leitura de header ausente (não é replay após commit) | 3,214 / 6,050 | 1,911 / 4,140 | 2,068 / 5,166 | 1 |

Na sonda v3, foram solicitados **6 caminhos batchGet** por execução, retornando **6/17/65 documentos** (incluindo respostas da query de lotes). Os números são observações de RPCs e documentos da execução fictícia, **não representam reads cobrados**. O cenário de replay consulta um **header ausente** e NÃO valida idempotência, movements ou consumptions após commit. As 5 chamadas NÃO incluem a transação atômica; não são o custo total da retirada v3. O comportamento de runQuery depende dos índices/estado do Emulator, e pequenas variações de ordem entre sondas tornam inadequado inferir escalabilidade apenas das latências apresentadas.

**Antes/depois:** há baseline observável na branch W5, mas nenhuma alteração dos motores v2/v3 foi aplicada nesta branch. **Ganho antes/depois = NÃO MEDIDO.** Comparação v2/v3 exige SHA composto W1+W4, dados operacionais equivalentes, transação real, replays e repetição controlada no Emulator. O artefato `core-lean-r2-w5-measurements` do workflow contém `w5-cpu.json` e `w5-emulator.json`.

## Mapa de caminhos (inspeção de código, não traces de produção)

| Operação | Entrada → motor | Operações dominantes |
|---|---|---|
| Barcode de material | mobile-barcode → warehouseMobileBarcodeRead | um batchGet por barcode, valida UG/workspace |
| Barcode de posição | mobileLocationBarcodeResolver e mobile-read | depot/location/hierarquia autoritativa; não cachear escopo entre usuários |
| Posições de material | mobile-read → warehouseMobileRead | query em locationBalances por material |
| Materiais de posição | mobile-read → warehouseMobileRead | locationBalances com filtros de posição, resolução de materiais |
| Saldo | mobile-read / Warehouse readers | balances/locationBalances em batchGet ou query |
| Apresentações | Warehouse material + barcode association | unidades e conversões lidas da entidade canônica |
| Validades | mobile-read e warehouseWithdrawalV3Write | lots por material; limite fail-closed |
| Retirada v2 | operations WITHDRAWAL_FINALIZE → warehouseWithdrawalWrite / AtomicWrite | header; destinos; materiais; posições; lotes; mutex se free; movimentos e consumos em transação |
| Retirada v3 (W1) | operations WITHDRAWAL_FINALIZE_MOBILE → warehouseWithdrawalV3Write → AtomicWrite | header; mutex antes/depois; consulta lots; batchGet referências; novo header; transação com snapshot |
| Transferência | operations TRANSFER → warehouseTransfer | material, saldos, posições, lots e locks conforme plano |
| Entrada avulsa | manual-entry → warehouseManualEntry | estoque/saldos/movimentos/validade; locks W1 |
| Entrada por NF | intake-action/queue + Warehouse | documentos NF/empenho + intakes e posição; #370 não certificado |
| Devolução | operations STOCK_RETURN → warehouseReturnWrite | consumptions, movements, saldos e recuperação |
| Inventário | operations INVENTORY_* → warehouseInventoryStart/Lifecycle/Adjustment | inventários, items, ajustes, revisões |
| Recuperação | warehouseWithdrawalWrite/AtomicWrite | cabeçalho, replay, recuperação v1 distinta de v2/v3 |
| Financeiro vinculado | queue, intake-action, core NF/NS/NE | recordKey e locks históricos; W3 aditivo ainda sem writers |

Consultas de autenticação, isolamento, saldo, concorrência, transação e versões NÃO são redundantes só por serem leituras repetidas. Medir por operação real e por quantidade de linhas/posições.

## Achados da v3 que exigem revisão do Worker 1

- No primeiro pedido, V3Write faz batchGet do cabeçalho, depois AtomicWrite faz outro batchGet de cabeçalho e a transação lê novamente. Investigar possível corte da leitura intermediária SEM remover replay/validação transacional.
- V3Write lê mutex antes e após runQuery lotes; depois a transação verifica snapshots. Ambas leituras são defesas contra phantom/concorrência; NÃO remover simplesmente para poupar RPC.
- Quando o planejamento gera parte de saldo livre (lotId null), AtomicWrite consulta candidatos de lotes por material novamente. Investigar reutilização de candidatos versionados desde que a transação releia as referências e prove que nenhum lote concorrente ficou fora do conjunto.
- runQuery usa limite maxResults+1 e falha com WAREHOUSE_SERVER_QUERY_SATURATED se exceder 120. Preservar comportamento, não truncar silenciosamente.
- BatchGet tem no máximo 30 caminhos por RPC; AtomicWrite inclui até 450 docs no readset/writes. Contagem de caminhos distintos não equivale a número cobrado de reads/writes.

## Compatibilidade e limites de prova

Testes novos cobrem apenas invariantes de código EPX1/EPX2/981, barcode escopado, IDs wd/wline, planejamento de saldo livre/validade e limites. **Não certificados ainda:** v1/v2/v3 E2E completo com ledger, movements/consumptions, link empenho→NF→Warehouse, recordKey legado e séries NF, NS locks, PDF, referências de validade em todas as variantes, concorrência de todas as escritas e reutilização de código lógico contra entidades históricas no Emulator. Coordenação com W3/W4 e #370 obrigatória.

**Antes/depois:** dados reais do benchmark do SHA inicial são produzidos nos artifacts do CI. Não comparar CPU puro de versões diferentes com retiradas E2E. Para comparar v2/v3, criar fixtures equivalentes, executar operações reais no SHA certificado, usar perfil de chamadas e repetir rodadas isoladas; acompanhar p50/p95 e variação, cold/warm, leituras e escritas, rollback/replay. Ganho real de v3 sobre v2 **NÃO MEDIDO** neste PR. Nenhuma economia monetária atribuída.

**W4 #374:** suspeita concreta de replay v2 sobre cabeçalho FINALIZED fabricado e movements/consumptions ausentes. Não baixar severidade nem relaxar o teste adversarial. W1 é responsável pelo motor.

## Handoff e CI

ONDE ESTAMOS: Branch isolada W5, DRAFT. Nenhuma publicação.
O QUE FOI CONCLUÍDO: scripts/fixtures/sondas, suite histórica parcial, guardas Emulator, workflow, análise da v3.
O QUE FALTA: conferir CI (TypeScript, Fast, Domain, Emulator), E2E real v2/v3 no SHA composto, comparativo antes/depois, contratos históricos restantes e segurança W4.
QUEM ESTÁ FAZENDO: W5 benchmarks; W1 motor; W2 orquestrador CI; W3 identidade financeira; W4 garantia; coordenador integração.
O QUE FAZER A SEGUIR: validar logs/artifacts CI, corrigir falhas, entregar proposta de deduplicação ao W1 e scripts Fast/Domain/Release ao W2; medir v2/v3 no SHA certificado.
QUEM FARÁ: W5 onde isolado; W1/W4 para mudança segura, W2 composição CI; coordenador aprova release.
GO/NO-GO: NO-GO enquanto não houver comparativo E2E e adversarial PASS.