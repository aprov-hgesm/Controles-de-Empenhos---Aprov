# FASE 10 — Inventário Físico

Data de implementação: 2026-09-24.

Escopo oficial:
- DEP-20;
- DEP-20.1;
- DEP-20.2;
- DEP-20.3.

Esta fase transforma a superfície **Inventário** do Walking Skeleton em uma capacidade operacional founder-only, sem criar uma segunda fonte de estoque.

## 1. Princípio arquitetural

O fluxo implementado é:

**selecionar escopo → abrir sessão → capturar esperado oficial → contar → revisar divergências → confirmar humanamente → gerar ajustes auditáveis → finalizar → consultar histórico**

As autoridades quantitativas permanecem:
- **warehouse_movement_v1** — ledger append-only;
- **warehouse_balance_v1** — saldo agregado oficial;
- **warehouse_location_balance_v1** — distribuição física oficial.

O inventário registra apenas:
- contexto e ciclo de vida da sessão;
- snapshot histórico do esperado no momento da abertura;
- contagem física informada;
- diferença;
- rastreabilidade de confirmação e ajustes.

Salvar uma contagem nunca escreve ledger, saldo agregado ou distribuição física.

## 2. Contratos

### 2.1 warehouse_inventory_v1

Sessão bounded de inventário em:

warehouse/{workspaceId}/inventories/{inventoryId}

Identidade:
- ID técnico inv_<32 hex>;
- workspace;
- UG;
- escopo;
- responsável pela abertura.

Escopos:
- TOTAL;
- DEPOT;
- LOCATION;
- SUBPOSITION.

Ciclo de vida:
- OPENING;
- COUNTING;
- REVIEW;
- CONFIRMING;
- RECONCILIATION_REQUIRED;
- CONFIRMED;
- CANCELLED.

A sessão finalizada não possui transição de volta para edição.

### 2.2 warehouse_inventory_item_v1

Itens são persistidos em subcoleção:

warehouse/{workspaceId}/inventories/{inventoryId}/items/{itemId}

O item registra:
- material canônico;
- posição física;
- locationBalanceId;
- quantidade esperada capturada;
- revisão e último movimento das projeções usadas como referência;
- quantidade contada;
- diferença;
- status;
- operador da contagem;
- movimento de ajuste, quando houver;
- operador da confirmação.

Status:
- PENDING;
- MATCHED;
- DIVERGENT;
- ADJUSTED;
- STALE.

O modelo usa subcoleção para não transformar um inventário grande em documento Firestore ilimitado.

## 3. Esperado x contado

A diferença é sempre:

**diferença = contado - esperado**

Exemplos:
- 100 / 100 → 0;
- 100 / 97 → -3;
- 100 / 105 → +5.

O esperado é obtido de **warehouse_location_balance_v1**, com verificação de coerência contra **warehouse_balance_v1** na abertura.

O valor esperado persistido no item é somente snapshot histórico da sessão. Ele nunca é consultado como saldo operacional por outras capacidades.

## 4. Inventário total e parcial

Uma única abstração de escopo atende:
- inventário total;
- depósito;
- localização;
- subposição.

A estrutura real de depósitos e localizações da FASE 6 é reutilizada e validada antes da abertura.

A sessão inclui somente posições físicas positivas e materiais ativos abrangidos pelo escopo.

Consultas são bounded:
- catálogo/saldos/localizações: até 500 documentos por consulta de preparação;
- sessão: até 1.200 itens;
- histórico: carregado sob demanda.

Quando o limite seguro é atingido, a abertura é recusada explicitamente em vez de truncar silenciosamente. O operador pode dividir a operação por depósito/localização.

## 5. Contagem separada do estoque

Durante COUNTING:
- o operador pode salvar e corrigir a quantidade contada;
- a diferença é recalculada;
- o item passa para MATCHED ou DIVERGENT;
- nenhum movimento é criado;
- nenhum saldo é alterado;
- nenhuma distribuição física é alterada.

O teste multi-tenant verifica explicitamente que saldo agregado e posição permanecem inalterados depois de salvar uma divergência.

## 6. Revisão e confirmação humana

A sessão só entra em REVIEW quando todos os itens foram contados.

A UI apresenta:
- progresso;
- quantidade esperada;
- quantidade contada;
- diferença;
- conferidos;
- divergentes;
- resumo de divergências positivas e negativas.

Antes de confirmar, o operador deve marcar um reconhecimento explícito de que revisou o resumo e autoriza os ajustes.

Itens sem diferença não criam movimento.

## 7. INVENTORY_ADJUSTMENT

Cada divergência confirmada usa:
- warehouse_movement_v1.type = INVENTORY_ADJUSTMENT;
- origem estruturada PHYSICAL_INVENTORY;
- material canônico;
- posição física;
- sessão/item;
- esperado;
- contado;
- revisão física usada como referência;
- identidade do operador.

A chave idempotente é estável por sessão + item:

phase10:inventory:<inventoryId>:<itemId>

O movimento, o novo warehouse_balance_v1, o novo warehouse_location_balance_v1 e o item ADJUSTED são gravados na mesma transação.

Invariantes:
- ledger continua append-only;
- movimentos anteriores não são reescritos;
- saldo não é escrito sem movimento correspondente;
- agregado e posição não podem ficar negativos;
- retry idêntico não duplica ajuste;
- conflito idempotente é rejeitado.

## 8. Concorrência

A sessão guarda a revisão e o último movimento da posição física no momento da abertura.

Antes de aplicar a divergência, a transação compara:
- locationBalance.revision;
- locationBalance.lastMovementId.

Se a posição mudou depois da contagem:
- o ajuste não é aplicado;
- o item vira STALE;
- a sessão entra em RECONCILIATION_REQUIRED;
- a UI informa que o estado ficou obsoleto;
- o operador deve preservar a sessão e abrir novo inventário parcial para reconciliar a posição.

Não existe lock global.

A revisão agregada capturada é evidência histórica, mas a proteção otimista da confirmação usa a revisão da posição contada. Isso permite que uma mesma sessão confirme posições diferentes do mesmo material sem tratar os próprios ajustes anteriores da sessão como concorrência externa.

## 9. Materiais sem localização

A fila operacional **Materiais sem localização** é derivada de:

**saldo agregado oficial - soma das posições físicas atribuídas**

Ela:
- não cria coleção de saldo;
- não move material automaticamente;
- não cria mecanismo paralelo de transferência;
- orienta o operador a usar Localizações/Transferências já existentes.

## 10. Lotes, validade e FEFO

A FASE 10 preserva integralmente warehouse_lot_v1, validade, origem e FEFO.

A contagem desta fase é quantitativa por posição oficial.

Como warehouse_lot_v1.quantity é enriquecimento logístico e não saldo oficial, uma divergência por posição não é distribuída artificialmente entre lotes. Fazer isso exigiria informação de contagem por lote que o contrato atual não possui.

Consequências:
- nenhum lote é apagado ou reescrito pelo inventário;
- FEFO permanece consultivo;
- eventual enriquecimento de contagem por lote deve reutilizar a autoridade de lote existente em evolução futura, sem criar saldo paralelo.

## 11. Barcode, scanner e croqui

Nenhuma associação barcode → material foi duplicada.

A FASE 10 preserva os resolvedores da FASE 8; a primeira versão operacional prioriza contagem por lista/pesquisa, sem reaproveitar o Enter do scanner para evitar qualquer risco de disparar OUTBOUND.

O croqui warehouse_depot_layout_v1:
- não armazena contagem;
- não armazena saldo;
- não muda geometria durante inventário;
- continua consultivo.

## 12. Segurança / Firestore Rules

O domínio continua founder-only por canAccessWarehouseModule.

As Rules da FASE 10:
- substituem o placeholder permissivo de inventories;
- validam sessão e item;
- bloqueiam exclusão física;
- bloqueiam usuário externo;
- bloqueiam UG fora do piloto;
- protegem identidade/snapshot histórico contra mutação;
- aceitam contagem somente em COUNTING;
- aceitam ajuste somente em CONFIRMING;
- exigem INVENTORY_ADJUSTMENT e item ADJUSTED no mesmo commit;
- exigem atualização coerente da posição física;
- preservam os guards das FASES anteriores.

## 13. UI operacional

Componente:
- features/warehouse/components/WarehouseInventoryOperational.tsx.

A experiência oferece:
- seleção de escopo;
- progresso;
- pesquisa;
- filtros pendentes/divergentes/conferidos;
- esperado/contado/diferença;
- revisão;
- confirmação humana;
- tratamento explícito de concorrência;
- fila de materiais sem localização;
- histórico de sessões.

A aparência recebeu apenas acabamento funcional consistente. A reformulação visual global continua reservada para a FASE 11.5.

## 14. Testes e gates

Testes específicos:
- scripts/warehouse-inventory.test.mjs;
- scripts/verify-adm-deposito-phase-10.mjs;
- tests/e2e/warehouse-phase-10.spec.mjs.

O teste multi-tenant existente foi ampliado para cobrir:
- criação founder-only;
- contagem sem alterar saldo;
- bloqueio de escrita direta no saldo;
- confirmação atômica do ajuste;
- proteção de sessão finalizada;
- proteção contra exclusão;
- bloqueio externo;
- UG adulterada.

CI:
- domain tests da FASE 10;
- permanent guard da FASE 10;
- suite multi-tenant/Firestore;
- guards anteriores;
- TypeScript;
- build;
- diff hygiene;
- Browser E2E;
- Recovery guardrails.

## 15. Fronteiras deliberadas

Não fazem parte da FASE 10:
- alertas/logística da FASE 11;
- dashboard da FASE 11;
- nova estética global da FASE 11.5;
- nova role externa do ADM Depósito;
- distribuição automática de divergência por lote;
- layout como motor de inventário;
- segunda fonte de saldo.

## 16. Próxima fase

Após merge e validação final da FASE 10, a próxima fase oficial é:

**FASE 11 — Entregas, Dashboard Logístico e Alertas.**

Nenhuma capacidade da FASE 11 foi implementada neste ciclo.
