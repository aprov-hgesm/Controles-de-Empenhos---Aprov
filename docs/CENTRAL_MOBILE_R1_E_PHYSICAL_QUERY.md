# EMPROVEX — Central Móvel R1 — MOBILE-E Consulta Física

Data: **2026-10-02**  
Branch: `mobile-r1-e-physical-query`  
Base congelada da Onda 2: `6852963c7aa9a1c83133239f0b929715fd316530`

## Objetivo

Responder, de forma estritamente read-only:

> **O que deveria estar aqui?**

Fluxo:

```text
scanner compartilhado
→ EPX1 / EXPECT_LOCATION
→ resolver autoritativo
→ WarehouseStockPosition
→ warehouse_location_balance_v1 por posição
→ warehouse_material_v1
→ warehouse_lot_v1 por posição
→ apresentação móvel
```

Nenhuma operação de escrita, correção automática, saldo, ledger, ALLOCATE,
TRANSFER, inventário ou OUTBOUND pertence à MOBILE-E.

## Fontes de verdade reutilizadas

- `WarehouseMobileScanner`;
- `EXPECT_LOCATION`;
- namespace físico `EPX1`;
- `resolveWarehouseStockPositionBarcode`;
- `WarehouseStockPosition`;
- `warehouse_location_balance_v1`;
- `warehouse_material_v1`;
- `warehouse_lot_v1`;
- workspace/UG e escopo operacional vigentes;
- Firestore Rules vigentes.

Nenhuma coleção, saldo, índice lógico paralelo ou listener permanente foi criado.

## Estratégia de leitura

A consulta não chama `listWarehouseLocationBalances(...)` sem filtro e não
varre o depósito inteiro.

A projeção física é consultada por campo da própria posição:

- LOCAL: `position.locationId == locationId` + `position.kind == LOCATION`;
- SUBPOSITION: `position.subpositionId == subpositionId` +
  `position.kind == SUBPOSITION`.

Limites fail-closed:

- até **60** documentos de `locationBalances` por posição;
- até **120** documentos de lote por posição;
- materiais em lotes de até **30 IDs** por query;
- uma leitura adicional ao limite detecta overflow e a UI recusa apresentar
  resultado potencialmente truncado.

## Cache e listeners

- listener contínuo: **0**;
- cache da consulta física: **não usado**;
- motivo: a pergunta operacional exige revalidação autoritativa após cada leitura;
- os caches curtos existentes de depósito/localização não foram ampliados nem
  reutilizados para saldo/lote.

## Reads aproximados por consulta

O resolver autoritativo existente consome aproximadamente:

- LOCAL: **2 reads** (local + depósito);
- SUBPOSITION: **3 reads** (subposição + depósito + local pai).

Depois do resolver:

### Posição vazia

- 1 query de `locationBalances`;
- 0 material;
- 0 lote;
- reads aproximados totais: **2–3 + documentos retornados pela query**.

Quando a posição está realmente vazia, a query retorna zero documentos:
**~2 reads para LOCAL / ~3 reads para SUBPOSITION**.

### Posição com estoque

Conteúdo:

- 1 query bounded de `locationBalances`;
- `ceil(materiais/30)` queries bounded de materiais;
- 1 query bounded de lotes;
- reads = documentos efetivamente retornados + ~2/3 reads do resolver.

Teto estrutural fail-closed antes de apresentar resultado parcial:

- LOCAL: aproximadamente **242 documentos de conteúdo + 2 do resolver**;
- SUBPOSITION: aproximadamente **242 documentos de conteúdo + 3 do resolver**.

O teto é apenas guardrail; a jornada normal deve consumir muito menos.

## Payload

A resposta enviada ao componente contém somente:

- posição;
- materiais efetivamente presentes;
- saldo oficial naquela posição;
- lotes ativos e positivos daquela posição;
- métricas da própria consulta.

A UI registra `payloadBytesApprox` calculado sobre o objeto entregue ao componente,
sem iniciar telemetria ou persistência adicional.

## Segurança

Fail-closed:

- DEPOT não é aceito como posição de estoque;
- posição inexistente/inativa continua recusada pelo resolver;
- hierarquia inválida continua recusada pelo resolver;
- ausência de UG bloqueia a consulta;
- o adapter reconfirma sessão, workspace e UG antes de ler conteúdo;
- material, saldo e lote retornados são revalidados contra workspace/UG;
- inconsistência estrutural recusa apresentação parcial.

## UX

Estados:

```text
LER POSIÇÃO
↓
VALIDANDO
↓
POSIÇÃO VALIDADA
↓
POSIÇÃO
↓
CONTEÚDO ESPERADO
```

Estado vazio oficial:

> **Nenhum material registrado nesta posição.**

Nenhum botão de mutação foi adicionado à experiência.

## Arquivos da frente

Novos:

- `lib/warehouse/mobilePhysicalQueryModel.ts`;
- `lib/warehouse/mobilePhysicalQuery.ts`;
- `features/warehouse/mobile/WarehouseMobilePhysicalQueryResult.tsx`;
- `scripts/mobile-r1-physical-query.test.mjs`;
- `scripts/verify-mobile-r1-physical-query.mjs`;
- este documento.

Integração mínima:

- `features/warehouse/mobile/WarehouseMobileLocationFoundationCheck.tsx`;
- `package.json`;
- `.github/workflows/application-ci.yml`.

`package.json` e Application CI recebem somente dois comandos/gates aditivos da
MOBILE-E; nenhuma dependência de runtime ou comportamento SaaS foi alterado.

## Impacto SaaS-R1

Os contratos compartilhados consultados em `feat/saas-r1-commercializacao` foram
comparados antes da implementação e permaneciam idênticos por conteúdo na base
Mobile para:

- `locationRepository.ts`;
- `materialRepository.ts`;
- `lotRepository.ts`;
- `location.ts`;
- `material.ts`;
- `lot.ts`;
- `WarehouseModuleContext.tsx`.

A MOBILE-E não modifica esses arquivos, Auth, workspace/UG, sessão, legal gate,
lifecycle, `warehouseAccess` ou Rules.

A divergência nova em `package.json` e Application CI é exclusivamente aditiva
para os testes MOBILE-E e deve ser reconciliada semanticamente pelo Coordenador
caso C/D ou o SaaS alterem as mesmas áreas.
