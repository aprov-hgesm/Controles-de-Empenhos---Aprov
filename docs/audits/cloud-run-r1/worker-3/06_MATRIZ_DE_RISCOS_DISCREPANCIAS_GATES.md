# W3 — Matriz de riscos, discrepâncias e gates
Data 2026-10-15. Estado **NO-GO**. Revisão independente da matriz de 18 riscos do W1 (PR #316); nenhum classificado resolvido. Estados: **COMPROVADO** = comportamento do código; **HIPÓTESE** = consequência futura não medida; **NÃO VERIFICÁVEL** = exige IAM/console/runtime.

## Revisão R01–R18 do Worker 1
| Risco | Evidência W3 / reclassificação | Estado de resolução | Gate / owner |
|---|---|---|---|
| R01 BLOCKER ADC | sectorProvisioningAdmin.ts:120–217, intake-action:1164–1175 e authBackup.ts:65–134 dependem de JSON; ocorrência COMPROVADA | PENDENTE | G05 Backend/Auth |
| R02 BLOCKER bancos/IAM | firebase.ts:43–51, firebase.json:2–10, sectorLifecycleAdmin.ts:112–125; IAM NÃO VERIFICÁVEL | PENDENTE | G04/G05 Security/W2 |
| R03 BLOCKER recovery | runbook SAAS:40–72 sem warehouse lógico; restore nativo externo NÃO VERIFICÁVEL | PENDENTE | G07 Recovery |
| R04 BLOCKER homologação | firebase.ts:7–58 tem flags de build e banco default somente E2E; isolamento externo NÃO VERIFICÁVEL | PENDENTE | G08 Security/Infra |
| R05 CRÍTICO cron | vercel.json:3–7, cron route:12–45 Bearer; duplo agendamento hipotético | PENDENTE | G12 Backend/Infra |
| R06 CRÍTICO OAuth/domínio | googleDriveWorkspace.ts:12,187–277, firebase.ts:22–40; console não lido | PENDENTE | G03 Auth/QA |
| R07 ALTO proxy/burst | requestSecurity.ts:68–87,104–148 cabeçalhos e buckets; COMPROVADO | PENDENTE | G09/G15 Security |
| R08 ALTO 60s | Firebase Hosting doc oficial limita 60s; duração de rotas NÃO MEDIDA | PENDENTE | G02/G10 Infra |
| R09 ALTO cache | memoryReadCache.ts:1–124 Map/TTL; uso no servidor NÃO DEMONSTRADO; ver DISCREPANCY-01 | PENDENTE | G10 Performance |
| R10 ALTO build | next.config.ts:33–38 e application-ci.yml:47–59 build ignora erros e CI usa budget; COMPROVADO | PENDENTE | G14 CI |
| R11 ALTO DNS | DNS/TLS externo NÃO VERIFICÁVEL | PENDENTE | G13 Admin DNS |
| R12 MÉDIO custos | Cloud Run/Firestore/billing não medidos; NÃO VERIFICÁVEL | PENDENTE | G11 FinOps |
| R13 MÉDIO WIF/CI | workflows atuais inspecionados; pipeline Cloud Run não demonstrado | PENDENTE | G14 Infra/CI |
| R14 MÉDIO cold start | standalone estático, container não executado; HIPÓTESE | PENDENTE | G02/G10 Infra |
| R15 MÉDIO health | health/route.ts:1–20 devolve status/timestamp sem dependências; COMPROVADO | PENDENTE | G15 Ops |
| R16 MÉDIO scanner/redirects | next.config.ts:7–32 preserva configuração; borda nova NÃO TESTADA | PENDENTE | G09 QA |
| R17 INFORMATIVO deploy | vercel.json:9–11 desabilita auto-deploy Git no repositório; painel não consultado | PENDENTE | G01/G16 Coord. |
| R18 ALTO governança | consulta branches/main retornou protected:false em 2026-10-15; rulesets não inspecionados | PENDENTE | G14 Coord./Admin GitHub |

## Riscos inéditos W3 (cada um com fluxo, consequência, prova e dono)
| ID/severidade | Evidência e fluxo | Consequência / ação futura | Teste obrigatório / owner / estado |
|---|---|---|---|
| W3-R19 ALTO | GET status/route.ts:23–25 → warehouseAccess.ts:174–202 → sectorProvisioningAdmin.ts:486–518,393–408 (Identity Toolkit accounts:update) | Probe GET pode alterar claims de usuário externo; segregar GET de mutação em eventual redesign | Teste com fixture de claims ausentes e assert side effects; QA/Auth; **COMPROVADO comportamento**, incidente não verificado |
| W3-R20 ALTO | withdrawalRepository.ts:1029–1083 processa linha a linha: outbound→consumption→progress | Falha intermediária gera estado parcial intencional, requer reconciliação e retry correto, não rollback trivial | fault-injection após cada commit, 3 linhas; Warehouse/Recovery; **COMPROVADO desenho**, corrupção HIPÓTESE |
| W3-R21 MÉDIO | intakeActionClient.ts:35–77 só usa fallback no erro FAST_PATH_LEGACY | 503 do serviço/credencial bloqueia alocação; não propor bypass ao legado por conta própria | simulação 503, 409, LEGACY e permissões; Warehouse/QA; **COMPROVADO** |
| W3-R22 ALTO | globalUsageHistory.ts:188–225 retorna false sem token; cron/route.ts:36–45 retorna ok:true mesmo persisted:false | Monitorar sucesso HTTP pode mascarar perda de histórico diário | credencial ausente, 403, repetição do dia e assertions persistência; Ops/Backend; **COMPROVADO** |
| W3-R23 MÉDIO | billing/regularization/route.ts:34–36,61–64,103–115 cache servidor 5 min e s-maxage=300 stale-while-revalidate=600 | Informações públicas de cobrança podem divergir ou permanecer antigas durante troca de instâncias/CDN | invalidation, duas instâncias, cache header e staleness; Billing/QA; **COMPROVADO desenho**, impacto HIPÓTESE |
| W3-R24 ALTO condicional | locationRepository.ts:1117–1127 planeja lotes fora de runTransaction iniciado em :1175 | Corrida entre plano e commit demanda prova de revalidação; **não afirmar bug sem reproduzir** | concorrência com mudança do lote durante plano, same/different key; Warehouse/QA; **HIPÓTESE** |

## Discrepâncias/ajustes de precisão face a W1
- **DISCREPANCY-01:** R09 W1 agrupou memoryReadCache como risco entre instâncias Cloud Run; o arquivo sozinho não prova sua execução em servidor. Confirmar importador/bundle antes de classificar impacto de réplicas. Cache servidor **comprovado** existe na rota billing.
- **DISCREPANCY-02:** R05 W1 menciona risco de duplicação cron. globalUsageHistory.ts:194–225 usa documento determinístico por dia via PATCH; portanto **duplicidade de documentos por retry simples não é demonstrada**, mas dupla execução, custos e overwrite seguem como risco.
- **DISCREPANCY-03:** W1 descreve F05/F09 como dependência de token Admin corretamente, mas é essencial distinguir o F09 de consumo imediato (commit conjunto) da retirada multi-linha (saga sequencial): W3-R20. Não imputar atomicidade total ao segundo fluxo.
Encaminhar reconciliação ao Coordenador; não alterar conclusões do Worker 1 diretamente.

## Gates G01–G16 (nenhum PASS por esta auditoria)
| Gate | Prova mandatória | Responsável | Estado |
|---|---|---|---|
| G01 | SHA main/release e diffs de PRs | Coord. | PENDENTE |
| G02 | build container/digest/SSR/assets/Node 20 startup | Infra | PENDENTE |
| G03 | Auth Google/password, OAuth Drive, App Check, domínio | Auth/QA | PENDENTE |
| G04 | testes cross-tenant 403 cliente/admin | Security | PENDENTE |
| G05 | ADC/IAM mínimo dois bancos + Auth backup | Backend/W2 | PENDENTE |
| G06 | F05/F06/F09 concorrência, idempotência, reconciliação | Warehouse/QA | PENDENTE |
| G07 | PITR/backup READY/restore isolado e RPO/RTO | Recovery | PENDENTE |
| G08 | projeto homog isolado e negação de prod | Security/Infra | PENDENTE |
| G09 | E2E mobile/scanner/câmera/redirects/visuais | QA | PENDENTE |
| G10 | p95, multi-instância, cache, limites 60s/reads | Perf | PENDENTE |
| G11 | custos medidos por região/traffic/Firestore | FinOps | PENDENTE |
| G12 | cron único, auth Scheduler, persisted e retry | Infra/Backend | PENDENTE |
| G13 | DNS/HTTPS/TLS/OAuth/cutover e rollback | Admin DNS | PENDENTE |
| G14 | Application CI/Core/Recovery/Emulator/E2E, WIF e aprovação | CI/Security | PENDENTE |
| G15 | observabilidade, alertas, probes sem escrita | Ops | PENDENTE |
| G16 | aceite formal, nenhum blocker/crítico, rollback demonstrado | Coord./Fundador | PENDENTE |
**Nunca usar existência de PR documental ou build verde como comprovação de gates.**