# EMPROVEX — Homologação integrada Cloud Run (plano simplificado)

Status: **pronto para teste de build/deploy privado, não certificado para tráfego de clientes**. Branch de trabalho: `feat/cloud-run-r7-service-identity-20261031`, PR #426 Draft. `main`, Vercel e `emprovex.com.br` não foram modificados.

## Concluído antes desta etapa
- 11 versões de segredos migradas para Secret Manager R4/R6; pontes temporárias desativadas.
- R7 identidade nativa Cloud Run e testes (5 unitários, 6 integração, typecheck, CI de segurança/E2E).
- IAM direta aos 11 segredos, Cloud Monitoring e Firebase Auth; Firestore com condições por banco; Cloud Run Job `emprovex-r7-iam-probe-44l8g` concluiu com êxito, após correção do nome reservado do documento de teste.

## Build e deploy privado
- `Dockerfile` multiestágio Next.js 15.5.24 / Node 24 / output standalone; contém `npm run typecheck && npm run build`; não injeta secrets no build.
- `.dockerignore` protege arquivos `.env*`, credenciais, Git e `.vercel`.
- `ops/deploy-emprovex-cloud-run-staging.ps1`: sem argumentos = *dry-run*; `-Deploy` cria **apenas** o serviço `emprovex-cloudrun-staging` na região `southamerica-east1`, com conta `emprovex-run-runtime`, `--no-allow-unauthenticated`, `--min-instances=0` e `--max-instances=1`.
- A primeira homologação **não recebe nenhum dos 11 segredos**. `INFINITEPAY_BILLING_ENABLED=0` e `EMPROVEX_BILLING_ENFORCEMENT_ENABLED=0`, sem chave InfinitePay; não testar pagamentos.
- Deploy privado exige autenticação IAM. Não é uma prévia de login para navegador comum. A primeira validação é de empacotamento, inicialização, `/api/health`, página institucional e código/status de rotas protegidas. Não consumir APIs com efeitos colaterais.
- A identidade `emprovex-run-runtime` possui IAM de **escrita** em dois bancos de produção e administra Auth. Não executar rotas que criem, atualizem ou excluam contas, dados, estoques ou cobranças na homologação inicial.
- `gcloud run deploy --source .` pode exigir Cloud Build e Artifact Registry, gerar custos e solicitar configuração de serviços. Não desabilitar IAM nem conceder Viewer/Editor global para contornar erros.

## Pendente para migração funcional (antes de aceitar usuários)
1. Inventário completo de variáveis Vercel Production. Os 11 segredos transferidos são apenas parte da configuração. Revisar `CRON_SECRET`, `APP_URL`, configuração App Check/Google OAuth, URLs públicas, variáveis de billing, integrações de Drive e outros valores.
2. Testar Firebase Authentication e App Check no domínio privado de homologação; Cloud Run IAM pode impedir acesso normal no navegador. Planejar ambiente autenticado ou sandbox com dados sintéticos, sem conceder acesso público ao backend atual com permissões de produção.
3. Adaptar cron Vercel para Cloud Scheduler sem duas execuções simultâneas; coordenar no corte.
4. Validar webhooks/callbacks InfinitePay e origem pública, garantir entrega/assinatura, idempotência de pagamentos, e implementar rollback para a Vercel antes de redirecionar o domínio.
5. Testar custo e latência entre Cloud Run `southamerica-east1` e bancos Firestore `us-east1`.
6. Antes de redirecionar `emprovex.com.br`, aprovar decisão de cutover, smoke do serviço operacional, callbacks, backups e rollback. Não remover configurações da Vercel até o corte certificado.

## Critério imediato
Uma homologação **privada** compila e inicia a aplicação Next.js sem secrets financeiros e sem causar efeitos em dados operacionais. Não confundir smoke técnico com liberação comercial. A homologação funcional de faturamento exige etapas adicionais, agrupadas num único plano de cutover.
