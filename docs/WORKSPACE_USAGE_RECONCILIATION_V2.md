# Telemetria por UG v2 — Reconciliação

## Objetivo

Tornar explícita a diferença entre consumo global real observado pelo Google Cloud Monitoring e a atividade que o EMPROVEX consegue atribuir a cada workspace/UG.

## Regra de interpretação

A reconciliação compara apenas grandezas compatíveis:

- `documentReads` global x `estimatedDocumentReads` atribuídos;
- `documentWrites` global x `estimatedDocumentWrites` atribuídos.

Read Units, Realtime Read Units e Write Units continuam sendo métricas faturáveis globais. Elas não são convertidas em consumo oficial por UG.

## Indicadores

A visão consolidada passa a mostrar:

- documentos lidos observados pelo Google;
- reads atribuídos às UGs;
- reads não atribuídos;
- cobertura percentual de reads;
- writes observados pelo Google;
- writes atribuídos;
- writes não atribuídos.

A cobertura é limitada visualmente a 100%, mas os contadores brutos permanecem visíveis. Isso permite detectar diferenças de janela, retries e sobrecontagem de instrumentação.

## Complexidade

A implementação reaproveita os documentos `usageEstimates` existentes e não cria listeners, coleções ou writes adicionais. A reconciliação é calculada em memória no painel administrativo.

## Limitações atuais

A telemetria por UG continua best-effort. A janela da telemetria por UG é UTC, enquanto a janela faturável global acompanha America/Los_Angeles. Por isso a cobertura é um indicador diagnóstico, não uma reconciliação contábil exata.

Uma futura alteração da chave diária deve incluir estratégia de migração e compatibilidade com histórico; ela não é feita implicitamente neste bloco.
