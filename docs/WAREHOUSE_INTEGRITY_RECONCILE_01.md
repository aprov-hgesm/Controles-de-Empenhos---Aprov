# WAREHOUSE-INTEGRITY-RECONCILE-01

## Estado

- Branch: `warehouse-integrity-reconcile-01`
- Base congelada: `9f1035ac447d25a8fad0ffbb0b319c31f8ba2ef0`
- Escopo: auditoria sistêmica read-only da integridade logística.
- Dados reais: nenhuma escrita, migração, backfill, repair, cleanup, TTL ou índice.
- Rules: não alteradas.
- Produção: não alterada.

Classificação desta execução viva:

**BLOCKER — INCONSISTÊNCIAS SISTÊMICAS IMPEDEM RC**

A auditoria autenticada do Firestore `emprovex-warehouse` foi executada em 2026-10-05T23:28:34.922Z, workspace `hgesm-aprov`, com 3.113 reads aproximados e nenhuma coleção atingindo o cap. Foram encontrados 2 blockers quantitativos de lote ativo acima do estoque físico e 3 ocorrências que exigem reconciliação. Nenhum dado foi escrito.

O RC não pode avançar sem tratamento dos blockers de dados descritos neste documento. A correção runtime de Inventário TOTAL continua pertencendo à frente separada `INVENTORY-PHYSICAL-FIX-01`.

## Objetivo

A investigação é global. Ela reconstrói o padrão:

\`material → aggregate balance → locationBalances → posições físicas → lotes → movimentos → inventários → saídas → devoluções → intake → UNASSIGNED\`.

PAL-01 não possui regra especial por ID. Ele é apenas teste positivo obrigatório da metodologia.

## Contrato canônico

- estoque físico operacional existe somente em \`LOCATION\` ou \`SUBPOSITION\` válida/ativa;
- \`UNASSIGNED\` é legado/projeção técnica/reconciliação, nunca localização física normal;
- intake pendente não é estoque físico;
- lote é rastreabilidade, não autoridade de saldo;
- \`movements\` é ledger append-only;
- \`balances\` é projeção agregada;
- \`locationBalances\` é a distribuição quantitativa por posição;
- \`TRANSFER\` deve ter delta agregado zero;
- \`OUTBOUND\` reduz saldo;
- \`OUTBOUND_RETURN\` deve recompor posição física válida;
- inventário físico não deve operar em \`UNASSIGNED\`.

Tolerância quantitativa: \`0.000001\`.

## Auditor entregue

Arquivo:

\`scripts/warehouse-integrity-reconcile-readonly.mjs\`

Universo lido em \`warehouse/{workspaceId}\`:

- \`materials\`
- \`depots\`
- \`locations\`
- \`movements\`
- \`balances\`
- \`locationBalances\`
- \`lots\`
- \`intakes\`
- \`withdrawals\`
- \`consumptions\`
- \`outboundReturns\`
- \`inventories\`
- \`inventories/{inventoryId}/items\`

A leitura usa paginação GET, sem listeners. Defaults:

- page size: 200;
- cap: 5000 documentos por coleção.

Se houver cap, o relatório emite \`AUDIT_CAP_REACHED\` e a execução não deve ser tratada como universo completo.

## Garantia read-only

O script usa Firestore REST com token obtido por:

\`gcloud auth print-access-token\`.

A função de transporte fixa:

\`method: 'GET'\`.

O script não usa:

- \`runTransaction\`
- \`writeBatch\`
- \`setDoc\`
- \`updateDoc\`
- \`deleteDoc\`
- endpoint \`:commit\`
- endpoint \`:batchWrite\`

A suíte \`scripts/warehouse-integrity-reconcile-readonly.test.mjs\` inspeciona o próprio source e falha se um primitive conhecido de escrita ou método HTTP diferente de GET for introduzido.

## Classificação estrutural de posições

Cada posição é separada em:

- \`ACTIVE_PHYSICAL\`
- \`INACTIVE_PHYSICAL\`
- \`UNASSIGNED\`
- \`INVALID_OR_ORPHAN\`

Uma \`LOCATION\` só é física ativa quando depósito e local existem, são coerentes e estão ativos.

Uma \`SUBPOSITION\` só é física ativa quando depósito, local pai e subposição existem, mantêm a hierarquia correta e estão ativos.

Essas categorias nunca são somadas como se fossem disponibilidade equivalente.

## Matriz por material

O relatório JSON produz, por \`materialId\`:

- \`aggregateBalance\`
- \`physicalActive\`
- \`physicalInactive\`
- \`legacyUnassigned\`
- \`invalidOrOrphan\`
- \`activeLotQuantity\`
- \`inactiveLotQuantity\`
- \`differenceAggregateVsPhysical\`
- \`differenceLotsVsPhysical\`
- \`movementDerivedBalance\`
- \`latestMovement\`
- \`lastMovementId\`
- referências de inventário, consumo, retorno e intake
- classificação consolidada

Classificações:

- \`CANONICAL\`
- \`LEGACY_BUT_EXPLAINABLE\`
- \`RECONCILIATION_REQUIRED\`
- \`INCONSISTENT\`
- \`PERFORMANCE_RISK\`

\`DATA_REPAIR_CANDIDATE\` só pode ser decidido depois da leitura viva e análise causal. Nenhum repair é executado pelo auditor.

## Invariantes cobertas

O auditor sinaliza:

1. saldo agregado negativo;
2. locationBalance negativo;
3. físico ativo acima do agregado;
4. projeções quantitativas que não reconciliam com o agregado;
5. UNASSIGNED positivo;
6. estoque em posição inativa;
7. locationBalance órfão;
8. lote ativo em posição órfã;
9. lote ativo em posição inativa;
10. lote ativo em UNASSIGNED;
11. lotes ativos por posição acima do saldo físico da posição;
12. TRANSFER com delta agregado não-zero;
13. ledger derivado diferente do agregado;
14. intake v2 com equação de quantidades inválida;
15. status de intake incompatível com quantidades;
16. item histórico de inventário em UNASSIGNED;
17. item histórico de inventário STALE;
18. duplicidade aparente de lote ativo por material/posição/código;
19. movimento referenciando locationBalance ausente;
20. devolução órfã de consumption;
21. devolução com movimento final ausente;
22. devolução para posição não física ativa quando essa posição está materializada no resumo.

## PAL-01

A suíte inclui fixture genérica:

- aggregate = 440;
- físico ativo = 440;
- lotes ativos = 300 + 240 = 540;
- ledger = entrada 540 e OUTBOUND -100.

Resultado esperado e coberto:

- \`LOT_ATTRIBUTION_EXCEEDS_STOCK\`;
- \`differenceLotsVsPhysical = 100\`;
- candidato PAL-01 detectado;
- classificação \`BLOCKER — INCONSISTÊNCIAS SISTÊMICAS IMPEDEM RC\`.

Nenhum ID real de PAL-01 está embutido no algoritmo.

## Inventário

Qualquer item histórico com:

\`position.kind === 'UNASSIGNED'\`

é classificado como \`INVENTORY_UNASSIGNED_POSITION\`.

A correção runtime de Inventário TOTAL pertence exclusivamente a \`INVENTORY-PHYSICAL-FIX-01\`. Esta branch não altera esse contrato.

## Intake

Para \`warehouse_item_intake_v2\`, o auditor recalcula:

\`pending = received - allocated - immediateConsumption\`.

Também deriva:

- \`PROCESSED\`
- \`PENDING\`
- \`PARTIALLY_PROCESSED\`

Divergência de quantidade ou status é \`INCONSISTENT\`.

v1 permanece legado e não é reinterpretado como v2.

## Ledger e projeções

O auditor soma \`quantityDelta\` por material e compara com o aggregate atual.

Limites de interpretação:

- a comparação exige universo de movimentos completo;
- cap atingido impede conclusão de completude;
- TRANSFER com delta não-zero é inconsistente;
- referência de movement para locationBalance inexistente exige reconciliação;
- nenhum movement histórico é editado.

O risco já conhecido de \`listWarehouseMovementsForMaterial()\` sem \`limit\` no Firestore continua fora do ownership desta frente. O auditor não replica esse padrão.

## Saídas e devoluções

A análise cruza:

- OUTBOUND;
- OUTBOUND_RETURN;
- consumptions;
- outboundReturns;
- referências de locationBalance presentes nos sources de movement.

Saída sem lotId pode explicar lote stale, mas a ferramenta não atribui causalidade automaticamente.

## Execução viva — 2026-10-05

Comando executado via PowerShell usando token temporário obtido por `gcloud auth print-access-token`. O transporte do auditor permaneceu exclusivamente HTTP GET.

### Universo efetivamente lido

- materiais: **56**
- registros de saldo em posições físicas: **15**
- registros `UNASSIGNED`: **55**
- lotes: **12**
- movimentos: **810**
- inventários: **0**
- itens de inventário: **0**
- intakes: **917**
- consumptions: **912**
- outboundReturns: **1**
- reads aproximados: **3.113**
- coleções que atingiram cap: **nenhuma**
- performance risks: **0**

Importante: os 55 registros `UNASSIGNED` não representam 55 saldos positivos. O auditor encontrou somente um `POSITIVE_UNASSIGNED`, com quantidade **5**, no material PAL-01 candidato.

### Materiais não canônicos

| Material | Aggregate | Físico ativo | UNASSIGNED | Lotes ativos | Ledger derivado | Resultado |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| `mat_272f2d996ee65ed3530ad2d7e27b66d7` | 445 | 440 | 5 | 540 | 445 | **INCONSISTENT** |
| `mat_6feb0840ca4060f7d69fcce1663f21b8` | 90 | 90 | 0 | 100 | 90 | **INCONSISTENT** |

O primeiro é o candidato PAL-01 conhecido. O segundo revelou um blocker quantitativo adicional que não estava no caso conhecido inicial.

### Issues encontrados

1. `POSITIVE_UNASSIGNED` — material `mat_272f...`, quantidade 5 — **RECONCILIATION_REQUIRED**.
2. `LOT_ATTRIBUTION_EXCEEDS_STOCK` — material `mat_272f...`, lotes 540 vs físico 440, diferença +100 — **INCONSISTENT / BLOCKER RC**.
3. `LOT_ATTRIBUTION_EXCEEDS_STOCK` — material `mat_6feb...`, lotes 100 vs físico 90, diferença +10 — **INCONSISTENT / BLOCKER RC**.
4. `APPARENT_DUPLICATE_ACTIVE_LOT` — material `mat_6feb...`, dois lotes ativos com mesmo código técnico de pending lot — **RECONCILIATION_REQUIRED**.
5. `APPARENT_DUPLICATE_ACTIVE_LOT` — material `mat_bb6d...`, dois lotes ativos com mesmo código técnico de pending lot — **RECONCILIATION_REQUIRED**.

No material `mat_bb6d...`, aggregate, físico, lotes ativos e ledger derivado permanecem todos em 100. Portanto a duplicidade aparente é sinal de reconciliação/normalização, mas **não é blocker quantitativo por si só na fotografia atual**.

### O que está comprovado

- PAL-01 foi detectado genericamente, sem ID hard-coded.
- No PAL-01 candidato, `aggregateBalance=445`, `physicalActive=440`, `legacyUnassigned=5` e `movementDerivedBalance=445`. Portanto ledger e aggregate reconciliam, e a diferença aggregate vs físico é integralmente explicada pelo legado `UNASSIGNED=5`.
- Ainda no PAL-01 candidato, `activeLotQuantity=540` excede o físico ativo em 100. A inconsistência está na atribuição quantitativa da camada de lotes.
- No segundo blocker, aggregate, físico e ledger são todos 90, enquanto lotes ativos somam 100. A divergência também está concentrada na camada de lotes, +10.
- Não houve saldo físico acima do aggregate, saldo negativo, posição órfã, intake v2 divergente, retorno órfão, inventário histórico inválido ou cap de auditoria reportado.
- Não existem sessões de inventário no universo atual lido; portanto não há evidência de dado histórico de inventário para reparar nesta fotografia.

### Causalidade: comprovado vs hipótese

A auditoria **não prova ainda qual evento histórico criou os lotes excedentes**. Logo, não é correto atribuir automaticamente a causa a OUTBOUND, transferência, retorno ou inventário.

Hipóteses a investigar em frente de repair/forensics, sem alterar esta branch:

- lote pending técnico duplicado em reprocessamento/idempotência de intake;
- lote não reduzido após OUTBOUND;
- duplicação histórica de lot document apesar de aggregate/locationBalance corretos;
- transição legada entre UNASSIGNED e localização física.

A presença de duplicidade aparente com código `__EMPROVEX_PENDING_LOT__:INTAKE_*` em dois materiais aumenta a prioridade de revisar a origem/idempotência desses lotes, mas **não constitui prova causal isoladamente**.

## Execução viva — procedimento reproduzível

A execução viva já foi concluída e consolidada acima. Para reproduzir no Windows/PowerShell, obtenha um token temporário com o `gcloud` autenticado e exponha-o apenas na sessão atual como `WAREHOUSE_AUDIT_ACCESS_TOKEN`.

No Cloud Shell, o script também pode obter o token via `gcloud`.

A saída inclui resumo global, materiais não canônicos, issues, classificação final e o bloco `JSON_REPORT_BEGIN` / `JSON_REPORT_END`.

Se houver 403/PERMISSION_DENIED: **DIAGNOSTIC ACCESS REQUIRED**. Não alterar Rules para liberar a auditoria.

## Testes da frente

Arquivo:

\`scripts/warehouse-integrity-reconcile-readonly.test.mjs\`

Casos:

1. guard estático de read-only;
2. classificação de LOCATION/SUBPOSITION/UNASSIGNED/órfã;
3. fixture positiva PAL-01 440/540;
4. intake v2 divergente + inventário UNASSIGNED.

No desenvolvimento isolado da frente:

**4 PASS / 0 FAIL**.

A execução viva não foi simulada como evidência de dados reais.

## Decisão sobre repair

| Classe | Pode seguir sem repair? | Bloquear operação? | Repair determinístico? | Decisão humana? | Backup? |
| --- | --- | --- | --- | --- | --- |
| POSITIVE_UNASSIGNED | depende da origem | não sempre | às vezes | sim | sim |
| STOCK_IN_INACTIVE_POSITION | não para aquela posição | sim | possível | sim | sim |
| ORPHAN_LOCATION_BALANCE | não | sim | não presumir | sim | sim |
| LOT_ATTRIBUTION_EXCEEDS_STOCK | não para fluxo por lote | sim | após causa | sim | sim |
| AGGREGATE_PROJECTION_MISMATCH | não sem explicação | depende | depende do ledger | sim | sim |
| LEDGER_AGGREGATE_MISMATCH | não sem universo completo | potencialmente | depende | sim | sim |
| INVENTORY_UNASSIGNED_POSITION | não criar novos | sim no runtime | runtime já tem owner | histórico: sim | se houver data repair |
| INTAKE_QUANTITY_MISMATCH | não | sim | possível | sim | sim |
| RETURN_ORPHAN_CONSUMPTION | não | sim | não presumir | sim | sim |
| AUDIT_CAP_REACHED | não concluir | n/a | n/a | ampliar/particionar | não |

Nenhuma linha autoriza repair nesta branch.

## Critério RC

A auditoria viva global foi concluída. O RC **não pode avançar sem reparo de dados** porque existem dois blockers quantitativos reais:

1. `mat_272f2d996ee65ed3530ad2d7e27b66d7`: lotes ativos excedem estoque físico em **100**;
2. `mat_6feb0840ca4060f7d69fcce1663f21b8`: lotes ativos excedem estoque físico em **10**.

Além disso:

- o PAL-01 candidato mantém **5** em `UNASSIGNED`, que exige reconciliação controlada;
- há duplicidade aparente de lote ativo em `mat_6feb...` e `mat_bb6d...`;
- a causa histórica exata dos excessos de lote ainda deve ser comprovada antes de qualquer repair;
- qualquer repair deve ter backup, plano idempotente/reversível e owner próprio;
- a correção runtime de Inventário TOTAL continua separada nesta governança.

Classificação final:

**BLOCKER — INCONSISTÊNCIAS SISTÊMICAS IMPEDEM RC**.

## Performance

A auditoria usa:

- paginação;
- execução bounded;
- cap por coleção;
- subcoleções de inventário por sessão;
- nenhuma query ilimitada seguida de slice tardio;
- contagem aproximada de documentos lidos.

Se o cap for insuficiente, ampliar em janela controlada ou particionar. Não remover guardrails.

## RULES-COMPAT

Nenhum arquivo de Rules foi alterado.

Referências vigentes informadas pelo Program Control:

- principal: \`bc91185f34bcdcb4437a4de1078d1089a09292ba\`;
- Warehouse: \`6e1f1050005314db4e17cb3136409abbddb0ee91\`;
- RULES-COMPAT-01: PASS.

## Handoff final

- branch: `warehouse-integrity-reconcile-01`;
- base congelada: `9f1035ac447d25a8fad0ffbb0b319c31f8ba2ef0`;
- execução viva: concluída;
- reads aproximados: 3.113;
- cap atingido: nenhum;
- materiais: 56;
- registros físicos: 15;
- registros UNASSIGNED: 55, somente 1 positivo;
- lotes: 12;
- movimentos: 810;
- inventários/itens: 0/0;
- blockers quantitativos: 2 materiais;
- reconciliações adicionais: POSITIVE_UNASSIGNED + 2 duplicidades aparentes;
- PAL-01: detectado em `mat_272f2d996ee65ed3530ad2d7e27b66d7`;
- causa estrutural comprovada: divergência localizada na camada de lotes, com aggregate/ledger coerentes nos dois blockers;
- causa histórica específica: ainda não comprovada;
- repair: obrigatório para os excessos de lote antes do RC, porém proibido nesta branch;
- Rules: inalteradas;
- produção: inalterada;
- classificação final: **BLOCKER — INCONSISTÊNCIAS SISTÊMICAS IMPEDEM RC**.

A próxima frente deve ser específica de forensics/repair de dados, com backup prévio, dry-run, idempotência, reversibilidade e aprovação humana. Esta auditoria não executa repair.

