# CLOUD-RUN-R1 / W2 — Solicitações mínimas ao Fundador e Coordenador

**Objetivo:** obter **somente evidências administrativas sanitizadas**, sem credenciais, alterações, deploy ou custos novos. **Status:** NÃO AUTORIZADA migração. P0 antes de P1.

## Fundador ou titulares das contas — cinco pacotes de leitura

**F1 — Google Cloud / Firebase, P0 (X01/X02/X05).** Em console do projeto correto, registrar lista dos projetos/ambientes, **ambos os bancos Firestore nomeados**, regiões, IAM effective roles/principals necessários, service accounts existentes, backup schedules, retenção e situação READY de cada banco. Informar se billing ativo e quem tem acesso administrativo (sem IDs completos). **Não criar SA, restaurar, ativar backup nem mudar papéis.** G05/G07/G08.

**F2 — Vercel, P0 (X03/X04/X09/X12).** A conexão deste Worker recebeu **403** no escopo aprov-hgesms-projects. O titular deve inspecionar o projeto no painel certo e encaminhar **nomes e targets** das envs FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON, CRON_SECRET, Monitoring, NEXT_PUBLIC_*, proteção de deployments, estado cron, domínio/alias, deployment de produção e política de hooks. Adicionar métricas agregadas 30/60/90d se fácil. **Nunca enviar valores das envs, JSON de serviço, cookies ou tokens.** G03/G08/G12/G15.

**F3 — Auth/OAuth/App Check, P0 (X06/X07).** Firebase Auth authorized domains, redirecionamentos Google Login, OAuth Drive client/scopes/origins e App Check/reCAPTCHA por Production/Preview; export **sem client secrets/chaves privadas**. Apontar origem canônica e temporária; não editar. G03/G08/G09.

**F4 — DNS/TLS + billing, P0/P1 (X08/X10/X15).** Titular do DNS deve identificar provedor, quem poderá reverter, TTL, tipos de registros relevantes, www, certificados e HSTS, por export sanitizado. Titular GCP billing fornece gastos agregados/quotas/alerts. **Não mudar DNS, plano ou orçamento.** G11/G13.

**F5 — GitHub, P0 (X11).** Proprietário aprov-hgesm confirmar pela interface Settings as políticas de proteção de main, rulesets, GitHub Environments/reviewers e workflow publication permissions. Esta integração **não é admin**; branches/main reportou protected:false, rulesets repo [], acesso completo às proteções 403. Apenas leitura. G01/G14.

## Coordenador — decisões e sequência

1. Receber F1–F5, sanitizar capturas e reclassificar X01–X16 no memorial canônico em trabalho **separado**; não presumir VERIFIED sem prova externa.
2. Reconciliar PR #286 (intake) e #289 (Firebase/preview isolation) com o HEAD de liberação; PR #316 e #317 seguem DRAFT; GitHub PRs abertos não são main. Fechar G01 somente após comparação de SHA.
3. Submeter escolha arquitetura (Hosting vs LB, região, estratégia ADC, backend de cron, custo e isolamento) como proposta; nenhum provisionamento nesta etapa.
4. Programar etapa de implementação/homologação **somente depois de autorização**, com banco isolado e testes de negação a produção, restore isolado e QA F05/F06/F09.
5. Preservar Vercel produção, cron único, DNS e Firestore até aceite explícito G16.

**Forma de retorno:** uma tabela pequena com fonte/ambiente/data, item X, evidência administrativa sanitizada, conclusão e responsável. Na falta de acesso, registrar exatamente “BLOQUEADO POR ACESSO”; não enviar credenciais no chat ou PR.
