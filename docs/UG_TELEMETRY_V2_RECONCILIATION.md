# Telemetria por UG v2 e Reconciliação

## Objetivo

A Telemetria por UG v2 melhora a leitura administrativa do consumo sem alterar o fluxo operacional dos usuários.
Ela mantém duas fontes independentes:

1. **Google Cloud Monitoring** — consumo global real do banco Firestore.
2. **EMPROVEX workspace estimate** — atividade instrumentada e atribuída internamente a cada workspace/UG.

A reconciliação não cria uma terceira fonte de verdade. Ela compara as duas fontes para responder:

- quanto da atividade documental real foi atribuída a UGs;
- quanto permanece não atribuído;
- qual é a participação relativa de cada UG na parcela instrumentada;
- qual seria um proxy proporcional de Read/Write Units para a parcela coberta.

## Janela temporal única

A telemetria por UG e o Cloud Monitoring usam a mesma fronteira diária:

`America/Los_Angeles`

Esse é o fuso da referência diária de faturamento/cota utilizada pelo Firestore Enterprise.
O documento diário de cada UG continua em:

`workspaces/{workspaceId}/usageEstimates/{YYYY-MM-DD}`

mas o `YYYY-MM-DD` passa a representar o **dia de faturamento do Firestore**, não o dia UTC.

O histórico administrativo usa a mesma convenção.

## Cobertura

Para leituras:

`cobertura = reads atribuídos às UGs / document reads observados pelo Google`

A interface mostra separadamente:

- documentos lidos observados pelo Google;
- reads atribuídos pelo EMPROVEX;
- reads não atribuídos;
- percentual de cobertura;
- eventual excesso de atribuição, tratado como divergência e nunca redistribuído.

O mesmo diagnóstico existe para writes.

Cobertura abaixo de 100% é esperada enquanto existirem operações não instrumentadas, retries,
reconexões, custos administrativos ou outras chamadas que não possuam contexto de workspace.

## Proxy de unidades por UG

Read Units não equivalem a document reads. O Firestore Enterprise pode consumir múltiplas unidades
para uma única operação dependendo de tamanho, índices e processamento da consulta.

Por isso, o EMPROVEX não divide todas as Read Units globais entre as UGs.

Primeiro é calculada a fração de reads documentais efetivamente atribuída. Somente a parcela
proporcional das Read Units correspondente a essa cobertura fica disponível para alocação estimada.

Exemplo:

- Google: 1.000 document reads;
- EMPROVEX: 600 reads atribuídos;
- cobertura: 60%;
- Google: 10.000 Read Units;
- Read Units atribuíveis por proxy: aproximadamente 6.000;
- Read Units não atribuídas: aproximadamente 4.000.

As 6.000 unidades atribuíveis são divididas entre as UGs de acordo com a participação delas nos
600 reads instrumentados.

A parcela não atribuída **nunca é redistribuída artificialmente**.

## Interpretação

O campo **Read Units proxy**:

- é estimativa administrativa;
- ajuda a comparar peso relativo, custo potencial e comportamento entre UGs;
- não é faturamento oficial;
- não substitui Google Cloud Billing;
- não deve ser usado isoladamente para cobrança contratual.

O mesmo princípio vale para Write Units proxy.

Realtime Units não são rateadas por UG nesta versão porque `realtimeSnapshots` do EMPROVEX
não é uma unidade equivalente à métrica faturável do Google.

## Complexidade e custo

A v2 não cria listeners administrativos e não faz polling.

A telemetria continua usando buffer local e consolidação de baixa frequência.
A reconciliação é calculada em memória a partir de dados que o painel já carrega.

Não há:

- novo banco;
- projeto Firebase por UG;
- collection-group;
- listener global;
- gravação por leitura;
- bloqueio operacional;
- dependência de billing para login.

## Qualidade

A interface deixa explícitos:

- cobertura de reads;
- cobertura de writes;
- janela do dia de faturamento;
- registros fora da janela;
- atividade não atribuída;
- proxy por UG;
- separação entre estimativa e consumo oficial.

Isso permite aumentar gradualmente a instrumentação sem esconder lacunas de observabilidade.
