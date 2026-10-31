# EMPROVEX — Transferência de segredos R4

**ESTADO: código preparado em branch descartável. NÃO MESCLAR NA MAIN. NÃO FAZER DEPLOY SEM NOVA AUTORIZAÇÃO.**

## Estado confirmado pelo proprietário

- Google Cloud: `gen-lang-client-0982077967` (número `943599311487`).
- A conta `emprovex-run-runtime@gen-lang-client-0982077967.iam.gserviceaccount.com` tem Secret Accessor **somente** para os três cofres.
- Secret Manager R4: os três cofres **não apresentam versões** (pré-verificação concluída).
- Projeto Vercel: `aprov-hgesms-projects/controles-de-empenhos-aprov`, produção **permanece ativa e inalterada**.
- Variáveis Secret de produção não são recuperáveis pelo painel/CLI, mas são disponibilizadas ao código executado pela Vercel.

## Escopo estrito

Copiar apenas três variáveis de **Production**:

| Variável Vercel | Segredo GCP |
|---|---|
| `INFINITEPAY_API_KEY` | `emprovex-infinitepay-api-key` |
| `INFINITEPAY_ORDER_SECRET` | `emprovex-infinitepay-order-secret` |
| `INFINITEPAY_WEBHOOK_TOKEN` | `emprovex-infinitepay-webhook-token` |

Não transfere credenciais Firebase/Admin ou Monitoring; essas serão migradas para identidade nativa posteriormente. Não toca em outros controles de faturamento, Firestore, contas, webhooks, credenciais atuais ou domínio.

## Implementação sem endpoint de exportação

A branch temporária contém:

- `scripts/cloud-run-secret-bridge-r4.mjs`: job de build único, sem rota HTTP, usando OIDC da Vercel + Workload Identity Federation do Google; envia valores diretamente ao REST `:addVersion` do Secret Manager sem imprimi-los.
- `scripts/cloud-run-secret-bridge-r4.test.mjs`: testes de allowlist, ambiente, OIDC e desativação por padrão.
- `ops/prepare-gcp-r4-wif.ps1`: habilita STS/IAM Credentials, cria pool + provider OIDC restritos à equipe/projeto/ambiente Production e uma **conta migradora separada** da runtime.
- `vercel.json` **somente nesta branch**: `buildCommand` executa `npm run build && node scripts/cloud-run-secret-bridge-r4.mjs`.

O job é **inativo** até a variável Config `EMPROVEX_R4_TRANSFER_CONFIRMATION` ser exatamente `EMPROVEX_R4_TRANSFER_20261030`; ainda verifica `VERCEL=1`, `VERCEL_ENV=production`, claims OIDC com emissor da equipe, audience, subject exatos e validade. O Google STS valida assinatura e autenticidade do token.

A conta migradora recebe `roles/iam.workloadIdentityUser` apenas para o sujeito `owner:aprov-hgesms-projects:project:controles-de-empenhos-aprov:environment:production`, e apenas `roles/secretmanager.viewer` (metadados) e `roles/secretmanager.secretVersionAdder` (adicionar versões) **nos três cofres**. Não tem permissão de acessar os valores existentes.

O script confere que **todos os três cofres estão vazios antes de escrever o primeiro**. Se falhar parcialmente, **não repetir**: bloquear e realizar diagnóstico de recuperação. Nenhuma chamada à InfinitePay é efetuada.

## Correção pontual R4.1 (Windows)

A primeira execução criou com sucesso o pool `emprovex-vercel-r4` e o provider `vercel-production`, mas o Google recusou a conta migradora anterior por exceder 30 caracteres. O ID corrigido é `emprovex-r4-migrator`, e a ponte usa agora o email `emprovex-r4-migrator@gen-lang-client-0982077967.iam.gserviceaccount.com`. O PowerShell trata pool/provider existentes sem recriá-los. **Nenhum segredo foi transferido nessa falha.** Execute `git pull --ff-only` na branch antes de repetir o script; NÃO use o clone antigo sem atualização.

## Preparação necessária no Windows — SEM TRANSFERIR AINDA

1. No painel Vercel, conferir que o modo do emissor OIDC é **Team** em Project Settings → Security → OIDC Federation. Emissor esperado: `https://oidc.vercel.com/aprov-hgesms-projects`.
2. Reconfirmar que os três cofres não têm versões, como na pré-verificação.
3. Em PowerShell autenticado com a conta Google pessoal, executar `ops/prepare-gcp-r4-wif.ps1`. Isso cria **somente IAM de migração**, não transfere segredos.
4. Testar sem segredos: `node --test scripts/cloud-run-secret-bridge-r4.test.mjs` e `node scripts/cloud-run-secret-bridge-r4.mjs` → `SKIPPED`.
5. **Parar aqui e pedir autorização explícita para o build/deploy isolado.**

## Execução posterior, sujeita a autorização

- NÃO criar uma variável persistente Production para ativação. Usar o parâmetro pontual `--build-env EMPROVEX_R4_TRANSFER_CONFIRMATION=EMPROVEX_R4_TRANSFER_20261030` somente no deploy isolado. Isso evita habilitar a rotina em deploys futuros.
- Em clone isolado da **branch R4**, vincular ao projeto Vercel correto. Executar **uma única vez** `vercel deploy --prod --skip-domain --archive=tgz --build-env EMPROVEX_R4_TRANSFER_CONFIRMATION=EMPROVEX_R4_TRANSFER_20261030 --scope aprov-hgesms-projects`. Isso autoriza exclusivamente o build isolado de produção, **sem promover o domínio**. Não usar `--prebuilt` (removeria token OIDC de build).
- Observar apenas `R4_BRIDGE: CREATED <cofre> version <n>` (sem conteúdo) e `R4_BRIDGE: PASS`; conferir três versões `ENABLED` via `gcloud secrets versions list`. **Não executar promote**.
- Em caso de erro, não repetir build automaticamente e não apagar versões. Inspecionar o estado de cada cofre.

## Revogação obrigatória

Após o PASS, não deve haver variável persistente `EMPROVEX_R4_TRANSFER_CONFIRMATION` na Vercel, pois somente o build teve o flag; retirar `roles/secretmanager.viewer` e `roles/secretmanager.secretVersionAdder` da conta migradora nos três cofres; remover o binding `roles/iam.workloadIdentityUser`; desabilitar provedor OIDC ou conta migradora; descartar branch R4 sem merge. Manter as três credenciais originais em produção na Vercel até o corte do Cloud Run ser homologado.

## Fontes

- https://vercel.com/docs/oidc/gcp
- https://vercel.com/docs/oidc
- https://vercel.com/docs/project-configuration/vercel-json
- https://cloud.google.com/secret-manager/docs/add-secret-version
