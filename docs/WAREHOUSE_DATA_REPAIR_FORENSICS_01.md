# WAREHOUSE-DATA-REPAIR-FORENSICS-01

Status: **BLOCKED — CAUSALIDADE INSUFICIENTE PARA REPAIR SEGURO**

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

## 4. Hipótese causal principal

Hipótese forte:

**OUTBOUND sem `lotId` reduziu saldo físico/agregado sem reduzir a atribuição logística de lote.**

Essa hipótese é sustentada pelo código e pelo contrato da FASE 8, mas **ainda não é classificada como CAUSA COMPROVADA nos dados reais** porque o relatório preservado da auditoria anterior não imprimiu os movimentos OUTBOUND individuais, seus `lotId`, quantidades, posições e timestamps.

Não é seguro inferir que:

- os +100 do Material A correspondem ao líquido de OUTBOUND sem lote;
- os +10 do Material B correspondem ao líquido de OUTBOUND sem lote;
- um dos lotes duplicados do Material B é necessariamente o documento incorreto.

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
- calcula OUTBOUND sem lote bruto e líquido de devoluções;
- compara excesso por posição com OUTBOUND sem lote líquido;
- identifica duplicidade técnica de lote;
- só gera candidato de repair quando o mecanismo fecha quantitativamente **e existe exatamente um lote afetado**, evitando escolher arbitrariamente entre múltiplos lotes;
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

A execução viva deve ser feita somente com credencial de leitura adequada. O worker atual não recebeu token/gcloud utilizável no ambiente de execução e, portanto, **não fabricou uma leitura viva**.

## 6. Teste de contrato criado

Arquivo:

`scripts/warehouse-data-repair-dry-run.test.mjs`

Cobre:

1. decodificação REST;
2. cenário com OUTBOUND sem `lotId` fechando o excesso por posição;
3. cenário com duplicidade de lote e repair não determinístico;
4. material de controle com duplicidade documental sem excesso;
5. guard estático que exige `method: 'GET'` e rejeita POST/PUT/PATCH/DELETE, `:commit`, `:batchWrite`, `:rollback` e SDK Firestore.

Validação executada neste worker sobre o conteúdo exato do HEAD:

- sintaxe do módulo e do teste: **PASS** após correção do guard de newline;
- núcleo analítico executado em runtime JavaScript com fixtures equivalentes: **15/15 asserções PASS**;
- guard estático GET-only: **PASS**;
- ausência de métodos HTTP POST/PUT/PATCH/DELETE: **PASS**;
- ausência de endpoints `:commit`, `:batchWrite`, `:rollback`: **PASS**;
- ausência de SDK Firestore/Admin no dry-run: **PASS**;
- ausência de caracteres de controle inválidos: **PASS**.

O shell isolado não conseguiu resolver `github.com` para executar `node --test` em checkout local; por isso o CI do PR continua sendo a evidência de integração no repositório.

## 7. Backup que protege o futuro repair

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

## 9. Resultado por blocker no estado atual

| Critério | Material A | Material B |
| --- | --- | --- |
| CAUSA COMPROVADA? | **NÃO** | **NÃO** |
| REPAIR NECESSÁRIO? | **SIM** | **SIM** |
| REPAIR DETERMINÍSTICO? | **NÃO** | **NÃO** |
| DOCUMENTOS EXATOS IDENTIFICADOS? | **NÃO** | **NÃO** |
| BACKUP IDENTIFICADO? | **SIM** | **SIM** |
| ROLLBACK DEFINIDO? | **NÃO** | **NÃO** |
| PRONTO PARA AUTORIZAÇÃO HUMANA DE REPAIR? | **NÃO** | **NÃO** |

Observação: “REPAIR NECESSÁRIO = SIM” decorre do blocker quantitativo já comprovado. Isso não autoriza escolher `540 → 440` ou `100 → 90` sem identificar documentalmente **qual lote está errado e por quê**.

## 10. Evidência adicional obrigatória

Para sair de BLOCKED é necessário executar o dry-run vivo e preservar o JSON entre:

`FORENSICS_JSON_BEGIN`

e:

`FORENSICS_JSON_END`

A análise só pode promover a hipótese de OUTBOUND sem lote para **CAUSA COMPROVADA** quando, para cada blocker:

1. o excesso global de lotes corresponder ao OUTBOUND sem `lotId` líquido de devoluções;
2. a mesma igualdade fechar por posição;
3. timestamps forem coerentes com lote existente antes das saídas;
4. não houver operação concorrente ou outro mecanismo quantitativo capaz de explicar o mesmo delta;
5. o documento de lote a corrigir puder ser determinado sem escolha arbitrária.

Se múltiplos lotes permanecerem elegíveis para receber a redução e nenhum vínculo histórico os distinguir, o caso continua:

**FORENSICS INCONCLUSIVE — REPAIR NÃO AUTORIZÁVEL**

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

**BLOCKED — CAUSALIDADE INSUFICIENTE PARA REPAIR SEGURO**

Motivo:

- mecanismo causal plausível e reproduzível no código foi identificado;
- tooling read-only de forensics/dry-run foi preparado;
- backup válido foi identificado;
- porém os eventos reais individuais ainda não foram lidos nesta frente;
- portanto não há base para selecionar documentos de repair nem autorizar escrita.

**NÃO EXECUTE REPAIR.**
