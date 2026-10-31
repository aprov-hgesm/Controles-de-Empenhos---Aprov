# EMPROVEX — Gestão Logística e Financeira

**Hospedagem oficial desde 31/10/2026:** Google Cloud Run, em São Paulo, publicado em **https://emprovex.com.br** através do Firebase Hosting. A Vercel é mantida somente como contingência de reversão e referência histórica.

## Arquitetura

Registro.br DNS (A: `199.36.158.100`) → Firebase Hosting (`emprovex-cloudrun-943599311487`, certificado TLS gerenciado) → Cloud Run (`emprovex-cloudrun-candidate`, `southamerica-east1`) → Firebase Auth, Firestore, Google Drive e InfinitePay.

O serviço executa Next.js standalone em Docker, com a identidade de serviço `emprovex-run-runtime@gen-lang-client-0982077967.iam.gserviceaccount.com`, sem chave privada de service account no contêiner. `allUsers: roles/run.invoker` libera a entrada HTTP; as autorizações de Firebase/workspace permanecem na aplicação.

## Fonte de verdade

- [Memorial Oficial](docs/EMPROVEX_MEMORIAL_OFICIAL.md): estado produtivo vigente e histórico preservado.
- [Procedimento de publicação Cloud Run](docs/EMPROVEX_RELEASE_CLOUD_RUN.md): **único fluxo canônico** para novas releases.
- `ops/release-emprovex-cloud-run.ps1`: `-Status`, `-Stage` (nova revisão sem tráfego), `-PromoteRevision` e `-RollbackRevision`. Requer autorização explícita, projeto e identidade corretos.
- `scripts/audit-cloud-run-legacy.mjs`: auditoria rápida de dependências acidentais da Vercel no runtime.
- [Registro técnico da migração](docs/EMPROVEX_CLOUD_RUN_CUTOVER_GO_20261031.md).

**Não usar `vercel deploy` nem `vercel promote` para novas versões em `emprovex.com.br`.** `vercel.json`, seus guards e credenciais legadas fora do Cloud Run permanecem apenas para contingência. Não publicar automaticamente por Git sem decisão explícita. O cron legado não foi migrado e não deve ser duplicado.

Este repositório contém módulos históricos e planos em andamento que não ficam automaticamente publicados ao serem modificados no GitHub. Sempre distinguir `main` integrada, revisão Cloud Run ativa, PR DRAFT e documentação.
