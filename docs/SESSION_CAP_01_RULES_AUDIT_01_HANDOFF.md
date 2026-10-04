# HANDOFF — SESSION-CAP-01 + RULES-AUDIT-01

Data: 2026-10-04

## 1. Identidade

- repositório: `aprov-hgesm/Controles-de-Empenhos---Aprov`;
- branch worker: `rc-session-cap-rules-audit`;
- base congelada: `c6c164c70a1be3e2e7e4e57b0bbf4866d61a71ce`;
- PR: **#248**, aberto e DRAFT;
- HEAD de código/Rules certificado: `1085ada38c90dd450856cb7767447d4816cb216c`;
- HEAD de Browser E2E certificado: `44372599fe0526313d3650a55c649615a1ff14d4`;
- produção: **NÃO ALTERADA**.

A integradora SaaS avançou após o freeze apenas com deltas documentais observados
durante esta worker. Não houve merge/rebase da integradora na branch.

## 2. Resultado funcional

O teto fixo de duas sessões externas foi removido.

Contrato RC:

- sessão externa por `browserInstanceId`;
- documento: `workspaces/{workspaceId}/sessionSlots/{browserInstanceId}`;
- `sessionId` continua lógico por usuário/workspace e compartilhado entre abas;
- lease: 30 minutos;
- heartbeat: 15 minutos;
- revocation/tombstone: 24 horas;
- fundador: isento do lease externo;
- `slot-1` e `slot-2`: somente compatibilidade transitória;
- 3ª e 4ª sessões legítimas: permitidas;
- tenant: sem LIST de `sessionSlots`;
- admin: vê todas as sessões e encerra uma sessão específica;
- lifecycle: fail-closed, autorização é bloqueada antes da limpeza e sessões são
  revogadas em lotes;
- provisioning rollback: limpeza recursiva do workspace;
- logout/relogin no mesmo navegador reutiliza o mesmo document ID dinâmico.

O código `SESSION_CAPACITY_EXCEEDED` permanece somente como compatibilidade
diagnóstica histórica. A aquisição RC normal não o emite e não apresenta teto de 2.

## 3. Rules

### Principal

- R3/main conhecido: `0d990b7de0b2e85ed55fe14ec0d2ce29b3635299`;
- pré-SESSION-CAP: `57a1394c921b2ab2c15537fbfc4aaea17515b28a`;
- RC: `bc91185f34bcdcb4437a4de1078d1089a09292ba`.

### Warehouse

- R3/main conhecido: `b5325fe5a8cbe9b0ade8568d35a2cd678ce6e0f2`;
- pré-SESSION-CAP / RC: `6e1f1050005314db4e17cb3136409abbddb0ee91`.

Não existe delta SESSION-CAP no Warehouse.

Regras de sessão dinâmicas exigem vínculo entre document ID e
`browserInstanceId`, preservando os dois IDs legados apenas durante
rollout/rollback.

## 4. Evidência de segurança

Firebase Auth + Firestore Emulator confirmou:

- ALLOW `slot-1` legado;
- ALLOW `slot-2` legado;
- ALLOW 3ª sessão dinâmica;
- ALLOW 4ª sessão dinâmica;
- DENY pseudo-legado `slot-3`;
- DENY ID dinâmico divergente de `browserInstanceId`;
- DENY overwrite de lease dinâmico ativo de outra sessão;
- multi-tenant permanece protegido.

O lifecycle suporta N sessões e usa lotes de até 180 sessões por commit de limpeza,
mantendo margem abaixo do limite de writes. Em falha parcial após bloqueio de
autorização, o workspace permanece desabilitado e retorna `RECOVERY_REQUIRED`.

## 5. Regressão / CI

No HEAD de código/Rules `1085ada3...` e no ciclo de certificação Browser
`44372599...`:

- Application CI #952 — SUCCESS;
- Core Protection #245 — SUCCESS;
- Recovery guardrails #636 — SUCCESS;
- Legal Validation #60 — SUCCESS;
- Production Build — PASS;
- TypeScript final — PASS;
- Diff Hygiene — PASS;
- Final Gates 16, 17, 18, 19, 20 e 21 — SUCCESS;
- SESSION-CAP Browser E2E run #49 / 37171327188 — **SUCCESS**.

Browser E2E focado:

- Bloco 16.8: **8/8 PASS** em 56,4 s;
- quatro sessões independentes + multitab compartilhado: **1/1 PASS** em 35,3 s;
- Firebase Auth + Firestore Emulator + Chromium;
- nenhuma produção acessada.

Três regressões de teste/guard históricos foram encontradas e corrigidas durante a worker:

1. Block 16.3 ainda esperava 3 reads na aquisição; contrato correto passou a 2 reads;
2. Block 19.14 ainda exigia literalmente “duas sessões / terceira barrada”; passou
   a exigir quatro sessões independentes + multitab compartilhado;
3. helpers Browser E2E ainda pulavam diretamente do login para a navegação e não
   atravessavam o `LegalAcceptanceGate` do SaaS R1; os helpers agora registram
   aceite legal explicitamente no Emulator antes de exigir a superfície operacional.

Vercel registrou `build-rate-limit`, classificado como limitação externa já
conhecida e não como falha funcional deste delta.

## 6. Reconciliação SaaS + Mobile

Leitura viva de 2026-10-04 confirmou blobs idênticos entre
`feat/saas-r1-commercializacao` e `feat/central-mobile-r1` em oito superfícies
compartilhadas críticas: capacity, lease, admin sessions, lifecycle, provisioning,
painel, Rules principal e Warehouse.

Classificação Mobile: **DELTA COMPATÍVEL**, sem conflito novo identificado.

## 7. Rollout e rollback

Ordem obrigatória para futura janela autorizada:

1. capturar Rules realmente ativas dos dois bancos;
2. comparar hashes e explicar todo drift;
3. confirmar TTL;
4. congelar os blobs finais depois dos gates vivos;
5. publicar **Rules RC primeiro**;
6. publicar/promover **aplicação RC depois**;
7. executar smoke e matriz ALLOW/DENY real.

Compatibilidade:

- app antiga + Rules antigas: baseline;
- app antiga + Rules RC: compatível via `slot-1`/`slot-2`;
- app RC + Rules RC: alvo;
- app RC + Rules antigas: **incompatível**.

Rollback da aplicação pode voltar para app antiga mantendo Rules RC.
Rollback das Rules exige primeiro rollback da aplicação.

## 8. Gates externos pendentes

### A — Rules produtivas reais

Capturar ruleset ativo principal e Warehouse em modo somente leitura.

Se houver drift inexplicado:

**STOP PRODUCTION RULES DRIFT — NÃO PUBLICAR.**

### B — TTL

Confirmar no banco principal:

- collection group `sessionSlots` / field `expiresAt`;
- collection group `sessionRevocations` / field `expiresAt`.

Não ativar/modificar produção sem autorização explícita.

Não existe credencial GCP/Firebase disponível nesta worker para consultar esses
dois estados vivos. A certificação Browser foi concluída e não é mais pendência.

## 9. Classificação final da worker

- **SESSION-CAP-01:** **PASS TÉCNICO COMPLETO** — código, Rules, Emulator e Browser E2E.
- **RULES-AUDIT-01:** pronta para fechamento externo; **NÃO PASS FINAL** enquanto ruleset produtivo/drift e TTL não forem confirmados.
- **Publicação:** NÃO AUTORIZADA / NÃO EXECUTADA.
- **PR #248:** manter DRAFT até os dois gates externos.

## 10. Próxima ação do Coordenador

Não abrir nova feature desta frente.

Fechar somente os dois gates externos acima. Se ambos forem verdes e não houver
drift inexplicado, congelar o RC e executar a publicação única das Rules na ordem
documentada, dentro de janela explicitamente autorizada.
