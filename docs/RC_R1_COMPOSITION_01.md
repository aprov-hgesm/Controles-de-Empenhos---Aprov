# RC-COMPOSITION-01 — Composição semântica do EMPROVEX R1

Data de composição: 2026-10-05 / 2026-10-06 UTC
Branch: `rc-r1-composition-01`
Base alvo do PR: `rc-r1-mobile-j-fix-label-readability`
HEAD inicial congelado: `bd27da91da92642d5a5fea08f7020c6cea658a62`
HEAD final técnico certificado: `272b86c1be1b66d17602a8fef3605b36e7f229c6`
PR: `#262` (DRAFT, base `rc-r1-mobile-j-fix-label-readability`)
Observação: o commit de fechamento documental que contém esta atualização será posterior ao HEAD técnico certificado e não altera runtime, Rules ou dados.

## 1. Identidade e proveniência

Base RC:
- `rc-r1-mobile-j-fix-label-readability@bd27da91da92642d5a5fea08f7020c6cea658a62`.

Fonte runtime principal:
- `inventory-physical-fix-01@5255bbcbc43593bcf66001adf85eb5d6264a121e`.
- relação comprovada: 25 commits à frente, 0 atrás;
- merge-base: `bd27da91da92642d5a5fea08f7020c6cea658a62`;
- incorporada por avanço fast-forward da branch de composição, preservando os SHAs auditados.

Runtime MOBILE-K já contido na fonte principal:
- `mobile-r1-k-canonical-ops-engine@9f1035ac447d25a8fad0ffbb0b319c31f8ba2ef0`.

Fontes de auditoria/evidência reconciliadas semanticamente:
- `saas-final-audit-01@4cc5b3797747d4d49591f4a68196e723700daa74`;
- `warehouse-data-repair-execution-01@e3f3aae9e8ee2337e387fd652a104f194049cd70`;
- `rules-compat-01@97442b5f11779b7b434cba8d0a9a2c9ab843ac66`.

Essas três branches foram confirmadas no HEAD esperado durante a composição.

## 2. Runtime composto

### MOBILE-K / motor canônico

Preservados os contratos:
- Mobile fino = scanner + UX;
- motor operacional compartilhado/canônico;
- transferência física → física, aggregate global delta 0, origem reduz, destino aumenta e ledger `TRANSFER`;
- saída com origem física e destino administrativo, sem inventar destino físico;
- entrada manual exige posição física;
- pending intake não é estoque físico;
- `UNASSIGNED` é legado/projeção técnica/compatibilidade, não estoque operacional normal;
- inventário opera somente sobre posição física;
- TOTAL não inclui `UNASSIGNED`.

### Inventory Physical Fix

Contrato certificado preservado:
- TOTAL + LOCATION = true;
- TOTAL + SUBPOSITION = true;
- TOTAL + UNASSIGNED = false;
- DEPOT/LOCATION/SUBPOSITION + UNASSIGNED = false;
- ajuste físico histórico UNASSIGNED falha fechado com `WAREHOUSE_INVENTORY_PHYSICAL_POSITION_REQUIRED`.

## 3. SaaS R1 reconciliado

A branch `saas-final-audit-01` **não foi mergeada**.

Foram incorporados semanticamente apenas:
- guard `SAAS R1 final audit contract guard` em Application CI;
- script npm `verify:saas-r1-final-audit`;
- `scripts/verify-saas-r1-final-audit.mjs`;
- hardening de `Diff hygiene` no workflow Legal usando merge-base do PR;
- `docs/SAAS_R1_FINAL_AUDIT_01.md`.

Foram preservados todos os guards mais novos MOBILE-K/Inventory já presentes na candidata.

Classificação SaaS de origem:
- **PASS COM RISCOS RESIDUAIS DOCUMENTADOS**;
- nenhum blocker funcional SaaS conhecido.

## 4. Rules

Nenhum arquivo de Rules foi editado ou publicado nesta composição.

Hashes/blobs confirmados antes e depois da incorporação:
- `firestore.rules`: `bc91185f34bcdcb4437a4de1078d1089a09292ba`;
- `firestore.warehouse.rules`: `6e1f1050005314db4e17cb3136409abbddb0ee91`.

Evidência incorporada:
- `docs/RULES_COMPAT_01_AUDIT.md`.

Classificação de referência:
- **PASS — COMPATIBILIDADE PRESERVADA**.

Rollout/rollback continua distinguindo app, Rules e dados; app RC + Rules antigas permanece incompatível para leases dinâmicos, portanto não se presume rollback de Rules junto com rollback da aplicação.

## 5. Dados Warehouse e repair já executado

Repair de referência:
- Repair ID: `WAREHOUSE-LOT-REPAIR-2026-10-05-01`;
- Firestore commitTime: `2026-10-06T01:14:32.083411Z`.

Repairs executados anteriormente, **não repetidos nesta frente**:
- `lot_670e1ca177804501b90bf8cdd669683f`: quantity 440 → 340;
- `lot_082ebcd7a2acf0c706c87464307cb1ff`: quantity 50 → 40.

Estado pós-repair aprovado:

Material A:
- aggregate 445;
- physicalActive 440;
- UNASSIGNED 5;
- activeLots 440;
- lotExcess 0.

Material B:
- aggregate 90;
- physicalActive 90;
- UNASSIGNED 0;
- activeLots 90;
- lotExcess 0.

Auditoria global pós-repair:
- 0 inconsistências;
- 0 performance risks.

Evidência incorporada:
- `docs/WAREHOUSE_DATA_REPAIR_EXECUTION_01.md`;
- `docs/WAREHOUSE_DATA_REPAIR_FORENSICS_01.md`;
- `docs/WAREHOUSE_INTEGRITY_RECONCILE_01.md`;
- `scripts/warehouse-integrity-reconcile-readonly.mjs`;
- `scripts/warehouse-integrity-reconcile-readonly.test.mjs`.

O executor de escrita real e o dry-run de repair **não foram incorporados**.

## 6. Reconciliações residuais de dados

Sem blocker quantitativo conhecido:
1. `POSITIVE_UNASSIGNED = 5` no Material A;
2. `APPARENT_DUPLICATE_ACTIVE_LOT` no Material B;
3. `APPARENT_DUPLICATE_ACTIVE_LOT` em `mat_bb6d4a089c224b1a48ad3a43f32170a3`.

Nenhuma dessas condições foi corrigida automaticamente nesta frente.

## 7. Segurança preservada

A composição não reduz segurança para satisfazer testes.

Contratos a preservar nos gates:
- workspace / UG / Auth / Legal;
- billing e lifecycle;
- sessões;
- cross-workspace DENY;
- warehouseAccess;
- ledger append-only;
- balances e locationBalances;
- lot traceability.

## 8. Gates

Rodada final do HEAD técnico certificado `272b86c1be1b66d17602a8fef3605b36e7f229c6`:

| Gate | Run/Job | Status |
| --- | --- | --- |
| Application CI | run `37401660131` / `validate-application` | **SUCCESS** |
| Legal Validation | run `37401660140` / `validate-legal` | **SUCCESS** |
| Core Protection | run `37401660119` / `core-protection` | **SUCCESS** |
| Recovery guardrails | run `37401660175` / `validate-recovery-tooling` | **SUCCESS** |
| SaaS final audit guard | Application CI `37401660131` | **SUCCESS** |
| MOBILE-K canonical ops tests + guard | Application CI `37401660131` | **SUCCESS** |
| MOBILE-J/integration guards | Application CI `37401660131` | **SUCCESS** |
| Warehouse inventory tests + guard | Application CI `37401660131` | **SUCCESS** |
| Warehouse transfer tests + guard | Application CI `37401660131` | **SUCCESS** |
| Warehouse outbound tests + guard | Application CI `37401660131` | **SUCCESS** |
| Multi-tenant suite + Firestore security | Application CI `37401660131` | **SUCCESS** |
| Session enforcement/admin/integrated gates | Application CI `37401660131` | **SUCCESS** |
| Production build | Application CI + Legal Validation | **SUCCESS** |
| Final TypeScript validation | Application CI `37401660131` | **SUCCESS** |
| Diff hygiene | Application CI + Legal Validation | **SUCCESS** |

Subgates explicitamente confirmados como `success` no Application CI:
- `SAAS R1 final audit contract guard`;
- `Multi-tenant security suite guard`;
- `Multi-tenant Firestore security tests`;
- `ADM Depósito Phase 6 locations and transfers domain tests`;
- `ADM Depósito Phase 6 permanent guard`;
- `ADM Depósito Phase 8 barcode and outbound domain tests`;
- `Central Móvel R1 MOBILE-G outbound domain tests`;
- `Central Móvel R1 MOBILE-G outbound guard`;
- `MOBILE-K canonical ops domain tests`;
- `MOBILE-K canonical ops permanent guard`;
- `ADM Depósito Phase 10 physical inventory domain tests`;
- `ADM Depósito Phase 10 permanent guard`;
- `Block 16.1 session enforcement guard`;
- `Block 16.2 admin session panel guard`;
- `Block 16.8 integrated domain tests`;
- `Block 16.8 integrated E2E guard`;
- `Production build`;
- `Final TypeScript validation`;
- `Diff hygiene`.

### Incidente de higiene corrigido

A primeira execução de Legal Validation (`37401412660`) falhou exclusivamente em `Diff hygiene` por quatro trailing spaces no cabeçalho deste manifest. Nenhum gate funcional, Rules, TypeScript ou build havia falhado. O whitespace foi removido no commit `272b86c1be1b66d17602a8fef3605b36e7f229c6`, e a rodada final acima passou integralmente.

### Auditor Warehouse live

O repair não foi repetido. Nenhum executor `--apply` foi executado. A composição utiliza a evidência pós-repair já aprovada e incorpora apenas o auditor read-only + teste; não houve credencial live exposta a esta sessão de composição para repetir consulta Firestore.

## 9. Riscos residuais

- `UNASSIGNED=5` legado no Material A;
- duplicate lot labels aparentes;
- HARDEN-A2 Firebase/Firestore/gRPC: risco residual aceito tecnicamente;
- `warehouseAccess` inicial materializado apenas no lifecycle, com fallback de compatibilidade atual;
- uptime externo ainda depende de publicação controlada;
- `listWarehouseMovementsForMaterial()` pode buscar movimentos por material e ordenar/slice em memória; tratar como backlog salvo evidência de impacto material real;
- quota/limite de deploy Vercel continua risco operacional quando aplicável.

## 10. Rollback

### App
Rollback da aplicação é operação independente e não foi executado nesta frente.

### Rules
Rollback de Rules é operação independente. As Rules candidatas já possuem contrato próprio e não foram alteradas/publicadas nesta frente.

### Dados
O repair validado de Warehouse **não deve ser rollbackado automaticamente**.

Rollback de app **não implica** desfazer o repair de dados executado e auditado.

## 11. Teste físico final necessário

Permanece necessário executar, em ambiente autorizado:
- Android / Chrome;
- iPhone / Safari quando disponível;
- câmera permitida, negada e indisponível;
- fallback manual;
- Code128 físico;
- entrada;
- transferência;
- consulta;
- inventário;
- saída;
- conferência;
- coerência Desktop ↔ Mobile;
- formatos COMPACT / MEDIUM / LARGE;
- som/vibração;
- double scan/cooldown;
- perda e retorno de rede.

## 12. O QUE NÃO FOI INCORPORADO

Deliberadamente ficaram fora:
- merge da branch inteira `saas-final-audit-01`;
- `docs/EMPROVEX_MEMORIAL_OFICIAL.md` da branch SaaS;
- qualquer mudança funcional de Rules;
- executor `scripts/warehouse-data-repair-execute.mjs`;
- teste do executor de escrita;
- dry-run `scripts/warehouse-data-repair-dry-run.mjs` e respectivo teste;
- qualquer novo repair de dados ou execução com `--apply`;
- `saas-pilot-journey-01`;
- `saas-pilot-ops-01`;
- `saas-uptime-readiness-01`;
- `rc-readiness-01`, supersedida;
- qualquer merge de `main`;
- qualquer publicação Production;
- qualquer publicação de Rules;
- qualquer piloto, cobrança ou suspensão real.

## 13. Classificação final

**APTA PARA RE-FREEZE**

Fundamentos:
- todos os deltas planejados foram compostos;
- Application CI, Legal Validation, Core Protection e Recovery estão verdes;
- Rules foram preservadas com hashes idênticos antes/depois;
- nenhum blocker funcional ou quantitativo de dados permanece;
- a validação física final continua pendente conforme a matriz deste manifest.

Esta classificação **não** autoriza produção, GO, merge final ou deploy.
