# HANDOFF — CLOUD-RUN-R1 / WORKER 2

**Data:** 2026-10-15. **Classificação:** **AUDITORIA ADMINISTRATIVA PARCIAL — ACESSOS EXTERNOS PENDENTES**. **Veredito:** NO-GO; migração NÃO autorizada. Este PR é **DRAFT**, apenas seis documentos W2.

## ONDE ESTAMOS

Repositório: aprov-hgesm/Controles-de-Empenhos---Aprov. Baseline main@2b1241fe3abd96c67766caf065d24a4b2a223b98 (inalterada na investigação). PR técnico W1 #316 (head 1a2551ac) DRAFT e não merged; PR de coordenação #317 também DRAFT. Branch isolada deste W2: audit/cloud-run-r1-w2-administrative-evidence, baseada em main, sem incorporar os arquivos do W1 como se fossem da main.

## O QUE ESTAMOS FAZENDO / RESULTADOS

Auditoria de informações externas, **somente consultas read-only**. Foram consultados os doze relatórios W1 na ref #316, GH REST para baseline/proteção/rulesets, estado de PRs e conexão Vercel.

- **GitHub confirmado:** main protected:false; rulesets retornou []; branch protection detalhada 403; colaboração com push e leitura, sem admin. Não inferir GitHub Environments.
- **Vercel:** conexão ativa pertence a equipe distinta; consultas GET ao escopo proprietário aprov-hgesms-projects retornaram **403**. Nenhuma leitura de valor secreto. Situação do painel proprietário não verificada.
- **Aplicação:** vercel.json traz cron 15 9 * * * e auto deploy false; firebase.json referencia Core nomeado + emprovex-warehouse; runbook informa que backup lógico não cobre Warehouse e nativo requer verificação.
- **Deriva:** PRs #286 e #289 mudam intake e isolamento Firebase respectivamente; seguem DRAFT e fora da main. PR #315 foi merged antes da baseline; PRs #316/#317 documentalmente isolados.
- **Escopo dos X:** **VERIFICADO 0; INCONCLUSIVO 2 (X11/X16); BLOQUEADO POR ACESSO 14**. Há fatos pontuais verificados, mas nenhuma lacuna externa certificada integralmente.
- Riscos R01/R02/R03/R04 continuam **4 BLOCKER**; R05/R06 críticos; R11/R18 exigem decisões. 16 gates G01–G16 continuam sem PASS administrativo; G01 parcial.
- **Não realizados:** deploy, E2E, build, smoke, recovery/restore, leitura de payload de dados reais, alteração Firestore/IAM/Rules/DNS/TLS/OAuth/cron/billing/Vercel, criação de Cloud Run, acesso a valores de secrets ou merge.

## QUEM ESTÁ FAZENDO

W2: matriz de lacunas, prova administrativa disponível e proposta de responsabilidades. Worker 1: dossiê técnico PR #316. Worker 3: auditoria de código independente. Titulares de Vercel/GCP/Firebase/DNS: provas administrativas faltantes. Coordenador: reconciliação e decisão. Fundador: autorização exclusiva de fase de implantação e aceite final.

## O QUE FAZER A SEGUIR

P0: titular GCP/Firebase fornece X01/X02/X05, titular Vercel fornece X03/X04, titular Auth fornece X06/X07, titular DNS X08, titular GitHub X11 — **somente metadados/capturas sanitizadas, nunca credenciais**. P1: métricas/custos X09/X10, integrações X12, proxy X13, duração X14, rollback X15, fechamento deriva X16. Coordenador concilia PRs e registra evidências no memorial oficial, sem merge automático.

A adaptação futura de ADC, segregação homologação/produção, escolha de borda, cron e QA deve ficar em PRs de implementação **após autorização**. Provar restore isolado e rollback antes de qualquer cutover; produção Vercel e emprovex.com.br permanecem intactos.

## QUEM O FARÁ

Provas: administradores titulares. Tratamento de riscos e gates: Coordenador. Adaptação técnica futura: Backend/Infra/CI após aprovação. QA/recovery: workers dedicados em testes isolados. Aprovação G16 e cutover: Fundador.

## Entregáveis deste PR

01_MATRIZ_EVIDENCIAS_EXTERNAS.md; 02_IAM_BANCOS_IDENTIDADES_SEGREGACAO.md; 03_VERCEL_OAUTH_DNS_CRON_E_BACKUPS.md; 04_CUSTOS_METRICAS_E_OPERACAO.md; 05_PENDENCIAS_PARA_FUNDADOR_E_COORDENADOR.md; 06_HANDOFF_COORDENADOR.md — somente sob docs/audits/cloud-run-r1/worker-2/.

Não alterar memorial canônico em paralelo; sugerir adendo somente após reconciliação com #317. Dossiê parcial NÃO constitui liberação de migração.
