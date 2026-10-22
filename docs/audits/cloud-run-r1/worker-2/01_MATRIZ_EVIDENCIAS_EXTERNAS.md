# CLOUD-RUN-R1 / W2 — Matriz de evidências externas X01–X16

**Data da consulta:** 2026-10-15. **Natureza:** auditoria administrativa read-only. **Decisão:** NO-GO — migração não autorizada.

## Fronteira de prova

- Baseline confirmada: main@2b1241fe3abd96c67766caf065d24a4b2a223b98. PR #316 (Worker 1) DRAFT, head 1a2551ac09ef1f155b27002a18119940fecb63f9, base main; seus 12 documentos foram consultados por ref do PR, não como arquivos da main.
- GitHub: integração com leitura e escrita, mas **sem admin**. GET branches/main retornou protected:false; GET /rulesets retornou []; leitura detalhada de branches/main/protection retornou 403 (Resource not accessible by integration). Esses três resultados não verificam environments, regras globais do titular ou aprovações.
- Vercel: a integração disponível listou uma equipe **diferente da proprietária do EMPROVEX**, sem projeto correspondente. Consultas read-only ao escopo aprov-hgesms-projects para projeto/listagem retornaram **403 Forbidden**. Nenhuma variável de ambiente foi consultada; nenhum valor secreto foi lido.
- Google Cloud/Firebase, billing, DNS administrativo e OAuth administrativo: **sem conexão autorizada disponível nesta execução**. Fonte estática no repositório NÃO valida o estado de consoles.
- Docs oficiais consultados como referência de procedimento, não evidência de configuração: Cloud Run service identity; Firestore backups; Firebase Hosting↔Cloud Run (timeout 60s); Google Cloud WIF.

**Legenda:** VERIFICADO = requisito integral atestado por prova adequada; INCONCLUSIVO = prova real parcial, mas falta confirmação determinante; BLOQUEADO POR ACESSO = nenhuma comprovação administrativa suficiente. Fonte REPO = arquivo GitHub; GH = API GitHub; VERCEL = API read-only da conexão ativa; ADMIN = painel autorizado ainda pendente.

## Matriz operacional

| ID | Estado 15/10 | Evidência obtida e limites | Riscos / gates | Titular da prova e próxima ação |
|---|---|---|---|---|
| X01 GCP/Firebase e bancos | **BLOQUEADO POR ACESSO** | REPO firebase.json comprova referência a **dois bancos nomeados** (Core e emprovex-warehouse); projeto real, regiões, billing, estado e quotas dos bancos não consultados. | R02/R04, G05/G08/G11 | Admin GCP/Firebase: listar projetos/bancos/regiões e confirmar destino Core; não usar (default). |
| X02 IAM e identidades | **BLOQUEADO POR ACESSO** | Sem policy IAM, principals, contas de serviço, grants por escopo ou permissões de Monitoring/Auth. Arquitetura ADC é **proposta**, não configurada. | R01/R02/R04, G04/G05/G08/G14 | Admin GCP: relatório sanitizado dos principals e roles efetivos, incluindo projeto/banco/Identity Toolkit/Monitoring. |
| X03 Segredos Vercel | **BLOQUEADO POR ACESSO** | API Vercel do escopo proprietário retorna 403. REPO menciona FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON, CRON_SECRET, Monitoring, NEXT_PUBLIC_*; existência e targets **não comprovados**. Nenhum valor lido. | R01/R04/R05/R06, G03/G05/G08/G12 | Admin Vercel: apenas nomes, alvos Production/Preview/Development e marcação presença/ausência; jamais valores. |
| X04 Vercel projetos/deploy | **BLOQUEADO POR ACESSO** | 403 no projeto proprietário. REPO vercel.json tem git.deploymentEnabled:false e cron 15 9 * * *; isso **não comprova** estado do painel, hooks, proteção, alias ou produção. | R05/R11/R17, G12/G13/G15 | Admin Vercel: titularidade, deployment protection, URLs/aliases, cron ativo e gatilhos externos, sem alterações. |
| X05 Backups | **BLOQUEADO POR ACESSO** | REPO runbook SAAS_R1_OPERACAO_RECUPERACAO afirma que backup lógico **não cobre warehouse** e que backup nativo dos dois bancos requer verificação externa. Sem READY, agendas, retenção, RPO/RTO efetivos nem restauração observada. | R03, G07 | Admin GCP + Recovery: inspeção somente leitura por banco; restore isolado somente em fase futura autorizada. |
| X06 OAuth/Firebase/Drive | **BLOQUEADO POR ACESSO** | Código indica Firebase Auth e OAuth Drive separados; domínios autorizados, redirects, clientes e scopes reais não auditados. | R06/R04, G03/G08/G09/G13 | Admin Firebase/OAuth: inventário sanitizado de domínios e URIs por ambiente, sem client secrets. |
| X07 App Check/reCAPTCHA | **BLOQUEADO POR ACESSO** | Nenhum painel de providers, chaves públicas ativas, restrições host ou enforcement inspecionado. | R06/R04, G03/G08/G09 | Admin Firebase: providers, domínios, enforcement por aplicação/ambiente; sem chaves privadas. |
| X08 DNS/TLS | **BLOQUEADO POR ACESSO** | Domínio canônico emprovex.com.br conhecido pelo memorial, mas zona DNS, TTL, CAA, HSTS, certificados, www e titularidade não consultados no provedor. | R11/R06, G03/G09/G13 | Admin domínio: export sanitizado da zona e certificado/rollback; não modificar registros. |
| X09 Telemetria Vercel | **BLOQUEADO POR ACESSO** | API da equipe proprietária 403; sem contagens agregadas de 30/60/90 dias, p50/p95/p99, erros, banda ou cold starts. | R08/R09/R14, G10/G15 | Admin Vercel/Ops: relatórios agregados sem IPs, contas ou URLs privadas. |
| X10 Billing/custos/quota | **BLOQUEADO POR ACESSO** | Sem billing console e SKU/região. Tabelas do Worker 1 são **cenários hipotéticos**, não custo efetivo. | R12/R02, G11 | Titular billing: últimos 30/60/90 dias por serviço/SKU/região, budget/alerts e quotas existentes. |
| X11 Governança GitHub | **INCONCLUSIVO** | GH branches/main: protected:false; GET /rulesets: []; GET /branches/main/protection:403; nenhuma leitura comprovada de ambientes protegidos e reviewers. | R18/R13, G01/G14/G16 | Proprietário aprov-hgesm: capturas sanitizadas de Rulesets, Branch protection, Environments, approvals e workflow permissions. |
| X12 Cron/integradores externos | **BLOQUEADO POR ACESSO** | REPO prova um cron Vercel 09:15 (config). Não exclui outros schedulers, deploy hooks, webhooks/callbacks e jobs fora da árvore Git. | R05/R06, G12/G13 | Admin Vercel/GCP/Drive: inventariar cron, Scheduler, webhooks e callbacks sem dispará-los. |
| X13 Rede/proxy/WAF | **BLOQUEADO POR ACESSO** | Código usa x-vercel-forwarded-for e limiter local; cabeçalhos **observados**, WAF e trust boundary da borda não consultados. | R07, G04/G09/G15 | Ops/Security: configuração de borda e amostras agregadas/sanitizadas, sem testar escrita. |
| X14 Durações reais | **BLOQUEADO POR ACESSO** | Sem logs/timings reais de PDF, importação, backup ou APIs admin; 60 s é limite documentado do Firebase Hosting com rewrite, **não prova timeout atual**. | R08/R14, G10/G13 | Ops/QA: agregados p95/p99/max por operação e tamanho, sem disparar jobs. |
| X15 Rollback administrativo | **BLOQUEADO POR ACESSO** | Plano documental W1 existe; titularidade efetiva DNS/Vercel, TLS, alias e cron reversível não comprovados; nenhuma simulação executada. | R11/R05/R03, G07/G12/G13/G16 | Titular domínio + Coordenador: demonstrar poderes de reversão e ensaio isolado futuro. |
| X16 Deriva de branches/PRs | **INCONCLUSIVO** | GH confirmou PRs #286 (intake), #289 (Firebase/isolamento), #287 (diagnóstico), #309 (docs), #310 (script), #316 e #317 abertos/DRAFT, fora da main. PR #315 está merged e incorporado à baseline. Não há comparação integral de todas as branches/release alvo final. | R01/R04/R13/R18, G01/G08/G14 | Coordenador GitHub: reconciliar especificamente #286/#289 antes de desenhar ADC; repetir comparação no freeze. |

## Contagem e veredito

- **VERIFICADO: 0 / INCONCLUSIVO: 2 (X11, X16) / BLOQUEADO POR ACESSO: 14.**
- Há **observações diretas verificáveis** (config em main, GitHub API, 403 Vercel), mas **nenhum dos 16 requisitos externos foi integralmente certificado**.
- R01–R04 continuam BLOCKER; R05/R06 críticos, R11/R18 altos sem resolução administrativa. G01–G16 não foram liberados.
- **AUDITORIA ADMINISTRATIVA PARCIAL — ACESSOS EXTERNOS PENDENTES. MIGRAÇÃO NO-GO.** Nenhuma alteração em produção ou infraestrutura.

## Rastreabilidade e fontes

GitHub: https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/316 ; arquivos main firebase.json, vercel.json, docs/SAAS_R1_OPERACAO_RECUPERACAO.md; APIs /branches/main, /rulesets e /branches/main/protection (403). PR de coordenação: https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/317 . Documentação oficial: https://docs.cloud.google.com/run/docs/securing/service-identity ; https://firebase.google.com/docs/firestore/backups ; https://firebase.google.com/docs/hosting/cloud-run ; https://docs.cloud.google.com/iam/docs/workload-identity-federation-with-deployment-pipelines . Evidências de console proprietário, billing e DNS não foram anexadas por indisponibilidade de acesso.
