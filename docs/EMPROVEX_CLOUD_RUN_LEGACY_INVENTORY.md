# EMPROVEX — Inventário de legados Vercel após a migração Cloud Run

**Data: 31/10/2026.** Fonte operacional: [Memorial Oficial](./EMPROVEX_MEMORIAL_OFICIAL.md). **Novas publicações exclusivamente pelo [runbook Cloud Run](./EMPROVEX_RELEASE_CLOUD_RUN.md).**

## Auditoria real de código (Fast CI — 31/10/2026)

O scanner percorreu **548 arquivos de runtime** e inicialmente sinalizou **7 referências à Vercel**, das quais somente **1 era dependência executável que impedia o guard**: `app/dev/visual-r1/page.tsx` aceitava `process.env.VERCEL_ENV === 'preview'`. Corrigido para acesso **apenas em desenvolvimento local** (`NODE_ENV=development`). O restante incluía avisos legais desatualizados, texto do laboratório e cabeçalho legado de contingência.

- `app/privacy/page.tsx` e `app/terms/page.tsx`: conteúdo legal ajustado para identificar Google Cloud Run/Firebase Hosting como provedores de produção e Vercel apenas como contingência.
- `components/visual/EmprovexVisualIntegrationPreview.tsx`: texto do laboratório já não apresenta Vercel Preview como meio atual.
- `lib/server/requestSecurity.ts`: descrição de bucket local ajustada à arquitetura Cloud Run; leitura de `x-vercel-forwarded-for` preservada antes de `x-forwarded-for` exclusivamente para compatibilidade de contingência. No tráfego Cloud Run normal, o cabeçalho esperado é `x-forwarded-for`.
- O primeiro Fast CI com o novo guard falhou de maneira legítima por causa da rota visual; o código foi corrigido em commits subsequentes. **Não marcar o Fast CI de um HEAD posterior como PASS sem verificar seu run.**

## 1. Código operacional — mudanças realizadas

| Local | Resultado |
| --- | --- |
| `next.config.ts` | Comentário de empacotamento de ícone ajustado para Next.js standalone/Cloud Run, mantendo o tracing funcional. |
| `lib/server/sectorProvisioningAdmin.ts` | Comentário revisado: Cloud Run usa a própria identidade de serviço; JWT por chave privada é fallback somente **fora** do Cloud Run. A lógica não foi removida para preservar retorno emergencial. |
| `lib/server/firebaseAuthBackup.ts` | Já usa identidade nativa no Cloud Run; mantém fallback chave/JSON apenas fora do Cloud Run. Não adicionar chaves ao serviço novo. |
| `lib/server/googleCloudMonitoring.ts` | Já usa token nativo em Cloud Run; fallback legado local/Vercel preservado. |
| `.env.example` | Define `APP_URL` público, ausência de JSON no Cloud Run, identidade do Monitoring e situação real do cron. |
| `app/api/health/route.ts` | Endpoint neutro e portátil; sem dependência Vercel. |
| `app/api/billing/portal/route.ts`, `lib/server/platformBillingAdminStore.ts`, `lib/server/platformBillingSharedStore.ts` | Contratos de autenticação/cobrança independentes do host; preservados sem reescrever lógica financeira. |
| `lib/googleDriveWorkspace.ts` | Integração do Drive não depende de Vercel; manter origem OAuth canônica HTTPS do domínio, sem alterar tokens. |
| `ops/release-emprovex-cloud-run.ps1` | Novo mecanismo de revisão do Cloud Run com `-Stage` sem tráfego, `-PromoteRevision` e `-RollbackRevision`. |
| `scripts/audit-cloud-run-legacy.mjs` | Scanner de todos os módulos `app/lib/components/features/hooks`, incluindo JS/TS/TSX. O Fast CI bloqueia dependência acidental de `VERCEL_*`, `*.vercel.app` e comandos Vercel no runtime. |

A substituição **não** foi feita com busca e troca cega de textos, pois isso poderia alterar contratos de autenticação, OAuth, preços ou histórico financeiro.

## 2. Referências Vercel mantidas intencionalmente

- `vercel.json`: mantém `git.deploymentEnabled=false` para impedir que push/merge cause deployment Vercel; também contém o cron legado `/api/cron/usage-snapshot` (09:15 UTC). O token `CRON_SECRET` não estava na lista Production da Vercel de 31/10; **cron ainda não certificado** e **nenhum Cloud Scheduler paralelo criado**.
- `scripts/vercel-manual-deploy.test.mjs` e job do Application CI: teste de **contingência**, garantindo que a Vercel não reative publicação automática. O nome do teste permanece por compatibilidade de scripts e dependências de CI.
- `docs/EMPROVEX_RELEASE_POWERSHELL.md`: marcado **histórico/contingência**, não canônico.
- `ops/cloud-run-production-candidate.ps1` e `ops/prepare-firebase-hosting-cutover.ps1`: são bootstrap histórico da migração, não ferramentas para releases futuros.
- `docs/**` e `docs/releases/**`: preservar logs, hashes, deployments e observações históricas da Vercel. Os memoriais relevantes receberam aviso de precedência do estado Cloud Run atual.
- `lib/server/sectorProvisioningAdmin.ts`, `lib/server/firebaseAuthBackup.ts`, `lib/server/googleCloudMonitoring.ts`: manter fallback não Cloud Run para contingência; o branch `isCloudRunRuntime()` garante identidade por metadata quando em Cloud Run.

## 3. Implicações operacionais

- **Cloud Run é o destino de produção.** O nome atual do serviço contém `candidate`, embora ele já atenda o domínio oficial; renomear implicaria mudar rewrites do Firebase Hosting e criar risco sem benefício imediato.
- **Firebase Hosting** é a borda HTTPS; não se deve configurar domínio direto no Cloud Run de São Paulo, nem trocar DNS a cada revisão.
- **Secret Manager:** manter 11 variáveis/segredos de cobrança e não recolocar JSON administrativo no runtime Google.
- **Cloud Scheduler:** migração futura separada do cron existente, com autenticação e prevenção de dupla execução, somente se a rotina for efetivamente necessária. A ausência de `CRON_SECRET` é um fato de ambiente, não uma tarefa de deploy web.
- **Rollback preferencial:** revisão anterior de Cloud Run, sem trocar DNS. A Vercel segue como último recurso, e seu deployment antigo não deve ser atualizado sem autorização explícita.
- **Verificações:** a PR #426 permanece DRAFT; mudanças documentais e scripts **não são deploy** da aplicação e não implicam merge ou atualização da revisão produtiva. O auditor de legados é uma proteção leve, não substitui os testes funcionais proporcionais ao risco.
