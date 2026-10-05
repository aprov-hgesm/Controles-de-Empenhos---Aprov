# WAREHOUSE-DATA-AUDIT-01 — Auditoria de integridade logística e legado

Data da auditoria: 2026-10-05  
Branch: `warehouse-data-audit-01`  
Base congelada: `bd27da91da92642d5a5fea08f7020c6cea658a62`  
Base de PR: `rc-r1-mobile-j-fix-label-readability`

## 1. Escopo e garantias

Esta frente é exclusivamente de auditoria/read-only. Nenhum dado real foi alterado, migrado, reconciliado, apagado ou submetido a backfill. Nenhuma Firestore Rule, índice, TTL, código da MOBILE-K ou produção foi alterado.

A análise combina:

- inspeção estática do frozen baseline;
- leitura do Memorial canônico em `feat/saas-r1-commercializacao@d7837257d56ca0be5d0c32426b164696441b7541`;
- leitura read-only da direção arquitetural atual da `mobile-r1-k-canonical-ops-engine`;
- testes e CI já associados ao frozen baseline;
- a evidência operacional informada no caso PAL-01: 440 L de saldo físico localizado e 540 L em lotes ativos observados.

Não houve acesso read-only ao Firestore vivo nesta execução. Portanto, causas que dependem de documentos reais, revisões, IDs, timestamps ou sequência histórica permanecem hipótese até uma reconciliação diagnóstica explicitamente autorizada.

## 2. Conclusão executiva

O contrato canônico é inequívoco:

1. pendência pertence ao intake;
2. estoque físico operacional existe apenas em `LOCATION` ou `SUBPOSITION` ativa;
3. `UNASSIGNED` é uma projeção técnica/legada e não deve ser promovida a “estoque sem localização” operacional nem classificada automaticamente como pendência;
4. lote é atribuição/rastreabilidade, não fonte de saldo;
5. saída e inventário físico devem operar sobre posição física;
6. divergências devem ser expostas e reconciliadas, nunca corrigidas silenciosamente.

A maior parte dos fluxos modernos já respeita isso, especialmente saída física, consulta física móvel e consumo imediato integral. Entretanto, o frozen baseline ainda contém contratos antigos relevantes:

- o ledger genérico espelha movimentos não-`TRANSFER` em `UNASSIGNED` para manter uma projeção técnica;
- transferência genérica ainda aceita `UNASSIGNED` como origem/destino;
- UI e utilitários antigos ainda apresentam “Sem localização” como fila operacional;
- **inventário `TOTAL` inclui `UNASSIGNED` por contrato e há teste explícito garantindo esse comportamento**, o que conflita diretamente com o novo contrato de inventário físico;
- a soma de lotes pode divergir do saldo físico por desenho, e há caminhos concretos que reduzem saldo físico sem reduzir lote quando a operação não está vinculada a um lote.

A MOBILE-K corrente já corrige parte importante da direção: transferência física rejeita posição não física, consulta móvel chama `UNASSIGNED` de projeção legada em reconciliação e não de pendência/estoque, e o intake v1 alocado é bloqueado para reconciliação. Porém, no snapshot read-only consultado, os arquivos de inventário não estão no delta da MOBILE-K.

**Classificação final desta auditoria: BLOCKER — INTEGRIDADE LOGÍSTICA IMPEDE RC.**

O blocker não significa corrupção generalizada comprovada. Significa que o RC não deve ser certificado enquanto: (a) o inventário TOTAL ainda puder transformar a projeção `UNASSIGNED` em item de contagem física; e (b) o caso PAL-01 440 L vs 540 L continuar sem reconciliação diagnóstica suficiente para liberar operações que dependem de lotes.

## 3. Mapa de fontes da verdade

| Domínio | Fonte canônica | Projeção derivada | Pode escrever? | Correção manual direta? | Pode divergir? | Reconciliação |
| --- | --- | --- | --- | --- | --- | --- |
| NF / recebimento | fonte canônica de invoices + estado `intakes` v2 | fila de intake | sim, pelos fluxos do domínio | não | sim, legado/orfandade vira `RECONCILIATION_REQUIRED` | comparar NF, intake e evidência de movimentos |
| Material | `materials` | views/consultas | sim, repositório de material | não | identidade pode ter legado | normalizar/vincular via fluxo explícito |
| Movement ledger | `movements` | histórico/relatórios | append operacional/idempotente | não | não deve divergir de si mesmo | novo movimento/reversão, nunca reescrita histórica |
| Balance agregado | `balances/{materialId}` | soma materializada dos deltas do ledger | sim, transacional | não | pode divergir de locationBalances se legado/bug | recomputar em diagnóstico e corrigir só por operação autorizada |
| Saldo por posição | `locationBalances` | distribuição física + bucket técnico legado | sim, transacional | não | sim, se projeção histórica inconsistente | comparar com aggregate e estrutura ativa/inativa |
| Lote | `lots` | atribuição de validade/origem | sim | somente pelo fluxo de lote | **sim legitimamente para menos; acima do saldo é inconsistente** | comparar lote por posição com saldo físico |
| Barcode | `barcodes` | lookup de material/apresentação | sim | via fluxo de associação | pode ficar sem correspondência operacional | validar material/status |
| Withdrawal | `withdrawals` + movements/consumptions | progresso/finalização | sim | não | pode ficar parcial em retry | identidades idempotentes por withdrawal/line |
| Consumption | `consumptions` | SISCOFIS/relatórios | sim | não | origem pode ser stock ou immediate | cruzar movement/intake conforme origem |
| Inventory | `inventories` + `inventoryItems` | snapshot de contagem | sim | não | pode ficar stale/reconciliation | revalidar revisões e aplicar INVENTORY_ADJUSTMENT |
| Outbound return | consumo original + movement original + `outboundReturns` | resumo de devolução | sim | não | pode ter pending operation | restaurar via operação idempotente vinculada à saída |

### Regra de precedência

- `movements` explicam mutações quantitativas auditáveis.
- `balances` é projeção agregada operacional.
- `locationBalances` é a projeção de distribuição; somente `LOCATION`/`SUBPOSITION` ativa representa estoque físico disponível.
- `lots` não substitui saldo.
- `intakes` v2 define o que ainda está pendente de tratamento.
- `UNASSIGNED` não é fonte canônica de disponibilidade.

## 4. Intake v1 / v2

### v2 — CANONICAL

Contrato observado:

`pendingQuantity = receivedQuantity - allocatedQuantity - immediateConsumptionQuantity`

com tolerância numérica de `0.000001`.

Estados:

- `PENDING`: nada ou praticamente nada tratado;
- `PARTIALLY_PROCESSED`: parte alocada/consumida;
- `PROCESSED`: pendência zerada;
- `RECONCILIATION_REQUIRED`: estado efetivo usado quando fonte canônica e persistência/histórico não podem ser conciliados com segurança.

Uma pendência de intake não é estoque físico.

### v1 — LEGACY_BUT_EXPLAINABLE

Registros completados v1 podem ser lidos para compatibilidade. O fluxo alocado antigo, porém, usava entrada no ledger seguida de `UNASSIGNED -> posição`, e está em conflito com o contrato novo. Na MOBILE-K atual, a alocação v1 antiga é explicitamente bloqueada com `WAREHOUSE_LEGACY_INTAKE_RECONCILIATION_REQUIRED`.

## 5. UNASSIGNED — mapa e classificação

| Uso | Classificação | Observação |
| --- | --- | --- |
| tipo `WarehouseStockPosition` e parser de compatibilidade | LEGACY_BUT_EXPLAINABLE | necessário para ler estado histórico |
| espelho técnico do ledger em `ledgerRepository` | LEGACY_BUT_EXPLAINABLE | movimentos não-TRANSFER alteram aggregate e bucket técnico |
| ponte interna de intake v2 após `INVOICE_ENTRY` | LEGACY_BUT_EXPLAINABLE | mecanismo contábil interno; não é posição física |
| consumo imediato não-lightweight contra bucket técnico | LEGACY_BUT_EXPLAINABLE | compensa ledger já materializado; sem criar estoque físico |
| transferência genérica permitindo UNASSIGNED | DOMÍNIO OBSOLETO / CANDIDATO À REMOÇÃO OPERACIONAL | MOBILE-K já introduz preparação de transferência exclusivamente física |
| `buildWarehousePositionLabel -> "Sem localização"` | UI OBSOLETA | rótulo não deve sugerir disponibilidade |
| utilitário “Materiais sem localização” | DOMÍNIO/UI OBSOLETO | aggregate - physical é diagnóstico, não fila de estoque |
| consulta móvel congelada exibindo “Saldo sem localização” | UI OBSOLETA | MOBILE-K já reclassifica como projeção legada em reconciliação |
| lotes com posição UNASSIGNED | COMPATIBILIDADE HISTÓRICA | não devem ser oferecidos como estoque físico |
| outbound físico | CANONICAL | rejeita UNASSIGNED |
| mobile physical query | CANONICAL | rejeita UNASSIGNED |
| mobile inventory por posição | CANONICAL | rejeita UNASSIGNED |
| inventário TOTAL | **INCONSISTENT** | hoje retorna true para UNASSIGNED e cria item físico de contagem |

Não classificar `UNASSIGNED` automaticamente como `PENDING`. O único meio seguro de chamar uma quantidade de pendente é haver evidência canônica do intake v2.

## 6. Ledger, balance e locationBalances

### Ledger

`movements` é histórico operacional append-only por contrato dos repositórios: novas operações criam movimentos idempotentes; reversões são representadas por novos movimentos e não por edição silenciosa do passado.

Tipos relevantes observados incluem:

- `INITIAL_BALANCE`;
- `MANUAL_ENTRY`;
- `INVOICE_ENTRY`;
- `OUTBOUND`;
- `OUTBOUND_RETURN`;
- `TRANSFER`;
- `INVENTORY_ADJUSTMENT`;
- `REVERSAL`.

`TRANSFER` tem delta agregado zero e move quantidade entre `locationBalances`.

### Balance agregado

`balances/{materialId}` é a projeção agregada produzida por `applyWarehouseMovementToBalance`.

Ela não deve ser chamada de “estoque físico” isoladamente. Pode incluir quantidade ainda representada tecnicamente por `UNASSIGNED`.

### Location balances

Separação:

- `LOCATION`: estoque físico se estrutura ativa;
- `SUBPOSITION`: estoque físico se hierarquia ativa;
- `UNASSIGNED`: compatibilidade/projeção técnica, nunca disponibilidade física normal.

Condição de coerência desejada da projeção:

`aggregateBalance ~= sum(all locationBalances, incluindo bucket técnico legado)`

Mas disponibilidade física é:

`physicalActive = sum(locationBalances físicos em estrutura ativa)`

e não o aggregate.

## 7. Lotes

O próprio contrato do lote declara que `lot.quantity` é atribuição logística/rastreabilidade e **não é saldo contábil**.

Consequências:

- lote pode ser menor que o saldo físico: quantidade física sem atribuição de lote é permitida;
- soma de lotes maior que saldo físico é inconsistência;
- criar/editar lote valida o teto contra o saldo existente naquele instante;
- transferência pode mover/splitar lotes preservando código, validade e origem;
- saída reduz lote somente quando um lote foi explicitamente selecionado;
- inventário ajusta aggregate + locationBalance, mas não ajusta lote.

Portanto existem mecanismos concretos capazes de deixar lote stale depois de uma mutação de saldo, mesmo que a criação original do lote tenha sido válida.

## 8. Saída

### CANONICAL

`applyWarehouseExpressOutbound`:

- rejeita `UNASSIGNED`;
- exige posição física;
- exige `locationBalance`;
- revalida saldo agregado e saldo da posição;
- reduz aggregate e locationBalance na mesma transação;
- reduz lote quando `lotId` é fornecido;
- impede saldo negativo.

Saída não consome pendência de intake diretamente. Consumo imediato é outro domínio.

### Risco de lote

Se uma saída física não estiver vinculada a um lote, o saldo físico cai e os lotes não são alterados. Isso é uma hipótese concreta para `lot sum > physical stock`.

## 9. Transferência

No frozen baseline, `transferWarehouseStock` ainda aceita `UNASSIGNED` por compatibilidade. Isso não é aceitável como transferência física operacional no contrato novo.

A implementação corrente da MOBILE-K, consultada somente em leitura, introduz:

- tipo de posição física excluindo `UNASSIGNED`;
- rejeição `NON_PHYSICAL_POSITION`;
- planejamento de lotes baseado no saldo físico;
- bloqueio `LOT_ATTRIBUTION_EXCEEDS_STOCK`;
- movimentação de quantidade sem lote como `unattributedQuantity`, sem inventar lote.

Recomendação: preservar essa direção e garantir que todas as UIs/entradas operacionais usem exclusivamente o caminho físico canônico.

## 10. Consumo imediato

Dois caminhos existem no frozen baseline.

### Caminho leve — CANONICAL

Quando toda a quantidade recebida é consumida imediatamente antes de qualquer alocação:

- atualiza intake;
- cria consumption;
- `movementId = null`;
- não cria material stock;
- não cria locationBalance físico;
- não cria lote;
- não exige depósito;
- não transfere.

### Caminho com ledger já materializado — LEGACY_BUT_EXPLAINABLE

Quando já existe contexto de entrada/ledger, o código usa um `OUTBOUND` interno contra a projeção técnica `UNASSIGNED` para neutralizar a parcela consumida e manter aggregate/ledger coerentes. Isso é mecanismo técnico; não deve aparecer ao usuário como estoque físico ou “Sem localização” disponível.

## 11. Inventário — achado blocker

O domínio define que `warehouseInventoryScopeIncludesPosition` faz:

1. se o escopo for `TOTAL`, retorna `true`;
2. só depois rejeita `UNASSIGNED` para escopos não-TOTAL.

`startWarehouseInventory` usa essa função para montar os itens a partir de `locationBalances` positivos.

Resultado: **inventário TOTAL inclui UNASSIGNED**.

Há ainda um teste explícito em `scripts/warehouse-inventory.test.mjs` afirmando:

`warehouseInventoryScopeIncludesPosition({ kind: 'TOTAL' }, { kind: 'UNASSIGNED' }) === true`.

Sob o contrato novo, isso é `INCONSISTENT`: inventário físico total deve significar todas as posições físicas, não a projeção técnica.

Recomendação ao Coordenador/MOBILE-K:

- alterar o contrato de TOTAL para excluir `UNASSIGNED`;
- atualizar o teste antigo para a nova semântica;
- manter reconciliação aggregate-vs-projeções como diagnóstico separado do inventário físico;
- validar que nenhuma tela de inventário oferece “Sem localização” para contagem.

## 12. Consultar item

Frozen baseline:

- aggregate vem de `balances/{materialId}`;
- localização física vem de `locationBalances`;
- lotes vêm de `lots`;
- `UNASSIGNED` entra somente na reconciliação;
- intake pending **não é consultado** no read model móvel;
- a UI frozen exibe aggregate e “Saldo sem localização”, o que pode induzir interpretação errada.

A MOBILE-K já melhora isso:

- exibe “Estoque físico localizado” com `activePhysicalQuantity`;
- declara que pendências pertencem ao intake;
- chama `UNASSIGNED` de projeção legada em reconciliação;
- não oferece `UNASSIGNED` para retirada.

Recomendação: manter o aggregate apenas como dado diagnóstico e nunca somá-lo à pendência ou ao físico.

## 13. PAL-01 / 440 L vs 540 L

### FATOS

- saldo físico localizado observado: 440 L;
- soma de lotes ativos observada: 540 L;
- diferença observada: +100 L em atribuição de lotes sobre o físico.

### EVIDÊNCIAS DE CÓDIGO

- lote não é fonte de saldo;
- o domínio possui detecção explícita `LOT_ATTRIBUTION_EXCEEDS_STOCK`;
- saída sem `lotId` reduz físico sem reduzir lotes;
- ajuste de inventário reduz/aumenta saldo sem sincronizar lotes;
- transferência legada pode mover quantidade sem alocações completas de lote;
- lotes legados/manualmente enriquecidos podem sobreviver a operações posteriores.

### HIPÓTESES

1. saída antiga ou atual sem lote atribuído;
2. ajuste de inventário posterior à criação dos lotes;
3. transferência antiga/parcial sem movimentação equivalente das atribuições;
4. lote legado ou manual que ficou stale;
5. lote em posição física diferente/inativa;
6. duplicidade histórica de atribuição;
7. devolução/operação antiga com projeção incompleta.

### O QUE NÃO PODE SER CONCLUÍDO

Sem leitura dos documentos vivos de PAL-01 e do histórico correspondente, não é possível afirmar qual hipótese gerou exatamente os 100 L.

### RISCO OPERACIONAL

Alto para operações que dependem de lote: a MOBILE-K corretamente tende a bloquear transferência quando a soma dos lotes ativos excede o saldo físico da origem.

### RECOMENDAÇÃO

Executar reconciliação **read-only** de PAL-01 antes do RC, obtendo no mínimo:

- materialId;
- aggregate balance + revision + lastMovementId;
- todos os locationBalances do material;
- todos os lotes ativos/inativos, posição, origem e updatedAt;
- movimentos OUTBOUND/TRANSFER/INVENTORY_ADJUSTMENT/OUTBOUND_RETURN do material;
- consumptions e returns vinculados;
- inventários que tocaram a posição.

Somente depois definir uma correção explícita. Não fazer reparo automático.

## 14. Matriz conceitual por material

| Valor | Significado | Relação obrigatória |
| --- | --- | --- |
| received | quantidade recebida no intake | por intake: `received = allocated + immediateConsumed + pending` |
| pending | ainda não tratado | nunca é estoque físico |
| allocated | parcela tratada por alocação | deve possuir evidência de alocação física |
| immediateConsumed | consumo direto | reduz pending sem criar físico |
| physicalActive | soma em posições físicas ativas | disponibilidade operacional |
| physicalInactive | soma em posições físicas inativas | existe projetado, mas indisponível |
| legacyUnassigned | bucket técnico | não é físico nem pending por inferência |
| aggregateBalance | saldo agregado | deve reconciliar com projeções quantitativas |
| activeLotQuantity | atribuição de lotes ativos | por posição, não deve superar físico |
| inactiveLotQuantity | lotes inativos | rastreabilidade, não disponibilidade |
| ledgerDerivedExpected | soma esperada dos deltas auditáveis | deve explicar aggregate |

### Combinações legitimamente divergentes

- `activeLotQuantity < physical`: físico sem lote atribuído;
- `pending > 0` com `physical = 0`: recebimento ainda não alocado;
- `physicalInactive > 0`: projeção existe, operação deve bloquear posição;
- `legacyUnassigned > 0`: pode existir por compatibilidade, mas requer classificação.

### Inconsistências

- lote ativo por posição > saldo físico da posição;
- físico total > aggregate;
- aggregate != soma rastreada das locationBalances sem explicação legada;
- intake que viola `received = allocated + immediate + pending`;
- inventário físico contendo `UNASSIGNED`;
- outbound operacional consumindo `UNASSIGNED`.

## 15. Performance e custo

| Padrão | Classificação | Motivo |
| --- | --- | --- |
| consulta móvel por material: limits 60 locationBalances / 120 lots, sem listener | ACEITÁVEL | bounded e sob demanda |
| listagens de lot/material/location até 500 | OTIMIZÁVEL | bounded, mas ainda podem ser volumosas |
| dashboard logístico carregando materiais + balances + locationBalances + lots + movimentos em paralelo | RISCO DE CUSTO | uma abertura pode ler múltiplas coleções até centenas de docs |
| inventário carregando coleções amplas para montar escopo | RISCO DE CUSTO | várias leituras bounded e falha por limite |
| evidência de movimentos por várias NFs no intake | OTIMIZÁVEL | bounded por NF, mas multiplica queries |
| `listWarehouseMovementsForMaterial` | **PERFORMANCE_RISK** | query Firestore não tem `limit`; faz fetch de todos e só depois `.slice(0, bounded)` |

Recomendação futura: aplicar `orderBy + limit` no Firestore para movimentos por material e reduzir reconstruções globais de dashboard/inventário. Não otimizado nesta frente.

## 16. RULES-COMPAT IMPACT

Nenhuma Rule foi alterada.

Esta auditoria não introduz coleção, operação ou permissão nova. Os pontos que exigirão correção runtime usam coleções já existentes, principalmente:

- `balances`;
- `locationBalances`;
- `lots`;
- `movements`;
- `intakes`;
- `consumptions`;
- `inventories` / itens de inventário;
- `outboundReturns`.

**RULES-COMPAT IMPACT:** qualquer patch posterior deve ser revisado pelo worker `RULES-COMPAT-01`, preservando isolamento workspace/UG e sem ampliar permissões para acomodar legado.

## 17. Impacto MOBILE-K

Direção validada em read-only no snapshot corrente da MOBILE-K:

- transferência física exclui `UNASSIGNED`;
- planejamento de lote bloqueia atribuição acima do físico;
- consulta móvel mostra físico localizado como principal;
- `UNASSIGNED` é explicitamente legado/reconciliação;
- intake v1 alocado é bloqueado para reconciliação.

Pendência que esta auditoria devolve à MOBILE-K/Coordenador:

1. inventário TOTAL precisa excluir `UNASSIGNED`;
2. remover/neutralizar UX “Materiais sem localização” como fila operacional;
3. manter `UNASSIGNED` apenas nos adapters/reconciliação estritamente necessários;
4. PAL-01 precisa de evidência read-only antes de qualquer correção.

## 18. Testes e CI

No frozen SHA `bd27da91...`:

- Core Protection run `37365421096`: SUCCESS;
- Application CI run `37365421191`: conclusão global FAILURE por release gates cancelados;
- o job principal `validate-application` terminou SUCCESS;
- nele, testes/guards de ledger, NF->stock, locations/transfers, lots/FEFO, barcode/outbound, Mobile intake, physical query, inventory, outbound, integrações, build, TypeScript e diff hygiene passaram.

A auditoria identificou que o teste de inventário antigo codifica explicitamente a semântica hoje inválida de TOTAL + UNASSIGNED. Portanto “teste verde” não resolve o conflito de contrato; esse teste deve ser atualizado junto da correção.

O PR desta frente altera somente documentação. `Application CI` ignora `docs/**`, então não se espera novo run dessa workflow apenas pelo relatório.

## 19. Classificações consolidadas

- Intake v2: **CANONICAL**
- Saída física: **CANONICAL**
- Consulta física móvel: **CANONICAL**
- Consumo imediato integral sem entrada em estoque: **CANONICAL**
- UNASSIGNED como parser/projeção técnica: **LEGACY_BUT_EXPLAINABLE**
- UNASSIGNED como origem/destino operacional: **INCONSISTENT / domínio obsoleto**
- UI “Sem localização” operacional: **INCONSISTENT / candidata à remoção**
- Lote como rastreabilidade: **CANONICAL**
- Lote > saldo físico: **INCONSISTENT**
- PAL-01 +100 L: **RECONCILIATION_REQUIRED**
- Inventário TOTAL incluindo UNASSIGNED: **INCONSISTENT — BLOCKER RC**
- movimentos por material sem `limit` no Firestore: **PERFORMANCE_RISK**

## 20. Ações sugeridas, em ordem

1. Bloquear certificação RC enquanto inventário TOTAL ainda incluir `UNASSIGNED`.
2. Incorporar no motor canônico a correção do inventário e atualizar o teste antigo.
3. Executar reconciliação read-only de PAL-01 440/540.
4. Só depois decidir reparo de dados, em frente própria, com backup/evidência/idempotência.
5. Completar limpeza de UX “Sem localização” sem apagar adapters históricos necessários.
6. Validar o delta com `RULES-COMPAT-01`.
7. Tratar `listWarehouseMovementsForMaterial` em frente de performance, adicionando query bounded no servidor.

## 21. Classificação final

**BLOCKER — INTEGRIDADE LOGÍSTICA IMPEDE RC**

Critério para reclassificação:

- inventário físico TOTAL exclui `UNASSIGNED` e o novo contrato está coberto por teste;
- MOBILE-K/integração não oferece nenhuma operação física sobre `UNASSIGNED`;
- PAL-01 foi diagnosticado suficientemente para saber se exige reparo antes do RC;
- Rules/CI permanecem verdes no delta integrado.

Nenhum dado real foi corrigido por esta auditoria.
