# PROMPT — MOBILE-F — INVENTÁRIO MÓVEL

Você é o chat trabalhador responsável **exclusivamente** pela frente:

**MOBILE-F — Inventário Móvel da Central Móvel R1 do EMPROVEX**

## Governança obrigatória

Repositório: `aprov-hgesm/Controles-de-Empenhos---Aprov`
Branch integradora: `feat/central-mobile-r1`
Base comum congelada da Onda 3: `c971d5356c343a0819bf96ec016de73dd96a435d`

A branch trabalhadora já existe exatamente nessa base. Não recrie, não rebaseie, não faça merge da integradora e não incorpore outras workers.

## Liberação do Program Control

A HARDEN-D SaaS ↔ MOBILE-R1 foi concluída, auditada e aceita. A MOBILE-R1 está **VERDE** e esta worker está formalmente liberada para a Onda 3.

CT-01 permanece registrada para o futuro Release Candidate global:

`Permissions-Policy: camera=(self), microphone=(), geolocation=()`

Nesta worker:
- NÃO alterar `next.config.ts`;
- NÃO alterar Permissions-Policy;
- NÃO criar correção para CT-01;
- CT-01 não bloqueia esta frente;
- qualquer novo delta transversal deve ser marcado no handoff e escalado ao Coordenador Mobile / Program Control.

Antes de editar:
```powershell
git fetch origin
git switch mobile-r1-f-inventory
git branch --show-current
git rev-parse HEAD
git status
```

HEAD inicial esperado: `c971d5356c343a0819bf96ec016de73dd96a435d`.

Leitura obrigatória:
1. `docs/EMPROVEX_MEMORIAL_OFICIAL.md`;
2. `docs/CENTRAL_MOBILE_R1_PLANO_MESTRE.md`;
3. `docs/CENTRAL_MOBILE_R1_EXECUCAO_PARALELA.md`;
4. `docs/CENTRAL_MOBILE_R1_INTEGRATION_STATUS.md`;
5. `docs/CENTRAL_MOBILE_R1_COORDENADOR_HANDOFF.md`;
6. `docs/CENTRAL_MOBILE_R1_INTEGRATION_1_VALIDATION.md`;
7. `docs/CENTRAL_MOBILE_R1_INTEGRATION_2_VALIDATION.md`;
8. `docs/CENTRAL_MOBILE_R1_WAVE3_FREEZE.md`;
9. `docs/TESTING_POLICY.md`;
10. `docs/DEVELOPMENT_CI_WORKFLOW.md`;
11. documentação específica da Central de Depósitos para sua frente.

A SAAS-R1 segue em hardening pré-piloto na `feat/saas-r1-commercializacao`. Não faça merge/rebase entre integradoras. Se tocar Auth, workspace/UG, sessão/lease, legal gate, lifecycle, warehouseAccess, Rules, shell, contratos compartilhados, package ou CI comum, registre no handoff **Impacto SAAS-R1** e devolva conflitos transversais ao Coordenador.

Contratos congelados da Mobile:
- scanner único `WarehouseMobileScanner`;
- EPX1/resolver;
- `WarehouseStockPosition`;
- classificador compartilhado PRODUCT/LOCATION/UNKNOWN;
- ALLOCATE oficial;
- consulta física read-only;
- TRANSFER oficial;
- lotes críticos fail-closed;
- saldo/ledger canônicos;
- online-first;
- nenhuma fonte de verdade paralela.

Nenhum worker faz merge na integradora/main, deploy, promoção Vercel ou publicação de Rules.


## Missão

Implementar a jornada móvel sobre o **inventário canônico já existente**:

```text
selecionar/abrir inventário
→ ler posição
→ mostrar esperado
→ ler/selecionar material
→ informar contado
→ SALVAR CONTAGEM
→ revisar
→ confirmação humana
→ INVENTORY_ADJUSTMENT quando aplicável
```

Reutilizar obrigatoriamente:
- `WarehouseMobileScanner`;
- `EXPECT_LOCATION` e `EXPECT_PRODUCT`;
- EPX1/resolver;
- `WarehouseStockPosition`;
- `warehouse_inventory_v1`;
- `warehouse_inventory_item_v1`;
- `startWarehouseInventory`;
- `listWarehouseInventorySessions`;
- `listWarehouseInventoryItems`;
- `saveWarehouseInventoryCount`;
- `beginWarehouseInventoryReview`;
- `reopenWarehouseInventoryCounting`;
- `confirmWarehouseInventory`;
- `cancelWarehouseInventory`;
- contratos oficiais de `INVENTORY_ADJUSTMENT`.

## Invariantes obrigatórios

- salvar contagem **nunca altera saldo**;
- diferença = contado - esperado;
- ajuste somente depois da confirmação humana;
- preservar estados `STALE` e `RECONCILIATION_REQUIRED`;
- concorrência deve ser detectada pelo contrato oficial;
- não criar inventário paralelo;
- não reescrever snapshot esperado;
- não escrever saldo/ledger diretamente;
- sessão CONFIRMED/CANCELLED não pode ser reescrita;
- posição/material devem pertencer ao escopo da sessão;
- workspace/UG sempre revalidados;
- leitura isolada não pode confirmar ajuste.

## UX

Priorizar inventário orientado pelo ponto físico:
1. escolher ou abrir sessão;
2. ler posição;
3. mostrar itens esperados naquela posição;
4. ler produto ou selecionar item;
5. informar contado;
6. salvar contagem com confirmação visual de **“nenhum saldo alterado”**;
7. revisar divergências;
8. confirmação final explícita.

Não transformar scan em ajuste automático.

## Fronteira

Preferir componentes/helpers MOBILE-F.

Não alterar semanticamente `inventoryRepository.ts`. Se o contrato canônico não suportar a jornada sem mudança estrutural, pare e devolva ao Coordenador.

Não mexer em ALLOCATE, TRANSFER, OUTBOUND ou conferência H.

## Testes

Cobrir:
- abrir/selecionar sessão;
- LOCATION e SUBPOSITION;
- produto esperado;
- produto/posição fora do escopo;
- contagem igual;
- divergência positiva/negativa;
- salvar contagem sem alteração de saldo;
- revisão;
- confirmação;
- INVENTORY_ADJUSTMENT apenas após confirmação;
- stale/concurrency;
- RECONCILIATION_REQUIRED;
- replay/finalização;
- workspace/UG incompatível;
- ausência de writes diretos client-side.

Executar regressões Phase 10/inventory, scanner, Integrações 1–2, TypeScript, build, diff hygiene, Core Protection e Application CI.

## Handoff

Entregar `MOBILE-F — HANDOFF` com branch, HEAD, base, PR, objetivo, arquivos, contratos, testes, métricas, riscos, gates não executados, conflitos, **Impacto SAAS-R1** e confirmação explícita de que não houve merge/deploy/Rules.
