# BLOCO 16.3 — TELEMETRIA ESTIMADA POR UG

## Objetivo

Adicionar ao EMPROVEX uma visão administrativa de atividade Firestore atribuída a cada
workspace/UG sem transformar a própria telemetria em uma nova fonte relevante de custo.

Este bloco mede **estimativas internas do EMPROVEX**. Ele não consulta faturamento,
cotas ou métricas oficiais do Google Cloud e não deve ser usado como substituto do
Cloud Monitoring.

## Separação obrigatória das fontes

A separação definida no Bloco 16.0 permanece intacta:

- `emprovex-workspace-estimate`: atribuição interna por workspace/UG;
- `google-cloud-monitoring`: consumo global real do projeto Firebase, a ser integrado
  em bloco posterior.

Nenhuma soma das estimativas por UG é apresentada como fatura oficial do Firebase.

## Persistência

Cada workspace mantém no máximo um documento consolidado por dia UTC:

```text
workspaces/{workspaceId}/usageEstimates/{YYYY-MM-DD}
```

O documento contém somente metadados de identidade da telemetria e contadores
agregados:

- reads estimados;
- writes estimados;
- deletes estimados;
- snapshots realtime;
- carga pico atribuída de listeners;
- quantidade de flushes de telemetria;
- último horário de consolidação.

A telemetria não armazena conteúdo operacional, documentos, PDFs, NFs, empenhos ou
dados do Google Drive.

## Estratégia de baixo custo

O runtime **não grava uma linha de telemetria a cada leitura**.

Cada aba do navegador mantém um buffer em `sessionStorage`. Os eventos Firestore são
somados localmente e a primeira consolidação só é agendada após 60 segundos. Depois da
primeira gravação, novos dados são consolidados no máximo uma vez a cada 15 minutos
por aba/workspace, salvo retry de falha.

A consolidação usa `increment()` e `serverTimestamp()` em um único `setDoc(...,
{ merge: true })`. Portanto não existe leitura prévia do próprio documento de
telemetria.

O write usado para consolidar a telemetria não é somado novamente ao consumo da UG;
isso evita realimentação infinita do contador.

## Fontes instrumentadas neste bloco

A estimativa passa a observar os pontos de maior impacto e maior confiança do runtime:

1. subscriptions operacionais view-aware do Bloco 14;
2. snapshots dessas subscriptions:
   - primeiro snapshot: número de documentos retornados;
   - snapshots posteriores: quantidade de `docChanges()`;
3. watchers de lifecycle de workspace e platformAccount;
4. listener de revogação de sessão;
5. aquisição/renovação/liberação do lease de sessão;
6. operações Firestore simples centralizadas em `firebaseSync.ts`;
7. transações de criação/edição de empenho com concorrência otimista.

Transações complexas podem sofrer retries internos do SDK e outros fluxos podem ter
leituras indiretas. Por isso os valores permanecem deliberadamente rotulados como
estimativa EMPROVEX.

## Listeners

`peakRealtimeListeners` não é uma métrica oficial de conexões simultâneas do
Firestore. Cada aba registra seu maior número local de listeners e somente o
**delta do pico daquela aba** é somado ao documento diário.

O painel chama essa métrica de **carga pico listeners** para deixar explícito que é
uma atribuição conservadora, não o pico global simultâneo observado pelo Google.

## Administração

A conta fundadora recebe o painel **Consumo estimado por UG**, logo após o painel de
sessões.

O painel:

- carrega o documento do dia por `getDoc` pontual;
- não cria `onSnapshot`;
- não usa `collectionGroup`;
- não mantém listener global de telemetria;
- só refaz as leituras quando o diretório muda ou quando o fundador usa **Atualizar
  estimativas**;
- mostra reads, writes, deletes, snapshots, carga pico de listeners, flushes e último
  reporte;
- exibe permanentemente o aviso de que o consumo global real será integrado via
  Cloud Monitoring.

A leitura administrativa do painel não é atribuída ao consumo de nenhuma UG.

## Segurança multi-tenant

As Firestore Rules exigem que o setor:

- esteja autenticado e autorizado no próprio workspace;
- grave exatamente o `workspaceId` da rota;
- grave a UG oficial do workspace;
- use `telemetryVersion = emprovex_usage_v1`;
- use `source = emprovex-workspace-estimate`;
- mantenha os contadores não negativos;
- nunca reduza contadores já consolidados;
- avance `telemetryFlushes` em updates;
- use `lastReportedAt == request.time`.

Setores operacionais não podem ler documentos de telemetria. Leitura e listagem são
reservadas à conta fundadora. Deletes são proibidos.

## Relação com sessões

O limite do Bloco 16.1 continua inalterado:

- setores externos: 2 sessões lógicas simultâneas por workspace/UG;
- conta fundadora: ilimitada;
- lease: 10 minutos;
- heartbeat: 5 minutos.

O Bloco 16.3 apenas atribui a atividade Firestore gerada por esses mecanismos. Ele não
altera slots, heartbeat, revogação, encerramento remoto ou auditoria.

## Google Drive e documentos

Nada muda no armazenamento documental. PDFs e documentos continuam no Google Drive
de cada setor/workspace. Este bloco não introduz Vercel Blob nem Firebase Storage.

## Critério de aceite

O Bloco 16.3 está concluído quando:

1. a `main` de partida é exatamente o fechamento do 16.2;
2. leituras realtime são estimadas no ponto central do Bloco 14;
3. leases e watchers de segurança são atribuídos à UG;
4. o buffer não faz write por leitura;
5. a consolidação é diária e de baixa frequência;
6. Rules impedem spoofing, cross-tenant, decremento e delete;
7. o painel fundador usa leituras pontuais e identifica a fonte como estimativa;
8. a fonte global real continua reservada para `google-cloud-monitoring`;
9. o guard 16.3 e os testes multi-tenant passam;
10. build, TypeScript, Browser E2E e release gate permanecem verdes.
