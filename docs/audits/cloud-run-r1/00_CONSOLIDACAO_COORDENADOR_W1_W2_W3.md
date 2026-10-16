# CLOUD-RUN-R1 — Consolidação do Coordenador (W1 + W2 + W3)
**Data:** 2026-10-15 · **Estado:** NO-GO — migração não autorizada.  
**Repositório:** `aprov-hgesm/Controles-de-Empenhos---Aprov`.  
**Baseline técnica dos workers:** `main@2b1241fe3abd96c67766caf065d24a4b2a223b98`.  
**Referências:** [W1 #316](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/316) · [Coordenação #317](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/317) · [W2 #318](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/318) · [W3 #319](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/319). Os quatro PRs estavam DRAFT e não integrados na verificação deste checkpoint.

## 1. Resultado consolidado e limites de evidência

| Indicador | Situação |
|---|---|
| W1 | 12 documentos; 18 riscos (R01–R18); 16 lacunas X01–X16; 16 gates G01–G16 |
| W2 | 6 documentos; **0/16 verificações externas integralmente certificadas**, 2 inconclusivas, 14 bloqueadas por acesso |
| W3 | 8 documentos; 65 de 893 arquivos da main examinados textualmente (7,28%, **não equivalente a cobertura funcional**); seis riscos novos W3-R19–R24 |
| Total inventariado | **24 riscos**: 4 BLOCKER, 2 CRÍTICOS, 10 ALTOS, 7 MÉDIOS, 1 INFORMATIVO |
| Portões de aprovação | **0/16 PASS**, R01–R04 ainda abertos |
| Limites | Sem builds/E2E/restore isolado nem leitura de consoles proprietárias; nenhuma alteração de aplicação/infra/produção |

Os 24 riscos são **riscos, condições e hipóteses documentadas**, e não 24 incidentes comprovados nem 24 falhas exclusivas da migração. Não converter inventário em certificação.

## 2. Reconciliação inicial das três discrepâncias W3 versus W1

### DISCREPANCY-01 — Cache Warehouse versus cache do servidor
**Decisão: QUALIFICADA, confirmação de importadores pendente.** `lib/warehouse/memoryReadCache.ts` implementa `Map` com TTL curto e coalescing. Só a existência do módulo não demonstra que é executado em uma instância de servidor Cloud Run; não atribuir-lhe inconsistência entre réplicas sem mapa de importadores e contexto de execução. **Distintamente**, `app/api/billing/regularization/route.ts` tem cache `cached` em módulo servidor (5 minutos) e resposta HTTP `public, s-maxage=300, stale-while-revalidate=600`; o risco W3-R23 deve ser avaliado em duas réplicas e CDN. **R09 não é resolvido**: requer prova de execução/efeito real.

### DISCREPANCY-02 — Cron, documento diário e semântica de sucesso
**Decisão: PARCIALMENTE ESCLARECIDA, risco continua.** `lib/server/globalUsageHistory.ts` usa `PATCH` em `platformUsageHistory/{dayKey}`, com chave determinística por dia. Retry não demonstra **duplicidade de documentos por uma simples execução repetida**, mas pode repetir consultas, escrita/sobrescrita e custo; o acionamento paralelo Vercel/Scheduler continua proibido. O próprio método retorna `false` quando falta access token, e `/api/cron/usage-snapshot` pode responder `ok:true, persisted:false`; o status HTTP por si não prova consolidação. **R05 CRÍTICO e W3-R22 ALTO permanecem pendentes**. Critério futuro: Scheduler autenticado, job único, persistência `true`, data esperada, telemetria de falha e replay controlado. Não disparar cron real nesta auditoria.

### DISCREPANCY-03 — Consumo F09 imediato e retirada multi-linha
**Decisão: DISTINÇÃO DE FLUXOS CONFIRMADA.** F09 consumo imediato no handler REST `app/api/central-depositos/intake-action/route.ts` possui conjunto de gravações no mesmo commit; **retirada multi-linha** em `lib/warehouse/withdrawalRepository.ts` percorre linhas executando `applyWarehouseExpressOutbound`, `recordStockConsumption` e `setWithdrawalProgress` sucessivamente. Uma interrupção pode deixar avanço parcial recuperável, mas não há garantia de atomicidade do lote inteiro. **R20 ALTO** exige fault-injection após cada passo, idempotência por linha, retry, reconciliação de movimento/consumo/ledger/saldo e prova de não duplicação. Não presumir erro produtivo já ocorrido.

## 3. Classificação operacional de W3-R19–R24

| Risco | Natureza demonstrada | Prioridade na preparação |
|---|---|---|
| W3-R19 ALTO | O GET `/api/central-depositos/status` pode acionar atualização de claims via verificação de usuário. **Não é smoke read-only seguro com usuário real por presunção**. | P0: impedir emprego indevido em auditorias e desenhar verificação sem mutação |
| W3-R20 ALTO | Saga/retirada multi-linha com commits sequenciais, comportamento existente; impacto de interrupção exige prova. | P0 de integridade nos testes Warehouse/Recovery |
| W3-R21 MÉDIO | 503 no fast-path não aciona fallback legado, por contrato existente. | P0 para migração ADC (R01); **não** forçar fallback/bypass |
| W3-R22 ALTO | Cron pode dizer `ok:true` sem persistência. | P1 operação/cron, manter exclusivo e instrumentar prova |
| W3-R23 MÉDIO | Cache de billing no servidor/HTTP pode ficar temporariamente desatualizado. | P1/P2 verificar segurança, invalidação e consistência |
| W3-R24 ALTO condicional | Plano F06 de lotes fora da transação requer teste de concorrência, **não demonstra bug**. | P0 em Emulator/homologação isolada antes de GO |

A prioridade de teste é vinculada ao risco da mudança, não autorização para alterar os comportamentos existentes.

## 4. Bloqueadores transversais e responsabilidade

| ID | O que falta comprovar | Titular da prova |
|---|---|---|
| R01 | Desenho + teste autorizado de identidade gerenciada/ADC sem JSON e permissões de Auth, Monitoring e fast-path | Backend/Auth + Admin GCP |
| R02 | IAM efetivo e isolamento dos **dois bancos Firestore nomeados** e permissões cross-tenant | Admin GCP/Firebase + Security |
| R03 | Backups reais READY e restore isolado demonstrado para Core + Warehouse, reconciliação logística e RPO/RTO | Admin Recovery + QA |
| R04 | Segregação fail-closed de homologação e produção, inclusive `NEXT_PUBLIC_*` no build; testes negativos sem produção | Infra + Security + Admin Firebase |

O bloqueio de acesso administrativo **não demonstra que a infraestrutura não pode migrar**. Demonstra que as condições de segurança e operação ainda não estão certificadas.

## 5. Solicitações mínimas às contas proprietárias — sem segredos

Referência operacional detalhada: `docs/audits/cloud-run-r1/worker-2/05_PENDENCIAS_PARA_FUNDADOR_E_COORDENADOR.md` no PR #318.
- **F1:** Google Cloud/Firebase: dois bancos e regiões, contas de serviço/IAM, estado READY/retenção de backup por banco.
- **F2:** Vercel: projeto/equipe correta; nomes e escopos de variáveis, cron, proteção/deploy hooks, domínio, último deploy e métricas agregadas.
- **F3:** Firebase Auth, Google OAuth/Drive e App Check: domínios e URIs autorizados, enforcement e origem de teste.
- **F4:** DNS/TLS e billing: controle de domínio, registros/TTL/rollback, custos e quotas agregadas.
- **F5:** GitHub: branch protection/rulesets, environments/reviewers e permissões de publicação.

**Jamais solicitar ou registrar valores de segredos, JSON de serviço, senhas, cookies ou tokens.** O conector Vercel não possui acesso ao escopo `aprov-hgesms-projects` (403); GitHub não fornece acesso administrativo para confirmação integral das proteções. Não confundir evidência de repositório com estado efetivo dos consoles.

## 6. Ordem recomendada — sem provisionamento nem deploy

1. Receber F1–F5 por canais autorizados, em imagens/relatórios sanitizados, classificando X01–X16 por evidência verificável. Dar prioridade a F1 (IAM, bancos, backup) e F2 (Vercel credenciais/cron), sem necessidade de acessar valores.
2. Reconciliar diffs de PRs #286 e #289 e outros PRs de Fast Path/Firebase com a `main` do dia do futuro freeze. Não presumir código DRAFT incorporado.
3. Detalhar opções de ADC e proteção de ambientes; planejar provas sintéticas de R01/R02/R04, sem escrever na produção.
4. Programar apenas **após autorização** as provas técnicas de recuperação, Warehouse/F05-F06-F09, concorrência, cache, cron e OAuth em projeto isolado.
5. Decidir infraestrutura candidata, domínio, região e custo com medições reais. O limite de 60s do rewrite Firebase Hosting → Cloud Run precisa de teste por rota longa.
6. Só considerar GO com **G01–G16 comprovados**, nenhum blocker/crítico aberto, rollback de aplicação e recuperação de dados verificados separadamente, e autorização explícita do Fundador.

## 7. Handoff padrão

**ONDE ESTAMOS:** Vercel atende produção; W1/W2/W3 documentados em PRs DRAFT; Cloud Run ainda NO-GO.  
**O QUE ESTAMOS FAZENDO:** reconciliação técnica inicial e aquisição futura de evidências administrativas; nenhum deploy autorizado.  
**QUEM ESTÁ FAZENDO:** Coordenador consolida; titulares dos serviços fornecem provas; QA/Infra/Backend executam etapas futuras somente após autorização.  
**O QUE FAZER A SEGUIR:** F1–F5, R01–R04 e G01; depois desenho técnico, homologação isolada e testes/rollback.  
**QUEM O FARÁ:** Administradores GCP/Firebase/Vercel/DNS/GitHub, Coordenador para gates, Fundador para autorizar infraestrutura e GO/NO-GO final.

**Regras:** Sem merge, alterações de produção, Firestore, OAuth, DNS, IAM, cron, deployment ou gastos por esta reconciliação documental.
