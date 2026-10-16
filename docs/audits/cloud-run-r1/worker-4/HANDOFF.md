# Worker 4 — CLOUD-RUN-R1 — Handoff (15/10/2026)

**PREPARAÇÃO PARCIAL — DEPENDÊNCIAS EXTERNAS/TESTES PENDENTES. MIGRAÇÃO NO-GO.**

## ONDE ESTAMOS
- Repo: aprov-hgesm/Controles-de-Empenhos---Aprov
- Baseline main: 2b1241fe3abd96c67766caf065d24a4b2a223b98 (verificada).
- Branch própria: feat/cloud-run-r1-w4-local-preparation; entrega em PR DRAFT contra main.
- PRs #286 e #289 continuam DRAFT e não fazem parte automaticamente da main.
- Nenhuma alteração de produção, Vercel, Firebase, Firestore real, IAM, Rules, DNS, cron, billing ou Cloud Run.

## O QUE ESTAMOS FAZENDO
Implementamos guardas locais opt-in para build Cloud Run, bloqueio de runtime Cloud Run ainda não certificado, transporte de OAuth access token via identidade gerenciada no servidor de metadados e caminhos alternativos em consumidores administrativos. O caminho JSON legado da Vercel foi preservado.

### Reconciliação semântica de #286/#289

| Origem/arquivo | Diferença | Decisão | Prova/justificativa |
|---|---|---|---|
| #286 app/page.tsx | Drawer do freeze antigo; main tem UI posterior | Não aplicar patch | Diff do PR #286 |
| #286 rota intake | Tratamento de erro em rota antiga adm-deposito | Reavaliar em rota central-depositos | Diff do PR #286; não regredir Warehouse |
| #289 lib/firebaseEnvironment.mjs | Detector baseado em VERCEL_ENV; JSON Admin exigido | Reaproveitar testes/conceitos, não cherry-pick | Cloud Run usa K_SERVICE, identidade gerenciada |
| #289 lib/firebaseRuntimeConfig.ts | Config comum client/server/bancos em branch antiga | Necessário reconciliar posteriormente | Main ainda importa Firebase baseline estática |
| #289 next.config.ts | Preview fail-closed; não cobre Cloud Run | Novo build guard próprio | lib/cloudRunIsolation.mjs e next.config.ts |
| #289 testes | Casos negativos aproveitáveis | Testes próprios de isolamento/ADC | Scripts W4 preparados |

### Arquivos modificados ou criados
- lib/cloudRunIsolation.mjs: valida target, projeto, app, Auth, storage, bancos e ausência de secrets; scanner de imports/literais produtivos.
- next.config.ts: invoca scanner estrito em build selecionado como Cloud Run, sem alterar fluxo legacy Vercel.
- instrumentation.ts: bloqueia startup com K_SERVICE até autorização futura e certificação de R01/R02/R04, inclusive caso o build ignore o target.
- lib/server/cloudRunManagedToken.mjs: consulta estritamente metadata.google.internal, confere projeto e e-mail real da conta gerenciada antes de solicitar OAuth access token; sem JSON privado nem chave persistente; transporte injetável.
- lib/server/sectorProvisioningAdmin.ts, firebaseAuthBackup.ts, googleCloudMonitoring.ts e globalUsageHistory.ts: seleção do token gerenciado quando Cloud Run for detectado, sem fallback para JSON produtivo.
- scripts/cloud-run-isolation.test.mjs: testes estruturais e negativos; scripts/cloud-run-managed-token.test.mjs: mocks de metadata, erro de identidade/projeto, HTTP 403, token ausente, escopo errado e rede indisponível.
- .dockerignore: proteção preventiva de segredos, logs, cache e snapshots. Dockerfile não criado.

## EVIDÊNCIAS / RESULTADOS REAIS

| Gate | Estado | Observações |
|---|---|---|
| Consulta GitHub main e PRs | VERIFICADO | Main SHA confirmado; #286/#289 lidos sem merge |
| Escrita somente branch isolada | VERIFICADO | Não houve merge/deploy |
| Testes Node mock-only | NÃO EXECUTADOS | Scripts preparados, sem checkout completo acessível nesta sessão |
| TypeScript, lint, Application CI, Core Protection | NÃO EXECUTADOS / A AFERIR | Não alegar PASS com build Next ignorando erros |
| F05/F06/F09, regras e Firestore Emulator | NÃO EXECUTADOS | Testes devem usar somente identidades e fixtures sintéticas |
| Docker build/smoke | NÃO EXECUTADO | Bloqueado até isolamento de todos os destinos |
| GCP/Firebase/IAM/Rules/DNS/Vercel produção | NÃO TOCADOS | Nenhuma credencial real acessada |
| Firestore de produção | ZERO chamadas pelo W4 | Apenas GitHub e preparação de arquivos |

## BLOQUEADORES AINDA ABERTOS
- R04: referências ao projeto produtivo e hardcodes de bancos ainda existem em outros módulos da main. O build guard bloqueia Cloud Run nesta condição, e instrumentation.ts impede startup mesmo por erro operacional. Não declarar isolamento certificado até unificar client SDK, Admin/REST, Auth e os dois bancos, com teste negativo e proibição IAM de acesso a produção.
- R01/R02: o código ADC foi preparado mas não certificado sob identidade Cloud Run, nem acompanhado de roles IAM de menor privilégio. A identidade não deve ter acesso a recursos reais; verificar posteriormente em projeto de teste exclusivo.
- Dockerfile e smoke local: não realizar antes da liberação do gate R04; .dockerignore sozinho não constitui imagem testada.
- Manter W3-R19: GET status Warehouse pode atualizar claims; não usar como smoke remoto sem análise. W3-R20: F09 multi-linha não é commit único. Cron ok:true/persisted:false não justifica alterar cron agora.

## O QUE FAZER A SEGUIR / QUEM O FARÁ
1. Worker 4 ou Coordenador: revisar patch, rodar em checkout local isolado os testes node --test scripts/cloud-run-isolation.test.mjs scripts/cloud-run-managed-token.test.mjs, npm run typecheck e gates pertinentes; registrar saídas reais e corrigir regressões.
2. Coordenador técnico: em fase futura aprovada, reconciliar config e referências de todos os módulos, F05/F06/F09, autorização workspace/UID/UG e testes Emulator. Não fazer cherry-pick automático de #286/#289.
3. Fundador/administrador: somente após nova autorização criar projeto GCP/Firebase exclusivamente de teste, dois bancos isolados, identidade gerenciada e IAM mínimo; comprovar ausência de acesso ao projeto produtivo com evidências sanitizadas, sem compartilhar segredos.
4. Coordenador/QA: somente depois validar Docker local, CI, homologação remota isolada, Scheduler/OIDC, domínio e rollback, cada etapa com autorização específica. Não promover a produção agora.

## QUEM ESTÁ FAZENDO
Worker 4: preparação em branch própria. Coordenador: revisão e decisão de gates. Fundador: autorizações administrativas futuras. **Não fazer deploy nem merge.**
