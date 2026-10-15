# Plano de migração e rollback — somente planejamento
Objetivo: troca controlada de hospedagem sem alterar banco, negócios, Auth, estoque ou domínio até evidências completas. Ainda não há aprovação para executar passos.

## Fases e responsáveis
| Fase | Executor proposto | Resultado e condição de avanço |
|---|---|---|
| 0 — Diagnóstico externo | Administrador Google Cloud, Vercel, Firebase, domínio + Worker de leitura | IAM, OAuth, DNS, billing, métricas e backups certificados em registro sanitizado |
| 1 — Desenho/decisão | Coordenador e Fundador | Escolha Hosting/LB, região, custo, RPO/RTO e plano de contingência documentados |
| 2 — Adaptação isolada | Worker técnico com PR separado | ADC/chaves, forwarded IP, cron auth, cache/timeout preservando contratos |
| 3 — Container não produtivo | Worker de Infra + administrador | Build reprodutível com Node, variáveis ambiente teste, image digest, Cloud Run e banco isolado |
| 4 — CI/CD e gates | Worker CI + Coordenador | WIF mínimo, workflow manual, quality + recovery, sem deploy automático em produção |
| 5 — Homologação integral | QA/Foundador + workers funcionais | Matriz 03 toda testada incluindo F05/F06/F09 e scanner real, sem escrita em prod |
| 6 — Pré-cutover | Coordenador/administrador domínio | Backup/snapshot recentes e restauráveis, switch reversível, freeze de mudanças, double-run cron impedido |
| 7 — Cutover aprovado | Administrador domínio/Cloud | TLS/DNS/canonical URL, monitorar métricas e alterações de OAuth, manter Vercel disponível |
| 8 — Observação e decisão | Fundador/Coordenador | Validar disponibilidade/custo e integridade; só então planejar desligamento Vercel |

## Ordem do cutover, após aprovação
1. Fazer checklist de saúde e backups, fixar SHA da imagem e config em uso, guardar zona DNS/alias anterior e dados de OAuth.
2. Congelar releases Vercel e mudanças de banco incompatíveis; não executar migração de dados.
3. Confirmar novo ambiente sem DNS de produção em hostname temporário, com Auth/Drive testados; validar SSL/rotas e logs; garantir preview não usa dados reais.
4. Garantir cron do novo ambiente **desabilitado** até passagem controlada. Na janela de ativação, registrar último snapshot, desativar Vercel cron por mecanismo aprovado e habilitar Cloud Scheduler apenas uma vez.
5. Mudar borda/registro DNS para novo serviço somente após ambiente estável; acompanhar DNS TTL/propagação e autenticação.
6. Validar smoke humano e funcional para workloads de leitura, seguido de operações controladas do fundador previamente autorizadas e observadas, sem duplicidade de dados.
7. Acompanhar erros e custo, comparar Firestore ledger/saldos, conservar infraestrutura anterior preparada para reversão.

## Rollback — gatilhos objetivos
Interromper/voltar à Vercel se ocorrer: 401/403 persistentes em login, indisponibilidade relevante, aumento anormal de erros/custos, CRON duplicado, falha F05/F06/F09, inconsistência de saldo/movimento, 504 por 60s, URLs/câmera quebradas. Não há tolerância para violação de isolamento workspace.

Reversão de aplicação: (A) redirecionar borda/DNS ou alias ao Vercel anteriormente congelado, restabelecer cron **exclusivo** da origem antiga e desativar o novo; (B) no Cloud Run, revision rollback para digest anterior caso o problema seja apenas revision. **Nenhuma dessas ações desfaz transações escritas no Firestore.** Se tiver ocorrido escrita inconsistente, conter operações, preservar logs, reconciliação read-only e recovery administrado em procedimento separado. O DNS pode demorar pela propagação; ter decisão predefinida e ponto de teste externo.

## Condições adicionais
Nunca deletar Vercel durante estabilização; reter configurações, variáveis protegidas e logs conforme política; não copiar secrets para GitHub. Nenhum cutover/rollback foi testado nesta auditoria. Objetivos internos do runbook atual: RPO até 24h e RTO até 4h, que **não representam SLA demonstrado** (docs/SAAS_R1_OPERACAO_RECUPERACAO.md).
