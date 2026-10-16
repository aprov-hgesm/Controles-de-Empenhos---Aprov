# EMPROVEX — Memorial Oficial

## CLOUD-RUN-R1 — Firebase addFirebase iniciou operação no QA (2026-10-16)

- **Execução real PowerShell do Fundador, QA somente:** `POST https://firebase.googleapis.com/v1beta1/projects/emprovex-qa-r1-261015-6275:addFirebase` com `x-goog-user-project` fixado no QA e body `{}` retornou a operação `operations/workflows/ZGQxN2UyYmYtYjE5My00YjVkLWIyZGEtODc0ZTU1OTIxOGU3`; campo `DONE=` vazio/ausente. **PASS solicitação aceita**, mas **NÃO comprova conclusão da associação FirebaseProject**. A operação pode ter sucesso, falhar ou continuar em curso; não realizar outro `addFirebase` sem conferir operação.
- **Próximo gate read-only:** GET `https://firebase.googleapis.com/v1beta1/operations/workflows/ZGQxN2UyYmYtYjE5My00YjVkLWIyZGEtODc0ZTU1OTIxOGU3` com token de usuário local e `x-goog-user-project` do QA. `done=true` + `response.projectId=emprovex-qa-r1-261015-6275` comprova sucesso; `done=true` + `error` comprova falha; sem `done` indica espera. Como a API pode excluir operações após conclusão, GET 404 na operação deve ser seguido de GET no próprio FirebaseProject, sem repetir POST. Não exibir token/respostas integrais. Fonte: https://firebase.google.com/docs/reference/firebase-management/rest/v1beta1/projects/addFirebase .
- **Progresso estável:** etapa 3 Segurança QA **62,5%**, migração geral **52,5%**. Cloud Run NO-GO; nenhuma mudança em Vercel, GCP produção, DNS, dados reais ou `main`.

---

## CLOUD-RUN-R1 — Firebase GET passou de 403 a 404 após fixar consumidor QA (2026-10-16)

- **Evidência local PowerShell:** usando token OAuth da conta `gcloud`, GET `https://firebase.googleapis.com/v1beta1/projects/emprovex-qa-r1-261015-6275` com cabeçalho `x-goog-user-project: emprovex-qa-r1-261015-6275` retornou `HTTP=404; STATUS=NOT_FOUND; REASON=NAO_DISPONIVEL; CONSUMER=NAO_DISPONIVEL`. Antes desse header o mesmo GET retornara `HTTP=403; STATUS=PERMISSION_DENIED; REASON=SERVICE_DISABLED; SERVICE=firebase.googleapis.com`. A mudança comprova que o cabeçalho **resolveu o bloqueio de projeto consumidor**; 404 é consistente com `FirebaseProject` não adicionado, dado que projeto GCP QA, sua API e ambos Firestores existem. Não registrar Firebase como criado.
- **Decisão de próximo gate:** a documentação oficial do Firebase informa que `projects.addFirebase` (POST no projeto QA existente) adiciona a configuração Firebase e habilita várias APIs, provisiona contas de serviço Firebase e chave pública Browser, e **não pode ser integralmente desfeita**. Exige aceite prévio dos Termos na interface da conta Google quando aplicável; role `owner` inclui permissões necessárias. Escolher execução *explicitamente consentida pelo Fundador e limitada ao QA*, via Firebase Console ou REST com `x-goog-user-project`. Capturar somente ID de `Operation` (não token) e verificar conclusão antes de afirmar PASS. Fontes: https://firebase.google.com/docs/projects/use-firebase-with-existing-cloud-project ; https://firebase.google.com/docs/reference/firebase-management/rest/v1beta1/projects/addFirebase .
- **Observação de custos:** orçamento mensal QA R$20 é somente alerta, não teto de cobrança; não iniciar outros serviços e não criar Web App/Cloud Run automaticamente. Nenhuma mudança executada por coordenador em GCP. Migração **NO-GO**, PRs DRAFT, `main`, Vercel e GCP produtivo intactos.
- **Progresso:** etapa 3 Segurança e Isolamento QA **62,5%**, migração geral **52,5%**. Aferição do registro Firebase ainda pendente de `addFirebase`.

---

## CLOUD-RUN-R1 — Firebase SERVICE_DISABLED identificado, hipótese quota consumer (2026-10-16)

- **Evidência PowerShell:** após `gcloud services enable firebase.googleapis.com --project=emprovex-qa-r1-261015-6275` responder sucesso, `GET /v1beta1/projects/emprovex-qa-r1-261015-6275` com token usuário sem quota header retornou `HTTP=403; STATUS=PERMISSION_DENIED; REASON=SERVICE_DISABLED; SERVICE=firebase.googleapis.com`. A categorização exata revela **serviço desabilitado para o consumidor da requisição**; **não prova** que `firebase.googleapis.com` esteja desativada no QA de destino nem ausência do FirebaseProject. A ativação já foi executada, não repetir cegamente.
- **Hipótese técnica relevante apoiada pela documentação:** `gcloud auth print-access-token` com usuário pode ser atribuído a um projeto consumidor de quota diferente daquele na URL. O header por requisição `x-goog-user-project: emprovex-qa-r1-261015-6275` instrui o servidor a cobrar quotas do projeto QA, no qual a API foi habilitada, desde que haja `serviceusage.services.use`. Não alterar `gcloud config` global nem credenciais. Fontes: https://docs.cloud.google.com/docs/authentication/rest e https://docs.cloud.google.com/docs/authentication/troubleshoot-adc .
- **Próxima prova read-only:** repetir GET Firebase Management com header `x-goog-user-project` fixado no QA; capturar somente `HTTP`, `error.status`, `ErrorInfo.reason` e `ErrorInfo.metadata.consumer` (ID de projeto, não token), sem imprimir resposta integral/erro bruto. Se 200, `FirebaseProject` existe; se 404, investigar registro; 403 de novo exige inspeção de quota consumer, sem conceder novos IAM por suposição.
- **Progresso conservador:** etapa 3 **62,5%**, geral **52,5%**. Nenhum deploy, Rules, Firebase addProject, merge, IAM nem intervenção em produção; **NO-GO**.

---

## CLOUD-RUN-R1 — Firebase Management GET 403 persistente após enable (2026-10-16)

- **Evidência Windows do Fundador:** a habilitação `gcloud.cmd services enable firebase.googleapis.com --project=emprovex-qa-r1-261015-6275` retornou operação concluída com sucesso, e o `GET https://firebase.googleapis.com/v1beta1/projects/emprovex-qa-r1-261015-6275` com token OAuth local voltou a retornar `FIREBASE_PROJECT_STATUS=403`. **Não inferir** que `FirebaseProject` inexiste ou que o usuário não tem `roles/owner`; no IAM do projeto QA o fundador figurou previamente como Owner, papel que contém `firebase.projects.get` conforme documentação de IAM.
- **Gate diagnóstico apenas read-only:** extrair `error.status` e o `google.rpc.ErrorInfo.reason` (sem `error.message`, tokens ou corpo integral) do erro HTTP 403 para distinguir `SERVICE_DISABLED`, `CONSUMER_INVALID`, `ACCESS_TOKEN_SCOPE_INSUFFICIENT`, `PERMISSION_DENIED` e casos correlatos. Confirmar também a identidade gcloud ativa se necessário; testar novamente somente após causa identificada. Não conceder papéis cegamente; não adicionar Firebase nem tocar produção sem decisão do Fundador.
- Fontes: https://firebase.google.com/docs/reference/firebase-management/rest/v1beta1/projects/get ; https://docs.cloud.google.com/iam/docs/roles-permissions/firebase ; https://firebase.google.com/docs/projects/use-firebase-with-existing-cloud-project .
- **Progresso sem novo gate:** Etapa 3 **62,5%**; total **52,5%**. As duas leituras Firestore QA HTTP 200 permanecem válidas, mas Rules/Auth e negativos não concluídos. Vercel e produção preservadas; **NO-GO**.

---

## CLOUD-RUN-R1 — W7 Firebase Management API habilitada no QA (2026-10-16)

- **Evidência real PowerShell do Fundador:** `gcloud.cmd services enable firebase.googleapis.com --project=emprovex-qa-r1-261015-6275` retornou `Operation "operations/acat.p2-953294034210-0e1530db-43f7-4541-bb0b-7a14fc313804" finished successfully.`. **PASS: Firebase Management API ativada somente no projeto QA**.
- **Não concluir prematuramente:** habilitar a API não registra `FirebaseProject`, não configura Firebase Authentication, não cria app web, não publica Security Rules nem autentica usuários. O GET anterior havia retornado 403 antes da API ser ativada; após ativação repetir `GET https://firebase.googleapis.com/v1beta1/projects/emprovex-qa-r1-261015-6275` usando token local, sem exibir credenciais. HTTP 200 com `projectId` correto comprovaria recurso; 404/403 devem ser tratados segundo o contexto sem `addFirebase` automático.
- **Progresso inalterado:** etapa 3 Segurança/Isolamento QA **62,5%**; migração geral **52,5%**. Vercel, GCP produtivo, Rules e `main` preservados. **CLOUD-RUN-R1 NO-GO**.

---

## CLOUD-RUN-R1 — W7 Firebase Management GET 403 (2026-10-16)

- **Execução read-only do Fundador:** consulta `Invoke-RestMethod -Method Get https://firebase.googleapis.com/v1beta1/projects/emprovex-qa-r1-261015-6275` com token de usuário via `gcloud.cmd auth print-access-token` retornou `FIREBASE_PROJECT_STATUS=403`, sem corpo detalhado. Não foi feito `projects.addFirebase`, nem ativado Firebase Auth/Rules.
- **Interpretação correta:** resposta 403 **não prova ausência de FirebaseProject**; pode significar `firebase.googleapis.com` desabilitada ou permissões insuficientes, entre outras causas. A lista previamente obtida de APIs QA habilitadas não continha `firebase.googleapis.com`. A documentação oficial do Firebase determina habilitar **Firebase Management API** antes da consulta REST: https://firebase.google.com/docs/projects/use-firebase-with-existing-cloud-project e https://firebase.google.com/docs/projects/api/workflow_set-up-and-manage-project .
- **Próxima ação delimitada:** habilitar somente `firebase.googleapis.com` no projeto `emprovex-qa-r1-261015-6275` via `gcloud.cmd services enable firebase.googleapis.com --project=emprovex-qa-r1-261015-6275`, após confirmação por execução do Fundador. Isso **não equivale a adicionar Firebase ao projeto** nem autoriza chamada POST `projects.addFirebase`. Repetir GET para distinguir registrado/não registrado/permissão após propagação. Manter credenciais privadas fora do chat.
- **Percentuais inalterados:** etapa 3 Segurança QA **62,5%**, migração geral **52,5%**. GCP produção, Vercel, `main` e dados reais preservados. CLOUD-RUN-R1 NO-GO.

---

## CLOUD-RUN-R1 — W7 projeto QA labels consultadas, FirebaseProject pendente (2026-10-16)

- Evidência Windows do Fundador: reexecução da sonda IAM W7 corrigida repetiu token temporário **PASS**, `qa-core HTTP 200`, `qa-warehouse HTTP 200` — **sem novo gate adicional**. Consulta read-only `gcloud.cmd projects describe emprovex-qa-r1-261015-6275 --format="yaml(labels)"` retornou `app: emprovex` e `env: qa`. Labels são metadados definidos no GCP e **não comprovam** registro do `FirebaseProject` nem Firebase Authentication ativado.
- Próximo gate sem mutação: usar `GET https://firebase.googleapis.com/v1beta1/projects/emprovex-qa-r1-261015-6275` com token OAuth do usuário proprietário obtido localmente (sem exibi-lo). Um HTTP 200 com `projectId` correto comprova registro FirebaseProject; HTTP 404 indicaria ausência/indisponibilidade do recurso sob a identidade da chamada; HTTP 403 é inconclusivo sobre o registro (pode refletir API não habilitada ou permissão). **Não executar** `projects:addfirebase` nem habilitar serviços adicionais sem conferir resultado e pedir autorização específica.
- Evidência documental: https://firebase.google.com/docs/reference/firebase-management/rest/v1beta1/projects/get ; https://firebase.google.com/docs/projects/use-firebase-with-existing-cloud-project .
- Segurança/Isolamento QA **62,5%**; migração geral **52,5%**. Nenhuma mudança em produção, `main`, DNS, Vercel, Rules ou deploy; NO-GO.

---

## CLOUD-RUN-R1 — W7 acesso real à dupla Firestore QA comprovado (2026-10-16)

- **Evidência direta de homologação real:** o Fundador executou `EMPROVEX_QA_W7_TESTE_IAM_CORRIGIDO.ps1` no Windows, fixado ao projeto `emprovex-qa-r1-261015-6275`. A sonda retornou sucessivamente: `PASS: Token temporario obtido (conteudo nao exibido).`, `PASS: qa-core HTTP 200 para identidade runtime QA.`, `PASS: qa-warehouse HTTP 200 para identidade runtime QA.` e `PASS PARCIAL: Duas leituras reais QA autorizadas, sem gravacoes.`. O script realiza GET REST somente na coleção QA `emprovexQaSecurityProbe`, máximo `pageSize=1`, sem imprimir corpo ou token. **PASS funcional IAM positivo em ambos os bancos do QA**.
- **Não comprovados:** negação HTTP 403 no terceiro banco/projeto alheio; acesso indevido fora do QA; Firebase Auth do QA e Firestore Security Rules publicadas; client web/mobile; bundle Next staging; Cloud Run deploy. **HTTP 200 não implica isolamento negativo** e Security Rules cliente não substituem IAM server. A sonda não consultou produção. Revisão independente da fonte: https://cloud.google.com/firestore/docs/manage-databases confirma restrição por IAM Conditions em cada database via REST.
- **Progressão por subgate real:** Etapa 3/5 **50% → 62,5%** (autorização IAM positiva correspondente à metade da prova operacional ainda aberta). Total **50% → 52,5%**: duas etapas anteriores concluídas e 62,5% da terceira, pesos iguais. Percentuais por marcos, sem inferir aptidão para deploy.
- **Próximo gate:** programar negativa controlada **sem manipulação de produção** e revisar Auth/Rules dos dois bancos QA; caso teste negativo precise atingir projeto produtivo, obter autorização expressa e restrita do Fundador antes de qualquer chamada. Revogar `roles/iam.serviceAccountTokenCreator` temporário na policy da service account QA ao encerrar homologação, após verificações.
- **Governança:** PRs continuam DRAFT, W4 interlock preservado; produção Vercel, Firestore produtivo e `main` preservados. **CLOUD-RUN-R1 NO-GO**.

---

## CLOUD-RUN-R1 — W7 autorização de impersonação QA concedida (2026-10-16)

- **Evidência PowerShell do Fundador:** `gcloud.cmd iam service-accounts add-iam-policy-binding emprovex-qa-runtime@emprovex-qa-r1-261015-6275.iam.gserviceaccount.com --member="user:aprov1hgesm@gmail.com" --role="roles/iam.serviceAccountTokenCreator" --project=emprovex-qa-r1-261015-6275` retornou `Updated IAM policy for serviceAccount`, com binding exato `user:aprov1hgesm@gmail.com → roles/iam.serviceAccountTokenCreator` na **policy da própria service account QA**, `version: 1` e `etag: BwZd7WrLEKM=`. **PASS de configuração**; não houve concessão do papel TokenCreator no IAM do projeto e não há comprovação ainda de token ou leitura do Firestore.
- **Próximo teste:** executar novamente `EMPROVEX_QA_W7_TESTE_IAM_CORRIGIDO.ps1` usando `powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$HOME\\Downloads\\EMPROVEX_QA_W7_TESTE_IAM_CORRIGIDO.ps1"`. Script obtém token temporário sem mostrá-lo e executa somente consultas GET em `qa-core` e `qa-warehouse`, projeto QA; não realiza operações de produção. Se falhar, classificar sem conceder permissões adicionais por suposição.
- **Revogação planejada:** após testes reais, retirar o binding TokenCreator na **service account QA**; evitar deixar direito de impersonação persistente desnecessário.
- **Progresso mantido:** Etapa 3 50%; Migração geral 50%. Sem prova funcional IAM, Firebase Auth/Rules, Cloud Run QA ou qualquer deploy. Produção Vercel, GCP produtivo e `main` preservados. **NO-GO**.

---

## CLOUD-RUN-R1 — W7 bloqueio Token Creator diagnosticado (2026-10-16)

- **Evidência real PowerShell do fundador:** a sonda antiga `EMPROVEX_QA_W7_TESTE_IAM.ps1` encerrou com erro genérico e a versão `EMPROVEX_QA_W7_TESTE_IAM_CORRIGIDO.ps1` informou `PENDENTE: TOKEN_CREATOR_NAO_AUTORIZADO. Verificar permissao na conta de servico QA.`, após tentar emissão de token temporário. **Não houve HTTP GET Firestore nem prova de acesso aos DBs** nesta execução; nenhuma alteração GCP foi feita pelo script.
- **Diagnóstico:** provável ausência da autorização `iam.serviceAccounts.getAccessToken` para o usuário `aprov1hgesm@gmail.com` na service account QA (role `roles/iam.serviceAccountTokenCreator`). A sonda categoriza erros, não publica stderr bruto; o resultado não certifica, isoladamente, o IAM efetivo sem inspeção da policy. Documentação: https://cloud.google.com/iam/docs/service-account-permissions e https://cloud.google.com/sdk/gcloud/reference/iam/service-accounts/add-iam-policy-binding .
- **Correção planejada sob controle do fundador:** usar `gcloud.cmd iam service-accounts add-iam-policy-binding emprovex-qa-runtime@emprovex-qa-r1-261015-6275.iam.gserviceaccount.com --member=user:aprov1hgesm@gmail.com --role=roles/iam.serviceAccountTokenCreator --project=emprovex-qa-r1-261015-6275` **somente na policy da conta QA**, nunca como `projects add-iam-policy-binding`. Aguardar comprovação PowerShell antes de marcar PASS; posteriormente remover role temporária se não for mais necessária.
- **Sem mudança de progresso:** Segurança QA 50%, migração geral 50%; PR #323 DRAFT, sem deploy, Rules QA não publicadas, Vercel e projeto GCP produtivo preservados. CLOUD-RUN-R1 NO-GO.

---

## CLOUD-RUN-R1 — W7 sonda IAM diagnostico PowerShell (2026-10-16)

- **Saída real do Fundador:** `EMPROVEX_QA_W7_TESTE_IAM.ps1` iniciou corretamente, indicou solicitação de token temporário e encerrou com `FAIL: erro na operacao de teste temporario; nenhuma alteracao efetuada.`. Isso **não** comprova se há falta de `roles/iam.serviceAccountTokenCreator`, sessão `gcloud` inválida ou falha de shell; o script anterior suprimia mensagens e seu `catch` mascarava a origem do erro.
- **Correção isolada W7:** PR [#323](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/323) atualizou `scripts/cloud-run-qa-iam-probe.ps1`, agora capturando `stderr` do `gcloud.cmd` de modo compatível com Windows PowerShell 5.1, categorizando falhas sem revelar o token nem o erro bruto potencialmente sensível. Commit do script corrigido `585a39d183ae62337f46d5a4736944de39006f1f`, Git blob `c0c1e20c7083b405cf418188c18f37a4e6d43acc` comparado à cópia distribuível.
- **Segurança:** somente consulta HTTP GET nos dois bancos do projeto QA caso a impersonação funcione; sem criação/gravação/alteração IAM e **sem acessar produção**. Se token não for permitido, parar e revisar concessão **somente na conta de serviço QA** antes de autorizar qualquer alteração. O primeiro teste **não passou**; não promover o percentual.
- **Progresso:** etapa 3/5 segurança **50%**; geral **50%**, sem novo gate certificado. CLOUD-RUN-R1 NO-GO; Vercel/projeto produtivo intactos.

---

## CLOUD-RUN-R1 — W7 sonda real IAM QA preparada (2026-10-16)

- Confirmada saída local `EMPROVEX_QA_W7_AUDITORIA.ps1`: **PASS PARCIAL** para projeto, billing, APIs, ambos Firestore QA, runtime SA e duas condições IAM, sem principals públicos explícitos. Sonda de autorização **ainda não executada**.
- Preparado o arquivo `scripts/cloud-run-qa-iam-probe.ps1` no [PR #323](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/323) (branch W7 isolada): obtém token temporário por impersonação sem imprimi-lo; tenta **apenas duas consultas GET**, uma por banco QA, na coleção fictícia `emprovexQaSecurityProbe`, com `pageSize=1`; não grava dados, não acessa nenhum projeto produtivo, não concede IAM. Se TokenCreator ainda faltar, mostra **PENDENTE** e exige concessão restrita somente à identidade QA após revisão, sem mutação automática.
- W7 CI offline novo SHA `e016887df3d359049451df61284d89710fd77659`, run [#38848749580](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/runs/38848749580) **PASS**; Core Protection [#38848749587](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/runs/38848749587) **PASS**; Application CI [#38848749562](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/runs/38848749562) **em progresso na verificação**, não declarar PASS antes da conclusão.
- **Limites:** um HTTP 200 positivo comprova leitura no QA com token da service account, mas não prova 403 fora do escopo, Firebase Rules/Auth nem compatibilidade Cloud Run; nenhum token deve ser enviado ao chat. Progresso **Etapa 3 50%; geral 50%**, sem certificação funcional nova. CLOUD-RUN-R1 NO-GO.

---

## CLOUD-RUN-R1 — W7 auditoria QA real PASS parcial (2026-10-16)

- **Execução Windows reportada pelo Fundador:** `EMPROVEX_QA_W7_AUDITORIA.ps1` concluiu **PASS PARCIAL** sem falhas: projeto QA separado identificado; faturamento ativo; APIs Firestore/IAM/IAMCredentials/FirebaseRules habilitadas; `qa-core` e `qa-warehouse` em região/edição/tipo/proteção esperados; runtime SA presente; dois IAM bindings condicionais confirmados; sem principals públicos nos bindings explícitos QA. Não foi executada autenticação como a service account, logo IAM efetivo ainda não comprovado. Mensagem `OrÃ§amento` é só codificação de texto, não erro funcional.
- **Gates W7 PR #323 no SHA `330149897751627f760fe18aedf555bb964a6395` confirmados:** [W7 Security Batch #38847873118](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/runs/38847873118) **SUCCESS**, [Core Protection #38847873008](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/runs/38847873008) **SUCCESS**, [Application CI #38847872902](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/runs/38847872902) **SUCCESS**. A suíte W7 é offline e não certifica GCP Rules/ADC.
- **Próxima sequência:** (1) auditar diretamente a política IAM da conta de serviço (binding TokenCreator na conta, se preciso), (2) script único de teste de autenticação temporária com operações apenas sintéticas no QA e saída sem tokens, (3) Rules/Auth QA e inspeção do bundle staging. **Não acessar dados/bancos produtivos por teste sem autorização específica.**
- **Progressos mantidos:** Segurança/isolamento QA etapa 3/5 **50%**; migração geral **50%**. Cloud Run e produção NO-GO, PRs DRAFT sem merge.

---

### W7 — IAM APIs habilitadas no QA (2026-10-16)

- **Evidência da execução local do Fundador:** `gcloud.cmd services enable iam.googleapis.com iamcredentials.googleapis.com --project=emprovex-qa-r1-261015-6275` retornou `Operation ... finished successfully`. As APIs **IAM** e **IAM Service Account Credentials** foram habilitadas somente no projeto QA; a operação não criou chaves JSON nem concedeu papéis IAM.
- **Próximo gate read-only:** consultar a política da conta de serviço `emprovex-qa-runtime@emprovex-qa-r1-261015-6275.iam.gserviceaccount.com` por `gcloud.cmd iam service-accounts get-iam-policy ... --project=emprovex-qa-r1-261015-6275` antes de qualquer concessão `roles/iam.serviceAccountTokenCreator`, sempre restrita à própria identidade e não ao projeto inteiro. Não exibir tokens no chat. Depois testar ADC positivo e 403 negativo em QA/produção mediante plano de teste seguro.
- **Progresso constante:** etapa 3 — 50%; migração geral — 50%. Cloud Run continua NO-GO, produção Vercel e dados produtivos preservados.

## CLOUD-RUN-R1 — W7 inventário APIs QA (2026-10-16)

- Comando **read-only** do Fundador `gcloud.cmd services list --enabled --project=emprovex-qa-r1-261015-6275 --format="value(config.name)"` retornou somente `billingbudgets.googleapis.com`, `firebaserules.googleapis.com`, `firestore.googleapis.com`. **Não há Cloud Run ou IAM Credentials API habilitada** no inventário dessa consulta.
- `firebaserules.googleapis.com` habilitada **não comprova publicação de Rules** nos bancos; Rules e autorização operacional ainda pendentes. Próxima operação estritamente QA é habilitar `iam.googleapis.com` e `iamcredentials.googleapis.com` para permitir testes de impersonação com token temporário; nenhum segredo JSON deve ser criado ou compartilhado. Antes de conceder `roles/iam.serviceAccountTokenCreator`, inspecionar IAM na **conta de serviço apenas** e usar privilégio mínimo (não no projeto inteiro).
- Etapa 3: **50%**; migração geral: **50%** (marcos de peso igual). Não houve novo marco de autorização remota; não elevar percentuais. Produção e `main` preservadas. CLOUD-RUN-R1 NO-GO.

## CLOUD-RUN-R1 — W7 lote de auditoria e Rules QA preparado (2026-10-16)

- **Gate W7 offline:** GitHub Actions run [#38847873118](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/runs/38847873118) **completed/success**; Core Protection run [#38847873008](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/runs/38847873008) **completed/success**. Application CI [#38847872902](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/runs/38847872902) **em execução na verificação inicial**; seu PASS ainda não pode ser afirmado. O gate W7 apenas valida Rules proposta e auditor read-only, sem Firebase/GCP real.
- Autorização do Fundador: acelerar próximas atividades e agrupar verificações, evitando sequência de comandos administrativos redundantes.
- **PR #323 DRAFT aberto** [W7 QA Security Batch](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/323), branch `test/cloud-run-r1-w7-security-automation-20261016`, **base incremental W6 PR #322**, não `main`.
- Entregas em branch isolada: `firestore.qa-core.rules` e `firestore.qa-warehouse.rules` em **deny-all**; `firebase.cloud-run-qa-rules.json` com IDs explicitamente `qa-core`/`qa-warehouse`; `scripts/cloud-run-qa-security-batch.test.mjs` estático; `.github/workflows/cloud-run-qa-security-batch.yml` CI leve sem secrets/serviços; `scripts/cloud-run-qa-readonly-audit.ps1` consolida checagens read-only de projeto, billing, APIs, Firestore e IAM no Windows. Handoff em `docs/audits/cloud-run-r1/worker-7/HANDOFF.md`.
- **Não publicar Rules deny-all automaticamente**: apenas proposta segura de configuração inicial, sem Firebase Auth QA/Rules ativadas em cloud real; nenhuma garantia sobre proteção das Rules **atualmente ativas** nos bancos criados. O PowerShell não faz impersonação, não usa tokens nem acessa produção; não prova autorização real. Testes reais ADC/403 e build Cloud Run staging ainda faltam.
- **CLOUD-RUN-R1 segue NO-GO**. PRs DRAFT sem merge, Vercel, DNS, GCP produção e dados reais preservados. **Progresso mantido: etapa 3 50%; total 50%**, só subir após prova funcional aprovada.

---

## CHECKPOINT VIGENTE — CLOUD-RUN-R1 QA — 2026-10-16

**Classificação:** QA INFRA PARCIALMENTE CRIADO / HOMOLOGAÇÃO INCOMPLETA / MIGRAÇÃO **NO-GO**.

**Fonte principal atualizada:** [Relatório consolidado QA de 16/10/2026](audits/cloud-run-r1/RELATORIO_CONSOLIDADO_QA_2026-10-16.md) (branch documental do PR #317). Histórico das fases W1–W6 preservado nos PRs #316/#318/#319/#320/#321/#322 e nos blocos anteriores do Memorial.

### Evidência real (saída PowerShell do Fundador)

- **Projeto novo:** `emprovex-qa-r1-261015-6275` (número `953294034210`, ACTIVE), distinto do produtivo `gen-lang-client-0982077967`. Consulta `projects describe` mostrou apenas `projectId`, sem `parent` (compatível com No organization).
- **Faturamento:** conta `Pagamento do Firebase` aberta, moeda **BRL**; projeto QA com `billingEnabled: true`. Budget exclusivo ao QA `EMPROVEX QA R1 - Mensal` **R$20/mês**; `CURRENT_SPEND` 25/50/75/100%, créditos incluídos. **É somente alerta, não bloqueio de cobrança.**
- **Firestore:** API ativada somente no QA. Dois bancos Firestore Native Standard `us-east1` criados, com proteção de exclusão habilitada e PITR desativado: `qa-core` (`freeTier: true`, primeiro banco do projeto) e `qa-warehouse` (`freeTier: false`, faturável por uso). Corrigida a premissa histórica de que todo banco nomeado perderia o free tier: o primeiro banco do projeto o recebeu.
- **IAM:** conta `emprovex-qa-runtime@emprovex-qa-r1-261015-6275.iam.gserviceaccount.com` criada sem chave JSON no processo. Policy explícita inicial: fundador `roles/owner`, Firebase Rules service agent e Firestore service agent. **`roles/datastore.user` condicional a `qa-core` e `qa-warehouse` confirmado** em dois bindings separados, IAM policy versão 3 (títulos `EmprovexQaCoreOnly` e `EmprovexQaWarehouseOnly`). **PASS de configuração, mas sem teste operacional ADC/HTTP 403**.
- **Não realizados:** testes reais de allowed/403 IAM por banco e contra produção, Rules por DB, Firebase Auth/AppCheck QA, inspeção de bundle Next staging, deploy Cloud Run QA, WIF, teste R03 restore, F09 saída física multi-linha. O interlock W4 de startup em Cloud Run permanece intencionalmente bloqueado.
- **Testes técnicos anteriores:** W6 9/9 Emulator (F05 alocação, F06 transferência real via transação SDK e F09 consumo imediato) e Application CI/Core Protection PASS; **não certificam** IAM/Rules/Auth no GCP. Correção de leitura de lote F05→F06 existe apenas na branch DRAFT W6. PRs #317/#320/#321/#322 abertos DRAFT, não merged. Nenhum deploy ou mudança na `main` autorizados por esse programa.

**Progresso por marcos:** etapa 3/5 — Segurança e Isolamento QA **50%** (antes 25%); progresso geral da migração **50%**, por cinco etapas de peso igual; estimativas, não prazos nem homologação.

**Próximo gate:** auditar de forma independente os dois bindings IAM condicionais já registrados; validar acessos reais permitidos no QA e 403 negado no projeto produtivo; configurar Rules/Auth do QA e testes de bundle antes de liberar qualquer deploy. **Vercel/`emprovex.com.br` e projeto produtivo permanecem como estão.**

### IAM QA — verificação independente dos dois bindings (2026-10-16)

- Saída CLI somente leitura do fundador: `gcloud.cmd projects get-iam-policy emprovex-qa-r1-261015-6275 --format="yaml(bindings)"` confirmou **dois bindings condicionais `roles/datastore.user`** para `emprovex-qa-runtime@emprovex-qa-r1-261015-6275.iam.gserviceaccount.com`, com `resource.name` estritamente igual a `projects/emprovex-qa-r1-261015-6275/databases/qa-core` e `projects/emprovex-qa-r1-261015-6275/databases/qa-warehouse`. Service agents e Owner preservados; sem bindings públicos ou produtivos na policy QA apresentada.
- **PASS de configuração IAM verificada de forma independente; NÃO é certificação de acesso efetivo.** Faltam teste real com identidade QA em ambos bancos, negação 403 em produção e Firebase Security Rules/Auth QA. Sem tokens privados expostos. Percentuais permanecem **Etapa 3: 50% | Geral: 50%** até novo marco funcional. Docs: https://cloud.google.com/firestore/docs/manage-databases ; https://firebase.google.com/docs/rules/manage-deploy .

---

## CLOUD-RUN-R1 — W7 identidade runtime QA criada (2026-10-15)

- **Evidência enviada pelo Fundador:** `gcloud.cmd iam service-accounts create emprovex-qa-runtime --display-name="EMPROVEX QA Cloud Run Runtime" --description="Keyless QA runtime identity; no production access" --project=emprovex-qa-r1-261015-6275` retornou `Created service account [emprovex-qa-runtime]` e e-mail `emprovex-qa-runtime@emprovex-qa-r1-261015-6275.iam.gserviceaccount.com`.
- **PASS criação de identidade apenas.** Nenhum IAM Firestore concedido, nenhuma chave JSON criada pelo comando, nenhum Cloud Run publicado. Cloud Run ADC automático requer futuramente associar explicitamente essa conta ao serviço QA, sem chave baixada.
- **Próximo gate:** conceder somente `roles/datastore.user` por IAM **condicional ao nome exato do banco** `projects/emprovex-qa-r1-261015-6275/databases/qa-core` e, em segunda operação validada, `qa-warehouse`. Não conceder o papel de forma irrestrita; o escopo da IAM policy é projeto, com `resource.name` condition conforme documentação oficial (https://firebase.google.com/docs/firestore/enterprise/create-databases). Verificar política resultante e testes negativos para `(default)` e outros bancos; cuidado: console Google Cloud pode não refletir condições como cliente server API. Ainda faltam Firestore Security Rules individuais e autenticação Firebase QA; não presumir teste end-to-end.
- Produção, Vercel e `main` intocadas. CLOUD-RUN-R1 **NO-GO**.

---

## CLOUD-RUN-R1 — W7 sem parent explícito no QA (2026-10-15)

- **Evidência do Fundador:** `gcloud.cmd projects describe emprovex-qa-r1-261015-6275 --format="yaml(projectId,parent)"` exibiu apenas `projectId: emprovex-qa-r1-261015-6275`, sem `parent`. Compatível com projeto em **No organization**, sem organização/pasta ancestral reportada pela API no momento. A consulta não faz auditoria abrangente de outras camadas de autorização; as concessões diretas IAM do projeto foram verificadas separadamente.
- Próximo passo, **somente QA:** criar a conta de serviço sem chaves `emprovex-qa-runtime@emprovex-qa-r1-261015-6275.iam.gserviceaccount.com` usando `gcloud iam service-accounts create emprovex-qa-runtime --display-name="EMPROVEX QA Cloud Run Runtime" --description="Keyless QA runtime identity; no production access" --project=emprovex-qa-r1-261015-6275`. Criação não equivale a conceder papel IAM ou ligar Cloud Run, e nenhuma permissão Firestore deve ser concedida por ora. Aguardar saída efetiva do PowerShell para classificar o passo PASS.
- **Status:** Core/Warehouse QA criados e protegidos de exclusão, orçamento de alertas BRL20, sem conexão aplicativo, IAM runtime, migração, dados reais ou deploy. Produção protegida; CLOUD-RUN-R1 NO-GO.

---

## CLOUD-RUN-R1 — W7 auditoria IAM QA inicial (2026-10-15)

- **Evidência CLI somente leitura fornecida pelo Fundador:** `gcloud.cmd projects get-iam-policy emprovex-qa-r1-261015-6275 --flatten="bindings[].members" --format="table(bindings.role,bindings.members)"` retornou exatamente 3 bindings explícitos de projeto: `roles/owner` em `user:aprov1hgesm@gmail.com`; `roles/firebaserules.system` em `service-953294034210@firebase-rules.iam.gserviceaccount.com`; `roles/firestore.serviceAgent` em `service-953294034210@gcp-sa-firestore.iam.gserviceaccount.com`.
- **Veredito preliminar:** PASS escopo da **allow policy explícita do projeto**: sem `allUsers`, `allAuthenticatedUsers` ou contas da produção listadas, e as duas identidades service agents do Google exibem número do projeto QA correto. `roles/owner` é amplo, mas pertence ao administrador fundador; não estender a runtimes.
- **Limites da evidência:** `projects get-iam-policy` **não mostra concessões herdadas de folder/organization**, não certifica roles condicionais em outros recursos, nem Firebase Security Rules por banco. Ainda não existe conta de serviço runtime QA própria nem validação de isolamento Firestore/Auth/Cloud Run. Próximo passo de somente leitura: `gcloud.cmd projects describe emprovex-qa-r1-261015-6275 --format="yaml(projectId,parent)"` para entender ancestralidade, antes de IAM mínimo/keyless e Rules deny-by-default individuais.
- **Não alterar os Google service agents**, IAM produção, `main` ou Vercel; CLOUD-RUN-R1 continua NO-GO.

---

## CLOUD-RUN-R1 — W7 qa-warehouse criado (2026-10-15)

- **Evidência PowerShell do Fundador:** `gcloud.cmd firestore databases create --database=qa-warehouse --location=us-east1 --type=firestore-native --edition=standard --delete-protection --project=emprovex-qa-r1-261015-6275` retornou `done: true`, `projects/emprovex-qa-r1-261015-6275/databases/qa-warehouse`, edição `STANDARD`, tipo `FIRESTORE_NATIVE`, `locationId=us-east1`, `DELETE_PROTECTION_ENABLED`, `POINT_IN_TIME_RECOVERY_DISABLED` e `freeTier: false`.
- **Estado da infraestrutura de dados QA:** `qa-core` **criado** (`freeTier: true`), `qa-warehouse` **criado** (`freeTier: false`), ambos na região `us-east1` e no mesmo projeto QA exclusivo. Faturamento QA e alerta de orçamento R$20/mês ativados. Bancos nomeados não equivalem a isolamento IAM automático; regras Firestore são separadas por banco e **não foram publicadas/auditadas**. Nem Firebase Auth QA nem integração end-to-end configurados ou certificados.
- **Próxima auditoria de baixo risco:** `gcloud.cmd projects get-iam-policy emprovex-qa-r1-261015-6275 --flatten="bindings[].members" --format="table(bindings.role,bindings.members)"` (somente leitura). Detectar roles amplos, identidades de produção e principais `allUsers`/`allAuthenticatedUsers`, antes de contas de serviço/regras. Depois verificar associação do projeto ao Firebase e planejar Rules fechadas em **cada** banco, com testes controlados; não assumir que regras de SDK de servidor (ADC/Admin SDK) aplicam-se automaticamente, porque dependem de IAM.
- **Proteção:** não criar banco `(default)`, não importar dados, não conceder IAM à produção, não modificar Vercel/DNS/`main`. CLOUD-RUN-R1 segue **NO-GO**. Fontes: https://firebase.google.com/docs/firestore/manage-databases e https://firebase.google.com/docs/rules/manage-deploy .

---

## CLOUD-RUN-R1 — W7 banco qa-core criado e free tier confirmado (2026-10-15)

- **Evidência PowerShell do Fundador:** `gcloud.cmd firestore databases create --database=qa-core --location=us-east1 --type=firestore-native --edition=standard --delete-protection --project=emprovex-qa-r1-261015-6275` retornou `done: true`, identificador `projects/emprovex-qa-r1-261015-6275/databases/qa-core`, `STANDARD`, `FIRESTORE_NATIVE`, `DELETE_PROTECTION_ENABLED`, `POINT_IN_TIME_RECOVERY_DISABLED`, `locationId: us-east1`, `freeTier: true`.
- **Correção da premissa anterior de custo:** fonte atual Firebase `https://firebase.google.com/docs/firestore/pricing` (e Firestore REST field `freeTier`) confirma que **o primeiro banco de um projeto recebe franquia gratuita independentemente do ID**. O `qa-core` é o único beneficiado pela franquia de 1 GiB storage, 50 mil reads/dia, 20 mil writes/dia, 20 mil deletes/dia, 10 GiB saída/mês na edição Standard. Acima disso, cobra-se por uso; TTL/PITR/backups/restore/clones não incluídos. **`qa-warehouse` será o segundo banco e será cobrado pelo consumo, sem franquia própria**.
- **Gate seguinte:** criar `qa-warehouse` no mesmo projeto/região/edição/modo, `--delete-protection`, sem PITR; aguardar confirmação do Fundador. Depois auditar Rules inicial e IAM; **não conectar o aplicativo a bancos sem regras/identidades e testes de isolamento**. Orçamento R$20 é de alertas, sem teto garantido. Nenhum dado real ou migração.

---

## CLOUD-RUN-R1 — W7 API Firestore QA habilitada (2026-10-15)

- O Fundador executou `gcloud.cmd services enable firestore.googleapis.com --project=emprovex-qa-r1-261015-6275` e recebeu `Operation ... finished successfully`; Firestore API habilitada **somente no QA**.
- **Ainda não foram criados bancos Firestore QA** na evidência recebida. Próximo passo: criar separadamente `qa-core` e `qa-warehouse` com `--project` explícito, região `us-east1`, edição `standard`, tipo `firestore-native`, sem PITR ou backups, e avaliar proteção contra exclusão.
- Bancos nomeados geram cobrança por uso sem cota gratuita. Orçamento R$ 20/mês é alerta, não teto. Configurar/validar Security Rules de cada banco (deny-by-default) e IAM isolado antes de qualquer conexão do aplicativo ou ingestão de dados. **Não criar default DB, nem acessar o projeto produtivo**. CLOUD-RUN-R1 NO-GO.

---

## CLOUD-RUN-R1 — W7 orçamento QA confirmado (2026-10-15)

- **Saída do PowerShell enviada pelo Fundador:** habilitada a API `billingbudgets.googleapis.com` **somente** no projeto QA `emprovex-qa-r1-261015-6275`; Google Cloud retornou `Created [3f76c6ac-09dc-4105-92f9-58ec1a4b933a]`.
- Orçamento mensal `EMPROVEX QA R1 - Mensal`, moeda `BRL`, valor **R$ 20**, filtro `projects/953294034210` (número **do projeto QA**), thresholds `CURRENT_SPEND` 25%, 50%, 75% e 100%. CreditTypesTreatment `INCLUDE_ALL_CREDITS`.
- **Controle financeiro:** orçamento apenas de alerta, **não** é teto de cobrança nem confirma recebimento de e-mails. Conta de faturamento compartilhada com outros recursos e produção não foi alterada; script de vinculação foi destinado apenas ao QA. Não registrar identificador da conta no memorial.
- Próxima etapa controlada: habilitar Firestore API apenas no QA (`--project=emprovex-qa-r1-261015-6275`) e criar posteriormente dois bancos Firestore Standard, modo nativo, IDs `qa-core`/`qa-warehouse`, `us-east1`; nenhuma senha/token/chave JSON. Regras restritivas no início; **os bancos nomeados não recebem free tier**, o uso será faturável. Nunca executar `gcloud config set project` para produção.
- **Estado no momento:** API de orçamento ligada; bancos e Cloud Run QA ainda **não criados**; CLOUD-RUN-R1 NO-GO; sem deploy/DNS/produção.

---

## CLOUD-RUN-R1 — W7 billing QA vinculado (2026-10-15)

- **Evidência PowerShell do Fundador:** `gcloud.cmd billing projects link emprovex-qa-r1-261015-6275 --billing-account=...` retornou `billingEnabled: true` e `projectId: emprovex-qa-r1-261015-6275`. Faturamento QA agora vinculado à conta aberta **Pagamento do Firebase**, moeda **BRL** (verificada em consulta anterior); conta de faturamento existente compartilhada — sem afirmar que a produção mudou. Não repetir identificador financeiro no memorial.
- **Próximo gate obrigatório:** criar orçamento de ALERTA para **R$ 20 BRL por mês**, escopo exclusivo `projects/emprovex-qa-r1-261015-6275`, thresholds 25%, 50%, 75% e 100%, sem desativar destinatários IAM. **Orçamento não é limite duro de gastos**. Verificar saída da CLI (nome/id, amount, filtro e regras) antes de habilitar Firestore/Cloud Run. Projeto principal do gcloud não deve ser alterado; usar `--project=emprovex-qa-r1-261015-6275` explicitamente.
- **Estado efetivo:** projeto QA criado e billing habilitado; **nenhum orçamento comprovado criado ainda**, nenhum Firestore QA, Cloud Run QA, IAM ou deploy certificado. Produção Vercel/Firestore inalterada, CLOUD-RUN-R1 NO-GO.

---

## CLOUD-RUN-R1 — W7 — Conta de faturamento aberta identificada (2026-10-15)

- O Fundador confirmou por consulta somente leitura `gcloud.cmd billing accounts list --filter="open=true"` uma conta ativa, nome de exibição **Pagamento do Firebase**, `OPEN=True`. Não registrar o identificador financeiro completo no memorial. Isso **não** indica faturamento já habilitado no projeto QA: a consulta anterior indicou `billingEnabled: false` em `emprovex-qa-r1-261015-6275`.
- **Próxima consulta sem mutação:** `gcloud.cmd billing accounts describe <ID DA CONTA> --format="yaml(displayName,currencyCode,open)"` para moeda da conta, antes de criar orçamento exclusivo QA com thresholds 25/50/75/100. Orçamento envia alertas, não limita gasto efetivo; sem autorização de recursos ou produção.

---

## CLOUD-RUN-R1 — Projeto QA criado pelo Fundador (2026-10-15)

- **Consulta adicional de faturamento do Fundador (read-only):** `gcloud.cmd billing projects describe emprovex-qa-r1-261015-6275` retornou `billingEnabled: false (consulta do Fundador)` e `billingAccountName: ''`. **QA sem conta de faturamento associada no momento da consulta**. Nenhum recurso pago deve ser criado antes de identificar conta ativa e preparar orçamento/alertas scoped ao QA. Fonte: saída local do PowerShell reportada pelo Fundador.


- **Evidência enviada pelo Fundador:** execução do script PowerShell da etapa 1 usando conta Google `aprov1hgesm@gmail.com` exibiu `Create ... done`, projeto GCP **`emprovex-qa-r1-261015-6275`** número **`953294034210`**, `LIFECYCLE_STATE=ACTIVE`. Esta é evidência textual da execução local; o coordenador ainda não possui acesso autenticado ao Console/API do GCP para conferência independente.
- **Escopo realizado:** apenas criação de projeto QA segregado do projeto produtivo **`gen-lang-client-0982077967`**. O script reportou **sem vinculação de billing feita por ele**; estado efetivo de faturamento a ser confirmado via `gcloud billing projects describe emprovex-qa-r1-261015-6275`. Nenhum Firestore QA, conta de serviço, Cloud Run, Artifact Registry, serviço de deploy ou DNS foi criado nessa etapa.
- **Próximo gate:** consultar faturamento do projeto explicitamente pelo ID QA, confirmar conta de faturamento e capacidade de budget/alertas antes de autorizar vinculação. Budget **não** é teto de gastos automático. Após isso, IAM de menor privilégio e bancos QA nomeados, sem acesso à produção; cada mutação deverá ser auditada.
- **Produção protegida:** não executar mudanças no projeto produtivo, Vercel ou domínio. CLOUD-RUN-R1 segue **NO-GO**.

---

## CLOUD-RUN-R1 — W7 custo QA e autorizacao inicial (2026-10-15)

- Fundador autorizou confirmar custos/limites e criar infraestrutura isolada. Precos oficiais: Cloud Run request-based free tier 2M requests / 180k vCPU-s / 360k GiB-s mensais por billing account; Firebase Auth convencional 50k MAU mensais Blaze; Cloud Build 2500 build-min elegiveis; Artifact Registry 0,5 GiB-mes por conta. **Firestore named databases (necessarios para Core e Warehouse separados) nao recebem free tier; operacoes/storage sao pagas por uso.** Valores variam por regiao e moeda. Billing Budget/alerts **nao sao hard spending cap**.
- Desenho economico recomendado: novo projeto GCP QA independente de `gen-lang-client-0982077967`, em `us-east1`, Firestore Standard `qa-core` / `qa-warehouse` *somente apos* vinculacao de billing/orcamento validada; serviço Cloud Run privado, instancia minima 0, maxima 1, sem Scheduler/backup/PITR/DOMINIO produtivo no inicio; service account gerenciada **sem chaves**, sem nenhum binding de IAM em producao.
- **Nao realizado no Google Cloud:** esta sessao nao possui conexao administrativa Google Cloud/Firebase nem as credenciais `gcloud` do PowerShell do Fundador. Nenhum projeto QA, faturamento, API, Firestore ou Cloud Run foi criado de fato. Foi gerado bootstrap PowerShell local de etapa 1 (somente `gcloud projects create` com labels e projeto unico; sem billing/API); validado estaticamente. Proximo passo: Fundador executa no proprio PC e envia somente `QA_PROJECT_ID`; entao configuracao auditada de orçamento/billing e demais recursos. **Nao fingir que projeto ja foi criado.**
- PR #322 recebeu handoff de custos/limites. CLOUD-RUN-R1 segue **NO-GO**, Vercel/Firestore prod/DNS intactos.

---

## CLOUD-RUN-R1 — W6 revisão independente, Emulator e plano de homologação (2026-10-15)

- **PR #322 DRAFT** (`test/cloud-run-r1-w6-fastpath-independent`) contra W5 PR #321, W5 depende de W4 PR #320. Código certificado no `0bf71b5ec136685fdd56c2629b75d03f75655de4`; alteração documental posterior `d3b55acf06a6110de9549f2dd6245c03903fae6c`. **Não fazer merge automático** nem publicar.
- **W6 Firebase Emulator — 9/9 PASS** (GitHub workflow `#38837933261`): testes executaram `POST /api/central-depositos/intake-action` **real** para F05 ALLOCATE e F09 IMMEDIATE_CONSUMPTION; F06 executou `transferWarehouseStock()` **real** com Firebase SDK `runTransaction`, saldo e lote persistidos, idempotência/replay, rejeição de conflito, negação de chamadas a produção. Projeto simulado `demo-emprovex-fastpath`, bancos nomeados sintéticos `qa-core` e `qa-warehouse`, apenas localhost. Auth e token de serviço simulados; Emulator emitiu aviso de multi-database/Rules permissivas: **não alegar IAM/Rules remoto**.
- **Defeito funcional real identificado:** lote persistido pelo F05 continha `createdAt/updatedAt`, `parseTransferLot()` no F06 antes usava `{ ...data, id }` com validador que proíbe campos adicionais e rejeitava transferência (`WAREHOUSE_TRANSFER_LOT_INVALID`). **Correção mínima:** `lib/warehouse/locationRepository.ts` aplica `warehouseCanonicalLotReadInput(id,data)`, já existente no domínio, antes de `validateWarehouseLot`. FAIL reproduzido no Emulator antes e PASS depois, sem flexibilizar validador ou alterar rules.
- **CI final confirmado:** `Application CI #38837933621` = PASS (validate-application e gates 16–21 PASS); `Core Protection #38837933233` = PASS, no commit do código acima. Sem deployment, nenhum recurso Google Cloud e nenhum dado real.
- **Revisão independente:** `docs/audits/cloud-run-r1/worker-6/REVISAO_INDEPENDENTE.md`; plano futuro **não executado** `docs/audits/cloud-run-r1/worker-6/PLANO_HOMOLOGACAO_ADC_IAM.md` ambos no PR #322.
- **NO-GO preservado:** R01/R02/R04 ainda carecem de projeto Firebase/GCP QA segregado e IAM deny efetivo sobre bancos produtivos; R03 restore testado isoladamente ainda não concluído. O interlock `instrumentation.ts` continua impedindo startup Cloud Run. F09 saída física multi-linha (W3-R20), concorrência F06 completa e prova de bundle Next sem referências produtivas não encerradas.
- **Próximo passo:** após decisão explícita de novo escopo pelo Fundador, preparar projeto GCP/Firebase QA exclusivamente isolado, service identity Cloud Run sem chaves, IAM mínimo, GitHub WIF e quotas/orçamento, em ações separadas auditáveis. Até lá, **não habilitar API Cloud Run, não criar recursos, não modificar Vercel/DNS/Firestore/IAM.**

---

## CLOUD-RUN-R1 — W5 Firebase unificado + F05/F06/F09 (2026-10-15)

- **PR #321 DRAFT** (`feat/cloud-run-r1-w5-firebase-unification`) contra branch W4 do PR #320, HEAD final `dd305184f482ab26e9ea89c030043fbc164dd5c9` — **não fazer merge diretamente na main**. 19 arquivos alterados na comparação incremental W5; nenhuma alteração de Vercel/Firebase/Cloud Run real.
- **Configuração Firebase canônica:** `lib/firebaseEnvironment.mjs` + `lib/firebaseRuntimeConfig.ts`, conectadas a SDK client, JWT Auth, Admin REST, Core e Warehouse, lifecycle, provisionamento, backup, monitoramento e histórico. Em estágio Cloud Run, exige identidade/projeto/app/bancos de homologação distintos, sem chaves admin privadas nem fallback silencioso a produção. Next injeta marcação de ambiente no build e preserva a produção legada Vercel. O scanner W4 só permite import baseline em resolvedor canônico explicitamente auditado; todos os demais imports estáticos de produção identificados no CI foram removidos.
- **GitHub CI final, conferido diretamente:** `Application CI` run **#38836001393 = PASS**, validate-application e seis release gates 16/17/18/19/20/21 SUCCESS; `Core Protection` run **#38836001337 = PASS**. Testes negativos de configuração/ADC, TypeScript budget 0, build standalone de validação Next (sem deploy), segurança multi-tenant e recuperação via Emulator PASS.
- **F05/F06/F09 suites de domínio:** F05 NF→estoque e MOBILE-C PASS; F06 localização/transferências, Integration 2 e MOBILE-K PASS; F09 código de barras/saída, MOBILE-G, logística e MOBILE-K PASS no HEAD final do CI. Esses PASS **não** comprovam fast-path REST em Cloud Run nem negação IAM real; são gates locais/Emulator do pipeline.
- **Correções de gates:** guard de ciclo de vida SaaS atualizado para exigir Warehouse canônico; Browser E2E guard exige marcador demo e projeto E2E no novo resolvedor; mock de Monitoramento Block 16.8 ligado à configuração simulada. Nenhum bypass.
- **NO-GO mantido:** R01/R02/R04 dependem de verificação remota com projeto Firebase/GCP de homologação isolado e identidade ADC de menor privilégio; o interlock `instrumentation.ts` continua impedindo startup Cloud Run. R03 restore isolado não certificado. Nenhuma criação de recursos, IAM/Rules, deploy, DNS, cron, billing ou acesso a dados reais autorizado/executado.
- **Handoff W5** registrado como comentário no PR #321. Próximo: revisão independente do patch, smoke de fast-path F05/F06/F09 estritamente em Emulator, e pedido explícito de autorização para futura infraestrutura isolada quando técnico apto. A Vercel e `emprovex.com.br` permanecem intocados.

---

## CLOUD-RUN-R1 — CI FINAL W4 — PASS 2026-10-15

- **GitHub PR #320** DRAFT, HEAD `144a0f440acfa241d1bdc3f9ccb1fb86bc014f2c`: **Application CI PASS** (workflow run #38834070699, job validate-application + seis gates finais, todos SUCCESS) e **Core Protection PASS** (run #38834070694). Confirmados: build de produção **no CI, sem deploy**; orçamento/final TypeScript; Bloco 16.8 integrado; release gates 16/17/18/19/20/21. Correções seguras foram `2d58c7d` (tipo monitoring credential) e `144a0f4` (mock ADC em VM, falha fechada se invocado); sem relaxamento de gates.
- **Escopo do PASS:** integridade automatizada do PR na branch W4, **NÃO** aceitação de Cloud Run ou ADC real. Testes Cloud Run com IAM efetivo, projeto de testes isolado, bancos separados, unificação de config Firebase/REST/Client e smoke Warehouse F05/F06/F09 ainda necessários. `instrumentation.ts` bloqueia startup Cloud Run; scanner de imports produtivos impede build nesse alvo.
- **Decisão:** W4 preparação local aceita quanto ao CI; **CLOUD-RUN-R1 segue NO-GO**. `main`, `emprovex.com.br`, Vercel, Firebase, Firestore, IAM, DNS, Cloud Scheduler e custos **intocados**. PR #320 sem merge.

---

## CLOUD-RUN-R1 — Recebimento técnico W4 — PR #320 (2026-10-15)

- **W4:** PR #320 DRAFT, branch `feat/cloud-run-r1-w4-local-preparation`; primeiro HEAD `9e8ce77d6e324203034483c01ea89556ab3a40c6`. Entrega inicial de 12 arquivos: guarda fail-closed de build, interlock no runtime Cloud Run, transporte OAuth por identidade gerenciada via metadados, mudanças pontuais em 4 consumidores administrativos, .dockerignore e 26 testes mock-only relatados como PASS. Sem Dockerfile, deploy, merge ou acesso a dados reais. **PREPARAÇÃO PARCIAL — NO-GO.**
- **CI verificado pelo Coordenador:** Core Protection **PASS** no HEAD inicial; Application CI **FAIL** no passo TypeScript error budget (1 erro / budget 0): `lib/server/googleCloudMonitoring.ts:479`, `'cloud-run-managed'` não contemplado por `GoogleMonitoringCredentialSource`. Gates subsequentes ficaram SKIPPED: não declarar validação integrada.
- **Correção localizada:** atualizada união em `lib/platformCapacity.ts` apenas na branch W4, commit `2d58c7d4419aa716cfd410df75abbc619bee2632`, sem desabilitar verificação TS, alteração em IAM ou infra; dois workflows começaram para esse HEAD, **resultado ainda pendente na última consulta**. Revalidar resultados antes de qualquer aceite.
- **Segundo CI verificado no W4:** HEAD `2d58c7d...`: Core Protection PASS; Application CI passou pelo gate TS, mas FAIL no teste Bloco 16.8 (harness VM não reconheceu `./cloudRunManagedToken.mjs`); failures dos release gates são consequência. Patch de teste estritamente mock/fail-closed no HEAD `144a0f440acfa241d1bdc3f9ccb1fb86bc014f2c`; workflows do novo commit enfileirados no último check. Sem alterar mocks para fazer chamada real, sem bypass dos guards. Comentário da coordenação registrado no PR #320.
- **Riscos ainda abertos:** R01/R02/R04 (credencial ADC e IAM reais não testados; imports de Firebase produtivo impedem build Cloud Run e `instrumentation.ts` bloqueia sua inicialização). A proteção de código é preliminar, não prova isolamento de rede/IAM; F05/F06/F09 e Firestore Emulator integrados ainda pendentes. Sem publicação nem autorização de homologação remota.
- **Próximo passo:** concluir workflow no HEAD corrigido, registrar resultado; depois atribuir reconciliação de configuração client/server/REST/bancos com testes isolados e testes Warehouse. Não mover Main nem executar Cloud Run.

---

## CLOUD-RUN-R1 — Preparação técnica W4 autorizada pelo Fundador (2026-10-15)

**Autorização expressa:** começar a **preparação técnica local**, restrita ao GitHub (branch/PR DRAFT) e a testes **offline/Firebase Emulator com dados fictícios**. Abrange avaliar #286/#289, desenvolver proteções fail-closed de homologação, adaptar aquisição de token para ADC preservando a Vercel, preparar container standalone somente local e executar gates proporcionais ao risco. **Não é autorização** para criar projeto Firebase, Cloud Run, IAM/WIF, contas de serviço, modificar bancos/Rules/OAuth/DNS/Vercel, publicar, efetuar merge, testar em produção nem incorrer em custos.

- **PR #286:** DRAFT, base release antiga; **PR #289:** DRAFT, construído sobre #286, contém hipótese de Preview Firebase isolado. Worker 4 deve avaliar semanticamente contra HEAD vivo de main, sem cherry-pick automático, para evitar regressão ou duplicação.
- **Prompt de ativação W4:** `docs/audits/cloud-run-r1/prompts/WORKER_4_PREPARACAO_TECNICA_ADC_ISOLAMENTO.md` nesta branch de coordenação.
- **Riscos-alvo:** R04 isolamento de ambiente, R01 token/ADC e R02 IAM/bancos (apenas preparação local; IAM real permanece pendente); R03 recuperação isolada **não** autorizada nesta etapa. F05/F06/F09 e segurança são gates de regressão com fixtures; não realizar operações reais.
- **Produção:** mantém `emprovex.com.br` na Vercel, Firestore atual, Auth, cron e variável de ambiente intocados. A consulta administrativa indicou backups programados em Core/Warehouse com PITR 7 dias e retenção 98 dias; isso **não** comprova restore. Três variáveis privadas Vercel foram observadas em Production; `CRON_SECRET` não foi encontrada entre as variáveis exibidas e execução automática não foi certificada; coleta de histórico Firestore pode decorrer também de consulta administrativa. Não converter investigação de cron em mutação de produção.
- **Status de release:** CLOUD-RUN-R1 **NO-GO**. O Worker 4 deverá abrir PR DRAFT próprio e solicitar aprovação para qualquer provisão/homologação remota futura.

---

## CLOUD-RUN-R1 — recebimento W2/W3 e reconciliação inicial (2026-10-15)

- **W2 — auditoria administrativa:** [PR #318](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/318), DRAFT, `audit/cloud-run-r1-w2-administrative-evidence@20fcc49068226028111555ef522788bd7c5f70d5`, **6 documentos**. Das verificações X01–X16: **0 integralmente verificadas; 2 inconclusivas (X11/X16); 14 bloqueadas por acesso**. GitHub consultado via integração sem admin: `main protected:false`, rulesets do repositório `[]`, branch-protection detalhada 403; isso **não prova** inexistência de proteções globais ou de Environments. Conta Vercel conectada não pertence ao escopo proprietário e as consultas a `aprov-hgesms-projects` retornaram **403**; não equivale a inexistência de projeto, cron, envs ou backups. Nenhuma console GCP/Firebase/DNS/OAuth/billing foi certificada.
- **W3 — auditoria independente de código:** [PR #319](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/319), DRAFT, `audit/cloud-run-r1-w3-independent-technical@143e91d3d6caf4a4bf252bbe312a58437a0d5460`, **8 documentos**. Foram recuperados e varridos textualmente **65 dos 893 arquivos** da baseline (7,28% da contagem; **não representa cobertura funcional completa**), acrescidos de 12 relatórios W1. Achou **seis riscos adicionais W3-R19 a W3-R24**, exigindo qualificação das conclusões de W1: (R19) GET status pode atualizar claims Auth; (R20) retirada multi-linha realiza commits sequenciais e exige retomada; (R21) erro fast-path 503 não aciona fallback legado; (R22) cron pode responder `ok:true` mesmo com `persisted:false`; (R23) cache HTTP/servidor de regularização pode envelhecer; (R24) planejamento F06 fora da transação exige teste de concorrência, **sem bug demonstrado**. Discrepâncias D01–D03 reconciliadas inicialmente: D01 cache Warehouse entre réplicas ainda não comprovado (mapear importadores), cache do servidor Billing comprovado; D02 PATCH do cron com documento determinístico não cria duplicata simples, mas execução dupla/custos e `persisted:false` continuam riscos; D03 consumo imediato com commit conjunto difere de retirada multi-linha sequencial, exigindo teste de recuperação. Detalhes: `docs/audits/cloud-run-r1/00_CONSOLIDACAO_COORDENADOR_W1_W2_W3.md` (PR #317).
- **Painel consolidado provisório:** W1 18 riscos + W3 6 novos = **24 riscos inventariados, não 24 incidentes comprovados**; R01–R04 seguem BLOCKER, R05/R06 CRÍTICO, nenhum G01–G16 aprovado. W1 #316, coordenação #317, W2 #318 e W3 #319 **abertos em DRAFT, sem merge**. Não presumir que os documentos desses PRs integrem a `main`.
- **Orientação imediata, sem alteração produtiva:** obter do titular **cinco pacotes sanitizados de metadados** descritos em [W2/F1–F5](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/audit/cloud-run-r1-w2-administrative-evidence/docs/audits/cloud-run-r1/worker-2/05_PENDENCIAS_PARA_FUNDADOR_E_COORDENADOR.md): (F1) projetos/Firestores/IAM/backups; (F2) Vercel environments/deploy/cron; (F3) Auth/OAuth/App Check; (F4) DNS/TLS/billing; (F5) proteções do GitHub. **Nunca enviar valores de segredos, JSON, senhas ou tokens.** Reconciliar PRs #286/#289 antes de fixar runtime/alvo de release. Para testes somente leitura, evitar `GET /api/central-depositos/status` com contas reais sem antes certificar ausência de mutação de claims. Não executar backup/restore/deploy/cron ou consultas que escrevam dados.
- **Decisão de coordenação:** **NO-GO permanece**. Nenhuma migração, provisionamento, alteração de produção, DNS, Auth, IAM, Firestore, Rules, billing ou cron; demais fases exigem autorização do Fundador, homologação isolada, gates e recuperação provada. Estes achados são **registrados no PR #317** para revisão e não representam atualização integrada à `main`.

**Handoff:** ONDE — Vercel preservada, auditorias W1/W2/W3 documentadas; O QUE — reconciliar 24 riscos, discrepâncias e evidências; QUEM — Coordenador com apoio dos titulares das contas; PRÓXIMO — F1–F5 e bloqueadores R01–R04; RESPONSÁVEIS — proprietários pelas consultas de console, Coordenador pelos gates, Fundador pelo GO/NO-GO.

---

## Checkpoint vigente — 2026-10-15 · CLOUD-RUN-R1 — auditoria e coordenação de continuidade

**Decisão do Fundador / coordenação:** estudar a substituição definitiva da Vercel pelo Google Cloud Run sem perder funcionalidade, dado, histórico, integração, segurança, disponibilidade ou previsibilidade de custo. **MIGRAÇÃO NÃO AUTORIZADA — NO-GO.** O site `https://emprovex.com.br` permanece na Vercel, com configuração atual de publicação manual (D-127) e cron existentes; não alterar DNS, OAuth, Firebase, IAM, dados, Rules, cron, deploy ou faturamento por esta frente documental.

- **Worker 1 / auditoria inicial:** [PR #316](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/316), **DRAFT, aberto e não integrado**, branch `audit/cloud-run-r1-full-compatibility`, HEAD `1a2551ac09ef1f155b27002a18119940fecb63f9`; baseline `main@2b1241fe3abd96c67766caf065d24a4b2a223b98`. Entregou **12 documentos** em `docs/audits/cloud-run-r1/`, **14 categorias de dependências**, **18 riscos** (4 BLOCKER, 2 CRÍTICO, 6 ALTO, 5 MÉDIO, 1 INFORMATIVO), **16 verificações externas** e **16 gates** futuros. **Parecer: AUDITORIA DOCUMENTAL PARCIAL — EVIDÊNCIAS EXTERNAS PENDENTES**. A árvore de 893 arquivos foi inventariada, mas **não** houve análise semântica exaustiva dos 893 arquivos, testes reais, recuperação isolada nem leitura dos painéis administrativos; não atribuir PASS indevido.
- **Bloqueadores ativos:** R01 — código de token/admin/fast-path depende de `FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON` e não suporta ADC puro; R02 — IAM dos **dois bancos Firestore nomeados** ainda não verificado; R03 — restauração efetiva dos dados, especialmente Warehouse, não comprovada em ambiente isolado; R04 — separação técnica entre homologação e produção não demonstrada, inclusive variáveis `NEXT_PUBLIC_*` incorporadas ao build. **Nenhum desses bloqueadores foi resolvido pela auditoria documental.**
- **Outros riscos prioritários:** R05 cron `/api/cron/usage-snapshot` às 09:15 UTC (Vercel) exige execução exclusiva, autenticação e prevenção de duplicidade; R06 OAuth/Firebase/Drive; R07 proxy `x-vercel-forwarded-for` e rate-limit em memória; R08 limite de 60 s do rewrite Firebase Hosting → Cloud Run; R09 cache entre instâncias; R10 build que ignora erros de TypeScript/ESLint; R11 domínio, DNS, TLS e rollback; R18 governança de proteção da `main`. Não implementar solução antes de obter provas e aprovação.
- **Worker 2 — Auditoria administrativa e infraestrutura:** verificar **por leitura**, com autorização de acesso, contas e configurações reais de Vercel, Firebase, GCP, IAM, OAuth, DNS, backups, billing e governança. Priorizar X01–X08 e X11 e continuar X09–X16 conforme acesso; registrar evidências sanitizadas e pendências. Prompt: [WORKER_2_AUDITORIA_ADMINISTRATIVA_INFRAESTRUTURA.md](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/docs/cloud-run-r1-coordination-workers-20261015/docs/audits/cloud-run-r1/prompts/WORKER_2_AUDITORIA_ADMINISTRATIVA_INFRAESTRUTURA.md).
- **Worker 3 — Auditoria técnica independente:** realizar inspeção aprofundada de código, runtime, variáveis, acessos ao Firestore, ADC, fluxos F05/F06/F09, isolamento, auth/Drive, cron, segurança do proxy, cache, qualidade e testes necessários. Produzir análise independente, plano de adaptação e matriz de evidências, **sem modificar código operacional**. Prompt: [WORKER_3_AUDITORIA_TECNICA_INDEPENDENTE.md](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/docs/cloud-run-r1-coordination-workers-20261015/docs/audits/cloud-run-r1/prompts/WORKER_3_AUDITORIA_TECNICA_INDEPENDENTE.md).
- **Execução paralela:** ambos consultam os 12 documentos do PR #316 como referência **ainda não integrada**; HEAD da `main` e estado dos PRs devem ser verificados novamente ao iniciar. Cada worker opera em branch própria e abre PR documental em **DRAFT**, sem merge nem alteração de produção. Divergências com o Worker 1 devem ser registradas, não encobertas.
- **Critério para avanço:** Coordenador reconcilia provas dos Workers 2/3 e revisa riscos/gates. Homologação, Docker, ADC operacional, recuperação real, criação de Cloud Run, custo, DNS, cron e cutover dependem de fases posteriores e autorizações específicas. **Rollback de aplicação não reverte transações Firestore**; exigir proteção de dados e recovery demonstrado, de forma independente. Fundador mantém decisão final GO/NO-GO.

**Handoff:** ONDE — Vercel operante, CLOUD-RUN-R1 em auditoria; O QUE — lacunas externas e revisão independente; QUEM — Workers 2/3, administração das plataformas e Coordenador; PRÓXIMO — obter evidências e consolidar mitigação dos quatro blockers; RESPONSÁVEIS — workers em PRs separados, titular das contas para consultas administrativas, Coordenador para gates e Fundador para autorizações.

> Este checkpoint atual é a referência para CLOUD-RUN-R1; preserva a cronologia e o checkpoint anterior de Release Premium/Vercel. Os detalhes devem permanecer nos relatórios e PRs especializados, sem inflar o memorial com logs ou prompts integrais.

---


## Checkpoint operacional vigente — 2026-10-15 · Release Premium + proteção da cota Vercel

- **Produção:** https://emprovex.com.br — Fundador confirmou a publicação consolidada e a **validação visual das melhorias** após release em `main@63aad90bf80a50cf1cf875024cde21d5e792a3cf` (`chore(release): EMPROVEX Central de Depositos Premium`). Build de produção e prebuild pelo PowerShell aprovados; a confirmação de uso no site foi humana, não uma nova inspeção remota por este agente.
- **PR #314:** integrado em `303ffb7389d0ab5d3559767b7e9c2e3dd735b603` (D-123 a D-126). Central de Depósitos `/central-depositos`, Operador Móvel `/operador-movel`, visual premium e croqui 3D com autoenquadramento/rotação física das vistas Frente, Direita, Trás e Esquerda. Rotas antigas mantidas por redirects/aliases. Cinco gates automatizados PASS no PR. Validação visual humana declarada pelo Fundador como concluída após publicação.
- **Política operacional de custo de deploy (D-127):** `vercel.json → git.deploymentEnabled = false` desativa gatilhos automáticos GitHub → Vercel em **todas** as branches, inclusive `main`; validação por `scripts/vercel-manual-deploy.test.mjs` no Application CI. Cron diário de uso às 09:15 UTC (`/api/cron/usage-snapshot`) preservado. Repositório GitHub e integração continuam utilizáveis para código/CI; a publicação na Vercel é **manual e consolidada**, via `vercel pull --environment=production`, `vercel build --prod`, `vercel deploy --prebuilt --archive=tgz --prod --scope aprov-hgesms-projects` em worktree limpa e com identidade de autoria autorizada. A política não desliga os gates nem impede deploy manual de preview sob demanda.
- **Limite de verificação:** a configuração versionada é fonte de verdade após integração na `main`; não houve confirmação administrativa pelo conector da equipe Vercel (permissão 403). Verificar no painel Vercel se algum outro gatilho externo/deploy hook continua ativo; não assumir que os 100 deployments anteriores vieram exclusivamente do GitHub.
- **Segurança e dados:** não altera Firestore, Rules, estoque, autenticação, cron nem domínio público da versão já publicada. Este checkpoint substitui as notas antigas abaixo que ainda descrevem PR #314 como DRAFT/Preview pendente; essas notas permanecem apenas como rastreabilidade histórica.

---

**Notas históricas do desenvolvimento anterior à publicação de 2026-10-15 (superadas quando conflitarem com o checkpoint acima):**

> **Auditoria adicional de vistas — 2026-10-15 (D-126, PR #314):** corrigida deformação de pallets/locais ao mudar para Direita/Esquerda em depósitos retangulares. A rotação agora preserva medidas reais, troca as dimensões projetadas do cômodo e mantém vínculo das subposições e materiais. Incluídos testes de regressão em quatro vistas e geometrias alongadas; aguarda gates e smoke visual humano.
> **Visão 3D de Meus Depósitos — 2026-10-15 (D-126, PR #314 em validação):** substituição do viewBox fixo por auto-fit centralizado com base na geometria isométrica de piso, paredes, estruturas e etiquetas, recalculado em cada perspectiva. Proporções, estoque e persistência preservados; sem leituras extras no Firestore. CI e smoke visual pendentes, produção não alterada.

> **Visual Operador Móvel — 2026-10-15 (D-125, PR #314 em validação):** redesenho da home do Operador Móvel para superfície institucional premium, com cabeçalho contextual/UG real, painel de acesso autorizado e leitura por etiqueta sob demanda, oito cartões em grupos **Movimentações** e **Consulta e conferência**, estados de foco/toque e movimento reduzido. Sem novas leituras ao Firestore, sem efeito orbital pesado ou alteração da operação. Navegação inferior contextual segue D-124. Aguardando CI e validação humana; produção não alterada.

> **Operador Móvel — 2026-10-15 (PR #314 em validação):** a antiga identificação pública **Central Móvel** passa a ser **Operador Móvel**, integrado visualmente à barra lateral da Central de Depósitos (abaixo dos demais recursos). Endereço canônico `/operador-movel`, redirects dos links antigos `/central-mobile`, mesmo acesso founder-only e contratos de estoque preservados. Referência: D-124. Sem merge/deploy de produção nesta etapa.

> **Roteamento oficial da Central de Depósitos — 2026-10-15 (refatoração em branch):** nome de produto **Central de Depósitos**, rota pública canônica `/central-depositos` e APIs `/api/central-depositos/{status,intake-action}`. A rota `/adm-deposito` recebe redirect permanente, enquanto as APIs legadas preservam aliases diretos sem mudar o método HTTP. Firestore, namespace `warehouse`, regras e IDs persistidos permanecem intactos. Decisão D-123 em `docs/adm-deposito/DECISIONS.md`; aguardando os gates do PR e eventual autorização de merge/deploy.

> **Atualização pontual — 2026-10-15 (Central de Depósitos):** saldo legado de testes do Suco, 5 unidades em `UNASSIGNED`, **regularizado com PASS no Firestore real**. A alteração foi exclusivamente de dados, sem deploy, merge, Rules ou atualização da aplicação. Evidências: [PR #310](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/310), `docs/WAREHOUSE_INTEGRITY_RECONCILE_01.md` e `docs/WAREHOUSE_DATA_REPAIR_EXECUTION_01.md`. **A sincronização global e os demais estados abaixo permanecem no recorte histórico indicado (2026-10-04); esta nota não certifica outros programas nem todos os saldos dos depósitos.**


Sincronização global histórica de referência: **2026-10-04 — SESSION-CAP-01 + RULES-AUDIT-01 encerradas / pré-composição do RC** (estado superado para release e navegação pelo checkpoint de 2026-10-15).

Produção na baseline histórica de 2026-10-04: `main@e90f92acae1514ee5cbc6ce95fed354bc1454330` (não é a release vigente; ver checkpoint de 2026-10-15).

Integradora SaaS R1: `feat/saas-r1-commercializacao@54aba792cb9e7bb195e21401fb50a21ed50add19` — SESSION-CAP-01 integrada; commits posteriores podem ser documentais de Program Control

Integradora Mobile R1: `feat/central-mobile-r1@7b7717b6eebabf911310d2b8ac56ed13c9cb9238` — avanço documental, sem novo delta runtime

Estado global: **Performance R3 em produção; desenvolvimento funcional SaaS R1 e Mobile R1 encerrado; SESSION-CAP-01 em PASS técnico completo e integrada na linha SaaS/RC; RULES-AUDIT-01 em PASS — RULES APTAS PARA RC; TTL produtivo de sessionSlots/sessionRevocations ACTIVE; HARDEN-A1/A2/C/D em PASS; HARDEN-B parcial por dependência temporal; MOBILE-J aguarda Preview HTTPS; composição do RC único SaaS+Mobile é a próxima barreira; Preview HTTPS ainda não publicado.**

---

## 0. Finalidade e regra de leitura

Este é o **documento de entrada canônico do EMPROVEX**.

O objetivo do Memorial é permitir que um novo Coordenador, worker ou sessão de continuidade responda rapidamente:

1. o que está efetivamente em produção;
2. quais programas estão ativos;
3. quais contratos estão congelados;
4. quais riscos e bloqueios permanecem;
5. qual é o próximo gate global;
6. onde encontrar a evidência detalhada.

O Memorial **não apaga histórico** e não substitui os documentos especializados. Ele organiza o conhecimento em camadas.

### Camadas documentais

**Camada 1 — Estado global e contratos vigentes**

Este arquivo: `docs/EMPROVEX_MEMORIAL_OFICIAL.md`.

**Camada 2 — Estado operacional de cada programa**

- `docs/SAAS_R1_INTEGRATION_STATUS.md`
- `docs/SAAS_R1_COORDENADOR_HANDOFF.md`
- `docs/CENTRAL_MOBILE_R1_INTEGRATION_STATUS.md`
- `docs/CENTRAL_MOBILE_R1_COORDENADOR_HANDOFF.md`
- planos mestres e documentos especializados de cada programa.

**Camada 3 — Histórico detalhado integral**

`docs/EMPROVEX_MEMORIAL_HISTORICO_ATE_2026-10-03.md`

Esse arquivo contém **a versão anterior completa do Memorial, preservada integralmente**, incluindo registros de PRs, commits, métricas, fases, incidentes, decisões e checkpoints históricos.

### Regra de precedência canônica

Quando houver divergência aparente entre trechos, aplicar esta precedência:

1. **Snapshot Global + Contratos Permanentes deste Memorial** — estado vigente;
2. **documentos especializados de Integration Status / Coordenador / runbooks** — evidência operacional detalhada;
3. **Cronologia e checkpoints históricos** — explicam como o estado foi alcançado, mas não revogam decisão posterior;
4. **Memorial Histórico Integral / Git history** — arquivo de rastreabilidade, não estado vivo.

Um checkpoint histórico que diga “bloqueado”, “parcial” ou “aguardando” deixa de governar o sistema quando uma seção posterior e vigente registrar explicitamente PASS/encerramento.

Números operacionais devem refletir o **runtime atual**. Se uma especificação antiga divergir do código integrado, o Memorial deve registrar o contrato efetivamente implementado e apontar a divergência como histórica.

### Regra estrutural a partir desta reorganização

Novos estados não devem ser simplesmente anexados ao fim do Memorial.

Sempre atualizar primeiro:

1. **Snapshot Global**;
2. **Programa afetado**;
3. **Riscos/Gates**;
4. **Cronologia**, quando houver marco histórico;
5. documento especializado correspondente.

Quando um estado deixar de ser vigente, ele deve sair do quadro vivo e permanecer na cronologia/documentação histórica.

### Concorrência documental

Como SaaS e Mobile podem atualizar documentação em paralelo, qualquer edição do Memorial deve:

- reler o HEAD vivo imediatamente antes da gravação;
- preservar alterações concorrentes;
- mover novos checkpoints para a seção temática correta;
- nunca sobrescrever uma atualização de outro Coordenador apenas para restaurar uma versão anterior.


---

# PARTE I — ESTADO VIVO

## 1. Snapshot Global

> **Critério temporal:** a linha Produção está reconciliada com o checkpoint 2026-10-15 acima; as demais linhas SaaS/Rules/RC sem atualização datada nesta rodada conservam o recorte histórico do programa e **não** são consideradas re-certificadas por este ajuste de deploy.

| Domínio | Estado vigente | Contrato/observação |
| --- | --- | --- |
| Produção | **EMPROVEX Premium — PUBLICADO / VALIDAÇÃO HUMANA CONFIRMADA (15/10)** | `main@63aad90bf80a50cf1cf875024cde21d5e792a3cf`; PR #314 integrado, prebuild Vercel aplicado |
| SaaS R1 | **FUNCIONALMENTE CONCLUÍDO / PRONTO PARA RC** | A1/A2/C/D PASS; B parcial/temporal |
| Mobile R1 | **FUNCIONALMENTE CONCLUÍDO** | A–I integradas; MOBILE-J em certificação final |
| MOBILE-J | **PARCIAL TECNICAMENTE SAUDÁVEL / CERTIFICAÇÃO EM EXECUÇÃO** | aguarda RC em Preview HTTPS para testes físicos reais |
| SESSION-CAP-01 | **PASS TÉCNICO COMPLETO / INTEGRADA** | PR #248 squash-merged; sessões externas dinâmicas sem teto fixo |
| RULES-AUDIT-01 | **PASS — RULES APTAS PARA RC** | Rules vivas sem drift; TTL dos dois grupos ACTIVE |
| RC conjunto | **PRONTO PARA COMPOSIÇÃO / NÃO CONGELADO** | SESSION-CAP + RULES-AUDIT encerradas; próximo trabalho transversal |
| CT-01 | **PENDENTE NO RC** | `camera=(self), microphone=(), geolocation=()` |
| Rules candidatas | **AUDITADAS / APTAS PARA RC** | produção R3 sem drift; principal RC `bc91185...`; Warehouse RC `6e1f105...`; rollout Rules RC → app RC |
| HARDEN-B | **PARCIAL / ESPERA CONTROLADA** | PITR/delete protection/schedule/retention ativos; backup READY/verify/restore pendentes |
| Warehouse — saldo legado Suco (2026-10-15) | **PASS — REPARO DE DADOS CONFIRMADO** | 5 `UNASSIGNED` → 0, saldo agregado 5 → 0; ledger de ajuste preserva a trilha; PR #310 DRAFT; demais materiais não foram auditados neste evento |
| Billing R1 | **IMPLEMENTADO EM MODO OBSERVE** | R$ 70; trial; cobrança externa; confirmação manual; sem suspensão automática |
| Piloto real | **NÃO INICIADO** | vem depois do RC tecnicamente fechado/publicação controlada |
| Abertura comercial ampla | **NÃO AUTORIZADA** | exige piloto, correções, SAAS-J e GO explícito do Fundador |

### Snapshots técnicos relevantes

- SaaS/RC após SESSION-CAP + RULES-AUDIT: `54aba792cb9e7bb195e21401fb50a21ed50add19`;
- Mobile integradora documental: `7b7717b6eebabf911310d2b8ac56ed13c9cb9238`;
- MOBILE-J: `mobile-r1-j-final-certification@90d646372aae3e92318a78b90d71f72c5eb6b00e`;
- HARDEN-B: `saas-harden-b-recovery-restore@910cca1ea9f14e4ef080ee649624042f63206d51`.

A produção só muda por autorização explícita e posterior do Fundador.

## 2. Próxima barreira global

A próxima fase não é nova feature. É **Release Engineering / Certificação**.

Sequência canônica:

```text
SaaS final + Mobile final
→ SESSION-CAP-01 — PASS / integrada
→ RULES-AUDIT-01 — PASS / Rules aptas para RC
→ branch única de composição do RC
→ reconciliação semântica dos contratos compartilhados
→ CT-01
→ Rules/package/lockfile/Application CI consolidados
→ gates no SHA exato
→ RC CANDIDATE
→ RC FROZEN
→ Preview HTTPS
→ testes SaaS + MOBILE-J físicos
→ correções rastreáveis, se houver
→ nova reconciliação/freeze quando necessário
→ GO/NO-GO explícito
→ eventual produção controlada
→ piloto real
→ correções pós-piloto
→ SAAS-J
→ autorização explícita
→ abertura comercial ampla
```

### Condições para declarar RC CANDIDATE

Obrigatório:

- SESSION-CAP-01 concluída e reconciliada, salvo decisão explícita do Fundador de adiar a mudança para release posterior;
- RULES-AUDIT-01 concluída em **PASS** sobre o ruleset final pós-SESSION-CAP-01;
- nenhuma Rule produtiva nova pode ser publicada sem esse PASS;
- nenhum novo conflito SaaS↔Mobile;
- CT-01 materializada;
- Rules candidata principal e warehouse registradas;
- rollback de Rules preparado;
- package/lockfile/CI reconciliados;
- build/TypeScript/diff hygiene verdes;
- Core/Legal/Recovery e segurança multi-tenant verdes;
- contratos de Auth/workspace/UG/sessão/lifecycle/Legal/billing/Central coerentes;
- source of truth logística única.

### Condições para RC FROZEN

Registrar no mínimo:

- `RC_BRANCH`;
- `RC_SHA`;
- `SAAS_SOURCE_SHA`;
- `MOBILE_SOURCE_SHA`;
- resultado HARDEN-A2;
- hashes das Rules de produção e do RC;
- hash de `next.config.ts`;
- hash de `package-lock.json`;
- resultados dos gates.

Após o freeze, só entram correções de blocker, regressão, segurança ou defeito real da certificação. Não entram melhorias oportunistas.

# PARTE II — GOVERNANÇA GLOBAL

## 3. Hierarquia oficial

### Fase funcional — modelo histórico

Durante o desenvolvimento paralelo:

```text
Fundador
→ Coordenador Geral / Program Control
   → Coordenador SaaS R1
   → Coordenador Mobile R1
      → workers especializados
```

### Fase atual — composição do RC

Por decisão do Fundador, o **Coordenador Geral também assume a Coordenação operacional do RC**.

Modelo vigente:

```text
FUNDADOR
   ↓
PROGRAM CONTROL + COORDENAÇÃO DO RC
   ├── Coordenador SaaS — consulta/evidência sob demanda
   ├── Coordenador Mobile — consulta/evidência sob demanda
   ├── HARDEN-B — frente especializada temporal
   └── MOBILE-J — frente especializada de certificação física
```

Os Coordenadores SaaS e Mobile não foram apagados: permanecem como fontes especializadas de contexto e evidência. Porém **não existe nova wave funcional autorizada** em nenhum dos dois programas.

### Separação de autoridade mesmo no mesmo chat

O mesmo chat pode executar dois papéis, mas as decisões continuam separadas por evidência:

- **Coordenação RC**: compõe candidato, reconcilia, executa gates, prepara Preview e consolida evidências;
- **Program Control**: aceita/rejeita checkpoints, declara RC CANDIDATE/FROZEN, classifica risco e prepara GO/NO-GO;
- **Fundador**: autoriza ações produtivas protegidas e lançamento.

O Coordenador Geral não transforma “continue”, “próximo passo”, CI verde ou PASS técnico em autorização de produção.

## 4. Classificação oficial de problemas

- **LOCAL** → worker.
- **PROGRAM** → Coordenador do programa.
- **TRANSVERSAL** → Coordenador Geral.
- **RELEASE/PRODUÇÃO** → Coordenador Geral + Fundador quando aplicável.

## 5. Semáforo global

- **VERDE** — pode prosseguir.
- **AMARELO** — risco/delta conhecido; pode avançar até a próxima barreira.
- **VERMELHO** — bloquear somente a menor unidade necessária.

O objetivo é evitar que um risco localizado paralise programas independentes.

## 6. WIP e desenvolvimento paralelo

O EMPROVEX adota como método oficial:

> **frentes independentes em paralelo + integração semântica + barreiras explícitas de sincronização.**

A capacidade de revisão determina o WIP, não a quantidade possível de chats.

SaaS e Mobile podem evoluir simultaneamente enquanto seus contratos comuns permanecerem compatíveis.

Não fazer sincronização por merge/rebase cego entre integradoras.

---

# PARTE III — PRODUTO E ARQUITETURA

## 7. Stack vigente

- Next.js 15 / App Router;
- Firebase Auth;
- Firestore;
- Cloud Monitoring;
- Vercel;
- Vercel Blob;
- integrações Google usadas pelos fluxos institucionais.

## 8. Núcleo funcional do EMPROVEX

Capacidades consolidadas incluem:

- Empenhos;
- Itens;
- Notas Fiscais;
- Comissão;
- Tesouraria/Liquidação;
- Cronogramas/Entregas;
- Central de Avisos;
- Relatórios/SAG;
- Administração;
- usuários e sessões;
- telemetria/consumo;
- Central de Depósitos;
- Central Móvel R1 em desenvolvimento.

Performance R3 é a baseline de produção atual.

## 9. Contratos de identidade, sessão e multi-tenant

### 9.1 Identidade autenticada

Fonte: Firebase Auth.

Contrato atual:

- fundador: login **Google-only**;
- usuários externos/setores: login **e-mail/senha only**;
- e-mail verificado é obrigatório;
- sessão com provider inesperado falha fechada;
- Mobile e Desktop usam a mesma identidade; não existe Auth Mobile paralelo.

### 9.2 Relação conta ↔ workspace ↔ UG

Na R1:

- 1 cliente operacional externo = 1 workspace;
- 1 workspace = 1 UG;
- 1 workspace externo possui 1 conta operacional primária;
- conta, workspace e sessão precisam concordar em e-mail/UID/workspace/UG;
- inconsistência de UID, e-mail, UG, status ou provider resulta em **fail-closed**;
- o usuário não recebe subscriptions operacionais antes da validação do contexto.

### 9.3 UID e primeiro vínculo

Contas novas já podem chegar pré-vinculadas ao UID Firebase pelo provisionamento.

Para registros legados sem UID, o bootstrap histórico de primeiro acesso pode vincular o UID após validar:

- e-mail;
- provider;
- conta ativa;
- workspace ativo;
- UG coerente.

Após o vínculo, e-mail idêntico não basta: o UID precisa continuar sendo exatamente o mesmo.

### 9.4 Sessões simultâneas — contrato de runtime atual

O runtime atualmente integrado define:

- usuário externo: **sem teto fixo de sessões simultâneas por workspace/UG no candidato integrado**;
- founder: **isento do limite de capacidade**;
- documentos de sessão: IDs dinâmicos por `browserInstanceId`; `slot-1` e `slot-2` permanecem apenas como compatibilidade transitória;
- lease nominal: **30 minutos**;
- heartbeat/renovação nominal: **15 minutos**;
- decisão temporal baseada em relógio confiável do servidor, não no relógio local do Windows;
- revogação administrativa cria tombstone e remove slots conhecidos;
- perda de lease/revogação/mudança de acesso invalida a sessão local.

**Estes números 30/15 são o contrato implementado atual e substituem referências históricas anteriores com valores diferentes.**

### 9.4.1 Mudança autorizada — remoção do teto fixo de duas sessões

Decisão do Fundador em 2026-10-03:

**o limite fixo de 2 sessões simultâneas para usuários externos deve ser removido.**

Motivação operacional:

- a Central Móvel R1 transforma o celular em ferramenta operacional do depósito;
- uma única equipe pode precisar de vários operadores simultâneos;
- alocação, conferência, inventário, transferência e saída podem ocorrer em paralelo;
- limitar o workspace a apenas duas sessões cria gargalo artificial justamente no cenário Mobile;
- Desktop e múltiplos celulares precisam poder coexistir durante a operação.

### Estado atual versus estado alvo

**Estado integrado na linha SaaS/RC:**

- limite externo: **sem teto fixo**;
- documentos: `sessionSlots/{browserInstanceId}`;
- compatibilidade transitória: `slot-1` e `slot-2`;
- lease: 30 minutos;
- heartbeat: 15 minutos;
- revogação administrativa: ativa;
- painel de sessões: ativo;
- telemetria: ativa;
- TTL `expiresAt`: ACTIVE em `sessionSlots` e `sessionRevocations`.

**Estado alvo autorizado e alcançado:**

- **sem teto fixo de duas sessões por workspace/UG**;
- permitir múltiplas sessões externas simultâneas compatíveis com o uso operacional real;
- manter controle individual de identidade de cada sessão;
- manter lease, heartbeat, revogação, auditoria e telemetria;
- manter possibilidade de encerramento remoto de uma sessão específica;
- manter lifecycle fail-closed;
- manter proteção cross-workspace;
- não transformar “sem limite fixo” em “sem controle de sessão”.

### Princípio arquitetural

A mudança deve remover o **limite de capacidade**, não remover a **camada de segurança de sessão**.

Continuam obrigatórios:

- `sessionId`;
- `browserInstanceId`;
- UID;
- e-mail;
- workspaceId;
- UG;
- lease temporal;
- heartbeat;
- tombstone de revogação;
- invalidação por mudança de acesso;
- painel administrativo de sessões;
- auditoria `session.terminate`;
- telemetria de sessões/consumo.

### Implicação técnica conhecida

A implementação atual usa apenas:

- `slot-1`;
- `slot-2`.

Portanto **não basta alterar `DEFAULT_EXTERNAL_SECTOR_SESSION_LIMIT`**.

A frente deverá substituir a reserva física fixa por uma coleção de sessões dinâmicas ou mecanismo equivalente, preservando identidade e revogação.

Direção preferida:

```text
workspaces/{workspaceId}/sessionSlots/{sessionIdOuIdDinamico}
```

ou contrato equivalente que:

- aceite N sessões simultâneas;
- permita identificar cada sessão;
- permita revogar uma sessão específica;
- permita listar sessões no painel;
- permita expiração por lease;
- impeça overwrite de sessão alheia;
- preserve isolamento por workspace.

O nome final do documento/coleção pode ser mantido por compatibilidade se isso simplificar a migração, mas o ID não deve continuar restrito a `slot-1`/`slot-2`.

### Momento ideal de execução

Esta alteração deve ser executada:

**ANTES DO RC CANDIDATE / ANTES DO RC FROZEN.**

Motivo:

- a certificação física Mobile deve representar o comportamento real que será lançado;
- testar o RC com limite 2 e removê-lo depois invalidaria parte da certificação;
- a mudança toca Auth/sessão/Rules/telemetria e precisa estar estabilizada antes do Preview final.

Sequência recomendada:

```text
estado atual consolidado
→ frente transversal SESSION-CAP-01
→ regressão de Auth/sessão/Rules/telemetria
→ integração SaaS + Mobile
→ composição do RC
→ freeze
→ Preview HTTPS
→ testes físicos com múltiplos operadores
```

Se a composição do RC já tiver começado quando a frente for ativada, a alteração deve entrar **antes do freeze**, com repetição dos gates afetados.

Não aplicar após `RC FROZEN` como melhoria oportunista; nesse caso, somente reabrir o freeze por decisão explícita do Program Control/Fundador.

### Escopo executado/auditado da SESSION-CAP-01

Arquivos/contratos afetados ou auditados:

- `lib/platformCapacity.ts`;
- `lib/platformSessionLease.ts`;
- `lib/platformSessionControl.ts`;
- `lib/platformAdminSessions.ts`;
- `hooks/useOperationalData.ts`;
- `hooks/usePlatformAdminSessions.ts`;
- painel administrativo de sessões;
- provisionamento/exclusão de setor;
- lifecycle/suspensão;
- `firestore.rules`;
- testes multi-tenant;
- E2E de sessão;
- guards Block 16.0/16.1/16.2;
- guards Block 17.1/17.2;
- telemetria/consumo;
- documentação de capacidade.

### Regras de segurança da alteração

A remoção do teto não pode:

- permitir sessão de outro workspace;
- aceitar UG divergente;
- permitir uma sessão renovar lease de outra;
- permitir recriar sessão revogada;
- permitir que cliente altere identidade do lease;
- remover revogação administrativa;
- remover expiração temporal;
- remover painel de sessões;
- remover auditoria;
- quebrar suspensão/reativação;
- criar acesso anônimo ou bypass de Auth.

### Performance e custo

Mais sessões simultâneas podem aumentar:

- listeners;
- reads;
- writes de heartbeat;
- conexões;
- consumo Firestore;
- telemetria.

Por isso a frente deve medir:

- custo por sessão;
- writes de heartbeat;
- listeners por aba;
- pico de sessões por workspace;
- impacto no Cloud Monitoring;
- comportamento com vários celulares simultâneos.

A ausência de teto fixo não elimina observabilidade de capacidade. O EMPROVEX deve continuar podendo alertar sobre uso anormal ou excessivo.

### Critérios de aceitação utilizados

A frente foi considerada PASS após provar:

1. terceiro, quarto e demais logins externos não são bloqueados apenas por capacidade fixa;
2. cada navegador/celular possui identidade de sessão coerente;
3. múltiplas abas da mesma sessão continuam sem duplicação indevida de lease;
4. revogação de uma sessão não derruba sessões diferentes sem intenção;
5. suspensão do workspace invalida todas as sessões operacionais;
6. reativação não ressuscita tombstones antigos;
7. Rules permanecem fail-closed;
8. cross-workspace continua DENY;
9. painel admin lista/encerra sessões corretamente;
10. telemetria registra aumento de sessões;
11. Android + Desktop + múltiplos celulares podem coexistir;
12. Application CI/Core/Rules/multi-tenant/build/typecheck/diff hygiene passam;
13. MOBILE-J repete os testes afetados no RC.

### Classificação

Esta é uma **mudança funcional explicitamente autorizada pelo Fundador**, apesar do freeze geral de novas features.

Ela é tratada como exceção controlada porque remove uma limitação operacional que conflita diretamente com o uso Mobile do depósito.

A implementação e a certificação técnica da SESSION-CAP-01 foram concluídas em PASS; a mudança está integrada na linha SaaS/RC, ainda sem promoção da aplicação RC à produção.

### 9.5 Lifecycle observado em tempo real

Sessões externas monitoram:

- `workspaces/{workspaceId}`;
- `platformAccounts/{email}`;
- revogação da sessão.

Se workspace/conta deixa de estar `active`, identidade deixa de coincidir ou Rules negam acesso, a sessão é invalidada.

### 9.6 Autoridade da Central

A Central de Depósitos adiciona `warehouseAccess` como autorização específica do banco `emprovex-warehouse`.

Suspensão/reativação coordenada deve preservar coerência entre:

- workspace;
- platformAccount;
- warehouseAccess;
- sessões.

### 9.7 Regra multi-tenant

Nunca criar caminhos alternativos que permitam:

- ler outro workspace;
- trocar workspaceId/UG por input do cliente;
- usar barcode como autorização;
- contornar `warehouseAccess`;
- confiar apenas em estado visual/client-side.

Auth, workspace/UG, Legal Gate, lifecycle, sessão e Rules são contratos compartilhados por SaaS, Desktop e Mobile.

# PARTE IV — CENTRAL DE DEPÓSITOS

## 10. Nome e compatibilidade

Nome vigente de produto: **Central de Depósitos**.

O caminho técnico histórico `adm-deposito` e documentos antigos permanecem por compatibilidade.

## 11. Fontes da verdade logísticas

Não criar fontes paralelas para:

- material;
- posição;
- saldo;
- lote;
- barcode;
- ledger;
- transferência;
- autorização de depósito.

Contratos centrais reutilizados pelo Desktop e pela Mobile:

- materiais canônicos;
- depósitos/localizações/subposições;
- `WarehouseStockPosition`;
- lotes/validade;
- FEFO;
- barcode;
- ledger;
- saldos materializados;
- intake;
- transferência;
- outbound.

### 11.1 Saneamento pontual do saldo legado de testes — Suco (2026-10-15)

**Estado: PASS — dados reais regularizados; não houve alteração de runtime.**

- **Contexto anterior:** `docs/WAREHOUSE_INTEGRITY_RECONCILE_01.md` comprovou um saldo positivo de 5 unidades em `UNASSIGNED`; `docs/WAREHOUSE_DATA_REPAIR_EXECUTION_01.md` corrigiu excessos de lotes, mas deixou expressamente essa pendência fora do reparo anterior.
- **Alvo único:** projeto `gen-lang-client-0982077967`, banco `emprovex-warehouse`, workspace `hgesm-aprov`, material Suco `mat_272f2d996ee65ed3530ad2d7e27b66d7`.
- **Autorização:** Fundador confirmou que as 5 unidades não existem fisicamente e eram apenas saldo antigo de testes; autorizou a regularização para deixar os depósitos limpos.
- **Pré-condições verificadas no Firestore vivo:** saldo agregado 5; soma dos `movements.quantityDelta` = 5; nenhuma posição física positiva; uma posição `UNASSIGNED` positiva de 5; nenhum lote ativo com quantidade positiva. Dry-run **PASS**.
- **Segurança:** backup JSON local pré-commit no PowerShell do Fundador; commit atômico com precondições de versão para exatamente dois saldos (agregado e `UNASSIGNED`) e um movimento novo; sem exclusão de registros.
- **Resultado pós-commit:** executor retornou `PASS — Suco zerado; histórico preservado` após reler saldo agregado = 0, `UNASSIGNED` = 0 e novo movimento persistido; `INVENTORY_ADJUSTMENT` de -5, com nota de regularização de testes. Movimento `mov_d5f92bf0378af1f7c259f258188fac7a5bf39355c0c509f9fcd23af669127834`.
- **Escopo preservado:** nenhuma NF, intake, outros materiais/workspaces, `firestore.rules`, `firestore.warehouse.rules`, aplicação, deploy ou branch `main` foi alterada pela execução de dados.
- **Limite da conclusão:** esta evidência confirma o Suco zerado, **não** comprova que todos os demais saldos do banco estão zerados. A confirmação visual da lista vazia e/ou auditoria read-only global permanece uma verificação distinta, se requerida.
- **Rastreabilidade:** [PR #310 — executor pontual e memorial de execução](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/310), mantido em DRAFT, sem merge. Não promover o script de manutenção pontual ao runtime permanente.

**Contrato permanente:** `UNASSIGNED` é legado/projeção não física, não origem de `TRANSFER` nem `OUTBOUND`; reconciliações requerem causa comprovada, backup e operação auditável sem apagar o ledger.

## 12. Operações canônicas

### Entrada / ALLOCATE

A alocação móvel e desktop deve reutilizar operações oficiais, com:

- idempotência;
- revalidação concorrente;
- associação de barcode;
- lote/validade;
- ausência de escrita client-side paralela de saldo/ledger.

### TRANSFER

Transferência oficial:

- altera distribuição física;
- preserva o total agregado;
- usa operação `TRANSFER`;
- `quantityDelta = 0`;
- não simula transferência por OUTBOUND + nova entrada;
- não escreve diretamente `locationBalance`.

### OUTBOUND

Saída de material deve preservar:

- carrinho/draft;
- idempotência;
- lotes;
- FEFO;
- saldo não negativo;
- ledger oficial.

### Identidade física

Namespace Mobile: **EPX1**.

EPX1 deriva da identidade técnica e sempre é resolvido novamente contra entidades canônicas.

EPX1 não é fonte paralela de posição.

---

# PARTE V — PERFORMANCE R3

## 13. Estado

**PUBLICADA E ENCERRADA.**

Produção:

`main@e90f92acae1514ee5cbc6ce95fed354bc1454330`

A Performance R3 permanece como baseline técnica da produção enquanto SaaS R1/Mobile R1 não forem publicados.

## 14. Resultados consolidados relevantes

Resultados finais registrados durante a rodada:

- Home: First Load caiu aproximadamente de 460 kB para 335 kB;
- principais rotas da Central: aproximadamente 579 kB para 106 kB;
- shared global: aproximadamente 104 kB;
- lazy loading ampliado;
- consultas históricas movidas para demanda;
- invoices quentes separadas semanticamente do histórico;
- cache curto em memória com TTL e isolamento por workspace;
- shell persistente da Central;
- budgets e métricas versionados;
- validação de UX obrigatória.

Detalhes completos de PERF-A...J e PERF-X permanecem no histórico integral e nos documentos `PERFORMANCE_R3_*`.

## 15. Regra permanente herdada da R3

> Ganho técnico que piora significativamente a experiência do operador não é aceito como otimização.

Performance não pode justificar:

- perda de formulário;
- clique aparentemente sem resposta;
- ausência de feedback;
- quebra de foco/teclado/scanner;
- navegação menos previsível;
- informação visual enganosa;
- necessidade nova de refresh manual.

---

# PARTE VI — SAAS R1

## 16. Objetivo

Transformar o EMPROVEX operacional em serviço comercial controlado, sem reconstruir o núcleo do produto.

Princípios:

- vender inicialmente de forma assistida;
- preservar usuários existentes;
- não automatizar finanças antes de haver necessidade real;
- manter billing separado da autorização operacional;
- preservar multi-tenant, segurança, legal, recovery e auditoria;
- só abrir comercialmente após RC, piloto, correções e certificação final.

## 17. Contrato comercial, pagamento, onboarding, legal e lifecycle

### 17.1 Plano comercial congelado

R1 possui um único plano:

**Plano Completo EMPROVEX — R$ 70,00/mês por workspace**

Inclui acesso funcional completo às funcionalidades disponibilizadas para aquele tenant.

Não existem na R1:

- tiers Bronze/Prata/Pro;
- módulos pagos separadamente;
- feature flags comerciais por preço;
- checkout embutido;
- assinatura criada por API;
- webhook de pagamento;
- suspensão automática;
- signup público de organização.

### 17.2 Trial, vencimento e tolerância

Contrato:

- trial padrão: **30 dias**;
- início: provisionamento/concessão administrativa;
- extensão: somente administrativa e auditada;
- vencimento: **5º dia útil**;
- tolerância: **10 dias corridos**;
- feriados adicionais podem ser configurados;
- fim do trial não apaga dados;
- fim do trial não suspende automaticamente;
- competências históricas preservam o valor já materializado.

### 17.3 Fonte de verdade de billing

Coleções/contratos principais:

- configuração: `platformBillingConfig/main`;
- conta comercial: `billingAccounts/{workspaceId}`;
- competências: `billingCycles/{workspaceId}__{referenceMonth}`.

Estados de `BillingAccount`:

- `trial` — teste em andamento;
- `active` — comercialmente regular;
- `pending` — atenção/regularização;
- `suspended` — estado comercial explícito;
- `canceled` — encerramento comercial;
- `exempt` — founder ou VIP/isento.

Estados de competência:

- `open`;
- `pending`;
- `paid`;
- `waived`.

Não criar estados comerciais concorrentes.

### 17.4 Modo de cobrança vigente

Configuração canônica R1:

- `billingMode = observe`;
- `requirePayment = false`;
- `automaticSuspension = false`;
- método administrativo: `pix_manual`.

Consequência essencial:

**billing acompanha e audita a situação comercial, mas billing sozinho não autoriza nem bloqueia o uso operacional.**

Marcar `billingAccounts.status = suspended` não substitui a ação de lifecycle que realmente desabilita workspace/conta/Central.

### 17.5 Pagamento e regularização

O EMPROVEX **não processa cartão/Pix internamente**.

Fluxo canônico:

```text
cliente precisa regularizar
→ abre /regularizacao
→ usa Link de Pagamento HTTPS e/ou copia Pix
→ pagamento ocorre fora do EMPROVEX
→ Fundador/admin confere o recebimento no provedor/banco
→ confirma a competência no painel
→ competência = paid (ou waived quando aplicável)
→ billing account = active
→ evento auditado
```

Configurações administrativas disponíveis:

- `paymentLinkUrl` — URL pública HTTPS;
- `pixKey`;
- `pixKeyType` — CPF/CNPJ/e-mail/telefone/chave aleatória;
- `pixRecipientName`;
- `supportContact`;
- `holidayDates`;
- trial/tolerância dentro dos limites aceitos.

A mensalidade R1 é fixada em R$ 70 pelo domínio; o painel não deve aceitar outro preço como configuração casual.

### 17.6 Provedor de pagamento

O desenho comercial inicial documenta Mercado Pago/Pix como referência operacional.

A implementação, porém, armazena apenas **uma URL pública HTTPS de pagamento**, sem credencial do provedor. Portanto o RC não fica tecnicamente acoplado a um único gateway.

Se outro provedor for adotado:

- deve oferecer URL HTTPS pública apropriada;
- nenhum token/secret deve ir para o cliente;
- Termos/Privacidade devem ser revistos se a mudança alterar materialmente terceiros envolvidos;
- a fonte de verdade da competência continua no EMPROVEX, não no gateway.

API/webhook permanece fora da R1.

### 17.7 Dados financeiros que o EMPROVEX não armazena

Não armazenar:

- número de cartão;
- CVV;
- credencial do gateway;
- Access Token de pagamento no cliente;
- token de cartão;
- comprovante financeiro por padrão.

Podem existir apenas metadados administrativos mínimos e auditáveis, como nota/referência textual da confirmação.

### 17.8 Página pública de regularização

Rota:

`/regularizacao`

Deve apresentar:

- Plano Completo;
- mensalidade;
- vencimento/tolerância;
- Link de Pagamento quando configurado;
- Pix quando configurado;
- contato de suporte.

A página declara que o pagamento ocorre fora do EMPROVEX e não solicita cartão/CVV.

Regularização, Termos, Privacidade e recuperação de credenciais não devem ficar inutilizáveis justamente quando o usuário está suspenso ou precisa recuperar acesso.

### 17.9 Confirmação/reabertura da competência

A confirmação manual é auditada.

- `paid` ou `waived` → competência confirmada; billing account comercial passa para `active`;
- reabertura/não confirmação → billing account passa para `pending`.

**Importante:** se o workspace tiver sido operacionalmente desabilitado pelo lifecycle, confirmar pagamento não equivale automaticamente a reativá-lo. A reativação de acesso é uma ação administrativa separada e explícita.

### 17.10 Suspensão operacional e reativação

A suspensão real da R1 é manual e founder-only.

Para suspender:

1. validar ator/admin;
2. validar coerência workspace/e-mail/UG/conta;
3. desabilitar `warehouseAccess`;
4. alterar `workspaces.status` e `platformAccounts.status` para `disabled`;
5. revogar sessões conhecidas e remover slots;
6. registrar auditoria;
7. compensar/rollback parcial se um banco falhar.

Reativação:

1. retorna workspace/conta principal para `active`;
2. retorna `warehouseAccess` para `active`;
3. se a segunda etapa falhar, o código tenta compensar para impedir estado incoerente;
4. falha parcial não é escondida: pode resultar em `RECOVERY_REQUIRED`.

Suspensão/reativação **não altera dados operacionais**.

### 17.11 Cancelamento e exclusão

`canceled` é estado comercial, não comando de delete.

Cancelamento não:

- apaga workspace;
- apaga documentos;
- apaga histórico;
- apaga estoque/ledger;
- reaproveita UG/e-mail automaticamente.

Retenção, exportação e exclusão são processos separados e sujeitos à política legal/administrativa aplicável.

### 17.12 Onboarding assistido

Não existe auto-cadastro de organização.

Fluxo canônico:

1. Fundador/admin confirma dados mínimos;
2. cria workspace/UG pelo painel;
3. informa e-mail operacional primário;
4. concede trial quando aplicável;
5. provisionamento cria Auth/diretório/billing;
6. credencial inicial é enviada por canal seguro;
7. primeiro acesso valida e-mail/provider/UID/workspace/UG;
8. usuário aceita pacote legal vigente;
9. checklist curto de primeiro acesso é exibido;
10. Google Drive é opcional;
11. usuário começa a operar.

Conta externa: password-only. Founder: Google-only.

### 17.13 Recuperação e troca de senha

R1 inclui:

- “Esqueci minha senha” usando fluxo nativo do Firebase;
- resposta neutra para reduzir enumeração de contas;
- troca da própria senha com reautenticação;
- mensagens humanas para credencial inválida, conta suspensa, workspace inconsistente e limite de sessão.

### 17.14 Legal Gate versionado

Pacote legal atual:

- `legalBundleVersion = saas-r1-2026-10-01`;
- `termsVersion = terms-2026-10-01-r1`;
- `privacyVersion = privacy-2026-10-01-r1`.

Aceite canônico:

`workspaces/{workspaceId}/legalAcceptances/{uid}__{legalBundleVersion}`

Registro contém:

- workspaceId;
- UG;
- UID;
- e-mail;
- versão do bundle;
- versão dos Termos;
- versão da Privacidade;
- timestamp autoritativo.

O runtime verifica especificamente a versão vigente. Novo aceite só é exigido quando o pacote legal configurado muda.

Falha na verificação é **fail-closed**: nenhum aceite é presumido.

Termos e Privacidade permanecem consultáveis no próprio gate.

Aceite contratual não significa que todo tratamento de dados pessoais dependa de “consentimento LGPD”.

### 17.15 Arquitetura de dados SaaS

Não criar terceiro Firestore apenas para billing/legal/onboarding.

Arquitetura R1:

1. banco principal — identidade, workspace, billing, legal, auditoria e núcleo operacional;
2. `emprovex-warehouse` — Central de Depósitos;
3. nenhum terceiro banco SaaS.

Rules são específicas por banco e continuam parte do contrato de release.

## 18. VIP e isenção comercial

### 18.1 Founder

Founder permanece:

- `exempt`;
- preço efetivo R$ 0;
- sem trial;
- sem inadimplência;
- isento do limite padrão de sessões externas.

### 18.2 VIP manual

VIP externo reutiliza a semântica `exempt`.

Contrato:

- mesmo Plano Completo;
- R$ 0 enquanto a isenção estiver ativa;
- nenhuma redução funcional;
- sem cobrança/atraso/suspensão por inadimplência;
- concessão/remoção manual, explícita e auditada;
- histórico preservado.

Não criar status `vip` concorrente.

### 18.3 VIP legado

Coorte histórica materializada:

- `aprovisionamento-2-b-fv`;
- `aprovisionamento-3-gac-ap`;
- `aprovisionamento-teste`.

O código atual protege a isenção `legacy_vip` contra remoção pela operação genérica de isenção.

VIP não cria exceção de segurança, sessão, Legal Gate ou isolamento multi-tenant. Isenção é comercial, não autorização privilegiada.

## 19. Ordem oficial da reta final SaaS

Estado funcional SaaS: **ENCERRADO PARA NOVAS FEATURES**.

Sequência vigente:

```text
HARDEN-A1/A2/C/D PASS
+ HARDEN-B em acompanhamento temporal
→ composição do RC único SaaS+Mobile
→ CT-01 + Rules/package/CI
→ gates combinados
→ RC FROZEN
→ Preview HTTPS
→ certificação real SaaS+Mobile
→ eventual produção controlada autorizada
→ piloto real
→ correções finais
→ SAAS-J
→ GO explícito
→ abertura comercial ampla
```

Nenhuma nova wave funcional SaaS está autorizada sem regressão concreta ou nova decisão de produto.

## 20. HARDEN — estado vivo

| Frente | Estado vigente | Decisão |
| --- | --- | --- |
| HARDEN-A1 — jsPDF | **PASS / ENCERRADA** | jsPDF 4.2.1 + AutoTable 5.0.8; CRITICAL removido; 7/7 regressão PDF; acabamento visual fino = backlog não bloqueante |
| HARDEN-A2 — Firebase/Firestore/gRPC | **PASS — RISCO RESIDUAL ACEITO TECNICAMENTE** | sem alteração de dependência/runtime/Rules; vetores analisados não alcançáveis pelos usos atuais |
| HARDEN-B — Recovery | **PARCIAL / ESPERA CONTROLADA** | controles ativos; backup READY/verify/restore pendentes |
| HARDEN-C — Health/Rules/Release | **PASS / ENCERRADA** | health/release/rollback preparados |
| HARDEN-D — SaaS↔Mobile | **PASS / ENCERRADA** | sem conflito funcional material; CT-01 isolada para o RC |

### A1 — regra pós-fechamento

A inspeção visual fina de PDF não bloqueia RC/piloto/lançamento.

Só reabre gate se surgir defeito funcional real, como:

- PDF vazio;
- geração quebrada;
- conteúdo ausente;
- ilegibilidade operacional;
- paginação funcionalmente destruída.

Margem, espaçamento, alinhamento e refinamento estético ficam em backlog.

### A2 — risco residual

A cadeia Firebase → Firestore → `@grpc/grpc-js` permanece instalada.

Decisão aceita:

- não forçar override fora do range do Firestore;
- não fazer downgrade/major só para reduzir scanner;
- uso browser não carrega o transporte Node gRPC;
- uso Node atual é cliente Firestore, sem servidor gRPC próprio nem primitivas de servidor analisadas;
- não abrir nova frente Firebase/gRPC sem nova evidência técnica ou correção upstream suportada.

Snapshot técnico da A2:

- Firebase declarado: `^10.12.2`;
- Firebase resolvido: `10.14.1`;
- `@firebase/firestore`: `4.7.3`;
- `@grpc/grpc-js`: `1.9.16`;
- pin Firestore: `~1.9.0`.

A aceitação de risco não declara a biblioteca intrinsecamente segura; declara o risco específico como não alcançável pelo uso atual e sem correção suportada melhor no momento.

## 21. HARDEN-B — recovery

Estado:

**PARCIAL — dependência temporal legítima**

Proteções confirmadas nos dois bancos:

- PITR: ativo;
- delete protection: ativa;
- schedule diário de backup: ativo;
- retenção: **14 semanas**;
- tooling `recovery:status` e `recovery:verify` disponível.

Pendências:

1. primeiro backup nativo `READY` no banco principal;
2. primeiro backup nativo `READY` no `emprovex-warehouse`;
3. capturar resource/location/snapshot/expiration;
4. executar `recovery:verify`;
5. preparar restore plan isolado;
6. restore real em banco novo/isolado;
7. validar dados, IAM, Rules, TTL e isolamento.

Não repetir `recovery:apply` enquanto controles permanecerem ativos.

Restore real continua ação protegida e requer autorização explícita quando chegar o momento.

### Relação HARDEN-B ↔ RC

- composição do RC: **não bloqueada**;
- Preview HTTPS sem writes críticos: **não bloqueado por B parcial**;
- produção controlada com writes reais: preferir fortemente `backup READY` nos dois bancos + `recovery:verify`;
- se houver promoção antes disso, o Fundador deve aceitar explicitamente o risco residual;
- abertura comercial final exige prova de recuperação adequada, incluindo restore isolado real conforme plano SaaS.

## 22. Health, Rules, observabilidade e release

### 22.1 Health

Contrato:

- `/api/health` público;
- não expõe dados sensíveis;
- não depende de leitura operacional do Firestore para responder saúde básica.

### 22.2 Observabilidade

Fontes oficiais R1:

- Vercel — deploy/runtime;
- GitHub Actions — certificação/gates;
- Cloud Monitoring — métricas/uptime;
- telemetria Firebase/Firestore já existente;
- logs de sessão/Central quando aplicável.

No ambiente publicado, validar:

- domínio/SSL;
- `/api/health`;
- erros runtime/HTTP;
- erros Firestore/permissão;
- erros de sessão;
- erros da Central;
- crashes do scanner;
- consumo inesperado;
- uptime check/alerta/canal quando materializados.

Uptime/alerta externo não deve ser declarado PASS sem evidência real do ambiente publicado.

### 22.3 Rules candidatas

SaaS e Mobile possuem Rules candidatas reconciliadas entre si.

Blobs auditados:

- candidata `firestore.rules`: `57a1394c921b2ab2c15537fbfc4aaea17515b28a`;
- candidata `firestore.warehouse.rules`: `6e1f1050005314db4e17cb3136409abbddb0ee91`;
- produção atual `firestore.rules`: `0d990b7de0b2e85ed55fe14ec0d2ce29b3635299`;
- produção atual `firestore.warehouse.rules`: `b5325fe5a8cbe9b0ade8568d35a2cd678ce6e0f2`.

As candidatas diferem de `main`.

Portanto publicação exige:

1. registrar conteúdo/hash das Rules atuais;
2. registrar conteúdo/hash das Rules RC;
3. executar testes multi-tenant/workspace externo/legal/billing/Central;
4. preparar comando de republicação das Rules anteriores;
5. não confundir rollback Vercel com rollback de Rules.

### 22.4 RULES-AUDIT-01 — auditoria integral de compatibilidade das Firestore Rules

Decisão do Fundador em 2026-10-03:

**as Rules do SaaS R1 + Mobile R1 não serão publicadas em produção por tentativa e erro. Antes de qualquer publicação produtiva, o ruleset final do RC deve passar por uma auditoria integral de compatibilidade.**

Classificação:

**GATE TRANSVERSAL OBRIGATÓRIO PRÉ-RC / PRÉ-PUBLICAÇÃO DE RULES**

Owner:

**Program Control + Coordenação do RC**

#### 22.4.1 Objetivo

Garantir, antes da publicação, que as Rules finais:

1. preservem tudo o que já funciona corretamente na Performance R3;
2. incorporem apenas os novos contratos necessários de SaaS R1, Mobile R1 e SESSION-CAP-01;
3. não introduzam regressões de autorização;
4. não abram acesso indevido;
5. não criem bloqueios sistêmicos de usuários legítimos;
6. mantenham isolamento multi-tenant;
7. mantenham a Central de Depósitos funcional;
8. tenham rollback conhecido e testável;
9. sejam compatíveis com a ordem real de rollout entre aplicação e Rules;
10. possam ser publicadas sem depender de correções improvisadas em produção.

#### 22.4.2 Estado atual das Rules antes da SESSION-CAP-01

Banco principal:

- produção / `main`: `firestore.rules@0d990b7de0b2e85ed55fe14ec0d2ce29b3635299`;
- candidata SaaS: `firestore.rules@57a1394c921b2ab2c15537fbfc4aaea17515b28a`;
- candidata Mobile: **idêntica à candidata SaaS**;
- tamanho aproximado produção: **87,49 KiB / 2.380 linhas**;
- tamanho aproximado candidata: **92,11 KiB / 2.500 linhas**;
- delta observado: aproximadamente **+124 / -4 linhas**.

Banco `emprovex-warehouse`:

- produção / `main`: `firestore.warehouse.rules@b5325fe5a8cbe9b0ade8568d35a2cd678ce6e0f2`;
- candidata SaaS: `firestore.warehouse.rules@6e1f1050005314db4e17cb3136409abbddb0ee91`;
- candidata Mobile: **idêntica à candidata SaaS**;
- tamanho aproximado produção: **151,55 KiB / 3.307 linhas**;
- tamanho aproximado candidata: **152,38 KiB / 3.330 linhas**;
- delta observado: aproximadamente **+24 / -1 linha**.

Conclusão atual:

**não existe conflito SaaS versus Mobile nas Rules candidatas conhecidas. O conflito a auditar é produção R3 versus ruleset final do novo release.**

Os hashes acima são baseline histórica desta auditoria. O PASS final deve usar os hashes do **ruleset pós-SESSION-CAP-01**, que podem ser diferentes.

#### 22.4.3 Dependência obrigatória da SESSION-CAP-01

A auditoria final só pode congelar PASS **depois** da SESSION-CAP-01.

Motivo:

- o runtime atual usa `sessionSlots/slot-1` e `slot-2`;
- as Rules atuais validam esse contrato fixo;
- SESSION-CAP-01 deverá permitir sessões dinâmicas ou mecanismo equivalente;
- portanto o ruleset final ainda sofrerá alteração estrutural.

Regra:

```text
SESSION-CAP-01
→ ruleset final estrutural
→ RULES-AUDIT-01
→ PASS RULES
→ composição/finalização do RC
```

Uma auditoria executada antes da SESSION-CAP-01 pode servir como **baseline**, mas não substitui a auditoria final.

#### 22.4.4 Princípio de compatibilidade

A auditoria não deve perguntar apenas:

> “o App RC funciona com Rules RC?”

Ela deve responder também:

> “as Rules RC preservam o comportamento legítimo já existente na Performance R3?”

Contrato:

**Rules finais = capacidades legítimas já existentes + novos contratos SaaS/Mobile + nenhum acesso indevido novo.**

Não é aceitável resolver uma necessidade nova apagando silenciosamente uma permissão legítima antiga.

#### 22.4.5 Fase A — captura da baseline realmente publicada

Antes de comparar arquivos do Git:

1. consultar o ruleset efetivamente ativo no banco principal;
2. consultar o ruleset efetivamente ativo no `emprovex-warehouse`;
3. registrar Ruleset ID/versão quando disponível;
4. guardar conteúdo/fingerprint/hash;
5. comparar com os blobs esperados de `main`;
6. registrar data/hora da captura;
7. registrar projeto/database alvo.

Se o ruleset realmente publicado divergir do `main` conhecido:

**STOP / DRIFT DE PRODUÇÃO**

Nenhuma publicação nova deve ocorrer antes de explicar e reconciliar a divergência.

#### 22.4.6 Fase B — diff estrutural e semântico

Não limitar a revisão a contagem de linhas.

Para cada arquivo:

- mapear helpers adicionados/removidos/alterados;
- mapear cada `match` adicionado/removido/alterado;
- mapear cada `allow read/get/list/create/update/delete/write`;
- identificar mudanças de provider;
- identificar mudanças de UID/e-mail/workspace/UG;
- identificar mudanças de lifecycle;
- identificar mudanças de billing/legal;
- identificar mudanças de sessão;
- identificar mudanças de `warehouseAccess`;
- identificar mudanças em validação de shape/tamanho/status;
- identificar mudança permissiva;
- identificar mudança restritiva;
- identificar mudança neutra/estrutural.

Cada delta deve possuir:

- origem;
- requisito que o justifica;
- superfície afetada;
- risco de falso ALLOW;
- risco de falso DENY;
- teste correspondente.

#### 22.4.7 Fase C — matriz ALLOW / DENY

Todo domínio modificado deve ter testes positivos e negativos.

Exemplo canônico:

```text
operação legítima do próprio workspace → ALLOW
mesma operação em outro workspace → DENY
sessão sem provider correto → DENY
sessão sem claim/identidade exigida → DENY
usuário não autenticado → DENY
admin onde não existe bypass operacional → DENY
payload válido → ALLOW
payload adulterado → DENY
```

A matriz deve cobrir no mínimo:

**Identidade / multi-tenant**
- founder Google;
- externo password;
- UID correto/incorreto;
- e-mail verificado;
- workspace próprio;
- workspace alheio;
- UG própria;
- UG divergente;
- sessão suspensa/desabilitada.

**Sessões**
- sessão dinâmica válida;
- renovação do próprio lease;
- tentativa de renovar lease de outra sessão;
- sessão revogada;
- tombstone;
- sessão expirada;
- múltiplas sessões legítimas;
- suspensão global do workspace;
- painel administrativo/encerramento remoto.

**Billing**
- configuração administrativa;
- preço R$ 70;
- VIP/`exempt`;
- VIP legado;
- competência;
- usuário externo sem permissão de alteração administrativa.

**Legal**
- GET do próprio aceite esperado;
- criação do próprio aceite vigente;
- versão errada;
- UID errado;
- workspace errado;
- listagem;
- update;
- delete.

**Central de Depósitos**
- founder;
- setor externo autorizado;
- setor externo sem claims;
- setor suspenso;
- `warehouseAccess active`;
- `warehouseAccess disabled`;
- workspace alheio;
- UG divergente.

**Operações logísticas**
- materiais;
- depósitos;
- posições/subposições;
- lotes;
- barcode;
- intake;
- allocation;
- transfer;
- inventory;
- outbound;
- ledger;
- saldos;
- configurações/layouts/destinos aplicáveis.

#### 22.4.8 Fase D — regressão do EMPROVEX legado

O ruleset novo deve rodar também contra as suítes de funcionalidades antigas.

Cobertura mínima:

- Empenhos;
- Itens;
- Notas Fiscais;
- Comissão;
- Liquidação/Tesouraria;
- Cronogramas;
- Fornecedores;
- Alertas;
- Relatórios/SAG;
- Auditoria;
- backup/status quando aplicável;
- Central Desktop;
- operações logísticas já certificadas.

Não é necessário criar teste manual novo para cada linha não alterada se já existir suíte automatizada confiável. Porém **todas as suítes relevantes devem ser executadas com o ruleset final**.

#### 22.4.9 Fase E — Emulator e suíte automatizada

Usar Firestore Emulator/Local Emulator Suite quando aplicável.

Suítes já existentes que devem ser reaproveitadas e ampliadas, entre outras:

- `scripts/firestore-multitenancy-security.test.mjs`;
- `scripts/warehouse-external-access-security.test.mjs`;
- `scripts/legal-acceptance-security.test.mjs`;
- `scripts/verify-saas-r1-security-enforcement.mjs`;
- `scripts/verify-sector-lifecycle.mjs`;
- `scripts/verify-saas-r1-integration.mjs`;
- guards Block 16.0/16.1/16.2;
- guards Block 17.1/17.2;
- testes da Central de Depósitos;
- segurança externa da Central.

Criar, quando a frente for executada, um orquestrador único ou comando equivalente:

`npm run verify:rc-rules-audit`

Objetivo:

**um comando deve reproduzir o gate das Rules do RC sem depender de uma sequência manual esquecível.**

#### 22.4.10 Fase F — matriz de compatibilidade de rollout

Avaliar explicitamente:

| Aplicação | Rules | Objetivo |
| --- | --- | --- |
| Performance R3 | Rules R3 | baseline conhecida |
| Performance R3 | Rules RC | provar compatibilidade durante publicação/rollback |
| App RC | Rules RC | produto final esperado |
| App RC | Rules R3 | identificar operações novas que exigem Rules novas e definir ordem segura de rollout |

A quarta combinação não precisa ser totalmente funcional; ela deve ser **conhecida**.

Se App RC depender obrigatoriamente de uma permissão inexistente nas Rules R3, documentar:

- qual fluxo falha;
- tipo de falha;
- ordem correta de rollout;
- impacto de rollback;
- janela aceitável.

Nenhuma ordem de deploy deve ser escolhida por suposição.

#### 22.4.11 Fase G — compatibilidade da migração de sessões

SESSION-CAP-01 merece análise explícita.

Se tecnicamente viável e seguro, preferir uma janela transitória em que as Rules reconheçam:

- slots legados `slot-1`/`slot-2`;
- IDs dinâmicos novos.

Objetivo:

- permitir rollout/rollback sem quebrar imediatamente clientes/versões anteriores;
- não obrigar migração destrutiva;
- manter segurança durante coexistência.

A compatibilidade legada só permanece enquanto necessária.

Não manter código/Rules legados indefinidamente sem motivo.

Se coexistência segura não for possível, documentar claramente:

- por que não;
- ordem obrigatória de rollout;
- procedimento de rollback;
- efeito sobre sessões já abertas.

#### 22.4.12 Fase H — análise de performance e custo das Rules

A auditoria deve verificar também:

- número de `get()`/`exists()` por avaliação;
- risco de exceder limites de document access calls;
- impacto de `warehouseLifecycleAllowsAccess`;
- impacto de sessões dinâmicas;
- tamanho do ruleset fonte;
- tamanho compilado quando disponível;
- tempo do Emulator;
- crescimento desnecessário de helpers duplicados.

Não resolver segurança aumentando de forma cega o número de leituras das Rules.

#### 22.4.13 Fase I — rollback de Rules

Antes da publicação, manter disponíveis:

**Banco principal**
- hash/blob da Rule anterior;
- arquivo exato anterior;
- comando/procedimento de republicação.

**Warehouse**
- hash/blob da Rule anterior;
- arquivo exato anterior;
- comando/procedimento de republicação.

Rollback de Rules deve ser independente do rollback da aplicação.

Regra:

```text
rollback Vercel != rollback Rules != rollback dados
```

Se uma Rule permissiva indevida tiver permitido escrita/leitura inadequada, republicar a Rule anterior **não desfaz dados já gravados**.

Nesse caso:

1. fechar acesso;
2. identificar janela;
3. auditar documentos/movimentos;
4. reconciliar dados;
5. só depois encerrar incidente.

#### 22.4.14 Fase J — evidência obrigatória

O handoff da RULES-AUDIT-01 deve entregar:

- RULES_MAIN_HASH;
- RULES_RC_HASH;
- WAREHOUSE_RULES_MAIN_HASH;
- WAREHOUSE_RULES_RC_HASH;
- ruleset IDs ativos quando capturáveis;
- diff estrutural;
- diff semântico;
- matriz ALLOW/DENY;
- testes executados;
- contagem PASS/FAIL;
- regressão do legado;
- regressão SaaS;
- regressão Mobile;
- regressão SESSION-CAP-01;
- compatibilidade de rollout;
- tamanho fonte/compilado quando disponível;
- rollback principal;
- rollback warehouse;
- riscos residuais;
- recomendação final.

Classificações permitidas:

- **PASS — RULES APTAS PARA RC**;
- **PARCIAL — CORREÇÃO NECESSÁRIA**;
- **FAIL — BLOQUEAR RC**.

Não existe “PASS por inferência”.

#### 22.4.15 Critérios mínimos de PASS

RULES-AUDIT-01 só pode ser PASS se:

1. Rules ativas atuais forem conhecidas e reconciliadas;
2. não existir drift produtivo inexplicado;
3. SESSION-CAP-01 já estiver refletida no ruleset final;
4. SaaS e Mobile apontarem para o mesmo ruleset final;
5. ALLOW legítimos críticos passarem;
6. DENY de segurança críticos passarem;
7. cross-workspace continuar DENY;
8. founder continuar funcional;
9. externos legítimos continuarem funcionais;
10. Legal Gate funcionar;
11. billing administrativo funcionar sem virar autorização operacional;
12. lifecycle/suspensão/reativação funcionar;
13. Central Desktop funcionar;
14. Central Mobile funcionar;
15. sessões dinâmicas funcionarem;
16. regressão R3 relevante passar;
17. nenhum acesso permissivo novo inexplicado existir;
18. nenhum bloqueio sistêmico novo existir;
19. rollback de ambos os bancos estiver preparado;
20. ordem de rollout estiver definida;
21. tamanho/complexidade do ruleset estiver dentro dos limites aplicáveis;
22. gates automatizados estiverem reproduzíveis.

#### 22.4.16 Regra de publicação

**Nenhuma Firestore Rule produtiva nova do SaaS R1/Mobile R1 poderá ser publicada sem RULES-AUDIT-01 = PASS.**

Exceção:

somente correção emergencial de segurança/incidente real, com autorização explícita do Fundador e Program Control, evidência mínima, rollback pronto e auditoria retrospectiva obrigatória.

CI verde isolado não substitui RULES-AUDIT-01.

PR mergeable não substitui RULES-AUDIT-01.

Preview aprovado não substitui RULES-AUDIT-01.

#### 22.4.17 Relação com o RC

A sequência oficial passa a ser:

```text
SESSION-CAP-01
→ ruleset final
→ RULES-AUDIT-01
→ PASS RULES
→ composição/finalização RC
→ CT-01/package/CI
→ gates combinados
→ RC CANDIDATE
→ RC FROZEN
→ Preview HTTPS
```

Se qualquer mudança posterior ao PASS alterar:

- `firestore.rules`;
- `firestore.warehouse.rules`;
- Auth/provider;
- UID/workspace/UG;
- lifecycle;
- Legal;
- billing enforcement;
- sessão;
- `warehouseAccess`;

o PASS de Rules deve ser considerado **afetado** e os blocos correspondentes da auditoria precisam ser repetidos antes do freeze.

### 22.5 Runbook de incidente

Sequência mínima:

1. confirmar domínio/deployment;
2. verificar health/runtime;
3. verificar Firestore/Monitoring;
4. classificar impacto;
5. interromper writes se houver dúvida de integridade;
6. corrigir ou rollback;
7. reconciliar dados antes de qualquer correção manual;
8. registrar incidente material.

Problema visual isolado não é automaticamente incidente de rollback.

## 23. CT-01 — contrato transversal obrigatório do RC

Estado atual:

- SaaS/main: `camera=(), microphone=(), geolocation=()`;
- Mobile: `camera=(self), microphone=(), geolocation=()`.

Contrato global do RC:

`camera=(self), microphone=(), geolocation=()`

Interpretação:

- câmera same-origin permitida;
- microfone continua bloqueado;
- geolocalização continua bloqueada;
- `getUserMedia` ainda depende de HTTPS/contexto seguro e permissão do navegador.

Ownership:

**Coordenação do RC.**

MOBILE-J não altera globalmente `next.config.ts` por conta própria.

Antes do PASS final:

- materializar CT-01 na branch RC;
- executar gates afetados;
- publicar Preview HTTPS;
- validar o header HTTP realmente servido;
- provar câmera real em dispositivo físico.

# PARTE VII — MOBILE R1

## 24. Objetivo e contrato Mobile R1

Levar operações físicas da Central de Depósitos ao navegador móvel sem criar segunda fonte da verdade.

Contrato:

- web mobile;
- online-first;
- mesma Auth/workspace/UG;
- mesmo Legal Gate/lifecycle/sessão;
- scanner compartilhado;
- EPX1 apenas como identidade física;
- resolver sempre contra entidades canônicas;
- repositories/ledger/saldo/lote/posição oficiais;
- fallback manual;
- sem banco Mobile paralelo;
- sem operação offline integral na R1.

## 25. Estado funcional consolidado

Concluído e integrado:

- MOBILE-A — plataforma/scanner;
- MOBILE-B — etiquetas/resolver;
- Integração 1;
- MOBILE-C — alocação;
- MOBILE-D — transferência;
- MOBILE-E — consulta;
- Integração 2;
- MOBILE-F — inventário;
- MOBILE-G — saída;
- MOBILE-H — conferência;
- Integração 3;
- MOBILE-I — integração controlada A–H.

MOBILE-I:

- worker certificado: `ea5ad10054e2aea608e270a970fde723cde41d93`;
- PR #245: merged;
- squash: `3a5689e0e613adfb7dbf48ef8d44085ec6c951b3`;
- gates principais: PASS;
- novo delta funcional SaaS↔Mobile: nenhum.

Não reabrir F/G/H/I sem regressão concreta.

## 26. MOBILE-J — certificação final

Branch:

`mobile-r1-j-final-certification@90d646372aae3e92318a78b90d71f72c5eb6b00e`

PR #246:

**OPEN / DRAFT / MERGEABLE**

Classificação:

**PARCIAL TECNICAMENTE SAUDÁVEL / CERTIFICAÇÃO EM EXECUÇÃO**

Escopo permitido:

- certificação;
- evidência;
- regressão concreta mínima;
- nenhuma feature nova.

Próximo marco real:

**RC em Preview HTTPS → testes físicos → reconciliação SaaS final → avaliação de PASS FINAL.**

Runbook especializado:

`mobile-r1-j-final-certification:docs/CENTRAL_MOBILE_R1_MOBILE_J_PHYSICAL_TEST_RUNBOOK.md`

## 27. Certificação física obrigatória

### Android / Chrome

Validar:

- Home Mobile;
- câmera permitida;
- câmera negada;
- câmera indisponível;
- fallback manual;
- abrir/fechar câmera;
- troca/retorno de rota;
- scan válido;
- double scan;
- cooldown;
- scans consecutivos;
- luz baixa/reflexo;
- perda/retorno de rede.

### iPhone / Safari

Executar os mesmos cenários quando houver aparelho disponível.

Se não houver aparelho:

**PENDENTE — APARELHO NÃO DISPONÍVEL**

Não inferir PASS de iPhone a partir de Android.

### Code128 físico

Imprimir e testar:

- COMPACT;
- MEDIUM;
- LARGE.

Validar no mínimo:

- LOCAL;
- SUBPOSITION;
- material/produto;
- distância/enquadramento/contraste;
- repetição;
- ausência de confusão entre etiquetas próximas.

Geração digital isolada não é certificação física.

### Feedback físico

Validar:

- som de sucesso;
- som de erro;
- vibração;
- feedback visual;
- ausência de duplo feedback enganoso;
- erro de persistência sem falso sucesso.

### UX real

Validar:

- uso com uma mão;
- legibilidade;
- botões;
- orientação/scroll;
- loading/empty states;
- foco/teclado;
- Enter quando aplicável;
- scanner ↔ formulário;
- recuperação após erro;
- mensagens de confirmação.

Classificar defeitos:

- BLOQUEANTE;
- IMPORTANTE;
- COSMÉTICO;
- BACKLOG.

Só regressão funcional concreta reabre desenvolvimento.

## 28. Jornada física, invariantes, performance e PASS final

Jornada mínima:

```text
LOGIN
→ CENTRAL MOBILE
→ LER MATERIAL/POSIÇÃO
→ ALLOCATE
→ CONSULTAR
→ TRANSFERIR
→ CONFERIR
→ INVENTARIAR
→ OUTBOUND
→ CONSULTAR ESTADO FINAL
→ CENTRAL DESKTOP
→ CONFIRMAR COERÊNCIA
```

Registrar IDs relevantes: workspace/UG/material/barcode/depósito/posições/lote/movementIds/inventoryId/outboundId.

Invariantes:

- ALLOCATE usa posição/barcode/material canônicos;
- TRANSFER preserva total agregado e não gera saldo negativo;
- inventário salvo não altera saldo antes da revisão/confirm;
- OUTBOUND respeita posição/lote/FEFO/idempotência;
- conferência é read-only e usa transferência como correção oficial;
- Desktop e Mobile mostram o mesmo material/saldo/posição/lote/histórico/ledger.

Rede:

- perda antes de operação crítica deve falhar fechada;
- nenhum falso sucesso;
- retorno permite retomada/reconciliação segura;
- idempotência deve impedir duplicação.

Performance de referência pós-Integração 3/MOBILE-I:

- `/central-mobile`: 257 kB;
- `/central-mobile/alocar`: 275 kB;
- `/central-mobile/transferir`: 261 kB;
- `/central-mobile/inventario`: 271 kB;
- `/central-mobile/saida`: 265 kB;
- `/central-mobile/conferir`: 260 kB;
- Shared First Load: 104 kB.

PASS FINAL Mobile exige:

- testes físicos reais;
- CT-01 observada no Preview;
- jornada ponta a ponta;
- coerência Desktop↔Mobile;
- gates técnicos verdes;
- reconciliação final contra o HEAD/RC SaaS;
- nenhum conflito transversal aberto.

O Coordenador Mobile recomenda; Program Control decide a barreira global.

# PARTE VIII — TESTES, CI E RELEASE

## 29. Política de testes e evidência

Browser E2E não é gate universal.

Prioridade:

- instalação reproduzível;
- TypeScript;
- production build;
- testes de domínio;
- guards estruturais;
- multi-tenant;
- Firestore Emulator quando aplicável;
- Core Protection;
- Recovery;
- Legal Validation;
- diff hygiene;
- testes específicos do RC.

Validação manual é legítima e obrigatória para câmera/scanner/barcode/UX física.

**Não inferir PASS sem execução real quando o requisito depende de hardware/navegador/ambiente publicado.**

## 30. Vercel e Preview HTTPS

Durante desenvolvimento, `build-rate-limit` isolado não é regressão de código.

Para RC:

- Preview HTTPS deve apontar para o **mesmo SHA congelado** que poderá ser promovido;
- não testar um build e reconstruir outro para produção;
- validar header CT-01 no HTTP efetivo;
- usar Preview para fechar MOBILE-J e smoke SaaS antes de tocar domínio produtivo.

## 31. Produção, main e autorizações

`main` é baseline conhecida/recuperável, não branch de experimentação.

Problema encontrado em teste:

```text
bug
→ branch curta/hotfix rastreável
→ teste
→ integração no RC
→ gates afetados
→ novo freeze quando necessário
```

Não “corrigir direto na main”.

Ações protegidas dependem de autorização explícita do Fundador:

- merge/release final para `main`;
- Vercel production/promotion;
- Rules produtivas;
- restore real quando aplicável;
- migração destrutiva;
- ação disruptiva em usuário/workspace real;
- GO/NO-GO de produção e lançamento.

### 31.1 Três planos de rollback

Rollback de aplicação não é rollback total do sistema.

Separar:

1. **Aplicação/Vercel** — voltar ao deployment conhecido;
2. **Rules** — republicar Rules anteriores;
3. **Dados** — reconciliar movimentos/writes; não existe “desfazer automático” por rollback Vercel.

Rollback de Vercel não apaga:

- movimentos;
- ledger;
- billing/legal/lifecycle persistido;
- documentos criados;
- alterações de estoque já gravadas.

### 31.2 Estratégia de teste com menor risco

Na certificação publicada:

- usar workspace/material controlado;
- evitar estoque institucional crítico;
- evitar deletes;
- evitar migração destrutiva;
- registrar IDs das operações;
- interromper writes diante de dúvida de integridade;
- auditar ledger/saldos antes de correção manual.

### 31.3 Gatilhos de NO-GO/rollback

Escalar imediatamente se houver:

- falha sistêmica de login;
- founder ou usuário legítimo bloqueado de forma generalizada;
- cross-workspace;
- Rules permitindo acesso indevido;
- Rules negando operação essencial de forma sistêmica;
- saldo negativo/divergente;
- ledger duplicado;
- idempotência quebrada;
- perda de material/lote/posição;
- billing/lifecycle incorreto;
- Legal Gate impedindo uso legítimo de forma sistêmica;
- scanner indisponível por CT-01;
- erro runtime grave;
- regressão grave do Desktop.

Problema exclusivamente visual não exige rollback automático.

# PARTE IX — RISCOS E GATES ABERTOS

## 32. Gates técnicos ainda abertos

### 32.1 Antes do RC CANDIDATE

Já concluído nesta barreira:

- SESSION-CAP-01: **PASS TÉCNICO COMPLETO / INTEGRADA**;
- RULES-AUDIT-01: **PASS — RULES APTAS PARA RC**;
- Rules produtivas principal e Warehouse capturadas: **SEM DRIFT**;
- TTL `sessionSlots.expiresAt` e `sessionRevocations.expiresAt`: **ACTIVE**;
- compatibilidade de rollout/rollback de Rules documentada;
- guards de sessão/Rules/lifecycle/telemetria e Browser E2E: PASS.

Ainda obrigatório antes de declarar RC CANDIDATE:

- criar/fixar branch única de composição;
- fixar fontes SaaS e Mobile;
- incorporar semanticamente os deltas;
- aplicar CT-01;
- reconciliar Auth/workspace/UG/sessão/Legal/billing/lifecycle;
- reconciliar Rules principal e Warehouse;
- reconciliar package/lockfile/Application CI;
- reconciliar repositories/shell/scanner/Central;
- registrar hashes do candidato;
- executar gates combinados no SHA exato;
- obter todos os gates obrigatórios verdes.

A validação física com múltiplos operadores Desktop/Mobile pertence à etapa de Preview HTTPS/MOBILE-J após o candidato congelado.

### 32.2 Antes do RC FROZEN

- nenhum conflito material;
- SHA único;
- manifesto de release;
- rollback de aplicação preparado;
- rollback de Rules preparado;
- baseline Performance R3 registrada;
- nenhuma mudança oportunista aberta.

### 32.3 Antes de produção controlada

- RULES-AUDIT-01 permanece válida para os hashes exatos do RC;
- nenhuma alteração de Rules posterior ao PASS ficou sem reauditoria;
- Preview aprovado;
- smoke crítico SaaS+Mobile;
- CT-01 comprovada;
- Rules comprovadas;
- integridade de dados sem dúvida;
- rollback pronto;
- risco HARDEN-B avaliado;
- autorização explícita do Fundador.

Preferência: backup READY nos dois bancos + `recovery:verify`.

### 32.4 Antes de PASS FINAL Mobile

- runbook físico executado;
- Android;
- iPhone ou pendência explicitamente classificada;
- Code128;
- som/vibração;
- rede;
- jornada ponta a ponta;
- Desktop↔Mobile;
- reconciliação final SaaS.

### 32.5 Antes da abertura comercial ampla

- piloto real;
- cliente pago real;
- trial→regularização;
- suspensão→bloqueio→reativação controlada;
- recovery/restore comprovado;
- uptime/alerta;
- custo/capacidade;
- SAAS-J;
- pendências classificadas;
- GO explícito.

## 33. Riscos que não podem ser esquecidos

- confundir billing comercial com autorização operacional;
- assumir que “pago” reativa automaticamente lifecycle desabilitado;
- apagar dados por inadimplência/cancelamento;
- deixar usuário suspenso sem regularização/recuperação acessível;
- duplicar Auth/sessão/legal na Mobile;
- confundir a remoção autorizada do teto de sessões com remoção do controle de sessão;
- manter por engano os IDs fixos `slot-1`/`slot-2` após declarar sessões sem teto;
- remover revogação/lease/telemetria junto com o limite;
- usar números históricos de lease/heartbeat em vez do runtime atual 30/15;
- sobrescrever CT-01;
- publicar Rules sem RULES-AUDIT-01 PASS;
- presumir que Rules do Git são idênticas às realmente ativas em produção;
- testar apenas ALLOW e esquecer DENY;
- validar apenas App RC + Rules RC e ignorar a janela de rollout/rollback;
- alterar Rules após auditoria sem invalidar/repetir o gate;
- publicar Rules sem rollback;
- confundir rollback Vercel com rollback de dados;
- merge/rebase cego entre SaaS e Mobile;
- criar fonte paralela logística;
- reabrir A1/A2 sem nova evidência;
- declarar uptime/backup/restore sem evidência real;
- declarar iPhone PASS por inferência;
- corrigir diretamente em `main`;
- tratar acabamento visual de PDF como blocker sem defeito funcional;
- considerar CI verde como autorização produtiva.

# PARTE X — CRONOLOGIA CANÔNICA

## 34. Marcos históricos principais

### 2026-09 — Central de Depósitos

Consolidados materiais, depósitos/posições, lotes/FEFO, intake, saída, consumo imediato, barcode, ledger, segurança externa e telemetria.

### 2026-10-01 — Performance R3

Rodada encerrada e publicada.

Baseline produtiva atual:

`main@e90f92acae1514ee5cbc6ce95fed354bc1454330`

### 2026-10-01 a 2026-10-02 — SaaS R1 funcional

Integrados billing, onboarding, legal, recovery tooling, lifecycle/security e integração SaaS.

Contrato comercial consolidado em R$ 70 / Plano Completo.

### 2026-10-02 — Program Control

Instituída governança global acima dos programas, com barreiras transversais e autoridade global de RC.

### 2026-10-02 a 2026-10-03 — Mobile R1 funcional

A–H, Integrações 1–3 e MOBILE-I concluídas/integradas.

Desenvolvimento funcional Mobile encerrado.

### 2026-10-03 — Hardening final

- HARDEN-A1: PASS;
- HARDEN-A2: PASS com risco residual aceito;
- HARDEN-C/D: PASS;
- HARDEN-B: parcial/temporal;
- MOBILE-J: certificação final;
- RC conjunto: composição liberada;
- produção: inalterada.

### 2026-10-03 — Remoção do teto fixo de sessões autorizada

Decisão do Fundador:

- remover o limite fixo de 2 sessões externas por workspace/UG;
- motivação principal: permitir múltiplos operadores simultâneos na Central Móvel;
- preservar lease, heartbeat, revogação, painel administrativo, auditoria, lifecycle e telemetria;
- implementar em frente transversal controlada `SESSION-CAP-01`;
- executar antes do RC CANDIDATE/RC FROZEN;
- até a execução, o runtime permanece em 2 sessões externas.

### 2026-10-03 — Auditoria integral de Rules torna-se gate obrigatório

Decisão do Fundador:

- não publicar as novas Firestore Rules por tentativa e erro;
- instituir `RULES-AUDIT-01`;
- auditar banco principal e `emprovex-warehouse`;
- comparar produção real versus ruleset final;
- exigir matriz ALLOW/DENY;
- exigir regressão das funcionalidades antigas e novas;
- exigir compatibilidade de rollout/rollback;
- executar auditoria final depois da SESSION-CAP-01;
- bloquear publicação produtiva de Rules sem PASS formal.

### 2026-10-03 — SESSION-CAP-01 + RULES-AUDIT-01 ativadas

Program Control criou a frente transversal única:

- branch: `rc-session-cap-rules-audit`;
- base congelada: `c6c164c70a1be3e2e7e4e57b0bbf4866d61a71ce`;
- fase 1: SESSION-CAP-01 — remover o teto fixo de 2 sessões preservando segurança, revogação, lifecycle, painel, auditoria e telemetria;
- fase 2: RULES-AUDIT-01 — auditar o ruleset final pós-SESSION-CAP-01 contra a produção/R3, SaaS, Mobile e rollback;
- integração cruzada/merge/rebase da integradora durante a execução: proibidos;
- publicação de Rules, deploy produtivo, merge em `main` e restore: não autorizados;
- handoff final obrigatório ao Program Control.

A frente deve permanecer sequencial: RULES-AUDIT-01 só pode declarar PASS final depois que SESSION-CAP-01 estabilizar o ruleset estrutural.

### 2026-10-04 — SESSION-CAP-01 concluída tecnicamente

Worker `rc-session-cap-rules-audit` encerrou desenvolvimento técnico em:

`a97c1a94799cbbc240994d76fefc6f85925bffe1`

PR:

**#248 — DRAFT / MERGEABLE / NÃO INTEGRADO**

Resultado aceito pelo Program Control:

- SESSION-CAP-01: **PASS TÉCNICO COMPLETO**;
- teto fixo de 2 sessões removido no candidato;
- lease dinâmico por `browserInstanceId`;
- lease 30 min / heartbeat 15 min / revogação 24 h preservados;
- `slot-1` e `slot-2` preservados somente para compatibilidade transitória;
- 3ª e 4ª sessões legítimas: ALLOW;
- pseudo-slot `slot-3`, ID dinâmico adulterado e takeover de lease ativo: DENY;
- painel administrativo, lifecycle, provisioning, revogação, auditoria e telemetria reconciliados;
- suspensão do workspace permanece fail-closed para N sessões;
- multi-tenant preservado.

Gates confirmados no fechamento:

- Application CI #959 — SUCCESS;
- Core Protection #246 — SUCCESS;
- Recovery #637 — SUCCESS;
- Legal Validation #61 — SUCCESS;
- Production Build — PASS;
- TypeScript final — PASS;
- Diff Hygiene — PASS;
- Browser E2E #49 / run 37171327188 — SUCCESS no SHA certificado `44372599fe0526313d3650a55c649615a1ff14d4`;
- Bloco 16.8 — 8/8 PASS;
- quatro sessões independentes + multitab compartilhado — 1/1 PASS.

Vercel permaneceu vermelho apenas por `build-rate-limit`, sem evidência de regressão funcional.

Produção, `main`, Vercel Production e Rules produtivas permaneceram inalterados.

### 2026-10-04 — Baseline produtiva das Rules confirmada sem drift

Leitura somente de produção concluída nos dois bancos.

Ruleset ativo — banco principal:

- release: `cloud.firestore/ai-studio-logsticahospital-3eeee498-faa1-4326-8f4f-95d34b382ec1`;
- ruleset ID: `06094fa5-0b5b-4dc0-a0b5-7ca032864860`;
- fingerprint Git normalizado: `0d990b7de0b2e85ed55fe14ec0d2ce29b3635299`;
- baseline esperada de `main`: `0d990b7de0b2e85ed55fe14ec0d2ce29b3635299`;
- drift: **NENHUM**.

Ruleset ativo — Warehouse:

- release: `cloud.firestore/emprovex-warehouse`;
- ruleset ID: `d246184a-350f-40a0-8241-f2b0fa631768`;
- fingerprint Git normalizado: `b5325fe5a8cbe9b0ade8568d35a2cd678ce6e0f2`;
- baseline esperada de `main`: `b5325fe5a8cbe9b0ade8568d35a2cd678ce6e0f2`;
- drift: **NENHUM**.

Primeiro gate externo da RULES-AUDIT-01: **PASS**.

### 2026-10-04 — RULES-AUDIT-01 encerrada em PASS

Verificação final confirmou:

- `sessionSlots.expiresAt`: `ACTIVE`;
- `sessionRevocations.expiresAt`: `ACTIVE`.

Com as Rules vivas previamente confirmadas sem drift e o inventário pré-TTL validado, o Program Control declara:

**RULES-AUDIT-01 = PASS — RULES APTAS PARA RC**

SESSION-CAP-01 permanece:

**PASS TÉCNICO COMPLETO**

Integração:

- PR #248 marcado ready;
- PR #248 squash-merged na integradora SaaS/RC;
- commit de integração: `54aba792cb9e7bb195e21401fb50a21ed50add19`;
- `main`: inalterado;
- aplicação RC: não publicada;
- Rules RC: não publicadas.

Próxima barreira global:

**composição do RC único SaaS R1 + Mobile R1**, seguida de CT-01, reconciliação package/lockfile/CI e gates no SHA exato.

### 2026-10-04 — TTL produtivo autorizado e em criação

Após autorização explícita do Fundador, foram iniciadas exclusivamente as políticas TTL em:

- `sessionSlots.expiresAt`;
- `sessionRevocations.expiresAt`;

no banco principal:

`ai-studio-logsticahospital-3eeee498-faa1-4326-8f4f-95d34b382ec1`.

Operações retornadas:

- sessionSlots: `AyBjNGNiYzA2Zjk5ZWQtOTU0YS01ZjY0LTQ3OGEtODg4OTM2ZGMkGnNlbmlsZXBpcAkKMxI`;
- sessionRevocations: `AyBiZjE1ZWYwMTMxMjgtMGU3OC03Yjc0LWQxZjUtZWYxNTNjY2EkGnNlbmlsZXBpcAkKMxI`.

Leitura imediata pós-ativação:

- sessionSlots.expiresAt → `ttlConfig.state = CREATING`;
- sessionRevocations.expiresAt → `ttlConfig.state = CREATING`.

Conclusão:

- comando de ativação aceito nos dois campos;
- nenhuma outra configuração produtiva foi alterada;
- RULES-AUDIT-01 permanece aberta somente até os dois TTLs atingirem `ACTIVE`;
- nenhuma nova escrita/configuração deve ser feita durante essa espera.

### 2026-10-04 — Inventário pré-TTL validado

Leitura somente de produção executada antes de qualquer ativação de TTL.

`sessionSlots`:

- total: **5**;
- sem `expiresAt`: **0**;
- expirados: **5**;
- não expirados: **0**.

`sessionRevocations`:

- total: **0**;
- sem `expiresAt`: **0**;
- expirados: **0**;
- não expirados: **0**.

Conclusão operacional:

- não existe sessão ativa que seria atingida imediatamente pela ativação de TTL;
- os 5 documentos existentes em `sessionSlots` já estão expirados e são resíduos de lease;
- não existem tombstones de revogação pendentes;
- ativar TTL nos dois collection groups é tecnicamente coerente com o contrato da SESSION-CAP-01;
- a ativação continua sendo mudança produtiva de retenção e exige autorização explícita do Fundador.

### 2026-10-04 — TTL produtivo ausente

Consulta somente leitura de:

- `sessionSlots.expiresAt`;
- `sessionRevocations.expiresAt`;

retornou somente `indexConfig`, sem `ttlConfig`.

Conclusão:

**TTL NÃO CONFIGURADO** nos dois collection groups.

Impacto:

- RULES-AUDIT-01 ainda não recebe PASS FINAL;
- SESSION-CAP-01 continua PASS técnico;
- ativar TTL é mudança produtiva de retenção e pode excluir documentos já expirados;
- ativação exige decisão/autorização explícita do Fundador;
- antes da ativação, Program Control deve preferencialmente inspecionar os documentos existentes e confirmar que `expiresAt` está coerente.

### 2026-10-04 — RULES-AUDIT-01 em fechamento externo

Classificação:

**PRONTA PARA FECHAMENTO EXTERNO / AINDA NÃO PASS FINAL**

Rules candidatas pós-SESSION-CAP:

- principal RC: `bc91185f34bcdcb4437a4de1078d1089a09292ba`;
- Warehouse RC: `6e1f1050005314db4e17cb3136409abbddb0ee91`.

Faltam apenas dois gates vivos:

1. capturar em modo somente leitura os rulesets realmente ativos nos dois bancos e comparar drift;
2. confirmar TTL realmente configurado para:
   - `sessionSlots.expiresAt`;
   - `sessionRevocations.expiresAt`.

Se houver drift inexplicado:

**STOP PRODUCTION RULES DRIFT — NÃO PUBLICAR.**

Se baseline vivo e TTL forem coerentes, Program Control poderá fechar RULES-AUDIT-01 e seguir para integração/RC conforme governança.

Ordem de rollout candidata, se mantida após os gates vivos:

```text
Rules RC
→ aplicação RC
```

Compatibilidade comprovada:

- app antiga + Rules RC: compatível via `slot-1`/`slot-2`;
- app RC + Rules RC: alvo;
- app RC + Rules antigas: incompatível.

Rollback:

- aplicação pode voltar primeiro mantendo Rules RC;
- rollback das Rules exige rollback prévio da aplicação.

### 2026-10-03 — Transição para Release Engineering

Por decisão do Fundador:

- Coordenador Geral assume também Coordenação do RC;
- Coordenadores SaaS/Mobile entram em modo consulta/evidência;
- nenhuma nova wave funcional autorizada;
- próximo produto a ser construído é um único SHA de RC SaaS+Mobile.

### 2026-10-15 — Regularização controlada do Suco (Warehouse)

Após retirada dos estoques de teste e remoção das NFs da fila pelo Fundador, permaneceu um saldo legado de 5 unidades do Suco sem localização. A ocorrência `POSITIVE_UNASSIGNED=5` já constava do memorial de integridade e fora excluída expressamente do reparo anterior dos lotes.

A manutenção pontual foi preparada no [PR #310](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/310) e executada pelo Fundador no PowerShell com autenticação gcloud. Dry-run PASS, backup local pré-write e correção atômica PASS: `balances` 5→0, `locationBalances.UNASSIGNED` 5→0, movimento `INVENTORY_ADJUSTMENT` -5 preservando ledger/histórico. Nenhum deploy, merge, alteração de Rules ou exclusão de NFs. Outros materiais não foram abrangidos por essa conferência.

---

# PARTE XI — DECISÕES PERMANENTES

## 35. Decisões que só podem mudar por decisão explícita

### Produto

- experiência operacional prevalece sobre otimização marginal;
- SaaS e Mobile são interfaces do mesmo produto;
- Central Mobile não cria backend/fonte de verdade paralelos;
- uma única autoridade por material/saldo/lote/posição/ledger.

### Comercial

- Plano Completo R$ 70/mês por workspace;
- trial padrão 30 dias;
- vencimento 5º dia útil;
- tolerância 10 dias;
- cobrança externa;
- confirmação manual;
- modo observe;
- sem suspensão automática;
- sem delete por inadimplência;
- API/webhook fora da R1;
- founder/VIP usam `exempt`;
- VIP não perde funcionalidades.

### Billing versus lifecycle

- `billingAccounts` é fonte comercial;
- `workspaces.status` + `platformAccounts.status` + `warehouseAccess` governam acesso;
- status comercial sozinho não deve virar autorização;
- suspensão/reativação real é ação administrativa explícita;
- pagamento confirmado não reativa automaticamente lifecycle desabilitado.

### Identidade e sessão

- founder Google-only;
- externo password-only;
- workspace/UG/UID/e-mail precisam ser coerentes;
- founder isento de capacidade;
- runtime atual dos externos: 2 sessões, **com remoção do teto fixo já autorizada pelo Fundador**;
- estado alvo: sessões externas sem limite fixo por workspace, preservando identidade/lease/revogação/auditoria/telemetria;
- a migração deve ocorrer antes do RC freeze;
- lease atual permanece 30 min;
- heartbeat atual permanece 15 min;
- revogação administrativa encerra sessões conhecidas;
- fail-closed em inconsistência.

### Legal

- pacote legal versionado;
- versão atual `saas-r1-2026-10-01`;
- aceite por UID + bundle;
- nenhum aceite é presumido em erro;
- VIP não possui exceção legal;
- regularização/Termos/Privacidade/recuperação não devem ser bloqueadas indevidamente.

### Dados

- cancelamento comercial não apaga dados;
- suspensão não altera estoque/documentos;
- exportação/retenção/exclusão são processos separados;
- nenhum rollback improvisado de estoque/ledger.

### Segurança e dependências

- RULES-AUDIT-01 é gate obrigatório antes de publicar Rules do novo release;
- Rules realmente ativas devem ser capturadas e comparadas ao Git antes de rollout;
- todo delta de Rule precisa de justificativa + teste ALLOW/DENY;
- regressão da Performance R3 é obrigatória com o ruleset final;
- rollback de Rules é separado de rollback Vercel;
- alteração de Rules após PASS invalida os blocos afetados da auditoria;
- Rules não são afrouxadas para facilitar teste;
- CT-01 permite somente câmera same-origin;
- microfone/geolocalização permanecem bloqueados;
- A2 não reabre sem nova evidência/upstream relevante;
- não usar `npm audit fix --force` como estratégia.

### PDFs

- jsPDF 4.2.1 / AutoTable 5.0.8;
- defeito funcional em PDF bloqueia;
- acabamento visual fino isolado não bloqueia e pode ir para backlog.

### Release

- `main` não é branch de experimentação;
- Preview testa o SHA que poderá ser promovido;
- aplicação, Rules e dados possuem rollback/reconciliação distintos;
- CI verde não autoriza produção;
- Fundador mantém GO/NO-GO produtivo final.

### Desenvolvimento

- novas features SaaS/Mobile estão congeladas durante a composição/certificação do RC;
- corrigir apenas regressão concreta;
- conflitos são resolvidos semanticamente;
- workers/frentes especializadas não integram cruzado por conveniência.

# PARTE XII — ÍNDICE OPERACIONAL

## 36. Documentos globais

- `docs/EMPROVEX_MEMORIAL_OFICIAL.md` — estado/contratos/governança;
- `docs/EMPROVEX_PROGRAM_CONTROL.md` — protocolo do Coordenador Geral;
- `docs/EMPROVEX_MEMORIAL_HISTORICO_ATE_2026-10-03.md` — histórico integral preservado.

## 37. SaaS R1

Documentos canônicos:

- `docs/SAAS_R1_PLANO_MESTRE.md`;
- `docs/SAAS_R1_EXECUCAO_PARALELA.md`;
- `docs/SAAS_R1_INTEGRATION_STATUS.md`;
- `docs/SAAS_R1_COORDENADOR_HANDOFF.md`;
- `docs/SAAS_R1_PRE_PILOTO_HARDENING.md`;
- `docs/SAAS_R1_HARDEN_A2_FIREBASE_FIRESTORE_GRPC.md`;
- documentação HARDEN-B/recovery.

Para contrato comercial/operacional vigente, este Memorial tem precedência sobre checkpoints históricos antigos.

## 38. Mobile R1

Documentos canônicos:

- `docs/CENTRAL_MOBILE_R1_PLANO_MESTRE.md`;
- `docs/CENTRAL_MOBILE_R1_EXECUCAO_PARALELA.md`;
- `docs/CENTRAL_MOBILE_R1_INTEGRATION_STATUS.md`;
- `docs/CENTRAL_MOBILE_R1_COORDENADOR_HANDOFF.md`;
- `docs/CENTRAL_MOBILE_R1_FINAL_CERTIFICATION.md` — MOBILE-J;
- `docs/CENTRAL_MOBILE_R1_MOBILE_J_PHYSICAL_TEST_RUNBOOK.md` — atualmente na branch `mobile-r1-j-final-certification`.

O runbook físico é procedural. Este Memorial registra os critérios canônicos; o runbook registra casos/evidências.

## 39. Central de Depósitos

- `docs/adm-deposito/README.md`;
- `docs/adm-deposito/STATUS.md`;
- `docs/adm-deposito/DECISIONS.md`;
- `docs/adm-deposito/ROADMAP.md`.
- `docs/WAREHOUSE_INTEGRITY_RECONCILE_01.md` — auditoria que identificou `POSITIVE_UNASSIGNED=5`.
- `docs/WAREHOUSE_DATA_REPAIR_EXECUTION_01.md` — reparo anterior dos lotes, sem baixa das cinco unidades.
- [PR #310](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/310) — executor de correção pontual e evidência pós-commit do Suco (2026-10-15).

## 40. Performance R3

- `docs/PERFORMANCE_R3_COMERCIALIZACAO.md`;
- `docs/PERFORMANCE_R3_EXECUCAO_PARALELA.md`;
- `docs/PERFORMANCE_R3_INTEGRATION_STATUS.md`;
- `docs/PERFORMANCE_R3_COORDENADOR_HANDOFF.md`.

## 41. Testes e CI

- `docs/TESTING_POLICY.md`;
- `docs/DEVELOPMENT_CI_WORKFLOW.md`.

---

# PARTE XIII — PROTOCOLO DE ATUALIZAÇÃO DO MEMORIAL

## 42. O que deve ser atualizado imediatamente

Atualizar o Memorial quando houver:

- mudança de `main`;
- nova integradora relevante;
- conclusão de wave;
- mudança de semáforo global;
- conflito transversal;
- decisão arquitetural;
- mudança de contrato comercial;
- mudança de política de segurança;
- freeze de RC;
- produção/release;
- novo blocker global.

## 43. O que não deve inflar novamente o Memorial

Detalhes como:

- todos os runs;
- logs de terminal;
- cada tentativa de CI;
- cada commit intermediário;
- cada comentário de PR;
- cada prompt de worker;

devem continuar preservados nos documentos especializados/Git, mas não duplicados integralmente no corpo principal.

## 44. Regra de preservação histórica

Nenhuma reorganização documental pode apagar evidência histórica.

Quando uma seção crescer a ponto de prejudicar leitura:

1. consolidar o estado vigente neste Memorial;
2. preservar a versão detalhada em documento histórico/especializado;
3. registrar link explícito;
4. manter Git como trilha definitiva.

O arquivo:

`docs/EMPROVEX_MEMORIAL_HISTORICO_ATE_2026-10-03.md`

é a primeira aplicação formal dessa regra e contém o Memorial legado integral.

---

# 45. Estado para retomada imediata

```text
PRODUÇÃO
main@e90f92acae1514ee5cbc6ce95fed354bc1454330
Performance R3
aplicação RC: NÃO PUBLICADA
Rules RC: NÃO PUBLICADAS

GOVERNANÇA
Program Control + Coordenação do RC: ATIVO
Coordenadores SaaS/Mobile: consulta/evidência sob demanda
Fundador: autoridade final de produção/GO

SAAS R1
funcional: ENCERRADO
integrador com SESSION-CAP: feat/saas-r1-commercializacao
commit de integração runtime SESSION-CAP/RULES-AUDIT: 54aba792cb9e7bb195e21401fb50a21ed50add19
HARDEN-A1: PASS
HARDEN-A2: PASS — risco residual aceito
HARDEN-B: PARCIAL / temporal
HARDEN-C: PASS
HARDEN-D: PASS
nova feature SaaS: NÃO AUTORIZADA

BILLING R1
Plano Completo: R$ 70/mês
trial: 30 dias
vencimento: 5º dia útil
tolerância: 10 dias
modo: observe
requirePayment: false
automaticSuspension: false
pagamento: externo via Link HTTPS/Pix
confirmação: manual/auditada
suspensão operacional: manual via lifecycle
delete por inadimplência: NÃO

IDENTIDADE / SESSÕES
founder: Google-only / capacidade isenta
externo: e-mail+senha / e-mail verificado
workspace↔UG↔conta primária: obrigatório
produção R3 atual: teto histórico de 2 sessões externas
candidato SaaS/RC: múltiplas sessões externas sem teto fixo, com controle individual
SESSION-CAP-01: PASS TÉCNICO COMPLETO / INTEGRADA
lease: 30 min
heartbeat: 15 min
TTL sessionSlots.expiresAt: ACTIVE
TTL sessionRevocations.expiresAt: ACTIVE
fail-closed: SIM

LEGAL
bundle: saas-r1-2026-10-01
terms: terms-2026-10-01-r1
privacy: privacy-2026-10-01-r1
aceite: versionado por UID/workspace
erro de verificação: fail-closed

MOBILE R1
integrador: feat/central-mobile-r1@7b7717b6eebabf911310d2b8ac56ed13c9cb9238
funcional A–I: ENCERRADO
MOBILE-J: CERTIFICAÇÃO FINAL EM EXECUÇÃO
HEAD J: 90d646372aae3e92318a78b90d71f72c5eb6b00e
blocker funcional: NENHUM
próximo trabalho: RC Preview HTTPS + runbook físico

RULES
PR #248: MERGED
squash SESSION-CAP/RULES-AUDIT: 54aba792cb9e7bb195e21401fb50a21ed50add19
RULES-AUDIT-01: PASS — RULES APTAS PARA RC
produção principal viva: 0d990b7de0b2e85ed55fe14ec0d2ce29b3635299
produção warehouse viva: b5325fe5a8cbe9b0ade8568d35a2cd678ce6e0f2
drift produtivo: NENHUM
principal RC: bc91185f34bcdcb4437a4de1078d1089a09292ba
warehouse RC: 6e1f1050005314db4e17cb3136409abbddb0ee91
ordem futura autorizável de rollout: Rules RC → aplicação RC
publicação produtiva RC: NÃO AUTORIZADA
rollback Rules: obrigatório e independente do Vercel

RECOVERY
PITR: ATIVO em ambos
delete protection: ATIVA
backup diário: ATIVO
retenção: 14 semanas
backup READY: PENDENTE
recovery:verify: PENDENTE
restore isolado real: PENDENTE / protegido

RELEASE
RC único SaaS+Mobile: PRONTO PARA COMPOSIÇÃO
RC Candidate: AINDA NÃO DECLARADO
RC Frozen: NÃO
CT-01: PENDENTE NO RC
Preview HTTPS: AINDA NÃO PUBLICADO
produção controlada: NÃO AUTORIZADA
piloto real: NÃO INICIADO
abertura comercial: NÃO AUTORIZADA

PRÓXIMA SEQUÊNCIA
criar/fixar branch única do RC
→ compor SaaS + Mobile semanticamente
→ aplicar CT-01
→ reconciliar Rules/package/lockfile/CI/contratos
→ executar gates no SHA exato
→ declarar RC CANDIDATE se PASS
→ RC FROZEN
→ Preview HTTPS
→ testes SaaS + MOBILE-J físicos
→ corrigir somente regressões/blockers reais
→ nova reconciliação/freeze se necessário
→ GO/NO-GO explícito para produção controlada
```

## Regra final de continuidade

Antes de qualquer decisão futura:

1. ler este bloco;
2. conferir HEADs vivos;
3. conferir se o evento é funcional, transversal ou produtivo;
4. nunca promover estado histórico a estado vigente;
5. nunca considerar uma pendência “resolvida” sem evidência;
6. nunca tratar PASS técnico como autorização de produção.