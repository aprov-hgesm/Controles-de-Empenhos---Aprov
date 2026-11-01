# EMPROVEX — Boletim Diário do Administrador R1

Situação: IMPLEMENTADO EM BRANCH / AGUARDANDO PR, SEGREDOS E ATIVAÇÃO EXTERNA. Não enviado em produção.

## Objetivo

Boletim agregado enviado **todos os dias às 18:00 no fuso America/Sao_Paulo**, ao e-mail pessoal administrativo autorizado, sem sessão no navegador. Esta função complementa, mas NÃO substitui, os alertas de indisponibilidade do Google Cloud Monitoring.

## O que inclui

- Sucesso das amostras regionais do uptime check nas últimas 24 horas (não é SLA).
- Respostas 5xx do Cloud Run, quando disponíveis.
- Situação geral das contas na Central de Assinaturas: ativos, trial, pendentes, suspensos, isentos e cancelados.
- Ciclos marcados pagos, pendentes, vencidos e solicitações de revisão financeira (não são valores efetivamente recebidos).
- Read/Realtime Read/Write Units do Firestore principal (parcial; não é a fatura).
- Limites explícitos: os eventos de segurança e o horário do último backup não são consultados nesta R1. Os backups existentes permanecem intocados.

Dados ausentes são apresentados como "indisponíveis", nunca como zero. Não inclui PII de clientes, dados bancários, PDFs ou detalhes de UGs.

## Código

- POST /api/cron/admin-digest: verifica token OIDC assinado pelo Google (issuer, audience e conta de serviço do Scheduler).
- lib/server/adminDailyDigest.ts: consulta fontes consolidadas já implementadas, armazena marcador de envio diário no Firestore principal e envia via API Resend.
- lib/adminDailyDigest.mjs: composição pura do texto; testado.
- scripts/admin-daily-digest.test.mjs: testes mínimos de semântica e proteção.
- Coleção técnica: platformAdminDigestRuns/{YYYY-MM-DD}; contém somente texto agregado e estado do despacho; acesso exclusivamente via IAM do runtime (Rules permanecem inalteradas).
- Idempotência do provedor por dia (24 horas) e marcador persistente de envio evitam duplicações nas reexecuções comuns.

## Configuração externa pendente — não presumir aplicada

1. Verificar domínio remetente no Resend, configurar chave de envio restrita e guardar em Secret Manager (sem copiar chave para GitHub).
2. Criar uma conta de serviço sem chaves para o Cloud Scheduler, por exemplo emprovex-digest-trigger@gen-lang-client-0982077967.iam.gserviceaccount.com. Não conceder a ela acesso ao Firestore/Secret Manager; ela é somente identidade de disparo.
3. Publicar a revisão pela pipeline Cloud Run existente, preservando segredos atuais. Somente após essa etapa, anexar as seguintes configurações de runtime, sem inventar valores:
   - EMPROVEX_ADMIN_DIGEST_ENABLED=1
   - EMPROVEX_ADMIN_DIGEST_TO=marcoa.r.aquino@gmail.com
   - EMPROVEX_ADMIN_DIGEST_FROM=EMPROVEX <boletim@emprovex.com.br> (exemplo sujeito a domínio verificado)
   - EMPROVEX_ADMIN_DIGEST_RESEND_API_KEY=referência versionada Secret Manager
   - EMPROVEX_ADMIN_DIGEST_SCHEDULER_EMAIL=emprovex-digest-trigger@gen-lang-client-0982077967.iam.gserviceaccount.com
   - EMPROVEX_ADMIN_DIGEST_OIDC_AUDIENCE=https://emprovex.com.br/api/cron/admin-digest
4. Validar que a rota POST recusa token ausente (HTTP 401) e que o Cloud Run runtime possui IAM suficiente para consulta Firestore/Monitoring.
5. Criar UM job Cloud Scheduler na região southamerica-east1 com cron "0 18 * * *", time-zone "America/Sao_Paulo", HTTP POST, URL https://emprovex.com.br/api/cron/admin-digest, identidade OIDC da service account dedicada e audience idêntico ao da variável acima. Exemplo de comando a ajustar ao recurso existente:

   gcloud.cmd scheduler jobs create http emprovex-admin-digest-r1 --project=gen-lang-client-0982077967 --location=southamerica-east1 --schedule="0 18 * * *" --time-zone="America/Sao_Paulo" --http-method=POST --uri="https://emprovex.com.br/api/cron/admin-digest" --oidc-service-account-email="emprovex-digest-trigger@gen-lang-client-0982077967.iam.gserviceaccount.com" --oidc-token-audience="https://emprovex.com.br/api/cron/admin-digest"

6. Conferir uma execução autenticada e a entrega no e-mail. Retry seguro retorna "already_sent" após o despacho marcado sent. Monitorar falhas de job pelo Cloud Scheduler/Logging.

Nunca criar job antes de publicar com as variáveis válidas, senão haverá somente HTTP 503. Nunca usar conta de envio Gmail autorizada no browser como credencial de serviço. Não criar um segundo cron de usage-snapshot: a migração do cron legado Vercel permanece independente.

## Testes mínimos

- node --test scripts/admin-daily-digest.test.mjs
- npm run typecheck
- npm run build, na revisão candidata.
- Teste de rota POST sem autorização; teste único autorizado; repetição retorna already_sent; entrega do e-mail.

Não alterar Rules, workspaces, pagamentos, backups, uptime check existente, configuração de DNS, nem promover produção sem configuração externa validada.
