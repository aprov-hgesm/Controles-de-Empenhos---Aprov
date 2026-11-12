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
