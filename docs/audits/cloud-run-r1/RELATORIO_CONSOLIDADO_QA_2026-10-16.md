# EMPROVEX — CLOUD-RUN-R1 — Relatório consolidado da implantação de QA

**Data do checkpoint:** 2026-10-16 (Brasil)  
**Estado:** QA INFRA PARCIALMENTE IMPLEMENTADO / SEM DEPLOY / MIGRAÇÃO NO-GO  
**Fonte operacional:** saídas do PowerShell enviadas pelo Fundador; evidências e PRs GitHub listados abaixo.

## Atualização W7 — acesso IAM positivo certificado (16/10/2026)

O teste real executado pelo Fundador via `EMPROVEX_QA_W7_TESTE_IAM_CORRIGIDO.ps1` retornou **PASS token temporário** e **HTTP 200** com a service account `emprovex-qa-runtime@emprovex-qa-r1-261015-6275.iam.gserviceaccount.com` tanto no banco `qa-core` quanto no `qa-warehouse`, projeto `emprovex-qa-r1-261015-6275`. Foram executadas somente leituras de 1 item máximo em `emprovexQaSecurityProbe` por banco, sem exibição do token e sem gravações. **Autorização IAM positiva: PASS funcional nos dois bancos.**

O teste **não incluiu acesso negativo** contra outro banco/projeto, Firebase Auth, cliente sob Security Rules ou inspeção Next bundle. As Rules `deny-all` W7 existem somente em PR DRAFT, não foram publicadas. Para teste negativo HTTP 403 em produção, será necessária autorização expressa e restrita; `404` de banco inexistente não comprova IAM negado. Revisar viabilidade de teste QA com política simulada sem criar terceiro banco e registrar limites; priorizar configuração Firebase Auth/Rules QA e CI staging. Revogar binding temporário Token Creator na própria conta de serviço após terminar testes de impersonação.

**Andamento recalculado por marcos iguais:** etapa 3 Segurança/Isolamento `62,5%` (antes `50%`); migração geral `52,5%` (antes `50%`). Sem deploy, sem merge, sem alteração no GCP produtivo. Estado **NO-GO**.

**Nota de arquitetura:** a documentação oficial exige **adicionar Firebase ao projeto GCP existente** antes do uso pleno de Firebase Authentication; habilitar `firebaserules.googleapis.com` não equivale a registrar um FirebaseProject. A operação `addFirebase` é persistente e habilita múltiplas APIs: pesquisar/inspecionar presença antes de solicitar execução no projeto QA, e obter confirmação do Fundador para essa ativação. Fontes: https://firebase.google.com/docs/projects/use-firebase-with-existing-cloud-project e https://firebase.google.com/docs/rules/manage-deploy .

## 1. Resultado executivo

O programa passou das auditorias W1–W3 e preparação W4–W6 para a criação efetiva de infraestrutura GCP de homologação separada. A produção Vercel de `emprovex.com.br` não foi migrada nem alterada pelos comandos desta etapa. **Não houve deploy Cloud Run e o interlock `K_SERVICE` no código W4 continua bloqueando inicialização em Cloud Run.** Testes sintéticos PASS não equivalem à certificação de acesso IAM/Firebase/Rules em QA real.

## 2. Infraestrutura QA — evidências reais

| Item | Resultado verificado | Observações |
|---|---|---|
| GCP Project | `emprovex-qa-r1-261015-6275` (`953294034210`), ACTIVE | projeto independente do produtivo `gen-lang-client-0982077967` |
| Parent | consulta `projects describe --format=yaml(projectId,parent)` retornou só projectId | compatível com No organization; não prova ausência de todos os outros controles |
| Billing | `billingEnabled: true` | conta existente de exibição `Pagamento do Firebase`, moeda BRL; a vinculação foi feita somente no QA |
| Budget QA | `EMPROVEX QA R1 - Mensal`, BRL 20, MONTH, projeto `953294034210` | thresholds CURRENT_SPEND 25/50/75/100%; INCLUDE_ALL_CREDITS; é alerta, **não teto de cobrança** |
| APIs | `billingbudgets.googleapis.com` e `firestore.googleapis.com` habilitadas no QA | não há evidência de Cloud Run/Artifact Registry habilitados |
| Core | `qa-core`, us-east1, Firestore Native Standard | `DELETE_PROTECTION_ENABLED`, `POINT_IN_TIME_RECOVERY_DISABLED`, `freeTier: true` |
| Warehouse | `qa-warehouse`, us-east1, Firestore Native Standard | `DELETE_PROTECTION_ENABLED`, `POINT_IN_TIME_RECOVERY_DISABLED`, `freeTier: false` |
| Runtime identity | `emprovex-qa-runtime@emprovex-qa-r1-261015-6275.iam.gserviceaccount.com` | conta própria criada, sem chave JSON emitida por esse comando; não vinculada a serviço Cloud Run |
| IAM QA inicial | founder `roles/owner` + Firebase rules system agent + Firestore service agent | sem principals públicos ou produtivos na policy explícita apresentada |
| IAM `qa-core` | `roles/datastore.user` **condicional** a `resource.name=='projects/emprovex-qa-r1-261015-6275/databases/qa-core'` | update policy v3 confirmado; **acesso positivo/negativo ainda não testado** |
| IAM `qa-warehouse` | `roles/datastore.user` **condicional** a `resource.name=='projects/emprovex-qa-r1-261015-6275/databases/qa-warehouse'` | política v3 atualizada; **acesso positivo/negativo ainda não testado** |

**Auditoria independente read-only (16/10):** comando `gcloud.cmd projects get-iam-policy emprovex-qa-r1-261015-6275 --format="yaml(bindings)"` confirmou as duas condições Core/Warehouse na mesma service account, e manteve apenas service agents Google e Founder como outros bindings. Não houve teste de acesso real, nem vínculo com IAM produtivo. O resultado reforça a aprovação de configuração, mas não altera o avanço estimado (etapa 3 e migração geral 50%).

**Evidência adicional recebida:** `gcloud projects add-iam-policy-binding` retornou `Updated IAM policy` com **dois bindings separados**, títulos `EmprovexQaCoreOnly` e `EmprovexQaWarehouseOnly`, cada um vinculado exclusivamente ao nome exato do seu banco; `etag` e `version: 3` presentes. **PASS configuração**; não confundir com PASS de acesso autenticado efetivo. O próximo marco é a prova do comportamento real da identidade. Progresso estimado da etapa de segurança: **25% → 50%**; geral por cinco etapas equivalentes: **50%**.

**Correção da estimativa de custo:** a resposta GCP para `qa-core` comprova `freeTier: true` — o **primeiro banco criado** recebeu a franquia gratuita do projeto, embora tenha ID nomeado. `qa-warehouse` mostra `freeTier: false` e gera cobranças conforme uso. O orçamento BRL 20 não desativa recursos automaticamente. Evitar gerar leituras ou testes volumosos não autorizados.

## 3. Desenvolvimento técnico e CI

- Auditorias independentes W1 (PR #316), W2 (PR #318), W3 (PR #319) produziram riscos e gates de migração.
- Coordenação e memorial: PR #317 DRAFT, branch `docs/cloud-run-r1-coordination-workers-20261015`. Produção e `main` não devem ser alteradas.
- W4 PR #320 DRAFT: validação fail-closed de isolamento; preparação de token gerenciado/ADC; interlock de startup `CLOUD_RUN_RUNTIME_NOT_CERTIFIED_R01_R02_R04`; sem Dockerfile/deploy.
- W5 PR #321 DRAFT, base W4: seleção de configuração Firebase cliente/servidor e nomes de bancos QA, build marker e verificações de ambiente. Application CI #38836001393 PASS, Core Protection #38836001337 PASS.
- W6 PR #322 DRAFT, base W5: revisão independente, workflow Firebase Emulator #38837933261 com **9/9 PASS**, Application CI #38837933621 PASS e Core Protection #38837933233 PASS, código certificado em `0bf71b5ec136685fdd56c2629b75d03f75655de4`.
- Cobertura W6: F05 alocação real/persistência/replay; F06 transferência real via SDK `runTransaction`, saldo total preservado e replay; F09 **consumo imediato** persistido, replay; negações sintéticas e bloqueio de tráfego para origem/projeto produtivo.
- Defeito F05→F06 reproduzido e corrigido **na branch W6**, sem promover a produção: normalização de lote na leitura do `lib/warehouse/locationRepository.ts`, preservando validação estrita.

### W7 — IAM APIs habilitadas no QA (2026-10-16)

- **Evidência da execução local do Fundador:** `gcloud.cmd services enable iam.googleapis.com iamcredentials.googleapis.com --project=emprovex-qa-r1-261015-6275` retornou `Operation ... finished successfully`. As APIs **IAM** e **IAM Service Account Credentials** foram habilitadas somente no projeto QA; a operação não criou chaves JSON nem concedeu papéis IAM.
- **Próximo gate read-only:** consultar a política da conta de serviço `emprovex-qa-runtime@emprovex-qa-r1-261015-6275.iam.gserviceaccount.com` por `gcloud.cmd iam service-accounts get-iam-policy ... --project=emprovex-qa-r1-261015-6275` antes de qualquer concessão `roles/iam.serviceAccountTokenCreator`, sempre restrita à própria identidade e não ao projeto inteiro. Não exibir tokens no chat. Depois testar ADC positivo e 403 negativo em QA/produção mediante plano de teste seguro.
- **Progresso constante:** etapa 3 — 50%; migração geral — 50%. Cloud Run continua NO-GO, produção Vercel e dados produtivos preservados.

## Checkpoint W7 — auditoria integrada e CI (16/10/2026)

- Saída PowerShell do fundador: `EMPROVEX_QA_W7_AUDITORIA.ps1` executou consultas no projeto `emprovex-qa-r1-261015-6275` com **PASS PARCIAL** nos itens: projeto ativo, faturamento, APIs essenciais, dois bancos QA Standard Native us-east1, delete-protection e freeTier conforme contrato, runtime SA, dois IAM condicionais e ausência de bindings públicos explícitos. A mensagem `OrÃ§amento` é falha cosmética de codificação, não resultado técnico.
- GitHub Actions PR #323 SHA `330149897751627f760fe18aedf555bb964a6395`: W7 offline [#38847873118](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/runs/38847873118) **success**, Core Protection [#38847873008](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/runs/38847873008) **success**, Application CI [#38847872902](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/runs/38847872902) **success**.
- **Não inferir** acesso real por service account, IAM deny efetivo ou Rules publicadas. Testes operacionais IAM com credencial temporária e Firebase Auth/Rules continuam pendentes. Sem teste de negação contra produção sem autorização adicional expressa. **Etapa 3 50%; geral 50%**, ambas por marcos.

## 4. Pendências obrigatórias — não declarar PASS antecipado

1. **IAM Core e Warehouse condicional registrado.** Auditar política de forma independente e executar testes **reais** de leitura autorizada nos dois bancos QA e negação **HTTP 403** no projeto produtivo usando a identidade runtime QA.
2. Configurar/inspecionar Firebase Security Rules por banco; regras IAM de servidor/Admin SDK **não** são substituídas pelas Rules de cliente. Auditoria Auth/App Check, Google login/OAuth e usuários sintéticos **sem reutilizar Auth de produção**.
3. Provar build/staging Next e inspecionar bundle para imports/referências do Firebase produtivo; corrigir antes de liberar interlock de startup W4.
4. Cobrir F09 **saída física multi-linha e falha intermediária** (distinta de consumo imediato), concorrência F06 e validação funcional via identidade remota.
5. Preparar WIF de deploy no GitHub com identidade separada, permissões restritas ao QA, sem service account JSON e sem acessos de produção.
6. Somente após autorização e gates: Artifact Registry/Cloud Run QA privado, min instances 0, restrições de escala, logs e controle de custos; nunca `emprovex.com.br` durante QA.
7. Plano de restore isolado R03, ensaio e rollback. Nenhum restore real executado até esta data.
8. Revisar custos reais periódicos; billing budget é mecanismo de **notificação**, não gasto máximo garantido.

## 5. Governança e próximas ações

**ONDE ESTAMOS:** projeto QA, faturamento, orçamento, dois bancos e runtime SA criados; **IAM condicional Core e Warehouse atualizado**, certificação operacional ainda pendente. **Etapa 3: 50%; progresso geral 50%**, ambos indicadores por marcos com pesos iguais, sem estimativa de tempo.  
**O QUE ESTAMOS FAZENDO:** certificar autorização IAM realmente efetiva e isolamento QA, ainda sem serviço Cloud Run.  
**QUEM ESTÁ FAZENDO:** fundador executa comandos administrativos no PowerShell; coordenação audita saídas/estado e atualiza memorial/PRs.  
**O QUE FAZER A SEGUIR:** consultar/read-only os dois bindings condicionais já gravados, planejar testes efetivos positivos/negativos sem expor credenciais, avaliar Firebase/Auth Rules e build.  
**QUEM O FARÁ:** fundador no projeto QA e coordenador/worker de QA independente; alterações adicionais em serviços devem ser claramente delimitadas antes de executar.

**Decisão:** CLOUD-RUN-R1 **NO-GO** para migração/deploy; nenhum merge automático; projeto produtivo `gen-lang-client-0982077967`, Vercel, DNS, dados reais e `main` preservados.

## 6. Links oficiais

- [PR #317 — Memorial/coordenação](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/317)
- [PR #320 — W4 isolamento e ADC](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/320)
- [PR #321 — W5 Firebase](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/321)
- [PR #322 — W6 QA independente](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/322)
- [W6 revisão independente](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/test/cloud-run-r1-w6-fastpath-independent/docs/audits/cloud-run-r1/worker-6/REVISAO_INDEPENDENTE.md)
- [W6 plano IAM/ADC](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/blob/test/cloud-run-r1-w6-fastpath-independent/docs/audits/cloud-run-r1/worker-6/PLANO_HOMOLOGACAO_ADC_IAM.md)
