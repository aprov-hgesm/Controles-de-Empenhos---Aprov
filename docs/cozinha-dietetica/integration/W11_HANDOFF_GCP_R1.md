# W11 — Infraestrutura Firebase/GCP hospitalar isolada — Handoff R1

**Data:** 11/11/2026. **Origem:** PR Draft #551, branch `feat/cozinha-dietetica-w10-firestore-operacional`, HEAD-base conferido `9572049742d9c9bfd4cd2265e999ab083728fd56`. **Delta:** apenas a branch `feat/cozinha-dietetica-w11-infra-hospitalar-isolada`, PR Draft contra W10. **Nunca** integrar diretamente em `main`.

## 1. O que W11 implementou (código versionado, NÃO aplicação ao GCP)

- `lib/server/hospital/firebase/firestore-store.mjs`: reutiliza integralmente o repository transacional W10 (CAS/revisões, unicidade, idempotência, eventos e snapshots imutáveis, paginação) agora com transporte `gcp` explicitamente selecionado ou transporte `emulator` original. No primeiro, URL fixada a `https://firestore.googleapis.com/v1/projects/cozinha-dietetica/databases/(default)/documents`, identidade Google OAuth metadata verificada a cada requisição, sem JSON key e sem fallback para SQLite ou projetos financeiros.
- `lib/server/hospital/firebase/gcp-qa-runtime.mjs`: exige runtime Next produção **do serviço privado separado** `K_SERVICE=cozinha-dietetica-qa`, projeto GCP/Firebase `cozinha-dietetica`, service account hospitalar exata, flags explícitas, nenhum emulador e metadata IAM. Alterar apenas `NODE_ENV` ou uma flag não abre acesso clínico no Cloud Run logístico.
- `lib/server/hospital/firebase/qa-store.mjs`, `core/auth.mjs`: selecionam W10+GCP apenas com guard completo. Auth Emulator `demo-*` continua exclusivamente local; Cloud Run hospitalar verifica JWT assinado/issuer/audience/expiração e faz consulta administrativa **live** de usuário via OAuth no projeto hospitalar (`firebaseauth.users.get`), comparando `validSince` com `auth_time` e recusando disabled/revoked. Membership OM/UG/unidade continua no Firestore e a autorização continua por servidor.
- Rotas W10 de pacientes, dietas, mapas, produção e distribuição continuam usando o mesmo adaptador Firestore; produção, distribuição, auditoria nutricional, administração e relatórios receberam tratamento específico de `NODE_ENV=production` apenas para o serviço hospitalar isolado. Administração consulta existência de usuário do próprio Auth hospitalar via IAM, não do emulador. `middleware.ts` bloqueia rotas EMPROVEX financeiras, comerciais e administrativas neste serviço dedicado, mantendo apenas interface/API hospitalar e assets Next.
- `ops/hospital-w11-cloud-run-qa.template.yaml` e `ops/hospital-w11-qa-plan.mjs`: configuração declarativa **inaplicada** de serviço privado, imagem digest a definir, identidade exclusiva e validação apenas dry-run. `.github/workflows/hospital-w11-gcp-qa.yml` executa build, typecheck, regressões e Auth+Firestore Emulator; não possui credenciais GCP, Workload Identity Federation ou etapas de deploy.
- Testes `tests/hospital/firebase/w11-gcp-qa.test.mjs`: IAM isolado, tokens falsos de QA com revogação e projeto errado, lookup administrativa e operação Firestore transacional de formato GCP usando **reencaminhamento local explícito ao Emulator**, sem chamada de rede real ao GCP.

## 2. O que foi realmente aplicado ao Google Cloud

**NADA.** Sem conexão GCP autorizada com escopo de IAM, sem verificação de políticas/contas reais, nenhuma service account criada, nenhum papel concedido, nenhuma API habilitada, nenhum Cloud Run criado ou publicado, nenhum índice/Rule aplicada e **nenhuma leitura/gravação** no Firestore `cozinha-dietetica`. Evidência de conectividade IAM/Firestore real: **não executado — acesso/autorização externa**. As regras atuais `allow read, write: if false;` são informação fornecida previamente pelo proprietário, **não revalidadas por W11**.

## 3. Ações externas mínimas e separadas (ANTES de qualquer aplicação)

1. **Autorizar formalmente QA remoto com dados apenas fictícios**, projeto `cozinha-dietetica`, sem habilitar produção ou dados pessoais, e confirmar acesso GCP de leitura para conferir projeto, Firestore, Rules e IAM existentes. Não provisionar se não houver decisão de custo/quota.
2. **Com autorização específica**, criar/verificar a conta exclusiva `hospital-qa-runtime@cozinha-dietetica.iam.gserviceaccount.com` sem chave JSON. Avaliar e conceder `roles/datastore.user` **apenas no projeto hospitalar** (ou custom role mais restrita, após testar permissões) e `firebaseauth.users.get` por papel customizado/visualizador justificadamente restrito. Não conceder Owner/Editor; não associar a conta logística/Empresas.
3. **Com autorização específica**, implantar **novo serviço Cloud Run privado** `cozinha-dietetica-qa` em `southamerica-east1`, identidade acima, ingress `internal`, exigência de IAM `roles/run.invoker` para um único invocador de QA autorizado, sem `allUsers`. Usar digest de imagem buildada e conferida; configurar as envs do template e valores `NEXT_PUBLIC_HOSPITAL_FIREBASE_*` **no build** do cliente. Não criar rewrite em `emprovex.com.br`.
4. **Com autorização específica**, executar smoke test do serviço interno com token Google OIDC de invocador (header `X-Serverless-Authorization`) e Firebase hospitalar do **usuário sintético** (header `Authorization`), vínculo sintético `qa_*` server-side, testes de revogação, idempotência, concorrência, deny-all cliente, filtros e logs minimizados. Limpar só artefatos `qa_*` sob procedimento auditado. Confirmar índices antes de qualquer criação; revisar custos/backup/retenção e contingência.

**Importante:** Cloud Run IAM autentica invocação da máquina; o Firebase ID token identifica o usuário no backend. Um não substitui o outro. Ingress `internal` pressupõe invocação por workload/rede interna reconhecida; o celular/navegador externo não invoca diretamente esse serviço. A interface em produção só poderá ser exposta por frente autenticada/proxy institucional separado, após decisão no W12.

## 4. Limites, risco, rollback

- O banco `(default)` do projeto hospitalar existente não deve ser confundido com **ambiente QA físico separado**. Dados sintéticos remotos devem usar namespace OM `qa_*`, com acesso e limpeza limitados, antes de uso institucional.
- Rules de SDK cliente permanecem fechadas; IAM servidor contorna essas Rules **por design** e exige controle estrito de conta de serviço + validação OM/UG/unidade em cada API.
- `roles/datastore.user` permite acesso amplo ao Firestore do projeto. Nunca concedê-lo na identidade produtiva do EMPROVEX; custom role e revisão de IAM devem considerar a disponibilidade real das permissões. `firebaseauth.users.get` pode dar visibilidade sobre contas; limitar a identidade do projeto hospitalar.
- Limite de consultas W10: paginação, até 5000 documentos por consulta; custos reais dependem de leituras, escritas e índice. Transações com retry podem consumir mais operações. Faltam medição remota de quotas e plano institucional de backup/recuperação.
- Rollback futuro no QA: desabilitar invocador, retirar tráfego da revisão, restaurar imagem anterior ou excluir **somente** o serviço hospitalar QA autorizado. Não remover documentos clínicos ou alterar Rules durante rollback.
- O serviço privado foi preparado a partir de aplicação Next compartilhada; middleware limita rotas. Não considerar a interface pública homologada ou equivaler essa fronteira ao deploy institucional independente definitivo.
- O módulo hospitalar não modifica núcleo EMPROVEX: projetos logístico/Empresas, Cloud Run produtivo, faturamento, `main`, IAM e Rules atuais preservados por W11.

## 5. Testes e decisão

- W10: referência anterior em [workflow #43062139639](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/runs/43062139639), SHA histórico `3c88be5e9da79042d125ce8e930938e22e99ef3a` (não é prova W11).
- W11: executar `node ops/hospital-w11-qa-plan.mjs plan`, `node --test tests/hospital/firebase/w11-gcp-qa.test.mjs`, emuladores Auth/Firestore e workflow `hospital-w11-gcp-qa.yml`. **Status não presumido**: registrar resultados reais da execução CI na PR W11.
- **GO condicional para revisão do código/QA local:** somente depois que CI de W11 ficar verde.
- **NO-GO para IAM GCP real, conectividade remota, implantação QA, produção, pacientes reais e homologação clínica:** sem autorização e evidência remota.
- **W12:** homologação institucional, testes reais IAM/Firestore em QA autorizado, backup/contingência, LGPD, UI móvel, fronteira de acesso institucional e decisão de produção. Nunca inferir GO clínico de PASS no emulador.


## 6. Autorização posterior e procedimento executável de provisionamento (11/11/2026)

O proprietário **autorizou expressamente** a preparação da conta de serviço hospitalar, IAM restrito, Cloud Run privado de QA e smoke tests exclusivamente com dados fictícios, aceitando a possibilidade de custos. Essa autorização **não inclui** deploy público, escrita de pacientes reais, alteração do EMPROVEX principal ou regras clínicas.

**Execução nesta conversa:** o acesso GitHub está disponível, mas **não existe uma ação de administração do Google Cloud utilizável nesta sessão**. Por isso **nenhum comando IAM/Cloud Run/Firestore real foi executado**. O script `ops/hospital-w11-qa-cloudshell.sh` foi incluído na branch W11 para execução por operador autorizado no **Google Cloud Shell**. O CI somente valida `bash -n` sem efetuar mutação.

### Sequência mínima no Cloud Shell

1. Conferir conta de cobrança do projeto. **Cloud Run exige billing, mesmo com cota gratuita; vincular billing ao projeto Firebase Spark o muda para Blaze.** Definir alertas de orçamento antes de executar.
2. No terminal Cloud Shell autenticado como administrador do projeto hospitalar: `gcloud config set project cozinha-dietetica`. Estando no checkout da branch W11, executar `bash ops/hospital-w11-qa-cloudshell.sh plan` (somente leitura).
3. Após validar a saída, `bash ops/hospital-w11-qa-cloudshell.sh setup-iam`. Isso cria/reutiliza `hospital-qa-runtime@cozinha-dietetica.iam.gserviceaccount.com`, concede `roles/datastore.user` e `roles/firebaseauth.viewer` **somente neste projeto**, habilita Cloud Run API e **não** cria usuários/documentos clínicos.
4. **Deploy privado separado somente após a imagem hospitalar estar construída, testada e aprovada pelo SHA256 de um repositório Artifact Registry próprio:** `bash ops/hospital-w11-qa-cloudshell.sh deploy-private southamerica-east1-docker.pkg.dev/cozinha-dietetica/hospital-qa/IMAGEM@sha256:DIGEST_VALIDO`. O script recusa tags mutáveis, URLs de outros projetos, identidades divergentes, acesso público ou serviço já existente com configuração insegura.
5. **Não presumir sucesso do QA remoto com o deploy:** a revisão ainda precisa do cliente Firebase compilado com o projeto correto, invocador interno autorizado, usuários/OM de testes e smoke tests de leitura/gravação exclusivamente com dados `qa_*`, além da conferência de logs e custos. Frontend externo não acessa diretamente Cloud Run com ingress `internal`.

**Gates após executar:** coletar o project ID, billing habilitado, e-mail da conta de serviço, papéis IAM, serviço/ingress e digest de imagem, sem publicar tokens ou chaves privadas. A documentação e PR permanecem **NO-GO para Cloud GCP real** até tais resultados serem efetivamente obtidos.

**Custo:** orçamento e alertas são orientação, não limite rígido de despesas. Spark → Blaze requer vincular billing; não efetuar alterações em conta financeira do EMPROVEX principal.


## 7. Preparação da imagem Cloud Build para PowerShell (11/11/2026)

O usuário confirmou **API Cloud Run, Artifact Registry e Cloud Build habilitadas**, e **repositório Docker `hospital-qa` criado em `southamerica-east1`** no projeto `cozinha-dietetica`. A conta hospitalar `hospital-qa-runtime@` recebeu `roles/datastore.user` e `roles/firebaseauth.viewer`, e o faturamento do projeto está ativo. Estas verificações vieram das saídas do PowerShell fornecidas pelo usuário. **O serviço Cloud Run ainda não existe; imagem e smoke test remotos continuam não executados.**

**Correções pré-build nesta PR:** página de login e workspace agora aceitam **somente Cloud Run hospitalar privado** com guard GCP W11, `HOSPITAL_QA_ORGANIZATION_ID` sintético `qa_*`, app Firebase correto e opt-ins; ações de entrada e autorização do shell usam a **mesma store Firestore** do W10/W11, não SQLite, sob esse guard. Ambiente de produção normal do EMPROVEX continua fechado. Testes `tests/hospital/firebase/w11-qa-ui-gate.test.mjs` vinculados ao CI. A aplicação permanece **indisponível se `HOSPITAL_QA_ORGANIZATION_ID` e membership sintéticos não forem provisionados e `HOSPITAL_QA_APP_READY` não for ativado**.

O repositório inclui `ops/Dockerfile.hospital-qa`, `ops/hospital-w11-cloudbuild-qa.yaml` e `.gcloudignore`. O Dockerfile exige Web API key e Web App ID públicos **do projeto hospitalar**, injetados no build do Next.js (e disponíveis na etapa runner); não aceita build sem ambos. Não usar tokens de admin ou arquivos de service account.

### Comandos PowerShell para gerar a imagem (não executar antes de revisar CI W11)

```powershell
# Checkout somente do código hospitalar aprovado
git clone https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov.git "$HOME\\hospital-qa-w11"
Set-Location "$HOME\\hospital-qa-w11"
git switch feat/cozinha-dietetica-w11-infra-hospitalar-isolada
git status --short
git rev-parse HEAD

# Obter apiKey e appId do aplicativo WEB no console Firebase
# Project Settings > General > Your apps > SDK setup and configuration.
$hospitalApiKey = Read-Host 'Firebase web apiKey do projeto cozinha-dietetica'
$hospitalAppId = Read-Host 'Firebase web appId do projeto cozinha-dietetica'

# Gerar imagem com tag exclusiva do BUILD_ID e enviar ao Artifact Registry hospitalar.
# Atenção: build pode ter cobrança. Valores acima são config PUBLICA do app Web.
gcloud.cmd --account=marcoa.r.aquino@gmail.com builds submit . --project=cozinha-dietetica --region=southamerica-east1 --config=ops/hospital-w11-cloudbuild-qa.yaml --substitutions="_HOSPITAL_API_KEY=$hospitalApiKey,_HOSPITAL_APP_ID=$hospitalAppId"
Remove-Variable hospitalApiKey,hospitalAppId
```

**Pontos de verificação:** confirmar no log que a imagem foi enviada a `southamerica-east1-docker.pkg.dev/cozinha-dietetica/hospital-qa/hospital-web`, registrar **digest `sha256:...`** gerado, confirmar custo/faturamento e identidade do Cloud Build. Se houver erro de permissão de Cloud Build/Artifact Registry, **não conceder Owner/Editor**: identificar a conta efetiva e conceder somente os papéis necessários. Não executar `gcloud run deploy` antes de aprovação do digest e preparação do invocador interno/organização sintética.

**Regra de acesso:** ingresso `internal` requer chamada de infraestrutura interna autorizada (ou proxy institucional posterior). Um navegador doméstico não abrirá diretamente o Cloud Run privado. Sem `HOSPITAL_QA_ORGANIZATION_ID=qa_...`, conta e vínculo fictícios, a interface continuará fechada, deliberadamente. O build e o push da imagem **não publicam nem ativam o serviço clínico**.

## 8. Evidência de implantação real em GCP — 11/11/2026 23h28 (Brasília)

O operador executou via PowerShell o `gcloud run deploy cozinha-dietetica-qa` no projeto isolado `cozinha-dietetica`, região `southamerica-east1`, sem intervenções no EMPROVEX principal. A CLI respondeu **Deploying new service... Done**, revisão `cozinha-dietetica-qa-00001-j42`, servindo 100% do tráfego **do próprio serviço**, URL `https://cozinha-dietetica-qa-947369899527.southamerica-east1.run.app`.

Imagem implantada por digest imutável `southamerica-east1-docker.pkg.dev/cozinha-dietetica/hospital-qa/hospital-web@sha256:c91e420a1613a44216dac7949db23f9ef944eb706a68a81ecafd0b3013be6ef2`, construída via Cloud Build `dc04beca-8c10-4b9b-a39e-aff5d4237a9d`, com resultado `SUCCESS` e push comprovado. O deploy solicitou `--ingress=internal --no-allow-unauthenticated --min-instances=0 --max-instances=1 --concurrency=10 --cpu=1 --memory=512Mi` e `hospital-qa-runtime@cozinha-dietetica.iam.gserviceaccount.com`, além dos guard flags `HOSPITAL_GCP_QA_ENABLED=1`, `HOSPITAL_GCP_QA_PRIVATE=1`, `HOSPITAL_FIRESTORE_QA_ENABLED=1` e identidade/projeto fixos.

**Limite da evidência:** ainda é necessário consultar a configuração Cloud Run e política invoker no GCP, testar a negativa de acesso externo, executar smoke test autenticado por caminho interno válido e confirmar conectividade real IAM/Firestore/Auth. O deploy não incluiu `HOSPITAL_QA_ORGANIZATION_ID` sintético nem `HOSPITAL_QA_APP_READY=1`: UI e workspace devem permanecer **fechados por padrão**. Não há evidência de uso de pacientes reais ou dados clínicos. Não declarar homologação/GO clínico com base apenas no sucesso da implantação.

**Próxima verificação somente leitura:**
```powershell
gcloud.cmd --account=marcoa.r.aquino@gmail.com run services describe cozinha-dietetica-qa --project=cozinha-dietetica --region=southamerica-east1 --format="yaml(metadata.annotations.run.googleapis.com/ingress,spec.template.spec.serviceAccountName,spec.template.metadata.annotations,status.conditions)"
gcloud.cmd --account=marcoa.r.aquino@gmail.com run services get-iam-policy cozinha-dietetica-qa --project=cozinha-dietetica --region=southamerica-east1 --format=yaml
```

Parecer: **GO implantação técnica da imagem / NO-GO acesso clínico ou testes reais ainda não executados**.

## 9. Prova real de IAM e Firestore — Cloud Run Job `w11-firestore-smoke`

O operador confirmou via PowerShell que o Cloud Run Job temporário `w11-firestore-smoke` foi criado e a execução `w11-firestore-smoke-vkwld` terminou **com êxito, 1/1 tarefa concluída**, projeto `cozinha-dietetica`, região `southamerica-east1`. O script Node executado pelo Job obtém a identidade no metadata server, exige email `hospital-qa-runtime@cozinha-dietetica.iam.gserviceaccount.com`, obtém OAuth token e faz `POST .../documents:listCollectionIds` no Firestore `(default)`, com `pageSize:1` e sem gravar documentos; lança exceção e sai com status 1 em caso de erro IAM/HTTP.

**Prova da execução concluída não substitui o log do payload.** Evidência final pendente: ler Cloud Logging da execução para registrar `PASS: identidade hospitalar e leitura Firestore; HTTP 200`. Em seguida apagar somente o **Job temporário** `w11-firestore-smoke` (não o serviço `cozinha-dietetica-qa`). Firebase Authentication real, invocação interna autenticada, provisionamento de usuário/organização 100% sintéticos e QA funcional ainda não testados; acesso clínico segue fechado.

### Verificação final do Job Firestore (11/11/2026, 23h38 BRT)

Log Cloud Logging fornecido pelo operador:
```text
2026-11-12 02:38:56 PASS: identidade hospitalar e leitura Firestore; HTTP 200
```
**PASS confirmado** para identidade no metadata server, OAuth da service account `hospital-qa-runtime` e leitura real no Firestore do projeto `cozinha-dietetica` (database `(default)`). O operador executou `gcloud run jobs delete w11-firestore-smoke ... --quiet` e obteve `Deleted job [w11-firestore-smoke]`, sem remover o Cloud Run Service.

A configuração do Cloud Run foi validada: `Ready=True`, `run.googleapis.com/ingress=internal`, IAM invoker sem `allUsers` ou `allAuthenticatedUsers`; ambos `run.googleapis.com/maxScale=1` (serviço) e `autoscaling.knative.dev/maxScale=1` (revisão). Requisição de máquina externa retornou `HTTP 404`, coerente com ingresso restrito.

**Parecer W11:** GO técnico para deploy privado, leitura Firestore IAM e isolamento de rede testados; NO-GO para uso clínico (não foi feita verificação live de Firebase Auth, invocação interna autorizada, seed de organização/usuário sintéticos e testes de fluxo funcional). Sem dados de pacientes reais.

## 10. Firebase Auth IAM real — teste de consulta (12/11/2026, UTC)

Segundo as saídas do PowerShell fornecidas pelo operador, foi criado e executado o Cloud Run Job temporário `w11-auth-smoke`, execution `w11-auth-smoke-9p959`, região `southamerica-east1`, projeto `cozinha-dietetica`. **Concluiu com sucesso, 1/1 tarefa**, via imagem W11 `sha256:c91e420a1613a44216dac7949db23f9ef944eb706a68a81ecafd0b3013be6ef2`, conta de serviço `hospital-qa-runtime@cozinha-dietetica.iam.gserviceaccount.com`.

O teste lê email e OAuth token do metadata server, exige a identidade hospitalar e consulta `POST https://identitytoolkit.googleapis.com/v1/projects/cozinha-dietetica/accounts:lookup` com UID fictício presumidamente inexistente `qa_smoke_inexistente_w11_20261112`. Lança erro em qualquer HTTP não-2xx ou se o usuário fictício existir. **Nenhum usuário foi criado nem modificado.**

**Pendente de registro conclusivo:** conferir log do Job `w11-auth-smoke-9p959` com `PASS: Firebase Authentication IAM; HTTP 200` e, apenas após confirmação, excluir o Job temporário. O resultado de execução `SUCCESS` é evidência positiva, mas o log literal deve ser arquivado antes de certificar o teste específico.

**Permanece NO-GO clínico** até invocação interna autenticada, seed sintética e fluxo funcional QA em ambiente remoto, com segurança e custo verificados. Não liberar publicamente o serviço.
