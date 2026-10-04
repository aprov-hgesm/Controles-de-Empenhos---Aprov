# EMPROVEX RC R1 — COMPOSIÇÃO RC-A

Data: 2026-10-04

## 1. Identidade

- Worker: RC-A — COMPOSIÇÃO DO RC ÚNICO SaaS + Mobile.
- Branch: `rc-r1-a-composition`.
- RC_SHA técnico certificado nesta frente: `54e60c2264588d8802a67a4cab3d875d64f6bfc1`.
- PR: #249 — DRAFT / aberto / não mergeado.
- Base SaaS congelada: `2c1eee759ea8024c296b4c6968ed935b9a59e880`.
- Fonte Mobile congelada: `7b7717b6eebabf911310d2b8ac56ed13c9cb9238`.
- Produção de referência: `main@e90f92acae1514ee5cbc6ce95fed354bc1454330`.
- Produção alterada: NÃO.

## 2. Estratégia de composição

O RC-A usou a árvore do SaaS congelado como source of truth e fez composição semântica. Não houve merge cego da branch Mobile, rebase ou alteração de `main`.

Do ancestral comum `71ed87932f17b8acd9fab9c30006970b59079c42`, foram identificados 82 caminhos Mobile-only e 22 caminhos modificados pelas duas linhas. Os 82 Mobile-only foram incorporados; 81 permanecem byte a byte idênticos ao Mobile congelado. O único ajuste é documental: `docs/CENTRAL_MOBILE_R1_PLANO_MESTRE.md` teve uma linha vazia extra no EOF removida para satisfazer `git diff --check`.

Os documentos Mobile obrigatórios não existiam no HEAD SaaS e, conforme o prompt, foram lidos/importados a partir do HEAD Mobile congelado como equivalentes canônicos: `docs/CENTRAL_MOBILE_R1_INTEGRATION_STATUS.md` e `docs/CENTRAL_MOBILE_R1_COORDENADOR_HANDOFF.md`.

## 3. Superfícies compartilhadas e resolução

| Superfície | Situação | Resolução RC-A |
| --- | --- | --- |
| Auth / Legal / billing / operational data | blobs críticos idênticos entre fontes | preservado sem delta |
| SESSION-CAP | Mobile carregava por ancestralidade versões antigas de capacity/lease/admin | preservadas integralmente as versões SaaS pós SESSION-CAP |
| `firestore.rules` | Mobile = `57a139...`; SaaS RC = `bc91185...` | preservado SaaS auditado; delta Mobile rejeitado como regressão |
| `firestore.warehouse.rules` | candidato auditado comum | preservado `6e1f105...` |
| `WarehouseProtectedSurface.tsx` | delta Mobile compatível necessário ao shell móvel | incorporado `WarehouseAccessBoundary`, mantendo serviço de sessão SaaS |
| `next.config.ts` | SaaS bloqueava câmera; Mobile materializava CT-01 | incorporada CT-01 exata |
| `package.json` / lockfile | SaaS tinha hardening PDF; Mobile tinha ZXing e scripts Mobile | união mínima sem downgrade do hardening |
| Application CI | Mobile adicionava gates Mobile ao pipeline compartilhado | composição aditiva; nenhum gate SaaS removido |
| docs SaaS compartilhados | divergentes por cronologia | mantida versão SaaS vigente conforme precedência documental |
| scripts SaaS específicos | divergentes por cronologia | mantida versão SaaS vigente |

## 4. CT-01

Contrato materializado:

`camera=(self), microphone=(), geolocation=()`

Fonte efetiva: `next.config.ts`. A inspeção do candidato confirmou que `vercel.json` contém somente cron e que não existe middleware concorrente na árvore. Nenhuma permissão adicional foi aberta.

## 5. Rules e hashes

- `RULES_MAIN_PROD=0d990b7de0b2e85ed55fe14ec0d2ce29b3635299`
- `RULES_MAIN_RC=bc91185f34bcdcb4437a4de1078d1089a09292ba`
- `RULES_WAREHOUSE_PROD=b5325fe5a8cbe9b0ade8568d35a2cd678ce6e0f2`
- `RULES_WAREHOUSE_RC=6e1f1050005314db4e17cb3136409abbddb0ee91`
- `NEXT_CONFIG_HASH=a67a5f7855409185b72bdb2c392a6523d870b2e8`
- `PACKAGE_JSON_HASH=d1dc0827e6e4761baa82cffb10e7efac8e83c32d`
- `PACKAGE_LOCK_HASH=7c1ecd0dc074b8924c25123955f70e0ba10675dd`
- `APPLICATION_CI_HASH=ca7258ca7d76f929dfaf18b7c8f5f2f3406dd2fc`

## 6. Package / lockfile

O resultado preserva `jspdf ^4.2.1` e `jspdf-autotable ^5.0.8` do hardening SaaS, acrescenta `@zxing/browser ^0.1.5` e `@zxing/library ^0.21.3` do Mobile e inclui os scripts Mobile A–I. Não foi executado `npm update`, upgrade amplo ou downgrade de segurança.

`npm ci` passou nos workflows Application CI e Legal Validation.

## 7. SESSION-CAP

O candidato preserva o contrato pós SESSION-CAP: `DEFAULT_EXTERNAL_SECTOR_SESSION_LIMIT=null`, documento dinâmico por `browserInstanceId`, `slot-1`/`slot-2` apenas legado, lease 30 min, heartbeat 15 min, revogação administrativa e painel admin.

Blobs críticos preservados do SaaS:

- `lib/platformCapacity.ts=ccc754e18e9be6251b9e2785cd1169fbef818998`
- `lib/platformSessionLease.ts=1711b381da8b9973210c989b6afa6d162574c5c6`
- `lib/platformSessionControl.ts=e350e3e1cf1e43444017bc59ab17e218aa066837`
- `lib/platformAdminSessions.ts=34662647638f621f74d83a24bc17acb67422f66e`

Os guards Block 16.0/16.1/16.2/16.3, 17.1/17.2 e o E2E integrado aplicável passaram no Application CI #961. O Browser E2E especializado SESSION-CAP permanece com a evidência certificada anterior registrada no handoff de SESSION-CAP; não foi substituído por inferência.

## 8. Mobile A–I

O candidato contém as rotas `/central-mobile`, `/alocar`, `/transferir`, `/inventario`, `/saida` e `/conferir`, os componentes/repos Mobile e os scripts de validação A–I. No Application CI #961 passaram scanner, Integration 1/2/3, consulta física, intake allocation, inventário, outbound, position check e o guard final MOBILE-I.

MOBILE-J não foi executada por RC-A. Android/iPhone físicos, Code128 físico, câmera real, som/vibração, perda de rede e jornada física ponta a ponta continuam reservados ao Preview HTTPS oficial após a decisão de freeze.

## 9. Gates executados no RC_SHA

| Gate | Resultado |
| --- | --- |
| Application CI #961 | PASS / SUCCESS |
| Production build dentro do Application CI | PASS |
| TypeScript final | PASS |
| Diff hygiene | PASS |
| EMPROVEX Core Protection #248 | PASS / SUCCESS |
| Recovery guardrails #639 | PASS / SUCCESS |
| SAAS-DL Legal Validation #63 | PASS / SUCCESS |
| Multi-tenant Firestore | PASS |
| Central external workspace security | PASS |
| SESSION-CAP guards | PASS |
| Mobile A–I gates | PASS |
| Billing/lifecycle | PASS no Application CI |
| SAAS-C Browser Validation #52 | SKIPPED — condição do workflow |
| Vercel Preview automático | BLOCKED — build-rate-limit externo |

Observação: a primeira Legal Validation (#62) falhou exclusivamente em diff hygiene por uma linha vazia extra no EOF de um documento Mobile. O arquivo foi normalizado sem delta funcional; a repetição #63 passou integralmente.

## 10. Conflitos

CONFLITOS RESOLVIDOS:

1. Rules principal antiga na linha Mobile versus Rules RC auditada no SaaS.
2. Capacity/lease/admin session herdados no Mobile antes de SESSION-CAP versus contrato dinâmico atual.
3. Dependências Mobile versus hardening PDF SaaS.
4. CI SaaS versus gates Mobile.
5. Shell protegido Desktop versus boundary reutilizável Mobile.
6. Permissions-Policy SaaS antiga versus CT-01 exigida pelo RC.

CONFLITOS PENDENTES: NENHUM no escopo de composição.

## 11. Riscos e dependências externas

- Vercel atingiu `build-rate-limit` para o SHA final técnico; classificado como dependência externa, não como falha de build, pois os builds dos workflows GitHub passaram.
- HARDEN-B mantém dependências temporais de recovery já conhecidas pelo Program Control; RC-A não executou restore real.
- MOBILE-J e o Preview HTTPS oficial continuam posteriores à decisão de RC pelo Program Control.
- Nenhuma publicação de Rules RC, aplicação, TTL adicional, IAM, billing produtivo ou restore foi realizada.

## 12. Resultado RC-A

CLASSIFICAÇÃO: **APTO PARA RC-B**.

O SHA técnico a certificar é `54e60c2264588d8802a67a4cab3d875d64f6bfc1`. A documentação deste manifesto/handoff é adicionada em commit posterior somente documental; isso não redefine o SHA técnico certificado acima.

RC-A não declara RC CANDIDATE, RC FROZEN, GO, piloto, lançamento ou produção.

Próximo passo: RC-B certificar o SHA técnico acima e entregar sua decisão ao Program Control.
