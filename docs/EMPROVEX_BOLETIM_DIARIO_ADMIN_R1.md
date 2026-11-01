# EMPROVEX — Boletim Diário do Administrador R1 (Gmail API)

**Status:** PR #445 — implementação na branch, sem publicação nem agendamento em produção. **Resend foi descartado** em favor da Gmail API já usada para os envios aos fornecedores.

## Objetivo e horário

Resumo administrativo agregado às **18:00**, todos os dias, no fuso **America/Sao_Paulo**, com remetente **`marcoa.r.aquino@gmail.com`** e destinatário **`codex.martis.dev@gmail.com`**, definidos pelo administrador. O boletim é independente dos alertas de uptime existentes no Google Cloud Monitoring.

## Como o Gmail existente será reaproveitado

- O envio de cronogramas dos fornecedores já chama a Gmail API com `gmail.send` e `userinfo.email` em `lib/googleWorkspaceMail.ts`.
- Esse módulo é `use client`: usa autorização temporária no navegador, sem refresh token no servidor; **não é possível chamá-lo de um job automático diretamente**.
- O novo `lib/server/adminDigestGmail.ts` utiliza a **mesma Gmail API** (`users/me/messages/send`) e o formato MIME/base64URL, porém com OAuth `offline`, validando a identidade do Gmail remetente antes de enviar.
- Não modificar o fluxo dos fornecedores, não adicionar Resend, não exigir outro domínio de envio ou uma nova conta Gmail.

## Indicadores R1

Uptime do check público existente nas últimas 24h, erros HTTP 5xx Cloud Run quando disponíveis, contas por estado, ciclos pagos/abertos/pendentes/vencidos, revisões de cobrança e métricas globais parciais de Read/Realtime Read/Write Units.

Indicadores ausentes são descritos como indisponíveis. Não inferir receita recebida de ciclos marcados pagos. Não incluir PII de clientes, documentos de fornecedores, dados bancários ou detalhes por UG.

Backups já existentes e alertas de uptime permanecem intactos; esta versão não consulta a data de última execução de backup nem faz contagem automática de incidentes de segurança.

## Autorização Google — uma única vez

**A autorização atual do navegador não basta para um envio às 18h sem ninguém conectado.** É necessário um grant OAuth 2.0 de acesso offline à conta remetente **`marcoa.r.aquino@gmail.com`**:

1. Usar o cliente OAuth do projeto GCP EMPROVEX existente, se ele suportar o fluxo de servidor (redirect URI válido e client secret), ou criar um client OAuth adicional no mesmo projeto. Não criar outra conta Google.
2. Solicitar os escopos `https://www.googleapis.com/auth/gmail.send` e `https://www.googleapis.com/auth/userinfo.email`, parâmetros `access_type=offline`, `prompt=consent`.
3. Usar o `refresh_token` obtido uma única vez e armazenar **somente no Secret Manager**, com acesso exclusivo ao runtime do Cloud Run. Guardar client secret também no Secret Manager; nunca publicar tokens no Git ou colar no chat.
4. Conferir o estado do OAuth consent screen: apps externos em **Testing** podem receber refresh tokens com validade de **sete dias** para `gmail.send`; para operação permanente será necessário um estado de produção aplicável.
5. Não usar service account para enviar como uma conta pessoal `@gmail.com`; isso não substitui autorização do titular. Não pedir senha ou senha de aplicativo da conta.

## Configurações de runtime para o Cloud Run

- `EMPROVEX_ADMIN_DIGEST_ENABLED=1` — somente após credenciais válidas e teste controlado;
- `EMPROVEX_ADMIN_DIGEST_TO=codex.martis.dev@gmail.com`;
- `EMPROVEX_ADMIN_DIGEST_GMAIL_FROM=marcoa.r.aquino@gmail.com` = conta autorizada no OAuth; o servidor verifica essa identidade antes de enviar;
- `EMPROVEX_ADMIN_DIGEST_GMAIL_CLIENT_ID` = ID do OAuth client (pode vir de variável/Secret Manager);
- `EMPROVEX_ADMIN_DIGEST_GMAIL_CLIENT_SECRET` = referência versionada do Secret Manager;
- `EMPROVEX_ADMIN_DIGEST_GMAIL_REFRESH_TOKEN` = referência versionada do Secret Manager;
- `EMPROVEX_ADMIN_DIGEST_SCHEDULER_EMAIL=emprovex-digest-trigger@gen-lang-client-0982077967.iam.gserviceaccount.com`;
- `EMPROVEX_ADMIN_DIGEST_OIDC_AUDIENCE=https://emprovex.com.br/api/cron/admin-digest`.

A autorização OAuth deve ser concedida pela conta `marcoa.r.aquino@gmail.com`, não pela destinatária `codex.martis.dev@gmail.com`. O destinatário não precisa autorizar nada.

Não incluir no deploy a chave antiga Resend: `EMPROVEX_ADMIN_DIGEST_RESEND_API_KEY` é obsoleta nesta PR.

## Rota, armazenamento e duplicidade

`POST /api/cron/admin-digest` valida token OIDC assinado pelo Google, issuer/audience, e-mail e `email_verified` da conta de serviço destinada exclusivamente ao Cloud Scheduler. O servidor usa a identidade Cloud Run para ler fontes de dados, grava um marcador diário em `platformAdminDigestRuns/{YYYY-MM-DD}` e envia o e-mail via Gmail.

O Gmail **não oferece Idempotency-Key em `messages.send`**. Por segurança: gravar `pending` *antes* do envio; caso exista `pending` em uma tentativa seguinte, **não reenviar automaticamente** — investigar caixa de enviados e logs, pois o Gmail pode ter enviado antes de uma falha de rede. Após envio e marcação `sent`, tentativas seguintes retornam `already_sent`.

Portanto, a deduplicação automática é conservadora: minimiza reenvios, mas pode exigir revisão manual em incidentes raros. É intencional.

## Agendamento (somente após homologação das credenciais e deploy)

Criar conta de serviço de disparo sem chaves, sem acesso direto a Firestore/Secret Manager. Criar um único job Cloud Scheduler na região southamerica-east1:

- `schedule: 0 18 * * *`
- `time-zone: America/Sao_Paulo`
- `HTTP: POST https://emprovex.com.br/api/cron/admin-digest`
- `oidc-service-account-email`: conta dedicada de disparo
- `oidc-token-audience: https://emprovex.com.br/api/cron/admin-digest`

Não instalar agendamento antes do deploy válido; não recriar nem modificar cron legado `usage-snapshot` desta etapa. Não duplicar o job.

## Homologação mínima GOV-SIMP-01

- `node --test scripts/admin-daily-digest.test.mjs` e Fast CI (TypeScript);
- rota sem autenticação -> 401 quando habilitada;
- autorização Google com conta remetente confirmada pelo `userinfo.email`;
- envio controlado e recebimento do e-mail pelo destinatário;
- reexecução no mesmo dia -> `already_sent` após envio confirmado;
- observar a primeira execução automática das 18h sem interferência no envio de cronogramas aos fornecedores.

**Nenhuma chave, refresh token, senha ou segredo deve ser fornecido neste chat ou versionado no GitHub.**