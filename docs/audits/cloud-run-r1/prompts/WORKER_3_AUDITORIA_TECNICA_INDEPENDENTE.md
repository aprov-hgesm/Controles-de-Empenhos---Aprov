# WORKER 3 — CLOUD-RUN-R1
## AUDITORIA TÉCNICA INDEPENDENTE DE CÓDIGO E COMPATIBILIDADE — SEM ALTERAR O PRODUTO

**Programa:** EMPROVEX / CLOUD-RUN-R1  
**Função:** auditor independente de aplicação, segurança e runtime, subordinado ao Coordenador Geral.  
**Migração:** NÃO AUTORIZADA — NO-GO.  
**Repositório:** https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov  
**Baseline documental de referência (não integrado à main):** PR #316, branch `audit/cloud-run-r1-full-compatibility`, HEAD `1a2551ac09ef1f155b27002a18119940fecb63f9`.  
**Memorial oficial:** `docs/EMPROVEX_MEMORIAL_OFICIAL.md`.

## 1. MISSÃO

Realizar uma **segunda auditoria técnica realmente independente**, de profundidade suficiente para descobrir riscos ou dependências que a auditoria focal do Worker 1 possa ter deixado de fora. Não assuma que o inventário Git de 893 arquivos significa revisão completa do código. Estabeleça cobertura mensurável; analise código efetivo, fluxos de chamada e impactos de execução do Next.js em múltiplas instâncias Cloud Run, preservando contratos do EMPROVEX.

Seu produto será **mapa verificável de mudanças necessárias, riscos novos, especificações e testes futuros**, não código de migração nem ambiente em execução.

## 2. AUTORIDADE E RESTRIÇÕES

**Pode:** ler repositório/histórico/PRs, clonar em ambiente isolado quando disponível, buscas AST/textuais e testes estáticos ou locais sem credenciais e sem escrita externa, consultar fontes oficiais atualizadas, criar docs na própria branch e abrir PR DRAFT.

**Não pode:** alterar funcionalidades, scripts operacionais, `package*.json`, `Dockerfile`, workflows ativos, Firestore/Rules/dados, Firebase Admin, DNS, IAM, Vercel, Cloud Run, cron ou secrets; nem executar deploy, provisionar recursos pagos, usar credenciais reais em testes ou fazer merge. Não executar suites que tenham side effects externos. **Preview/produção são somente observação read-only; não executar operação de estoque.**

Nunca copiar segredos/PII para relatórios. Se não puder rodar comandos localmente, descreva exatamente o que não foi verificado; NÃO inventar PASS. Evitar duplicar o trabalho documental do Worker 1.

## 3. ESTABELECER BASELINE E COBERTURA REAL

1. Verifique HEAD vivo da `main`, PR #316, diferenças desde `main@2b1241fe3abd96c67766caf065d24a4b2a223b98` e PRs recentes que alterem runtime, warehouse, admins, autenticação ou deploy.
2. Leia os 12 relatórios **na branch de PR #316**; marque conclusões reproduzidas, contraditas ou não verificáveis.
3. Extraia inventário sistemático de APIs, `lib/server`, `lib/warehouse`, tarefas agendadas, código client, `next.config`, `vercel.json`, workflows e variáveis de ambiente.
4. Faça análise de dependências, não somente busca pelo termo `vercel`. Busque chamadas `process.env`, `fetch`, `Authorization`, `getFirestore`, REST Firestore, segredos, filesystem, URLs absolutas, proxies, timers, in-memory state e lógica de build.
5. Documente **total de arquivos**, **arquivos realmente inspecionados**, métodos utilizados, percentuais/limites de cobertura e lacunas. Classifique arquivos por risco e não force leitura sem sentido de arquivos estáticos.
6. Diferencie código em `main` do que está apenas em PRs.

## 4. INVESTIGAÇÃO TÉCNICA PRIORITÁRIA — BLOQUEADORES

### R01 — ADC, tokens Google e identidade de execução
Rastreie o fluxo desde entrada HTTP até cada token e serviço chamado em:
- `lib/server/sectorProvisioningAdmin.ts`;
- `app/api/central-depositos/intake-action/route.ts`;
- `lib/server/firebaseAuthBackup.ts`;
- `lib/server/googleCloudMonitoring.ts`;
- `lib/server/globalUsageHistory.ts`;
- demais módulos server-side encontrados na varredura.

Identifique: tipo de token (OAuth access vs Firebase ID vs JWT de serviço), público/audience, scopes, expiração, cache, testes de revogação/403, falhas determinísticas quando `FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON` falta. Especifique migração para **Cloud Run service identity + ADC** e como preservar autorização de usuários/workspaces. Diferencie token de invocação Cloud Run (OIDC) de token necessário ao Firestore REST/Identity Toolkit. Proponha interfaces/arquivos/testes necessários, **sem codificar**.

### R02 — Dois bancos Firestore nomeados e IAM
Rastreie todos os pontos de criação de client, `getFirestore`, REST API e IDs de banco, principalmente principal definido em `firebase-applet-config.json` e `emprovex-warehouse`. Identifique fallback perigoso para `(default)`, configurações emulator, identidade server-side, Rules e limites do Admin SDK. Especifique matriz operação→banco→identidade→autorização→prova de negação cross-tenant, validando mudanças futuras com o Worker 2 sem assumir roles existentes.

### R03 — Persistência e recuperação
Rastreie backup lógico x backup nativo, PITR/retention (estado real externo depende do Worker 2), restores, checkpoints, reconciliações, saldos/lotes/ledger, idempotência e auditabilidade. Diferencie rollback de código de recuperação de dados. Defina testes de restauração isolada com fixture sintética, RPO/RTO e critérios de integridade — **sem restaurar dados reais**.

### R04 — Homologação estritamente separada
Identifique todas as variáveis `NEXT_PUBLIC_*` embutidas no build, seleção de Firebase app/projeto/banco, fallback, testes e caminhos de escrita com privilégios elevados. Proponha mecanismo fail-closed (sem produzir patch) e prova negativa de impossibilidade de escrita entre teste e produção; sem credenciais reais.

## 5. SUPERFÍCIES ADICIONAIS OBRIGATÓRIAS

- **F05/F06/F09:** rotas Mobile e Warehouse; alocação, transferências, saída/consumo, idempotência, concorrência com mesma e diferentes chaves, commits atômicos, replay, crash e retentativa em múltiplas instâncias; criar matriz de testes de Emulator e fluxo completo.
- **Next.js:** Next 15 standalone, Node/runtime, Server Actions, Server Components, SSR, static/assets/`.next`, imagens, middleware, headers, `Permissions-Policy` câmera, redirects `/adm-deposito` e `/central-mobile`, cookies, URLs absolutas, streaming e storage efêmero.
- **Concorrência/cache:** módulos `memoryReadCache` e request rate-limit com buckets em memória; comportamento sob escalonamento/rolling deploy, TTL, invalidation, consistência e custo de leituras Firestore.
- **IP e proxy:** dependência `x-vercel-forwarded-for`, cadeia de cabeçalhos confiáveis, spoofing e rate-limit por múltiplas instâncias. Modelo de confiança para Firebase Hosting e alternativas sem criar bypass.
- **Cron:** rota `/api/cron/usage-snapshot`, Bearer `CRON_SECRET`, autenticação Scheduler OIDC vs assinatura Bearer, fuso **09:15 UTC**, idempotência diária, retries e execução exclusiva na passagem.
- **OAuth e Drive:** Google founder e usuários externos, Firebase Auth, links `__/auth/handler`, Drive OAuth/scopes, tokens no browser, cookies, domínio, callbacks e restrições de origem.
- **Timeout/Host:** limite **60 s** do rewrite Firebase Hosting → Cloud Run; classifique rotas de PDF, importação, backup, operações admin e transferências por duração potencial e necessidade de medição. Alternativa de borda deve vir com custo e trade-off, sem presunção.
- **CI/CD e build:** `next.config.ts` ignora erros TS/ESLint em build; verifique gates reais (Application CI, Core Protection, Recovery Guardrails, Emulator, E2E sob demanda), deploy manual Vercel D-127, branch protection, GitHub WIF/OIDC, imagens reproduzíveis e scans.
- **Observabilidade/custo:** `/api/health` é liveness superficial; definir monitoramento de serviços, alertas, falha sem mascaramento e prova de impacto de reads/latência. Não assumir custo zero, nem configurar serviços.
- **Cobertura funcional:** Gestão de Empenhos, NF, relatórios, SAG/NS, documentos/PDF, SaaS multi-workspace/VIP, Central de Depósitos, Operador Móvel, scanner, orbes/loaders e rotas históricas.

## 6. PARA CADA ACHADO

Produza matriz com: ID; arquivos e linhas/funcões; fluxo de entrada; dependência atual; comportamento requerido no Cloud Run; evidência; consequência funcional; severidade; ação futura; teste obrigatório; owner; estado (`COMPROVADO / HIPÓTESE / NÃO VERIFICÁVEL`).

Se houver contradição com Worker 1, use identificador `DISCREPANCY-##`, cite evidências e recomende a reconciliação pelo Coordenador. Nenhum novo risco pode sumir só porque não constava da matriz de 18 riscos.

## 7. SAÍDAS OBRIGATÓRIAS

Criar **somente documentação**, na própria branch, sob `docs/audits/cloud-run-r1/worker-3/`:

1. `01_COBERTURA_E_INVENTARIO_VERIFICAVEL.md` — método, contagens reais, arquivos examinados e gaps.
2. `02_FLUXOS_ADMIN_ADC_FIRESTORE_IAM.md` — rotas, scopes/tokens, projetos e banco, desenho de adaptação.
3. `03_WAREHOUSE_RECOVERY_IDEMPOTENCIA.md` — F05/F06/F09, ledger/saldos e plano de testes.
4. `04_RUNTIME_NEXTJS_PROXY_CACHE_CRON.md` — compatibilidade e diferenças de execução.
5. `05_SEGREGACAO_AMBIENTES_OAUTH_DRIVE.md` — build-time env, Auth e isolamento.
6. `06_MATRIZ_DE_RISCOS_DISCREPANCIAS_GATES.md` — risco novo, revisão da matriz R01–R18 e gates G01–G16.
7. `07_PLANO_TECNICO_DE_ADAPTACAO_SEM_CODIGO.md` — ordem de mudanças futuras, dependências e testes de aceite.
8. `08_HANDOFF_COORDENADOR.md` — fechamento e próximos responsáveis.

Não alterar documentos do Worker 1 nem do Worker 2; a consolidação e o memorial pertencem ao Coordenador.

## 8. GIT / ENTREGA

- Branch própria a partir do HEAD vivo de `main`; sugestão `audit/cloud-run-r1-w3-independent-technical` (se livre).
- Ler os relatórios do PR #316 pela ref específica; **não** fazer merge do PR para obtê-los.
- Abrir PR **DRAFT** apenas documental; sem merge, testes com side effects, provisionamentos ou deploy.
- O PR documental não comprova execução de Application CI (workflows podem ignorar `docs/**`).

## 9. ACEITE E HANDOFF

O objetivo é reduzir incerteza tecnicamente, não fabricar sinal verde. Classificar **AUDITORIA TÉCNICA CONCLUÍDA COM LACUNAS** quando não houver meios de verificação dinâmica; liberar implementação só após decisão futura de coordenação. Nenhum risco R01–R04 será marcado resolvido apenas por proposta de código.

Handoff no formato **ONDE ESTAMOS / O QUE ESTAMOS FAZENDO / QUEM ESTÁ FAZENDO / O QUE FAZER A SEGUIR / QUEM O FARÁ**, com PR, branch, HEAD, quantidades de arquivos efetivamente examinados, achados inéditos, discrepancies, blockers/gates e plano de ação.

**INICIE A AUDITORIA TÉCNICA INDEPENDENTE. NÃO IMPLEMENTE A MIGRAÇÃO.**
