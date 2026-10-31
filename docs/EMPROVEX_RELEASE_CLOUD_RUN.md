# EMPROVEX — Publicação oficial no Google Cloud Run (PowerShell)

**VIGENTE desde o corte DNS de 31/10/2026.** Este documento substitui, para novas versões, o procedimento `docs/EMPROVEX_RELEASE_POWERSHELL.md`, que passa a registrar somente o método histórico Vercel e o rollback. Fonte: [Memorial Oficial](./EMPROVEX_MEMORIAL_OFICIAL.md). Diretriz: **GOV-SIMP-01**, segurança essencial com o menor número de etapas.

## 1. Arquitetura em produção

`emprovex.com.br` (DNS no Registro.br, registro A = `199.36.158.100`) → **Firebase Hosting** (site `emprovex-cloudrun-943599311487`, SSL ativo) → rewrite de todas as rotas → **Cloud Run** (`emprovex-cloudrun-candidate`, `southamerica-east1`) → Firebase Authentication / Firestore / Google Drive / InfinitePay.

- Projeto Google Cloud/Firebase: `gen-lang-client-0982077967` (número `943599311487`).
- Identidade de execução: `emprovex-run-runtime@gen-lang-client-0982077967.iam.gserviceaccount.com`. **Não** instalar chaves JSON de contas de serviço no Cloud Run; usar tokens da identidade anexada.
- O Cloud Run é invocável publicamente (`allUsers: roles/run.invoker`) **apenas na camada HTTP**; a autenticação Firebase e a autorização por conta/workspace nas APIs permanecem obrigatórias. A rota `/api/billing/portal` sem token respondeu `401 BILLING_AUTH_REQUIRED`.
- Segredos de cobrança: **11 referências versionadas do Secret Manager**, sem valores em Git, em comandos ou em logs. `EMPROVEX_SHARED_BILLING_ENABLED` ausente também na Vercel de origem, portanto não ativar rateio por iniciativa própria.
- Cron `/api/cron/usage-snapshot`: definição legada no `vercel.json`, **não migrada para Cloud Scheduler**. `CRON_SECRET` não foi encontrado na listagem da produção Vercel de 31/10; não declarar o cron funcionando sem verificação específica. Nunca criar dois agendamentos simultâneos.
- Google Drive: autorização OAuth para `https://emprovex.com.br` permanece no cliente configurado. Firestore Rules, workspaces e dados **não** migram junto com o hosting.
- Vercel `aprov-hgesms-projects/controles-de-empenhos-aprov` é **contingência**, não destino de novas publicações. `vercel.json` continua desabilitando deploy Git automático; não apagar antes de descomissionamento aprovado.

**Evidência de corte:** Firebase retornou `OWNERSHIP_ACTIVE` e `CERT_ACTIVE`; DNS autoritativo `a.sec.dns.br` e `c.sec.dns.br` passou a `199.36.158.100`; `curl.exe --resolve emprovex.com.br:443:199.36.158.100 https://emprovex.com.br/api/health` retornou **HTTP 200**, `Server: Google Frontend`, sem falha de TLS. Na última observação, o resolvedor `8.8.8.8` ainda estava com IP antigo em cache; **não declarar propagação global concluída**. Referência ao teste: 31/10/2026 10h19 BRT.

## 2. Fonte e implantação de novas versões

**Somente após a PR ser integrada na `main`**. Não deduzir que a revisão atual já corresponde à `main`: a revisão do corte foi construída a partir do código homologado na branch de migração (PR #426), e a PR ainda era DRAFT no registro deste documento.

Contrato de publicação: **um SHA validado de `main` → uma nova revisão Cloud Run SEM tráfego → verificação rápida → atualização de tráfego de 100% → confirmação via domínio → manter revisão anterior para rollback.** Uma nova revisão não precisa alterar DNS, Hosting, certificados, IAM, segredos nem Rules. Builds e revisões podem gerar custos.

No PowerShell do proprietário, clone/pasta limpa com `main` já integrada:

~~~powershell
$ErrorActionPreference = 'Stop'
Set-Location "$HOME\EMPROVEX-R7-IDENTITY"
git fetch origin main
git checkout main
git pull --ff-only origin main
git status --short
git rev-parse HEAD

# Leitura do estado do serviço, sem alteração:
powershell.exe -NoProfile -ExecutionPolicy RemoteSigned -File .\ops\release-emprovex-cloud-run.ps1 -Status

# Autoriza UM build remoto pelo Dockerfile/Cloud Build, SEM mudar o tráfego:
powershell.exe -NoProfile -ExecutionPolicy RemoteSigned -File .\ops\release-emprovex-cloud-run.ps1 -Stage
~~~

O script `ops/release-emprovex-cloud-run.ps1` verifica projeto, identidade de execução, invocação pública, nomes das variáveis financeiras e árvore Git limpa. O `-Stage` exige `main`, pede confirmação, publica revisão com `gcloud run deploy --source ... --no-traffic --tag r<SHA12>` e exibe `REVISAO_CRIADA` e `URL_PREVIA` (se disponibilizada). **Não sobrescreve as 11 referências existentes nem configura novas variáveis no deploy.** Não repetir build quando apenas a consulta de status falhar. Se a revisão não for criada, corrigir causa objetiva.

## 3. Verificação mínima e promoção

- Conferir a nova `REVISAO_CRIADA` e sua URL marcada; para prévia, verificar `/api/health` e somente a funcionalidade tocada pelo commit, conforme risco. As homologações completas anteriores não são repetidas sem alteração relevante.
- Registrar o identificador da revisão antiga de 100% de tráfego exibido pelo `-Status`; **esta é a forma imediata de rollback**, sem trocar o DNS.
- Promover a revisão específica com autorização explícita:

~~~powershell
$rev = 'SUBSTITUA_PELA_REVISAO_CRIADA'
powershell.exe -NoProfile -ExecutionPolicy RemoteSigned -File .\ops\release-emprovex-cloud-run.ps1 -PromoteRevision $rev

# Verificar exclusivamente a rota pública da versão servida:
curl.exe -i --max-time 20 --resolve emprovex.com.br:443:199.36.158.100 https://emprovex.com.br/api/health
~~~

Aceite: revisão correta com **100% do tráfego** no Cloud Run, `/api/health` HTTP 200, TLS válido e `Server: Google Frontend`. Em alterações de autenticação, faturamento, cobrança, webhook, Firestore Rules ou estoque, adicionar somente o teste direcionado do fluxo alterado. Assegurar que `https://emprovex.com.br` continue sendo a origem do checkout/webhook. A revisão anterior fica disponível.

## 4. Retorno (rollback) e contingência

**Preferir rollback entre revisões do Cloud Run**. É mais rápido e não requer modificar o Registro.br:

~~~powershell
$anterior = 'SUBSTITUA_PELA_REVISAO_ANTERIOR'
powershell.exe -NoProfile -ExecutionPolicy RemoteSigned -File .\ops\release-emprovex-cloud-run.ps1 -RollbackRevision $anterior
~~~

Rollback de revisão **não desfaz** escritas no Firestore, transações financeiras ou regras. Só para indisponibilidade do projeto Google, e com decisão explícita, avaliar o retorno DNS ao registro A histórico Vercel `216.198.79.1`, lembrando dos caches DNS, OAuth, webhooks e cron. Preservar Vercel sem novos deploys por rotina.

## 5. Guardrails permanentes

1. **Não executar** `vercel deploy`, `vercel promote`, `vercel build` ou `vercel --prod` para lançar código no domínio oficial.
2. **Não publicar automaticamente** no Cloud Run por commit/merge sem uma política específica aprovada. `git push` não equivale a deploy.
3. **Não refazer** DNS `199.36.158.100`, SSL ou Hosting a cada versão; a revisão do mesmo serviço é suficiente.
4. **Não registrar** valores de segredos. A implantação usa a identidade da revisão, sem `FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON` e sem chave de Monitoring dedicada.
5. **Não executar** em duplicidade o cron. Sua migração para Cloud Scheduler será tarefa operacional separada, quando a origem for identificada e o `CRON_SECRET` for estabelecido.
6. **Não remover** a Vercel antes de uma decisão consciente de descomissionamento com plano para cron e reversão.

**Evidências históricas**: [Corte Cloud Run](./EMPROVEX_CLOUD_RUN_CUTOVER_GO_20261031.md), [Homologação integrada](./EMPROVEX_CLOUD_RUN_HOMOLOGACAO_INTEGRADA.md), [Release antigo Vercel](./EMPROVEX_RELEASE_POWERSHELL.md). O histórico é preservado; as instruções históricas não se aplicam a novas publicações.
