# SAAS R1 — Health, Uptime e Monitoramento

Última revisão de sintaxe dos comandos Google Cloud: **2026-10-01**.

## 1. Health público

Endpoint:

`https://emprovex.com.br/api/health`

Contrato:

- GET público;
- HTTP 200 quando o runtime está respondendo;
- JSON pequeno com `status=ok` e timestamp;
- `Cache-Control: no-store`;
- nenhuma leitura Firestore;
- nenhum dado operacional;
- nenhum secret/env;
- nenhuma versão/commit.

Esse endpoint mede disponibilidade HTTP da aplicação, não saúde profunda do Firestore.

## 2. Uptime check — configuração externa

O projeto já usa Google Cloud Monitoring. A R1 não adiciona fornecedor de uptime.

Comando atual documentado pelo Google Cloud CLI:

```bash
gcloud monitoring uptime create "EMPROVEX HTTPS" \
  --project=gen-lang-client-0982077967 \
  --resource-type=uptime-url \
  --resource-labels=host=emprovex.com.br,project_id=gen-lang-client-0982077967 \
  --protocol=https \
  --path=/api/health \
  --port=443 \
  --request-method=get \
  --validate-ssl=true \
  --status-classes=2xx \
  --matcher-content='"status":"ok"' \
  --matcher-type=contains-string \
  --period=5 \
  --timeout=10
```

O padrão sem `--regions` usa os checkers disponíveis globalmente e evita configuração regional desnecessária.

Este comando **não foi executado por esta branch**.

## 3. Alerta simples

Depois de criar o uptime check:

1. Google Cloud Console → Monitoring → Uptime checks;
2. localizar **EMPROVEX HTTPS**;
3. **Add alert policy**;
4. condição baseada na falha do uptime check;
5. usar duração curta e não instantânea (ex.: 2 minutos) para reduzir ruído;
6. associar um canal de notificação controlado pelo fundador;
7. salvar e usar o botão de teste do uptime check.

O Google recomenda associar alerting policy e notification channel ao uptime check. A criação do canal exige configuração externa da conta e não é feita no repositório.

## 4. SSL

O check usa HTTPS e `--validate-ssl=true`.

O Cloud Monitoring também expõe métrica de tempo restante do certificado; a R1 pode adicionar alerta de expiração futuramente se necessário, sem criar outro fornecedor.

## 5. Monitoramento já existente

Reusar:

- Cloud Monitoring real do Firestore;
- telemetria por workspace/UG;
- alertas de quota;
- histórico diário;
- Vercel;
- GitHub Actions.

Não criar listener Firestore novo para uptime.

### Limitação conhecida

O painel interno de métricas globais existente filtra o database operacional configurado em `firebase-applet-config.json`. O database `emprovex-warehouse` deve ter custo/uso acompanhado também pelo Console/Billing do Google Cloud enquanto não houver uma agregação multi-database explicitamente certificada.

Isso é preferível na R1 a criar uma terceira telemetria paralela.

## 6. Fontes oficiais verificadas em 2026-10-01

- Cloud Monitoring — public uptime checks: https://cloud.google.com/monitoring/uptime-checks
- gcloud monitoring uptime create: https://cloud.google.com/sdk/gcloud/reference/monitoring/uptime/create
