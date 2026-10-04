# SESSION-CAP-01 + RULES-AUDIT-01

## Estado

- Branch: `rc-session-cap-rules-audit`
- Base congelada: `c6c164c70a1be3e2e7e4e57b0bbf4866d61a71ce`
- Produção: intocada
- Deploy de Rules: não autorizado nesta frente
- Objetivo: remover apenas o teto artificial de duas sessões e certificar o ruleset RC.

## Inventário da arquitetura antiga

| Dependência | Contrato antigo | Risco | Tratamento SESSION-CAP-01 |
|---|---|---|---|
| `DEFAULT_EXTERNAL_SECTOR_SESSION_LIMIT` | `2` | bloqueio do 3º navegador | `null` = sem teto fixo |
| `SESSION_SLOT_IDS` | `slot-1`, `slot-2` | aquisição/lifecycle/painel limitados a dois | preservados somente como legado transitório |
| `platformSessionLease` | transação lia tombstone + 2 slots | custo e limite estrutural | tombstone + lease exato por `browserInstanceId` |
| `firestore.rules` | somente dois IDs válidos | 3ª/4ª sessão DENY | ID dinâmico vinculado a `browserInstanceId`; legado aceito |
| painel admin | filtrava `SESSION_SLOT_IDS` | sessão dinâmica invisível | lista qualquer lease válido do collection group |
| lifecycle | carregava e revogava dois slots | sessão 3+ sobreviveria à suspensão | lista todos, bloqueia autorização primeiro e revoga em lotes |
| provisioning rollback | deletes explícitos de dois slots | resíduos dinâmicos | limpeza recursiva do workspace |
| guards/E2E | exigiam exatamente 2 sessões | CI perpetuaria contrato antigo | evoluídos para 3ª/4ª ALLOW e isolamento DENY |

## Arquitetura RC

Cada instância de navegador externo usa:

`workspaces/{workspaceId}/sessionSlots/{browserInstanceId}`

O documento conserva `sessionId`, `workspaceId`, `ug`, `uid`, `accountEmail`,
`browserInstanceId`, `startedAt`, `lastSeenAt` e `expiresAt`.

### Invariantes

- o document ID dinâmico deve ser igual a `browserInstanceId`;
- uma sessão ativa não pode ser sobrescrita por identidade lógica diferente;
- múltiplas abas do mesmo navegador compartilham `browserInstanceId` e `sessionId`;
- lease permanece 30 minutos;
- heartbeat permanece 15 minutos;
- fundador continua isento do lease externo;
- o código diagnóstico legado `SESSION_CAPACITY_EXCEEDED` permanece apenas para compatibilidade de estados/clientes antigos; a aquisição RC não o emite e não existe mensagem funcional de “2 sessões”;
- tombstone continua bloqueando o mesmo `sessionId` enquanto existir;
- tenant externo não pode listar `sessionSlots`; administração pode;
- cross-workspace continua DENY;
- suspensão atualiza a autorização principal para `disabled` antes da limpeza de leases;
- leases são revogados/deletados em lotes para não depender de um limite de duas sessões.

## Compatibilidade de rollout

| Aplicação | Rules | Resultado |
|---|---|---|
| app antiga | Rules antigas | baseline histórico |
| app antiga | Rules RC | compatível via `slot-1` / `slot-2` |
| app RC | Rules RC | alvo final |
| app RC | Rules antigas | incompatível para criação de lease dinâmico |

Ordem obrigatória de rollout: **Rules RC primeiro, aplicação RC depois**.

Rollback seguro da aplicação: voltar a app antiga mantendo Rules RC.
Rollback das Rules exige primeiro rollback da aplicação; Rules antigas não aceitam leases dinâmicos.

## Expiração e retenção

Logout explícito remove o lease. O mesmo navegador reutiliza o mesmo document ID,
o que limita resíduos normais. Navegadores abandonados/crashados ainda podem deixar
documentos expirados; portanto o RC exige TTL do Firestore antes do GO produtivo.

Políticas preparadas, mas **não executadas por este worker**:

```bash
gcloud firestore fields ttls update expiresAt \
  --collection-group=sessionSlots \
  --database=ai-studio-logsticahospital-3eeee498-faa1-4326-8f4f-95d34b382ec1 \
  --enable-ttl

gcloud firestore fields ttls update expiresAt \
  --collection-group=sessionRevocations \
  --database=ai-studio-logsticahospital-3eeee498-faa1-4326-8f4f-95d34b382ec1 \
  --enable-ttl
```

Verificação somente leitura:

```bash
gcloud firestore fields ttls list \
  --collection-group=sessionSlots \
  --database=ai-studio-logsticahospital-3eeee498-faa1-4326-8f4f-95d34b382ec1

gcloud firestore fields ttls list \
  --collection-group=sessionRevocations \
  --database=ai-studio-logsticahospital-3eeee498-faa1-4326-8f4f-95d34b382ec1
```

Sem evidência do estado real dessas duas políticas, o critério de crescimento
controlado fica pendente externo e não deve ser convertido em PASS por inferência.

## Lifecycle com N sessões

A suspensão segue a ordem de segurança:

1. desabilitar `warehouseAccess`;
2. marcar `workspace.status` e `platformAccount.status` como `disabled`;
3. revogar e deletar todas as sessões encontradas;
4. registrar auditoria.

A etapa 2 fecha a autorização antes da limpeza potencialmente longa. A limpeza usa
lotes de 180 sessões (até 360 writes tombstone+delete por commit), abaixo do limite
de 500 writes por commit. Falha posterior mantém o sistema fail-closed e retorna
`RECOVERY_REQUIRED` em vez de reabrir o Warehouse.

Na reativação, leases residuais são limpos enquanto o workspace ainda está bloqueado.

## Rules — classificação do delta SESSION-CAP-01

| Delta | Classe | Justificativa / compensação |
|---|---|---|
| IDs dinâmicos em `sessionSlots` | PERMISSIVA controlada | necessário para N sessões; binding obrigatório ao `browserInstanceId` |
| `slot-1` / `slot-2` ainda aceitos | NEUTRA/COMPAT | janela de rollout/rollback |
| LIST de `sessionSlots` para tenant removido | RESTRITIVA | evita enumeração de sessões |
| admin collection-group LIST | NEUTRA | painel administrativo já existente |
| revocation `slotId` dinâmico | PERMISSIVA controlada | necessário para encerramento individual; create continua founder/admin-only |

## Matriz mínima ALLOW/DENY adicionada

- ALLOW: `slot-1` legado e `slot-2` legado durante transição;
- ALLOW: 3ª sessão dinâmica legítima;
- ALLOW: 4ª sessão dinâmica legítima;
- ALLOW: renovação da própria sessão dinâmica;
- ALLOW: retomada de lease expirado pelo mesmo navegador;
- ALLOW: administrador listar e encerrar sessão dinâmica;
- DENY: `slot-3` como pseudo-legado;
- DENY: document ID dinâmico diferente de `browserInstanceId`;
- DENY: sobrescrever lease dinâmico ativo de outra sessão lógica;
- DENY: tenant enumerar `sessionSlots`;
- DENY: cross-workspace;
- DENY: fundador consumir lease operacional externo no workspace fundador;
- DENY: tenant criar tombstone;
- DENY: tombstone existente ser reciclado.

## Fingerprints de repositório

| Rules | `main` / R3 conhecido | pré-SESSION-CAP (`c6c164...`) | RC atual |
|---|---|---|---|
| Principal | `0d990b7de0b2e85ed55fe14ec0d2ce29b3635299` | `57a1394c921b2ab2c15537fbfc4aaea17515b28a` | `bc91185f34bcdcb4437a4de1078d1089a09292ba` |
| Warehouse | `b5325fe5a8cbe9b0ade8568d35a2cd678ce6e0f2` | `6e1f1050005314db4e17cb3136409abbddb0ee91` | `6e1f1050005314db4e17cb3136409abbddb0ee91` |

Tamanho fonte atual:

- principal RC: 95.273 bytes / 2.524 linhas;
- Warehouse RC: 156.038 bytes / 3.331 linhas.

Inventário semântico estrutural do principal:

- R3/main: 115 helpers, 20 `match`, 42 formas `allow` únicas;
- pré-SESSION-CAP: 116 helpers, 20 `match`, 44 formas `allow`;
- RC atual: 118 helpers, 20 `match`, 44 formas `allow`.

Do pré-SESSION-CAP para o RC não surgiu novo namespace `match`. Foram adicionados
`isLegacySessionSlotId` e `workspaceSessionSlotBindingMatches`. O `get,list` de
`sessionSlots` para tenant/admin foi separado em `get` para tenant/admin e `list`
somente administrativo, tornando a enumeração externa mais restritiva.

No Warehouse não existe delta SESSION-CAP-01: o blob pré-SESSION-CAP e o blob RC
são idênticos (`6e1f105...`). O delta conhecido em relação a main está ligado ao
lifecycle SaaS/Mobile já reconciliado antes desta frente.

## Baseline real de produção

A consulta do ruleset realmente ativo é etapa obrigatória da RULES-AUDIT-01.
Se credenciais de leitura não estiverem disponíveis no ambiente do worker, registrar
como pendência externa; não inferir que produção é igual a `main`.

## Gates e classificação

### Evidência automática no HEAD de código certificado

HEAD de código/Rules certificado: `1085ada38c90dd450856cb7767447d4816cb216c`.
HEAD de Browser E2E certificado: `44372599fe0526313d3650a55c649615a1ff14d4`.

- Application CI #952: **SUCCESS** no HEAD de código/Rules;
- EMPROVEX Core Protection #245: **SUCCESS** no ciclo de Browser/finalização;
- Recovery guardrails #636: **SUCCESS** no ciclo de Browser/finalização;
- SAAS-DL Legal Validation #60: **SUCCESS** no ciclo de Browser/finalização;
- Production Build: **PASS**;
- TypeScript final: **PASS**;
- Diff Hygiene: **PASS**;
- Block 16 Final Release Gate: **SUCCESS**;
- Block 17 Final Release Gate: **SUCCESS**;
- Block 18 Final Release Gate: **SUCCESS**;
- Block 19 Final Closure Gate: **SUCCESS**;
- Block 20 Final Release Gate: **SUCCESS**;
- Block 21 Final Release Gate: **SUCCESS**;
- Vercel: **FAILURE EXTERNA — build-rate-limit**, sem evidência de regressão funcional deste delta;
- SESSION-CAP Browser E2E with Firebase Emulator — workflow run **#49 / 37171327188: SUCCESS**;
- Bloco 16.8 Browser E2E: **8/8 PASS** em Chromium/Firebase Emulator;
- cenário `quatro sessões independentes coexistem e múltiplas abas compartilham a mesma sessão lógica`: **1/1 PASS**.

### Emulator / Rules

A suíte `test:security:multitenant` executou Firebase Auth + Firestore Emulator e confirmou:

- ALLOW — compatibilidade transitória `slot-1`;
- ALLOW — compatibilidade transitória `slot-2`;
- ALLOW — 3ª sessão dinâmica legítima;
- ALLOW — 4ª sessão dinâmica legítima;
- DENY — pseudo-slot legado `slot-3`;
- DENY — document ID dinâmico diferente de `browserInstanceId`;
- DENY — sessão diferente sobrescrever lease dinâmico ainda ativo;
- isolamento multi-tenant e demais cenários da suíte permaneceram verdes.

Os guards registraram ainda:

- sessões externas: **SEM TETO FIXO**;
- múltiplas abas: **1 LEASE POR NAVEGADOR**;
- lease / heartbeat: **30 MIN / 15 MIN**;
- aquisição dinâmica: **2 READS + 1 WRITE**;
- renovação conhecida: **0 READS explícitas + 1 WRITE**;
- painel administrativo, revogação 24 h e `session.terminate`: **READY**.

### Reconciliação SaaS ↔ Mobile viva

Na leitura de 2026-10-04, `feat/saas-r1-commercializacao` e
`feat/central-mobile-r1` apresentaram blobs idênticos nos oito pontos
compartilhados auditados antes do SESSION-CAP:

- `lib/platformCapacity.ts`;
- `lib/platformSessionLease.ts`;
- `lib/platformAdminSessions.ts`;
- `lib/server/sectorLifecycleAdmin.ts`;
- `lib/server/sectorProvisioningAdmin.ts`;
- `components/admin/AdminSessionsPanel.tsx`;
- `firestore.rules`;
- `firestore.warehouse.rules`.

Rules compartilhadas continuam em:

- principal pré-SESSION-CAP: `57a1394c921b2ab2c15537fbfc4aaea17515b28a`;
- Warehouse: `6e1f1050005314db4e17cb3136409abbddb0ee91`.

O RC desta frente altera somente a principal para
`bc91185f34bcdcb4437a4de1078d1089a09292ba`; Warehouse permanece idêntica.

### Browser E2E certificado

Como a conexão GitHub disponível ao worker não oferece `workflow_dispatch`, foi
adicionado temporariamente um job restrito exclusivamente à branch
`rc-session-cap-rules-audit`, usando somente Firebase Emulator + Chromium.
Depois da certificação o job temporário foi removido do workflow.

Run: **SAAS-C Browser Validation #49 / 37171327188 — SUCCESS**.

Evidências:

- Bloco 16.8: **8/8 PASS**;
- heartbeat 30 min / 15 min: PASS;
- relógio local atrasado/adiantado: PASS;
- reaproveitamento de lease dinâmico expirado: PASS;
- leases concorrentes independentes: PASS;
- multitab compartilhado: PASS;
- revogação administrativa em todas as abas: PASS;
- tombstone + novo login/nova identidade: PASS;
- quatro sessões independentes + multitab: **1/1 PASS**.

A primeira tentativa Browser completa revelou que os helpers E2E históricos não
atravessavam o `LegalAcceptanceGate` do SaaS R1. Os helpers foram corrigidos para
aceitar explicitamente o bundle legal no Emulator; nenhuma regra de produção foi
relaxada.

### Gates externos obrigatórios ainda não satisfeitos

1. **ruleset realmente ativo em produção + drift check** dos dois bancos;
2. **estado TTL real** de `sessionSlots.expiresAt` e `sessionRevocations.expiresAt`.

Não existe credencial GCP/Firebase disponível nas ferramentas desta worker para
consultar esses dois estados vivos. Nenhuma tentativa de contornar IAM ou reutilizar
segredos externos foi feita.

Se a leitura viva das Rules revelar drift inexplicado, a classificação obrigatória é:

**STOP PRODUCTION RULES DRIFT — NÃO PUBLICAR.**

### Classificação

**SESSION-CAP-01:** `PASS TÉCNICO COMPLETO — CÓDIGO + RULES + EMULATOR + BROWSER E2E`.
O release produtivo continua condicionado à confirmação operacional de TTL e ao
baseline vivo das Rules.

**RULES-AUDIT-01:** `PRONTA PARA FECHAMENTO EXTERNO / AINDA NÃO PASS FINAL`,
pendente somente da captura do ruleset produtivo real, drift check e confirmação TTL.

Produção permanece intocada. Nenhuma publicação de Rules, Vercel production,
merge em `main`, restore ou promoção produtiva foi realizada.
