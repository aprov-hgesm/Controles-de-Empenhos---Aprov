# W3 — Cobertura e inventário verificável
Data: 2026-10-15. Baseline main@2b1241fe3abd96c67766caf065d24a4b2a223b98. Worker 1: PR #316 (branch audit/cloud-run-r1-full-compatibility, HEAD 1a2551ac09ef1f155b27002a18119940fecb63f9), não integrado. Comparação da baseline com HEAD vivo de main: identical, 0 commits.

## Escopo mensurável
Árvore recursiva Git: **893 arquivos blob, 1.018 entradas, truncated=false**. **65/893 arquivos distintos (7,28%)** recuperados integralmente e varridos textualmente por símbolos/expressões; vários fluxos inspecionados em intervalos de linhas. Recuperar e buscar em um arquivo NÃO equivale a certificar semanticamente todas as suas linhas. Os 12 relatórios do PR #316 também foram recuperados da ref específica, fora da contagem de main.
Métodos: APIs de árvore e compare do GitHub, fetch_file com ref main explícita, inventário por path, buscas dirigidas por process.env, token, OAuth, getFirestore, REST, transações, idempotência, caches, cron, proxy e teste. Não houve clone local, AST, build, npm ci, execução de testes, navegador, acesso a consoles, secrets ou dados reais. Uma busca por símbolos no índice GitHub retornou zero resultados; **isso não prova ausência**. A tentativa de ler lib/workspaceBackupRuntime.ts retornou 404 e não está na contagem.

## Arquivos efetivamente examinados
- **Config e regras (8):** firebase-applet-config.json, firebase.json, next.config.ts, vercel.json, package.json, lib/firebase.ts, firestore.rules, firestore.warehouse.rules.
- **Workflows (4):** .github/workflows/{application-ci,emprovex-core-protection,recovery-guardrails,browser-e2e-on-demand}.yml.
- **Server (10):** lib/server/{sectorProvisioningAdmin,firebaseAuthBackup,googleCloudMonitoring,globalUsageHistory,warehouseAccess,firebaseFounderAuth,requestSecurity,sectorLifecycleAdmin,usageAlertPolicy,empenhoPdfParser}.ts.
- **APIs (12):** app/api/{central-depositos/intake-action,cron/usage-snapshot,health,admin/provision-sector,admin/auth-backup,admin/sector-lifecycle,admin/firebase-global-usage,admin/usage-alert-policy,billing/regularization,adm-deposito/intake-action,central-depositos/status,admin/delete-sector}/route.ts.
- **Warehouse (19):** lib/warehouse/{memoryReadCache,mobileTransfer,mobileTransferLotRepository,mobileOutbound,mobileOutboundRepository,intakeAllocationRepository,intakeActionClient,ledgerRepository,lotRepository,barcodeRepository,inventoryRepository,outboundRepository,movement,transfer,logisticsRepository,locationRepository,withdrawalRepository,intakeRepository,intakeStateRepository}.ts.
- **Drive/Backup (4):** lib/{googleDriveWorkspace,workspaceDriveRuntime,googleDriveFiles,workspaceBackup}.ts.
- **Runbooks (2):** docs/{SAAS_R1_OPERACAO_RECUPERACAO,BACKUP_RECOVERY}.md.
- **Scripts (6):** scripts/{mobile-r1-intake-allocation.test,warehouse-location-transfer.test,warehouse-immediate-consumption-security.test,firestore-recovery,warehouse-integrity-reconcile-readonly,verify-emprovex-warehouse-isolation}.mjs.
Contagem destas categorias: **8+4+10+12+19+4+2+6 = 65**.

## Lacunas por risco
Inventário de paths integral, inspeção focal de código. Faltam estudo profundo dos demais handlers, features de empenhos/NF/SAG/NS, UI mobile e visuais, testes dinâmicos de OAuth/headers/SSR, diferenças de PRs pendentes, amostragem de logs/latências reais, revisão de IAM/backup. Nenhum teste E2E ou prova em duas instâncias. Na árvore estão 7 workflows, 55 paths app/, 143 lib/, 178 docs/ e 13 sob tests/. Não classificar os outros 828 arquivos como auditados só por pertencerem à árvore.
**Veredito: AUDITORIA TÉCNICA CONCLUÍDA COM LACUNAS. MIGRAÇÃO NO-GO.**