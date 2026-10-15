# W3 — Admin, identidade, ADC e dois bancos

## Cadeia verificada
1. Browser envia **Firebase ID token** em lib/warehouse/intakeActionClient.ts:18–34; lib/server/firebaseFounderAuth.ts:112–145 valida assinatura JWKS, issuer, audience Firebase, RS256 e e-mail verificado. Não é OAuth access token de serviço nem OIDC Cloud Run.
2. lib/server/warehouseAccess.ts:79–100,114–203 usa **ID token do usuário** para Firestore REST do banco Core e valida platformAccounts e workspaces (UID/e-mail/status/UG/provedor). Se claims não coincidem, pode chamar ensureSectorWarehouseClaims.
3. lib/server/sectorProvisioningAdmin.ts:120–217 exige FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON. Assina JWT assertion RS256 com audience oauth2.googleapis.com/token e scope cloud-platform; troca por **OAuth access token** e faz cache com margem de 60s. Ausência/JSON inválido/projeto incorreto resulta em 503 SERVER_CONFIGURATION.
4. app/api/central-depositos/intake-action/route.ts:1160–1175 autoriza usuário, então adquire token OAuth privilegiado e grava em Firestore REST Warehouse **emprovex-warehouse**. REST commit com preconditions updateTime/exists:false em :228–269. Rules de usuário não substituem validações de domínio server-side.
5. lib/server/sectorLifecycleAdmin.ts:112–125 opera Core e Warehouse; lib/server/firebaseAuthBackup.ts:65–134 usa chave JSON para Identity Toolkit/Firestore; lib/server/googleCloudMonitoring.ts:113–175 usa chave de monitoring ou Admin (scope monitoring.read); lib/server/globalUsageHistory.ts:27–106,188–225 usa credencial Admin para PATCH no Core. ADC **não entra automaticamente** em nenhum desses fluxos.
6. APIs admin provision-sector, sector-lifecycle, delete-sector e auth-backup verificam fundador em suas rotas. Preservar autorização de workspace/fundador sem substituí-la por IAM de serviço.

## Matriz operação → banco/API → identidade → autorização → teste de negação
| Operação | Destino | Identidade | Autorização | Teste futuro |
|---|---|---|---|---|
| Verificação de setor | Core nomeado | Firebase ID token | regras + vinculação UID/workspace/UG | negação cross-tenant/revogação |
| F05/F09 fast-path | Warehouse nomeado | OAuth de serviço | verifyWarehouseRequest + asserts workspace/UG | cross-tenant, replay, token 403 |
| Lifecycle/Admin | Core, Warehouse, Identity Toolkit | OAuth de serviço | sessão fundadora + kill-switch | negar setor; IAM mínimo |
| Backup Auth | Identity Toolkit/Core | OAuth de serviço | fundador | 403 e escopo limitado |
| Monitoramento | Monitoring API | OAuth de serviço | fundador/cron | scope, IAM e 403 |
| Histórico de uso | Core nomeado | OAuth de serviço | cron autenticado | persistência obrigatória |
| Regularização pública | Core nomeado | OAuth de serviço | GET público projetado | dados autorizados/cache |

## Contrato de adaptação futura (sem patch)
Criar provedor de tokens OAuth por escopo, utilizando **Cloud Run service identity + ADC** sem private key estática; diferenciar deployer de runtime; validar credenciais e identidade em startup/health isolado. Para Google APIs/Firestore REST usar **OAuth access token**; para invocar Cloud Run protegido usar **OIDC ID token** com audience da URL destino; para autorizar usuários continuar usando **Firebase ID token**. Não confundir scopes nem aceitar (default) em produção. Preservar projeto Firebase, dois IDs explícitos, falha fechada, validações por documento e logs sem PII. Testes: sem JSON + ADC válido, ADC sem permissão/403, refresh/expiração, Identity Toolkit sem role, dois bancos, usuário suspenso e cross-workspace. Matriz IAM real/roles concedidas, condição de acesso e Rules efetivas dependem do Worker 2/admin e **não estão verificadas**.
Fonte oficial: https://docs.cloud.google.com/run/docs/securing/service-identity .