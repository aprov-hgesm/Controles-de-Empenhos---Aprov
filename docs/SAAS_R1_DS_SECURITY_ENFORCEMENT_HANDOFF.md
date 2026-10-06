# SAAS-DS — Segurança, Enforcement, Suspensão e Reativação — Handoff da Worker

## 1. Identificação

- Frente: **SAAS-DS — Segurança, Enforcement, Suspensão, Reativação e Revogação de Sessões**
- Branch: `saas-r1-ds-security-enforcement`
- Base exata: `73c22a441249cd87b6d6e1dfeb69bcb005d663e9`
- Branch integradora: `feat/saas-r1-commercializacao`
- HEAD funcional certificado antes deste handoff: `476efffaf60e5276e6d68ac9c2a425848b9fff66`
- PR: **#218 — SAAS-DS: segurança, suspensão e reativação**
- Estado do PR: aberto; criado como draft durante a certificação.
- Produção: **não publicada**.

A base foi confirmada antes da implementação: worker e integradora estavam exatamente em `73c22a441249cd87b6d6e1dfeb69bcb005d663e9`, sem divergência.

## 2. IMPLEMENTADO

### 2.1 Arquitetura final de autorização

A SAAS-DS preserva a separação arquitetural:

- `billingAccounts` = verdade comercial;
- `workspaces.status` + `platformAccounts.status` = verdade de autorização operacional.

Billing não foi adicionado ao caminho crítico de Rules, sessão ou carregamento operacional.

A alteração real de acesso ocorre somente por ação administrativa explícita no painel e passa pelo endpoint server-side:

`POST /api/admin/sector-lifecycle`

O endpoint:

1. valida a sessão fundadora;
2. passa por proteção de burst;
3. passa pelo kill switch administrativo;
4. valida o payload;
5. delega a mutação ao serviço `lib/server/sectorLifecycleAdmin.ts`.

### 2.2 Suspensão

A suspensão:

- protege o workspace fundador;
- valida workspace, conta, e-mail, UG, tipo de conta e coerência do estado atual;
- materializa `disabled` no controle de lifecycle da Central;
- atualiza `workspaces.status` e `platformAccounts.status` em um único commit atômico no banco principal;
- usa precondições por `updateTime` para rejeitar concorrência/stale state;
- cria tombstones em `workspaces/{workspaceId}/sessionRevocations/{sessionId}`;
- remove os slots ativos do workspace no mesmo commit principal;
- grava `platformAuditEvents` com operação `sector.status_change`;
- preserva billing;
- preserva Firebase Auth;
- preserva todos os dados operacionais;
- é reexecutável sem criar novo tenant ou novo billing.

O usuário já conectado é invalidado pelo mecanismo existente de `platformSessionControl`, que observa workspace, conta e tombstone de revogação. Não é necessário aguardar expiração natural do lease.

### 2.3 Reativação

A reativação:

- retorna workspace e platform account para `active`;
- preserva UID, e-mail, UG, workspace, billing e dados;
- não cria novo trial;
- não recria tenant;
- não remove tombstones antigos;
- reativa o estado de autorização materializado da Central;
- permite novo login normal após a reativação.

Sessões anteriormente revogadas não voltam a ser válidas. Um novo login/sessão lógica é necessário quando a sessão anterior já foi invalidada.

### 2.4 Atomicidade e recuperação

O banco principal usa `documents:commit` com precondições `currentDocument.updateTime`.

A Central é um Firestore separado (`emprovex-warehouse`), portanto não existe transação atômica nativa entre os dois bancos. A SAAS-DS usa ordenação fail-closed + compensação:

#### Suspensão

1. Central recebe `disabled`;
2. banco principal recebe workspace/account `disabled` + revogação de leases + auditoria;
3. se o commit principal falhar, a Central é compensada para `active` quando o estado anterior era ativo;
4. falha de compensação retorna `RECOVERY_REQUIRED`.

#### Reativação

1. banco principal é reativado;
2. Central recebe `active`;
3. se a Central falhar e o estado anterior era `disabled`, o banco principal é compensado novamente para `disabled`;
4. falha de compensação retorna `RECOVERY_REQUIRED`.

Assim, uma falha entre bancos não é silenciosamente tratada como sucesso.

### 2.5 Central de Depósitos

Foi criado somente um **espelho mínimo de autorização**, não um segundo billing:

`emprovex-warehouse / warehouseAccess/{workspaceId}`

Schema:

- `schemaVersion = warehouse_workspace_access_v1`;
- `workspaceId`;
- `ug`;
- `status = active | disabled`;
- `updatedAt`;
- `updatedBy`.

As Rules da Central continuam exigindo as claims existentes de workspace/UG e, quando o documento de lifecycle já está materializado, também exigem `status == active` e UG coerente.

O fallback de ausência do documento foi mantido para compatibilidade com tenants já existentes antes da primeira ação SAAS-DS. A primeira suspensão/reativação materializa o lifecycle daquele workspace.

Nenhum terceiro banco foi criado.

### 2.6 VIP e fundador

A SAAS-DS não lê nem altera `billingAccounts`.

Consequências:

- fundador continua comercialmente `exempt`;
- VIP externo continua comercialmente `exempt`;
- `exempt` não virou estado de autorização;
- ausência de pagamento não dispara suspensão;
- remover VIP na SAAS-B não dispara suspensão;
- uma eventual suspensão administrativa de VIP é uma ação separada e explícita;
- o workspace fundador é rejeitado pelo parser e pelo serviço de lifecycle e também continua protegido pela UI/Rules históricas.

### 2.7 Login, regularização e reset de senha

Nenhuma alteração foi feita nas páginas públicas nem no Firebase Auth do cliente.

Portanto:

- `/regularizacao` não foi bloqueada;
- Termos/Privacidade continuam públicas;
- recuperação de senha continua independente do billing e do lifecycle;
- um Firebase Auth válido de usuário suspenso não concede acesso operacional: `platformAccess` e Rules recusam workspace/account `disabled`;
- após reativação, o usuário pode autenticar novamente normalmente.

### 2.8 Legal

O `LegalAcceptanceGate` não foi conectado ao shell nesta frente.

Nenhum contrato da SAAS-DL foi redefinido.

### 2.9 UI administrativa

A ação existente de suspender/reativar foi mantida, mas agora:

- usa endpoint server-side;
- exige confirmação explícita;
- explica que suspensão não exclui dados;
- informa que sessões ativas serão revogadas;
- informa que sessões antigas não voltam a ser válidas após reativação;
- separa visualmente billing de enforcement.

No painel de billing, o texto agora esclarece que billing não suspende automaticamente o acesso.

### 2.10 Segurança da API

`sector-lifecycle` foi registrado em:

- `AdminSecurityOperation`;
- `AdminMutationOperation`;
- burst limit administrativo;
- kill switch de mutações.

Novo kill switch opcional:

`EMPROVEX_DISABLE_SECTOR_LIFECYCLE=1`

O valor padrão documentado é `0`.

## 3. Arquivos alterados

- `.env.example`
- `.github/workflows/application-ci.yml`
- `app/api/admin/sector-lifecycle/route.ts`
- `components/admin/AdminBillingPanel.tsx`
- `components/admin/PlatformAdminView.tsx`
- `firestore.warehouse.rules`
- `hooks/usePlatformAdminDirectory.ts`
- `lib/server/requestSecurity.ts`
- `lib/server/sectorLifecycleAdmin.ts`
- `package.json`
- `scripts/verify-saas-r1-security-enforcement.mjs`
- `scripts/verify-sector-lifecycle.mjs`
- `scripts/warehouse-external-access-security.test.mjs`
- este handoff.

`firestore.rules` principal não foi alterado: os guards existentes de workspace/account ativos já eram suficientes.

## 4. Commits funcionais

1. `6d3665f5c62d00b80bd23496958147bbcecdece5` — feat: enforce SaaS workspace lifecycle server-side
2. `f31d12ace00cbd31bc3fdafe790fb45df3d34eed` — feat: add secure sector lifecycle endpoint
3. `a549b6cd43005eafa5875c46b4afa500ad6fd8f2` — feat: route lifecycle changes through secure server API
4. `a05600b704d15158a74fba3c7fa035293773d1f5` — feat: enforce warehouse lifecycle authorization
5. `188dfccb7f268031cf836b6356aec813ee03124c` — fix: keep warehouse lifecycle control server-only
6. `e08b83c92c7884128282143c287bcbb39e952e03` — test: cover warehouse suspension lifecycle
7. `5c3835de88be132a84a3e1ef8941e68813c00e01` — ux: clarify suspension and reactivation effects
8. `34a9e26718460fddfbc98cd4c964a477a796829a` — ux: separate billing status from access enforcement
9. `36f1b2bc950154abb60a2cac3b80468053335f07` — test: add SaaS DS enforcement guard
10. `b7c4b1f65b531ab7209e0a5170026984cd163d77` — ci: register SaaS DS enforcement guard
11. `1b529ec352a7958a22992190dbffd541480e4074` — ci: enforce SaaS DS lifecycle contract
12. `609445bb71290e4fc69ec8b7181e5579df0eae6c` — security: register sector lifecycle mutation controls
13. `4a30e9972c059bf7f43a6d35e5687138d9930ac7` — docs: expose sector lifecycle kill switch
14. `aec0406358d322b4936dc538042942897c7c3aff` — test: make SaaS DS compensation guard structural
15. `476efffaf60e5276e6d68ac9c2a425848b9fff66` — test: align lifecycle guard with server-side enforcement

## 5. Firestore Rules

### Banco principal

- alteração nesta frente: **nenhuma**;
- tamanho certificado no HEAD funcional: **92.811 bytes / 90,64 KiB**;
- continua exigindo workspace e platform account ativos;
- continua proibindo alteração direta crítica pelo usuário externo;
- não ganhou leitura de billing.

### `emprovex-warehouse`

- antes da SAAS-DS: **155.185 bytes**;
- depois da SAAS-DS: **156.038 bytes / 152,38 KiB**;
- delta: **+853 bytes**;
- billing não foi adicionado;
- lifecycle passou a ser observado em `warehouseAccess/{workspaceId}`.

Nenhuma Rule foi publicada em produção por esta worker.

## 6. Index / banco / env

- novo Firestore database: **não**;
- novos indexes: **não**;
- novo segredo obrigatório: **não**;
- nova variável opcional: `EMPROVEX_DISABLE_SECTOR_LIFECYCLE`;
- banco principal preservado;
- `emprovex-warehouse` preservado.

## 7. Auditoria

A mudança de lifecycle grava `platformAuditEvents` com:

- operação `sector.status_change`;
- workspace;
- UG;
- ator UID/e-mail;
- estado anterior;
- estado final;
- motivo;
- quantidade de sessões revogadas;
- marcador `enforcement = saas-r1-ds`.

Não são copiados dados financeiros para a auditoria.

## 8. VALIDADO

### 8.1 Application CI

Execução certificadora do HEAD funcional:

- Workflow: **Application CI**
- Run: **#897 da primeira tentativa falhou por guard novo excessivamente literal**.
- Correção aplicada em `aec040635...`.
- Run final: **SUCCESS** no HEAD `476efffaf...`.

No run final passaram:

- TypeScript error budget;
- Core operational protection;
- Recovery tests;
- Auth/provisioning guards;
- SAAS-C onboarding guard;
- **SAAS R1 security enforcement guard**;
- sector lifecycle guard;
- multi-tenant security suite guard;
- **Multi-tenant Firestore security tests**;
- **Central de Depósitos external workspace security**;
- Production Build;
- Final TypeScript validation;
- Diff Hygiene;
- release gates 16, 17, 18, 19, 20 e 21.

### 8.2 Core Protection

- Workflow: **EMPROVEX Core Protection**
- Run ID: `37017224283`
- Resultado: **SUCCESS**.

### 8.3 Recovery guardrails

- Workflow: **Recovery guardrails**
- Run ID: `37017225087`
- Resultado: **SUCCESS**.

### 8.4 Legal Validation

- Workflow: **SAAS-DL Legal Validation**
- Run ID: `37017225103`
- Resultado: **SUCCESS**.

### 8.5 Firestore Emulator / multi-tenant

O Application CI executou e aprovou a suíte principal de segurança multi-tenant, incluindo o contrato histórico de lifecycle:

- admin não pode suspender somente um lado;
- workspace + conta mudam em conjunto;
- setor perde acesso após `disabled`;
- setor recupera acesso após `active`;
- UID/e-mail/UG continuam protegidos;
- founder continua protegido;
- billing em modo observe não bloqueia operação por si só.

### 8.6 Central de Depósitos / Emulator

`scripts/warehouse-external-access-security.test.mjs` agora cobre explicitamente:

- setor ativo acessa o próprio workspace/UG;
- sessão já aberta perde acesso quando `warehouseAccess.status = disabled`;
- reativação restaura acesso;
- cross-workspace continua DENY;
- UG divergente continua DENY;
- sessão password sem claims continua DENY.

O step **Central de Depósitos external workspace security** ficou **SUCCESS** no Application CI final.

### 8.7 Guard permanente SAAS-DS

Novo comando:

`npm run verify:saas-r1-security-enforcement`

Resultado no CI final:

`SAAS-DS — SEGURANÇA E ENFORCEMENT: READY`

O guard protege permanentemente:

- endpoint founder-only;
- sincronização de autorização;
- revogação de sessões;
- Central respeitando lifecycle;
- ausência de billing nas Rules;
- compatibilidade VIP;
- preservação de dados;
- UI explícita;
- registro no Application CI.

### 8.8 Browser E2E

Não foi criado nem executado um Browser E2E dedicado SAAS-DS.

Razão: os contratos críticos desta frente são de autorização/Rules/sessão e foram validados de forma determinística por guards, Firestore/Auth Emulator e Application CI. O workflow SAAS-C Browser Validation foi **SKIPPED** por escopo de paths e não foi tratado como gate da SAAS-DS.

Isso não mascara falha funcional: as validações autoritativas de Rules e lifecycle ficaram verdes.

## 9. Comportamento final

### Usuário ativo

- login normal;
- resolução workspace/account;
- lease normal;
- Central autorizada quando lifecycle materializado está ativo.

### Suspensão

- ação administrativa explícita;
- workspace + account `disabled`;
- leases conhecidos revogados/removidos;
- listeners de sessão invalidam a sessão;
- Rules principais negam dados;
- Central nega operações;
- billing e dados permanecem intactos.

### Novo login durante suspensão

O Firebase Auth pode autenticar a credencial, pois a conta Auth não é deletada/desabilitada. Porém o EMPROVEX rejeita a autorização operacional porque workspace/account estão `disabled`; nenhuma subscription operacional deve ser aberta.

### Reativação

- workspace + account voltam a `active`;
- Central volta a `active`;
- dados continuam no mesmo tenant;
- usuário pode entrar novamente;
- tombstones antigos não são reutilizados como sessão válida.

## 10. NÃO PUBLICADO EM PRODUÇÃO

Esta worker **não**:

- fez merge em `main`;
- fez merge na integradora;
- publicou Vercel produção;
- publicou `firestore.warehouse.rules`;
- publicou `firestore.rules`;
- criou novo banco;
- criou webhook/API Mercado Pago;
- criou suspensão automática;
- conectou `LegalAcceptanceGate`;
- implementou SAAS-I, SAAS-P ou SAAS-J.

## 11. PENDÊNCIA PARA SAAS-I

A SAAS-I deverá, após integrar semanticamente esta worker:

1. publicar as Rules da Central no momento correto da release;
2. garantir que a versão de aplicação que grava `warehouseAccess` e a Rule que o lê sejam promovidas de forma coordenada;
3. validar a jornada combinada SAAS-B + SAAS-C + SAAS-DL + SAAS-E + SAAS-DS;
4. conectar o `LegalAcceptanceGate` ao shell no ponto previsto pela arquitetura;
5. decidir se a UI de billing deve ganhar um atalho explícito para a ação separada de suspensão operacional — sem automatizar a decisão;
6. atualizar Memorial Oficial, Integration Status e Handoff do Coordenador.

## 12. Riscos residuais

1. Não há transação ACID entre os dois databases Firestore. A solução usa fail-closed + compensação e sinaliza `RECOVERY_REQUIRED` se a compensação falhar.
2. O documento `warehouseAccess` é criado na primeira ação lifecycle. Antes disso, a Central mantém compatibilidade pelo fallback de ausência do documento.
3. O endpoint depende da credencial server-only `FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON`, já existente na arquitetura.
4. Publicação da nova Rule da Central precisa ocorrer junto da integração/release; esta worker deliberadamente não publicou Rules.
5. Um Browser E2E específico para a UX de clique/redirect após suspensão pode ser adicionado pela SAAS-I se o coordenador julgar útil, mas não é necessário para provar o enforcement autoritativo já validado.

## 13. Comandos de reprodução

```powershell
git fetch origin
git switch saas-r1-ds-security-enforcement
git pull --ff-only

npm ci
npm run verify:saas-r1-security-enforcement
npm run verify:sector-lifecycle
npm run verify:block-16-1-session-enforcement
npm run verify:block-16-2-admin-session-panel
npm run verify:sector-auth-provisioning
npm run verify:saas-r1-onboarding
npm run verify:saas-r1-legal-acceptance
npm run verify:saas-r1-ops-recovery
npm run test:central-depositos-external-security
npm run test:security:multitenant
npm run build
npm run typecheck
git diff --check 73c22a441249cd87b6d6e1dfeb69bcb005d663e9...HEAD
```

Os nomes exatos de scripts históricos podem ser confirmados no `package.json`; o Application CI é a certificação canônica combinada.

## 14. Estado final

**IMPLEMENTADO**

- enforcement server-side;
- suspensão e reativação;
- revogação de sessões;
- Central;
- auditoria;
- recovery/compensação;
- UI;
- guard permanente;
- CI.

**VALIDADO**

- Application CI: SUCCESS;
- Core Protection: SUCCESS;
- Recovery guardrails: SUCCESS;
- SAAS-DL Legal Validation: SUCCESS;
- multi-tenant Emulator: SUCCESS;
- Central external security: SUCCESS;
- Production Build: SUCCESS;
- TypeScript final: SUCCESS;
- Diff Hygiene: SUCCESS.

**NÃO PUBLICADO EM PRODUÇÃO**

- sem merge;
- sem deploy de produção;
- sem publicação de Rules.

**PENDÊNCIA PARA SAAS-I**

- integração coordenada;
- publicação futura de Rules;
- glue legal no shell;
- validação combinada da R1.

# SAAS-DS — PRONTA PARA INTEGRAÇÃO
