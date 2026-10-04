# EMPROVEX — Central Móvel R1 — Freeze da Onda 3

Data: **2026-10-03**

Este commit marca o **freeze comum da Onda 3** após:

- MOBILE-A/B integradas;
- Integração 1 certificada;
- MOBILE-E/C/D integradas;
- Integração 2 certificada;
- jornada cruzada `alocar → consultar → transferir → consultar` verde;
- reconciliação semântica SaaS R1 ↔ MOBILE-R1 concluída com **PASS**;
- ausência de conflito transversal capaz de bloquear F/G/H.

Estado SaaS observado antes do freeze:

`feat/saas-r1-commercializacao@4848643be85b30532f7f093c4ddb0e729facfad3`

Contratos compartilhados críticos continuam equivalentes:
- Auth/identidade;
- workspace/UG;
- sessão/lease;
- LegalAcceptanceGate;
- warehouseAccess/feature flag;
- Firestore Rules;
- app layout.

## Frentes autorizadas

- `mobile-r1-f-inventory` — Inventário Móvel;
- `mobile-r1-g-outbound` — Saída Móvel;
- `mobile-r1-h-position-check` — Conferência Física/Digital.

As três devem nascer **exatamente deste commit**.

## Contratos já congelados

- scanner único;
- EPX1/resolver;
- WarehouseStockPosition;
- classificação PRODUCT/LOCATION/UNKNOWN compartilhada;
- ALLOCATE oficial;
- consulta física read-only;
- TRANSFER oficial;
- lotes críticos fail-closed;
- saldo/ledger canônicos;
- workspace/UG e segurança vigentes;
- online-first;
- nenhuma fonte de verdade paralela.

## Dependências da Onda 3

MOBILE-F:
- inventário canônico;
- salvar contagem não altera saldo;
- ajuste somente após confirmação;
- preservar STALE/RECONCILIATION_REQUIRED.

MOBILE-G:
- OUTBOUND canônico;
- posição/lote/FEFO;
- idempotência;
- sem saldo negativo.

MOBILE-H:
- conferência apenas detecta divergência;
- correção deve navegar para MOBILE-D;
- nenhuma mutação própria.

## Coordenação SaaS

Qualquer worker que tocar domínio compartilhado deve registrar **Impacto SAAS-R1**.

Não fazer merge/rebase bruto entre integradoras.

## Bloqueios mantidos

MOBILE-I e MOBILE-J permanecem bloqueadas até:
1. F/G/H revisadas e integradas;
2. Integração 3 certificada;
3. nova reconciliação upstream quando aplicável.

Este freeze não autoriza:
- merge em main;
- deploy de produção;
- publicação de Rules;
- app nativo;
- offline sync.
