# CLOUD-RUN-R1 / W2 — Custos, métricas e operação

**Estado:** X09/X10/X13/X14 sem medições de produção verificadas. R07/R08/R09/R12/R14; G10/G11/G15. Data da auditoria: 2026-10-15.

## Evidência observada x hipóteses

| Medida | Medição real disponível nesta frente? | Fonte/admin necessário | Uso na decisão |
|---|---|---|---|
| Vercel requests, largura de banda e execução 30/60/90d | **NÃO** — equipe proprietária retornou 403 | Vercel Analytics/Usage, métricas agregadas | Dimensionamento Cloud Run e Hosting |
| Duração p50/p95/p99/max de SSR, PDF, importações, backup, Admin API | **NÃO** | Vercel observability/logs agregados, sem PII | Avaliar Firebase Hosting rewrite (limite de 60s) |
| Erro 4xx/5xx, disponibilidade, região, cold start | **NÃO** | Vercel dashboards por ambiente, uptime | SLO e probes equivalentes |
| Firestore Core + Warehouse reads/writes/storage/bandwidth | **NÃO** | Firebase/GCP metrics e billing por banco/projeto | Custo e economia de reads |
| Cloud Run, Artifact Registry, Cloud Scheduler, Logging, Secret Manager, egress | **NÃO** | Billing report por SKU/região e APIs de quota existentes | Base para orçamento e limite operacional |
| DNS/proxy/WAF, origens de IP e saturação | **NÃO** | Admin Vercel/domínio/Ops e capturas de headers sanitizadas | R07, segurança de clientes e rate limiting |
| Gastos 30/60/90d, billing account e budgets/alerts | **NÃO** | Titular financeiro, sem exibir identificadores de conta | Evitar custo surpresa e dimensionar alerta |
| Retenção de logs e erros com segredos | **NÃO** | Configuração read-only Ops | Privacidade e resposta a incidentes |

## Conhecimentos estáticos relevantes

- W1 documentou três cenários **hipotéticos** de demanda (50 mil, 500 mil, 3 milhões requests/mês). Não reproduzir como números medidos do EMPROVEX; não há base real para economia percentual ou promessa de gratuito.
- O custo potencial envolve execução CPU/RAM/requisição Cloud Run, armazenamento/egress Artifact Registry, rede entre regiões, Firebase Hosting ou LB, scheduler, logging, segredos e **Firestore/backup**. Free Tier possui requisitos, regiões e limites; orçamento simples pode apenas **alertar**, não necessariamente travar gasto.
- A aplicação possui rate-limit e cache em memória por processo; comportamento em multi-instância e cold start ainda não medido. x-vercel-forwarded-for não pode ser assumido como fonte de IP confiável em Cloud Run.
- O limite de **60 segundos** do Firebase Hosting para rewrite em Cloud Run é documentado oficialmente; ainda **não se demonstrou** que alguma operação real atual ultrapassa esse tempo. Decidir borda somente após dados.

## Levantamento somente leitura, para responsável

1. Admin Vercel/Ops: export **agregado** de tráfego, banda, duração p50/p95/p99/max, taxa 4xx/5xx, regiões, rotas mais demoradas e cron, por Production e Preview, preferencialmente nas janelas 30/60/90 dias.
2. Admin GCP/Firebase: confirmar regiões Core/Warehouse, relatórios de uso e quotas por banco, volumes de leitura/escrita, custos de backup e políticas existentes, sem alterar recursos.
3. FinOps/titular billing: relatório por SKU/região/serviço no mesmo período, consumo de franquia, budgets/alerts já existentes, jobs Scheduler ativos, logging retention. Usar números agregados e mascarar identificadores pessoais/de conta.
4. Coordenador: construir *somente depois* cenário econômico conservador/central/pico baseado em dados, incluindo margem de cold start e egress; diferenciar custo Vercel atual de custo adicional Firebase/Firestore que permanece.
5. QA/Ops em fase autorizada: testar com tráfego sintético em ambiente isolado, medir p95/p99, startup, dois containers, comportamento de cache e limite 60 s; nenhum benchmark real foi rodado por W2.

## Critérios de aceite ainda pendentes

G10: comparativo por fluxo e métricas de cold starts/multi-instância com baseline validada. G11: projeção por SKU/região, budget e limites, com aprovação financeira. G15: telemetria sanitizada, alertas e roteiro de incidentes. Todos PENDENTES.

Documentação oficial: https://cloud.google.com/run/pricing ; https://firebase.google.com/docs/hosting/cloud-run ; https://docs.cloud.google.com/billing/docs/how-to/budgets . Linha de base de cenários W1: PR #316 / 07_CUSTOS_ECONOMIA_OPERACIONAL.md.
