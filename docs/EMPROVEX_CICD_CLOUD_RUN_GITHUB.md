# EMPROVEX — GitHub Actions + Workload Identity Federation + Cloud Run (R7 CI/CD)

**Estado inicial: PROPOSTO, NÃO ATIVADO.** Esta automação só entra em vigor quando integrada na `main`, após a PR #426 e seus checks estarem aptos, o IAM do Google Cloud estar configurado e o ambiente protegido do GitHub estar criado. Não confundir arquivos versionados com implantação autorizada. Política GOV-SIMP-01.

## Contrato operacional

`merge na main` → **Application CI (obrigatório e com sucesso)** → workflow `EMPROVEX Cloud Run — stage after Application CI` → build no runner GitHub a partir do Dockerfile já homologado → push da imagem com tag SHA completo em Artifact Registry → `gcloud run deploy --image <digest> --no-traffic` → validações de revisão, segredos preservados, URL de prévia, saúde e HTTP 401 da rota de cobrança sem autenticação. **Tráfego de produção permanece como estava.**

Após teste funcional dirigido, operador autorizado abre **Actions → EMPROVEX Cloud Run — promote approved revision → Run workflow**, informa a revisão e SHA exibidos na execução do stage, aguarda aprovação do ambiente `emprovex-production` e acompanha promoção de **100%** para a revisão exata. A promoção valida SHA ancestral da `main`, nome da revisão, estado Ready, imagem por digest no Artifact Registry e conta de serviço. Após a promoção, verifica `https://emprovex.com.br/api/health` forçando o IP do Hosting `199.36.158.100`. Se o health falhar, tenta reverter automaticamente para a revisão anterior e sinaliza falha.

**A URL de prévia marcada por tag não é um ambiente isolado:** como o Cloud Run atual permite invocação HTTP pública, qualquer pessoa com a URL pode acessá-la, embora as APIs mantenham os controles de identidade. A revisão staged usa as mesmas credenciais de runtime e os mesmos recursos produtivos do serviço. Fazer somente testes direcionados de leitura/autenticação ou testes explicitamente seguros; não executar operações financeiras ou mutações destrutivas na prévia. `0%` de tráfego impede o roteamento pelo endereço canônico, não a invocação direta pelo tag.

**Aprovação tem duas barreiras:** disparo manual do segundo workflow e `Required reviewers` no ambiente protegido. A proteção do ambiente exige configuração no painel do GitHub pelo administrador. Não executar o fluxo de promoção antes disso. O disparo manual não é uma promoção automática.

**Sem PowerShell:** nenhum comando local é necessário para cada release. O bootstrap de IAM é feito **uma única vez no Google Cloud Shell**. Sem chaves privadas JSON no GitHub, em secrets ou no repositório. `google-github-actions/auth@v3` recebe apenas o identificador público do Workload Identity Provider e o e-mail público da service account; o token OIDC é efêmero.

## Identificadores fixos da homologação

| Campo | Valor |
| --- | --- |
| GitHub | `aprov-hgesm/Controles-de-Empenhos---Aprov` |
| Repository ID imutável | `1286320615` |
| Owner ID | `298800054` |
| Projeto GCP | `gen-lang-client-0982077967` |
| Número GCP | `943599311487` |
| Região | `southamerica-east1` |
| Serviço existente | `emprovex-cloudrun-candidate` |
| SA de runtime (preservada) | `emprovex-run-runtime@gen-lang-client-0982077967.iam.gserviceaccount.com` |
| SA do deploy (nova, sem chaves) | `emprovex-github-deployer@gen-lang-client-0982077967.iam.gserviceaccount.com` |
| Workload Identity Pool | `emprovex-github` |
| Provider | `emprovex-main` |
| Artifact Registry | `southamerica-east1-docker.pkg.dev/gen-lang-client-0982077967/emprovex/emprovex` |

O WIF limita o token ao **repository ID + owner ID + branch main + dois paths exatos dos workflows**. Não permite credenciais provenientes de forks, PRs ou workflows de teste. A conta de deploy recebe apenas `roles/artifactregistry.writer` no repositório de imagens, `roles/run.developer` no serviço Cloud Run e `roles/iam.serviceAccountUser` na identidade de runtime. Não conceder `roles/owner`, `roles/editor`, `roles/run.admin`, `roles/secretmanager.secretAccessor` nem `roles/iam.serviceAccountKeyAdmin` ao deployer.

## Preparação única (exige conta com IAM administrativo no GCP)

1. Revisar e certificar a PR #426 e esta PR de automação. **Preparar WIF e a aprovação GitHub antes do merge final em `main`**, para que o primeiro workflow automático não falhe por falta de IAM. O preparo não publica revisão nem concede tokens a branches de PR.
2. Acessar `https://console.cloud.google.com/cloudshell` com o projeto `gen-lang-client-0982077967` selecionado.
3. Executar no **Cloud Shell**, não no PowerShell do Windows:

   ```bash
   git clone --depth=1 --branch feat/cloud-run-r7-github-oidc-cicd-20261031 https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov.git emprovex-ci
   cd emprovex-ci
   bash ops/bootstrap-github-oidc-cloud-shell.sh
   ```

   O script confere número do projeto, runtime Cloud Run, pede a confirmação `CONFIGURAR-WIF`, ativa APIs necessárias, cria de modo idempotente pool/provider restritos, deployer SA e repositório Artifact Registry, depois concede apenas os acessos indicados. **Não altera DNS, segredos, Firebase Hosting, Rules, cobrança, Cloud Run revision/traffic.** Em IAM preexistente incompatível, abortar em vez de flexibilizar a política.

4. No GitHub, usuário com direito de administração abre **Settings → Environments → New environment** e cria `emprovex-production`. Em **Deployment protection rules** selecionar **Required reviewers**, com usuário `Moriark` (ou o revisor autorizado). Configurar restrição de deployment para somente branch `main`. Para aprovação pelo próprio operador, **não selecionar Prevent self-review**; se houver segundo revisor, habilitar essa opção é preferível. Salvar a proteção. O repositório é público, compatível com required reviewers nos planos suportados pelo GitHub.
5. Revisar a proteção da branch `main`: exigir checks relevantes (Application CI e Core Protection) e bloqueio de merge quando falham, além de revisão para alterações em `.github/workflows` e `ops/`. A conexão disponível do GitHub não tem permissão de administração e **não configura esses controles automaticamente**.
6. Depois de IAM e ambiente protegidos: integrar a PR #430 na branch da #426, verificar CI da #426 e só então fazer o merge na `main`. Na primeira execução, revisar logs do stage antes de promover. Confirmar nome de revisão `emprovex-cloudrun-candidate-g<SHA12>-<RUN_NUMBER>`, preview e `0%` de tráfego de produção, além de `HTTP 200` na saúde e `HTTP 401` sem token em `/api/billing/portal`. Executar o fluxo manual com SHA completo/revisão fornecidos no resumo.

Não criar `GOOGLE_APPLICATION_CREDENTIALS` como secret, não importar service-account JSON e não copiar as 11 referências do Secret Manager para o GitHub. O runtime conserva as próprias credenciais nativas e configurações já presentes no serviço.

## Como operar uma release

1. Revisar PR → Fast CI, Core Protection, Application CI e outros checks aplicáveis → **merge `main`**.
2. Quando Application CI do **push main** finalizar com sucesso, o workflow **stage** compila e cria uma **nova revisão sem tráfego**. No log/resumo, copiar `REVISION`, `Main SHA` e `Preview`. Se o CI falhar, o stage **não** roda. Se `main` avançar enquanto o build ocorre, o job aborta.
3. Testar a URL de prévia e caminhos alterados (auth, cobrança, estoque, NF etc. conforme o risco). Somente após validação, executar **promote approved revision** na branch `main` e informar `revision` + `source_sha`. Aprovar no ambiente protegido em **Review deployments → Approve and deploy**.
4. Conferir resumo da promoção: nova revisão 100%, anterior preservada, domínio oficial HTTP 200. Se o teste pós-release falhar, o workflow tenta retornar ao revision anterior.

### Rollback sem PowerShell

A revisão anterior é registrada no resumo da promoção. Para rollback de código, usar **Google Cloud Console → Cloud Run → serviço `emprovex-cloudrun-candidate` → Revisions → Manage traffic**, apontando 100% para a revisão antiga. Exigir autorização operacional e conferir o health. Rollback **não desfaz** transações, dados Firestore, faturamento nem Rules. Não alterar DNS e não retornar à Vercel por rotina.

## Falhas esperadas e resolução

- **WIF 403 / credenciais não adquiridas:** verificar bootstrap, condição restrita ao repository ID, `workflow_ref`, projeto, e propagação IAM (alguns minutos). Nunca substituir por chave JSON.
- **Artifact Registry permissão negada:** conferir `artifactregistry.writer` somente no repositório `emprovex`; evitar `artifactregistry.admin` de projeto.
- **Cloud Run 403:** conferir `run.developer` no serviço e `iam.serviceAccountUser` sobre `emprovex-run-runtime`.
- **Revisão criada sem health:** **não promover**. Diagnosticar erro da revisão; versão em produção permanece no tráfego anterior.
- **Environment sem Required reviewers:** **não usar o workflow de promoção até configurar**. O `workflow_dispatch` é sempre manual, mas a proteção adicional precisa existir de fato.
- **`main` avançou / SHA divergente:** não promover usando referência imprecisa. Usar candidate do SHA homologado ou reexecutar o fluxo com commit mais novo.
- **Custos:** GitHub Actions runner, Artifact Registry (storage/rede) e revisões Cloud Run podem gerar cobrança. Não existe garantia de deploy gratuito ou cota diária ilimitada.

**Não migrado pelo CI/CD:** cron `/api/cron/usage-snapshot`, Firebase Hosting, domínio, certificados, Firestore Rules, Secret Manager, políticas de cobrança, workspaces e Vercel contingencial. A migração de cron continua separada para impedir execução duplicada.

Referências técnicas: [google-github-actions/auth](https://github.com/google-github-actions/auth), [WIF para pipelines](https://docs.cloud.google.com/iam/docs/workload-identity-federation-with-deployment-pipelines), [Cloud Run deployment](https://docs.cloud.google.com/run/docs/deploying) e [GitHub environments](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments).
