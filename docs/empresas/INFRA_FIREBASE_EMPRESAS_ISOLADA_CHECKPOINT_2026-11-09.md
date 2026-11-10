# EMPROVEX Empresas — infraestrutura isolada, execução e gate

**Branch:** `integration/emprovex-empresas-firebase-backend-isolado-20261109` (PR #538; sem merge/deploy). **Objetivo:** backend e Auth/Firestore da empresa sem usar identidade, recursos ou dados do portal militar.

## Evidências e escopo implementado no Git
- Firebase Web `emprovex-empresas`, Firestore `(default)`, Rules `allow read, write: if false;` (estado confirmado anteriormente pelo titular, NÃO reescrever).
- Client Auth empresarial exclusivo; issuer/audience estritos; stores empresariais apontam ao Firestore do novo projeto.
- `middleware.ts`: apenas `/entrar-empresa`, `/empresa/**`, `/empresa-convite`, `/api/company/**` e assets estritamente listados são servidos no Cloud Run empresarial. `/api/admin/**`, rotas militares, `/login` etc. retornam 404 no runtime empresarial. No runtime militar, o middleware não restringe rotas.
- `lib/server/companyRuntimeGuards.mjs`: Cloud Run isolado deve chamar-se `emprovex-empresas`, ter `K_REVISION`, Runtime Project = `emprovex-empresas` e SA de nome `emprovex-empresas-runtime@HOST_PROJECT_ID.iam.gserviceaccount.com`; consulta a identidade **real anexada** via metadata antes do primeiro token OAuth. Não usar chave JSON.
- Testes sintéticos: `node --test scripts/empresas-isolated-runtime.test.mjs`, mais testes W0-W15 já na CI. Eles não provam IAM live.

## Topologia econômica e segregada
- **Firebase/Firestore alvo:** `emprovex-empresas`, banco `(default)`, Auth novo, Rules deny-all para clientes.
- **Cloud Run host:** projeto GCP **já faturado**, mas serviço NOVO `emprovex-empresas` e SA NOVA `emprovex-empresas-runtime`. O host pode ser o mesmo projeto GCP do Cloud Run principal, **desde que as identidades e os serviços sejam diferentes**. Não é necessário alterar o projeto Firebase Spark para fazer o Cloud Run operar no outro projeto, sujeito a autorização IAM interprojetos.
- **IAM runtime:** conceder `roles/datastore.user` exclusivamente em `emprovex-empresas`, não no projeto militar. Secret Manager: `roles/secretmanager.secretAccessor` somente no secret empresarial isolado no HOST.
- **Não conceder runtime Firebase Authentication Admin**: o cadastro inicial de usuário/empresa precisa de um fluxo administrativo separado, auditado e fora de rotas públicas; a rota legada `/api/admin/provision-company` permanece bloqueada no Cloud Run empresarial. O runtime não é um administrador do Firebase.
- O projeto empresarial tem cota/quota e billing próprios; IAM cruzado não significa que a carga de Cloud Run em HOST seja contabilizada no Firebase.
- Documentos (W5): NÃO ativar uploads live enquanto não houver bucket `EMPROVEX_COMPANY_DOCUMENTS_BUCKET` dedicado, IAM próprio, policy e smoke-test.

## Procedimento preparado (NÃO executado)

O operador que dispõe de `gcloud` autenticado e permissões nos dois projetos:
1. Confirmar Firestore location/edition, billing, orçamento/alertas, e `gcloud projects describe` nos dois projetos; confirmar que o Cloud Run principal usa outra identidade.
2. Construir container **dessa branch e SHA revisados**, com `Dockerfile` existente, e publicar na registry do HOST; obter imagem imutável `...@sha256:...`. O build precisa passar; não reciclar imagem antiga do serviço militar.
3. Executar **sem mutações**: `HOST_PROJECT_ID=<id-do-host-faturado> COMPANY_IMAGE=<repo>@sha256:<digest> bash scripts/empresas-cloudrun-isolated.sh --plan`.
4. Depois da autorização de GCP e validação do escopo, executar a mesma chamada com `--apply`. O script recusa sobrescrever um serviço pré-existente e NÃO chama deploy/patch do serviço militar. Ele mantém o novo Cloud Run privado e `EMPROVEX_COMPANY_PILOT_ENABLED=0`.
5. Certificar `gcloud run services describe emprovex-empresas --project HOST --region southamerica-east1`, service account correta, projeto Firestore correto, regras fechadas, ausência de acesso do SA ao projeto militar e secrets delimitados. **Não assumir sucesso somente porque o script terminou.**
6. Criar bootstrap privado e auditável para primeira conta empresarial: criar Auth novo e documento workspace/índices de forma coerente, com plano de rollback em caso de falha. Não abrir `/api/admin/provision-company` no runtime empresarial e não copiar usuários do Firebase militar. Esse fluxo **ainda não está implementado para execução live**.
7. Executar testes E2E reais, em instância privada, usando conta sintética empresarial: login, UID e-mail verificado, CNPJ, revogação, perfis A/B, convite, estoque, financeiro, documentos (somente quando bucket dedicado), desktop/mobile, tentativa de acesso a /admin e a /api/empenhos (404), projeto militar no mesmo endereço (não afetado). Rodar testes Firestore Rules negadas para SDK cliente e IAM servidor no projeto novo; registrar SHA e logs.
8. Apenas após GO documentado: alterar piloto para QA isolado, liberar entrada ao navegador de testadores com controles e URL própria `empresas.emprovex.com.br` ou endpoint autorizado; **não alterar `emprovex.com.br` nem ativar público automaticamente**.

### Gates atuais
- **GO**: revisão do código da PR e execução de testes sintéticos no GitHub; plano IAM/deploy preparado.
- **NO-GO**: afirmar GCP criado, Firestore em uso real, Cloud Run publicado, bootstrap efetuado, homologação real, merge ou piloto público. O conector atual não concede acesso administrativo ao Google Cloud, portanto nenhuma dessas mutações foi executada nesta etapa.
- Build CI inicial de #538 parou em `app/layout.tsx`, `next/font/google`, por resposta inesperada do loader na busca de fontes. Essa falha não prova um problema Firebase; deve ser resolvida/testada sem modificar a infraestrutura militar.
- Rollback operacional: manter piloto OFF e serviço privado; a PR Draft não altera `main`. Para recurso recém-criado, a eventual exclusão deve ocorrer somente após revisão humana dos identificadores.

**Segurança:** não enviar senhas, chaves de service account ou tokens para o chat/repositório. Nunca conceder acesso global a `roles/editor` nem compartilhar service account militar.
