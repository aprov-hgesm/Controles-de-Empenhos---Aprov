# Bloco 17.6 — Telemetria fiel

O EMPROVEX mantém três camadas explicitamente distintas:

1. **Operações atribuídas pelo aplicativo** — chamadas que o próprio código consegue contabilizar.
2. **Estimativas por workspace/UG** — `emprovex-workspace-estimate`, útil para participação relativa e diagnóstico, mas incompleta.
3. **Métricas reais globais** — Google Cloud Monitoring do banco Firestore configurado.

A estimativa por UG nunca é apresentada como faturamento oficial. Security Rules, retries, reconnects e operações não instrumentadas podem produzir diferenças. O painel administrativo deve manter as fontes separadas.

O Bloco 17.6 não cria campos nem passos para o operador. A informação é administrativa e observacional.


## Reconciliação v2

A fidelidade passa a ser mensurável. O EMPROVEX compara document reads/writes globais com a atividade atribuída às UGs na mesma janela diária do Firestore.

A interface expõe cobertura e atividade não atribuída. Qualquer estimativa de Read/Write Units por UG é um proxy da parcela coberta, nunca uma divisão integral da métrica global nem faturamento oficial.
