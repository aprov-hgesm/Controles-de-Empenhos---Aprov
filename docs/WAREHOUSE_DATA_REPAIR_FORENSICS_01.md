# WAREHOUSE-DATA-REPAIR-FORENSICS-01

Status: **PASS — CAUSA PROVADA / REPAIR PLAN PRONTO PARA APROVAÇÃO**

Esta frente é exclusivamente de investigação causal, dry-run e preparação de repair.
**Nenhum write em dados reais foi autorizado ou executado.**

## 1. Governança

- Repositório: `aprov-hgesm/Controles-de-Empenhos---Aprov`
- Branch: `warehouse-data-repair-forensics-01`
- HEAD inicial validado: `b8dbc33ce6f3bed949dc8d4000316a9cc501998f`
- Base do PR: `warehouse-integrity-reconcile-01`
- Rules: **não alteradas**
- MOBILE-K: **não alterada**
- Inventário TOTAL: **fora de escopo**
- Produção: **não alterada**

A branch foi confirmada inicialmente como exatamente `0 à frente / 0 atrás` do HEAD obrigatório.

## 2. Baseline já comprovado

A auditoria sistêmica anterior, em leitura viva do Firestore Warehouse, registrou:

- 56 materiais;
- 810 movimentos;
- 917 intakes;
- 912 consumptions;
- 12 lotes;
- 1 devolução;
- 3.113 reads;
- nenhuma coleção atingiu o cap;
- `aggregate == ledgerDerived` nos dois blockers.

### Material A

`mat_272f2d996ee65ed3530ad2d7e27b66d7`

- aggregate: **445**
- physicalActive: **440**
- UNASSIGNED: **5**
- activeLots: **540**
- ledgerDerived: **445**
- excesso de lote sobre físico: **+100**
- referências observadas no resumo anterior: 1 intake, 2 consumptions, 1 return

### Material B

`mat_6feb0840ca4060f7d69fcce1663f21b8`

- aggregate: **90**
- physicalActive: **90**
- UNASSIGNED: **0**
- activeLots: **100**
- ledgerDerived: **90**
- excesso de lote sobre físico: **+10**
- referências observadas no resumo anterior: 1 intake, 1 consumption, 0 returns

Há duplicidade aparente do lote técnico:

`__EMPROVEX_PENDING_LOT__:INTAKE_3EC3A25D6E993602F1021C10D0AC2C720B1DE5114`

IDs observados:

- `lot_082ebcd7a2acf0c706c87464307cb1ff`
- `lot_9612b1fead5cad386c465bce9ca30758`

### Controle

`mat_bb6d4a089c224b1a48ad3a43f32170a3`

O caso de controle possui duplicidade técnica aparente, mas:

`aggregate = physical = activeLots = ledger = 100`

Logo, duplicidade documental por si só **não prova** excesso quantitativo.

## 3. Forensics de código — fatos

### 3.1 Intake

No runtime atual, `allocateWarehousePendingItem()`:

1. cria ou resolve a entrada `INVOICE_ENTRY`;
2. move quantidade de `UNASSIGNED` para posição física por `TRANSFER`;
3. cria ou incrementa a atribuição de `warehouse_lot_v1`;
4. quando não há lote informado, usa código técnico `__EMPROVEX_PENDING_LOT__:<intakeId>`;
5. rejeita atualização de lote que exceda o saldo da posição após a alocação;
6. usa identidade de operação/movimento idempotente.

Portanto, o fluxo atual de intake não autoriza silenciosamente um novo incremento de lote acima da posição física durante uma alocação válida.

### 3.2 OUTBOUND

No runtime atual, `applyWarehouseExpressOutbound()`:

- sempre reduz o saldo agregado;
- sempre reduz a posição física;
- aceita `lotId = null`;
- **somente reduz `warehouse_lot_v1.quantity` quando um `lotId` foi explicitamente fornecido**.

Consequência objetiva:

> Um OUTBOUND válido sem `lotId` reduz aggregate + físico e deixa a atribuição logística de lote intacta.

Esse mecanismo é tecnicamente capaz de produzir exatamente a classe de divergência:

`activeLots > physicalActive`

A decisão histórica da FASE 8 também registra que a escolha de lote é opcional/explicita e que FEFO é recomendação, não seleção automática.

### 3.3 Devolução

A devolução atual de saída:

- localiza o OUTBOUND original;
- recompõe estoque por `MANUAL_ENTRY` na posição original;
- se o OUTBOUND original possuía `lotId` e a validade é recuperável, a entrada manual pode criar uma referência técnica de validade;
- se o OUTBOUND original não possuía `lotId`, a devolução pode recompor físico/agregado sem criar lote.

Por isso, qualquer prova causal precisa calcular **OUTBOUND sem lote líquido de devoluções**.

### 3.4 TRANSFER

`TRANSFER` altera somente a distribuição física e possui `quantityDelta = 0` no saldo agregado.

Transferência pode explicar divergência **por posição**, mas não cria sozinha excesso global de lotes sobre o físico. Ainda assim, deve aparecer na timeline para excluir casos históricos de posição de lote desatualizada.

## 4. Leitura viva forense #1 e evolução causal

A primeira execução viva do dry-run foi concluída em
`2026-10-06T00:25:48.658Z`, com **3.057 reads** e nenhuma coleção
capped. Nenhuma escrita foi realizada.

### 4.1 Material A — evidência viva

`mat_272f2d996ee65ed3530ad2d7e27b66d7`

A leitura mostrou:

- lotExcess: **100**;
- OUTBOUND sem lote bruto: **60**;
- devolução: **5**;
- OUTBOUND sem lote líquido: **55**;
- dois OUTBOUNDs históricos, ambos em `UNASSIGNED`, de 50 e 10;
- lote de origem INVOICE com quantidade **100**;
- lote `lot_670e1ca177804501b90bf8cdd669683f` de origem
  `MANUAL_ENRICHMENT`, quantidade **440**, criado em
  `2026-09-28T10:27:04.639462Z`.

Conclusão da primeira versão do analisador: OUTBOUND sem lote **não explica
sozinho** o +100, porque 55 líquidos != 100.

A reconstrução temporal revelou um mecanismo causal mais forte:

1. INVOICE_ENTRY colocou **500** no ledger;
2. foi criado um lote INVOICE de **100**;
3. ocorreram saídas sem lote de **50** e **10**;
4. no instante da criação do lote MANUAL_ENRICHMENT de **440**, o saldo
   derivado do ledger era **440**;
5. a nova atribuição de 440 foi criada sem substituir/inativar o lote INVOICE
   preexistente de 100;
6. a soma de lotes passou para **540** enquanto o ledger estava em **440**;
7. o excesso introduzido naquele evento foi exatamente **+100**.

O código histórico que permitia adicionar validade a item sem lote criava uma
nova referência técnica com `quantity = row.quantity`. O contrato de
`createWarehouseLot()` valida a quantidade do **novo lote** contra o saldo,
mas não valida a soma de todos os lotes ativos existentes contra o saldo.
Esse mecanismo é compatível com o documento vivo `MANUAL_ENRICHMENT`.

**Candidato causal v2, ainda pendente de confirmação pela reexecução viva:**

`lot_670e1ca177804501b90bf8cdd669683f`

Estado previsto pelo v2:

`440 -> 340`

O valor não é escolhido por diferença bruta arbitrária: ele deriva do evento
de criação que introduziu exatamente +100 de sobre-atribuição.

### 4.2 Material B — evidência viva

`mat_6feb0840ca4060f7d69fcce1663f21b8`

A leitura mostrou:

- lotExcess: **10**;
- OUTBOUND sem lote líquido: **10**;
- nenhum retorno;
- dois lotes de 50, ambos ligados ao mesmo intake/NF;
- o primeiro lote foi criado **77 ms** depois do primeiro TRANSFER de
  alocação;
- o segundo lote `lot_082ebcd7a2acf0c706c87464307cb1ff` foi criado
  **81 ms** depois do segundo TRANSFER de alocação;
- esse segundo TRANSFER tinha como destino a subposição
  `sub_43397d13f1924addb1383aa31c151b62`;
- a única saída de 10 ocorreu depois exatamente dessa subposição e com
  `lotId = null`.

A primeira versão do dry-run retornou `perPositionNoLotMatch=false` porque
comparava a posição histórica da saída com a posição **final atual** do lote.
Isso era conservador, mas insuficiente para seguir a linhagem.

O analisador v2 agora recupera `TRANSFER.quantity/from/to` e infere a posição
de origem histórica de cada lote pelo TRANSFER imediatamente anterior à sua
criação. Com isso, o segundo lote de 50 pode ser distinguido do primeiro sem
depender apenas do código técnico duplicado.

**Candidato causal v2, ainda pendente de confirmação pela reexecução viva:**

`lot_082ebcd7a2acf0c706c87464307cb1ff`

Estado previsto pelo v2:

`50 -> 40`

### 4.3 Material de controle

`mat_bb6d4a089c224b1a48ad3a43f32170a3`

Permanece quantitativamente canônico:

`aggregate = physical = activeLots = ledger = 100`

A duplicidade técnica aparente continua sendo evidência de que dois documentos
com o mesmo código técnico não são, isoladamente, prova de erro quantitativo.

### 4.4 Leitura viva v2 — confirmação final

A segunda execução viva do analisador causal v2 foi concluída em
`2026-10-06T00:42:35.515Z`, com **3.057 reads**, nenhuma coleção capped e
nenhuma escrita.

Resultado:

- Material A: `causeProven = true`, `repairDeterministic = true`;
- Material B: `causeProven = true`, `repairDeterministic = true`;
- controle: sem blocker quantitativo;
- classificação global:
  **PASS — CAUSA PROVADA / REPAIR PLAN PRONTO PARA APROVAÇÃO**;
- `readyForHumanRepairAuthorization = true`.

A execução viva confirmou exatamente os candidatos previstos pelo v2.

#### Material A confirmado

Documento:

`warehouse/hgesm-aprov/lots/lot_670e1ca177804501b90bf8cdd669683f`

Before:

`quantity = 440`

After proposto:

`quantity = 340`

Delta:

`-100`

Causa comprovada:

`MANUAL_ENRICHMENT_CRIOU_ATRIBUICAO_DE_LOTE_ACIMA_DO_LEDGER`

Evidência quantitativa:

- cumulativeActiveLotQuantityAfterCreation = **540**;
- ledgerBalanceAtCreation = **440**;
- overAggregateAfterCreation = **100**.

#### Material B confirmado

Documento:

`warehouse/hgesm-aprov/lots/lot_082ebcd7a2acf0c706c87464307cb1ff`

Before:

`quantity = 50`

After proposto:

`quantity = 40`

Delta:

`-10`

Causa comprovada:

`OUTBOUND_SEM_LOTID_NAO_REDUZIU_ATRIBUICAO_LOGISTICA_DE_LOTE`

Evidência quantitativa e histórica:

- OUTBOUND sem lotId líquido = **10**;
- lote causal identificado pela posição histórica
  `sub_43397d13f1924addb1383aa31c151b62`;
- movimento causal:
  `mov_fc391dd2a9b6b0fbbee257595376305ab1c3dd39352241a1b8896c24a912a3b6`;
- grossOutboundQuantity = **10**;
- returnedQuantity = **0**;
- netOutboundQuantity = **10**.

A forensics está, portanto, concluída.

**NÃO EXECUTE REPAIR NESTA FRENTE.**
A classificação PASS significa que o plano está pronto para aprovação humana,
não que a escrita esteja autorizada ou executada.

## 5. Dry-run criado

Arquivo:

`scripts/warehouse-data-repair-dry-run.mjs`

Contrato:

- alvo fixado por `ops/firestore-recovery.json` + `ops/hgesm-workspace-migration.json`;
- exige confirmação explícita de project/database/workspace;
- usa somente Firestore REST **HTTP GET**;
- não importa SDK Firestore de escrita;
- não executa repair, migration, backfill, restore ou alteração de Rules;
- examina somente coleções necessárias à forensics;
- analisa os dois blockers e o material de controle;
- reconstrói timeline por material;
- cruza movimentos, consumptions, withdrawals, returns, intakes, lotes e location balances;
- preserva em TRANSFER: quantidade, posição de origem e posição de destino;
- reconstrói linhagem provável de lote a partir do TRANSFER imediatamente anterior à criação/atualização;
- calcula saldo derivado do ledger no instante de cada criação de lote;
- detecta MANUAL_ENRICHMENT que introduz sobre-atribuição exatamente mensurável;
- calcula OUTBOUND sem lote bruto e líquido de devoluções;
- relaciona OUTBOUND sem lote à posição histórica de criação do lote;
- identifica duplicidade técnica de lote sem tratá-la automaticamente como causa;
- falha fechado se houver OUTBOUND legado/não classificável;
- falha fechado se houver movimento quantitativo concorrente (`INVENTORY_ADJUSTMENT`, `INVOICE_CORRECTION`, `REVERSAL`, `OUTBOUND_RETURN`);
- só gera candidato de repair quando o mecanismo fecha quantitativamente, não há hipótese concorrente concreta **e existe exatamente um lote afetado**, evitando escolher arbitrariamente entre múltiplos lotes;
- gera precondições de concorrência usando quantidade do lote, `updatedAt`, revisão/lastMovementId do balance e conjunto de lotes ativos da posição;
- mantém `approvedBy = null` e `executedAt = null`.

### Execução canônica

```powershell
$Gcloud = "$env:LOCALAPPDATA\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd"
$env:WAREHOUSE_AUDIT_ACCESS_TOKEN = (& $Gcloud auth print-access-token).Trim()

node scripts/warehouse-data-repair-dry-run.mjs `
  --project=gen-lang-client-0982077967 `
  --database=emprovex-warehouse `
  --workspace=hgesm-aprov `
  --page-size=200 `
  --max-docs-per-collection=5000 |
  Tee-Object -FilePath warehouse-data-repair-forensics-live.txt

Remove-Item Env:WAREHOUSE_AUDIT_ACCESS_TOKEN
```

A primeira execução viva foi realizada pelo Fundador e preservada como evidência.
Após essa execução, o analisador foi evoluído para v2. A segunda execução viva
também foi concluída e confirmou os documentos candidatos e o manifesto final.

## 6. Teste de contrato criado

Arquivo:

`scripts/warehouse-data-repair-dry-run.test.mjs`

Cobre:

1. decodificação REST;
2. Material A: INVOICE_ENTRY 500 + lote 100 + saídas 50/10 +
   MANUAL_ENRICHMENT 440, provando sobre-atribuição de +100;
3. Material B: duas alocações de 50 em posições distintas, OUTBOUND sem lotId
   de 10 na segunda posição, identificando o lote causal 50 -> 40;
4. material de controle com duplicidade documental sem excesso;
5. guard estático que exige `method: 'GET'` e rejeita POST/PUT/PATCH/DELETE,
   `:commit`, `:batchWrite`, `:rollback` e SDK Firestore.

Validação executada neste worker sobre o conteúdo do analisador v2:

- sintaxe do módulo e do teste: **PASS**;
- cenário sintético equivalente ao Material A: **PASS**;
- cenário sintético equivalente ao Material B: **PASS**;
- controle sem blocker: **PASS**;
- classificação sintética combinada:
  **PASS — CAUSA PROVADA / REPAIR PLAN PRONTO PARA APROVAÇÃO**;
- guard estático GET-only: **PASS**;
- ausência de métodos HTTP POST/PUT/PATCH/DELETE: **PASS**;
- ausência de endpoints `:commit`, `:batchWrite`, `:rollback`: **PASS**;
- ausência de SDK Firestore/Admin no dry-run: **PASS**.

Essa validação prova o algoritmo, não substitui a reexecução viva v2.
## 7. Evidência de recovery/backup identificada

Backup Warehouse já comprovado em HARDEN-B:

- projeto: `gen-lang-client-0982077967`
- database: `emprovex-warehouse`
- região: `us-east1`
- resource:
  `projects/gen-lang-client-0982077967/locations/us-east1/backups/5640c06e-229b-4cab-82a8-e7425dc035a3`
- estado observado: **READY**
- snapshot: `2026-10-03T17:05:24.058789Z`
- expiração: `2027-01-09T17:05:24.058789Z`

Esse backup já foi restaurado com sucesso no target isolado:

`emprovex-restore-warehouse-2026-10-04`

A validação pós-restore registrou igualdade exata em **13/13 coleções** verificadas.

Esse backup comprova recuperabilidade e fornece um ponto de recuperação concreto. Ele **não substitui** a precondição operacional do repair futuro: imediatamente antes de qualquer escrita autorizada, a frente executora deverá reconfirmar um backup/PITR válido e suficientemente recente para preservar o estado pré-repair.

Nenhum novo backup ou restore foi executado nesta frente.

## 8. Repair manifest — estrutura preparada

O dry-run emite manifesto contendo:

- `repairId`;
- `materialId`;
- `path`;
- `before`;
- `after`;
- `delta`;
- causa;
- evidência;
- precondições;
- rollback;
- `approvedBy = null`;
- `executedAt = null`.

### Idempotência prevista para a futura frente autorizada

Um executor futuro deverá exigir:

- `repairId` estável;
- `expected-before`;
- `expected-after`;
- comparação de `updatedAt`;
- comparação de `balance.revision`;
- comparação de `balance.lastMovementId`;
- conjunto esperado de IDs de lote ativos;
- abortar se qualquer precondição divergir.

Executar a mesma autorização duas vezes não poderá aplicar o delta duas vezes.

### Rollback

Preferência:

1. manifesto before/after preservado;
2. backup Warehouse READY identificado;
3. rollback somente dos documentos explicitamente alterados;
4. ledger `movements` permanece append-only e nunca deve ser editado como “rollback”.

Enquanto os documentos exatos não forem causalmente identificados, rollback executável ainda não está fechado.

## 9. Resultado por blocker — final

| Critério | Material A | Material B |
| --- | --- | --- |
| CAUSA COMPROVADA? | **SIM** | **SIM** |
| REPAIR NECESSÁRIO? | **SIM** | **SIM** |
| REPAIR DETERMINÍSTICO? | **SIM** | **SIM** |
| DOCUMENTOS EXATOS IDENTIFICADOS? | **SIM** | **SIM** |
| CANDIDATO | **lot_670e1ca...** | **lot_082ebcd7...** |
| BEFORE -> AFTER | **440 -> 340** | **50 -> 40** |
| BACKUP IDENTIFICADO? | **SIM** | **SIM** |
| ROLLBACK DEFINIDO? | **SIM** | **SIM** |
| PRONTO PARA AUTORIZAÇÃO HUMANA DE REPAIR? | **SIM** | **SIM** |

## 10. Gate obrigatório antes da futura escrita

A forensics não exige mais evidência causal adicional.

A futura frente de repair deverá, imediatamente antes de escrever:

1. reexecutar o dry-run read-only;
2. confirmar que os dois candidatos continuam exatamente iguais ao manifesto;
3. abortar se `revision`, `lastMovementId`, `updatedAt`, quantidade ou
   conjunto de lotes ativos tiver mudado;
4. confirmar backup/PITR Warehouse READY e suficientemente recente para
   representar o estado pré-repair;
5. manter `movements` append-only;
6. registrar aprovação humana explícita;
7. executar somente os dois documentos autorizados.

Qualquer divergência de precondição exige:

**ABORT — REFORENSICS REQUIRED**
## 11. Hipóteses descartadas ou não provadas

- **UNASSIGNED +5 do Material A:** fato separado; explica aggregate 445 vs physical 440, mas não explica automaticamente +100 de lotes.
- **duplicidade técnica por si só:** descartada como explicação universal pelo material de controle.
- **TRANSFER isolado:** não explica excesso global porque não altera o total agregado.
- **retry de intake:** não provado; runtime atual possui guardas idempotentes, mas isso não prova o comportamento histórico de todos os documentos.
- **INVENTORY_ADJUSTMENT:** deve ser lido na timeline viva; auditoria anterior não registrou sessões de inventário no universo atual.
- **operação anterior à arquitetura atual:** permanece possível enquanto timestamps/documentos históricos não forem cruzados.

## 12. Rules / runtime

`RULES-COMPAT-01 = PASS` permanece autoridade.

Não foram alterados:

- `firestore.rules`;
- `firestore.warehouse.rules`;
- MOBILE-K;
- Inventário TOTAL;
- performance geral.

Se uma futura execução de repair exigir permissão adicional:

**RULES CHANGE REQUIRED — COORDENADOR REVIEW**

## 13. Classificação final desta entrega

**PASS — CAUSA PROVADA / REPAIR PLAN PRONTO PARA APROVAÇÃO**

Motivo:

- leitura viva v2 concluída com **3.057 reads** e nenhuma coleção capped;
- Material A com causa comprovada por sobre-atribuição de
  `MANUAL_ENRICHMENT`;
- Material B com causa comprovada por OUTBOUND sem `lotId` associado
  deterministicamente ao lote histórico correto;
- documentos exatos identificados;
- before/after e deltas definidos;
- precondições de concorrência registradas;
- backup/recovery identificado;
- rollback definido;
- `readyForHumanRepairAuthorization = true`.

A frente WAREHOUSE-DATA-REPAIR-FORENSICS-01 está tecnicamente concluída.

**NENHUM REPAIR FOI EXECUTADO.**
A escrita deve ocorrer somente em uma frente separada, após autorização humana
explícita e reconfirmação das precondições e do backup.
