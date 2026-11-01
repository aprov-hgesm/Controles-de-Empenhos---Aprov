# EMPROVEX — Memorial Oficial do Boletim Diário do Administrador (R1/R2)

**Estado final: CONCLUÍDO, HOMOLOGADO E ATIVO EM PRODUÇÃO — 01/11/2026.**

**Responsável funcional:** Desenvolvedor, Administrador e Gestor do EMPROVEX.  
**Diretriz:** GOV-SIMP-01 — segurança essencial, reaproveitamento, intervenção mínima e testes proporcionais ao risco.  
**Escopo deste memorial:** boletim executivo automático enviado pela Gmail API, independente dos alertas operacionais já existentes.

> **Certificação de encerramento (01/11/2026):** a integração foi publicada no Cloud Run, houve envio real de teste confirmado na pasta **Enviados** da conta remetente, o job diário foi criado e verificado como **ENABLED**, e o acesso administrativo temporário ao Cloud Scheduler foi revogado após a ativação. A chegada à caixa de entrada do destinatário e a primeira execução regular às 18h não foram verificadas nesta certificação; não confundir com o teste de envio bem-sucedido.

## 1. Configuração operacional oficial

| Parâmetro | Valor confirmado |
| --- | --- |
| Remetente | `marcoa.r.aquino@gmail.com` |
| Destinatário | `codex.martis.dev@gmail.com` |
| Periodicidade | Diária, inclusive fins de semana |
| Horário | 18h00 (`0 18 * * *`) |
| Fuso | `America/Sao_Paulo` |
| Projeto Google Cloud | `gen-lang-client-0982077967` |
| Região | `southamerica-east1` |
| Serviço Cloud Run | `emprovex-cloudrun-candidate` |
| Job Cloud Scheduler | `emprovex-admin-digest-r1` |
| Método e rota | `POST https://emprovex.com.br/api/cron/admin-digest` |
| Autenticação do job | OIDC assinado pelo Google, com audience igual à URL da rota |
| Identidade OIDC efetivamente utilizada | `emprovex-run-runtime@gen-lang-client-0982077967.iam.gserviceaccount.com` |
| Transporte de e-mail | Gmail API `users/me/messages/send`, OAuth offline, sem Resend |

O agendamento teve `state: ENABLED` e próxima execução informada pelo serviço como `2026-11-01T21:00:00Z`, equivalente a **01/11/2026, 18h de Brasília**. O job de teste temporário `emprovex-admin-digest-r2-test-once` foi excluído depois da homologação; **não há um segundo agendamento diário** previsto nesta implementação.

## 2. Evidências de homologação e publicação

- **PR #445 — núcleo R1:** integração da rota, geração do conteúdo agregado, Gmail API e testes; incorporada à `main` no commit `1ccb1383c2a61c5e4a05e5b4f4c1cbba670f3d42`.
- **PR #449 — apresentação R2:** saudação e linguagem dirigidas ao Desenvolvedor, Administrador e Gestor, e-mail executivo HTML com alternativa em texto puro e teste isolado; incorporada à `main`. Os testes do boletim e a proteção do núcleo foram aprovados.
- **PR #452 — ativação segura:** execução do processo pelo workflow de promoção já autorizado via Workload Identity Federation (WIF), sem alterar a condição de segurança do provedor; incorporada à `main`.
- **Ativação definitiva:** workflow GitHub Actions `EMPROVEX Cloud Run — promote approved revision`, execução **#41271765423**, concluído com `success`: https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/runs/41271765423 .
- **Revisão colocada em tráfego:** `emprovex-cloudrun-candidate-dbadb5c53e62b-6`, baseada na imagem do SHA `badb5c53e62be2a7cc8f1ed95f0f98849ddf6f3f`, com **100% do tráfego** após teste, promoção e verificação de saúde.
- **Teste real automatizado:** uma execução autenticada do Cloud Scheduler contra a revisão candidata, em `POST /api/cron/admin-digest?mode=test`, teve resultado de entrega HTTP considerado bem-sucedido pelo workflow. O Gmail da conta remetente registrou a mensagem **`[TESTE] EMPROVEX | Boletim de Gestão — 2026-11-01`**, destinada a `codex.martis.dev@gmail.com`. O teste foi independente da chave diária e não consome o envio das 18h.
- **Teste de apresentação adicional:** `[TESTE DE RECEBIMENTO] EMPROVEX | Seu boletim de gestão — prévia executiva`, também enviado a partir da conta conectada. Era somente prévia visual, sem métricas operacionais coletadas; **não** substituiu o teste automático.
- **Agendamento definitivo:** o mesmo workflow criou e validou o job `emprovex-admin-digest-r1`, `schedule: 0 18 * * *`, `timeZone: America/Sao_Paulo`, `state: ENABLED`, com requisição `POST` autenticada por OIDC.
- **Segurança após ativação:** o administrador confirmou no PowerShell a retirada do papel temporário `roles/cloudscheduler.admin` da conta `emprovex-github-deployer@gen-lang-client-0982077967.iam.gserviceaccount.com`. A retirada não cancela um job já criado e não revoga os direitos específicos de acesso do runtime aos segredos Gmail.

**Limites da evidência:** o status `SENT` confirma que o Gmail aceitou/registrou as mensagens, mas não prova leitura nem recebimento na caixa de entrada externa. A primeira execução regular das 18h permanece um evento futuro no momento desta homologação. O êxito do teste de integração não significa que todos os indicadores retornarão dados em todo dia; ausência de dados deve continuar explícita.

## 3. Estrutura do boletim e personalidade editorial

O e-mail apresenta identidade visual EMPROVEX, com HTML responsivo e alternativa `text/plain`, mantendo legibilidade em clientes de e-mail variados.

**Tratamento editorial:** comunicação carismática, cordial, respeitosa, objetiva e segura com o titular dos papéis de **Desenvolvedor, Administrador e Gestor**; reconhecimento de suas responsabilidades sem bajulação, exageros ou formalismo excessivo. Dar prioridade a panorama executivo, decisões práticas, alertas relevantes e limitações claras.

Seções em produção:

1. **Panorama executivo:** saudação e contexto do dia.
2. **Disponibilidade e saúde técnica:** amostras disponíveis do monitoramento HTTPS e erros HTTP 5xx, sem transformar amostragem em SLA.
3. **Clientes e assinaturas:** contas por situação, ciclos pagos/pendentes/vencidos e revisões financeiras.
4. **Consumo e infraestrutura:** Read Units, Realtime Read Units e Write Units observáveis, com ressalvas sobre parcialidade das métricas.
5. **Segurança e continuidade:** informações e limitações do resumo atual; sem inventar a última data de backup ou contagem de incidentes que não tenham sido consultadas.
6. **Rodapé institucional:** links do painel administrativo e Cloud Monitoring, e observação de confidencialidade.

Não enviar PII de clientes, documentos ou dados bancários; não detalhar informações por UG. **Ciclos registrados como pagos não equivalem necessariamente a receita contabilmente confirmada.** Quando uma fonte não responder, registrar `indisponível`, nunca substituir silenciosamente por zero.

## 4. Arquitetura e segurança

### 4.1 Gmail, OAuth e segredos

O fluxo de envios aos fornecedores existente em `lib/googleWorkspaceMail.ts` permanece independente e inalterado. O boletim usa `lib/server/adminDigestGmail.ts`, com autorização offline e verificação da identidade real do Gmail antes de enviar, sem credenciais privadas no repositório.

Cliente OAuth **Desktop** criado especificamente para o boletim; conta remetente validada com `gmail.send` e `userinfo.email`. A tela de consentimento Google foi verificada como **Em produção**, evitando a regra de expiração de sete dias imposta ao estado de testes em determinadas condições. Isso não impede revogação, expiração por inatividade ou outras causas previstas pelo Google.

Segredos mantidos no Google Secret Manager:
- `emprovex-admin-digest-gmail-client-secret`
- `emprovex-admin-digest-gmail-refresh-token`

O acesso `roles/secretmanager.secretAccessor` foi concedido à identidade `emprovex-run-runtime` **somente para esses dois segredos**. Nunca gravar tokens, JSON OAuth, client secret ou refresh token em Git, logs, e-mails ou mensagens.

Variáveis de runtime confirmadas pelo deploy: `EMPROVEX_ADMIN_DIGEST_ENABLED=1`, `EMPROVEX_ADMIN_DIGEST_GMAIL_FROM`, `EMPROVEX_ADMIN_DIGEST_TO`, `EMPROVEX_ADMIN_DIGEST_GMAIL_CLIENT_ID`, `EMPROVEX_ADMIN_DIGEST_GMAIL_CLIENT_SECRET` (Secret Manager), `EMPROVEX_ADMIN_DIGEST_GMAIL_REFRESH_TOKEN` (Secret Manager), `EMPROVEX_ADMIN_DIGEST_SCHEDULER_EMAIL` e `EMPROVEX_ADMIN_DIGEST_OIDC_AUDIENCE`. Não usar `EMPROVEX_ADMIN_DIGEST_RESEND_API_KEY`.

### 4.2 Endpoint, IAM e prevenção de duplicidade

`app/api/cron/admin-digest/route.ts` rejeita solicitações sem um token OIDC Google válido (`401`), com validação de issuer, audience, identidade de serviço e e-mail verificado. O job executa com a conta `emprovex-run-runtime`, que também aparece como remetente da identidade OIDC no contrato da rota; não presumir que uma conta separada `emprovex-digest-trigger` tenha sido criada.

`lib/server/adminDailyDigest.ts` produz métricas agregadas por meio das fontes operacionais existentes, grava o controle no Firestore e chama o adaptador Gmail. Há marcadores diários em `platformAdminDigestRuns/{YYYY-MM-DD}`. O teste usa o marcador isolado `platformAdminDigestRuns/test-{YYYY-MM-DD}`.

A estratégia conservadora de idempotência é:
- se `sent`, responder `already_sent`;
- se `pending`, **não reenviar automaticamente**, pois o Gmail pode ter aceito o e-mail antes da confirmação;
- se não houver registro, criar `pending`, enviar e marcar `sent`.

Uma execução com `pending` requer revisão manual da pasta Enviados e dos logs, sem apagar o marcador às cegas. O Gmail não oferece idempotency key nativa no `messages.send`.

### 4.3 Automação e manutenção

Arquivos relevantes:
- `lib/adminDailyDigest.mjs` e `lib/adminDigestEmail.mjs`: conteúdo agregado e apresentação HTML;
- `lib/server/adminDigestGmail.ts` e `lib/server/adminDailyDigest.ts`: transporte autenticado e agregação;
- `app/api/cron/admin-digest/route.ts`: endpoint;
- `scripts/admin-daily-digest.test.mjs` e `.github/workflows/admin-digest-r1.yml`: testes;
- `ops/admin-digest/activate.sh` e `ops/admin-digest/activation-request.json`: trilha de ativação;
- `.github/workflows/emprovex-cloud-run-promote.yml`: workflow WIF homologado, usado na ativação.

As permissões administrativas temporárias necessárias à criação e à execução do teste foram retiradas após o sucesso. Para futuras **alterações no job**, conceder somente a autorização necessária pelo período estritamente necessário e retirar depois. A conta de serviço gerenciada do Cloud Scheduler continua autorizada a executar o job existente.

**Não repetir a ativação ou o disparo de teste sem motivo.** Alterações futuras devem verificar o estado real do job, as regras de deduplicação e o tráfego Cloud Run antes de agir. Preservar os demais jobs, alertas, backups e o fluxo de fornecedores.

## 5. Critérios de encerramento e observações

| Critério | Resultado em 01/11/2026 |
| --- | --- |
| Núcleo, interface executiva e testes específicos integrados à `main` | **Concluído** |
| Gmail OAuth autorizado, estado publicado e segredos protegidos | **Concluído** |
| Envio automatizado de teste pelo Cloud Run + Scheduler | **PASS / registrado em Enviados** |
| Revisão em produção e health verificado | **PASS / 100% de tráfego** |
| Job de 18h criado com estado `ENABLED` | **PASS** |
| Privilégio temporário `cloudscheduler.admin` revogado | **Confirmado pelo comando do administrador** |
| Recebimento na caixa externa e primeira execução regular às 18h | **A observar; não bloqueiam o encerramento do desenvolvimento** |

**Decisão de encerramento:** o Desenvolvedor, Administrador e Gestor considerou a implantação **um sucesso** e autorizou o fechamento dos trabalhos deste chat. Não há nova mudança funcional pendente neste escopo. Acompanhamentos de entrega/rotina, se necessários, devem ser tratados como operação normal do EMPROVEX, não como reabertura automática deste desenvolvimento.

**Referências principais:** PRs [#445](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/445), [#449](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/449), [#452](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/452) e [execução final de ativação #41271765423](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/runs/41271765423).
