# WORKER 2 — CLOUD-RUN-R1
## AUDITORIA ADMINISTRATIVA, INFRAESTRUTURA E EVIDÊNCIAS EXTERNAS — READ-ONLY

**Programa:** EMPROVEX / CLOUD-RUN-R1  
**Função:** auditor independente de administração de plataformas e infraestrutura, subordinado ao Coordenador Geral.  
**Situação da migração:** NÃO AUTORIZADA — NO-GO.  
**Repositório:** https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov  
**Auditoria de referência:** PR #316, branch `audit/cloud-run-r1-full-compatibility`, HEAD `1a2551ac09ef1f155b27002a18119940fecb63f9`.  
**Memorial oficial:** `docs/EMPROVEX_MEMORIAL_OFICIAL.md`.

## 1. MISSÃO E CRITÉRIO DE SUCESSO

Obter evidências administrativas **reais, verificáveis e sanitizadas** sobre todas as configurações externas que condicionam a migração Vercel → Google Cloud Run. Seu trabalho complementa o Worker 1, não repete a auditoria estática nem executa mudança. O objetivo é reduzir as lacunas X01–X16 do PR #316 e confirmar, refutar ou delimitar os bloqueadores R02, R03 e R04, além de fornecer evidências para R01/R05/R06/R11/R18.

**Não é possível declarar ausência de risco por falta de acesso.** Classifique cada ponto como VERIFICADO (com evidência), INCONCLUSIVO ou BLOQUEADO POR ACESSO. Não declare PASS da migração.

## 2. RESTRIÇÕES ABSOLUTAS

- **Somente leitura:** jamais executar deploy, configurar serviços, criar recursos faturáveis, editar billing/IAM/Rules/Firestore/Authentication/OAuth/DNS/Vercel/GitHub environments, disparar cron, migrar dados ou alterar produção.
- Não acessar valores de segredos. Examine apenas **nomes, presença, escopo e identidade de destino** de variáveis/segredos; nunca exporte chaves privadas, tokens, cookies, senhas ou JSON de serviço para chat/GitHub/log.
- Nunca fazer teste de recuperação sobre bancos reais, nem gerar tráfego que escreva dados. A restauração isolada é prova **futura**, após autorização e ambientes seguros.
- Não solicitar ao Fundador credenciais em texto aberto. Se a console/conta não estiver acessível por integração autorizada, liste o procedimento **somente leitura** para o titular executar e traga o estado como lacuna.
- Não publicar IDs sensíveis, informações pessoais ou configurações detalhadas que ampliem risco; usar mascaramento nas evidências do PR.
- Não alterar o PR #316, `main` nem trabalhos de outros workers; abrir **PR documental DRAFT separado**.
- Economizar operações: priorizar consultas agrupadas e reutilizar evidência válida, sem inspeções repetitivas desnecessárias.

## 3. BASELINE E FONTE DE VERDADE

1. Verifique HEAD atual da `main`, estado do PR #316, memorial e histórico de alterações de infraestrutura após a baseline `2b1241fe3abd...`.
2. Leia integralmente `docs/audits/cloud-run-r1/01` a `12` **na branch do PR #316**, pois ainda não fazem parte da `main`.
3. Confronte afirmações com consoles, APIs oficiais ou documentação recente. Registre ambiente, data/hora, origem da evidência, permissões de consulta, redigidos os segredos.
4. Distinguir **configurado**, **operante**, **testado**, **não verificado** e **proposto**.

## 4. INVESTIGAÇÃO ADMINISTRATIVA — X01–X16

Para cada item, colete descrição, comprovação, responsável por acesso, risco Rxx/Gxx relacionado e próxima decisão:

- **X01 — GCP/Firebase:** projetos reais, região, billing, quotas, localização dos **dois bancos nomeados**; confirmar banco principal pelo config atual, e Warehouse `emprovex-warehouse`. Proibir uso acidental do `(default)`.
- **X02 — IAM:** principals, service accounts e papéis existentes por projeto/serviço/banco. Identificar identidade runtime proposta, identidade de deploy, permissões Firestore/Admin/Identity Toolkit/Cloud Monitoring, privilégios excessivos e possibilidade de mínimo privilégio. Sem concessões.
- **X03 — Vercel secrets/env:** somente nomes, ambiente (production/preview/development) e variáveis exigidas por build/runtime; existência de `FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON`, `CRON_SECRET`, credenciais Monitoring e variáveis `NEXT_PUBLIC_*`. **Não revelar valores.**
- **X04 — Vercel:** titularidade/equipe, proteção de deployment, aliases, domínios, deploy hooks, gatilhos, regiões, cron ativo, estado da produção e previews; confirmar desligamento de deploy automático sem afetar o agendamento.
- **X05 — Backups:** existência, frequência, retenção, proteção contra exclusão, estado READY e escopo **dos dois bancos**; documentação de RPO/RTO, restore isolado anterior e integridade Warehouse (lotes/saldos/ledger). Não afirmar recuperação comprovada só porque backup está ativo.
- **X06 — OAuth:** Google/Firebase authorized domains, redirect URIs, authDomain, Google Drive OAuth client/scopes, origens temporárias e domínio canônico `emprovex.com.br`; registrar alterações exigidas, sem executá-las.
- **X07 — App Check/reCAPTCHA:** provedores, site keys públicas, políticas e restrições de host; não expor chaves privadas.
- **X08 — DNS/TLS:** provedor/conta, zona DNS (A/AAAA/CNAME/TXT/CAA), `www`, TTL, HSTS, certificados e histórico útil para cutover/rollback; exportação sanitizada.
- **X09 — Medidas Vercel:** últimos 30/60/90 dias se disponíveis: req, banda, duração p50/p95/p99, erros, rotas demoradas, disponibilidade, cold starts; apenas agregados.
- **X10 — Custos:** conta billing, custo por SKU/região, serviços já usados, free tier consumido, limites de cota, alertas, orçamento e custos de rede/Firestore/backup; nenhuma proposta de alteração financeira.
- **X11 — GitHub:** branch protection/rulesets da `main`, ambientes protegidos, controles de aprovação, permissões de publicação e gatilhos de workflows.
- **X12 — Integrações externas:** cron adicional, Cloud Scheduler já ativo, webhooks, callbacks, links Google Drive e riscos de jobs duplicados.
- **X13 — Rede/proxy:** forwarded headers reais e trust boundary da Vercel, filtragem, WAF/DDoS, logs e políticas que influem na origem IP.
- **X14 — Duração de operações:** logs agregados de PDF, importações, backup, fluxos admin e APIs; detectar risco do limite de **60 s** do rewrite Firebase Hosting → Cloud Run.
- **X15 — Rollback:** titularidade DNS e Vercel, capacidade de restaurar alias/TLS/cron/release anterior; registrar dependências, sem simular alteração real.
- **X16 — Deriva de código:** PRs/branches de infraestrutura e fast-path ainda abertos, HEADs novos e divergências da baseline.

**Prioridade P0:** X01–X08 e X11. Continue X09–X16 quando houver evidência disponível; não sacrificar P0 para gerar volume de relatório.

## 5. MATRIZ DE RESPONSABILIDADE E SEGREGAÇÃO

Desenhe proposta de IAM **sem conceder roles**: titular `aprov-hgesm`, colaboração administrativa `Moriark`, conta de runtime Cloud Run, conta de deploy CI/CD via Workload Identity Federation, quem pode ver billing/segredos, e quem aprova produção. Permissão no GitHub **não** implica permissão no Google Cloud. Diferencie `roles` a confirmar e recomendações de menor privilégio, sem inferir ACL vigente.

Mapeie risco de homologação chamar produção: projeto Firebase, bancos nomeados, IAM, build de `NEXT_PUBLIC_*`, OAuth, domínio e cron. Exija prova negativa futura de acesso entre ambientes antes de qualquer teste mutável.

## 6. SAÍDAS DOCUMENTAIS OBRIGATÓRIAS

Criar em sua própria branch, sob `docs/audits/cloud-run-r1/worker-2/`:

1. `01_MATRIZ_EVIDENCIAS_EXTERNAS.md` — X01–X16 com estado, fonte, data, riscos e gates.
2. `02_IAM_BANCOS_IDENTIDADES_SEGREGACAO.md` — dois bancos, principals, privilégios e exigências de isolamento.
3. `03_VERCEL_OAUTH_DNS_CRON_E_BACKUPS.md` — panorama de administração, continuidade e restauração.
4. `04_CUSTOS_METRICAS_E_OPERACAO.md` — medições reais x hipóteses, lacunas de acesso.
5. `05_PENDENCIAS_PARA_FUNDADOR_E_COORDENADOR.md` — poucas ações exatas para titular das contas, sem pedir segredos.
6. `06_HANDOFF_COORDENADOR.md` — status e decisões.

Para cada achado usar ID estável, vínculo Rxx/Xxx/Gxx, evidência ou indicação SEM ACESSO, risco e próximo responsável. Registro documental **não** é autorização de mudança.

## 7. CONTROLE DE GIT E ENTREGA

- Basear branch nova e isolada na `main` atual; sugestão: `audit/cloud-run-r1-w2-administrative-evidence`. Verificar colisão antes de criar.
- Consultar PR #316 por ref específica e não incluir arquivos do PR #316 como se já estivessem na `main`.
- Alterar **somente** os seis documentos da sua área; abrir PR próprio em **DRAFT**, sem merge.
- Não atualizar o memorial canônico em paralelo; sugerir adendo ao Coordenador, que fará reconciliação.
- Não há obrigação de inventar execução de testes ou acesso às consoles.

## 8. ACEITE E HANDOFF

A auditoria de sua frente estará concluída quando cada X01–X16 possuir estado, evidência ou bloqueio identificável e ação com responsável. Se faltarem acessos, classificação: **AUDITORIA ADMINISTRATIVA PARCIAL — ACESSOS EXTERNOS PENDENTES**.

Entregar:
**ONDE ESTAMOS / O QUE ESTAMOS FAZENDO / QUEM ESTÁ FAZENDO / O QUE FAZER A SEGUIR / QUEM O FARÁ**, com branch, HEAD, PR DRAFT, quantidade de X verificados/inconclusivos/bloqueados, riscos confirmados/novos, resultados e solicitações ao Fundador.

**INICIE A AUDITORIA ADMINISTRATIVA SOMENTE LEITURA. NÃO EXECUTE MIGRAÇÃO.**
