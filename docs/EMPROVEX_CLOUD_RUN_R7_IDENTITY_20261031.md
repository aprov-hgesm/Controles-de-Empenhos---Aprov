# EMPROVEX Cloud Run R7 — identidade nativa para Firebase Auth e Monitoring

**ESTADO:** implementação em branch isolada / PR DRAFT. **NÃO MESCLAR, NÃO PUBLICAR, NÃO ALTERAR IAM SEM AUTORIZAÇÃO.**

## Base de produção e objetivo

A Vercel `emprovex.com.br` permanece na versão homologada `dpl_EEm5C5DC4ickXDtevHj5ztL66BkY`.
As pontes R4/R6 transferiram 11 valores e foram desativadas e revogadas. Não reutilizá-las.

As três variáveis antigas `FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON`, `EMPROVEX_GCP_MONITORING_CLIENT_EMAIL`, `EMPROVEX_GCP_MONITORING_PRIVATE_KEY` **não são transferidas** ao Cloud Run.

O Cloud Run recebe tokens OAuth2 curtos da conta de serviço anexada à revisão (`emprovex-run-runtime@gen-lang-client-0982077967.iam.gserviceaccount.com`) via servidor de metadados Google, com cabeçalho `Metadata-Flavor: Google` e URL fixa. Não depende de arquivo JSON de conta de serviço nem de chave privada. O mecanismo usa a **mesma identidade de execução que as bibliotecas ADC usariam**, mas obtém o token diretamente do servidor de metadados para evitar dependências adicionais.

## Mudanças de código

1. `lib/server/cloudRunServiceIdentity.mjs` + declaração TypeScript: detector `K_SERVICE`+`K_REVISION`, endpoint de metadados fixo, timeout de 5s, cache de acesso com margem de 60s, sem registro de tokens.
2. `lib/server/sectorProvisioningAdmin.ts`: `getGoogleAccessToken` usa identidade Cloud Run somente em Cloud Run; fluxo JWT privado mantido fora dele (Vercel).
3. `lib/server/firebaseAuthBackup.ts`: backup administrativo usa identidade Cloud Run; fluxo antigo preservado na Vercel.
4. `lib/server/googleCloudMonitoring.ts`: a leitura de métricas usa identidade Cloud Run exclusivamente em Cloud Run, sem fallback para chaves privadas; fora do Cloud Run, mantém alternativas atuais.
5. `lib/platformCapacity.ts`: tipagem de `credentialSource='cloud-run'`.

## Pré-requisitos da homologação do Cloud Run

- [ ] Habilitar e conferir Google Cloud Run, Firebase Authentication / Identity Toolkit API, Cloud Firestore API e Cloud Monitoring API, conforme necessidades atuais.
- [ ] Executar o serviço com `--service-account=emprovex-run-runtime@gen-lang-client-0982077967.iam.gserviceaccount.com`, jamais a conta migradora R4/R6.
- [ ] Conceder **somente** os papéis necessários ao funcionamento real, após inspeção/auditoria. Possíveis papéis:
  - `roles/firebaseauth.admin` no projeto Firebase (provisionamento e gerenciamento de usuários; permissões sensíveis; não conceder até homologação).
  - `roles/datastore.user` no projeto ou granularidade suportada pelo Firestore, considerando ambos os bancos nomeados; testar escopo e negar acesso cruzado por tenant na camada de aplicação.
  - `roles/monitoring.viewer` (leitura de métricas).
  - `roles/secretmanager.secretAccessor` **somente** para os 11 segredos já migrados (3 da R4 e 8 da R6). A identidade do Cloud Run foi autorizada originalmente para os 3 da R4; conferir e conceder os demais 8 antes do deploy.
- [ ] Não estabelecer `GOOGLE_APPLICATION_CREDENTIALS` no Cloud Run; identidade vem da revisão.
- [ ] Validar a integridade dos dois bancos Firestore e política multi-tenant, especialmente Firestore REST sob IAM elevado no servidor.
- [ ] Confirmar outras variáveis e requisitos no inventário de R8, inclusive `CRON_SECRET`, URLs/origens, OAuth, Firebase público no build e política de callbacks InfinitePay.
- [ ] Na homologação, **não executar** operação real de cobrança, criação/exclusão de usuários ou escrita em dados de clientes: usar testes isolados.
- [ ] Confirmar UI/admin/Monitoring e rotas protegidas antes de corte. Não redirecionar domínio, webhook, crons ou callbacks automaticamente.

## Testes locais

`node --test scripts/cloud-run-r7-service-identity.test.mjs`

Os testes unitários cobrem escopo de execução, endpoint fixo, timeout, cache/renovação, erro de metadados, ausência de fallback e preservação da Vercel. **Não substituem testes de IAM real com Cloud Run.**

## Critérios de aceite

- `npm run typecheck` PASS e suíte R7 PASS.
- Rotinas antigas na Vercel passam sem `K_SERVICE` e `K_REVISION`.
- Revisão Cloud Run roda com identidade anexada e nenhum JSON/chave privada; credenciais recuperadas somente na execução, não no build nem no navegador.
- Monitoramento do Cloud Run exibe `credentialSource='cloud-run'`.
- Sem alteração de produção ou `main` até certificação explícita.
