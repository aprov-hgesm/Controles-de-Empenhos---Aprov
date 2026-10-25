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

---

## FECHAMENTO DEFINITIVO W5 — benchmark transacional v2/v3 em composição isolada (25/10/2026)

**Código medido W1:** \`afa0deba94905156a63bb636ae4ebcbb7452967d\` (PR #375, sem edição pelo W5). **Fonte W5:** \`e2d0ad8c156a34df02ab7ef10109e3ab151960b2\` (benchmark + negativos finalizados; memorial atualizado depois). **Composição de teste:** branch \`test/core-lean-r2-w5-w1-transactional-20261025\`, HEAD \`09a55373a52c328bb4cba0c651dad96975647605\`. **Workflow PASS:** https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/runs/40200112711. **Artefato:** \`w5-authenticated-v2-v3-transactions\` com JSON bruto: registros por execução, commits/replays, quantidades, leituras/writes REST, latências, p50/p95 e negativos. CI isolado do PR W5 também PASS no SHA \`e2d0ad8c\`: Fast / Core Protection / workflow W5; Application CI SKIPPED por DRAFT.

### Metodologia e prova de equivalência

- Autenticação real por Firebase Auth Emulator com usuário de teste verificado; funções server-side reais \`finalizeWarehouseWithdrawalServer\` (v2) e \`finalizeWarehouseWithdrawalV3Server\` (v3); named Firestore Emulator \`emprovex-warehouse\`, projeto exclusivamente \`demo-emprovex-security\`. Guardas exigem host local e proíbem ambientes produtivos; carga sintética por REST admin do Emulator, não por bypass de Rules reais.
- 7 cenários equivalentes com **4 execuções independentes de cada versão por cenário** = **56 commits reais e 56 replays pós-commit**. Fixtures usam materiais separados por versão (IDs técnicos distintos mas mesmo estoque/posições/quantidades/referências e autenticação), seed fora da medição, ordem v2/v3 alternada. v2 recebe linhas/IDs de validade canônicos já resolvidos; v3 recebe intenção mínima e resolve no servidor. Essa diferença é inerente aos contratos e impede afirmar que a medição server-side represente o tempo TOTAL da jornada client+network+server.
- Cada commit foi validado no Firestore: cabeçalho FINALIZED/atomicVersion, saldo, movimentos determinísticos, consumos vinculados, autoria, destino e ausência de baixa adicional no replay. Também passaram: colisão de dois pedidos simultâneos com mesmo ID e disputa de saldo com IDs diferentes (v2 e v3); injeção de falha de linha intermediária com rollback; resposta perdida após commit, seguida de replay; identidade de material inexistente; replay divergente; saturação 121 candidatos de validade sem header, sem writes e sem baixa. Na concorrência v3 retornou \`WAREHOUSE_WITHDRAWAL_V3_SNAPSHOT_CHANGED\` em uma disputa; isso é abort seguro, não uma segunda baixa.
- Instrumentação **somente durante a chamada do motor** observa os RPCs REST batchGet/runQuery/beginTransaction/commit/rollback, caminhos solicitados, documentos retornados, escritas, bytes do comando e tempo total e por fase/RPC. Validações do saldo e ledger com SDK cliente acontecem FORA do timer e não adulteram a latência. \`beforeTransactionRpcMs\` e \`transactionRpcMs\` são somas de durações de RPCs, não CPU exato de fases. Nada disso determina reads faturáveis do Firestore, custo de índices, UX/RTT de celular ou SLA de produção.
- **n=4 por versão/cenário:** p95 corresponde ao pior tempo amostrado, não a estimativa estatisticamente robusta de P95 na produção. Entre runs do mesmo SHA e runners diferentes houve variação considerável nas medianas absolutas; nunca apresentar regressão percentual como SLA. Comparar prioritariamente contagens determinísticas de RPCs/documentos e contratos.

### Tempos observados (ms): mediana / p95, run PASS 40200112711

| Cenário | v2 commit p50/p95 | v3 commit p50/p95 | v2 replay p50 | v3 replay p50 | RPC v2→v3 | Writes v2/v3 |
|---|---:|---:|---:|---:|---:|---:|
| Simples (1 validade + livre) | 34,326 / 124,051 | 58,877 / 91,058 | 15,383 | 12,453 | 7→11 | 8 / 8 |
| Multilinha, material repetido, duas posições | 25,717 / 34,953 | 39,393 / 53,492 | 10,276 | 7,891 | 7→11 | 10 / 10 |
| Várias validades + livre | 22,463 / 30,427 | 34,955 / 44,156 | 8,589 | 7,109 | 7→11 | 14 / 14 |
| Conversão e barcode de apresentação | 16,519 / 25,007 | 31,770 / 35,799 | 6,234 | 4,757 | 7→11 | 5 / 5 |
| 1 validade | 12,338 / 14,573 | 24,523 / 29,794 | 6,084 | 4,090 | 5→9 | 6 / 6 |
| 12 validades | 16,067 / 17,631 | 26,111 / 34,431 | 6,137 | 5,295 | 5→9 | 9 / 9 |
| 60 validades | 11,687 / 24,521 | 37,163 / 44,270 | 5,487 | 4,216 | 5→9 | 9 / 9 |

**Payloads (bytes, mediana):** simples v2 1.260 / v3 399; multilinha v2 1.757 / v3 857; validades v2 2.428 / v3 399; conversão v2 1.151 / v3 482; 60 validades v2 1.306 / v3 399. **Docs retornados por RPCs (mediana de contagem):** simples v2 10 / v3 16; multilinha 8/12; validade 14/22; conversão 7/11; 1 lot 7/14; 12 lots 8/36; 60 lots 8/132. Contagens incluem leituras repetidas/snapshots e documentos de query; não equivalem a cobrança em reais. Os JSONs contêm p95 e outros percentis relativos aos replays e RPC, min/max, abortos e tentativas de transação.

### Oportunidades e decisão de arquitetura GOV-SIMP-01

1. **Preflight de header repetido — DEPENDÊNCIA W1, possível ganho de RPC:** \`warehouseWithdrawalV3Write\` lê o cabeçalho, \`warehouseWithdrawalAtomicWrite\` consulta-o novamente e a transação lê o mesmo cabeçalho no readset. É tentador retirar o segundo preflight; porém a janela entre preflight e commit pode introduzir replay concorrente, e o branch transacional que encontra cabeçalho precisa garantir auditoria persistida de movimentos/consumos. NÃO eliminar até haver patch W1 com prova independente W4.
2. **Consulta adicional de lots quando há saldo livre — DEPENDÊNCIA W1, possível ganho de RPC:** V3 já lista candidatos + mutex antes/depois, enquanto AtomicWrite pode relistar candidatos para linhas com \`lotId:null\`. Proposta é carregar candidatos versionados, validar readset dentro da transação, reter mutex de phantom atualizado por todos os writers de lote e rejeitar snapshot stale. Sem cobertura contra novas atribuições concorrentes, NÃO remover consulta.
3. **BatchGet e readset — DEDUP LICENCIADO, sem otimização comprovada:** v3 já deduplica paths por Set e lê em lotes de até 30; não demonstrado que alterar o adaptador produza ganho líquido. Manter.
4. **Replay — GANHO MEDIDO no Emulator, auditoria INTACTA:** com manifest v3 o replay rejeita efeitos ausentes e demonstrou menor mediana que v2 em sete cenários, com zero writes. Não sacrificar auditoria para desempenho.
5. **Saturação — PASS:** runQuery de 121 candidatos (max 120) rejeitou a retirada sem tocar em saldo/ledger. NÃO paginar silenciosamente, nem permitir planejamento com listas incompletas.

**Otimizações executadas pelo W5:** melhorias reais na infraestrutura de medição, deduplicação estável de caminhos em ferramenta própria, parser REST de JSON streaming, fixtures equivalentes e testes históricos estendidos; **nenhuma mudança no motor produtivo**, pois os pontos transacionais possíveis pertencem ao W1 e têm riscos de integridade. Assim, ganho percentual de performance por otimização aplicada = **NÃO MEDIDO / NÃO ALEGADO**. Diminuição do payload cliente é comprovada, redução de writes NÃO ocorreu, e a v3 executou +4 RPC por commit no ambiente medido. Um custo de segurança pode ser necessário e aceitável.

### Compatibilidade histórica / limitações

- Executado no PR W5: EPX1 vinculada ao ID imutável, EPX2 lógica, numérico 981 13 dígitos, barcodes workspace-scoped, namespaces wd/wline, IDs determinísticos de movimento e consumo, validade com origem \`INVOICE\` e \`invoiceRecordKey\` legado, negativa se movimento obrigatório falta. Existe risco arquitetural de **reutilização de código lógico EPX2/981** que requer política de unicidade/reuso externo ao teste; não declarar essa propriedade imutável sem prova.
- Suites W1 executadas na composição tratam ledger v2/v3, replay e efeito. A composição W4 + W3 #379, SHA \`cbf59291bf5594bb394a52d17e8601f53418f223\`, teve **W4 Cross-PR Certified Composition PASS** (run 40159186764) incluindo contratos financeiros; é outro SHA, não certifica uma release unificada. NF/NS/recordKey e PDF integrados dependem do W3 e do PR #370; não afirmar leitura de produção.
- Não foram medidos tempo de câmera, UI mobile, RTT real, CPU/GPU do cliente, nem custos cobrados em produção. Nenhum dado de produção foi lido, e a Central de Depósitos 3D permaneceu intacta.

### Handoff, CI e GO/NO-GO

**FAST CI:** \`node --test scripts/core-lean-r2-w5-profile.test.mjs\` (invariantes, limites e determinismo; NÃO travar por p95).
**DOMAIN:** \`npx --yes tsx --test scripts/core-lean-r2-w5-historical.test.ts\`.
**RELEASE autenticado no SHA W1+W5 composto:** definir \`EMPROVEX_WAREHOUSE_ADMIN_EMULATOR=1\`, \`EMPROVEX_E2E_SERVER_AUTH=1\`, \`NEXT_PUBLIC_EMPROVEX_E2E_PROJECT_ID=demo-emprovex-security\`, \`FIRESTORE_EMULATOR_HOST=127.0.0.1:8080\`, \`FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099\`; executar \`npx --yes firebase-tools emulators:exec --config firebase.warehouse-security-test.json --project demo-emprovex-security --only auth,firestore "npx --yes tsx scripts/core-lean-r2-w5-transactions.mjs"\`. Falha fechada sem v3/evidence e sem Emulator local. Arquivos disparadores: WithdrawalV3Write, AtomicWrite, WithdrawalEvidence, Firestore transaction, lot/barcode/identity, alterações Authz, scripts W5. Scripts e evidências enviados aos PRs #372, #374; pedido com números enviado ao W1 #375.

**ONDE ESTAMOS:** W5 técnica e quantitativamente certificada no SHA composto W1+W5; PR #377 isolado DRAFT.
**O QUE FOI MEDIDO:** 56 commits+56 replays reais; erros/concorrência/rollback/saturação; payload, p50/p95, RPCs, docs/writes, custos adicionais do replay.
**O QUE FOI OTIMIZADO:** apenas instrumentos, parser REST e fixtures/testes; motor produtivo não alterado por segurança e propriedade W1.
**O QUE ESTÁ COMPROVADO:** v3 é contrato mais enxuto no cliente e custa mais RPCs/tempo de servidor no Emulator; writes iguais e replay com menor mediana, sem violação de integridade nas fixtures testadas.
**O QUE NÃO FOI COMPROVADO:** ganho de custo ou latência real de produção; segurança de remover header/lots; integração unificada com PR #370 e PDFs; imutabilidade de códigos lógicos reutilizados.
**O QUE O COORDENADOR DEVE FAZER:** compor W1/W2/W3/W4/W5 com SHAs fixos; rodar gates Application/Domain/Release no SHA final; exigir parecer W4 sobre qualquer otimização W1; conferir políticas de required checks e autenticação antes de release.
**GO/NO-GO:** **GO TÉCNICO para integrar benchmark e testes W5**. **NO-GO para afirmar ganho produtivo ou liberar main/deploy/Rules** sem a certificação final do conjunto. O W5 não tem regressão crítica conhecida sem proprietário; melhorias possíveis de header/lots foram explicitamente transferidas ao W1.
