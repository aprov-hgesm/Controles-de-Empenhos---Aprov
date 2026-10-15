# Inventário de arquitetura e dependências — snapshot 2b1241fe3abd
Inspeção da árvore Git principal em 2026-10-15: 893 blobs e 1018 entradas, truncated=false.

## Stack e caminhos
- Web: Next 15.5.24, React/React DOM 19, TypeScript, Node 20 em GitHub Actions; package.json e .github/workflows/application-ci.yml. Bundle: next.config.ts output standalone; nenhum Dockerfile identificado no snapshot. Dependências: firebase 10, jose, jspdf/pdf-lib, motion/framer-motion, ZXing, tailwind.
- Front: app/page.tsx, app/layout.tsx, app/globals.css, features/inicio, features/empenhos, features/notas-fiscais, features/relatorios, features/warehouse, features/visual-orbs, components/admin, components/auth, components/visual.
- Rotas API em app/api: admin/{auth-backup,delete-sector,firebase-global-usage,provision-sector,reset-sector-password,sector-lifecycle,usage-alert-policy}; billing/regularization; central-depositos/{intake-action,status}; adm-deposito aliases; empenhos/parse-ne; cron/usage-snapshot; health; system-time. Cada caminho está em app/api/**/route.ts.
- Identidade: lib/firebase.ts SDK cliente, lib/server/firebaseFounderAuth.ts valida JWT Firebase via JWK remoto, lib/server/warehouseAccess.ts valida workspace externo com Firestore REST/token Firebase, lib/server/sectorProvisioningAdmin.ts provisionamento administrativo e token por chave JSON.
- Banco principal nomeado: firebase-applet-config.json campo firestoreDatabaseId, firebase.json; banco warehouse separado em firebase.json; app/api/central-depositos/intake-action/route.ts grava warehouse usando API REST e conta de serviço. Permissões distintas requerem confirmação em IAM e Rules.
- Google Drive: lib/googleDriveWorkspace.ts OAuth drive.file independente para setores externos; lib/workspaceDriveRuntime.ts token apenas na memória do navegador; lib/googleDriveFiles.ts uploads/downloads/checagem SHA; backups via lib/workspaceBackup*.ts. URLs de OAuth/proxy precisam validação.
- Observabilidade e cron: lib/server/googleCloudMonitoring.ts, lib/server/globalUsageHistory.ts, app/api/cron/usage-snapshot/route.ts; vercel.json agenda às 09:15 UTC.
- Integridade: lib/warehouse/{intakeAllocationRepository,mobileTransferLotRepository,mobileOutboundRepository,lotRepository,ledgerRepository,inventoryRepository,memoryReadCache}.ts e app/api/central-depositos/intake-action/route.ts; scripts/warehouse-*.test.mjs e suites Firebase Emulator. Revalidar multi-instância, idempotência e rollback.
- Segurança de cabeçalhos/redirects: next.config.ts linhas 7–32. Segurança de requisições: lib/server/requestSecurity.ts linhas 68–87/123–140.
- Recovery: docs/BACKUP_RECOVERY.md, docs/SAAS_R1_OPERACAO_RECUPERACAO.md, scripts/firestore-recovery.mjs; usuário final por workspace e nativo por banco separado.
- Workflows: .github/workflows/application-ci.yml, emprovex-core-protection.yml, recovery-guardrails.yml, browser-e2e-on-demand.yml, saas-c-browser-validation.yml, saas-dl-legal.yml, visual-r1-w4-qa.yml.
- Histórico: docs/EMPROVEX_MEMORIAL_OFICIAL.md registra release em main@63aad90b e política D-127; PR #315 consolida desligamento de auto-deploy; PRs de desenvolvimento anteriores não devem ser confundidos com código em main. Branches e PRs ativos não integram automaticamente esta baseline.

## Dependência Vercel → tratamento proposto
| ID | Dependência e localização | Risco | Equivalente/prova necessária |
|---|---|---|---|
| V01 | vercel.json git.deploymentEnabled=false | Alto | Não acionar deploy Git automático no novo pipeline sem aprovação |
| V02 | vercel.json cron | Crítico | Cloud Scheduler; garantir execução única e segurança |
| V03 | x-vercel-forwarded-for em lib/server/requestSecurity.ts | Alto | Gateway confiável, parsing IP e spoofing testados |
| V04 | Next SSR standalone, next.config.ts | Alto | Imagem Docker reproduzível + smoke e E2E |
| V05 | Headers/redirects Next, next.config.ts | Médio | Preservar Camera Permissions-Policy, caminhos legados, HSTS verificado |
| V06 | Domínio, proteção de deploy e preview Vercel (externo) | Alto | Firebase Hosting/rewrite/preview; dashboard Vercel e DNS auditados |
| V07 | Server env FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON | Blocker | ADC e IAM mínimo ou segredo temporário em transição aprovada |
| V08 | Cloud Monitoring credenciais privadas | Alto | ADC/read-only Monitoring + testes de cron e relatórios |
| V09 | Cache/limiter in-memory, lib/warehouse/memoryReadCache.ts; lib/server/requestSecurity.ts | Alto | Testar perda em reinício e múltiplas instâncias; nunca confiar como limite global |
| V10 | URLs de authDomain e Google login | Crítico | OAuth origins / authorized domains / redirects válidos no domínio final |
| V11 | Web analytics, logs, erros e uptime | Médio | Cloud Logging/Monitoring; monitoramento externo equivalente |
| V12 | Cache/ISR/Next image optimization | Médio | Testar consistência cross-instance, cache headers e proxy; sem supor paridade |
| V13 | Build/env NEXT_PUBLIC_ em lib/firebase.ts | Blocker | Separação build-time por ambiente e projetos Firebase |
| V14 | Armazenamento temporário/documentos | Médio | Drive permanece fonte de PDFs; nenhum disco local persistente |

## Conclusões que NÃO foram demonstradas
Não há inventário de valores reais de variáveis, contas de serviço, preços, tráfego, DNS, provedores OAuth cadastrados, projetos Cloud, SSL, serviços e gates externos. Inspeção estática não certifica que todos os handlers e jobs existentes no projeto Vercel estejam rastreados. Operação read-only dessas plataformas é requisito para a próxima etapa.
