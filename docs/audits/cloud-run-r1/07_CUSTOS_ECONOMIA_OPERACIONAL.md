# Custos, franquias e economia operacional
Consulta de documentação oficial em 2026-10-15. **Nenhuma cotação final pode ser fechada sem métricas de tráfego, tamanhos de imagem, região, uso de rede/Firestore e política de logging.** A ausência de gastos medidos não equivale a serviço gratuito.

## Serviços e custos a mensurar
| Camada | Franquia/fator de custo | Decisão |
|---|---|---|
| Cloud Run por requisição | Franquia divulgada: 2 milhões requests, 180 mil vCPU-s e 360 mil GiB-s/mês, baseada em preços us-central1. Outros preços e requisitos variam. | Preferir min-instances=0 inicialmente se SLA permitir; medir cold start |
| Artifact Registry | 0,5 GiB-mês gratuitos por conta de faturamento; imagens egress/armazenamento acima disso geram custo | Retenção de tags/digests de releases e limpeza segura |
| Cloud Scheduler | 3 jobs gratuitos por conta de faturamento; extra US$0,10/job/mês (31 dias) | Uma tarefa diária; verificar outros jobs da conta |
| Secret Manager | Até 6 versões ativas e 10 mil acessos/mês gratuitos por conta de faturamento | Evitar chaves long-lived quando ADC for suficiente |
| Firebase Hosting | Quota/egress/storage; pode ser cobrado por tráfego/revisões | Medir frente a LB; atenção limite 60 s rewrite |
| Cloud Logging/Monitoring | Armazenamento, retenção, métricas, alertas e reads | Controles de verbosidade; nenhum token em log |
| Networking/DNS/LB | Egress internet, inter-region, load balancer se adotado | Avaliar região dos dois Firestores e base de usuários |
| Cloud Build/GitHub Actions | Minutos de build/artefatos/caches e ações GitHub | Um build validado/release consolidada; não multiplicar deploy |
| Firestore/Auth/Drive | Cobrança própria independente de hospedagem | Monitorar reads/writes, índices, backup nativo, APIs |

## Simulação de demanda — hipóteses, NÃO tráfego medido
| Cenário | Requests/mês | CPU ativa média/requisição | RAM configurada | Estimativa bruta vCPU-s/requests | RAM GiB-s |
|---|---:|---:|---:|---:|---:|
| Baixo (hipotético) | 50.000 | 0,3 s com 1 vCPU | 512 MiB | 15.000 vCPU-s / 50k req | 7.500 |
| Moderado (hipotético) | 500.000 | 0,4 s com 1 vCPU | 512 MiB | 200.000 vCPU-s / 500k req | 100.000 |
| Expansão (hipotético) | 3.000.000 | 0,5 s com 1 vCPU | 1 GiB | 1.500.000 vCPU-s / 3m req | 1.500.000 |

A tabela é puramente aritmética (concurrency, idle, cobrança, requisições negadas, CPU throttling e faturamento por instância podem mudar a cobrança efetiva); **não usar como previsão**. O cenário moderado já excederia o indicador de CPU gratuito, mesmo com requests abaixo de 2 milhões. Se a média de tempo aumentar (SSR, cold start, integração Drive/Firestore), despesas podem subir. Faturamento por instância altera a lógica.

## Controle de gasto
Orçamento comum de alerta **não bloqueia** faturamento. Documentação atual também descreve spend-cap budgets aplicáveis somente a serviços elegíveis e com possibilidade de pausa; verificar elegibilidade do Cloud Run e limites antes de depender desse controle, pois pausar serviço compromete continuidade. Estabelecer alertas 50/80/100% com revisão humana, máximo de instâncias, logs com retenção restrita, política de imagem e orçamento separado por projeto. Monitorar custo por região, tráfego e cache. Não provisionar nenhum recurso apenas para medir.

## Levantamento PENDENTE
Faturas 30/60/90 dias; requests/latência na Vercel; Cloud Firestore daily reads/writes; distribuição de usuários; região dos Firestores; imagens/container estimadas; bitrate/download/upload de PDF; Cloud Scheduler jobs ativos; Logging retention; billing account; capacidade de projeto/quotas.

Fontes oficiais:
https://cloud.google.com/run/pricing
https://cloud.google.com/artifact-registry/pricing
https://cloud.google.com/scheduler/pricing
https://cloud.google.com/secret-manager/pricing
https://docs.cloud.google.com/billing/docs/how-to/budgets
https://docs.cloud.google.com/billing/docs/how-to/budgets-spend-caps
