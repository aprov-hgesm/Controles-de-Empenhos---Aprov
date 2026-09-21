# BLOCO 16.4 — MÉTRICAS GLOBAIS REAIS VIA GOOGLE CLOUD MONITORING

## Objetivo

Concluir a separação de observabilidade iniciada no Bloco 16.0:

- **por UG/workspace:** estimativa interna do EMPROVEX (`emprovex-workspace-estimate`);
- **global do projeto Firebase:** métricas oficiais do Google Cloud Monitoring (`google-cloud-monitoring`).

O Bloco 16.4 não substitui a telemetria do 16.3 e não tenta transformar a soma das UGs em
consumo oficial.

## Fonte e métricas

A integração consulta a API v3 do Cloud Monitoring, sempre no servidor, para o banco Firestore
nomeado configurado em `firebase-applet-config.json`.

Métricas operacionais:

- `firestore.googleapis.com/document/read_ops_count`;
- `firestore.googleapis.com/document/write_ops_count`;
- `firestore.googleapis.com/document/delete_ops_count`;
- `firestore.googleapis.com/network/active_connections`;
- `firestore.googleapis.com/network/snapshot_listeners`.

Métricas de faturamento da edição Enterprise:

- `firestore.googleapis.com/api/billable_read_units`;
- `firestore.googleapis.com/api/billable_realtime_read_units`;
- `firestore.googleapis.com/api/billable_write_units`.

As métricas DELTA são somadas desde o início do dia de cobrança em
`America/Los_Angeles`, alinhando a janela administrativa ao reset diário do free tier.
Conexões e listeners permanecem gauges da amostra mais recente.

As métricas do Firestore são amostradas periodicamente pelo Google e podem levar alguns minutos
para aparecer no Cloud Monitoring.

## Segurança

Nenhuma credencial Google é enviada ao navegador.

A rota `GET /api/admin/firebase-global-usage` exige um Firebase ID token válido no header
`Authorization: Bearer ...`. O token é validado server-side contra as chaves públicas oficiais
do Firebase, com issuer e audience do projeto. Depois da validação, a rota exige o e-mail
verificado da identidade fundadora.

Setores externos não recebem acesso à rota global.

## Credencial Google Cloud

A consulta usa uma service account de **somente leitura**, idealmente com apenas
`roles/monitoring.viewer`.

A fonte preferencial é a credencial server-only já existente
`FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON`, evitando uma segunda chave privada no ambiente.
As credenciais dedicadas permanecem aceitas como fallback:

- `EMPROVEX_GCP_MONITORING_CLIENT_EMAIL`;
- `EMPROVEX_GCP_MONITORING_PRIVATE_KEY`.

Nenhuma dessas variáveis possui prefixo `NEXT_PUBLIC_` ou é exposta ao bundle cliente.

A chave privada pode ser armazenada com quebras de linha reais ou com `\n`; o runtime normaliza
o valor antes de assinar o JWT OAuth.

## Autenticação da service account

O servidor cria uma assertion JWT RS256 com escopo
`https://www.googleapis.com/auth/monitoring.read` e troca essa assertion no endpoint OAuth do
Google por um access token de curta duração. O token fica apenas em memória do runtime e é
reutilizado enquanto válido.

A service account não precisa possuir permissão de leitura/escrita no Firestore, Google Drive,
Firebase Auth ou qualquer workspace do EMPROVEX.

## Painel administrativo

A conta fundadora recebe uma seção separada chamada **Consumo global real do Firebase**.

O painel mostra Read Units, Realtime Read Units e Write Units faturáveis na janela diária do
Firestore, além das contagens operacionais de documentos, conexões ativas, snapshot listeners,
banco consultado e momento da última amostra disponível.

O indicador principal é `billableReadUnits`. Para o banco Enterprise atual elegível ao free tier,
o default administrativo é 50.000 Read Units/dia. Também existem defaults de 50.000 Realtime
Read Units/dia e 40.000 Write Units/dia. Os três valores podem ser alterados server-side por:

- `EMPROVEX_FIRESTORE_DAILY_READ_UNIT_FREE_LIMIT`;
- `EMPROVEX_FIRESTORE_DAILY_REALTIME_READ_UNIT_FREE_LIMIT`;
- `EMPROVEX_FIRESTORE_DAILY_WRITE_UNIT_FREE_LIMIT`.

A elegibilidade pode ser explicitada por `EMPROVEX_FIRESTORE_FREE_TIER_ELIGIBLE`.

A consulta é pontual. Não existe polling automático nem listener realtime do Cloud Monitoring.
Há apenas uma leitura inicial ao abrir o painel e atualização manual.

## Separação da cobrança

Os números vêm de métricas reais de faturamento do Firestore Enterprise. O EMPROVEX usa a franquia
diária de Read Units como referência principal para indicar a aproximação do ponto em que unidades
adicionais ficam sujeitas a cobrança. Isso não transforma o painel em fatura final: preços por região,
armazenamento, rede, créditos, operações administrativas e demais componentes de billing continuam
sendo conciliados no Google Cloud Billing.

## Preservado

O Bloco 16.4 não altera limite de 2 sessões simultâneas por workspace/UG, isenção de sessões da
conta fundadora, lease de 10 minutos, heartbeat de 5 minutos, encerramento remoto, auditoria
imutável, Firestore Rules operacionais, telemetria estimada por UG, autenticação híbrida, Google
Drive por workspace, concorrência de empenhos ou armazenamento documental.

Vercel Blob e Firebase Storage continuam fora do armazenamento documental.

Nenhum deploy Vercel faz parte deste bloco.

## Critério de aceite

1. a branch parte exatamente do fechamento do 16.3;
2. Cloud Monitoring é consultado somente server-side;
3. a rota valida Firebase ID token e restringe a conta fundadora;
4. nenhuma credencial usa `NEXT_PUBLIC_`;
5. o banco nomeado correto é filtrado via `resource.labels.database_id`;
6. métricas globais e estimativas por UG permanecem separadas;
7. ausência de credencial produz estado não configurado sem quebrar o painel;
8. existe guard permanente do Bloco 16.4 na Application CI;
9. build e TypeScript permanecem verdes;
10. não há deploy Vercel.
