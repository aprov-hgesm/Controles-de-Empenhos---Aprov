# Bloco 17.6 — Telemetria fiel

O EMPROVEX mantém três camadas explicitamente distintas:

1. **Operações atribuídas pelo aplicativo** — chamadas que o próprio código consegue contabilizar.
2. **Estimativas por workspace/UG** — `emprovex-workspace-estimate`, útil para participação relativa e diagnóstico, mas incompleta.
3. **Métricas reais globais** — Google Cloud Monitoring do banco Firestore configurado.

A estimativa por UG nunca é apresentada como faturamento oficial. Security Rules, retries, reconnects e operações não instrumentadas podem produzir diferenças. O painel administrativo deve manter as fontes separadas.

O Bloco 17.6 não cria campos nem passos para o operador. A informação é administrativa e observacional.
