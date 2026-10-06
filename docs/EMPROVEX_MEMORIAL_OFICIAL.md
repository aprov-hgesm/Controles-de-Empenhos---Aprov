# EMPROVEX — Memorial Oficial

Última sincronização global: **2026-10-05/06 — a certificação física do RC re-frozen encontrou blockers reais. F01–F04, F07–F08 e F10–F13 passaram; F05 falhou com `WAREHOUSE_FAST_PATH_UNAVAILABLE`; F06 não confirmou transferência; F09 ficou em resultado incerto com replay idempotente pendente; F14 confirmou double scan de códigos de localização; F15 e F16 permanecem pendentes. Portanto o RC re-frozen `fae9ce6...` deixa de estar apto a GO/Production neste checkpoint, embora permaneça preservado como evidência histórica. Program Control abriu `rc-r1-physical-fix-01`, PR #265 DRAFT, para uma única onda corretiva. A correção F14 já foi aplicada tornando o scanner single-shot após leitura válida; Core Protection está SUCCESS e Application CI está em execução. F05 foi classificado inicialmente como fast-path server/runtime; a rota depende de `FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON`, mas a causa única ainda não foi afirmada sem log/ambiente. F06 e F09 exigem isolamento causal antes de qualquer mudança de domínio/Rules. Production continua não autorizada.**

Produção vigente: `main@e90f92acae1514ee5cbc6ce95fed354bc1454330`

Integradora SaaS R1: `feat/saas-r1-commercializacao` — fonte congelada da composição: `2c1eee759ea8024c296b4c6968ed935b9a59e880`; commits posteriores nesta branch podem ser exclusivamente documentais de Program Control

Integradora Mobile R1: `feat/central-mobile-r1@7b7717b6eebabf911310d2b8ac56ed13c9cb9238` — avanço documental, sem novo delta runtime

Estado global: **Performance R3 permanece como aplicação produtiva; Rules RC já publicadas permanecem congeladas; o RC original `54e60c...` é baseline histórica e a linha de correção `bd27da91...` continua a base da composição. MOBILE-K fechou em `9f1035ac...`; o Inventory Physical Fix, descendente linear de MOBILE-K, fechou em `5255bbcb...` com os dois gates principais verdes. O repair Warehouse real foi executado e revalidado sem alterar runtime, Rules ou ledger. O próximo owner exclusivo é `RC-COMPOSITION-01`, que deve compor semanticamente a candidata final sem publicar produção, sem executar novo repair e sem incorporar frentes SaaS pré-piloto ainda não certificadas.**

---

## 0. Finalidade e regra de leitura

Este é o **documento de entrada canônico do EMPROVEX**.

O objetivo do Memorial é permitir que um novo Coordenador, worker ou sessão de continuidade responda rapidamente:

1. o que está efetivamente em produção;
2. quais programas estão ativos;
3. quais contratos estão congelados;
4. quais riscos e bloqueios permanecem;
5. qual é o próximo gate global;
6. onde encontrar a evidência detalhada.

O Memorial **não apaga histórico** e não substitui os documentos especializados. Ele organiza o conhecimento em camadas.

### Camadas documentais

**Camada 1 — Estado global e contratos vigentes**

Este arquivo: `docs/EMPROVEX_MEMORIAL_OFICIAL.md`.

**Camada 2 — Estado operacional de cada programa**

- `docs/SAAS_R1_INTEGRATION_STATUS.md`
- `docs/SAAS_R1_COORDENADOR_HANDOFF.md`
- `docs/CENTRAL_MOBILE_R1_INTEGRATION_STATUS.md`
- `docs/CENTRAL_MOBILE_R1_COORDENADOR_HANDOFF.md`
- planos mestres e documentos especializados de cada programa.

**Camada 3 — Histórico detalhado integral**

`docs/EMPROVEX_MEMORIAL_HISTORICO_ATE_2026-10-03.md`

Esse arquivo contém **a versão anterior completa do Memorial, preservada integralmente**, incluindo registros de PRs, commits, métricas, fases, incidentes, decisões e checkpoints históricos.

### Regra de precedência canônica

Quando houver divergência aparente entre trechos, aplicar esta precedência:

1. **Snapshot Global + Contratos Permanentes deste Memorial** — estado vigente;
2. **documentos especializados de Integration Status / Coordenador / runbooks** — evidência operacional detalhada;
3. **Cronologia e checkpoints históricos** — explicam como o estado foi alcançado, mas não revogam decisão posterior;
4. **Memorial Histórico Integral / Git history** — arquivo de rastreabilidade, não estado vivo.

Um checkpoint histórico que diga “bloqueado”, “parcial” ou “aguardando” deixa de governar o sistema quando uma seção posterior e vigente registrar explicitamente PASS/encerramento.

Números operacionais devem refletir o **runtime atual**. Se uma especificação antiga divergir do código integrado, o Memorial deve registrar o contrato efetivamente implementado e apontar a divergência como histórica.

### Regra estrutural a partir desta reorganização

Novos estados não devem ser simplesmente anexados ao fim do Memorial.

Sempre atualizar primeiro:

1. **Snapshot Global**;
2. **Programa afetado**;
3. **Riscos/Gates**;
4. **Cronologia**, quando houver marco histórico;
5. documento especializado correspondente.

Quando um estado deixar de ser vigente, ele deve sair do quadro vivo e permanecer na cronologia/documentação histórica.

### Concorrência documental

Como SaaS e Mobile podem atualizar documentação em paralelo, qualquer edição do Memorial deve:

- reler o HEAD vivo imediatamente antes da gravação;
- preservar alterações concorrentes;
- mover novos checkpoints para a seção temática correta;
- nunca sobrescrever uma atualização de outro Coordenador apenas para restaurar uma versão anterior.


---

# PARTE I — ESTADO VIVO

## 1. Snapshot Global

| Domínio | Estado vigente | Contrato/observação |
| --- | --- | --- |
| Produção — app | **Performance R3 / INALTERADA** | `main@e90f92acae1514ee5cbc6ce95fed354bc1454330`; app RC não publicado |
| Produção — Firestore Rules | **RULES RC PUBLICADAS EM 2026-10-05** | publicação autorizada apenas de Rules; principal source blob `bc91185f34bcdcb4437a4de1078d1089a09292ba`; Warehouse source blob `6e1f1050005314db4e17cb3136409abbddb0ee91` |
| Rollback Rules | **PREPARADO** | baseline anterior principal `0d990b7de0b2e85ed55fe14ec0d2ce29b3635299`; Warehouse `b5325fe5a8cbe9b0ade8568d35a2cd678ce6e0f2` |
| SaaS R1 | **FUNCIONALMENTE CONCLUÍDO / PRÉ-PILOTO PREPARADO** | Final Audit `4cc5b379...` PASS; Journey `f3f699a...` PASS COM PENDÊNCIAS EXTERNAS; Pilot Ops `bdf78bc...` PASS COM PENDÊNCIAS EXTERNAS; nenhum blocker funcional SaaS conhecido |
| Mobile R1 | **FUNCIONAL A–I ENCERRADO / J EM CERTIFICAÇÃO FÍSICA** | MOBILE-J encontrou e corrigiu defeitos reais no Preview; ainda não encerrada |
| SESSION-CAP-01 | **PASS / INTEGRADA** | candidato sem teto fixo de sessões externas; lease/revogação/telemetria preservados |
| RULES-AUDIT-01 | **PASS / EXECUTADA NO ROLLOUT DE RULES** | Rules RC publicadas antes do app, conforme contrato de compatibilidade |
| RC original | **FROZEN HISTÓRICO / BASELINE** | `54e60c2264588d8802a67a4cab3d875d64f6bfc1`; não é mais o HEAD final pretendido após defeitos físicos reais |
| RC-P base | **PREVIEW HTTPS OBTIDO** | `rc-r1-p-preview@54e60c...`; acesso/auth/legal gate e Central Móvel confirmados manualmente |
| Reabertura controlada | **ATIVA / JUSTIFICADA POR DEFEITO REAL** | branch `rc-r1-mobile-j-fix-label-readability`; PR #252 **OPEN / DRAFT / MERGEABLE=true / NOT MERGED**; base `rc-r1-p-preview@54e60c...`; nenhum merge em main |
| HEAD vivo MOBILE-J-FIX | **PREVIEW VERDE / CI PARCIAL** | `bd27da91da92642d5a5fea08f7020c6cea658a62`; Vercel SUCCESS; Core #317 SUCCESS; Application CI #1030 aguardando runner neste checkpoint |
| Barcode físico | **PASS FÍSICO PARA LOCAL** | novo código numérico de 13 dígitos; `9812001101000` lido como `CAMERA · LOCATION` |
| Etiqueta compacta | **PASS FÍSICO / AJUSTADA PARA PRATELEIRA** | 140 mm × 35 mm; 8 por A4; layout lateral; Code 128 lido com sucesso em Android real |
| Compatibilidade de etiquetas | **PRESERVADA** | EPX1 e EPX2 continuam aceitos; formato numérico é preferido quando representável |
| Consulta física legada | **HARDENING APLICADO / RETESTE MANUAL PENDENTE** | projeções canônicas ignoram metadados extras históricos sem mascarar inconsistência real |
| Central Móvel — operações | **7 FLUXOS DISTINTOS / PREVIEW VERDE** | Alocar Recebimento; Transferir Material; Consultar Localização; Consultar Item; Inventário; Saída de Material; Conferir posição |
| Consultar Item | **IMPLEMENTADA / READ-ONLY** | barcode do item → saldo agregado → locais/subposições + quantidades + lotes; reutiliza o mesmo read model da Saída |
| Saída vs Transferência | **SEMÂNTICA SEPARADA / MOTOR A UNIFICAR** | intenção continua distinta na UX, mas regras de saldo/lote/validade/idempotência devem vir de um único motor canônico compartilhado Desktop↔Mobile |
| MOBILE-K — Canonical Ops Engine | **CONCLUÍDA PELO WORKER / APTO PARA REVISÃO** | `mobile-r1-k-canonical-ops-engine@9f1035ac447d25a8fad0ffbb0b319c31f8ba2ef0`; PR #253 OPEN/DRAFT/MERGEABLE, não mergeado; 22 commits à frente / 0 atrás; 26 arquivos; gates completos verdes; Rules inalteradas |
| PAL-01 / lotes | **DIVERGÊNCIA REAL DETECTADA** | posição física 440 L com lotes ativos observados somando 540 L; não mascarar nem autocorrigir dados; arquitetura nova deve selecionar/conciliar operação sem criar segunda autoridade |
| Estado logístico do material | **CONTRATO CANÔNICO CORRIGIDO** | usuário vê apenas: PENDENTE/PARCIALMENTE TRATADO no intake, ESTOQUE LOCALIZADO em LOCAL/SUBPOSIÇÃO, CONSUMIDO/TRATADO; `UNASSIGNED` não é categoria operacional normal de estoque |
| Onda paralela de auditoria | **ENCERRADA / HANDOFF PARA COMPOSIÇÃO** | RULES-COMPAT-01 PASS; SAAS-FINAL-AUDIT-01 PASS com riscos residuais; WAREHOUSE audit/forensics/repair concluídos; `rc-readiness-01` não avançou e seu ownership foi absorvido por `RC-COMPOSITION-01` |
| INVENTORY-PHYSICAL-FIX-01 | **PASS / ENCERRADA TECNICAMENTE** | `inventory-physical-fix-01@5255bbcb...`; PR #261 DRAFT; TOTAL/DEPOT/LOCATION/SUBPOSITION excluem `UNASSIGNED` do inventário físico; Core Protection + Application CI SUCCESS |
| WAREHOUSE-INTEGRITY-RECONCILE-01 | **CONCLUÍDA / BLOCKER RC** | `warehouse-integrity-reconcile-01@b8dbc33...`; 3.113 reads; 2 blockers quantitativos de lote (+100 e +10); 3 reconciliações adicionais; nenhum dado escrito |
| WAREHOUSE-DATA-REPAIR-FORENSICS-01 | **PASS / ENCERRADA TECNICAMENTE** | `warehouse-data-repair-forensics-01@c1fa1d9...`; causa comprovada nos 2 blockers, dry-run determinístico e manifesto prontos; nenhum dado escrito |
| WAREHOUSE-DATA-REPAIR-EXECUTION-01 | **PASS / REPAIR EXECUTADO E REVALIDADO** | `warehouse-data-repair-execution-01@e3f3aae...`; commit Firestore `2026-10-06T01:14:32.083411Z`; 2 writes allowlisted; pós-repair com 0 inconsistências e lotExcess=0 nos dois materiais; Core Protection e Application CI SUCCESS |
| RC-COMPOSITION-01 | **PASS / APTA PARA RE-FREEZE** | `rc-r1-composition-01@fae9ce6...`; PR #262 DRAFT; Application CI + Legal + Core + Recovery SUCCESS; Rules preservadas; nenhum blocker funcional/quantitativo conhecido |
| RC R1 re-freeze | **CRIADO / CANDIDATA CONGELADA** | `rc-r1-refreeze-01@fae9ce6aed7242e85d53fc8e6470fba4425a8c27`; snapshot exato do RC composto; nenhuma alteração após freeze permitida sem reabrir certificação |
| RC-R1-PHYSICAL-CERT-01 | **BLOCKER / RE-FREEZE REABERTO** | F05 fast-path falhou; F06 transferência não confirmou; F09 replay pendente; F14 double scan de localização confirmado; F01–F04/F07–F08/F10–F13 PASS |
| RC-R1-PHYSICAL-FIX-01 | **ATIVA / OWNER EXCLUSIVO DOS BLOCKERS FÍSICOS** | `rc-r1-physical-fix-01@b69fc103...`; PR #265 DRAFT; F14 scanner single-shot implementado; F05/F06/F09 em diagnóstico; sem Rules/Production/repair |
| Firestore Rules — contrato da onda | **CONGELADAS PARA OS WORKERS** | SaaS/RC/MOBILE-K usam `firestore.rules@bc91185f...` e `firestore.warehouse.rules@6e1f1050...`; qualquer necessidade de alterar Rules deve voltar ao Coordenador antes de edição |
| HARDEN-B | **PASS** | backup/verify/restore real isolado/integridade 13/13 PASS |
| Restore temporário | **AINDA EXISTE** | `emprovex-restore-warehouse-2026-10-04`; delete protection ativa; cleanup exige autorização separada |
| Piloto real | **NÃO INICIADO** | somente após novo RC reconciliado/re-frozen e decisão posterior |
| Produção controlada / GO | **NÃO AUTORIZADA** | CI verde ou Preview verde não equivalem a autorização produtiva |
| Abertura comercial ampla | **NÃO AUTORIZADA** | depende de certificação, eventual produção controlada, piloto e GO explícito |

### Snapshots técnicos relevantes

- produção/app: `main@e90f92acae1514ee5cbc6ce95fed354bc1454330`;
- SaaS source congelada da composição original: `2c1eee759ea8024c296b4c6968ed935b9a59e880`;
- Mobile integradora documental: `feat/central-mobile-r1@7b7717b6eebabf911310d2b8ac56ed13c9cb9238`;
- RC runtime original/frozen: `54e60c2264588d8802a67a4cab3d875d64f6bfc1`;
- branch RC-P original: `rc-r1-p-preview@54e60c2264588d8802a67a4cab3d875d64f6bfc1`;
- branch ativa de correção/certificação: `rc-r1-mobile-j-fix-label-readability@bd27da91da92642d5a5fea08f7020c6cea658a62`;
- PR de correção/certificação: **#252 — OPEN / DRAFT / MERGEABLE=true / NÃO MERGEADO**; HEAD `bd27da91da92642d5a5fea08f7020c6cea658a62`; 61 commits / 30 arquivos no PR no momento deste handoff;
- Preview estável da branch: `https://controles-de-empenhos-aprov-git-rc-f44756-aprov-hgesms-projects.vercel.app`;
- HARDEN-B: `saas-harden-b-recovery-restore@c6368d0dd1b89610cb02b9b87f5ef6392810b336`.

A aplicação produtiva só muda por autorização explícita e posterior do Fundador. As Rules RC já foram publicadas por autorização específica em 2026-10-05; essa autorização **não** autorizou o app RC em produção.

## 2. Próxima barreira global

A fase atual continua sendo **Release Engineering / Certificação Física**, porém o freeze original foi reaberto de modo controlado por defeitos reais encontrados na MOBILE-J.

Sequência vigente:

```text
RC original 54e60c... — FROZEN histórico
→ Preview HTTPS + Rules RC autorizadas
→ MOBILE-J física encontrou defeitos reais
→ barcode/etiqueta física — PASS na última forma testada
→ consultas/legado/7 operações — hardening aplicado
→ transferência parcial expôs divergência real PAL-01 (440 L físico vs lotes ativos observados 540 L)
→ diagnóstico arquitetural: Mobile acumulou regras próprias e burocracia
→ decisão do Fundador: MOBILE-K / motor operacional único Desktop↔Mobile
→ worker isolado mobile-r1-k-canonical-ops-engine em bd27da91...
→ mapear motores canônicos Desktop e eliminar autoridades móveis duplicadas
→ gates + testes de regressão Desktop e Mobile
→ teste físico simplificado das operações críticas
→ integrar semanticamente resultado na linha RC
→ repetir gates afetados
→ declarar NOVO RC SHA / RE-FREEZE
→ certificação final no SHA re-frozen
→ GO/NO-GO explícito do Fundador
→ eventual produção controlada do app
→ piloto real
```


### Gate imediato

O gate vigente é **RC-R1-PHYSICAL-FIX-01 — correção única dos blockers encontrados na certificação física**.

Branch:

`rc-r1-physical-fix-01@b69fc103467d428511756b2567980a4514ad17d4`

PR:

`#265 — DRAFT`

Base preservada:

`rc-r1-refreeze-01@fae9ce6aed7242e85d53fc8e6470fba4425a8c27`

Resultado físico recebido:

- F01 PASS;
- F02 PASS;
- F03 PASS;
- F04 PASS;
- F05 **BLOCKER** — `WAREHOUSE_FAST_PATH_UNAVAILABLE`;
- F06 **BLOCKER / causa a isolar** — transferência não confirmada;
- F07 PASS;
- F08 PASS;
- F09 **PENDENTE DE REPLAY / blocker se recorrente**;
- F10 PASS;
- F11 PASS;
- F12 PASS;
- F13 PASS — som OK, vibração não suportada pelo navegador;
- F14 **BLOCKER** — double scan em códigos de localização;
- F15 PENDENTE;
- F16 PENDENTE — iOS indisponível.

Decisões vigentes:

1. não declarar GO/Production;
2. preservar o re-freeze antigo apenas como evidência da candidata que falhou fisicamente;
3. corrigir somente F05/F06/F09/F14 em uma única branch;
4. F14 já corrigido: scanner passa a encerrar o decoder imediatamente após leitura válida, antes de entregar o evento ao fluxo pai;
5. F05: não ampliar fallback legado para `WAREHOUSE_FAST_PATH_UNAVAILABLE`, pois isso reduziria a revalidação canônica server-side; confirmar ambiente/log do fast path;
6. F06: obter/reproduzir o erro técnico real antes de alterar domínio ou Rules;
7. F09: executar replay com a mesma chave de idempotência; sucesso sem segunda baixa pode reclassificar o caso como recuperação prevista;
8. F15 será executado apenas depois dos blockers operacionais;
9. F16 pode permanecer pendente por indisponibilidade de iPhone, desde que explicitamente aceito no GO/NO-GO;
10. qualquer novo runtime exige CI/Legal/Core/Recovery aplicáveis e novo re-freeze antes de Production.

### Onda paralela de auditoria — execução autorizada sem competição com MOBILE-K

Enquanto a `MOBILE-K — Canonical Ops Engine` evolui em branch própria, o Program Control pode executar quatro frentes independentes. A finalidade é antecipar auditoria, evidência e release engineering sem criar dois owners para o mesmo contrato.

| Frente | Branch exclusiva | Base de trabalho | Ownership | Saída esperada | Proibição principal |
| --- | --- | --- | --- | --- | --- |
| RULES-COMPAT-01 | `rules-compat-01@97442b5f...` | RC estável `bd27da91...` | **PASS / ENCERRADA** — Firestore Rules, ALLOW/DENY, rollout/rollback e compatibilidade histórica | `docs/RULES_COMPAT_01_AUDIT.md`; PR #254 DRAFT | Rules não alteradas; comentário antigo `queueExclusions` continua apenas inconsistência textual |
| SAAS-FINAL-AUDIT-01 | `saas-final-audit-01@4cc5b379...` | base congelada `d7837257...` | **PASS COM RISCOS RESIDUAIS DOCUMENTADOS** — billing, onboarding, legal, lifecycle, sessão, recovery | PR #256 DRAFT; CI/Legal/Core/Recovery SUCCESS | nenhum blocker funcional SaaS; sem produção |
| SAAS-PILOT-JOURNEY-01 | `saas-pilot-journey-01@f3f699a...` | `saas-final-audit-01@4cc5b379...` | **PASS COM PENDÊNCIAS EXTERNAS / ENCERRADA** — onboarding, Auth, Legal, billing/trial, lifecycle, sessões, multi-tenant e warehouseAccess | PR #259 DRAFT; delta final só `docs/SAAS_PILOT_JOURNEY_01.md`; runtime funcional validado com CI/Core/Journey SUCCESS e Browser E2E 8/8 | sem runtime/Rules/dados/produção |
| SAAS-PILOT-OPS-01 | `saas-pilot-ops-01@bdf78bc...` | `saas-final-audit-01@4cc5b379...` | **PASS COM PENDÊNCIAS EXTERNAS / ENCERRADA** — operação do piloto pronta em runbook | PR #263 DRAFT; delta final só `docs/SAAS_PILOT_OPS_01.md` (705 linhas); zero runtime/Rules/Warehouse/RC | Vercel rate limit externo; piloto real e operações comerciais continuam não executados |
| SAAS-UPTIME-READINESS-01 | `saas-uptime-readiness-01@4cc5b379...` | HEAD auditado SaaS | health/Cloud Monitoring: configuração reproduzível e validação prévia | runbook/scripts dry-run para uptime/alert/canal | não criar check/alert/channel produtivo antes de publicação autorizada |
| WAREHOUSE-DATA-AUDIT-01 | `warehouse-data-audit-01@07265b2...` | RC estável `bd27da91...`; MOBILE-K somente leitura | **BLOCKER RC** — integridade logística/legado | `docs/WAREHOUSE_DATA_AUDIT_01.md`; PR #255 DRAFT | nenhuma escrita/migração; Inventário TOTAL + UNASSIGNED precisa correção isolada; PAL-01 precisa diagnóstico read-only |
| RC-READINESS-01 | `rc-readiness-01@bd27da91...` | RC estável `bd27da91...` | **SUPERSEDIDA / SEM DELTA** | ownership transferido para RC-COMPOSITION-01 | não executar em paralelo |
| RC-COMPOSITION-01 | `rc-r1-composition-01@bd27da91...` | base RC viva | composição semântica, release manifest, gates, rollback e preparação do re-freeze | PR DRAFT contra `rc-r1-mobile-j-fix-label-readability` | sem main/Production/Rules/repair/piloto |

#### Regras de concorrência

1. **Um worker = um ownership.**
2. Nenhum dos quatro workers modifica `lib/warehouse/transfer.ts`, `mobileTransfer.ts`, `locationRepository.ts`, Saída/Transferência Mobile ou outro arquivo sob edição da MOBILE-K, salvo leitura/auditoria.
3. Achado fora do escopo vira handoff ao Coordenador; não é corrigido oportunisticamente.
4. Integração continua **semântica**, nunca merge/rebase cego entre branches.
5. Nenhum worker publica app, Rules, restore ou altera `main`.
6. Nenhum worker executa migração destrutiva ou corrige dados reais.
7. Correção de blocker só começa após o Coordenador definir owner exclusivo.

#### Fechamento RULES-COMPAT-01

Estado aceito pelo Coordenador:

- branch: `rules-compat-01@97442b5f11779b7b434cba8d0a9a2c9ab843ac66`;
- PR #254: OPEN / DRAFT / MERGEABLE / não mergeado;
- delta: 1 arquivo documental, 202 linhas;
- classificação: **PASS — COMPATIBILIDADE PRESERVADA**;
- `firestore.rules`: `bc91185f34bcdcb4437a4de1078d1089a09292ba` — sem alteração;
- `firestore.warehouse.rules`: `6e1f1050005314db4e17cb3136409abbddb0ee91` — sem alteração;
- nenhum caso `RULES CHANGE REQUIRED`;
- compatibilidade `slot-1/slot-2`, sessões dinâmicas, Legal Gate, billing isolado, lifecycle, multi-tenant, Warehouse, ledger, balances/locationBalances, lotes, barcode e intake v1/v2 preservados.

Precisão sobre CI histórica: no run `37365421191` do baseline `bd27da91...`, o job `validate-application` ficou **SUCCESS** e contém a evidência Emulator usada pela auditoria; o workflow agregado terminou **FAILURE** porque alguns gates posteriores ficaram `cancelled`. Portanto o PASS desta frente se apoia na evidência específica de Rules/Emulator e em auditorias anteriores aplicáveis, e não deve ser descrito como “workflow #1030 completamente verde”.

Observação não bloqueante: em `firestore.warehouse.rules`, o comentário de `queueExclusions` ainda diz “founder-only”, mas a regra efetiva usa `canAccessWarehouseModule(workspaceId)`. Não alterar o arquivo apenas para corrigir comentário, pois isso mudaria o hash das Rules e obrigaria nova auditoria sem ganho de segurança.

#### Fechamento WAREHOUSE-DATA-AUDIT-01

Estado aceito pelo Coordenador:

- branch: `warehouse-data-audit-01@07265b209d6c27873278139a507aa12d4eb97973`;
- PR #255: OPEN / DRAFT / MERGEABLE / não mergeado;
- delta: 1 commit, 1 arquivo documental (`docs/WAREHOUSE_DATA_AUDIT_01.md`);
- classificação: **BLOCKER — INTEGRIDADE LOGÍSTICA IMPEDE RC**;
- nenhum dado real, Rules, índice, TTL, MOBILE-K ou produção foi alterado.

Blockers confirmados:

1. `warehouseInventoryScopeIncludesPosition({ kind: 'TOTAL' }, { kind: 'UNASSIGNED' })` retorna `true`; o teste histórico em `scripts/warehouse-inventory.test.mjs` também exige explicitamente esse comportamento. O contrato novo exige Inventário TOTAL somente sobre posições físicas.
2. PAL-01 permanece `RECONCILIATION_REQUIRED`: 440 L físicos vs 540 L em lotes ativos observados. A causa dos +100 L não pode ser afirmada sem diagnóstico read-only dos documentos vivos/histórico.

Risco adicional não bloqueante isolado:

- `listWarehouseMovementsForMaterial()` consulta por `materialId` sem `orderBy/limit` no Firestore, ordena e aplica `.slice()` apenas em memória. Deve ser tratado em correção de performance própria ou junto do RC se o impacto justificar.

Regra de saída do blocker:

- corrigir Inventário TOTAL para excluir `UNASSIGNED` e atualizar os testes;
- confirmar que nenhuma operação física do candidato oferece `UNASSIGNED`;
- executar auditoria read-only sistêmica de integridade, incluindo PAL-01 como caso conhecido;
- só então decidir se existe reparo de dados necessário, por classe de inconsistência, em frente separada e autorizada;
- repetir Rules/CI afetados no delta final.

#### Onda paralela SaaS R1 — preparação pré-piloto sem produção

Com a auditoria final SaaS tecnicamente verde, três frentes podem trabalhar enquanto os blockers Warehouse são tratados. Elas não alteram o motor logístico e não iniciam piloto real.

- `SAAS-PILOT-JOURNEY-01`: **PASS COM PENDÊNCIAS EXTERNAS / ENCERRADA** em `f3f699a...`; delta final somente documental. Runtime funcional anterior recebeu Application CI + Journey + Core SUCCESS e Browser E2E 8/8. Pendências externas: novo Preview/RC, smoke humano nesse deployment e operações comerciais reais.
- `SAAS-PILOT-OPS-01`: **PASS COM PENDÊNCIAS EXTERNAS / ENCERRADA** em `bdf78bc...`; runbook operacional completo em `docs/SAAS_PILOT_OPS_01.md`, com J01–J24 pendentes corretamente, suporte, billing manual, stop conditions, rollback, observabilidade e matriz de risco. Nenhum runtime/Rules/Warehouse/RC foi alterado.
- `SAAS-UPTIME-READINESS-01`: fechar artefatos reproduzíveis para `/api/health`, uptime check, alert policy e notification channel, com dry-run/validação estática. A aplicação real desses controles permanece bloqueada até publicação controlada autorizada.

Base comum congelada das três frentes:

`saas-final-audit-01@4cc5b3797747d4d49591f4a68196e723700daa74`

Regras:

1. nenhum worker faz merge em `main`, deploy Production, publicação de Rules, cobrança real, suspensão de cliente real ou início de piloto;
2. achado funcional vira handoff ao Coordenador, não feature oportunista;
3. mudanças em Auth, sessão, lifecycle, legal, `warehouseAccess` ou Rules compartilhadas exigem impacto Mobile explícito;
4. RC-COMPOSITION-01 é o owner de composição/re-freeze; estas frentes apenas antecipam evidência e operação SaaS e não entram na candidata sem handoff aprovado.

#### Fechamento SAAS-PILOT-JOURNEY-01

Estado aceito pelo Coordenador:

- branch: `saas-pilot-journey-01@f3f699a796566fe03dcc137f22791d2ed8259940`;
- HEAD inicial/base: `saas-final-audit-01@4cc5b3797747d4d49591f4a68196e723700daa74`;
- PR #259: OPEN / DRAFT / MERGEABLE / não mergeado;
- delta final: somente `docs/SAAS_PILOT_JOURNEY_01.md` (181 linhas); **nenhum delta runtime final**;
- HEAD funcional validado: `75f302e4554336f3646b38e068c4530f6625c7d1`;
- Application CI `37395922059`: SUCCESS;
- SAAS Pilot Journey 01 `37395922126`: SUCCESS;
- Core Protection `37395922283`: SUCCESS;
- Browser E2E dirigido: **8/8 PASS**;
- TypeScript, production build e diff hygiene: PASS;
- Blocos 16–21 finais do Application CI: verdes;
- onboarding, UID/e-mail/workspace/UG, provider password, e-mail verificado, Auth, primeiro login, Legal Gate, trial 30d, billing R$70, founder/VIP exempt, lifecycle, suspensão técnica, reativação, recuperação de acesso, sessões/revogação e isolamento multi-tenant: PASS técnico;
- `warehouseAccess`: **PASS COM RISCO RESIDUAL DE COMPATIBILIDADE**, sem blocker; lifecycle sincroniza `active ↔ disabled` e há compensação de falha Warehouse; fallback histórico das Rules preservado;
- Rules permaneceram nos hashes `bc91185f...` e `6e1f1050...`;
- classificação final: **PASS COM PENDÊNCIAS EXTERNAS**;
- pendências externas aceitas: novo Preview/RC, smoke humano nesse deployment e operações comerciais reais;
- para RC-COMPOSITION, esta frente é **evidência documental aprovada** e pode ser referenciada/incorporada como documentação sem trazer runtime.

#### Fechamento SAAS-PILOT-OPS-01

Estado aceito pelo Coordenador:

- branch: `saas-pilot-ops-01@bdf78bc87df1271def239feab715ddb8dd6c295d`;
- HEAD inicial/base: `saas-final-audit-01@4cc5b3797747d4d49591f4a68196e723700daa74`;
- PR #263: OPEN / DRAFT / MERGEABLE / não mergeado;
- governança final: **2 commits à frente / 0 atrás** da base;
- delta líquido: somente `docs/SAAS_PILOT_OPS_01.md`, 705 linhas;
- commits: `2afa3f7049477f6f5d88dd67e6b70c3b0bc07d90` (runbook) e `bdf78bc87df1271def239feab715ddb8dd6c295d` (higiene Markdown);
- runtime: zero;
- Rules: zero;
- Warehouse: zero;
- RC-COMPOSITION: intocado;
- conteúdo coberto: critérios de entrada/provisionamento, Day 0/Day 1, billing `trial/active/past_due/exempt`, suspensão com dupla conferência, reativação, SEV-1..4, incidentes, observabilidade, stop conditions, sessões, feedback, feature requests, critérios de sucesso, saída do piloto, rollback separado, matriz de risco e J01–J24;
- J01–J24 permanecem corretamente como **PENDENTE**, pois o piloto real não foi iniciado;
- `warehouseAccess`: preservado como **PASS COM RISCO RESIDUAL DE COMPATIBILIDADE**;
- rollback do app explicitamente não desfaz o repair Warehouse validado;
- higiene final: zero trailing whitespace;
- status externo Vercel do HEAD: **failure por build-rate-limit / quota externa**, sem evidência de falha funcional do runbook;
- classificação final: **PASS COM PENDÊNCIAS EXTERNAS**;
- esta frente está fora do caminho crítico da publicação e passa a ser artefato operacional pronto para uso futuro.

#### Fechamento RC-COMPOSITION-01

- branch: `rc-r1-composition-01@fae9ce6aed7242e85d53fc8e6470fba4425a8c27`;
- PR #262: OPEN / DRAFT / MERGEABLE / não mergeado;
- merge-base: `bd27da91da92642d5a5fea08f7020c6cea658a62`;
- delta acumulado: 39 commits à frente / 0 atrás da base RC;
- Application CI `37402133902`: **SUCCESS**;
- SAAS-DL Legal Validation `37402133906`: **SUCCESS**;
- Core Protection `37402133890`: **SUCCESS**;
- Recovery guardrails `37402133915`: **SUCCESS**;
- release manifest: `docs/RC_R1_COMPOSITION_01.md`;
- Rules blobs preservados em `bc91185f...` e `6e1f1050...`;
- executor de repair não incorporado/executado;
- classificação final: **APTA PARA RE-FREEZE**;
- snapshot congelado criado: `rc-r1-refreeze-01@fae9ce6...`;
- caminho crítico: certificação física final → GO/NO-GO → eventual Production autorizada.

#### Frentes corretivas derivadas da auditoria logística

**INVENTORY-PHYSICAL-FIX-01 — PASS / ENCERRADA TECNICAMENTE**

- branch: `inventory-physical-fix-01@5255bbcbc43593bcf66001adf85eb5d6264a121e`;
- PR #261: OPEN / DRAFT / base `mobile-r1-k-canonical-ops-engine`;
- escopo implementado: Inventário TOTAL considera somente `LOCATION`/`SUBPOSITION` físicas e exclui `UNASSIGNED` antes da avaliação do escopo;
- `applyWarehouseInventoryAdjustment()` agora falha fechado para item histórico `UNASSIGNED` com `WAREHOUSE_INVENTORY_PHYSICAL_POSITION_REQUIRED`;
- testes atualizados para TOTAL+LOCATION=true, TOTAL+SUBPOSITION=true, TOTAL+UNASSIGNED=false e exclusão de `UNASSIGNED` nos escopos DEPOT/LOCATION/SUBPOSITION;
- novo guard estático confirma que criação de inventário reutiliza `warehouseInventoryScopeIncludesPosition()` e que ajuste não aceita `UNASSIGNED`;
- compatibilidade de leitura histórica do tipo `UNASSIGNED` foi preservada;
- Rules, PAL-01, lotes reais, intake, transfer, outbound, billing, sessão e produção não foram alterados;
- Core Protection e Application CI do HEAD `5255bbcb...`: **SUCCESS**;
- classificação final: **PASS — INVENTÁRIO FÍSICO RESTRITO A POSIÇÕES FÍSICAS, SEM UNASSIGNED OPERACIONAL**.

**WAREHOUSE-INTEGRITY-RECONCILE-01 — CONCLUÍDA / BLOCKER RC**

- branch: `warehouse-integrity-reconcile-01`;
- base exata: `mobile-r1-k-canonical-ops-engine@9f1035ac447d25a8fad0ffbb0b319c31f8ba2ef0`;
- finalidade exclusivamente diagnóstica/read-only em escala global;
- auditar **todos os materiais e todas as posições** acessíveis do workspace analisado, sem restringir a investigação à PAL-01;
- para cada material/posição, cruzar saldo agregado, `locationBalances`, lotes ativos/inativos, movimentos, consumptions, returns, inventários e legado `UNASSIGNED`;
- classificar divergências por padrão: lote > físico, físico > agregado, projeção inativa com saldo, `UNASSIGNED` operacional, movimento sem reflexo esperado, lote stale, posição inválida, intake/projeção divergente;
- PAL-01 (440 L físicos vs 540 L em lotes) é **caso conhecido de validação**: a auditoria deve detectá-lo, mas não deve ser desenhada especificamente para ele;
- distinguir fato, padrão sistêmico, hipótese e causa comprovada;
- nenhuma escrita, backfill, migração, correção de lote/saldo ou Rules;
- qualquer reparo posterior exige frente própria e autorização específica quando tocar dados reais.

Resultado vivo consolidado:

- 3.113 reads aproximados; nenhum cap;
- 56 materiais; 15 registros físicos; 55 `UNASSIGNED`, somente 1 positivo;
- 12 lotes; 810 movimentos; 917 intakes; 912 consumptions; 1 `outboundReturn`; 0 inventários;
- `mat_272f2d996ee65ed3530ad2d7e27b66d7`: aggregate 445, físico 440, `UNASSIGNED` 5, lotes ativos 540, ledger 445 — blocker de lote +100;
- `mat_6feb0840ca4060f7d69fcce1663f21b8`: aggregate/físico/ledger 90, lotes ativos 100 — blocker de lote +10;
- `mat_bb6d4a089c224b1a48ad3a43f32170a3`: duplicidade aparente de lote técnico, mas aggregate/físico/lotes/ledger em 100 — reconciliação, não blocker quantitativo isolado;
- causa histórica específica dos +100/+10 ainda **não comprovada**;
- RC pode avançar sem repair de dados: **NÃO**;
- Application CI do HEAD anterior falhou somente por linha vazia extra no EOF do relatório; higiene corrigida em `b8dbc33...`, Core Protection novamente PASS e Application CI reexecutando.

**WAREHOUSE-DATA-REPAIR-FORENSICS-01 — PASS / ENCERRADA TECNICAMENTE**

- branch final: `warehouse-data-repair-forensics-01@c1fa1d914990fbe126eaeb81889c6016dd84e7b0`;
- PR #258: OPEN / DRAFT / MERGEABLE / não mergeado;
- leitura viva v2: 3.057 reads; nenhum cap;
- classificação: **PASS — CAUSA PROVADA / REPAIR PLAN PRONTO PARA APROVAÇÃO**;
- Material A `mat_272f2d996ee65ed3530ad2d7e27b66d7`: o lote `lot_670e1ca177804501b90bf8cdd669683f` de origem `MANUAL_ENRICHMENT` levou a soma ativa a 540 quando o ledger estava em 440, introduzindo exatamente +100; repair proposto `quantity 440 → 340`;
- Material B `mat_6feb0840ca4060f7d69fcce1663f21b8`: o OUTBOUND sem `lotId` `mov_fc391dd2a9b6b0fbbee257595376305ab1c3dd39352241a1b8896c24a912a3b6` reduziu 10 do físico sem reduzir o lote histórico `lot_082ebcd7a2acf0c706c87464307cb1ff`; repair proposto `quantity 50 → 40`;
- `readyForHumanRepairAuthorization=true`, porém **isso não equivale a autorização de escrita**;
- dry-run e manifesto preservam idempotência, expected-before/after, `updatedAt`, revisão/lastMovementId e conjunto esperado de lotes;
- qualquer divergência na revalidação deve abortar com `ABORT — REFORENSICS REQUIRED`;
- backup Warehouse READY histórico foi identificado e restore 13/13 já havia sido comprovado; a frente executora ainda deve reconfirmar backup/PITR suficientemente recente imediatamente antes da escrita;
- Rules, MOBILE-K, ledger, produção e dados reais permaneceram inalterados nesta forensics.

**WAREHOUSE-DATA-REPAIR-EXECUTION-01 — PASS / REPAIR EXECUTADO E REVALIDADO**

- branch viva: `warehouse-data-repair-execution-01@e3f3aae9e8ee2337e387fd652a104f194049cd70`;
- PR #260: OPEN / DRAFT / não mergeado;
- autorização explícita do Fundador concedida em **2026-10-05**;
- testes do executor: **7/7 PASS**;
- dry-run imediatamente anterior ao write: **PASS**;
- recovery precondition: PITR ENABLED, delete protection ENABLED, backup READY `84e64064-4c03-4f32-9c26-9724d22b9211`, snapshot `2026-10-05T17:21:29.826100Z`;
- transaction preconditions: **PASS**;
- commit Firestore: **SUCCESS** em `2026-10-06T01:14:32.083411Z`;
- writes executados:
  - `warehouse/hgesm-aprov/lots/lot_670e1ca177804501b90bf8cdd669683f`: `quantity 440 → 340`;
  - `warehouse/hgesm-aprov/lots/lot_082ebcd7a2acf0c706c87464307cb1ff`: `quantity 50 → 40`;
- Material A pós-repair: aggregate 445, physicalActive 440, UNASSIGNED 5, activeLots 440, lotExcess 0;
- Material B pós-repair: aggregate 90, physicalActive 90, UNASSIGNED 0, activeLots 90, lotExcess 0;
- auditoria global pós-repair: 56 materiais, 0 inconsistências, 0 performance risks, 4 reconciliações reportadas inicialmente;
- dessas 4, 3 são reais: `POSITIVE_UNASSIGNED=5` no Material A e duas `APPARENT_DUPLICATE_ACTIVE_LOT`; a quarta (`PAL01_KNOWN_CASE_NOT_IDENTIFIED`) era um falso positivo porque o auditor exigia que o blocker histórico 440/540 continuasse existindo;
- o auditor foi corrigido para continuar detectando genericamente `LOT_ATTRIBUTION_EXCEEDS_STOCK` sem exigir persistência do caso histórico;
- Rules, aggregate, locationBalances, movements, intakes, consumptions e produção do app não foram alterados;
- classificação desta frente: **PASS — REPAIR EXECUTADO E INTEGRIDADE QUANTITATIVA REVALIDADA**.

**Performance**

O achado em `listWarehouseMovementsForMaterial()` permanece backlog técnico separado. Não deve ser misturado à correção de Inventário, salvo se um gate do RC demonstrar impacto material que justifique abrir owner próprio.

#### Guardrail obrigatório de Firestore Rules

Estado de referência da onda:

- arquivo em `main`: `firestore.rules@0d990b7de0b2e85ed55fe14ec0d2ce29b3635299`;
- arquivo em `main`: `firestore.warehouse.rules@b5325fe5a8cbe9b0ade8568d35a2cd678ce6e0f2`;
- Rules RC publicadas e candidatas em SaaS/RC/MOBILE-K:
  - principal: `bc91185f34bcdcb4437a4de1078d1089a09292ba`;
  - Warehouse: `6e1f1050005314db4e17cb3136409abbddb0ee91`.

Princípio:

> **Rules são barreira de segurança, não ferramenta para fazer código novo passar.**

Durante esta onda:

- adaptar código/testes ao contrato certificado é preferível a mudar Rules;
- se um fluxo legítimo exigir alteração de Rules, o worker deve classificar `RULES CHANGE REQUIRED — COORDENADOR REVIEW` e parar a edição desse contrato;
- qualquer mudança futura de Rules invalida os hashes certificados e exige repetição de RULES-AUDIT-01, matriz ALLOW/DENY, emulator e compatibilidade de rollout/rollback;
- preservar compatibilidade de `slot-1/slot-2` enquanto a app antiga puder coexistir com Rules RC;
- preservar ausência histórica de `warehouseAccess` como compatibilidade enquanto houver tenants não materializados, salvo migração autorizada e comprovada;
- preservar intake v1/v2 enquanto existirem dados/caminhos legados suportados;
- não remover compatibilidade antiga apenas por limpeza arquitetural.

#### Invariantes de segurança que os quatro workers devem respeitar

- cross-workspace sempre DENY;
- workspace/UG/UID/e-mail coerentes;
- founder não ganha bypass operacional genérico em tenant externo;
- externos permanecem com identidade/autorização exigidas pelo contrato vigente;
- lifecycle `disabled` fecha acesso;
- `movements` permanece ledger append-only;
- `balances` e `locationBalances` não recebem write avulso fora do contrato transacional;
- `lots` não vira autoridade de saldo;
- barcode não concede autorização;
- tenant não enumera sessões de outros usuários;
- deletes físicos proibidos permanecem proibidos;
- regras antigas de ALLOW legítimo e DENY de segurança devem ser testadas, não apenas inspecionadas.

#### Princípios de eficiência preservados

- leituras sob demanda;
- queries bounded/indexadas;
- realtime apenas para dado quente;
- histórico sob demanda;
- zero listener novo por conveniência;
- cache somente quando segregado por workspace e com invalidação;
- não reduzir segurança para economizar reads;
- reutilizar fonte canônica existente em vez de criar projeção paralela;
- Mobile fino não significa carregar toda a superfície Desktop.

#### Barreira de sincronização

Os quatro handoffs paralelos podem ser recebidos antes da MOBILE-K terminar, mas **nenhum deles declara novo RC**.

A barreira de integração é:

```text
MOBILE-K concluída
+ RULES-COMPAT-01 concluída
+ SAAS-FINAL-AUDIT-01 concluída
+ WAREHOUSE-DATA-AUDIT-01 concluída
+ RC-READINESS-01 concluída
→ Coordenador cruza os 5 handoffs
→ corrige apenas blockers reais com owner exclusivo
→ compõe novo RC
→ repete Rules emulator + segurança + CI + performance
→ Preview + teste físico curto
→ RE-FREEZE
```

### Regra de re-freeze

O SHA `54e60c...` permanece a baseline histórica certificada antes dos defeitos físicos.

Nenhum novo RC pode ser declarado congelado enquanto:

- PR #252 não estiver semanticamente reconciliado;
- a PAL-01 não for retestada no HEAD auditado;
- LOCAL/SUBPOSIÇÃO/ITEM não estiverem fisicamente validados;
- os gates afetados não forem repetidos no SHA final.

Correções oportunistas/estéticas continuam proibidas. Só entram defeito real, regressão, segurança, compatibilidade necessária ou impeditivo de release.

# PARTE II — GOVERNANÇA GLOBAL

## 3. Hierarquia oficial

### Fase funcional — modelo histórico

Durante o desenvolvimento paralelo:

```text
Fundador
→ Coordenador Geral / Program Control
   → Coordenador SaaS R1
   → Coordenador Mobile R1
      → workers especializados
```

### Fase atual — composição do RC

Por decisão do Fundador, o **Coordenador Geral também assume a Coordenação operacional do RC**.

Modelo vigente:

```text
FUNDADOR
   ↓
PROGRAM CONTROL + COORDENAÇÃO DO RC
   ├── Coordenador SaaS — consulta/evidência sob demanda
   ├── Coordenador Mobile — consulta/evidência sob demanda
   ├── HARDEN-B — frente especializada temporal
   └── MOBILE-J — frente especializada de certificação física
```

Os Coordenadores SaaS e Mobile não foram apagados: permanecem como fontes especializadas de contexto e evidência. Porém **não existe nova wave funcional autorizada** em nenhum dos dois programas.

### Separação de autoridade mesmo no mesmo chat

O mesmo chat pode executar dois papéis, mas as decisões continuam separadas por evidência:

- **Coordenação RC**: compõe candidato, reconcilia, executa gates, prepara Preview e consolida evidências;
- **Program Control**: aceita/rejeita checkpoints, declara RC CANDIDATE/FROZEN, classifica risco e prepara GO/NO-GO;
- **Fundador**: autoriza ações produtivas protegidas e lançamento.

O Coordenador Geral não transforma “continue”, “próximo passo”, CI verde ou PASS técnico em autorização de produção.

## 4. Classificação oficial de problemas

- **LOCAL** → worker.
- **PROGRAM** → Coordenador do programa.
- **TRANSVERSAL** → Coordenador Geral.
- **RELEASE/PRODUÇÃO** → Coordenador Geral + Fundador quando aplicável.

## 5. Semáforo global

- **VERDE** — pode prosseguir.
- **AMARELO** — risco/delta conhecido; pode avançar até a próxima barreira.
- **VERMELHO** — bloquear somente a menor unidade necessária.

O objetivo é evitar que um risco localizado paralise programas independentes.

## 6. WIP e desenvolvimento paralelo

O EMPROVEX adota como método oficial:

> **frentes independentes em paralelo + integração semântica + barreiras explícitas de sincronização.**

A capacidade de revisão determina o WIP, não a quantidade possível de chats.

SaaS e Mobile podem evoluir simultaneamente enquanto seus contratos comuns permanecerem compatíveis.

Não fazer sincronização por merge/rebase cego entre integradoras.

---

# PARTE III — PRODUTO E ARQUITETURA

## 7. Stack vigente

- Next.js 15 / App Router;
- Firebase Auth;
- Firestore;
- Cloud Monitoring;
- Vercel;
- Vercel Blob;
- integrações Google usadas pelos fluxos institucionais.

## 8. Núcleo funcional do EMPROVEX

Capacidades consolidadas incluem:

- Empenhos;
- Itens;
- Notas Fiscais;
- Comissão;
- Tesouraria/Liquidação;
- Cronogramas/Entregas;
- Central de Avisos;
- Relatórios/SAG;
- Administração;
- usuários e sessões;
- telemetria/consumo;
- Central de Depósitos;
- Central Móvel R1 em desenvolvimento.

Performance R3 é a baseline de produção atual.

## 9. Contratos de identidade, sessão e multi-tenant

### 9.1 Identidade autenticada

Fonte: Firebase Auth.

Contrato atual:

- fundador: login **Google-only**;
- usuários externos/setores: login **e-mail/senha only**;
- e-mail verificado é obrigatório;
- sessão com provider inesperado falha fechada;
- Mobile e Desktop usam a mesma identidade; não existe Auth Mobile paralelo.

### 9.2 Relação conta ↔ workspace ↔ UG

Na R1:

- 1 cliente operacional externo = 1 workspace;
- 1 workspace = 1 UG;
- 1 workspace externo possui 1 conta operacional primária;
- conta, workspace e sessão precisam concordar em e-mail/UID/workspace/UG;
- inconsistência de UID, e-mail, UG, status ou provider resulta em **fail-closed**;
- o usuário não recebe subscriptions operacionais antes da validação do contexto.

### 9.3 UID e primeiro vínculo

Contas novas já podem chegar pré-vinculadas ao UID Firebase pelo provisionamento.

Para registros legados sem UID, o bootstrap histórico de primeiro acesso pode vincular o UID após validar:

- e-mail;
- provider;
- conta ativa;
- workspace ativo;
- UG coerente.

Após o vínculo, e-mail idêntico não basta: o UID precisa continuar sendo exatamente o mesmo.

### 9.4 Sessões simultâneas — contrato de runtime atual

O runtime atualmente integrado define:

- usuário externo: **sem teto fixo de sessões simultâneas por workspace/UG no candidato integrado**;
- founder: **isento do limite de capacidade**;
- documentos de sessão: IDs dinâmicos por `browserInstanceId`; `slot-1` e `slot-2` permanecem apenas como compatibilidade transitória;
- lease nominal: **30 minutos**;
- heartbeat/renovação nominal: **15 minutos**;
- decisão temporal baseada em relógio confiável do servidor, não no relógio local do Windows;
- revogação administrativa cria tombstone e remove slots conhecidos;
- perda de lease/revogação/mudança de acesso invalida a sessão local.

**Estes números 30/15 são o contrato implementado atual e substituem referências históricas anteriores com valores diferentes.**

### 9.4.1 Mudança autorizada — remoção do teto fixo de duas sessões

Decisão do Fundador em 2026-10-03:

**o limite fixo de 2 sessões simultâneas para usuários externos deve ser removido.**

Motivação operacional:

- a Central Móvel R1 transforma o celular em ferramenta operacional do depósito;
- uma única equipe pode precisar de vários operadores simultâneos;
- alocação, conferência, inventário, transferência e saída podem ocorrer em paralelo;
- limitar o workspace a apenas duas sessões cria gargalo artificial justamente no cenário Mobile;
- Desktop e múltiplos celulares precisam poder coexistir durante a operação.

### Estado atual versus estado alvo

**Estado integrado na linha SaaS/RC:**

- limite externo: **sem teto fixo**;
- documentos: `sessionSlots/{browserInstanceId}`;
- compatibilidade transitória: `slot-1` e `slot-2`;
- lease: 30 minutos;
- heartbeat: 15 minutos;
- revogação administrativa: ativa;
- painel de sessões: ativo;
- telemetria: ativa;
- TTL `expiresAt`: ACTIVE em `sessionSlots` e `sessionRevocations`.

**Estado alvo autorizado e alcançado:**

- **sem teto fixo de duas sessões por workspace/UG**;
- permitir múltiplas sessões externas simultâneas compatíveis com o uso operacional real;
- manter controle individual de identidade de cada sessão;
- manter lease, heartbeat, revogação, auditoria e telemetria;
- manter possibilidade de encerramento remoto de uma sessão específica;
- manter lifecycle fail-closed;
- manter proteção cross-workspace;
- não transformar “sem limite fixo” em “sem controle de sessão”.

### Princípio arquitetural

A mudança deve remover o **limite de capacidade**, não remover a **camada de segurança de sessão**.

Continuam obrigatórios:

- `sessionId`;
- `browserInstanceId`;
- UID;
- e-mail;
- workspaceId;
- UG;
- lease temporal;
- heartbeat;
- tombstone de revogação;
- invalidação por mudança de acesso;
- painel administrativo de sessões;
- auditoria `session.terminate`;
- telemetria de sessões/consumo.

### Implicação técnica conhecida

A implementação atual usa apenas:

- `slot-1`;
- `slot-2`.

Portanto **não basta alterar `DEFAULT_EXTERNAL_SECTOR_SESSION_LIMIT`**.

A frente deverá substituir a reserva física fixa por uma coleção de sessões dinâmicas ou mecanismo equivalente, preservando identidade e revogação.

Direção preferida:

```text
workspaces/{workspaceId}/sessionSlots/{sessionIdOuIdDinamico}
```

ou contrato equivalente que:

- aceite N sessões simultâneas;
- permita identificar cada sessão;
- permita revogar uma sessão específica;
- permita listar sessões no painel;
- permita expiração por lease;
- impeça overwrite de sessão alheia;
- preserve isolamento por workspace.

O nome final do documento/coleção pode ser mantido por compatibilidade se isso simplificar a migração, mas o ID não deve continuar restrito a `slot-1`/`slot-2`.

### Momento ideal de execução

Esta alteração deve ser executada:

**ANTES DO RC CANDIDATE / ANTES DO RC FROZEN.**

Motivo:

- a certificação física Mobile deve representar o comportamento real que será lançado;
- testar o RC com limite 2 e removê-lo depois invalidaria parte da certificação;
- a mudança toca Auth/sessão/Rules/telemetria e precisa estar estabilizada antes do Preview final.

Sequência recomendada:

```text
estado atual consolidado
→ frente transversal SESSION-CAP-01
→ regressão de Auth/sessão/Rules/telemetria
→ integração SaaS + Mobile
→ composição do RC
→ freeze
→ Preview HTTPS
→ testes físicos com múltiplos operadores
```

Se a composição do RC já tiver começado quando a frente for ativada, a alteração deve entrar **antes do freeze**, com repetição dos gates afetados.

Não aplicar após `RC FROZEN` como melhoria oportunista; nesse caso, somente reabrir o freeze por decisão explícita do Program Control/Fundador.

### Escopo executado/auditado da SESSION-CAP-01

Arquivos/contratos afetados ou auditados:

- `lib/platformCapacity.ts`;
- `lib/platformSessionLease.ts`;
- `lib/platformSessionControl.ts`;
- `lib/platformAdminSessions.ts`;
- `hooks/useOperationalData.ts`;
- `hooks/usePlatformAdminSessions.ts`;
- painel administrativo de sessões;
- provisionamento/exclusão de setor;
- lifecycle/suspensão;
- `firestore.rules`;
- testes multi-tenant;
- E2E de sessão;
- guards Block 16.0/16.1/16.2;
- guards Block 17.1/17.2;
- telemetria/consumo;
- documentação de capacidade.

### Regras de segurança da alteração

A remoção do teto não pode:

- permitir sessão de outro workspace;
- aceitar UG divergente;
- permitir uma sessão renovar lease de outra;
- permitir recriar sessão revogada;
- permitir que cliente altere identidade do lease;
- remover revogação administrativa;
- remover expiração temporal;
- remover painel de sessões;
- remover auditoria;
- quebrar suspensão/reativação;
- criar acesso anônimo ou bypass de Auth.

### Performance e custo

Mais sessões simultâneas podem aumentar:

- listeners;
- reads;
- writes de heartbeat;
- conexões;
- consumo Firestore;
- telemetria.

Por isso a frente deve medir:

- custo por sessão;
- writes de heartbeat;
- listeners por aba;
- pico de sessões por workspace;
- impacto no Cloud Monitoring;
- comportamento com vários celulares simultâneos.

A ausência de teto fixo não elimina observabilidade de capacidade. O EMPROVEX deve continuar podendo alertar sobre uso anormal ou excessivo.

### Critérios de aceitação utilizados

A frente foi considerada PASS após provar:

1. terceiro, quarto e demais logins externos não são bloqueados apenas por capacidade fixa;
2. cada navegador/celular possui identidade de sessão coerente;
3. múltiplas abas da mesma sessão continuam sem duplicação indevida de lease;
4. revogação de uma sessão não derruba sessões diferentes sem intenção;
5. suspensão do workspace invalida todas as sessões operacionais;
6. reativação não ressuscita tombstones antigos;
7. Rules permanecem fail-closed;
8. cross-workspace continua DENY;
9. painel admin lista/encerra sessões corretamente;
10. telemetria registra aumento de sessões;
11. Android + Desktop + múltiplos celulares podem coexistir;
12. Application CI/Core/Rules/multi-tenant/build/typecheck/diff hygiene passam;
13. MOBILE-J repete os testes afetados no RC.

### Classificação

Esta é uma **mudança funcional explicitamente autorizada pelo Fundador**, apesar do freeze geral de novas features.

Ela é tratada como exceção controlada porque remove uma limitação operacional que conflita diretamente com o uso Mobile do depósito.

A implementação e a certificação técnica da SESSION-CAP-01 foram concluídas em PASS; a mudança está integrada na linha SaaS/RC, ainda sem promoção da aplicação RC à produção.

### 9.5 Lifecycle observado em tempo real

Sessões externas monitoram:

- `workspaces/{workspaceId}`;
- `platformAccounts/{email}`;
- revogação da sessão.

Se workspace/conta deixa de estar `active`, identidade deixa de coincidir ou Rules negam acesso, a sessão é invalidada.

### 9.6 Autoridade da Central

A Central de Depósitos adiciona `warehouseAccess` como autorização específica do banco `emprovex-warehouse`.

Suspensão/reativação coordenada deve preservar coerência entre:

- workspace;
- platformAccount;
- warehouseAccess;
- sessões.

### 9.7 Regra multi-tenant

Nunca criar caminhos alternativos que permitam:

- ler outro workspace;
- trocar workspaceId/UG por input do cliente;
- usar barcode como autorização;
- contornar `warehouseAccess`;
- confiar apenas em estado visual/client-side.

Auth, workspace/UG, Legal Gate, lifecycle, sessão e Rules são contratos compartilhados por SaaS, Desktop e Mobile.

# PARTE IV — CENTRAL DE DEPÓSITOS

## 10. Nome e compatibilidade

Nome vigente de produto: **Central de Depósitos**.

O caminho técnico histórico `adm-deposito` e documentos antigos permanecem por compatibilidade.

## 11. Fontes da verdade logísticas

Não criar fontes paralelas para:

- material;
- posição;
- saldo;
- lote;
- barcode;
- ledger;
- transferência;
- autorização de depósito.

Contratos centrais reutilizados pelo Desktop e pela Mobile:

- materiais canônicos;
- depósitos/localizações/subposições;
- `WarehouseStockPosition`;
- lotes/validade;
- FEFO;
- barcode;
- ledger;
- saldos materializados;
- intake;
- transferência;
- outbound.

## 12. Operações canônicas

### Entrada / ALLOCATE

A alocação móvel e desktop deve reutilizar operações oficiais, com:

- idempotência;
- revalidação concorrente;
- associação de barcode;
- lote/validade;
- ausência de escrita client-side paralela de saldo/ledger.

### TRANSFER

Transferência oficial:

- altera distribuição física;
- preserva o total agregado;
- usa operação `TRANSFER`;
- `quantityDelta = 0`;
- não simula transferência por OUTBOUND + nova entrada;
- não escreve diretamente `locationBalance`.

### OUTBOUND

Saída de material deve preservar:

- carrinho/draft;
- idempotência;
- lotes;
- FEFO;
- saldo não negativo;
- ledger oficial.

### Identidade física

Namespace Mobile: **EPX1**.

EPX1 deriva da identidade técnica e sempre é resolvido novamente contra entidades canônicas.

EPX1 não é fonte paralela de posição.

---

# PARTE V — PERFORMANCE R3

## 13. Estado

**PUBLICADA E ENCERRADA.**

Produção:

`main@e90f92acae1514ee5cbc6ce95fed354bc1454330`

A Performance R3 permanece como baseline técnica da produção enquanto SaaS R1/Mobile R1 não forem publicados.

## 14. Resultados consolidados relevantes

Resultados finais registrados durante a rodada:

- Home: First Load caiu aproximadamente de 460 kB para 335 kB;
- principais rotas da Central: aproximadamente 579 kB para 106 kB;
- shared global: aproximadamente 104 kB;
- lazy loading ampliado;
- consultas históricas movidas para demanda;
- invoices quentes separadas semanticamente do histórico;
- cache curto em memória com TTL e isolamento por workspace;
- shell persistente da Central;
- budgets e métricas versionados;
- validação de UX obrigatória.

Detalhes completos de PERF-A...J e PERF-X permanecem no histórico integral e nos documentos `PERFORMANCE_R3_*`.

## 15. Regra permanente herdada da R3

> Ganho técnico que piora significativamente a experiência do operador não é aceito como otimização.

Performance não pode justificar:

- perda de formulário;
- clique aparentemente sem resposta;
- ausência de feedback;
- quebra de foco/teclado/scanner;
- navegação menos previsível;
- informação visual enganosa;
- necessidade nova de refresh manual.

---

# PARTE VI — SAAS R1

## 16. Objetivo

Transformar o EMPROVEX operacional em serviço comercial controlado, sem reconstruir o núcleo do produto.

Princípios:

- vender inicialmente de forma assistida;
- preservar usuários existentes;
- não automatizar finanças antes de haver necessidade real;
- manter billing separado da autorização operacional;
- preservar multi-tenant, segurança, legal, recovery e auditoria;
- só abrir comercialmente após RC, piloto, correções e certificação final.

## 17. Contrato comercial, pagamento, onboarding, legal e lifecycle

### 17.1 Plano comercial congelado

R1 possui um único plano:

**Plano Completo EMPROVEX — R$ 70,00/mês por workspace**

Inclui acesso funcional completo às funcionalidades disponibilizadas para aquele tenant.

Não existem na R1:

- tiers Bronze/Prata/Pro;
- módulos pagos separadamente;
- feature flags comerciais por preço;
- checkout embutido;
- assinatura criada por API;
- webhook de pagamento;
- suspensão automática;
- signup público de organização.

### 17.2 Trial, vencimento e tolerância

Contrato:

- trial padrão: **30 dias**;
- início: provisionamento/concessão administrativa;
- extensão: somente administrativa e auditada;
- vencimento: **5º dia útil**;
- tolerância: **10 dias corridos**;
- feriados adicionais podem ser configurados;
- fim do trial não apaga dados;
- fim do trial não suspende automaticamente;
- competências históricas preservam o valor já materializado.

### 17.3 Fonte de verdade de billing

Coleções/contratos principais:

- configuração: `platformBillingConfig/main`;
- conta comercial: `billingAccounts/{workspaceId}`;
- competências: `billingCycles/{workspaceId}__{referenceMonth}`.

Estados de `BillingAccount`:

- `trial` — teste em andamento;
- `active` — comercialmente regular;
- `pending` — atenção/regularização;
- `suspended` — estado comercial explícito;
- `canceled` — encerramento comercial;
- `exempt` — founder ou VIP/isento.

Estados de competência:

- `open`;
- `pending`;
- `paid`;
- `waived`.

Não criar estados comerciais concorrentes.

### 17.4 Modo de cobrança vigente

Configuração canônica R1:

- `billingMode = observe`;
- `requirePayment = false`;
- `automaticSuspension = false`;
- método administrativo: `pix_manual`.

Consequência essencial:

**billing acompanha e audita a situação comercial, mas billing sozinho não autoriza nem bloqueia o uso operacional.**

Marcar `billingAccounts.status = suspended` não substitui a ação de lifecycle que realmente desabilita workspace/conta/Central.

### 17.5 Pagamento e regularização

O EMPROVEX **não processa cartão/Pix internamente**.

Fluxo canônico:

```text
cliente precisa regularizar
→ abre /regularizacao
→ usa Link de Pagamento HTTPS e/ou copia Pix
→ pagamento ocorre fora do EMPROVEX
→ Fundador/admin confere o recebimento no provedor/banco
→ confirma a competência no painel
→ competência = paid (ou waived quando aplicável)
→ billing account = active
→ evento auditado
```

Configurações administrativas disponíveis:

- `paymentLinkUrl` — URL pública HTTPS;
- `pixKey`;
- `pixKeyType` — CPF/CNPJ/e-mail/telefone/chave aleatória;
- `pixRecipientName`;
- `supportContact`;
- `holidayDates`;
- trial/tolerância dentro dos limites aceitos.

A mensalidade R1 é fixada em R$ 70 pelo domínio; o painel não deve aceitar outro preço como configuração casual.

### 17.6 Provedor de pagamento

O desenho comercial inicial documenta Mercado Pago/Pix como referência operacional.

A implementação, porém, armazena apenas **uma URL pública HTTPS de pagamento**, sem credencial do provedor. Portanto o RC não fica tecnicamente acoplado a um único gateway.

Se outro provedor for adotado:

- deve oferecer URL HTTPS pública apropriada;
- nenhum token/secret deve ir para o cliente;
- Termos/Privacidade devem ser revistos se a mudança alterar materialmente terceiros envolvidos;
- a fonte de verdade da competência continua no EMPROVEX, não no gateway.

API/webhook permanece fora da R1.

### 17.7 Dados financeiros que o EMPROVEX não armazena

Não armazenar:

- número de cartão;
- CVV;
- credencial do gateway;
- Access Token de pagamento no cliente;
- token de cartão;
- comprovante financeiro por padrão.

Podem existir apenas metadados administrativos mínimos e auditáveis, como nota/referência textual da confirmação.

### 17.8 Página pública de regularização

Rota:

`/regularizacao`

Deve apresentar:

- Plano Completo;
- mensalidade;
- vencimento/tolerância;
- Link de Pagamento quando configurado;
- Pix quando configurado;
- contato de suporte.

A página declara que o pagamento ocorre fora do EMPROVEX e não solicita cartão/CVV.

Regularização, Termos, Privacidade e recuperação de credenciais não devem ficar inutilizáveis justamente quando o usuário está suspenso ou precisa recuperar acesso.

### 17.9 Confirmação/reabertura da competência

A confirmação manual é auditada.

- `paid` ou `waived` → competência confirmada; billing account comercial passa para `active`;
- reabertura/não confirmação → billing account passa para `pending`.

**Importante:** se o workspace tiver sido operacionalmente desabilitado pelo lifecycle, confirmar pagamento não equivale automaticamente a reativá-lo. A reativação de acesso é uma ação administrativa separada e explícita.

### 17.10 Suspensão operacional e reativação

A suspensão real da R1 é manual e founder-only.

Para suspender:

1. validar ator/admin;
2. validar coerência workspace/e-mail/UG/conta;
3. desabilitar `warehouseAccess`;
4. alterar `workspaces.status` e `platformAccounts.status` para `disabled`;
5. revogar sessões conhecidas e remover slots;
6. registrar auditoria;
7. compensar/rollback parcial se um banco falhar.

Reativação:

1. retorna workspace/conta principal para `active`;
2. retorna `warehouseAccess` para `active`;
3. se a segunda etapa falhar, o código tenta compensar para impedir estado incoerente;
4. falha parcial não é escondida: pode resultar em `RECOVERY_REQUIRED`.

Suspensão/reativação **não altera dados operacionais**.

### 17.11 Cancelamento e exclusão

`canceled` é estado comercial, não comando de delete.

Cancelamento não:

- apaga workspace;
- apaga documentos;
- apaga histórico;
- apaga estoque/ledger;
- reaproveita UG/e-mail automaticamente.

Retenção, exportação e exclusão são processos separados e sujeitos à política legal/administrativa aplicável.

### 17.12 Onboarding assistido

Não existe auto-cadastro de organização.

Fluxo canônico:

1. Fundador/admin confirma dados mínimos;
2. cria workspace/UG pelo painel;
3. informa e-mail operacional primário;
4. concede trial quando aplicável;
5. provisionamento cria Auth/diretório/billing;
6. credencial inicial é enviada por canal seguro;
7. primeiro acesso valida e-mail/provider/UID/workspace/UG;
8. usuário aceita pacote legal vigente;
9. checklist curto de primeiro acesso é exibido;
10. Google Drive é opcional;
11. usuário começa a operar.

Conta externa: password-only. Founder: Google-only.

### 17.13 Recuperação e troca de senha

R1 inclui:

- “Esqueci minha senha” usando fluxo nativo do Firebase;
- resposta neutra para reduzir enumeração de contas;
- troca da própria senha com reautenticação;
- mensagens humanas para credencial inválida, conta suspensa, workspace inconsistente e limite de sessão.

### 17.14 Legal Gate versionado

Pacote legal atual:

- `legalBundleVersion = saas-r1-2026-10-01`;
- `termsVersion = terms-2026-10-01-r1`;
- `privacyVersion = privacy-2026-10-01-r1`.

Aceite canônico:

`workspaces/{workspaceId}/legalAcceptances/{uid}__{legalBundleVersion}`

Registro contém:

- workspaceId;
- UG;
- UID;
- e-mail;
- versão do bundle;
- versão dos Termos;
- versão da Privacidade;
- timestamp autoritativo.

O runtime verifica especificamente a versão vigente. Novo aceite só é exigido quando o pacote legal configurado muda.

Falha na verificação é **fail-closed**: nenhum aceite é presumido.

Termos e Privacidade permanecem consultáveis no próprio gate.

Aceite contratual não significa que todo tratamento de dados pessoais dependa de “consentimento LGPD”.

### 17.15 Arquitetura de dados SaaS

Não criar terceiro Firestore apenas para billing/legal/onboarding.

Arquitetura R1:

1. banco principal — identidade, workspace, billing, legal, auditoria e núcleo operacional;
2. `emprovex-warehouse` — Central de Depósitos;
3. nenhum terceiro banco SaaS.

Rules são específicas por banco e continuam parte do contrato de release.

## 18. VIP e isenção comercial

### 18.1 Founder

Founder permanece:

- `exempt`;
- preço efetivo R$ 0;
- sem trial;
- sem inadimplência;
- isento do limite padrão de sessões externas.

### 18.2 VIP manual

VIP externo reutiliza a semântica `exempt`.

Contrato:

- mesmo Plano Completo;
- R$ 0 enquanto a isenção estiver ativa;
- nenhuma redução funcional;
- sem cobrança/atraso/suspensão por inadimplência;
- concessão/remoção manual, explícita e auditada;
- histórico preservado.

Não criar status `vip` concorrente.

### 18.3 VIP legado

Coorte histórica materializada:

- `aprovisionamento-2-b-fv`;
- `aprovisionamento-3-gac-ap`;
- `aprovisionamento-teste`.

O código atual protege a isenção `legacy_vip` contra remoção pela operação genérica de isenção.

VIP não cria exceção de segurança, sessão, Legal Gate ou isolamento multi-tenant. Isenção é comercial, não autorização privilegiada.

## 19. Ordem oficial da reta final SaaS

Estado funcional SaaS: **ENCERRADO PARA NOVAS FEATURES**.

Sequência vigente:

```text
HARDEN-A1/A2/B/C/D PASS
→ auditorias paralelas finais + conclusão MOBILE-K
→ composição do RC único SaaS+Mobile
→ CT-01 + Rules/package/CI
→ gates combinados
→ RC FROZEN
→ Preview HTTPS
→ certificação real SaaS+Mobile
→ eventual produção controlada autorizada
→ piloto real
→ correções finais
→ SAAS-J
→ GO explícito
→ abertura comercial ampla
```

Nenhuma nova wave funcional SaaS está autorizada sem regressão concreta ou nova decisão de produto.

## 20. HARDEN — estado vivo

| Frente | Estado vigente | Decisão |
| --- | --- | --- |
| HARDEN-A1 — jsPDF | **PASS / ENCERRADA** | jsPDF 4.2.1 + AutoTable 5.0.8; CRITICAL removido; 7/7 regressão PDF; acabamento visual fino = backlog não bloqueante |
| HARDEN-A2 — Firebase/Firestore/gRPC | **PASS — RISCO RESIDUAL ACEITO TECNICAMENTE** | sem alteração de dependência/runtime/Rules; vetores analisados não alcançáveis pelos usos atuais |
| HARDEN-B — Recovery | **PASS / ENCERRADA** | backup READY nos dois bancos; `recovery:verify` PASS; restore isolado Warehouse PASS; integridade 13/13; target temporário ainda exige cleanup separado |
| HARDEN-C — Health/Rules/Release | **PASS / ENCERRADA** | health/release/rollback preparados |
| HARDEN-D — SaaS↔Mobile | **PASS / ENCERRADA** | sem conflito funcional material; CT-01 isolada para o RC |

### A1 — regra pós-fechamento

A inspeção visual fina de PDF não bloqueia RC/piloto/lançamento.

Só reabre gate se surgir defeito funcional real, como:

- PDF vazio;
- geração quebrada;
- conteúdo ausente;
- ilegibilidade operacional;
- paginação funcionalmente destruída.

Margem, espaçamento, alinhamento e refinamento estético ficam em backlog.

### A2 — risco residual

A cadeia Firebase → Firestore → `@grpc/grpc-js` permanece instalada.

Decisão aceita:

- não forçar override fora do range do Firestore;
- não fazer downgrade/major só para reduzir scanner;
- uso browser não carrega o transporte Node gRPC;
- uso Node atual é cliente Firestore, sem servidor gRPC próprio nem primitivas de servidor analisadas;
- não abrir nova frente Firebase/gRPC sem nova evidência técnica ou correção upstream suportada.

Snapshot técnico da A2:

- Firebase declarado: `^10.12.2`;
- Firebase resolvido: `10.14.1`;
- `@firebase/firestore`: `4.7.3`;
- `@grpc/grpc-js`: `1.9.16`;
- pin Firestore: `~1.9.0`.

A aceitação de risco não declara a biblioteca intrinsecamente segura; declara o risco específico como não alcançável pelo uso atual e sem correção suportada melhor no momento.

## 21. HARDEN-B — recovery

Estado vigente:

**PASS / ENCERRADA**

Evidências consolidadas:

- backup nativo `READY`: PASS nos dois bancos;
- `recovery:verify`: PASS;
- restore real isolado do `emprovex-warehouse`: PASS;
- validação de integridade: **13/13 coleções**;
- target temporário: `emprovex-restore-warehouse-2026-10-04`;
- delete protection do target temporário: **ATIVA**.

Pendência separada, não bloqueante do RC:

- cleanup do target temporário.

Esse cleanup exige autorização específica porque envolve desligar delete protection e apagar o banco temporário. Não deve ser executado por worker de auditoria/release.

### Relação HARDEN-B ↔ RC

- recovery não é mais blocker técnico do RC;
- nenhum worker deve repetir `recovery:apply` ou executar novo restore sem necessidade/autorização;
- a evidência existente deve ser reutilizada;
- eventual mudança futura de estratégia de backup/restore reabre o gate correspondente.

## 22. Health, Rules, observabilidade e release

### 22.1 Health

Contrato:

- `/api/health` público;
- não expõe dados sensíveis;
- não depende de leitura operacional do Firestore para responder saúde básica.

### 22.2 Observabilidade

Fontes oficiais R1:

- Vercel — deploy/runtime;
- GitHub Actions — certificação/gates;
- Cloud Monitoring — métricas/uptime;
- telemetria Firebase/Firestore já existente;
- logs de sessão/Central quando aplicável.

No ambiente publicado, validar:

- domínio/SSL;
- `/api/health`;
- erros runtime/HTTP;
- erros Firestore/permissão;
- erros de sessão;
- erros da Central;
- crashes do scanner;
- consumo inesperado;
- uptime check/alerta/canal quando materializados.

Uptime/alerta externo não deve ser declarado PASS sem evidência real do ambiente publicado.

### 22.3 Rules vigentes do RC e compatibilidade com `main`

SaaS, RC e MOBILE-K possuem os mesmos arquivos de Rules do candidato já publicado de forma autorizada.

Blobs vigentes do RC:

- `firestore.rules`: `bc91185f34bcdcb4437a4de1078d1089a09292ba`;
- `firestore.warehouse.rules`: `6e1f1050005314db4e17cb3136409abbddb0ee91`.

Arquivos ainda presentes em `main`/baseline R3:

- `firestore.rules@0d990b7de0b2e85ed55fe14ec0d2ce29b3635299`;
- `firestore.warehouse.rules@b5325fe5a8cbe9b0ade8568d35a2cd678ce6e0f2`.

Isso é intencional: o app em produção continua antigo, enquanto as Rules RC já foram publicadas primeiro por compatibilidade de rollout.

Contrato de rollout já certificado:

- app antiga + Rules antigas = baseline histórica;
- app antiga + Rules RC = **compatível**;
- app RC + Rules RC = alvo;
- app RC + Rules antigas = **não compatível** com leases dinâmicos.

Rollback seguro do app pode manter Rules RC. Rollback das Rules para a baseline antiga só pode ocorrer depois do rollback da aplicação.

Nenhuma das quatro frentes paralelas está autorizada a alterar esses arquivos de Rules. Se surgir necessidade real, abrir revisão coordenada e repetir os gates afetados.

### 22.4 RULES-AUDIT-01 — auditoria integral de compatibilidade das Firestore Rules

Decisão do Fundador em 2026-10-03:

**as Rules do SaaS R1 + Mobile R1 não serão publicadas em produção por tentativa e erro. Antes de qualquer publicação produtiva, o ruleset final do RC deve passar por uma auditoria integral de compatibilidade.**

Classificação:

**GATE TRANSVERSAL OBRIGATÓRIO PRÉ-RC / PRÉ-PUBLICAÇÃO DE RULES**

Owner:

**Program Control + Coordenação do RC**

#### 22.4.1 Objetivo

Garantir, antes da publicação, que as Rules finais:

1. preservem tudo o que já funciona corretamente na Performance R3;
2. incorporem apenas os novos contratos necessários de SaaS R1, Mobile R1 e SESSION-CAP-01;
3. não introduzam regressões de autorização;
4. não abram acesso indevido;
5. não criem bloqueios sistêmicos de usuários legítimos;
6. mantenham isolamento multi-tenant;
7. mantenham a Central de Depósitos funcional;
8. tenham rollback conhecido e testável;
9. sejam compatíveis com a ordem real de rollout entre aplicação e Rules;
10. possam ser publicadas sem depender de correções improvisadas em produção.

#### 22.4.2 Estado atual das Rules antes da SESSION-CAP-01

Banco principal:

- produção / `main`: `firestore.rules@0d990b7de0b2e85ed55fe14ec0d2ce29b3635299`;
- candidata SaaS: `firestore.rules@57a1394c921b2ab2c15537fbfc4aaea17515b28a`;
- candidata Mobile: **idêntica à candidata SaaS**;
- tamanho aproximado produção: **87,49 KiB / 2.380 linhas**;
- tamanho aproximado candidata: **92,11 KiB / 2.500 linhas**;
- delta observado: aproximadamente **+124 / -4 linhas**.

Banco `emprovex-warehouse`:

- produção / `main`: `firestore.warehouse.rules@b5325fe5a8cbe9b0ade8568d35a2cd678ce6e0f2`;
- candidata SaaS: `firestore.warehouse.rules@6e1f1050005314db4e17cb3136409abbddb0ee91`;
- candidata Mobile: **idêntica à candidata SaaS**;
- tamanho aproximado produção: **151,55 KiB / 3.307 linhas**;
- tamanho aproximado candidata: **152,38 KiB / 3.330 linhas**;
- delta observado: aproximadamente **+24 / -1 linha**.

Conclusão atual:

**não existe conflito SaaS versus Mobile nas Rules candidatas conhecidas. O conflito a auditar é produção R3 versus ruleset final do novo release.**

Os hashes acima são baseline histórica desta auditoria. O PASS final deve usar os hashes do **ruleset pós-SESSION-CAP-01**, que podem ser diferentes.

#### 22.4.3 Dependência obrigatória da SESSION-CAP-01

A auditoria final só pode congelar PASS **depois** da SESSION-CAP-01.

Motivo:

- o runtime atual usa `sessionSlots/slot-1` e `slot-2`;
- as Rules atuais validam esse contrato fixo;
- SESSION-CAP-01 deverá permitir sessões dinâmicas ou mecanismo equivalente;
- portanto o ruleset final ainda sofrerá alteração estrutural.

Regra:

```text
SESSION-CAP-01
→ ruleset final estrutural
→ RULES-AUDIT-01
→ PASS RULES
→ composição/finalização do RC
```

Uma auditoria executada antes da SESSION-CAP-01 pode servir como **baseline**, mas não substitui a auditoria final.

#### 22.4.4 Princípio de compatibilidade

A auditoria não deve perguntar apenas:

> “o App RC funciona com Rules RC?”

Ela deve responder também:

> “as Rules RC preservam o comportamento legítimo já existente na Performance R3?”

Contrato:

**Rules finais = capacidades legítimas já existentes + novos contratos SaaS/Mobile + nenhum acesso indevido novo.**

Não é aceitável resolver uma necessidade nova apagando silenciosamente uma permissão legítima antiga.

#### 22.4.5 Fase A — captura da baseline realmente publicada

Antes de comparar arquivos do Git:

1. consultar o ruleset efetivamente ativo no banco principal;
2. consultar o ruleset efetivamente ativo no `emprovex-warehouse`;
3. registrar Ruleset ID/versão quando disponível;
4. guardar conteúdo/fingerprint/hash;
5. comparar com os blobs esperados de `main`;
6. registrar data/hora da captura;
7. registrar projeto/database alvo.

Se o ruleset realmente publicado divergir do `main` conhecido:

**STOP / DRIFT DE PRODUÇÃO**

Nenhuma publicação nova deve ocorrer antes de explicar e reconciliar a divergência.

#### 22.4.6 Fase B — diff estrutural e semântico

Não limitar a revisão a contagem de linhas.

Para cada arquivo:

- mapear helpers adicionados/removidos/alterados;
- mapear cada `match` adicionado/removido/alterado;
- mapear cada `allow read/get/list/create/update/delete/write`;
- identificar mudanças de provider;
- identificar mudanças de UID/e-mail/workspace/UG;
- identificar mudanças de lifecycle;
- identificar mudanças de billing/legal;
- identificar mudanças de sessão;
- identificar mudanças de `warehouseAccess`;
- identificar mudanças em validação de shape/tamanho/status;
- identificar mudança permissiva;
- identificar mudança restritiva;
- identificar mudança neutra/estrutural.

Cada delta deve possuir:

- origem;
- requisito que o justifica;
- superfície afetada;
- risco de falso ALLOW;
- risco de falso DENY;
- teste correspondente.

#### 22.4.7 Fase C — matriz ALLOW / DENY

Todo domínio modificado deve ter testes positivos e negativos.

Exemplo canônico:

```text
operação legítima do próprio workspace → ALLOW
mesma operação em outro workspace → DENY
sessão sem provider correto → DENY
sessão sem claim/identidade exigida → DENY
usuário não autenticado → DENY
admin onde não existe bypass operacional → DENY
payload válido → ALLOW
payload adulterado → DENY
```

A matriz deve cobrir no mínimo:

**Identidade / multi-tenant**
- founder Google;
- externo password;
- UID correto/incorreto;
- e-mail verificado;
- workspace próprio;
- workspace alheio;
- UG própria;
- UG divergente;
- sessão suspensa/desabilitada.

**Sessões**
- sessão dinâmica válida;
- renovação do próprio lease;
- tentativa de renovar lease de outra sessão;
- sessão revogada;
- tombstone;
- sessão expirada;
- múltiplas sessões legítimas;
- suspensão global do workspace;
- painel administrativo/encerramento remoto.

**Billing**
- configuração administrativa;
- preço R$ 70;
- VIP/`exempt`;
- VIP legado;
- competência;
- usuário externo sem permissão de alteração administrativa.

**Legal**
- GET do próprio aceite esperado;
- criação do próprio aceite vigente;
- versão errada;
- UID errado;
- workspace errado;
- listagem;
- update;
- delete.

**Central de Depósitos**
- founder;
- setor externo autorizado;
- setor externo sem claims;
- setor suspenso;
- `warehouseAccess active`;
- `warehouseAccess disabled`;
- workspace alheio;
- UG divergente.

**Operações logísticas**
- materiais;
- depósitos;
- posições/subposições;
- lotes;
- barcode;
- intake;
- allocation;
- transfer;
- inventory;
- outbound;
- ledger;
- saldos;
- configurações/layouts/destinos aplicáveis.

#### 22.4.8 Fase D — regressão do EMPROVEX legado

O ruleset novo deve rodar também contra as suítes de funcionalidades antigas.

Cobertura mínima:

- Empenhos;
- Itens;
- Notas Fiscais;
- Comissão;
- Liquidação/Tesouraria;
- Cronogramas;
- Fornecedores;
- Alertas;
- Relatórios/SAG;
- Auditoria;
- backup/status quando aplicável;
- Central Desktop;
- operações logísticas já certificadas.

Não é necessário criar teste manual novo para cada linha não alterada se já existir suíte automatizada confiável. Porém **todas as suítes relevantes devem ser executadas com o ruleset final**.

#### 22.4.9 Fase E — Emulator e suíte automatizada

Usar Firestore Emulator/Local Emulator Suite quando aplicável.

Suítes já existentes que devem ser reaproveitadas e ampliadas, entre outras:

- `scripts/firestore-multitenancy-security.test.mjs`;
- `scripts/warehouse-external-access-security.test.mjs`;
- `scripts/legal-acceptance-security.test.mjs`;
- `scripts/verify-saas-r1-security-enforcement.mjs`;
- `scripts/verify-sector-lifecycle.mjs`;
- `scripts/verify-saas-r1-integration.mjs`;
- guards Block 16.0/16.1/16.2;
- guards Block 17.1/17.2;
- testes da Central de Depósitos;
- segurança externa da Central.

Criar, quando a frente for executada, um orquestrador único ou comando equivalente:

`npm run verify:rc-rules-audit`

Objetivo:

**um comando deve reproduzir o gate das Rules do RC sem depender de uma sequência manual esquecível.**

#### 22.4.10 Fase F — matriz de compatibilidade de rollout

Avaliar explicitamente:

| Aplicação | Rules | Objetivo |
| --- | --- | --- |
| Performance R3 | Rules R3 | baseline conhecida |
| Performance R3 | Rules RC | provar compatibilidade durante publicação/rollback |
| App RC | Rules RC | produto final esperado |
| App RC | Rules R3 | identificar operações novas que exigem Rules novas e definir ordem segura de rollout |

A quarta combinação não precisa ser totalmente funcional; ela deve ser **conhecida**.

Se App RC depender obrigatoriamente de uma permissão inexistente nas Rules R3, documentar:

- qual fluxo falha;
- tipo de falha;
- ordem correta de rollout;
- impacto de rollback;
- janela aceitável.

Nenhuma ordem de deploy deve ser escolhida por suposição.

#### 22.4.11 Fase G — compatibilidade da migração de sessões

SESSION-CAP-01 merece análise explícita.

Se tecnicamente viável e seguro, preferir uma janela transitória em que as Rules reconheçam:

- slots legados `slot-1`/`slot-2`;
- IDs dinâmicos novos.

Objetivo:

- permitir rollout/rollback sem quebrar imediatamente clientes/versões anteriores;
- não obrigar migração destrutiva;
- manter segurança durante coexistência.

A compatibilidade legada só permanece enquanto necessária.

Não manter código/Rules legados indefinidamente sem motivo.

Se coexistência segura não for possível, documentar claramente:

- por que não;
- ordem obrigatória de rollout;
- procedimento de rollback;
- efeito sobre sessões já abertas.

#### 22.4.12 Fase H — análise de performance e custo das Rules

A auditoria deve verificar também:

- número de `get()`/`exists()` por avaliação;
- risco de exceder limites de document access calls;
- impacto de `warehouseLifecycleAllowsAccess`;
- impacto de sessões dinâmicas;
- tamanho do ruleset fonte;
- tamanho compilado quando disponível;
- tempo do Emulator;
- crescimento desnecessário de helpers duplicados.

Não resolver segurança aumentando de forma cega o número de leituras das Rules.

#### 22.4.13 Fase I — rollback de Rules

Antes da publicação, manter disponíveis:

**Banco principal**
- hash/blob da Rule anterior;
- arquivo exato anterior;
- comando/procedimento de republicação.

**Warehouse**
- hash/blob da Rule anterior;
- arquivo exato anterior;
- comando/procedimento de republicação.

Rollback de Rules deve ser independente do rollback da aplicação.

Regra:

```text
rollback Vercel != rollback Rules != rollback dados
```

Se uma Rule permissiva indevida tiver permitido escrita/leitura inadequada, republicar a Rule anterior **não desfaz dados já gravados**.

Nesse caso:

1. fechar acesso;
2. identificar janela;
3. auditar documentos/movimentos;
4. reconciliar dados;
5. só depois encerrar incidente.

#### 22.4.14 Fase J — evidência obrigatória

O handoff da RULES-AUDIT-01 deve entregar:

- RULES_MAIN_HASH;
- RULES_RC_HASH;
- WAREHOUSE_RULES_MAIN_HASH;
- WAREHOUSE_RULES_RC_HASH;
- ruleset IDs ativos quando capturáveis;
- diff estrutural;
- diff semântico;
- matriz ALLOW/DENY;
- testes executados;
- contagem PASS/FAIL;
- regressão do legado;
- regressão SaaS;
- regressão Mobile;
- regressão SESSION-CAP-01;
- compatibilidade de rollout;
- tamanho fonte/compilado quando disponível;
- rollback principal;
- rollback warehouse;
- riscos residuais;
- recomendação final.

Classificações permitidas:

- **PASS — RULES APTAS PARA RC**;
- **PARCIAL — CORREÇÃO NECESSÁRIA**;
- **FAIL — BLOQUEAR RC**.

Não existe “PASS por inferência”.

#### 22.4.15 Critérios mínimos de PASS

RULES-AUDIT-01 só pode ser PASS se:

1. Rules ativas atuais forem conhecidas e reconciliadas;
2. não existir drift produtivo inexplicado;
3. SESSION-CAP-01 já estiver refletida no ruleset final;
4. SaaS e Mobile apontarem para o mesmo ruleset final;
5. ALLOW legítimos críticos passarem;
6. DENY de segurança críticos passarem;
7. cross-workspace continuar DENY;
8. founder continuar funcional;
9. externos legítimos continuarem funcionais;
10. Legal Gate funcionar;
11. billing administrativo funcionar sem virar autorização operacional;
12. lifecycle/suspensão/reativação funcionar;
13. Central Desktop funcionar;
14. Central Mobile funcionar;
15. sessões dinâmicas funcionarem;
16. regressão R3 relevante passar;
17. nenhum acesso permissivo novo inexplicado existir;
18. nenhum bloqueio sistêmico novo existir;
19. rollback de ambos os bancos estiver preparado;
20. ordem de rollout estiver definida;
21. tamanho/complexidade do ruleset estiver dentro dos limites aplicáveis;
22. gates automatizados estiverem reproduzíveis.

#### 22.4.16 Regra de publicação

**Nenhuma Firestore Rule produtiva nova do SaaS R1/Mobile R1 poderá ser publicada sem RULES-AUDIT-01 = PASS.**

Exceção:

somente correção emergencial de segurança/incidente real, com autorização explícita do Fundador e Program Control, evidência mínima, rollback pronto e auditoria retrospectiva obrigatória.

CI verde isolado não substitui RULES-AUDIT-01.

PR mergeable não substitui RULES-AUDIT-01.

Preview aprovado não substitui RULES-AUDIT-01.

#### 22.4.17 Relação com o RC

A sequência oficial passa a ser:

```text
SESSION-CAP-01
→ ruleset final
→ RULES-AUDIT-01
→ PASS RULES
→ composição/finalização RC
→ CT-01/package/CI
→ gates combinados
→ RC CANDIDATE
→ RC FROZEN
→ Preview HTTPS
```

Se qualquer mudança posterior ao PASS alterar:

- `firestore.rules`;
- `firestore.warehouse.rules`;
- Auth/provider;
- UID/workspace/UG;
- lifecycle;
- Legal;
- billing enforcement;
- sessão;
- `warehouseAccess`;

o PASS de Rules deve ser considerado **afetado** e os blocos correspondentes da auditoria precisam ser repetidos antes do freeze.

### 22.5 Runbook de incidente

Sequência mínima:

1. confirmar domínio/deployment;
2. verificar health/runtime;
3. verificar Firestore/Monitoring;
4. classificar impacto;
5. interromper writes se houver dúvida de integridade;
6. corrigir ou rollback;
7. reconciliar dados antes de qualquer correção manual;
8. registrar incidente material.

Problema visual isolado não é automaticamente incidente de rollback.

## 23. CT-01 — contrato transversal obrigatório do RC

Estado atual:

- SaaS/main: `camera=(), microphone=(), geolocation=()`;
- Mobile: `camera=(self), microphone=(), geolocation=()`.

Contrato global do RC:

`camera=(self), microphone=(), geolocation=()`

Interpretação:

- câmera same-origin permitida;
- microfone continua bloqueado;
- geolocalização continua bloqueada;
- `getUserMedia` ainda depende de HTTPS/contexto seguro e permissão do navegador.

Ownership:

**Coordenação do RC.**

MOBILE-J não altera globalmente `next.config.ts` por conta própria.

Antes do PASS final:

- materializar CT-01 na branch RC;
- executar gates afetados;
- publicar Preview HTTPS;
- validar o header HTTP realmente servido;
- provar câmera real em dispositivo físico.

# PARTE VII — MOBILE R1

## 24. Objetivo e contrato Mobile R1

Levar operações físicas da Central de Depósitos ao navegador móvel sem criar segunda fonte da verdade.

Contrato:

- web mobile;
- online-first;
- mesma Auth/workspace/UG;
- mesmo Legal Gate/lifecycle/sessão;
- scanner compartilhado;
- EPX1 apenas como identidade física;
- resolver sempre contra entidades canônicas;
- repositories/ledger/saldo/lote/posição oficiais;
- **um único motor operacional canônico compartilhado com a Central Desktop**;
- Mobile deve conter scanner, resolução física e UX compacta, mas não uma segunda autoridade para saldo, lote, validade, FEFO, idempotência ou escrita transacional;
- fallback manual;
- sem banco Mobile paralelo;
- sem operação offline integral na R1.

## 25. Estado funcional consolidado

Concluído e integrado:

- MOBILE-A — plataforma/scanner;
- MOBILE-B — etiquetas/resolver;
- Integração 1;
- MOBILE-C — alocação;
- MOBILE-D — transferência;
- MOBILE-E — consulta;
- Integração 2;
- MOBILE-F — inventário;
- MOBILE-G — saída;
- MOBILE-H — conferência;
- Integração 3;
- MOBILE-I — integração controlada A–H.

MOBILE-I:

- worker certificado: `ea5ad10054e2aea608e270a970fde723cde41d93`;
- PR #245: merged;
- squash: `3a5689e0e613adfb7dbf48ef8d44085ec6c951b3`;
- gates principais: PASS;
- novo delta funcional SaaS↔Mobile: nenhum.

Não reabrir F/G/H/I sem regressão concreta.

## 26. MOBILE-J — certificação final e reabertura controlada

Linha RC ativa:

`rc-r1-mobile-j-fix-label-readability@bd27da91da92642d5a5fea08f7020c6cea658a62`

PR #252:

**OPEN / DRAFT / MERGEABLE / NÃO MERGEADO**

Estado do HEAD no checkpoint deste Memorial:

- Vercel Preview: **SUCCESS**;
- Core Protection #317: **SUCCESS**;
- Application CI #1030: **AGUARDANDO RUNNER**;
- produção/main: **INALTERADOS**.

A MOBILE-J encontrou defeitos reais durante o uso físico, portanto o freeze original foi reaberto de forma controlada. Entre os achados já tratados estão:

- Code 128/etiqueta física e legibilidade;
- etiqueta Compacta 140 × 35 mm com leitura física confirmada;
- compatibilidade de dados legados em read models;
- separação UX entre Saída e Transferência;
- Consultar Item read-only;
- reconciliação explícita de saldo sem localização, posição inativa e divergência real;
- suporte experimental a transferência parcial com lotes no HEAD atual.

### 26.1 Decisão arquitetural autorizada — MOBILE-K / motor operacional único

O teste real mostrou que a camada Mobile acumulou regras próprias demais para movimentação. Isso aumentou passos, mensagens de bloqueio e risco de divergência em relação à Central Desktop.

Decisão do Fundador em 2026-10-05:

> **A Central Móvel deve ser uma interface rápida de scanner/UX sobre os mesmos serviços e motores transacionais canônicos da Central Desktop.**

Objetivo:

- manter as 7 intenções de UX móvel;
- preservar câmera, barcode físico, fallback manual e navegação otimizada para celular;
- remover ou reduzir regras duplicadas em `mobileTransfer.ts`, `mobileOutbound.ts` e equivalentes;
- fazer saldo, lote, validade, FEFO, idempotência, concorrência e writes serem decididos pelos serviços canônicos compartilhados;
- não criar banco, ledger, saldo ou lote Mobile paralelo;
- não transformar inconsistência histórica em correção automática de dados.

### 26.1.1 Contrato canônico de estado logístico — SEM “MATERIAL SEM LOCALIZAÇÃO”

Decisão reafirmada pelo Fundador em 2026-10-05:

> **“Material sem localização” não é uma classificação operacional válida do EMPROVEX.**

Estados/intenções válidos para o produto:

1. **PENDENTE DE ALOCAÇÃO / PENDENTE DE TRATAMENTO**
   - controlado pelo intake v2;
   - fonte: `receivedQuantity`, `allocatedQuantity`, `immediateConsumptionQuantity`, `pendingQuantity`;
   - status: `PENDING` ou `PARTIALLY_PROCESSED`;
   - ainda não deve ser apresentado como estoque físico disponível.

2. **ESTOQUE LOCALIZADO**
   - quantidade operacional disponível somente quando vinculada a `LOCATION` ou `SUBPOSITION` ativa;
   - Saída, Transferência, Inventário e consultas físicas usam somente posições físicas válidas.

3. **CONSUMIDO / TRATADO**
   - consumo imediato reduz a pendência sem criar posição física, lote de estoque ou saldo localizado;
   - quando toda quantidade recebida for alocada e/ou consumida, intake = `PROCESSED`.

Regra de compatibilidade:

- `UNASSIGNED` pode continuar existindo temporariamente em documentos/código legado ou como detalhe técnico de transição;
- `UNASSIGNED` **NÃO** pode ser mostrado ao operador como “estoque sem localização”;
- `UNASSIGNED` **NÃO** pode ser origem/destino de Transferência física normal;
- `UNASSIGNED` **NÃO** pode ser quantidade disponível para Saída, Inventário ou consulta de estoque;
- quando legado `UNASSIGNED` não puder ser reconciliado com intake canônico, classificar como **RECONCILIATION_REQUIRED**, não como estoque normal;
- nenhuma migração/correção destrutiva automática é autorizada nesta frente.

O código atual já possui o modelo `warehouse_item_intake_v2` com:
- `pendingQuantity`;
- `PENDING`;
- `PARTIALLY_PROCESSED`;
- `PROCESSED`;
- `RECONCILIATION_REQUIRED` como status efetivo de proteção.

A implementação histórica de alocação ainda utiliza `UNASSIGNED` internamente como ponte técnica em alguns trechos. A MOBILE-K deve **conter e isolar esse legado**, sem promovê-lo a contrato canônico. Se remover totalmente essa ponte exigir uma migração estrutural maior do intake, o worker deve registrar a dívida e manter a mudança fora do escopo sem autorização adicional.

Impacto imediato sobre MOBILE-K:

- preservar os 5 commits já feitos;
- não resetar/recriar a branch;
- revisar `buildCanonicalWarehouseTransferLotPlan()` e qualquer comentário/lógica que trate “UNASSIGNED flows” como fluxo operacional normal;
- Transferência física canônica deve aceitar somente `LOCATION`/`SUBPOSITION`;
- a UI Mobile já rejeitar `UNASSIGNED` está correta;
- remover/alterar textos de produto “Sem localização” quando representarem estado normal;
- Consultar Item deve distinguir **estoque físico localizado** de **pendência de intake**; não somar ambos como um único “saldo disponível”;
- legado não reconciliado deve aparecer como necessidade de reconciliação, não como terceira categoria de estoque.

Branch worker concluída:

`mobile-r1-k-canonical-ops-engine@9f1035ac447d25a8fad0ffbb0b319c31f8ba2ef0`

Base original preservada:

`bd27da91da92642d5a5fea08f7020c6cea658a62`

Estado final do worker:

- 22 commits à frente / 0 atrás;
- PR #253 OPEN / DRAFT / MERGEABLE / não mergeado;
- Application CI #1044: SUCCESS;
- Core Protection #331: SUCCESS;
- Recovery guardrails #654: SUCCESS;
- Legal Validation #78: SUCCESS;
- Vercel Preview: SUCCESS;
- Firestore Rules: sem delta;
- produção: inalterada.

A branch foi criada exatamente no HEAD RC `bd27da91...` e agora está congelada em `8e3e9a4`, 5 commits à frente. Retomar **a partir de `8e3e9a4`**, sem reset/rebase e sem incorporar `main`, integradoras antigas ou mudanças externas por merge.

Arquivos de entrada obrigatórios para o worker:

- `features/warehouse/components/WarehouseMaterialWithdrawal.tsx`;
- `lib/warehouse/outbound.ts`;
- `lib/warehouse/outboundRepository.ts`;
- `lib/warehouse/withdrawal.ts`;
- `lib/warehouse/withdrawalRepository.ts`;
- `features/warehouse/mobile/WarehouseMobileOutbound.tsx`;
- `features/warehouse/mobile/WarehouseMobileTransfer.tsx`;
- `lib/warehouse/mobileOutbound.ts`;
- `lib/warehouse/mobileOutboundRepository.ts`;
- `lib/warehouse/mobileTransfer.ts`;
- `lib/warehouse/locationRepository.ts`;
- `lib/warehouse/lot.ts`;
- `lib/warehouse/lotRepository.ts`;
- Rules e testes afetados.

Critério arquitetural central:

**Desktop e Mobile podem ter UX diferente, mas não podem ter duas autoridades de estoque.**

O worker deve primeiro mapear os motores já canônicos e refatorar por reutilização/composição. Não deve simplesmente deslocar a duplicação para outro arquivo chamado “shared”.

## 27. Certificação física obrigatória

### Android / Chrome

Validar:

- Home Mobile;
- câmera permitida;
- câmera negada;
- câmera indisponível;
- fallback manual;
- abrir/fechar câmera;
- troca/retorno de rota;
- scan válido;
- double scan;
- cooldown;
- scans consecutivos;
- luz baixa/reflexo;
- perda/retorno de rede.

### iPhone / Safari

Executar os mesmos cenários quando houver aparelho disponível.

Se não houver aparelho:

**PENDENTE — APARELHO NÃO DISPONÍVEL**

Não inferir PASS de iPhone a partir de Android.

### Code128 físico

Imprimir e testar:

- COMPACT;
- MEDIUM;
- LARGE.

Validar no mínimo:

- LOCAL;
- SUBPOSITION;
- material/produto;
- distância/enquadramento/contraste;
- repetição;
- ausência de confusão entre etiquetas próximas.

Geração digital isolada não é certificação física.

### Feedback físico

Validar:

- som de sucesso;
- som de erro;
- vibração;
- feedback visual;
- ausência de duplo feedback enganoso;
- erro de persistência sem falso sucesso.

### UX real

Validar:

- uso com uma mão;
- legibilidade;
- botões;
- orientação/scroll;
- loading/empty states;
- foco/teclado;
- Enter quando aplicável;
- scanner ↔ formulário;
- recuperação após erro;
- mensagens de confirmação.

Classificar defeitos:

- BLOQUEANTE;
- IMPORTANTE;
- COSMÉTICO;
- BACKLOG.

Só regressão funcional concreta reabre desenvolvimento.

## 28. Jornada física, invariantes, performance e PASS final

Jornada mínima:

```text
LOGIN
→ CENTRAL MOBILE
→ LER MATERIAL/POSIÇÃO
→ ALLOCATE
→ CONSULTAR
→ TRANSFERIR
→ CONFERIR
→ INVENTARIAR
→ OUTBOUND
→ CONSULTAR ESTADO FINAL
→ CENTRAL DESKTOP
→ CONFIRMAR COERÊNCIA
```

Registrar IDs relevantes: workspace/UG/material/barcode/depósito/posições/lote/movementIds/inventoryId/outboundId.

Invariantes:

- ALLOCATE usa posição/barcode/material canônicos;
- TRANSFER preserva total agregado e não gera saldo negativo;
- inventário salvo não altera saldo antes da revisão/confirm;
- OUTBOUND respeita posição/lote/FEFO/idempotência;
- conferência é read-only e usa transferência como correção oficial;
- Desktop e Mobile mostram o mesmo material/saldo/posição/lote/histórico/ledger.

Rede:

- perda antes de operação crítica deve falhar fechada;
- nenhum falso sucesso;
- retorno permite retomada/reconciliação segura;
- idempotência deve impedir duplicação.

Performance de referência pós-Integração 3/MOBILE-I:

- `/central-mobile`: 257 kB;
- `/central-mobile/alocar`: 275 kB;
- `/central-mobile/transferir`: 261 kB;
- `/central-mobile/inventario`: 271 kB;
- `/central-mobile/saida`: 265 kB;
- `/central-mobile/conferir`: 260 kB;
- Shared First Load: 104 kB.

PASS FINAL Mobile exige:

- testes físicos reais;
- CT-01 observada no Preview;
- jornada ponta a ponta;
- coerência Desktop↔Mobile;
- gates técnicos verdes;
- reconciliação final contra o HEAD/RC SaaS;
- nenhum conflito transversal aberto.

O Coordenador Mobile recomenda; Program Control decide a barreira global.

# PARTE VIII — TESTES, CI E RELEASE

## 29. Política de testes e evidência

Browser E2E não é gate universal.

Prioridade:

- instalação reproduzível;
- TypeScript;
- production build;
- testes de domínio;
- guards estruturais;
- multi-tenant;
- Firestore Emulator quando aplicável;
- Core Protection;
- Recovery;
- Legal Validation;
- diff hygiene;
- testes específicos do RC.

Validação manual é legítima e obrigatória para câmera/scanner/barcode/UX física.

**Não inferir PASS sem execução real quando o requisito depende de hardware/navegador/ambiente publicado.**

## 30. Vercel e Preview HTTPS

Durante desenvolvimento, `build-rate-limit` isolado não é regressão de código.

Para RC:

- Preview HTTPS deve apontar para o **mesmo SHA congelado** que poderá ser promovido;
- não testar um build e reconstruir outro para produção;
- validar header CT-01 no HTTP efetivo;
- usar Preview para fechar MOBILE-J e smoke SaaS antes de tocar domínio produtivo.

## 31. Produção, main e autorizações

`main` é baseline conhecida/recuperável, não branch de experimentação.

Problema encontrado em teste:

```text
bug
→ branch curta/hotfix rastreável
→ teste
→ integração no RC
→ gates afetados
→ novo freeze quando necessário
```

Não “corrigir direto na main”.

Ações protegidas dependem de autorização explícita do Fundador:

- merge/release final para `main`;
- Vercel production/promotion;
- Rules produtivas;
- restore real quando aplicável;
- migração destrutiva;
- ação disruptiva em usuário/workspace real;
- GO/NO-GO de produção e lançamento.

### 31.1 Três planos de rollback

Rollback de aplicação não é rollback total do sistema.

Separar:

1. **Aplicação/Vercel** — voltar ao deployment conhecido;
2. **Rules** — republicar Rules anteriores;
3. **Dados** — reconciliar movimentos/writes; não existe “desfazer automático” por rollback Vercel.

Rollback de Vercel não apaga:

- movimentos;
- ledger;
- billing/legal/lifecycle persistido;
- documentos criados;
- alterações de estoque já gravadas.

### 31.2 Estratégia de teste com menor risco

Na certificação publicada:

- usar workspace/material controlado;
- evitar estoque institucional crítico;
- evitar deletes;
- evitar migração destrutiva;
- registrar IDs das operações;
- interromper writes diante de dúvida de integridade;
- auditar ledger/saldos antes de correção manual.

### 31.3 Gatilhos de NO-GO/rollback

Escalar imediatamente se houver:

- falha sistêmica de login;
- founder ou usuário legítimo bloqueado de forma generalizada;
- cross-workspace;
- Rules permitindo acesso indevido;
- Rules negando operação essencial de forma sistêmica;
- saldo negativo/divergente;
- ledger duplicado;
- idempotência quebrada;
- perda de material/lote/posição;
- billing/lifecycle incorreto;
- Legal Gate impedindo uso legítimo de forma sistêmica;
- scanner indisponível por CT-01;
- erro runtime grave;
- regressão grave do Desktop.

Problema exclusivamente visual não exige rollback automático.

### 2026-10-04 — PROGRAMAS RECONCILIADOS / EMPROVEX RC CANDIDATE

Program Control auditou a entrega RC-A e a certificação independente RC-B.

Identidade:

- RC branch: `rc-r1-a-composition`;
- RC runtime SHA: `54e60c2264588d8802a67a4cab3d875d64f6bfc1`;
- RC composition head documental: `7f449db986da359091c70f6ae27934f0db18a0cb`;
- RC-B evidence head técnico documental: `c5a35b957a55edc7f56150b7b64374ee88b26c2e`;
- RC-B head documental final: `851cbfc1c966847d1b5fc53c47e2708a48336f76`;
- SaaS source: `2c1eee759ea8024c296b4c6968ed935b9a59e880`;
- Mobile source: `7b7717b6eebabf911310d2b8ac56ed13c9cb9238`;
- produção: `main@e90f92acae1514ee5cbc6ce95fed354bc1454330` — inalterada.

Hashes do candidato:

- Rules principal: `bc91185f34bcdcb4437a4de1078d1089a09292ba`;
- Rules Warehouse: `6e1f1050005314db4e17cb3136409abbddb0ee91`;
- package-lock: `7c1ecd0dc074b8924c25123955f70e0ba10675dd`;
- next.config.ts: `a67a5f7855409185b72bdb2c392a6523d870b2e8`.

Gates confirmados:

- CT-01: PASS;
- Application CI: #961/#962 SUCCESS;
- Core Protection: #248/#249 SUCCESS;
- Legal Validation: #63/#64 SUCCESS;
- Recovery guardrails: #639/#640 SUCCESS;
- build / TypeScript / diff hygiene: PASS;
- multi-tenant / lifecycle / billing / Legal / Central / warehouseAccess: PASS;
- SESSION-CAP: PASS;
- Mobile A–I: PASS;
- conflitos materiais de composição: NENHUM.

Riscos externos controlados:

1. Vercel Preview: BLOCKED por `build-rate-limit`;
2. HARDEN-B: pendente do primeiro backup READY, `recovery:verify` e restore isolado;
3. MOBILE-J: certificação física ainda não executada por depender do Preview HTTPS.

Decisão exclusiva do Program Control:

**PROGRAMAS RECONCILIADOS**

**EMPROVEX RC CANDIDATE**

O candidato oficial é o runtime:

`54e60c2264588d8802a67a4cab3d875d64f6bfc1`

Esta decisão:

- não declara RC FROZEN;
- não autoriza produção;
- não autoriza publicação de Rules RC;
- não autoriza Vercel Production;
- não declara MOBILE-J PASS;
- não encerra HARDEN-B.

Próximo gate: **RC FROZEN**.

### 2026-10-04 — EMPROVEX RC FROZEN

Program Control auditou o manifesto e o handoff RC-F, bem como o PR #251 e a identidade criptográfica do candidato.

Identidade congelada:

- RC runtime imutável: `54e60c2264588d8802a67a4cab3d875d64f6bfc1`;
- RC composition head documental: `7f449db986da359091c70f6ae27934f0db18a0cb`;
- RC-B final documental: `851cbfc1c966847d1b5fc53c47e2708a48336f76`;
- RC-F final documental: `bef824946715fe96227a9d3c4edf400e7b8f1304`;
- SaaS source: `2c1eee759ea8024c296b4c6968ed935b9a59e880`;
- Mobile source: `7b7717b6eebabf911310d2b8ac56ed13c9cb9238`;
- produção: `main@e90f92acae1514ee5cbc6ce95fed354bc1454330` — inalterada.

Hashes congelados:

- Rules principal RC: `bc91185f34bcdcb4437a4de1078d1089a09292ba`;
- Rules Warehouse RC: `6e1f1050005314db4e17cb3136409abbddb0ee91`;
- package-lock: `7c1ecd0dc074b8924c25123955f70e0ba10675dd`;
- next.config.ts: `a67a5f7855409185b72bdb2c392a6523d870b2e8`.

Evidência aceita:

- PR #251: OPEN / DRAFT / MERGEABLE / não mergeado;
- delta RC-F: somente `docs/EMPROVEX_RC_FREEZE_MANIFEST.md` e `docs/EMPROVEX_RC_F_HANDOFF.md`;
- cadeia runtime → RC-A → RC-B → RC-F: **sem delta de runtime**;
- drift da integradora SaaS: exclusivamente documental;
- Application CI #961/#962: SUCCESS;
- Core #248/#249: SUCCESS;
- Legal #63/#64: SUCCESS;
- Recovery guardrails #639/#640: SUCCESS;
- Browser Validation #52/#53: SKIPPED, corretamente não promovido a PASS;
- CT-01: PASS;
- SESSION-CAP: PASS;
- Mobile A–I: PASS;
- conflitos funcionais: NENHUM.

Decisão exclusiva do Program Control:

**EMPROVEX RC FROZEN**

Freeze invariant:

`54e60c2264588d8802a67a4cab3d875d64f6bfc1`

A partir deste ponto, o runtime acima é imutável. Só pode haver reabertura por:

- blocker real;
- regressão funcional;
- falha de segurança;
- defeito real descoberto na certificação;
- incompatibilidade material;
- problema que impeça release.

Não justificam reabertura:

- melhoria visual;
- refactor;
- limpeza;
- feature nova;
- otimização oportunista;
- atualização de dependência sem necessidade de blocker.

Pendências posteriores ao freeze:

1. Vercel Preview HTTPS — bloqueado por `build-rate-limit`;
2. MOBILE-J — certificação física após Preview;
3. HARDEN-B — backup READY / recovery:verify / restore isolado;
4. GO/NO-GO produtivo — ainda não autorizado.

Esta decisão **não** autoriza:

- merge em `main`;
- Vercel Production;
- publicação de Rules RC;
- restore real;
- piloto;
- abertura comercial.

Próximo gate global: **Preview HTTPS + certificação física/integrada**.

# PARTE IX — RISCOS E GATES ABERTOS

## 32. Gates técnicos ainda abertos

### 32.1 Antes do RC CANDIDATE

Já concluído nesta barreira:

- SESSION-CAP-01: **PASS TÉCNICO COMPLETO / INTEGRADA**;
- RULES-AUDIT-01: **PASS — RULES APTAS PARA RC**;
- Rules produtivas principal e Warehouse capturadas: **SEM DRIFT**;
- TTL `sessionSlots.expiresAt` e `sessionRevocations.expiresAt`: **ACTIVE**;
- compatibilidade de rollout/rollback de Rules documentada;
- guards de sessão/Rules/lifecycle/telemetria e Browser E2E: PASS.

Ainda obrigatório antes de declarar RC CANDIDATE:

- criar/fixar branch única de composição;
- fixar fontes SaaS e Mobile;
- incorporar semanticamente os deltas;
- aplicar CT-01;
- reconciliar Auth/workspace/UG/sessão/Legal/billing/lifecycle;
- reconciliar Rules principal e Warehouse;
- reconciliar package/lockfile/Application CI;
- reconciliar repositories/shell/scanner/Central;
- registrar hashes do candidato;
- executar gates combinados no SHA exato;
- obter todos os gates obrigatórios verdes.

A validação física com múltiplos operadores Desktop/Mobile pertence à etapa de Preview HTTPS/MOBILE-J após o candidato congelado.

### 32.2 Antes do RC FROZEN

- nenhum conflito material;
- SHA único;
- manifesto de release;
- rollback de aplicação preparado;
- rollback de Rules preparado;
- baseline Performance R3 registrada;
- nenhuma mudança oportunista aberta.

### 32.3 Antes de produção controlada

- RULES-AUDIT-01 permanece válida para os hashes exatos do RC;
- nenhuma alteração de Rules posterior ao PASS ficou sem reauditoria;
- Preview aprovado;
- smoke crítico SaaS+Mobile;
- CT-01 comprovada;
- Rules comprovadas;
- integridade de dados sem dúvida;
- rollback pronto;
- risco HARDEN-B avaliado;
- autorização explícita do Fundador.

Preferência: backup READY nos dois bancos + `recovery:verify`.

### 32.4 Antes de PASS FINAL Mobile

- runbook físico executado;
- Android;
- iPhone ou pendência explicitamente classificada;
- Code128;
- som/vibração;
- rede;
- jornada ponta a ponta;
- Desktop↔Mobile;
- reconciliação final SaaS.

### 32.5 Antes da abertura comercial ampla

- piloto real;
- cliente pago real;
- trial→regularização;
- suspensão→bloqueio→reativação controlada;
- recovery/restore comprovado;
- uptime/alerta;
- custo/capacidade;
- SAAS-J;
- pendências classificadas;
- GO explícito.

## 33. Riscos que não podem ser esquecidos

- confundir billing comercial com autorização operacional;
- assumir que “pago” reativa automaticamente lifecycle desabilitado;
- apagar dados por inadimplência/cancelamento;
- deixar usuário suspenso sem regularização/recuperação acessível;
- duplicar Auth/sessão/legal na Mobile;
- confundir a remoção autorizada do teto de sessões com remoção do controle de sessão;
- manter por engano os IDs fixos `slot-1`/`slot-2` após declarar sessões sem teto;
- remover revogação/lease/telemetria junto com o limite;
- usar números históricos de lease/heartbeat em vez do runtime atual 30/15;
- sobrescrever CT-01;
- publicar Rules sem RULES-AUDIT-01 PASS;
- presumir que Rules do Git são idênticas às realmente ativas em produção;
- testar apenas ALLOW e esquecer DENY;
- validar apenas App RC + Rules RC e ignorar a janela de rollout/rollback;
- alterar Rules após auditoria sem invalidar/repetir o gate;
- publicar Rules sem rollback;
- confundir rollback Vercel com rollback de dados;
- merge/rebase cego entre SaaS e Mobile;
- criar fonte paralela logística;
- reabrir A1/A2 sem nova evidência;
- declarar uptime/backup/restore sem evidência real;
- declarar iPhone PASS por inferência;
- corrigir diretamente em `main`;
- tratar acabamento visual de PDF como blocker sem defeito funcional;
- considerar CI verde como autorização produtiva.

# PARTE X — CRONOLOGIA CANÔNICA

## 34. Marcos históricos principais

### 2026-09 — Central de Depósitos

Consolidados materiais, depósitos/posições, lotes/FEFO, intake, saída, consumo imediato, barcode, ledger, segurança externa e telemetria.

### 2026-10-01 — Performance R3

Rodada encerrada e publicada.

Baseline produtiva atual:

`main@e90f92acae1514ee5cbc6ce95fed354bc1454330`

### 2026-10-01 a 2026-10-02 — SaaS R1 funcional

Integrados billing, onboarding, legal, recovery tooling, lifecycle/security e integração SaaS.

Contrato comercial consolidado em R$ 70 / Plano Completo.

### 2026-10-02 — Program Control

Instituída governança global acima dos programas, com barreiras transversais e autoridade global de RC.

### 2026-10-02 a 2026-10-03 — Mobile R1 funcional

A–H, Integrações 1–3 e MOBILE-I concluídas/integradas.

Desenvolvimento funcional Mobile encerrado.

### 2026-10-03 — Hardening final

- HARDEN-A1: PASS;
- HARDEN-A2: PASS com risco residual aceito;
- HARDEN-C/D: PASS;
- HARDEN-B: parcial/temporal;
- MOBILE-J: certificação final;
- RC conjunto: composição liberada;
- produção: inalterada.

### 2026-10-03 — Remoção do teto fixo de sessões autorizada

Decisão do Fundador:

- remover o limite fixo de 2 sessões externas por workspace/UG;
- motivação principal: permitir múltiplos operadores simultâneos na Central Móvel;
- preservar lease, heartbeat, revogação, painel administrativo, auditoria, lifecycle e telemetria;
- implementar em frente transversal controlada `SESSION-CAP-01`;
- executar antes do RC CANDIDATE/RC FROZEN;
- até a execução, o runtime permanece em 2 sessões externas.

### 2026-10-03 — Auditoria integral de Rules torna-se gate obrigatório

Decisão do Fundador:

- não publicar as novas Firestore Rules por tentativa e erro;
- instituir `RULES-AUDIT-01`;
- auditar banco principal e `emprovex-warehouse`;
- comparar produção real versus ruleset final;
- exigir matriz ALLOW/DENY;
- exigir regressão das funcionalidades antigas e novas;
- exigir compatibilidade de rollout/rollback;
- executar auditoria final depois da SESSION-CAP-01;
- bloquear publicação produtiva de Rules sem PASS formal.

### 2026-10-03 — SESSION-CAP-01 + RULES-AUDIT-01 ativadas

Program Control criou a frente transversal única:

- branch: `rc-session-cap-rules-audit`;
- base congelada: `c6c164c70a1be3e2e7e4e57b0bbf4866d61a71ce`;
- fase 1: SESSION-CAP-01 — remover o teto fixo de 2 sessões preservando segurança, revogação, lifecycle, painel, auditoria e telemetria;
- fase 2: RULES-AUDIT-01 — auditar o ruleset final pós-SESSION-CAP-01 contra a produção/R3, SaaS, Mobile e rollback;
- integração cruzada/merge/rebase da integradora durante a execução: proibidos;
- publicação de Rules, deploy produtivo, merge em `main` e restore: não autorizados;
- handoff final obrigatório ao Program Control.

A frente deve permanecer sequencial: RULES-AUDIT-01 só pode declarar PASS final depois que SESSION-CAP-01 estabilizar o ruleset estrutural.

### 2026-10-04 — SESSION-CAP-01 concluída tecnicamente

Worker `rc-session-cap-rules-audit` encerrou desenvolvimento técnico em:

`a97c1a94799cbbc240994d76fefc6f85925bffe1`

PR:

**#248 — DRAFT / MERGEABLE / NÃO INTEGRADO**

Resultado aceito pelo Program Control:

- SESSION-CAP-01: **PASS TÉCNICO COMPLETO**;
- teto fixo de 2 sessões removido no candidato;
- lease dinâmico por `browserInstanceId`;
- lease 30 min / heartbeat 15 min / revogação 24 h preservados;
- `slot-1` e `slot-2` preservados somente para compatibilidade transitória;
- 3ª e 4ª sessões legítimas: ALLOW;
- pseudo-slot `slot-3`, ID dinâmico adulterado e takeover de lease ativo: DENY;
- painel administrativo, lifecycle, provisioning, revogação, auditoria e telemetria reconciliados;
- suspensão do workspace permanece fail-closed para N sessões;
- multi-tenant preservado.

Gates confirmados no fechamento:

- Application CI #959 — SUCCESS;
- Core Protection #246 — SUCCESS;
- Recovery #637 — SUCCESS;
- Legal Validation #61 — SUCCESS;
- Production Build — PASS;
- TypeScript final — PASS;
- Diff Hygiene — PASS;
- Browser E2E #49 / run 37171327188 — SUCCESS no SHA certificado `44372599fe0526313d3650a55c649615a1ff14d4`;
- Bloco 16.8 — 8/8 PASS;
- quatro sessões independentes + multitab compartilhado — 1/1 PASS.

Vercel permaneceu vermelho apenas por `build-rate-limit`, sem evidência de regressão funcional.

Produção, `main`, Vercel Production e Rules produtivas permaneceram inalterados.

### 2026-10-04 — Baseline produtiva das Rules confirmada sem drift

Leitura somente de produção concluída nos dois bancos.

Ruleset ativo — banco principal:

- release: `cloud.firestore/ai-studio-logsticahospital-3eeee498-faa1-4326-8f4f-95d34b382ec1`;
- ruleset ID: `06094fa5-0b5b-4dc0-a0b5-7ca032864860`;
- fingerprint Git normalizado: `0d990b7de0b2e85ed55fe14ec0d2ce29b3635299`;
- baseline esperada de `main`: `0d990b7de0b2e85ed55fe14ec0d2ce29b3635299`;
- drift: **NENHUM**.

Ruleset ativo — Warehouse:

- release: `cloud.firestore/emprovex-warehouse`;
- ruleset ID: `d246184a-350f-40a0-8241-f2b0fa631768`;
- fingerprint Git normalizado: `b5325fe5a8cbe9b0ade8568d35a2cd678ce6e0f2`;
- baseline esperada de `main`: `b5325fe5a8cbe9b0ade8568d35a2cd678ce6e0f2`;
- drift: **NENHUM**.

Primeiro gate externo da RULES-AUDIT-01: **PASS**.

### 2026-10-04 — RULES-AUDIT-01 encerrada em PASS

Verificação final confirmou:

- `sessionSlots.expiresAt`: `ACTIVE`;
- `sessionRevocations.expiresAt`: `ACTIVE`.

Com as Rules vivas previamente confirmadas sem drift e o inventário pré-TTL validado, o Program Control declara:

**RULES-AUDIT-01 = PASS — RULES APTAS PARA RC**

SESSION-CAP-01 permanece:

**PASS TÉCNICO COMPLETO**

Integração:

- PR #248 marcado ready;
- PR #248 squash-merged na integradora SaaS/RC;
- commit de integração: `54aba792cb9e7bb195e21401fb50a21ed50add19`;
- `main`: inalterado;
- aplicação RC: não publicada;
- Rules RC: não publicadas.

Próxima barreira global:

**composição do RC único SaaS R1 + Mobile R1**, seguida de CT-01, reconciliação package/lockfile/CI e gates no SHA exato.

### 2026-10-04 — TTL produtivo autorizado e em criação

Após autorização explícita do Fundador, foram iniciadas exclusivamente as políticas TTL em:

- `sessionSlots.expiresAt`;
- `sessionRevocations.expiresAt`;

no banco principal:

`ai-studio-logsticahospital-3eeee498-faa1-4326-8f4f-95d34b382ec1`.

Operações retornadas:

- sessionSlots: `AyBjNGNiYzA2Zjk5ZWQtOTU0YS01ZjY0LTQ3OGEtODg4OTM2ZGMkGnNlbmlsZXBpcAkKMxI`;
- sessionRevocations: `AyBiZjE1ZWYwMTMxMjgtMGU3OC03Yjc0LWQxZjUtZWYxNTNjY2EkGnNlbmlsZXBpcAkKMxI`.

Leitura imediata pós-ativação:

- sessionSlots.expiresAt → `ttlConfig.state = CREATING`;
- sessionRevocations.expiresAt → `ttlConfig.state = CREATING`.

Conclusão:

- comando de ativação aceito nos dois campos;
- nenhuma outra configuração produtiva foi alterada;
- RULES-AUDIT-01 permanece aberta somente até os dois TTLs atingirem `ACTIVE`;
- nenhuma nova escrita/configuração deve ser feita durante essa espera.

### 2026-10-04 — Inventário pré-TTL validado

Leitura somente de produção executada antes de qualquer ativação de TTL.

`sessionSlots`:

- total: **5**;
- sem `expiresAt`: **0**;
- expirados: **5**;
- não expirados: **0**.

`sessionRevocations`:

- total: **0**;
- sem `expiresAt`: **0**;
- expirados: **0**;
- não expirados: **0**.

Conclusão operacional:

- não existe sessão ativa que seria atingida imediatamente pela ativação de TTL;
- os 5 documentos existentes em `sessionSlots` já estão expirados e são resíduos de lease;
- não existem tombstones de revogação pendentes;
- ativar TTL nos dois collection groups é tecnicamente coerente com o contrato da SESSION-CAP-01;
- a ativação continua sendo mudança produtiva de retenção e exige autorização explícita do Fundador.

### 2026-10-04 — TTL produtivo ausente

Consulta somente leitura de:

- `sessionSlots.expiresAt`;
- `sessionRevocations.expiresAt`;

retornou somente `indexConfig`, sem `ttlConfig`.

Conclusão:

**TTL NÃO CONFIGURADO** nos dois collection groups.

Impacto:

- RULES-AUDIT-01 ainda não recebe PASS FINAL;
- SESSION-CAP-01 continua PASS técnico;
- ativar TTL é mudança produtiva de retenção e pode excluir documentos já expirados;
- ativação exige decisão/autorização explícita do Fundador;
- antes da ativação, Program Control deve preferencialmente inspecionar os documentos existentes e confirmar que `expiresAt` está coerente.

### 2026-10-04 — RULES-AUDIT-01 em fechamento externo

Classificação:

**PRONTA PARA FECHAMENTO EXTERNO / AINDA NÃO PASS FINAL**

Rules candidatas pós-SESSION-CAP:

- principal RC: `bc91185f34bcdcb4437a4de1078d1089a09292ba`;
- Warehouse RC: `6e1f1050005314db4e17cb3136409abbddb0ee91`.

Faltam apenas dois gates vivos:

1. capturar em modo somente leitura os rulesets realmente ativos nos dois bancos e comparar drift;
2. confirmar TTL realmente configurado para:
   - `sessionSlots.expiresAt`;
   - `sessionRevocations.expiresAt`.

Se houver drift inexplicado:

**STOP PRODUCTION RULES DRIFT — NÃO PUBLICAR.**

Se baseline vivo e TTL forem coerentes, Program Control poderá fechar RULES-AUDIT-01 e seguir para integração/RC conforme governança.

Ordem de rollout candidata, se mantida após os gates vivos:

```text
Rules RC
→ aplicação RC
```

Compatibilidade comprovada:

- app antiga + Rules RC: compatível via `slot-1`/`slot-2`;
- app RC + Rules RC: alvo;
- app RC + Rules antigas: incompatível.

Rollback:

- aplicação pode voltar primeiro mantendo Rules RC;
- rollback das Rules exige rollback prévio da aplicação.

### 2026-10-03 — Transição para Release Engineering

Por decisão do Fundador:

- Coordenador Geral assume também Coordenação do RC;
- Coordenadores SaaS/Mobile entram em modo consulta/evidência;
- nenhuma nova wave funcional autorizada;
- próximo produto a ser construído é um único SHA de RC SaaS+Mobile.

### 2026-10-05 — HARDEN-B encerrada em PASS

O Program Control auditou e ratificou o fechamento da frente HARDEN-B.

Resultado:

**HARDEN-B — PASS**

Evidência consolidada:

- branch: `saas-harden-b-recovery-restore`;
- HEAD: `c6368d0dd1b89610cb02b9b87f5ef6392810b336`;
- PR #237: OPEN / DRAFT / MERGEABLE / não mergeado;
- backups READY nos bancos principal e Warehouse;
- `recovery:status = ready=true`;
- `recovery:verify = ready=true`;
- restore real do Warehouse concluído com sucesso para `emprovex-restore-warehouse-2026-10-04`;
- restore sem erro, snapshot `2026-10-03T17:05:24.058789Z`;
- 13/13 coleções verificadas com igualdade de contagens;
- isolamento: PASS;
- IAM: PASS;
- TTL origem/restore: 0/0;
- composite indexes origem/restore: 0/0;
- field indexes: configuração default em ambos;
- produção: inalterada;
- RC FROZEN: inalterado.

Risco residual aceito:

- Firebase Security Rules não fazem parte do backup;
- leitura do release retornou HTTP 403 tanto na origem quanto no restore;
- antes de promover um banco restaurado a substituto operacional, o ruleset correto deve ser explicitamente confirmado/aplicado.

Cleanup:

- o target temporário continua existente;
- delete protection permanece ativa;
- pode haver custo enquanto existir;
- remoção exige autorização separada.

O cleanup não bloqueia o PASS.

### 2026-10-05 — RC-P em PARCIAL por autorização Vercel

Program Control auditou a frente RC-P.

Estado:

**RC-P — PARCIAL / BLOQUEIO EXTERNO DE AUTORIZAÇÃO VERCEL**

A branch `rc-r1-p-preview` está exatamente em `54e60c2264588d8802a67a4cab3d875d64f6bfc1`, sem commits adicionais e sem delta.

O projeto Vercel correto é `controles-de-empenhos-aprov`, no team `aprov-hgesms-projects`. A sessão disponível retornou HTTP 403 por não possuir autorização nesse escopo.

O Preview anterior ao commit técnico congelado não é válido para MOBILE-J.

Não há evidência de regressão do RC. Produção, Rules e RC FROZEN permanecem inalterados.

Próxima ação: reautenticar no team Vercel correto e executar Preview não produtivo do SHA congelado; depois realizar smoke RC-P e entregar à MOBILE-J.

### 2026-10-05 — Rules RC publicadas de forma autorizada

O Fundador autorizou explicitamente publicar **somente** as Rules RC do banco principal e do Warehouse para permitir a certificação do Preview, sem publicar o app RC em produção.

Pré-condições confirmadas localmente no RC original:

- branch: `rc-r1-p-preview`;
- HEAD: `54e60c2264588d8802a67a4cab3d875d64f6bfc1`;
- working tree: clean;
- `firestore.rules`: `bc91185f34bcdcb4437a4de1078d1089a09292ba`;
- `firestore.warehouse.rules`: `6e1f1050005314db4e17cb3136409abbddb0ee91`.

Comando executado:

`npx --yes firebase-tools@latest deploy --only firestore:rules --project gen-lang-client-0982077967`

Resultado:

- principal: compilou e foi released;
- Warehouse: compilou e foi released;
- deploy: COMPLETE;
- apenas warnings de função/variável não utilizadas;
- nenhum app/Hosting/Functions/índice publicado por esse comando.

Após a publicação, o Preview deixou de falhar no Legal Acceptance com `Missing or insufficient permissions`, confirmando a incompatibilidade previamente conhecida entre app RC e Rules antigas.

Produção do app permaneceu em `main@e90f92...`.

### 2026-10-05 — RC-P desbloqueada e Preview HTTPS operacional

O bloqueio anterior de autorização Vercel foi resolvido localmente:

- usuário Vercel: `aprov-hgesm`;
- team ativo: `aprov-hgesms-projects`;
- deploy hook criado para `rc-r1-p-preview`;
- Preview do SHA exato do RC original foi obtido em HTTPS;
- sistema acessado manualmente;
- Central de Depósitos acessada;
- rota `/central-mobile` acessada no Android/Chrome;
- câmera real ativada.

O Preview anterior a `54e60c...` continuou considerado inválido para certificação; somente deploys do SHA correto ou das correções controladas posteriores são evidência válida.

### 2026-10-05 — MOBILE-J encontrou defeito físico real e reabriu o freeze

Teste físico Android mostrou:

- EAN-13 comercial de item foi decodificado pela câmera;
- etiqueta de localização EPX1 longa não foi decodificada de forma confiável;
- entrada manual do EPX1 foi reconhecida como `LOCATION`.

Conclusão:

- scanner/câmera estavam funcionais;
- o problema era densidade/tamanho físico do barcode de localização;
- o defeito justificou reabertura controlada do RC FROZEN.

Branch criada a partir do RC original:

`rc-r1-mobile-j-fix-label-readability`

PR:

**#252 — DRAFT / NÃO MERGEADO**

### 2026-10-05 — Identidade física curta e etiqueta de prateleira

Evolução executada:

1. EPX1 legado preservado;
2. EPX2 compacto adicionado como compatibilidade intermediária;
3. formato físico numérico de 13 dígitos implementado como preferência quando o código lógico é representável;
4. namespace físico numérico atual começa por `981`;
5. DEPOT/LOCAL/SUBPOSITION continuam distinguíveis;
6. fallback para EPX2 quando o código lógico não cabe no formato numérico;
7. códigos EPX1/EPX2 antigos permanecem aceitos.

Exemplo certificado:

`DEP-001 / PAL-01 → 9812001101000`

Evidência física:

- câmera Android capturou `9812001101000`;
- classificador exibiu `CAMERA · LOCATION`;
- UI exibiu `Leitura validada`.

Layout Compacta:

- largura: **140 mm**;
- altura calculada: **32,5 mm**;
- limite operacional informado para prateleiras: **35 mm**;
- Code 128 recebeu mais área horizontal e barras maiores.

Etiquetas de palete/freezer/geladeira/estruturas amplas podem continuar usando perfis maiores.

Risco residual documentado:

- o formato numérico é derivado do código lógico da estrutura;
- renomear `DEP-001`, `PAL-01`, `PRAT-01` etc. exige reimpressão da etiqueta;
- Code 128 possui checksum próprio para detecção física;
- um barcode de produto que seja **um código físico de localização válido** é reservado e não deve ser associado a material;
- um número comercial que apenas comece por `981`, mas não seja uma localização válida, continua podendo ser tratado como produto.

### 2026-10-05 — Consulta física revelou metadados legados extras

Após a leitura física da PAL-01, a consulta encontrou:

`WAREHOUSE_MOBILE_PHYSICAL_QUERY_INVALID_BALANCE:...:unexpected_field@$`

Depois da primeira compatibilidade, surgiu:

`WAREHOUSE_MOBILE_PHYSICAL_QUERY_INVALID_LOT:...:unexpected_field@$`

Conclusão:

- não era necessariamente saldo ou lote semanticamente corrompido;
- registros históricos possuíam metadados extras fora dos contratos estritos atuais;
- o cliente móvel estava passando documentos Firestore brutos para validadores fail-closed.

Correção adotada:

- camada read-only de projeção canônica;
- ignorar **somente metadados extras históricos**;
- continuar validando os campos oficiais de material/saldo/lote/posição/barcode;
- não alterar documentos Firestore;
- não mascarar inconsistências reais como saldo duplicado, material ausente, quantidade inválida, posição inválida ou hierarquia quebrada.

A compatibilidade foi expandida preventivamente para caminhos usados por:

- consulta física;
- conferência de posição;
- inventário;
- saída;
- transferência;
- alocação/intake;
- repositórios de material e barcode.

### 2026-10-05 — Auditoria preventiva LOCAL / SUBPOSIÇÃO / ITEM

A pedido do Fundador, foi executada auditoria preventiva antes de seguir com os testes físicos.

Riscos encontrados e tratados:

- metadados extras legados em `locationBalances`, `lots`, `materials` e associações;
- campos extras aninhados em `position`, `origin`, `unit` e `conversions`;
- materiais legados sem `aliases`/`conversions`, normalizados para listas vazias somente em leitura;
- colisão potencial entre namespace físico válido e barcode de produto;
- produto comercial iniciado por `981` não deve ser bloqueado se não formar código de localização válido;
- cobertura explícita de SUBPOSITION numérica adicionada;
- compatibilidade EPX1/EPX2 mantida.

Durante a auditoria, Application CI #1000 detectou 4 erros TypeScript por imports ausentes em `outboundRepository.ts`. O problema foi corrigido antes do fechamento.

HEAD final auditado:

`d7aef5e62d471d96de0899728d091bec0cfc9f1f`

Gates finais nesse HEAD:

- Vercel Preview: **SUCCESS**;
- EMPROVEX Core Protection #288: **SUCCESS**;
- Application CI #1001: **SUCCESS**;
- Production build: PASS dentro do CI;
- TypeScript final: PASS;
- diff hygiene: PASS.

Produção do app permaneceu inalterada.

### Estado manual ainda pendente após a auditoria

Apesar dos gates verdes, ainda falta repetir fisicamente a leitura da `PAL-01` no HEAD `d7aef5e...` e confirmar que a consulta de conteúdo não apresenta novo diagnóstico.

Depois disso:

- testar SUBPOSIÇÃO real;
- testar ITEM real;
- prosseguir com o restante do runbook MOBILE-J.


### 2026-10-05 — Central Móvel reorganizada em 7 operações sem duplicação semântica

Durante o teste físico da **Saída de Material**, o Fundador identificou que, após ler o item e escolher uma posição com saldo, a jornada visual se parecia com **Transferência de Material**.

A revisão confirmou que o backend da Saída já usava o OUTBOUND canônico, mas a UX misturava conceitos de posição e “troca”, tornando a intenção operacional ambígua.

Contrato consolidado da Central Móvel:

1. **Alocar Recebimento**
   - NF/item pendente → material → posição destino → confirmar entrada.
2. **Transferir Material**
   - movimento interno: origem física → material → quantidade → destino físico → confirmar transferência.
3. **Consultar Localização**
   - ler LOCAL/SUBPOSIÇÃO → mostrar conteúdo físico;
   - somente leitura.
4. **Consultar Item**
   - ler barcode comercial → mostrar saldo agregado, locais/subposições, quantidades e lotes;
   - somente leitura.
5. **Inventário**
   - sessão/snapshot → posição → item → contagem → revisão/confirmação própria.
6. **Saída de Material**
   - material → quantidade → origem da retirada → confirmar origem física → lote → destino administrativo/retirado por → confirmar baixa;
   - **não existe destino físico** nessa operação.
7. **Conferir posição**
   - posição + item → CORRETO/INCORRETO;
   - somente leitura;
   - pode direcionar para Transferência como operação separada, sem movimentar estoque por si.

Arquitetura para evitar duplicação:

- **Consultar Item** reutiliza `loadWarehouseMobileItemAvailability`;
- a **Saída** usa o mesmo read model de disponibilidade física;
- não foi criada uma segunda autoridade para saldo/local/lote;
- Transferência continua usando o contrato próprio de movimentação interna;
- Saída continua sendo a única jornada dessa lista que executa OUTBOUND;
- consultas e conferência não possuem mutação operacional.

Rotas móveis vigentes:

- `/central-mobile/alocar`;
- `/central-mobile/transferir`;
- `/central-mobile/consultar-localizacao`;
- `/central-mobile/consultar-item`;
- `/central-mobile/inventario`;
- `/central-mobile/saida`;
- `/central-mobile/conferir`.

A Consulta de Localização deixou de ficar embutida na Home e virou operação própria.

HEAD consolidado:

`b83f9de756a5690a8459c3bf8d9dcb2fee222a14`

Gates:

- Vercel Preview: **SUCCESS**;
- Core Protection #300: **SUCCESS**;
- Application CI #1013: **SUCCESS**;
- Production build: **SUCCESS**;
- Final TypeScript: **SUCCESS**;
- Diff hygiene: **SUCCESS**;
- Final Release Gates do workflow: **SUCCESS**.

Produção do app permaneceu em `main@e90f92...`; PR #252 continua DRAFT/não mergeado.

### 2026-10-05 — Reorganização semântica final das 7 operações móveis

Após teste manual da Saída de Material, o Fundador relatou que, depois de ler o item e escolher a posição, a jornada parecia entrar em “troca de local”, confundindo Saída com Transferência.

A revisão comprovou que o backend da Saída já usava OUTBOUND, mas a UX estava semanticamente próxima demais de Transferência. O contrato foi reorganizado para sete operações sem sobreposição:

- Alocar Recebimento;
- Transferir Material;
- Consultar Localização;
- Consultar Item;
- Inventário;
- Saída de Material;
- Conferir posição.

A nova **Consultar Item** foi implementada como read-only sobre o mesmo read model físico usado pela Saída, evitando duplicação de lógica.

A **Saída** passou a declarar e apresentar explicitamente:

`material → quantidade → origem da retirada → confirmar origem física → lote → destino administrativo/retirado por → confirmar baixa`

A **Transferência** permanece:

`origem física → material → quantidade → destino físico → confirmar transferência`

No HEAD `bd27da91da92642d5a5fea08f7020c6cea658a62` foram confirmados no GitHub:

- Vercel: SUCCESS;
- Core Protection #300: SUCCESS;
- Application CI #1013: SUCCESS;
- PR #252: OPEN / DRAFT / MERGEABLE=true / NOT MERGED;
- produção/app: `main@e90f92acae1514ee5cbc6ce95fed354bc1454330` inalterada.

O próximo passo é certificação manual dos sete fluxos no Preview, não integração ou produção.

# PARTE XI — DECISÕES PERMANENTES

## 35. Decisões que só podem mudar por decisão explícita

### Produto

- experiência operacional prevalece sobre otimização marginal;
- SaaS e Mobile são interfaces do mesmo produto;
- Central Mobile não cria backend/fonte de verdade paralelos;
- uma única autoridade por material/saldo/lote/posição/ledger.

### Comercial

- Plano Completo R$ 70/mês por workspace;
- trial padrão 30 dias;
- vencimento 5º dia útil;
- tolerância 10 dias;
- cobrança externa;
- confirmação manual;
- modo observe;
- sem suspensão automática;
- sem delete por inadimplência;
- API/webhook fora da R1;
- founder/VIP usam `exempt`;
- VIP não perde funcionalidades.

### Billing versus lifecycle

- `billingAccounts` é fonte comercial;
- `workspaces.status` + `platformAccounts.status` + `warehouseAccess` governam acesso;
- status comercial sozinho não deve virar autorização;
- suspensão/reativação real é ação administrativa explícita;
- pagamento confirmado não reativa automaticamente lifecycle desabilitado.

### Identidade e sessão

- founder Google-only;
- externo password-only;
- workspace/UG/UID/e-mail precisam ser coerentes;
- founder isento de capacidade;
- app produtiva Performance R3 ainda segue o comportamento legado do cliente; as Rules produtivas já aceitam o contrato RC dinâmico e o candidato RC remove o teto fixo de sessões externas;
- estado alvo: sessões externas sem limite fixo por workspace, preservando identidade/lease/revogação/auditoria/telemetria;
- a migração deve ocorrer antes do RC freeze;
- lease atual permanece 30 min;
- heartbeat atual permanece 15 min;
- revogação administrativa encerra sessões conhecidas;
- fail-closed em inconsistência.

### Legal

- pacote legal versionado;
- versão atual `saas-r1-2026-10-01`;
- aceite por UID + bundle;
- nenhum aceite é presumido em erro;
- VIP não possui exceção legal;
- regularização/Termos/Privacidade/recuperação não devem ser bloqueadas indevidamente.

### Dados

- cancelamento comercial não apaga dados;
- suspensão não altera estoque/documentos;
- exportação/retenção/exclusão são processos separados;
- nenhum rollback improvisado de estoque/ledger.

### Segurança e dependências

- RULES-AUDIT-01 foi gate obrigatório antes da publicação das Rules deste release; as Rules RC foram publicadas de forma autorizada em 2026-10-05; qualquer alteração posterior de Rules exige nova auditoria dos blocos afetados;
- Rules realmente ativas devem ser capturadas e comparadas ao Git antes de rollout;
- todo delta de Rule precisa de justificativa + teste ALLOW/DENY;
- regressão da Performance R3 é obrigatória com o ruleset final;
- rollback de Rules é separado de rollback Vercel;
- alteração de Rules após PASS invalida os blocos afetados da auditoria;
- Rules não são afrouxadas para facilitar teste;
- CT-01 permite somente câmera same-origin;
- microfone/geolocalização permanecem bloqueados;
- A2 não reabre sem nova evidência/upstream relevante;
- não usar `npm audit fix --force` como estratégia.

### PDFs

- jsPDF 4.2.1 / AutoTable 5.0.8;
- defeito funcional em PDF bloqueia;
- acabamento visual fino isolado não bloqueia e pode ir para backlog.

### Central Móvel — identidade física e compatibilidade de leitura

- novas etiquetas devem preferir código físico numérico de 13 dígitos quando o caminho lógico for representável;
- namespace numérico atual: prefixo `981`;
- EPX1 e EPX2 continuam aceitos como compatibilidade;
- código físico válido de localização é reservado e não pode ser cadastrado como barcode de produto;
- número comercial iniciado por `981` que não forme uma localização válida continua permitido como produto;
- perfil COMPACT de prateleira: 140 mm × 35 mm, respeitando limite físico de 35 mm de altura;
- renomear código lógico de estrutura exige reimpressão da etiqueta correspondente;
- metadados legados extras podem ser descartados somente em projeção read-only canônica;
- inconsistência semântica real de estoque deve continuar fail-closed.

### Release

- `main` não é branch de experimentação;
- Preview testa o SHA que poderá ser promovido;
- aplicação, Rules e dados possuem rollback/reconciliação distintos;
- CI verde não autoriza produção;
- Fundador mantém GO/NO-GO produtivo final.

### Desenvolvimento

- novas features SaaS/Mobile estão congeladas durante a composição/certificação do RC;
- corrigir apenas regressão concreta;
- conflitos são resolvidos semanticamente;
- workers/frentes especializadas não integram cruzado por conveniência.

# PARTE XII — ÍNDICE OPERACIONAL

## 36. Documentos globais

- `docs/EMPROVEX_MEMORIAL_OFICIAL.md` — estado/contratos/governança;
- `docs/EMPROVEX_PROGRAM_CONTROL.md` — protocolo do Coordenador Geral;
- `docs/EMPROVEX_MEMORIAL_HISTORICO_ATE_2026-10-03.md` — histórico integral preservado.

## 37. SaaS R1

Documentos canônicos:

- `docs/SAAS_R1_PLANO_MESTRE.md`;
- `docs/SAAS_R1_EXECUCAO_PARALELA.md`;
- `docs/SAAS_R1_INTEGRATION_STATUS.md`;
- `docs/SAAS_R1_COORDENADOR_HANDOFF.md`;
- `docs/SAAS_R1_PRE_PILOTO_HARDENING.md`;
- `docs/SAAS_R1_HARDEN_A2_FIREBASE_FIRESTORE_GRPC.md`;
- documentação HARDEN-B/recovery.

Para contrato comercial/operacional vigente, este Memorial tem precedência sobre checkpoints históricos antigos.

## 38. Mobile R1

Documentos canônicos:

- `docs/CENTRAL_MOBILE_R1_PLANO_MESTRE.md`;
- `docs/CENTRAL_MOBILE_R1_EXECUCAO_PARALELA.md`;
- `docs/CENTRAL_MOBILE_R1_INTEGRATION_STATUS.md`;
- `docs/CENTRAL_MOBILE_R1_COORDENADOR_HANDOFF.md`;
- `docs/CENTRAL_MOBILE_R1_FINAL_CERTIFICATION.md` — MOBILE-J;
- `docs/CENTRAL_MOBILE_R1_MOBILE_J_PHYSICAL_TEST_RUNBOOK.md` — atualmente na branch `mobile-r1-j-final-certification`.

O runbook físico é procedural. Este Memorial registra os critérios canônicos; o runbook registra casos/evidências.

## 39. Central de Depósitos

- `docs/adm-deposito/README.md`;
- `docs/adm-deposito/STATUS.md`;
- `docs/adm-deposito/DECISIONS.md`;
- `docs/adm-deposito/ROADMAP.md`.

## 40. Performance R3

- `docs/PERFORMANCE_R3_COMERCIALIZACAO.md`;
- `docs/PERFORMANCE_R3_EXECUCAO_PARALELA.md`;
- `docs/PERFORMANCE_R3_INTEGRATION_STATUS.md`;
- `docs/PERFORMANCE_R3_COORDENADOR_HANDOFF.md`.

## 41. Testes e CI

- `docs/TESTING_POLICY.md`;
- `docs/DEVELOPMENT_CI_WORKFLOW.md`.

---

# PARTE XIII — PROTOCOLO DE ATUALIZAÇÃO DO MEMORIAL

## 42. O que deve ser atualizado imediatamente

Atualizar o Memorial quando houver:

- mudança de `main`;
- nova integradora relevante;
- conclusão de wave;
- mudança de semáforo global;
- conflito transversal;
- decisão arquitetural;
- mudança de contrato comercial;
- mudança de política de segurança;
- freeze de RC;
- produção/release;
- novo blocker global.

## 43. O que não deve inflar novamente o Memorial

Detalhes como:

- todos os runs;
- logs de terminal;
- cada tentativa de CI;
- cada commit intermediário;
- cada comentário de PR;
- cada prompt de worker;

devem continuar preservados nos documentos especializados/Git, mas não duplicados integralmente no corpo principal.

## 44. Regra de preservação histórica

Nenhuma reorganização documental pode apagar evidência histórica.

Quando uma seção crescer a ponto de prejudicar leitura:

1. consolidar o estado vigente neste Memorial;
2. preservar a versão detalhada em documento histórico/especializado;
3. registrar link explícito;
4. manter Git como trilha definitiva.

O arquivo:

`docs/EMPROVEX_MEMORIAL_HISTORICO_ATE_2026-10-03.md`

é a primeira aplicação formal dessa regra e contém o Memorial legado integral.

---

# 45. Estado para retomada imediata

```text
DATA CANÔNICA DESTE HANDOFF
2026-10-05

PRODUÇÃO — APP
main@e90f92acae1514ee5cbc6ce95fed354bc1454330
Performance R3
app RC em Vercel Production: NÃO
merge do RC em main: NÃO

PRODUÇÃO — RULES
Rules RC: PUBLICADAS COM AUTORIZAÇÃO ESPECÍFICA EM 2026-10-05
principal source blob: bc91185f34bcdcb4437a4de1078d1089a09292ba
warehouse source blob: 6e1f1050005314db4e17cb3136409abbddb0ee91
rollback principal antigo: 0d990b7de0b2e85ed55fe14ec0d2ce29b3635299
rollback warehouse antigo: b5325fe5a8cbe9b0ade8568d35a2cd678ce6e0f2
nenhuma nova alteração de Rules ocorreu durante MOBILE-J-FIX

RC ORIGINAL
RC frozen histórico: 54e60c2264588d8802a67a4cab3d875d64f6bfc1
branch base Preview: rc-r1-p-preview
RC-P HTTPS: OBTIDO
sistema/auth/legal gate: ACESSO MANUAL CONFIRMADO
Central Móvel: ACESSO MANUAL CONFIRMADO
freeze original: REABERTO CONTROLADAMENTE POR DEFEITO FÍSICO REAL

BRANCH ATIVA DE CERTIFICAÇÃO/CORREÇÃO
rc-r1-mobile-j-fix-label-readability
HEAD vivo: bd27da91da92642d5a5fea08f7020c6cea658a62
PR: #252
estado PR: OPEN / DRAFT / MERGEABLE=true / NÃO MERGEADO
base PR: rc-r1-p-preview@54e60c2264588d8802a67a4cab3d875d64f6bfc1
HEAD PR: bd27da91da92642d5a5fea08f7020c6cea658a62
tamanho PR no handoff: 61 commits / 30 arquivos
Preview:
https://controles-de-empenhos-aprov-git-rc-f44756-aprov-hgesms-projects.vercel.app

GATES DO HEAD bd27da91...
Vercel Preview: SUCCESS
Core Protection #300: SUCCESS
Application CI #1013: SUCCESS
Production build: PASS
TypeScript: PASS
Diff hygiene: PASS

MOBILE-J — BARCODE FÍSICO
EPX1 legado: SUPORTADO
EPX2 compacto: SUPORTADO
novo numérico 13 dígitos: PREFERIDO QUANDO REPRESENTÁVEL
exemplo PAL-01: 9812001101000
teste Android real: CAMERA · LOCATION / Leitura validada — PASS
Code128: mantido
Compacta prateleira: 140 mm × 35 mm
limite informado: altura <= 35 mm

MOBILE-J — CONSULTA FÍSICA / LEGADO
erros encontrados:
- INVALID_BALANCE ... unexpected_field@$
- INVALID_LOT ... unexpected_field@$
causa: metadados legados extras em documentos históricos
correção: projeção canônica read-only
Firestore data migration destrutiva: NÃO
validadores de inconsistência real: PRESERVADOS

AUDITORIA PREVENTIVA
LOCAL: coberto
SUBPOSIÇÃO: cobertura numérica adicionada
ITEM/barcode: colisão de namespace tratada
produto 981 inválido como localização: continua PRODUCT
barcode válido de localização: reservado e não pode virar barcode de produto
compatibilidade de leitura aplicada a physical query, position check, inventory,
outbound, transfer, intake, materials e barcodes

CENTRAL MÓVEL — 7 OPERAÇÕES / CONTRATO CANÔNICO
1. Alocar Recebimento
   rota: /central-mobile/alocar
   intenção: NF/item recebido → material → posição DESTINO → confirmar entrada
2. Transferir Material
   rota: /central-mobile/transferir
   intenção: ORIGEM física → material → quantidade → DESTINO físico → confirmar transferência
3. Consultar Localização
   rota: /central-mobile/consultar-localizacao
   intenção: LOCAL/SUBPOSIÇÃO → conteúdo esperado; READ-ONLY
4. Consultar Item
   rota: /central-mobile/consultar-item
   intenção: barcode comercial → saldo agregado → locais/subposições + quantidades + lotes; READ-ONLY
5. Inventário
   rota: /central-mobile/inventario
   intenção: snapshot → posição/material → contagem → revisão/ajuste próprio do inventário
6. Saída de Material
   rota: /central-mobile/saida
   intenção: material → quantidade → ORIGEM da retirada → confirmar origem física → lote → destino ADMINISTRATIVO/retirado por → CONFIRMAR SAÍDA
   regra: NÃO existe destino físico nesta operação; saída reduz saldo da origem e não transfere material
7. Conferir posição
   rota: /central-mobile/conferir
   intenção: posição + item → correto/incorreto; READ-ONLY; não executar transferência silenciosa

IMPLEMENTAÇÃO MÓVEL — PONTOS DE ENTRADA PARA O NOVO COORDENADOR
Home/catálogo: features/warehouse/mobile/WarehouseMobileHome.tsx
Consultar Localização: app/central-mobile/consultar-localizacao/page.tsx
UI Consultar Localização: features/warehouse/mobile/WarehouseMobileLocationFoundationCheck.tsx
Consultar Item: app/central-mobile/consultar-item/page.tsx
UI Consultar Item: features/warehouse/mobile/WarehouseMobileItemQuery.tsx
Saída: features/warehouse/mobile/WarehouseMobileOutbound.tsx
Transferência: features/warehouse/mobile/WarehouseMobileTransfer.tsx
read model compartilhado de item/saída: lib/warehouse/mobileOutboundRepository.ts
barcode físico/resolver: lib/warehouse/locationBarcode.ts + locationBarcodeResolver.ts
compatibilidade legada read-only: lib/warehouse/readCompatibility.ts

DECISÃO DE NÃO DUPLICAÇÃO — ATUALIZADA
- Desktop e Mobile podem ter UX diferente, mas NÃO podem ter duas autoridades de estoque.
- Consultar Item e Consultar Localização permanecem read-only.
- Saída móvel deve compor o motor oficial já usado pela Central Desktop, não manter uma segunda regra de OUTBOUND.
- Transferência móvel deve usar um serviço canônico compartilhado para saldo/lote/validade/concorrência; scanner e passos de tela ficam no Mobile.
- Conferir posição e consultas não executam movimentação.
- regras de lote, FEFO, fracionamento, idempotência e writes não pertencem à camada de UI móvel.
- branch worker autorizada: mobile-r1-k-canonical-ops-engine@bd27da91da92642d5a5fea08f7020c6cea658a62.

TESTE MANUAL IMEDIATO PENDENTE — PRIMEIRA MISSÃO DO NOVO COORDENADOR
1. abrir o Preview no HEAD bd27da91da92642d5a5fea08f7020c6cea658a62
2. confirmar 7 cards na Home e respectivas rotas
3. Consultar Localização: testar LOCAL e SUBPOSIÇÃO e confirmar READ-ONLY
4. Consultar Item: testar barcode comercial e confirmar locais/subposições + quantidades + lotes
5. Saída: validar fluxo completo e confirmar que NÃO aparece destino físico; somente destino administrativo/retirado por
6. Transferência: validar que exige origem física e destino físico distintos
7. Alocar Recebimento: validar entrada em destino sem conflitar com Transferência/Saída
8. Inventário: validar contagem/snapshot sem virar consulta genérica
9. Conferir posição: validar correto/incorreto sem executar transferência
10. retestar PAL-01 / 9812001101000 após hardening legado e confirmar conteúdo físico
11. continuar runbook MOBILE-J: câmera permitida/negada/indisponível, fallback manual, som/vibração, double scan/cooldown, perda/retorno de rede e jornada ponta a ponta

SE SURGIR NOVO ERRO
não mascarar automaticamente
classificar:
- unexpected_field puramente legado → avaliar projeção canônica
- saldo duplicado/material ausente/quantidade inválida/hierarquia inválida → inconsistência real; fail-closed
- scanner não decodifica → defeito físico/decoder
- resolver reconhece tipo errado → defeito de namespace/classificador

SAAS R1
funcional: ENCERRADO
HARDEN-A1: PASS
HARDEN-A2: PASS — risco residual aceito
HARDEN-B: PASS
HARDEN-C: PASS
HARDEN-D: PASS

RECOVERY
backup READY: PASS nos dois bancos
recovery:verify: PASS
restore real isolado Warehouse: PASS
integridade: 13/13 coleções
target temporário: emprovex-restore-warehouse-2026-10-04
delete protection target: ATIVA
cleanup target: PENDENTE / exige autorização separada

SESSION / AUTH
SESSION-CAP-01: PASS / integrada no RC original
candidato: sem teto fixo de sessões externas
lease: 30 min
heartbeat: 15 min
TTL sessionSlots.expiresAt: ACTIVE
TTL sessionRevocations.expiresAt: ACTIVE
founder: Google-only
externos: e-mail/senha + e-mail verificado
workspace/UG/UID/e-mail: fail-closed

LEGAL
bundle atual: saas-r1-2026-10-01
Legal Acceptance no Preview: funcionando após publicação das Rules RC
nenhum bypass temporário foi criado

PRÓXIMA SEQUÊNCIA CANÔNICA
teste manual das 7 operações no HEAD bd27da91...
→ LOCAL/SUBPOSIÇÃO/ITEM
→ Saída ≠ Transferência confirmada fisicamente
→ restante MOBILE-J física/integrada
→ reconciliar PR #252
→ repetir gates afetados no SHA final
→ declarar novo RC SHA
→ RE-FREEZE
→ certificação final no SHA exato
→ GO/NO-GO explícito do Fundador
→ eventual app Production
→ piloto real

PROIBIDO SEM NOVA AUTORIZAÇÃO DO FUNDADOR
- deploy do app RC em Vercel Production
- merge/release em main para produção
- novas mudanças produtivas de Rules
- restore real adicional
- apagar target de restore / desligar delete protection para cleanup
- ações destrutivas em usuários/workspaces/dados
- GO comercial amplo
```

# 46. Ativação do próximo Coordenador

Use este bloco quando um novo chat assumir a coordenação geral do EMPROVEX.

```text
PAPEL
Você é o Chat Coordenador Geral / Program Control do EMPROVEX.

REPOSITÓRIO
aprov-hgesm/Controles-de-Empenhos---Aprov

LEITURA OBRIGATÓRIA ANTES DE QUALQUER AÇÃO
1. docs/EMPROVEX_MEMORIAL_OFICIAL.md
2. docs/EMPROVEX_PROGRAM_CONTROL.md
3. PR #252 quando o assunto for MOBILE-J / Preview / Central Móvel

ESTADO PRODUTIVO
main@e90f92acae1514ee5cbc6ce95fed354bc1454330
App produtivo: Performance R3
App RC em Production: NÃO
Rules RC: JÁ PUBLICADAS por autorização específica em 2026-10-05

RC HISTÓRICO
54e60c2264588d8802a67a4cab3d875d64f6bfc1
Este SHA é baseline histórica, não o candidato final após a reabertura controlada.

BRANCH ATIVA
rc-r1-mobile-j-fix-label-readability
HEAD:
bd27da91da92642d5a5fea08f7020c6cea658a62

PR
#252
OPEN / DRAFT / MERGEABLE / NÃO MERGEADO

GATES DO HEAD ATIVO NO CHECKPOINT
Vercel Preview: SUCCESS
Core Protection #317: SUCCESS
Application CI #1030: AGUARDANDO RUNNER
Não inferir PASS final antes do fechamento do CI.

PREVIEW
https://controles-de-empenhos-aprov-git-rc-f44756-aprov-hgesms-projects.vercel.app

CENTRAL MÓVEL — CONTRATO ATUAL
1. Alocar Recebimento
2. Transferir Material
3. Consultar Localização
4. Consultar Item
5. Inventário
6. Saída de Material
7. Conferir posição

SEMÂNTICA OBRIGATÓRIA
- Transferência = origem física → destino físico
- Saída = retirada do estoque → origem física + destino administrativo/retirado por
- Saída NÃO deve pedir destino físico
- Consultar Localização = posição → conteúdo; read-only
- Consultar Item = item → locais/quantidades/lotes; read-only
- Conferir posição = posição + item → correto/incorreto; read-only
- Consultas/conferência não movimentam estoque
- NOVA DECISÃO: Mobile é camada fina de scanner/UX sobre o mesmo motor canônico da Central Desktop.
- Não manter segunda autoridade de saldo/lote/validade/FEFO/idempotência em arquivos mobile.
- Worker autorizado: mobile-r1-k-canonical-ops-engine@bd27da91da92642d5a5fea08f7020c6cea658a62

IDENTIDADE FÍSICA
- EPX1: legado suportado
- EPX2: suportado
- código numérico 13 dígitos: preferido quando representável
- exemplo físico certificado: 9812001101000 = PAL-01
- Android real: CAMERA · LOCATION — PASS
- etiqueta Compacta: 140 mm × 35 mm
- limite de prateleira: <= 35 mm de altura

COMPATIBILIDADE LEGADA
Foi criada projeção canônica read-only para tolerar metadados extras históricos em:
- locationBalances
- lots
- materials
- barcode associations
- posições/origin/unit/conversions onde aplicável

NÃO mascarar inconsistência semântica real.
Saldo duplicado, material ausente, quantidade inválida, hierarquia inválida etc. continuam fail-closed.

PRIMEIRO TRABALHO DO NOVO COORDENADOR
Executar/acompanhar a certificação manual no Preview do HEAD bd27da91...:
1. confirmar 7 cards na Home;
2. Consultar Localização com LOCAL e SUBPOSIÇÃO;
3. Consultar Item com barcode comercial;
4. Saída de Material e confirmar que NÃO pede destino físico;
5. Transferir Material e confirmar que exige destino físico;
6. Alocar Recebimento / Inventário / Conferir posição sem sobreposição;
7. continuar casos físicos MOBILE-J: câmera permitida/negada/indisponível, fallback manual, Code128 físico, som/vibração, double scan/cooldown, perda/retorno de rede, jornada ponta a ponta e coerência Desktop↔Mobile.

APÓS CERTIFICAÇÃO
→ corrigir somente blocker/regressão real, se houver
→ reconciliar semanticamente PR #252
→ repetir gates afetados
→ declarar novo RC SHA
→ RE-FREEZE
→ certificar o SHA exato
→ solicitar GO/NO-GO explícito do Fundador
→ somente depois considerar app Production / piloto

NÃO FAZER SEM AUTORIZAÇÃO EXPLÍCITA DO FUNDADOR
- merge/release em main para produção
- deploy/promote do app para Vercel Production
- novas mudanças produtivas de Firestore Rules
- restore real adicional
- apagar restore temporário / desligar delete protection
- ação destrutiva em usuário/workspace/dados
- GO comercial amplo

RECOVERY
HARDEN-B: PASS
restore isolado: PASS
integridade: 13/13
target temporário ainda existente:
emprovex-restore-warehouse-2026-10-04
cleanup requer autorização separada

REGRA DE COORDENAÇÃO
- verificar HEAD vivo antes de decidir;
- não confundir CI verde com autorização produtiva;
- não reabrir feature nova durante certificação;
- separar blocker real de melhoria estética;
- atualizar este Memorial sempre que o estado global mudar.
```

## Regra final de continuidade

Antes de qualquer decisão futura:

1. ler este bloco;
2. conferir HEADs vivos;
3. conferir se o evento é funcional, transversal ou produtivo;
4. nunca promover estado histórico a estado vigente;
5. nunca considerar uma pendência “resolvida” sem evidência;
6. nunca tratar PASS técnico como autorização de produção.