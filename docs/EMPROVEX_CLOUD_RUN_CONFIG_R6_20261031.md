# EMPROVEX — R6 / Transferência segura das configurações restantes

**SITUAÇÃO: PREPARAÇÃO EM PR DRAFT. NÃO MESCLAR NA MAIN. NÃO FAZER DEPLOY SEM AUTORIZAÇÃO.**
Este fluxo é provisório; a produção deve continuar funcionando na Vercel.

## R5 encerrada

- A transferência da R4 gravou exatamente três credenciais InfinitePay no Secret Manager em São Paulo (versão 1 ENABLED) e revogou a identidade de migração.
- A R5.3 confirmou que `emprovex.com.br` e o alias padrão apontam para o deployment homologado `dpl_EEm5C5DC4ickXDtevHj5ztL66BkY`.
- A PR R4 não deve ser mesclada nem seu deployment promovido.

## Escopo exato: oito variáveis inventariadas na Vercel Production

| Variável na Vercel | Novo Secret Manager | Atenção |
|---|---|---|
| `EMPROVEX_BILLING_QA_WORKSPACE_ID` | `emprovex-billing-qa-workspace-id` | ID de QA |
| `EMPROVEX_BILLING_RULES_CERTIFIED` | `emprovex-billing-rules-certified` | preservar valor exato |
| `EMPROVEX_BILLING_ENFORCEMENT_ENABLED` | `emprovex-billing-enforcement-enabled` | bloqueio financeiro |
| `INFINITEPAY_BILLING_PILOT_WORKSPACE_ID` | `emprovex-infinitepay-billing-pilot-workspace-id` | ID do piloto |
| `INFINITEPAY_BILLING_SCOPE` | `emprovex-infinitepay-billing-scope` | política de escopo |
| `INFINITEPAY_BILLING_ENABLED` | `emprovex-infinitepay-billing-enabled` | ativação de cobrança |
| `EMPROVEX_BILLING_PUBLIC_ORIGIN` | `emprovex-billing-public-origin` | origem atual; reavaliar antes do corte |
| `INFINITEPAY_HANDLE` | `emprovex-infinitepay-handle` | identificação pública do recebedor |

Esses oito valores serão copiados *exatamente como* a Vercel os fornece ao build, sem transformações e sem saírem em logs. Inicialmente ficam em cofres individuais, permitindo ao futuro Cloud Run consumi-los por env vars de Secret Manager sem escrever arquivos de configuração com credenciais. Isso pode gerar pequena cobrança de armazenamento das versões além da franquia gratuita.

**Não reutilizar a ponte R4; não reativar sua identidade, pool ou provider.**

As outras três variáveis `FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON`, `EMPROVEX_GCP_MONITORING_CLIENT_EMAIL` e `EMPROVEX_GCP_MONITORING_PRIVATE_KEY` **não serão copiadas**. Elas dependem de adaptação do código para usar identidade gerenciada e permissões adequadas; não remover credenciais Vercel antes da homologação. Outras variáveis encontradas no código (como `CRON_SECRET`, `APP_URL`, `NEXT_PUBLIC_*`, OAuth e limites) precisam de inventário e validação antes de considerar o Cloud Run pronto.

## Entrega técnica da branch

- `scripts/cloud-run-config-bridge-r6.mjs`: job **somente no build**, sem rota pública. Valida `VERCEL_ENV=production`, issuer/audience/subject OIDC exatos, token e confirmação do build. STS valida autenticidade antes de credenciar a conta migradora. Confere todos os cofres sem versões antes da primeira gravação e copia oito valores em sequência.
- `scripts/cloud-run-config-bridge-r6.test.mjs`: testes locais sem credenciais reais.
- `ops/prepare-gcp-r6-wif.ps1`: cria oito cofres regionais vazios (São Paulo) e identidade de migração própria `emprovex-r6-migrator` com permissões apenas sobre os oito cofres.
- `vercel.json`: comando de build adicional **somente nesta branch**. Não promover ou mesclar.

Não há garantia de atomicidade: se a escrita falhar após um ou mais cofres, **não repetir** antes de diagnosticar. Os outros cofres não devem receber valores duplicados.

## Fase A — preparação, sem transferência

1. Clonar apenas a branch `ops/vercel-gcp-config-bridge-r6-20261031` em pasta nova.
2. `node --test scripts/cloud-run-config-bridge-r6.test.mjs`.
3. `node scripts/cloud-run-config-bridge-r6.mjs` deve registrar `R6_BRIDGE: SKIPPED`.
4. Rodar com PowerShell autorizando `RemoteSigned` apenas durante a sessão: `& .\\ops\\prepare-gcp-r6-wif.ps1`.
5. Validar IAM/versões vazias e **parar para autorização da fase B**.

## Fase B — posterior, exige autorização e validação

1. No clone da branch R6, fazer `vercel link --yes --project controles-de-empenhos-aprov --scope aprov-hgesms-projects`.
2. Verificar `git status`, branch, commit e oito cofres ainda vazios.
3. Executar **uma única vez**, em build isolado, autorização de build não persistente:
   `vercel deploy --prod --skip-domain --archive=tgz --logs --build-env EMPROVEX_R6_TRANSFER_CONFIRMATION=EMPROVEX_R6_TRANSFER_20261031 --scope aprov-hgesms-projects`
4. Não promover nem usar deployment para testes financeiros; conferir oito versões `ENABLED` em Google Secret Manager. Não expor valor, token, nomes de clientes ou hashes dos segredos.
5. **Risco observado na R4:** mesmo com `--skip-domain`, o alias padrão `.vercel.app` migrou para o deployment temporário; após o build, restaurar imediatamente o alias padrão para o deployment homologado, verificar `emprovex.com.br` e `/api/health`.
6. Desativar a conta migradora `emprovex-r6-migrator`, provider R6, remover os bindings de Secret Manager e workloadIdentityUser. Preservar valores na Vercel e na GCP.
7. Ao configurar Cloud Run, fazer mapping dos oito `SECRETS:version` de forma explícita, sem executar pagamentos em homologação. A origem `EMPROVEX_BILLING_PUBLIC_ORIGIN` e callback InfinitePay devem permanecer na produção Vercel até o corte controlado.

## Política

- Não apagar segredos GCP criados.
- Não alterar variáveis de cobrança Vercel.
- Não transferir dados Firestore nem tocar na identidade de execução Cloud Run.
- Não lançar cobrança de teste fora do procedimento financeiro oficial.
- Nenhum segredo/token entra no GitHub nem no chat.
