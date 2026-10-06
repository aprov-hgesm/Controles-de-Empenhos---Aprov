# WAREHOUSE-DATA-REPAIR-EXECUTION-01

## Resultado

- Autorização: concedida explicitamente pelo Fundador em 2026-10-05.
- Repair ID: `WAREHOUSE-LOT-REPAIR-2026-10-05-01`.
- Execução real: concluída em 2026-10-06.
- Commit Firestore: `2026-10-06T01:14:32.083411Z`.
- Classificação: **PASS — REPAIR EXECUTADO E INTEGRIDADE QUANTITATIVA REVALIDADA**.
- Produção da aplicação: não alterada.
- Rules: não alteradas.
- Ledger `movements`: preservado append-only.

## Gates pré-write

- testes do executor: 7/7 PASS;
- dry-run imediatamente anterior ao write: PASS;
- causas canônicas e repairs determinísticos: PASS;
- PITR Warehouse: `POINT_IN_TIME_RECOVERY_ENABLED`;
- delete protection: `DELETE_PROTECTION_ENABLED`;
- backup READY usado como proteção: `projects/gen-lang-client-0982077967/locations/us-east1/backups/84e64064-4c03-4f32-9c26-9724d22b9211`;
- snapshot do backup: `2026-10-05T17:21:29.826100Z`;
- transação: preconditions PASS.

## Writes autorizados e executados

### Material A

- material: `mat_272f2d996ee65ed3530ad2d7e27b66d7`;
- documento: `warehouse/hgesm-aprov/lots/lot_670e1ca177804501b90bf8cdd669683f`;
- campo alterado: somente `quantity`;
- before: 440;
- after: 340;
- delta: -100;
- causa: `MANUAL_ENRICHMENT_CRIOU_ATRIBUICAO_DE_LOTE_ACIMA_DO_LEDGER`.

### Material B

- material: `mat_6feb0840ca4060f7d69fcce1663f21b8`;
- documento: `warehouse/hgesm-aprov/lots/lot_082ebcd7a2acf0c706c87464307cb1ff`;
- campo alterado: somente `quantity`;
- before: 50;
- after: 40;
- delta: -10;
- causa: `OUTBOUND_SEM_LOTID_NAO_REDUZIU_ATRIBUICAO_LOGISTICA_DE_LOTE`.

Os dois writes compartilharam o mesmo `commitTime`, confirmando a execução coordenada no commit Firestore.

## Validação imediata pós-repair

Material A:

- aggregate: 445;
- physicalActive: 440;
- legacyUnassigned: 5;
- activeLots: 440;
- lotExcess: 0.

Material B:

- aggregate: 90;
- physicalActive: 90;
- legacyUnassigned: 0;
- activeLots: 90;
- lotExcess: 0.

Os dois blockers `LOT_ATTRIBUTION_EXCEEDS_STOCK` foram eliminados.

## Auditoria global pós-repair

A auditoria read-only global retornou inicialmente:

`PASS COM RECONCILIAÇÕES CONTROLADAS`

Contagens:

- 56 materiais;
- 15 posições físicas;
- 55 documentos UNASSIGNED;
- 12 lotes;
- 810 movimentos;
- 917 intakes;
- 912 consumptions;
- 1 outboundReturn;
- 0 inventários;
- 0 inconsistências;
- 4 reconciliationRequired;
- 0 performanceRisks.

Três reconciliações são reais e permanecem fora do repair autorizado:

1. `POSITIVE_UNASSIGNED=5` no Material A;
2. `APPARENT_DUPLICATE_ACTIVE_LOT` no Material B;
3. `APPARENT_DUPLICATE_ACTIVE_LOT` no material de controle `mat_bb6d4a089c224b1a48ad3a43f32170a3`.

A quarta ocorrência, `PAL01_KNOWN_CASE_NOT_IDENTIFIED`, era um falso positivo do próprio auditor: o script exigia que o antigo caso 440/540 continuasse existindo. Após o repair isso deixa de ser uma invariante válida. O auditor foi corrigido nesta branch para continuar detectando genericamente qualquer `LOT_ATTRIBUTION_EXCEEDS_STOCK`, mas sem exigir a persistência do blocker histórico PAL-01.

## Estado RC

O blocker quantitativo de lotes que impedia o RC foi removido. O RC ainda deve respeitar as reconciliações remanescentes e os demais gates independentes (incluindo Inventário Físico, RC-READINESS e integrações finais), mas não permanece bloqueado pelos excessos +100/+10 corrigidos neste repair.

## Governança

- nenhum terceiro documento foi alterado;
- nenhum saldo agregado foi alterado;
- nenhum `locationBalance` foi alterado;
- nenhum movement foi alterado;
- nenhum intake/consumption/return foi alterado;
- nenhuma Rule foi alterada;
- nenhuma publicação Production foi realizada;
- qualquer tratamento do UNASSIGNED positivo ou das duplicidades aparentes exige frente/decisão própria.
