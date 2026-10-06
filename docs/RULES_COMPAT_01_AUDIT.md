# RULES-COMPAT-01 — Auditoria final de compatibilidade das Firestore Rules

Data: 2026-10-05

## 1. Identidade e governança

- Branch: `rules-compat-01`
- Base congelada: `bd27da91da92642d5a5fea08f7020c6cea658a62`
- Estado inicial confirmado: branch idêntica à base, 0 commits à frente e 0 atrás.
- Rules NÃO alteradas nesta frente.
- Produção NÃO alterada.
- Nenhum deploy de Rules, Vercel Production, merge em `main`, alteração de dados, TTL, usuários, billing ou `warehouseAccess` foi executado.

## 2. Fingerprints auditados

| Ruleset | baseline main/R3 | RC auditado |
|---|---|---|
| principal | `0d990b7de0b2e85ed55fe14ec0d2ce29b3635299` | `bc91185f34bcdcb4437a4de1078d1089a09292ba` |
| Warehouse | `b5325fe5a8cbe9b0ade8568d35a2cd678ce6e0f2` | `6e1f1050005314db4e17cb3136409abbddb0ee91` |

A branch `rules-compat-01`, a base congelada e a branch alvo `rc-r1-mobile-j-fix-label-readability` compartilham os blobs candidatos RC acima.

O `main` permanece com os blobs históricos R3. Isso é esperado: o rollout certificado usa Rules RC publicadas antes da aplicação RC.

## 3. Evidência executável atual

No commit-base `bd27da91da92642d5a5fea08f7020c6cea658a62`, a Application CI executou em 2026-10-05:

- workflow run `37365421191`;
- job `validate-application` / `111953310259`;
- conclusão: **SUCCESS**;
- Production build: **SUCCESS**;
- Final TypeScript validation: **SUCCESS**;
- Diff hygiene: **SUCCESS**;
- Core Protection: **SUCCESS**.

A mesma execução rodou Firebase Auth + Firestore Emulator e confirmou, entre outros:

- **ALLOW** `slot-1` legado;
- **ALLOW** `slot-2` legado;
- **ALLOW** terceira sessão dinâmica legítima;
- **ALLOW** quarta sessão dinâmica legítima;
- **DENY** pseudo-legado `slot-3`;
- **DENY** lease cujo documentId difere de `browserInstanceId`;
- **DENY** overwrite de lease ativo por outra sessão;
- **DENY** cross-workspace;
- **DENY** tenant LIST de `sessionSlots`;
- **ALLOW** admin observar/listar sessões;
- **DENY** founder consumindo lease operacional externo;
- **DENY** tenant criando tombstone;
- **DENY** tombstone existente sendo reciclado;
- **DENY** UID divergente;
- **DENY** provider incorreto;
- **DENY** setor suspenso;
- **DENY** administrador como bypass operacional em tenant externo;
- **ALLOW** billing próprio em leitura;
- **DENY** billing de outro workspace;
- **DENY** escrita de billing pelo tenant;
- **ALLOW** Warehouse no próprio workspace/UG;
- **DENY** Warehouse cross-workspace;
- **DENY** UG divergente;
- **DENY** sessão password sem claims;
- **ALLOW** `intakeQueueIndex` próprio;
- **DENY** `intakeQueueIndex` cross-workspace.

Também ficaram verdes na mesma execução os testes/guards de materiais, ledger, NF→estoque, SISCOFIS, localizações/transferências, lots/FEFO, barcode/outbound, inventário, logística e integrações Mobile R1.

A suíte LegalAcceptance Emulator foi certificada na frente SESSION-CAP/RULES-AUDIT anterior. Entre o commit de integração `54aba792cb9e7bb195e21401fb50a21ed50add19` e a base atual existem 84 commits, mas nenhum arquivo de Rules, sessão, lifecycle, legal, billing ou suíte de segurança relevante mudou; apenas o handoff documental SESSION-CAP mudou nesse conjunto. Portanto a evidência Legal Gate anterior permanece aplicável ao mesmo contrato.

## 4. Matriz — banco principal

| Área | Delta main→RC | ALLOW antigo preservado? | DENY de segurança preservado? | App antiga + RC | App RC + RC | Classificação |
|---|---|---:|---:|---:|---:|---|
| `workspaces` | lifecycle/identidade SaaS reconciliados | SIM | SIM | SIM | SIM | COMPATÍVEL |
| `platformAccounts` | guards de identidade/lifecycle preservados | SIM | SIM | SIM | SIM | COMPATÍVEL |
| `platformBillingConfig` | domínio comercial admin-only | N/A | SIM | SIM | SIM | RESTRITIVA SEGURA |
| `billingAccounts` | tenant só lê o próprio; admin escreve | SIM | SIM | SIM | SIM | COMPATÍVEL |
| `billingCycles` | admin-only | SIM | SIM | SIM | SIM | RESTRITIVA SEGURA |
| `platformAuditEvents` | append-only | SIM | SIM | SIM | SIM | COMPATÍVEL |
| `sessionSlots` | IDs dinâmicos + legado slot-1/slot-2 | SIM | SIM | SIM | SIM | PERMISSIVA CONTROLADA |
| `sessionRevocations` | revogação dinâmica; admin create | SIM | SIM | SIM | SIM | PERMISSIVA CONTROLADA |
| `legalAcceptances` | documento determinístico por UID+versão | N/A | SIM | N/A | SIM | RESTRITIVA SEGURA |
| `auditEvents` | append-only tenant-scoped | SIM | SIM | SIM | SIM | COMPATÍVEL |
| `empenhos` | sem relaxamento por SESSION-CAP | SIM | SIM | SIM | SIM | UNCHANGED/COMPATÍVEL |
| `suppliers` | tenant-scoped, payload validado | SIM | SIM | SIM | SIM | COMPATÍVEL |
| `alerts` | tenant-scoped | SIM | SIM | SIM | SIM | COMPATÍVEL |
| `invoices` | tenant-scoped + invariantes de NS/CNPJ | SIM | SIM | SIM | SIM | COMPATÍVEL |
| `comissoes` | tenant-scoped | SIM | SIM | SIM | SIM | UNCHANGED/COMPATÍVEL |
| `cronogramas` | tenant-scoped e vínculo a empenho | SIM | SIM | SIM | SIM | COMPATÍVEL |
| `settings/documentStorage` | isolamento + schema + sem token persistido | SIM | SIM | SIM | SIM | RESTRITIVA SEGURA |
| `settings` | exceções específicas preservadas | SIM | SIM | SIM | SIM | COMPATÍVEL |
| `usageEstimates` | escrita monotônica própria; leitura admin | SIM | SIM | SIM | SIM | RESTRITIVA SEGURA |

### Observações do banco principal

1. `canAccessWorkspace()` continua sendo a fronteira central de autorização e não foi removida para economizar reads.
2. Founder continua Google-only para o contrato administrativo/fundador.
3. Founder não ganhou bypass operacional genérico sobre dados de tenants externos.
4. Externos continuam condicionados a autenticação, e-mail verificado, provider password, workspace, UG, UID/e-mail e lifecycle.
5. Billing continua explicitamente desacoplado de autorização operacional.
6. `legalAcceptances`: tenant faz GET apenas do ID determinístico `{uid}__saas-r1-2026-10-01`; LIST/UPDATE/DELETE continuam negados.
7. `sessionSlots`: tenant pode GET do lease próprio/autorizado, mas LIST continua admin-only.
8. `slot-1` e `slot-2` seguem aceitos somente como compatibilidade transitória; `slot-3` continua DENY.
9. App antiga + Rules RC continua compatível; app RC + Rules antigas continua incompatível para leases dinâmicos, portanto a ordem de rollout permanece Rules RC → app RC.

## 5. Matriz — Warehouse

| Área | Contrato RC | Segurança | Classificação |
|---|---|---|---|
| `warehouseAccess` | lifecycle + fallback histórico quando doc não existe | próprio workspace/UG | COMPATÍVEL |
| `materials` | create/update validados; delete DENY | tenant-scoped | RESTRITIVA SEGURA |
| `depots` | identidade estável; delete DENY | tenant-scoped | COMPATÍVEL |
| `locations` | identidade estável; delete DENY | tenant-scoped | COMPATÍVEL |
| `movements` | append-only; update/delete DENY | write ligado ao contrato de movimento | RESTRITIVA SEGURA |
| `balances` | projeção de ledger | write somente via contrato transacional | RESTRITIVA SEGURA |
| `locationBalances` | projeção física do ledger | write somente via contrato transacional | RESTRITIVA SEGURA |
| `lots` | enriquecimento logístico, não saldo | schema/material/posição/quantidade/origem validados | COMPATÍVEL |
| `barcodes` | identidade auxiliar | não concede autorização nem saldo | COMPATÍVEL |
| `layouts` | layout versionado | tenant-scoped | COMPATÍVEL |
| `inventories/items` | contagem/ajuste por contrato | delete DENY | RESTRITIVA SEGURA |
| `siscofisSnapshots` | snapshot validado | tenant-scoped | COMPATÍVEL |
| `settings` | schemas logísticos específicos | delete DENY | RESTRITIVA SEGURA |
| `destinations` | CRUD limitado por validators | delete DENY | COMPATÍVEL |
| `withdrawals` | validators de saída | delete DENY | COMPATÍVEL |
| `consumptions` | consumo auditável | delete DENY | COMPATÍVEL |
| `outboundReturns` | marcador; retorno via motor oficial | payload/quantidade validados | COMPATÍVEL |
| `intakeQueueIndex` | índice derivado não autoritativo | workspace/UG validados | COMPATÍVEL |
| `queueExclusions` | marcador lógico não quantitativo | tenant boundary preservada; delete DENY | COMPATÍVEL |
| `intakes v1` | compatibilidade preservada | validators v1 | COMPATÍVEL |
| `intakes v2` | recebida/alocada/imediata/pendente/status | validators v2 | COMPATÍVEL |

### Observações do Warehouse

1. `warehouseLifecycleAllowsAccess()` preserva o tratamento histórico de ausência de `warehouseAccess`; não foi transformada em pré-requisito obrigatório sem migração.
2. Founder só opera o Warehouse fundador/HGeSM dentro do contrato próprio; não existe bypass genérico para tenants externos.
3. `movements` permanece append-only.
4. `balances` e `locationBalances` não aceitam ajuste avulso: escritas exigem o movimento/transação correspondente.
5. `lots` continuam enriquecimento logístico, não autoridade paralela de saldo.
6. `barcodes` continuam identidade auxiliar e não substituem `materialId`, workspace ou UG.
7. `warehouse_item_intake_v1` permanece suportado.
8. `warehouse_item_intake_v2` valida `receivedQuantity`, `allocatedQuantity`, `immediateConsumptionQuantity`, `pendingQuantity`, `status`, `materialId`, `updatedBy` e `updatedAt`.
9. Nenhuma Rule foi relaxada para acomodar `UNASSIGNED`; qualquer correção de domínio da MOBILE-K deve se ajustar ao contrato seguro já existente.
10. A anotação textual “founder-only” próxima de `queueExclusions` está desatualizada em relação à Rule real, que usa `canAccessWarehouseModule(workspaceId)`. Isso é inconsistência de comentário, não alteração de autorização nesta frente e não justifica mudar Rules.

## 6. Compatibilidade de rollout/rollback

| Aplicação | Rules | Resultado |
|---|---|---|
| app antiga | Rules antigas | baseline histórica |
| app antiga | Rules RC | **COMPATÍVEL** |
| app RC | Rules RC | **ALVO / COMPATÍVEL** |
| app RC | Rules antigas | **INCOMPATÍVEL para leases dinâmicos** |

Conclusão: a propriedade necessária para rollback da aplicação está preservada. Rollback das Rules continua exigindo primeiro rollback da aplicação.

## 7. Rules budget / estrutura

Estado atual observado:

- principal RC: 2.524 linhas, 118 funções, 36 blocos `match`, 109 declarações `allow`;
- Warehouse RC: 3.331 linhas, 119 funções, 22 blocos `match`, 75 declarações `allow`.

O ruleset RC já foi compilado/executado pelo Emulator e pela Application CI atual. Não foi identificado sinal de estouro de budget de Rules nesta auditoria. Nenhum refactor cosmético foi feito.

## 8. Necessidade de alteração de Rules

**NENHUMA identificada.**

Não foi encontrado fluxo legítimo atual que exija flexibilizar Rules.

Se MOBILE-K ou outra frente futura encontrar incompatibilidade, o tratamento permanece:

`RULES CHANGE REQUIRED — COORDENADOR REVIEW`

e a correção deve priorizar adaptar o runtime/contrato antes de ampliar permissões.

## 9. Riscos residuais

1. **Baixo / documental:** comentário de `queueExclusions` diz “founder-only”, mas a Rule real permite o módulo autorizado do próprio workspace via `canAccessWarehouseModule`. O comportamento é antigo/preservado e os testes de isolamento estão verdes; corrigir comentário pode ser feito depois, sem tocar em Rules.
2. **Operacional, fora desta branch:** produção deve continuar sendo acompanhada por drift-check/manifest de release. Esta worker não publicou nem alterou Rules reais.
3. **MOBILE-K em paralelo:** a branch não foi mergeada nem alterada nesta auditoria. Nenhuma necessidade de Rules Change foi inferida a partir de código em desenvolvimento.

## 10. Classificação final

**PASS — COMPATIBILIDADE PRESERVADA**

Fundamentos:

- blobs RC confirmados;
- branch/base corretas;
- app antiga + Rules RC preservada;
- sessão dinâmica + legado transitório cobertos;
- multi-tenant, provider, UID, UG e lifecycle preservados;
- founder sem bypass operacional indevido;
- Legal Gate preservado;
- billing separado de autorização;
- Warehouse isolado por workspace/UG;
- ledger e projeções continuam protegidos;
- intake v1/v2 preservados;
- CI atual no HEAD-base executou Emulators e gates críticos com sucesso;
- nenhuma alteração de Rules necessária;
- nenhuma publicação/produção tocada.
