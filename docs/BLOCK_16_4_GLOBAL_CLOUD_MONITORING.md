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

Métricas:

- `firestore.googleapis.com/document/read_ops_count`;
- `firestore.googleapis.com/document/write_ops_count`;
- `firestore.googleapis.com/document/delete_ops_count`;
- `firestore.googleapis.com/network/active_connections`;
- `firestore.googleapis.com/network/snapshot_listeners`.

Reads, writes e deletes são somados desde 00:00 UTC do dia corrente. Conexões e listeners são
gauges e representam a amostra mais recente disponível.

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

Variáveis server-side:

- `EMPROVEX_GCP_MONITORING_CLIENT_EMAIL`;
- `EMPROVEX_GCP_MONITORING_PRIVATE_KEY`.

Elas não possuem prefixo `NEXT_PUBLIC_` e não podem ser expostas ao bundle cliente.

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

O painel mostra reads, writes e deletes do dia UTC, conexões ativas, snapshot listeners, banco
Firestore consultado e momento da última amostra disponível.

A consulta é pontual. Não existe polling automático nem listener realtime do Cloud Monitoring.
Há apenas uma leitura inicial ao abrir o painel e atualização manual.

## Separação da cobrança

Os números vêm de métricas reais do Firestore, mas o EMPROVEX não os apresenta como fatura final,
preço ou cobrança oficial do Google Cloud. Tarifação, franquias, créditos, arredondamentos e outros
componentes de billing permanecem fora deste bloco.

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
