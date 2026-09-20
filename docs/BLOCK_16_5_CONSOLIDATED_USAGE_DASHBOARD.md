# BLOCO 16.5 — PAINEL CONSOLIDADO DE CONSUMO

## Objetivo

Consolidar, em uma única visão administrativa, os dados já produzidos pelos Blocos 16.2, 16.3 e 16.4 sem criar uma terceira fonte de verdade e sem misturar métricas de naturezas diferentes.

O painel consolida apenas a apresentação:

- sessões ativas por workspace/UG;
- telemetria estimada por UG (`emprovex-workspace-estimate`);
- métricas globais reais do Firestore (`google-cloud-monitoring`).

Nenhuma nova coleção Firestore, API de escrita, listener administrativo ou permissão é criada.

## Fontes preservadas

### Global real

A fonte global continua sendo exclusivamente o Google Cloud Monitoring, carregado pela rota protegida do Bloco 16.4.

O painel exibe:

- reads reais;
- writes reais;
- deletes reais;
- conexões ativas;
- snapshot listeners;
- banco Firestore monitorado;
- horário da consulta e da última amostra disponível.

### Por UG estimado

A fonte por UG continua sendo exclusivamente a telemetria do Bloco 16.3.

O painel agrega apenas os documentos diários já carregados pelo fundador e mostra, por UG:

- reads estimados;
- writes estimados;
- deletes estimados;
- snapshots realtime;
- carga pico estimada de listeners;
- última consolidação;
- participação relativa da UG dentro da soma das próprias estimativas EMPROVEX.

A participação por UG nunca é apresentada como rateio da fatura global.

## Sessões

O painel reutiliza a coleção administrativa em memória do Bloco 16.2.

- setores externos continuam limitados a 2 sessões lógicas simultâneas;
- a conta fundadora continua ilimitada;
- nenhuma sessão nova é criada pelo painel;
- nenhum listener adicional de sessão é aberto;
- a validade do lease continua sendo calculada com o mesmo contrato já existente.

## Consolidação sem custo adicional relevante

O Bloco 16.5 não executa leituras próprias.

Ele recebe como propriedades React os estados que já foram carregados por:

- `usePlatformAdminSessions`;
- `usePlatformAdminUsage`;
- `usePlatformAdminGlobalUsage`.

O botão **Atualizar painel** apenas dispara os mesmos refreshes pontuais já existentes para telemetria por UG e Cloud Monitoring.

## Referência de cobrança

A configuração atual do EMPROVEX usa o banco Firestore nomeado:

`ai-studio-logsticahospital-3eeee498-faa1-4326-8f4f-95d34b382ec1`.

Por isso o painel não presume automaticamente que a franquia diária de 50 mil reads, 20 mil writes e 20 mil deletes se aplique a este banco.

A documentação atual do Google informa que a cota gratuita do Firestore se aplica a apenas um banco elegível por projeto e que bancos nomeados adicionais não recebem automaticamente essa franquia.

Como a tarifa monetária também depende da localização/região e do modelo de cobrança, o Bloco 16.5 não inventa um valor em USD ou BRL. O painel identifica a base operacional observada e mantém a projeção financeira como referência não oficial até existir uma fonte explícita de tarifa/região.

Isso evita apresentar uma estimativa financeira aparentemente precisa com premissas não verificadas.

## UX

O novo painel é exibido antes das duas visões detalhadas existentes:

1. **Painel consolidado de consumo**;
2. **Consumo global real do Firebase**;
3. **Consumo estimado por UG**.

As visões dos Blocos 16.3 e 16.4 permanecem intactas como drill-down.

O painel consolidado usa rótulos permanentes para diferenciar:

- `google-cloud-monitoring` — global real;
- `emprovex-workspace-estimate` — atribuição interna estimada.

## Segurança e arquitetura preservadas

O Bloco 16.5 não altera:

- Firestore Rules;
- autenticação híbrida;
- identidade por UG;
- isolamento multi-tenant;
- limite de sessões;
- lease de 10 minutos;
- heartbeat de 5 minutos;
- revogação/encerramento remoto;
- auditoria imutável;
- concorrência otimista;
- Google Drive por workspace;
- armazenamento de PDFs/documentos;
- integração server-side do Cloud Monitoring.

Vercel Blob e Firebase Storage continuam fora do armazenamento documental.

## Critério de aceite

O Bloco 16.5 está concluído quando:

1. a branch parte exatamente do fechamento do 16.4;
2. existe uma visão consolidada das duas fontes sem fundi-las semanticamente;
3. sessões ativas são reutilizadas sem criar novo listener;
4. participação por UG usa apenas o universo das estimativas EMPROVEX;
5. banco nomeado não recebe franquia gratuita presumida;
6. nenhuma tarifa monetária é inventada sem região/preço configurados;
7. as telas detalhadas 16.3 e 16.4 permanecem disponíveis;
8. não há alteração em Firestore Rules;
9. o guard do Bloco 16.5 roda na Application CI;
10. build, TypeScript, testes multi-tenant, Browser E2E e release gate permanecem verdes;
11. nenhum deploy Vercel é realizado.
