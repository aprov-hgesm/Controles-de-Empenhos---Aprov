# WAREHOUSE-INTEGRITY-RECONCILE-01

## Estado

- Branch: \`warehouse-integrity-reconcile-01\`
- Base congelada: \`9f1035ac447d25a8fad0ffbb0b319c31f8ba2ef0\`
- Escopo: auditoria sistêmica read-only da integridade logística.
- Dados reais: nenhuma escrita, migração, backfill, repair, cleanup, TTL ou índice.
- Rules: não alteradas.
- Produção: não alterada.

Classificação desta execução:

**DIAGNOSTIC ACCESS REQUIRED — ferramenta read-only entregue; execução viva ainda necessária para fechar a matriz global de dados.**

O RC permanece bloqueado pelas evidências já confirmadas antes desta frente: Inventário TOTAL incluindo \`UNASSIGNED\` e PAL-01 com 440 L físicos vs 540 L em lotes ativos.

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

## Execução viva pendente

O ambiente deste worker não possui \`gcloud\`, portanto não existe evidência fabricada de leitura real.

O caminho previsto pelo prompt foi seguido: ferramenta read-only + instrução exata.

### Cloud Shell

\`\`\`bash
git fetch origin
git switch warehouse-integrity-reconcile-01
git pull --ff-only origin warehouse-integrity-reconcile-01

node scripts/warehouse-integrity-reconcile-readonly.mjs \
  --project=gen-lang-client-0982077967 \
  --database=emprovex-warehouse \
  --workspace=hgesm-aprov \
  --page-size=200 \
  --max-docs-per-collection=5000 \
  | tee warehouse-integrity-reconcile-live.txt
\`\`\`

A saída inclui:

- resumo global;
- materiais não canônicos;
- issues;
- classificação final;
- \`JSON_REPORT_BEGIN\` / \`JSON_REPORT_END\`.

Se houver 403/PERMISSION_DENIED:

**DIAGNOSTIC ACCESS REQUIRED**

Não alterar Rules para liberar a auditoria.

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

O RC não deve ser certificado enquanto:

1. Inventário TOTAL ainda aceitar UNASSIGNED;
2. a auditoria viva global não tiver sido executada;
3. PAL-01 não tiver causa suficientemente demonstrada;
4. inconsistências operacionais reais não tiverem owner de correção/repair;
5. qualquer repair necessário não tiver backup e plano idempotente/reversível.

Classificação provisória:

**BLOCKER — INTEGRIDADE LOGÍSTICA AINDA NÃO LIBERADA PARA RC**.

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

## Handoff após execução viva

Retornar ao Coordenador:

- branch e HEAD;
- comando executado;
- reads aproximados;
- coleções que atingiram cap;
- materiais;
- posições físicas;
- UNASSIGNED;
- lotes;
- movimentos;
- inventários/itens;
- inconsistências por código;
- materiais/posições afetados;
- PAL-01/materialId candidato;
- causas comprovadas;
- hipóteses;
- blockers;
- candidatos a repair;
- exigência de decisão humana/backup;
- classificação final.

Até essa leitura, nenhuma escrita em dados reais é autorizada.
