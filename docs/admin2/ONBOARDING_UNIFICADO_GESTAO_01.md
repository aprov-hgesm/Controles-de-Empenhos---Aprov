# EMPROVEX ADMIN 2.0 — ONBOARDING UNIFICADO + GESTÃO DO CLIENTE (2026-10-18)

**Projeto:** \`aprov-hgesm/Controles-de-Empenhos---Aprov\`
**Branch isolada:** \`feat/admin2-w01-sidebar-local-preview\` · PR #339 DRAFT
**Status:** implementação de contrato/backend na branch + prévia simulada, esperando CI final e aceite humano. **Não implantado.**

## Decisão do Fundador

Cadastro unificado: **Cliente comercial + Workspace + Conta Operacional + Assinatura Trial de 30 dias**.

Gestão separada em aba específica **Gestão do cliente**, contendo dados comerciais, Ficha 360°, ações de assinatura, auditoria e controles de acesso independentes.

**Identidade comercial 1:1:** \`platformCustomers/{workspaceId}\` corresponde a exatamente um workspace. A pessoa de contato é atributo do cliente. Cada workspace tem sua assinatura e seu ambiente isolados. Não existem relações 1:N ou limite de oito.

## 1. Cadastro — o que existe hoje

\`components/admin2/customers/AdminUnifiedCustomerCreate.tsx\`:
- Formulário único de workspaceId, nome, UG, OM, sigla, setor, e-mail da conta, senha inicial **apenas no formulário e descartada após simulação**;
- Contato comercial, e-mail, telefone e observações;
- Trial obrigatório de 30 dias, mensalidade-base R$ 70 e cobrança não exigida durante o teste;
- No localhost normal, simulação em **memória React**; a simulação aparece na Gestão, sem Firebase Auth ou Firestore real. **Não usar dados pessoais verdadeiros**.
- \`lib/admin2/customers/unifiedCustomerOnboarding.ts\` constrói e valida conjuntamente Workspace, SectorAccount, CommercialCustomer e BillingAccount via funções de domínio existentes, incluindo verificação de status/trial.

### Persistência preparada no provisionamento server-side (NÃO acionada pela prévia)

- \`lib/sectorProvisioning.ts\` agora aceita \`commercialCustomer\` opcional, validado junto do provisionamento. Quando presente, **obriga grantTrial=true**.
- \`lib/server/sectorProvisioningAdmin.ts\`: \`createSectorDirectory\` inclui o novo documento \`platformCustomers/{workspaceId}\` com precondition \`exists=false\` **no mesmo commit Firestore** de Workspace, SectorAccount, contador, UG index, BillingAccount e auditoria.
- Reaproveita a proteção de identidade fundadora, locks, rollback e marcadores de recuperação do provisionamento seguro preexistente. Não há atomicidade integral entre Firebase Authentication e Firestore; erros nesses serviços seguem o mecanismo de recuperação existente.
- O endpoint preexistente \`app/api/admin/provision-sector/route.ts\` **não é chamado pela UI da prévia** e **não foi publicado**. Não tentar realizar provisionamento de contas reais antes de novo gate operacional/QA.
- \`DEFAULT_PLATFORM_BILLING_CONFIG.defaultTrialDays = 30\`, preço fixo Plano Completo R$70/mês, sem suspensão automática por inadimplência.

## 2. Aba separada — Gestão do cliente

\`components/admin2/customers/AdminCustomerManagement.tsx\`:
- Localiza workspace pelo ID (ou escolhe um criado na simulação), consulta dados comerciais e resumo billing sob demanda;
- Permite abrir Ficha 360° e ir à edição de contatos pela área comercial;
- Permite escolher e confirmar ações **Conceder Trial, Ativar plano pago, VIP/Isento, Pendente, Cancelar assinatura**;
- **Localhost comum:** todas as decisões são simuladas em memória, sem writes, com histórico temporário explicitamente sinalizado;
- **Somente em Firebase Emulator demo-***: ao selecionar um workspace presente no Emulator, reutiliza \`grantBillingTrial\`, \`setBillingExemption\`, \`setBillingCommercialStatus\`, regras e auditoria já existentes; sem chamadas à produção.
- Acesso e segurança de usuário: apresenta o e-mail operacional; resetar senha/suspender acesso permanecem **desabilitados** até integração com endpoints administrativos seguros, validação de permissões e homologação específica. Não confundir cancelamento comercial com exclusão ou suspensão operacional.
- Os dados de \`billingAccounts\` continuam separados de \`platformCustomers\` e não são alterados durante a edição de contatos.
- \`components/admin2/customers/AdminCustomersDirectory.tsx\` agrega diretório V1, Cadastro Unificado, Gestão e edição comercial em visual V3. Preview na Ficha 360 usa faturamento simulado e não consulta auditoria/billing remoto para workspace fictício.

## 3. Segurança/limitações obrigatórias

- Preview disponível somente em \`NODE_ENV=development\`, protegida por autenticação fundadora Google e Rules existentes para leituras reais.
- O cadastro comercial persistente continua com operações apenas quando \`NEXT_PUBLIC_EMPROVEX_E2E_EMULATORS=1\` e \`NEXT_PUBLIC_EMPROVEX_E2E_PROJECT_ID\` começa em \`demo-\`.
- **Nenhuma criação, exclusão, cobrança, suspensão, alteração de credencial, IAM, Rules publish, deploy ou merge em main**.
- **IMPORTANTE:** o fluxo unificado está em **simulação no navegador**; mesmo configurando Emulators, o botão do formulário não chama a API de provisionamento; criação real de usuário/workspace no Emulator ainda requer harness de integração específico. O backend de produção foi *preparado*, não publicado.
- Mudanças de assinatura no Emulator podem envolver duas transações em sequência ao retirar VIP e aplicar outro status. Antes de qualquer habilitação real, implementar plano de consistência/retry, validação da auditoria e confirmações.
- Não armazenar credenciais de acesso nem contatos reais em logs, URL ou rascunhos persistentes. Limpar senha assim que a simulação terminar.

## 4. Smoke localhost

1. No Windows PowerShell, interromper o dev server, \`git pull --ff-only origin feat/admin2-w01-sidebar-local-preview\`, executar testes e \`npm.cmd run dev -- --port 3001\`.
2. Entrar em \`http://localhost:3001/admin2-preview?area=customers\` com Google fundador.
3. Selecionar **Cadastrar cliente + workspace**. Preencher **somente dados fictícios**; confirmar criação simulada e Trial 30 dias.
4. Clicar **Abrir Gestão do cliente**, selecionar o workspace simulado, conferir UG/OM e Trial. Simular VIP, plano pago, pendência, cancelamento e novo trial, observando confirmação e histórico temporário.
5. Abrir Ficha 360° do workspace simulado e conferir que nem billing nem auditoria remotos são consultados; dados fictícios claramente identificados.
6. Usar Gestão para procurar um workspace real por ID e confirmar que todas as decisões ficam somente em memória na prévia comum; nenhuma cobrança ou acesso é alterado.
7. Verificar navegação, estado de erro, formulário obrigatório, ausência de gravações Firestore e regressão na listagem V1.

## 5. Gates antes do próximo marco

- [ ] Application CI completo PASS para HEAD final.
- [ ] Core Protection PASS.
- [ ] Teste estrutural \`scripts/admin2-unified-onboarding.test.mjs\` PASS.
- [ ] Teste de domínio real \`scripts/admin2-unified-domain.test.mjs\` PASS (trial, R$70, 30 dias, IDs 1:1, sem senha nos registros).
- [ ] Auth + Firestore Emulator da segurança comercial PASS.
- [ ] Smoke humano do fundador no localhost.
- [ ] Para efetivar provisionamento real de cliente + workspace: **novo gate de integração no Emulator** com usuário Auth e commit/rollback e smoke negativo, além de autorização explícita para publicar rotas e Rules.
- [ ] Para habilitar ações reais de gestão, homologar fluxo de estado comercial e auditoria; para credenciais/suspensão operacional, integrar serviços existentes com verificações específicas.

## Handoff

**ONDE ESTAMOS:** Admin 2.0 V3, Clientes V1 e Ficha V2, cadastro comercial 1:1; nova UI unificada e Gestão separadas implementadas na branch; ambiente real intacto.

**O QUE ESTAMOS FAZENDO:** validar criação conjunta simulada, preparo de commit conjunto e gestão comercial segura.

**QUEM ESTÁ FAZENDO:** chat executor sequencial, Fundador testará o localhost.

**O QUE FAZER A SEGUIR:** CI, correções, aceite no localhost e teste integrado de provisionamento com Firebase Emulators antes de qualquer release.

**QUEM O FARÁ:** ChatGPT verifica/corrige código e CI; Fundador aprova UI e operações.
