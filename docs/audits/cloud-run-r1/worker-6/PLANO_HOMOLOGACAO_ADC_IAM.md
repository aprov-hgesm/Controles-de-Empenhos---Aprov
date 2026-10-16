# CLOUD-RUN-R1 / W6 — Plano de homologação real com ADC e IAM isolado

**STATUS: PLANO NÃO EXECUTADO. Exige autorização expressa adicional do fundador antes de habilitar APIs, criar recursos, IAM, deployment, DNS ou billing.**

## Princípio: produção inacessível por desenho, não só por código

Projeto de produção existente: `gen-lang-client-0982077967` (Core e Warehouse nomeados, Vercel vigente). **Não criar QA dentro dele.** Solicitar autorização para **novo projeto GCP/Firebase exclusivamente QA**, com IDs próprios e faturamento/restrições avaliados antes da criação.

O projeto novo precisa conter:
1. Firebase Auth de QA, usuários fictícios e provedores de login ajustados ao domínio QA (sem compartilhar usuários nem OAuth credentials da produção).
2. Dois bancos Firestore QA **nomeados e distintos**, em região alinhada aos testes: sugeridos `qa-core` e `qa-warehouse`, nunca `(default)` por fallback, nem IDs produtivos.
3. Service Account **exclusiva de runtime** de QA, gerenciada, **sem chaves JSON**, vinculada explicitamente ao Cloud Run; Service Account **separada de deployment** por GitHub OIDC/WIF, com trust limitado a repositório/branch/environment e revisão humana.
4. Container em Artifact Registry somente do projeto QA; nenhum push no registry produtivo ou Vercel; custo de registry, builds, Cloud Run e logs avaliado.
5. Cloud Run QA privado com acesso invocador IAM para smoke técnico inicial. Usar domínio temporário, **nunca `emprovex.com.br`**. Para QA browser, discutir acesso autenticado e Firebase Auth App Check/OAuth autorizado antes de abrir HTTP anônimo.
6. Cloud Scheduler **desabilitado** em QA inicialmente; quando autorizado, usar identity OIDC distinta e `roles/run.invoker` apenas no serviço QA. Não acionar cron Vercel nem duplicar snapshots na produção.

## IAM mínimo proposto (não atribuído)

| Principal | Permissões pretendidas no projeto QA | Exclusões |
|---|---|---|
| `emprovex-qa-runtime` (service identity Cloud Run) | Apenas `datastore.entities.*` necessárias a Core/Warehouse QA, com preferências por concessão condicionada ao banco; `monitoring.timeSeries.list` somente quando o monitoring QA for habilitado; Firebase Auth Admin apenas se APIs administrativas testadas realmente precisarem | Sem acesso ao projeto produtivo; sem Editor/Owner; sem chaves JSON |
| `emprovex-qa-deployer` (identidade GitHub WIF) | Implantação Cloud Run do serviço QA, push Artifact Registry QA e `iam.serviceAccounts.actAs` **somente** na identidade runtime QA | Sem Firestore write, sem deploy produtivo, sem acesso a chaves/segredos |
| `emprovex-qa-scheduler` (fase posterior) | `roles/run.invoker` restrito ao Cloud Run QA | Sem Firestore/IAM nem permissão em produção |
| Revisor humano | Consulta e implantação QA conforme necessidade; grant de IAM apenas via Owner do projeto QA com consentimento | Sem alterações na conta proprietária de produção |

### Regra crítica: teste negativo de produção

Depois de conceder IAM mínimo no **projeto QA**, validar token ADC da identidade runtime de QA:
- Pode ler/gravar somente documentos sintéticos em `qa-core` e `qa-warehouse`, com permissões explicitamente concedidas.
- Tentativa de listar/ler/escrever em **cada banco produtivo** usando essa identidade recebe **403 Permission Denied**; não interpretar 404, erro de rede ou timeout como prova de negação IAM.
- Testes cross-workspace em QA são negados pelo contrato de autorização do aplicativo e por Rules do SDK cliente; IAM de Admin server pode ignorar Rules, então guard de workspace em API é obrigatório.
- Confirmação explícita de identity metadata (projectId e email), sem credencial privada/JSON e sem `GOOGLE_APPLICATION_CREDENTIALS`.

**Cautela:** condições IAM por banco Firestore exigem desenho e teste em API/SDK; o Console nem sempre aplica as condições da mesma maneira. Privilegiar isolamento por projeto + bindings estritos. Referência oficial: https://cloud.google.com/firestore/native/docs/manage-databases

## Gates mínimos, na ordem

- **H0 (agora, sem custo externo):** W6 revisão independente; rotas F05/F09 em Emulator; F06 repo `runTransaction`; testes de saída física F09 separados; startup guard Cloud Run permanece ligado.
- **H1 (documental):** revisão de custo com limites Cloud Run/Artifact Registry/Logging/Firestore QA; orçamento e alertas; revisão de dados pessoais e nomes DNS; escolha de região. Orçamento **não impede automaticamente cobranças**, estabelecer quotas/limites de instâncias.
- **H2 (autorização do Fundador):** criar apenas projeto QA e recursos estritamente previstos.
- **H3 (infra isolada):** IAM QA + WIF/identidade gerenciada; provas positivas em QA e negativas em projeto produtivo com contas de teste; 0 dados produtivos escritos ou copiados.
- **H4 (artifact):** validar build `cloud-run-staging` usando flags do QA no CI; verificar bundle por referências proibidas e ausência de segredos; não remover `instrumentation.ts` antes da certificação.
- **H5 (deploy QA com aprovação específica):** criar serviço Cloud Run QA, um único revision/tag, timeout e escala mínimos, ingress com controle; logs sem PII; **sem domínio produtivo**.
- **H6 (funcional):** autenticação QA, regras de domínio, Warehouse F05/F06/F09, R19 GET potencialmente mutante tratado como mutação, NF/empenhos, OAuth/AppCheck, relatório, Core/Warehouse, rollback de QA.
- **H7 (recuperação):** ensaio de restore em recurso QA isolado com checklist integridade; não copiar Firestore produtivo sem autorização de uso de dados; comparar R03.
- **H8 (separado, futuro):** após PASS de todos os gates e autorização explícita, discutir cron Scheduler e migração de `emprovex.com.br`, rollback/TTL/DNS e custos.

## Ações do fundador — SOMENTE DEPOIS DO CONVITE

A autorização atual contempla GitHub e testes locais; **não é necessário executar comandos gcloud agora**. Antes de H2, fundador escolhe projeto QA, confirma limites de custo, projeto/faturamento/Google login e dá autorização específica.

**Critério NO-GO:** ausência de IAM deny real em produção, divergência Firebase client/server ou bancos, falha F05/F06/F09, ausência de restore/rollback, build com referências produtivas, ou CI incompleto. Nada autoriza remover o bloqueio de startup Cloud Run automaticamente.
