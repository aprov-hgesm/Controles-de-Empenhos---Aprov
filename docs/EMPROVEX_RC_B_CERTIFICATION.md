# EMPROVEX RC-B — Certificação Independente do RC único SaaS R1 + Mobile R1

**NOME DO CHAT:** RC-B — CERTIFICAÇÃO DO RC ÚNICO SaaS + Mobile

## 1. Identidade auditada

- Branch de certificação: `rc-r1-b-certification`
- RC_RUNTIME_SHA: `54e60c2264588d8802a67a4cab3d875d64f6bfc1`
- RC_COMPOSITION_HEAD: `7f449db986da359091c70f6ae27934f0db18a0cb`
- SaaS source: `2c1eee759ea8024c296b4c6968ed935b9a59e880`
- Mobile source: `7b7717b6eebabf911310d2b8ac56ed13c9cb9238`
- main/produção: `e90f92acae1514ee5cbc6ce95fed354bc1454330`
- PR RC-A: #249
- Produção alterada pela RC-B: **NÃO**

A auditoria foi conduzida com postura adversarial: o handoff RC-A não foi aceito como prova única.

## 2. Integridade SHA e governança

Verificações independentes:

1. `origin/rc-r1-a-composition` é idêntica a `7f449db...`.
2. `origin/feat/saas-r1-commercializacao` é idêntica a `2c1eee...`.
3. `origin/feat/central-mobile-r1` é idêntica a `7b7717...`.
4. `origin/main` é idêntica a `e90f92...`.
5. `54e60c... -> 7f449d...` possui 1 commit e somente:
   - `docs/EMPROVEX_MEMORIAL_OFICIAL.md`
   - `docs/EMPROVEX_RC_A_HANDOFF.md`
   - `docs/EMPROVEX_RC_R1_COMPOSITION.md`

**Resultado:** RC_RUNTIME_SHA e RC_COMPOSITION_HEAD são funcionalmente equivalentes.

PR #249 conferido ao vivo:

- OPEN
- DRAFT
- MERGEABLE
- NÃO MERGEADO
- base: `feat/saas-r1-commercializacao`
- head: `rc-r1-a-composition`

## 3. Composição semântica

O delta SaaS source -> RC_RUNTIME_SHA possui 2 commits e adiciona/incorpora apenas a superfície Mobile, tooling/gates Mobile, CT-01 e união mínima de package/lock.

Arquivos críticos de SESSION-CAP e Rules são byte-identical entre o SaaS congelado e o RC:

- `lib/platformCapacity.ts`: `ccc754e18e9be6251b9e2785cd1169fbef818998`
- `lib/platformSessionLease.ts`: `1711b381da8b9973210c989b6afa6d162574c5c6`
- `lib/platformSessionControl.ts`: `e350e3e1cf1e43444017bc59ab17e218aa066837`
- `lib/platformAdminSessions.ts`: `34662647638f621f74d83a24bc17acb67422f66e`
- `firestore.rules`: `bc91185f34bcdcb4437a4de1078d1089a09292ba`
- `firestore.warehouse.rules`: `6e1f1050005314db4e17cb3136409abbddb0ee91`

Não foi encontrada reintrodução de runtime Mobile antigo sobre capacity/lease/admin sessions.

## 4. SESSION-CAP

Auditado no código e nos guards:

- `DEFAULT_EXTERNAL_SECTOR_SESSION_LIMIT = null`;
- documento de lease dinâmico por `browserInstanceId`;
- `sessionId` lógico separado;
- lease = 30 min;
- heartbeat = 15 min;
- revocation/tombstone = 24 h;
- `slot-1` e `slot-2` são apenas compatibilidade legada;
- aquisição normal não usa teto fixo de duas sessões;
- `SESSION_CAPACITY_EXCEEDED` permanece apenas como compatibilidade diagnóstica;
- admin usa `collectionGroup('sessionSlots')` e revogação por sessão;
- lifecycle preserva fail-closed e revogação;
- regras vinculam o documento dinâmico ao `browserInstanceId`;
- multi-tenant e cross-workspace permanecem protegidos.

Application CI #961/#962 executou com SUCCESS os guards Block 16.0/16.1/16.2/16.3/16.7/16.8/16.9 e 17.1/17.2, além dos testes multi-tenant aplicáveis.

**SESSION-CAP: PASS**

## 5. CT-01

Hash de `next.config.ts`:

`a67a5f7855409185b72bdb2c392a6523d870b2e8`

Contrato efetivo:

`camera=(self), microphone=(), geolocation=()`

Verificações:

- câmera same-origin: permitida;
- microfone: bloqueado;
- geolocalização: bloqueada;
- `vercel.json`: somente cron;
- `middleware.ts`: ausente;
- `src/middleware.ts`: ausente;
- nenhum outro arquivo de configuração foi introduzido no delta do RC para contradizer a policy.

**CT-01: PASS**

## 6. Rules

Hashes independentes do conteúdo candidato:

- RULES_MAIN_RC: `bc91185f34bcdcb4437a4de1078d1089a09292ba`
- RULES_WAREHOUSE_RC: `6e1f1050005314db4e17cb3136409abbddb0ee91`

Semântica auditada:

- fundador: Google-only;
- externo: password-only;
- UID binding operacional;
- workspace/UG coerentes;
- `warehouseAccess` + lifecycle;
- Central externa vinculada a workspace/UG;
- billing não é autorização operacional;
- Rules RC não foram publicadas por RC-B.

RULES-AUDIT-01/TTL ficam preservados como evidência anterior certificada; RC-B não repetiu writes, não mudou TTL e não alterou IAM.

**Rules principal: PASS**
**Rules Warehouse: PASS**
**Multi-tenant: PASS**
**External workspace: PASS**

## 7. Package e lockfile

Hash do lockfile:

`7c1ecd0dc074b8924c25123955f70e0ba10675dd`

O diff de dependências SaaS -> RC é estritamente:

- `@zxing/browser`: adicionado em `^0.1.5`;
- `@zxing/library`: adicionado em `^0.21.3`.

Preservados:

- `jspdf ^4.2.1`;
- `jspdf-autotable ^5.0.8`;
- override `undici 6.28.1`.

Nenhum script SaaS foi removido; foram adicionados apenas os scripts/gates Mobile A-I esperados.

`npm ci` passou em Application CI e Legal Validation nos SHAs auditados.

**Package/lock: PASS**

## 8. CI, build, TypeScript e gates

### RC_RUNTIME_SHA

- Application CI #961 — SUCCESS
- SAAS-DL Legal Validation #63 — SUCCESS
- EMPROVEX Core Protection #248 — SUCCESS
- Recovery guardrails #639 — SUCCESS
- SAAS-C Browser Validation #52 — SKIPPED por condição do workflow

### RC_COMPOSITION_HEAD

- Application CI #962 — SUCCESS
- SAAS-DL Legal Validation #64 — SUCCESS
- EMPROVEX Core Protection #249 — SUCCESS
- Recovery guardrails #640 — SUCCESS
- SAAS-C Browser Validation #53 — SKIPPED por condição do workflow

A inspeção dos jobs do Application CI #962 confirmou SUCCESS, entre outros, para:

- instalação de dependências;
- TypeScript error budget;
- external sector login;
- UID binding;
- sector lifecycle;
- multi-tenant suite e Emulator;
- Central external workspace security;
- SAAS R1 security enforcement;
- billing;
- SESSION-CAP Block 16.x/17.x;
- scanner;
- Integration 1/2/3;
- MOBILE-C/F/G/H;
- MOBILE-I;
- Production build;
- Final TypeScript validation;
- Diff hygiene.

**Application CI: PASS**
**Core Protection: PASS**
**Recovery guardrails: PASS**
**Legal Validation: PASS**
**Production Build: PASS**
**Final TypeScript: PASS**
**Diff Hygiene: PASS**
**Billing/lifecycle: PASS**
**Legal Acceptance: PASS**
**warehouseAccess/Central: PASS**

Observação metodológica: RC-B não teve acesso a um checkout executável do repositório nesta sessão; portanto não fabricou uma execução local de `npm ci/build/typecheck`. Em vez disso, validou independentemente os jobs/steps GitHub associados aos SHAs exatos e a equivalência funcional do HEAD documental. O PR RC-B é exclusivamente documental e o workflow `Application CI` possui `paths-ignore: docs/**`; portanto a ausência de novo run automático no PR RC-B é esperada e não foi convertida em PASS adicional.

## 9. Mobile A-I e Mobile-J

O candidato contém as rotas e implementações Mobile A-I, com os gates correspondentes executados no Application CI.

- Mobile A — PASS
- Mobile B — PASS
- Mobile C — PASS
- Mobile D — PASS
- Mobile E — PASS
- Mobile F — PASS
- Mobile G — PASS
- Mobile H — PASS
- Mobile I — PASS

**MOBILE A-I: PASS**

MOBILE-J permanece reservado à certificação física/Preview HTTPS e não foi artificialmente promovido a PASS.

**MOBILE-J: SKIPPED — certificação física posterior ao RC CANDIDATE/RC FROZEN/Preview HTTPS**

Não foi identificado blocker estrutural novo que impeça MOBILE-J posteriormente.

## 10. Vercel

Os status checks GitHub do RC_RUNTIME_SHA e do RC_COMPOSITION_HEAD retornam:

- contexto: `Vercel`;
- state: `failure`;
- destino: `upgradeToPro=build-rate-limit`.

A conexão Vercel disponível nesta sessão não expõe o projeto EMPROVEX, portanto RC-B não reivindica verificação direta do painel/deployment. Nenhum deploy/promote foi realizado.

**VERCEL: BLOCKED — DEPENDÊNCIA EXTERNA (build-rate-limit)**

Não é classificado como regressão funcional e não é convertido em PASS.

## 11. HARDEN-B

PR #237 permanece aberto/draft e registra:

- PITR ativo;
- delete protection ativa;
- backup diário ativo;
- retenção 14 semanas;
- backup READY ainda pendente;
- `recovery:verify` pendente por ausência do primeiro backup READY;
- restore isolado pendente e condicionado a autorização explícita.

**HARDEN-B: BLOCKED — DEPENDÊNCIA TEMPORAL EXTERNA / RISCO DE PRODUÇÃO**

Não bloqueia automaticamente a certificação técnica do RC, mas permanece risco obrigatório antes do GO produtivo.

## 12. Produção

RC-B não executou:

- merge em `main`;
- deploy/promoção Vercel Production;
- publicação das Rules RC;
- alteração de TTL;
- IAM;
- billing produtivo;
- alteração de usuários/workspaces reais;
- restore;
- migração destrutiva.

`main` foi reconfirmada em `e90f92acae1514ee5cbc6ce95fed354bc1454330`.

**PRODUÇÃO ALTERADA: NÃO**

## 13. Matriz final

| Gate | Classificação |
| --- | --- |
| Application CI | PASS |
| Core Protection | PASS |
| Recovery guardrails | PASS |
| Legal Validation | PASS |
| Production Build | PASS |
| Final TypeScript | PASS |
| Diff Hygiene | PASS |
| Rules principal | PASS |
| Rules Warehouse | PASS |
| Multi-tenant | PASS |
| External workspace | PASS |
| SESSION-CAP | PASS |
| Lifecycle | PASS |
| Billing | PASS |
| Legal Acceptance | PASS |
| warehouseAccess | PASS |
| Central | PASS |
| Scanner estrutural | PASS |
| Mobile A-I | PASS |
| Mobile-J | SKIPPED — certificação física reservada |
| Vercel Preview | BLOCKED — dependência externa |
| HARDEN-B | BLOCKED — dependência temporal externa |

## 14. Conflitos e riscos

Conflitos materiais pendentes de composição: **NENHUM identificado**.

Riscos controlados:

1. Vercel build-rate-limit impede Preview HTTPS neste momento.
2. HARDEN-B ainda não possui primeiro backup nativo READY nem restore isolado certificado.
3. MOBILE-J física permanece etapa posterior e não foi declarada PASS.

## 15. Classificação

**PASS COM RISCO EXTERNO CONTROLADO — APTO PARA DECISÃO DE RC CANDIDATE**

**RECOMENDAÇÃO AO PROGRAM CONTROL: APTO PARA DECIDIR RC CANDIDATE**

RC-B não declara `EMPROVEX RC CANDIDATE`, `RC FROZEN`, GO de produção, publicação de Rules, Preview oficial, piloto ou abertura comercial.
