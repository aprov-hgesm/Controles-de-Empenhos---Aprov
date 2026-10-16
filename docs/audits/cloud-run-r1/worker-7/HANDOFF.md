# CLOUD-RUN-R1 — W7 Security Batch (2026-10-16)

**STATUS:** PREPARAÇÃO DE SEGURANÇA QA — SOMENTE BRANCH ISOLADA / PR DRAFT. **CLOUD RUN NO-GO**.

## Missão e racional
Reduzir passos manuais repetitivos durante a homologação QA sem omitir gates: uma auditoria PowerShell **somente leitura** no projeto GCP real e uma verificação GitHub Actions **offline** de dois arquivos de Firestore Security Rules inicialmente fail-closed.

## Arquivos produzidos
- `firestore.qa-core.rules` — todo cliente negado até regras por identidade/workspace serem avaliadas.
- `firestore.qa-warehouse.rules` — todo cliente negado até regras por identidade/workspace serem avaliadas.
- `firebase.cloud-run-qa-rules.json` — manifesto separado com **somente** bancos nomeados QA, sem default. **Não executar deploy**: a mera existência desse manifesto não prova API Firebase ativada nem Rules implantadas.
- `scripts/cloud-run-qa-security-batch.test.mjs` — valida exatamente os dois DBs e o conteúdo deny-by-default; verifica que o auditor não contém comandos mutantes nem emissão de token.
- `scripts/cloud-run-qa-readonly-audit.ps1` — faz consultas com `gcloud.cmd` sobre project, billing, APIs, bancos QA, identidade e IAM por banco. Imprime apenas PASS/FAIL/PENDENTE sem segredos, sem `gcloud config set project`, sem acesso ao projeto produtivo. Requer `gcloud.cmd` e autenticação prévia local, sem credenciais transferidas.
- `.github/workflows/cloud-run-qa-security-batch.yml` — job 4 minutos, Node 22, permissões `contents:read`, sem Firebase credentials, sem serviço GCP, sem npm ci, apenas testes estáticos.

## Limites — NÃO considerar prova funcional
- A suite W6 já realiza Emulator 9/9, e W5 Application CI/guard já cobre Firebase/ADC mock. A nova suíte não duplica F05/F06/F09 nem força builds e downloads pesados; comprova apenas **estrutura local de Rules** e integridade do script.
- **As Rules QA NÃO foram publicadas no GCP/Firebase.** Não há comprovação de proteção atual no backend QA, porque as Rules ativas por banco ainda exigem consulta e definição controlada.
- O script PowerShell **não se passa pela service account** e não certifica 403 de produção; será necessário teste temporário sob a identidade QA, após review da política de impersonação, nunca repassar token/JSON privado.
- Nenhum deploy, merge, WIF, IAM, serviços, dados reais, migração ou alteração em Vercel/projeto produtivo.

## Evidências externas do Fundador consolidadas
- Projeto QA: `emprovex-qa-r1-261015-6275`, número `953294034210`, faturamento ativo BRL, orçamento R$20/mês (alerta; não trava gastos).
- `qa-core` Standard/Native `us-east1`, freeTier true; `qa-warehouse` Standard/Native `us-east1`, freeTier false; delete-protection ambos.
- `emprovex-qa-runtime@emprovex-qa-r1-261015-6275.iam.gserviceaccount.com` criado, sem chaves JSON; `roles/datastore.user` condicional a cada banco e confirmado por consulta IAM independente.
- IAM e IAMCredentials APIs ativadas, Firestore e FirebaseRules APIs ativadas. Firebase Auth QA e serviço Cloud Run ainda não comprovados.
- Progresso de coordenação antes e depois desta preparação: **Etapa 3 50%; geral 50%**. **Não alterar** até testes reais de autorização/Rules.

## Handoff padrão
- **Onde estamos:** Segurança QA parcialmente preparada, IAM condicional registrado mas não testado efetivamente.
- **O que estamos fazendo:** primeira prova leve batch offline e auditoria local única.
- **Quem está fazendo:** W7 de automação e Coordenação, usando branch dependente W6.
- **O que fazer a seguir:** confirmar CI W7; o Fundador executa o script PowerShell read-only da branch com `gcloud.cmd` local; coordenação trata eventual FAIL e planeja, em PR/etapa futura, Firebase Auth/Rules por banco e teste controlado de impersonação real com IAM 403 no projeto produtivo. **Não publicar Rules fechadas sem deliberar impacto UX de QA**.
- **Quem fará:** Coordenação no GitHub; Fundador no Windows para consultas; revisor de segurança para controles de autenticação; autorização separada para qualquer deploy.
