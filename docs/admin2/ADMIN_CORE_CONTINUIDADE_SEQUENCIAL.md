# EMPROVEX — ADMIN 2.0 CORE V2
## Memorial de continuidade — desenvolvimento SEQUENCIAL no mesmo chat ou em sucessores

**Atualização de método:** 2026-10-18, por decisão expressa do Fundador.
**Status:** Visual V3 e Clientes 360° V1 aprovados; **Ficha 360° V2 e Cadastro Comercial Independente V1 implementados na branch isolada**, aguardando aceite humano e certificação CI do HEAD. Rascunhos comerciais apenas na memória do localhost padrão; Firestore persistente somente Emulator. Demais módulos continuam demonstrativos.
**PROCEDIMENTO VIGENTE:** 1 chat executor por vez, trabalho incremental em **uma única branch de desenvolvimento local**, validação humana no localhost, atualização deste memorial a cada marco. **Os prompts antigos de workers paralelos e ondas foram suspensos.**
**Repo:** \`aprov-hgesm/Controles-de-Empenhos---Aprov\`.
**Branch ATIVA:** \`feat/admin2-w01-sidebar-local-preview\`; PR **#339 DRAFT** (o nome histórico W01 não limita a missão, que agora é toda Admin CORE V2).
**HEAD de entrada do marco:** \`be7ea1478019aef045c319ffb865ddd3958a3bee\`; SEMPRE consultar HEAD real do PR/branch, pois evoluirá.
**BRANCH RESERVADA/PARADA:** \`feat/admin2-core-integration\`; PR #340 DRAFT, só documento de coordenação G0, **não é o local de novas implementações enquanto vigorar o desenvolvimento sequencial**. Não duplicar mudanças nas duas branches.
**Baseline da \`main\` ao escrever:** \`50fb01bff2718c913e63ac4082c13030d8f8e354\`; verificar antes de rebase/merge, pois pode mudar.
**Verificação do commit be7ea147...:** Application CI **success**, EMPROVEX Core Protection **success** (GitHub Actions consultado no dia 2026-10-18). A aprovação e o CI referem-se ao código **de prévia**, não a backends Admin 2.0 inexistentes. Não promover esses resultados a futuros commits sem executar novos testes.


## Marco de desenvolvimento — Clientes 360° real (2026-10-18)

**Decisão do Fundador:** executar \`/goal\` para desenvolver sequencialmente contrato Cliente/Workspace e substituir os clientes fictícios por dados administrativos reais, sem mudar produção nem outros workspaces.

**O QUE FOI EXECUTADO (na branch ativa):**
- Criado \`lib/admin2/customers/customerWorkspaceContract.ts\`: \`CustomerWorkspaceRecord\`, chave de projeção \`workspace:{workspaceId}\`, \`CustomerBillingSnapshot\`, formatação/validações, identificadores legados preservados.
- Criado \`lib/admin2/customers/customerWorkspaceDirectory.ts\`: \`getDocs(query(workspaces,...limit(11)))\`, cursores \`startAfter\`, pesquisa por prefixo de nome, UG exata e ID; \`getDoc(billingAccounts/{workspaceId})\` apenas após clicar na ficha. NÃO usa listeners globais nem writes.
- Criado \`components/admin2/customers/AdminCustomersDirectory.tsx\`: login Google, validação \`getIdTokenResult\` com e-mail fundador + \`emailVerified\` + provider Google, lista real 10/página, ações pesquisa/atualizar/navegar, ficha 360 read-only com identificação institucional, status e resumo de billing. **Firestore Rules continuam sendo a autoridade efetiva**, além da checagem de interface.
- Atualizado \`components/admin2/shell/AdminCommandPreview.tsx\`: substituído \`DEMO_CUSTOMERS\`/ClientesDemo pela nova seção real; cabeçalho e banner deixam explícito que só a aba Clientes consulta dados reais e que os demais módulos permanecem ilustrativos.
- Criado \`docs/admin2/CLIENTES_360_G0_CONTRATO.md\`, adicionado \`scripts/admin2-customer-contract.test.mjs\`, atualizada suite \`scripts/admin2-sidebar-preview.test.mjs\` e inclusão dos dois testes em \`.github/workflows/application-ci.yml\`.
- Guia localhost \`docs/admin2/LOCAL_SIDEBAR_PREVIEW.md\` atualizado com login, paginação e observação de leituras Firestore.

**ARQUITETURA/SEGURANÇA:**
- Cliente real **comercial** ainda não é uma nova coleção: o módulo atual apresenta os workspaces existentes como **projeção administrativa de Cliente V0**. NÃO confundir OM/UG e pagante ou criar \`CustomerWorkspaceLink\` sem contrato posterior. Não há cadastro/edição nesta etapa.
- A fonte de verdade é \`workspaces/{workspaceId}\`, e \`billingAccounts/{workspaceId}\` só é lido sob demanda; não há alteração em Firestore Rules, custom claims, Warehouse, Drive ou server admin credentials.
- A leitura é executada pelo SDK Firebase Web após login admin e aplica as Security Rules atuais (somente administrador lista workspaces). A rota do laboratório continua indisponível fora de \`NODE_ENV=development\`.
- **Custo:** uma página até 11 documentos lidos (10 exibidos + lookahead); uma ficha pode ler mais um documento billing; nomes por prefixo, UG/ID exatos. A UI não faz N leituras financeiras ao listar. **Leitura real é faturável**. Sem varredura, \`onSnapshot\` ou gravação.
- O login via Google em localhost precisa de domínio/OAuth autorizado; caso falhe, relatar sem alterar configuração remota por conta própria.

**TESTES/EVIDÊNCIAS:** Core Protection já PASS em commits intermediários da implementação; Application CI foi acionado com novas suites, **resultado do último HEAD deve ser consultado**. Haverá necessidade de smoke humano com autenticação real; **não declarar concluído em produção nem aceite funcional antes de verificação**.

**PR/BRANCH:** \`feat/admin2-w01-sidebar-local-preview\` / PR DRAFT #339. O HEAD avançou; conferir SHA atual e status da pipeline. PR #340 continua estacionado. A \`main\` foi mantida inalterada.

**LOCALHOST:** \`http://localhost:3001/admin2-preview?area=customers\` após \`git pull --ff-only origin feat/admin2-w01-sidebar-local-preview\` e \`npm.cmd run dev -- --port 3001\`.

**PRÓXIMA AÇÃO:** aguardar CI PASS, corrigir quaisquer falhas da suite; Fundador validar no localhost com login da conta fundadora, pesquisar UG/ID/nome, paginar e abrir ficha; verificar conta externa negada, ausência de writes e custo. Somente após aceite avançar para formalizar Cliente comercial 1:N/CRM e integração das próximas páginas.

**ESTADO DO MARCO:** código de consulta e UI implementados; QA de integração autenticada no navegador ainda PENDENTE; ambiente produtivo intacto.

---

## Marco aprovado pelo Fundador — Clientes 360° V1 · 2026-10-18

**APROVAÇÃO HUMANA:** o Fundador informou que testou o diretório real e a ficha Cliente 360° no localhost e **aprovou** a entrega. A aprovação refere-se à versão **read-only atual**, com Google Auth, diretório paginado, pesquisa nome/UG/ID e ficha administrativa com billing sob demanda. Não constitui aprovação de CRUD, entidade comercial persistida, acessos operacionais externos ou deploy.

**Certificação observada:** o código no HEAD `b52f6ffd721f37e37b3d297354b6c1170fb0548e` do PR DRAFT #339 apresentou **Application CI: success** (run 39167821457) e **EMPROVEX Core Protection: success** (run 39167821442), conforme GitHub Actions. Quaisquer commits documentais posteriores exigem nova consulta ao CI antes de alegar PASS para novo SHA. O teste humano de conta comum negada ou stress 5.000 clientes não foi declarado executado.

**Próximo marco RECOMENDADO (não implementado): Ficha Cliente 360° V2.** Em uma entrega sequencial na **mesma branch**, completar apresentação administrativa por seções:
1. Identificação institucional, dados de contato e vínculo OM/UG/Workspace a partir de fontes autorizadas;
2. Painel comercial de assinatura, trial, VIP, ciclos/histórico financeiro existentes, com paginação ou limite explícito (sem trazer `billingCycles` inteiro);
3. Linha do tempo de eventos administrativos **realmente existentes**, com origem e data, sem inventar ocorrências;
4. Definir e versionar contrato de `Customer` comercial e `CustomerWorkspaceLink` (1:N), inicialmente sem criar documentos reais, sem alterar Firebase UID, UG nem autorizações. Qualquer persistência nova exigirá validação de Rules/Emulator e autorização separada;
5. Preservar UI V3 aprovada, leitura sob demanda, isolamento entre tenants, qualidade CI e apresentação em localhost para aceite antes da próxima fase.

**IMPORTANTE:** as listas/linha do tempo só poderão mostrar fatos reais permitidos pelas Rules. A ausência de dados não deve ser mascarada por mocks. Se índices/consultas adicionais forem necessários, preparar primeiro o contrato e testes, sem modificar Firestore de produção.

**Branch:** `feat/admin2-w01-sidebar-local-preview` — PR #339 DRAFT (ativo). PR #340 permanece estacionado. **`main`/produção intactas** e o fluxo continua com **um chat executor**, sem workers paralelos.

**Handoff atualizado:** ONDE ESTAMOS — Clientes 360° V1 aprovada; O QUE ESTAMOS FAZENDO — definir V2 e preparar novo incremento; QUEM ESTÁ FAZENDO — chat executor sequencial; O QUE FAZER A SEGUIR — implementar V2 read-only no mesmo localhost, testar CI e pedir validação; QUEM O FARÁ — ChatGPT desenvolve, Fundador valida.

---

## Marco implementado — Ficha Cliente 360° V2 · 2026-10-18

**Estado: IMPLEMENTADO EM CÓDIGO, AGUARDANDO CI FINAL E SMOKE HUMANO.** A V1 do Diretório foi aprovada pelo Fundador antes deste marco. A V2 não deve ser marcada como aprovada até novo teste no localhost.

**O QUE MUDOU:**
- \`lib/admin2/customers/customer360Contract.ts\`: tipos \`CommercialCustomerDraft\`, \`CustomerWorkspaceLinkDraft\` (modelo 1:N NÃO PERSISTIDO), ciclo financeiro e auditoria; funções de domínio puras rejeitam documento de outro workspace/ID inconsistente.
- \`lib/admin2/customers/customer360Read.ts\`: competências \`billingCycles\` via ID prefix \`workspaceId__YYYY-MM\`, \`orderBy(documentId(), 'desc')\`, \`startAt\`/\`endAt\`, limite **7 leituras retornadas para exibir 6** e cursor de paginação; auditoria \`platformAuditEvents\` filtrada por workspace com \`limit(12)\`. **Sem listeners nem writes**.
- \`components/admin2/customers/AdminCustomerDetailV2.tsx\`: Ficha 360° visual em **Visão geral / Financeiro / Atividades / Vínculos e contato**, aproveitando visual V3 aprovado (sidebar fixa escura, conteúdo claro). Dados institucionais e billing existentes; componentes financeiros/auditoria montam somente na primeira abertura da aba e permanecem montados em memória enquanto a ficha existir, sem refazer automaticamente leituras ao alternar abas; Atualizar é explícito.
- \`components/admin2/customers/AdminCustomersDirectory.tsx\`: substituição da ficha V1 pela V2, sem mudar a autenticação Google fundadora nem a listagem V1.
- \`scripts/admin2-customer-360-v2.test.mjs\` criado; \`scripts/admin2-sidebar-preview.test.mjs\` atualizado; Application CI inclui suíte V2.
- \`docs/admin2/CLIENTES_360_V2_CONTRATO.md\` e \`docs/admin2/LOCAL_SIDEBAR_PREVIEW.md\` documentam limites, segurança e testes.

**INTEGRIDADE COMERCIAL E SEGURANÇA:**
- Os documentos fonte permanecem \`workspaces\`, \`billingAccounts\`, \`billingCycles\` e \`platformAuditEvents\`. A V2 **não criou** entidade comercial real, contato, vínculo no banco, política de acesso ou migração.
- Valor financeiro exibido é o registrado no documento de competência; **não** se declara caixa total ou receita consolidada.
- Auditoria por \`workspaceId == ...\` seleciona até **12 eventos não necessariamente recentes**, pois IDs de evento são aleatórios e a consulta não ordena por \`createdAt\`. Apenas registros retornados são ordenados localmente, e a UI deixa a limitação visível. Não há acesso a \`before/after\`, estoque, empenhos ou Drive.
- Cliente comercial 1:N está previsto **apenas como contrato TypeScript e função pura**, para projeto de persistência futuro com nova validação de Rules/Emulator.
- Firestore **somente leitura** via Web SDK e Rules atuais, com custos por consulta; nenhum \`firebase deploy\`, \`vercel deploy\`, mutação em workspaces ou alteração de produção foi realizada.

**QA:** código e testes foram enviados à branch ativa do PR #339. **Consultar HEAD e GitHub Actions antes de declarar PASS**; validar também a sessão no localhost. Sem E2E real executado neste registro.

**VALIDAÇÃO DO FUNDADOR PENDENTE:** atualizar \`$HOME\emprovex-admin2-preview\`; executar \`node --test scripts/admin2-sidebar-preview.test.mjs scripts/admin2-customer-contract.test.mjs scripts/admin2-customer-360-v2.test.mjs\`; iniciar \`npm.cmd run dev -- --port 3001\`; abrir \`http://localhost:3001/admin2-preview?area=customers\`, clicar **Ver ficha** e testar as quatro seções com conta Google fundadora. Confirmar não regressão da V1 e isolamento ao mudar workspace.

**PRÓXIMO PASSO APÓS ACEITE:** próximo incremento sequencial de cadastro comercial persistente/relacionamento Cliente 1:N com proteção de Rules, backfill dry-run, organização dos contatos e CRM, mediante autorização específica para alterações reais.

**HANDOFF:** ONDE ESTAMOS — V2 implementada na branch isolada, QA/aceite pendentes. O QUE ESTAMOS FAZENDO — aperfeiçoamento do acompanhamento read-only. QUEM ESTÁ FAZENDO — chat executor sequencial. O QUE FAZER A SEGUIR — concluir CI e validar localhost. QUEM O FARÁ — ChatGPT confere CI, Fundador faz smoke e aprova ou pede refinamento.

---

## Marco em execução — Cadastro Comercial Independente V1 (2026-10-18)

**PEDIDO ATUAL DO FUNDADOR:** implementar entidade comercial com contatos, relacionamento e 1:N vínculos de workspaces **sem alterar os workspaces existentes**, na mesma branch isolada, sequencialmente.

**IMPLEMENTADO NO GITHUB:**
- \`lib/admin2/customers/commercialCustomerContract.ts\`: \`CommercialCustomer\`, \`CommercialCustomerInput\`, status prospecto/negociação/ativo/inativo, pessoa/e-mail/telefone, observações limitadas, \`workspaceIds\` até 8, normalização e validação, vínculo 1:N.
- \`lib/admin2/customers/commercialCustomerRepository.ts\`: \`platformCustomers/{customerId}\` independente, listagem 10/página, \`runTransaction\` para cadastro/edição + \`platformCustomerWorkspaceLinks/{workspaceId}\` como índice determinístico de vínculo único, verificação de existência dos workspaces, conflito e versão otimista; consulta inversa somente ao abrir vínculo comercial.
- \`firestore.rules\` **apenas na branch**: \`isPlatformAdmin()\` para dados comerciais, validação de campos, limites, imutabilidade de autor, verificação \`getAfter\`/ \`existsAfter\` no vínculo; clientes operacionais não recebem nenhuma permissão nova.
- \`components/admin2/customers/AdminCommercialCustomers.tsx\`: aba separada **Cadastro de clientes comerciais**, formulário profissional (nome/contato/email/telefone/status/notas), associação por ID verificado e edição. **No localhost normal:** dados são *rascunhos locais em memória*, não Firestore. Rascunhos desaparecem ao atualizar a página. **Não usar dados pessoais reais no rascunho.**
- \`components/admin2/customers/AdminCustomersDirectory.tsx\`: alternância entre Workspaces existentes e Cadastro comercial, preservando a V1 e o auth gate existente; rascunhos mantidos apenas no componente durante navegação.
- \`components/admin2/customers/AdminCustomerDetailV2.tsx\`: aba Vínculos e contato mostra o cliente comercial relacionado ao workspace por rascunho local ou, no Emulator, lookup condicionado à abertura da aba; não altera UG/OM/conta operacional.
- \`scripts/admin2-commercial-contract.test.mjs\` e \`scripts/admin2-commercial-security.test.mjs\`: testes domínio/estrutura e **Auth + Firestore Emulator** cobrindo conta fundadora, negativas, integridade e unicidade do vínculo; integrados ao \`Application CI\`.
- \`docs/admin2/CLIENTES_COMERCIAIS_CADASTRO_V1.md\` e guia localhost atualizados.
- **Compatibilidade CI:** o guard legado \`scripts/verify-sector-lifecycle.mjs\` foi ajustado de modo cirúrgico: permanece proibido \`allow delete: if isPlatformAdmin()\` em todos os demais namespaces; a única exceção, explicitamente validada no guard, é remover o índice comercial \`platformCustomerWorkspaceLinks\`. A falha original do CI foi resolvida em código, nova execução ainda exige PASS completo.


**GATE DE PRODUÇÃO:**
- O código persistente **existe e é testável no Emulator**, mas o repositório de escrita é *fail closed*: \`NODE_ENV === 'development'\` **e** \`NEXT_PUBLIC_EMPROVEX_E2E_EMULATORS === '1'\` são necessários para gravação.
- Sem \`firebase deploy\`/Rules publish, sem merge em main, sem live write, sem migração/backfill, sem tocar workspaces, Warehouse, Google Drive, Auth nem faturamento.
- A homologação no localhost normal valida experiência com dados fictícios guardados só em memória. **Isso não é CRUD persistente na produção**. Para publicar cadastro comercial real, haverá gate posterior para Rules, Emulator, segurança, eventual feature flag e GO explícito do Fundador.

**EVIDÊNCIAS:** commits de implementação e testes estão no PR #339; durante o primeiro CI do novo módulo, os testes de contrato/UI comercial e o Firestore Emulator tiveram **SUCCESS**, e o TypeScript também passou em commit anterior ao memorial. **Consultar conclusão do último HEAD** antes de declarar a etapa tecnicamente certificada. Smoke visual do Fundador ainda **PENDENTE**.

**PRÓXIMO PASSO:** concluir CI, testar em localhost (Clientes → Cadastro de clientes comerciais → Novo cliente → Vincular ID de workspace → Salvar rascunho → Editar → Ver ficha 360°/Vínculos e contato). Aguardar aceite do Fundador antes de ativar persistência real ou seguir para CRM.

**HANDOFF:** ONDE ESTAMOS — cadastro independente implementado em branch isolada e protegido contra escrita real. O QUE ESTAMOS FAZENDO — certificando domínio, interface e segurança. QUEM ESTÁ FAZENDO — chat executor único. O QUE FAZER A SEGUIR — CI completo + smoke localhost, sem deploy. QUEM O FARÁ — executor verifica, Fundador valida.

---

## DECISÃO MAIS RECENTE DO FUNDADOR — CLIENTE COMERCIAL 1:1 (18/10/2026)

**OPÇÃO B APROVADA: CADA WORKSPACE É UM CLIENTE COMERCIAL INDEPENDENTE.** Esta decisão **SUBSTITUI DEFINITIVAMENTE o antigo modelo 1:N e o limite de oito workspaces por cliente** mencionados em registros históricos abaixo. O contato comercial (militar responsável) é apenas um campo do cadastro, **não uma entidade cliente compartilhada entre workspaces**.

**CONTRATO VIGENTE:**
- **Um workspace = um cadastro comercial = uma assinatura por workspace**; OM e UG permanecem atributos institucionais, não agrupadores de contratos.
- `platformCustomers/{workspaceId}` é documento comercial único, com `id === workspaceId`, versão `emprovex_commercial_customer_v2`. Não há `workspaceIds[]`, IDs aleatórios ou `platformCustomerWorkspaceLinks`.
- Cadastro obrigatório de **um workspace preexistente**, validado na consulta e nas Firestore Rules; esse vínculo é imutável após criação. Não existe cadastro comercial sem workspace ou associação de vários workspaces.
- Contato responsável, e-mail, telefone, observações e situação são próprios desse workspace; dois workspaces podem compartilhar uma pessoa de contato, mas continuam **clientes/assinaturas independentes** e sem troca de permissão operacional.
- Contrato, Repository, UI, Ficha 360, Rules e suites Emulator/TypeScript atualizados na **branch isolada PR #339**. Documento canônico detalhado: `docs/admin2/CLIENTES_COMERCIAIS_CADASTRO_V1.md` (nome do arquivo histórico, conteúdo V2 1:1).
- **A regra 1:N do Plano Mestre, notas G0 anteriores e textos históricos abaixo estão SUPERADOS.** Não ressuscitar esse conceito em outros chats nem criar migrações/cópias de dados legados automaticamente.
- O frontend no localhost comum continua **em modo rascunho apenas em memória**, sem gravações reais; o repositório só habilita persistência com Auth/Firestore Emulator e `demo-` projectId. Rules versionadas apenas no GitHub, **não publicadas**. Produção/main inalteradas.
- A decisão de modelo comercial **não** equivale à aprovação visual/funcional da nova UI, à autorização de migração nem ao GO de deploy. Depois dos testes, solicitar aceite do Fundador no localhost.

**ONDE ESTAMOS:** mudança de contrato 1:1 implementada na branch isolada, testes/CI e smoke a confirmar. **O QUE ESTAMOS FAZENDO:** substituindo a arquitetura 1:N por ID determinístico. **QUEM:** chat executor sequencial. **A SEGUIR:** certificar Application CI, Firestore Emulator, TypeScript e testar o fluxo um workspace por cadastro. **QUEM FARÁ:** executor confere o CI; Fundador valida o localhost.

---

## PROPOSTA DE PRÓXIMA FASE — ONBOARDING INTEGRADO CLIENTE + WORKSPACE + TRIAL (18/10/2026)

**Origem:** o Fundador perguntou por que o Cadastro Comercial Admin 2.0 não cria o workspace e propôs um fluxo único que cadastre cliente e workspace, inicie automaticamente o **trial** e permita ao administrador alterar a assinatura. **Requisito em discussão — NÃO implementado nem autorizado para escrita real nesta conversa.**

**Constatação do código existente:** `app/api/admin/provision-sector/route.ts` chama `provisionSectorWorkspaceWithAuth` (`lib/server/sectorProvisioningAdmin.ts`) com verificação da identidade fundadora e controles de mutação; `lib/sectorProvisioning.ts` possui `grantTrial: true` como padrão. `createSectorDirectory` grava em commit Firestore os documentos workspace, conta operacional, contador, índice UG, `billingAccounts/{workspaceId}` criado por `buildInitialBillingAccount(..., grantTrial)` e auditoria. `DEFAULT_PLATFORM_BILLING_CONFIG.defaultTrialDays = 30`. O backend já administra lock, erros, rollback/recuperação quando falha Firebase Auth ou commit — **não prometer atomicidade total entre Firebase Auth e Firestore**.

**Assinatura já disponível no domínio existente:** `lib/platformBillingStore.ts` oferece `grantBillingTrial`, `setBillingExemption`, `setBillingCommercialStatus`, `setBillingCycleStatus`, protegendo a isenção fundadora. Plano Completo R$70/mês, VIP/isenção manual, trial 30 dias padrão e confirmação manual de pagamento; nenhuma suspensão automática por inadimplência.

**Proposta técnica da próxima etapa sequencial, dependente de aceite:**
1. Criar formulário Admin 2.0 **Novo cliente e workspace** contendo nome, OM/UG/setor, workspace ID, e-mail de acesso e credencial inicial segura, além de contato comercial e observações, sem misturar pessoa de contato com conta Firebase.
2. Reutilizar o endpoint de provisionamento administrativo, passando `grantTrial: true` (default 30 dias) e o payload comercial validado. Garantir que `platformCustomers/{workspaceId}` seja criado **no mesmo commit Firestore** de workspace, conta e billing, com `currentDocument.exists=false`. Integrar rollback/recuperação do registro comercial ao mecanismo já existente. Não criar uma segunda rotina de provisionamento.
3. Status inicial: `billingAccounts/{workspaceId}` em `trial`, com início/fim e preço-base registrado de R$70/mês, `paymentRequired=false`. Trial não significa cobrança paga, isenção VIP ou garantia de corte automático.
4. Na Ficha 360, oferecer ações do administrador (prorrogar/conceder trial, ativar plano, registrar VIP/isenção, situação comercial e pagamentos) reutilizando as funções/regras existentes, com confirmação, auditoria, isolamento por workspace e sem edição arbitrária de preço fora da política vigente.
5. Primeiro executar em **Auth + Firestore Emulator com contas e dados sintéticos**, testar sucesso, duplicidade, retries, erro parcial, rollback, privilégio administrativo, contas comuns negadas e economia Firestore. Entrega no localhost para aceite humano. Não disparar APIs produtivas nem publicar Rules/merge/deploy sem autorização específica.

**Por que ainda não existe no novo cadastro:** a UI atual `AdminCommercialCustomers` foi intencionalmente isolada em rascunhos locais, exige `workspaces/{id}` existente e não chama `/api/admin/provision-sector`. O motor de provisionamento é mais sensível (cria identidade Firebase e ambiente de setor); a criação conjunta deve respeitar proteção e recovery existentes.

**Estado desta conversa:** análise de viabilidade e registro documental; **NENHUMA IMPLEMENTAÇÃO FUNCIONAL DO ONBOARDING UNIFICADO** e nenhuma mudança em contas/workspaces/billing/Rules de produção. Próxima decisão: autorização explícita para desenvolver o fluxo no localhost/Emulator, sem deploy.

---

## MARCO ATUAL — CADASTRO UNIFICADO + ABA DE GESTÃO DO CLIENTE (18/10/2026)

**AUTORIZAÇÃO DO FUNDADOR:** desenvolver **um cadastro único** de Cliente Comercial + Workspace + conta operacional + trial padrão de 30 dias, mantendo **Gestão do cliente** em uma **aba específica** para alterar assinatura, editar contato e gerenciar assuntos administrativos do usuário.

**IMPLEMENTAÇÃO NA BRANCH ISOLADA / PR #339:**
- `lib/admin2/customers/unifiedCustomerOnboarding.ts`: valida e gera em conjunto Workspace, SectorAccount, cliente comercial `platformCustomers/{workspaceId}` e BillingAccount trial 30 dias/R$70, usando o domínio atual.
- `components/admin2/customers/AdminUnifiedCustomerCreate.tsx`: formulário de criação unificado, dados institucionais e de contato, credencial inicial *somente no formulário*, trial obrigatório; **preview comum simula localmente**, apaga senha do estado ao concluir e não chama serviços reais.
- `components/admin2/customers/AdminCustomerManagement.tsx`: aba **Gestão do cliente**, busca por ID, mostra dados do setor, vínculo comercial e billing; confirma ações de trial, plano ativo, isenção VIP, pendência e cancelamento, mostra histórico da sessão; edição comercial direcionada ao cadastro separado, Ficha 360 acessível. **Sem alteração real no localhost comum**. Quando Firebase Emulator demo-* está ligado, pode utilizar `lib/platformBillingStore.ts` para atualizar assinaturas no Emulator com auditoria, sem produção.
- `components/admin2/customers/AdminCustomersDirectory.tsx`: integra Diretório existente, Cadastro unificado, Gestão, Edição comercial e Ficha 360, preservando autenticação Google fundadora e visual V3.
- `components/admin2/customers/AdminCustomerDetailV2.tsx`: fichas simuladas leem billing do estado da prévia e **não fazem consultas reais de billing ou audit** para workspace fictício.
- `lib/sectorProvisioning.ts`: extensão **opcional** `commercialCustomer` ao contrato de provisionamento seguro, validando dados e impondo `grantTrial=true` no novo fluxo.
- `lib/server/sectorProvisioningAdmin.ts`: quando perfil comercial presente, acrescenta `platformCustomers/{workspaceId}` com `exists=false` ao **mesmo commit Firestore** que workspace, conta, UG/index, termCounter, billing e auditoria; rollback do caminho existente inclui comercial. Firebase Auth e Firestore **não são uma única transação**; preservar proteção/recovery.
- Testes versionados `scripts/admin2-unified-onboarding.test.mjs` e `scripts/admin2-unified-domain.test.mjs`, incluídos no Application CI. Testes de segurança comercial por Emulator preservados.
- **Documento detalhado do marco:** `docs/admin2/ONBOARDING_UNIFICADO_GESTAO_01.md`.

**LIMITAÇÃO/GATE:** não foi implementada a chamada da prévia para criar uma conta no Firebase Emulator; o formulário **é simulação em memória**, enquanto o código server-side foi preparado para futura integração real. Alterações de assinatura persistem **somente no Emulator** se configurado; nunca ativar o endpoint de provisionamento real a partir da prévia sem homologação/Auth+Firestore Emulator, testes de rollback, gate de segurança e autorização específica de deploy. Redefinição de senha, suspensão operacional e encerramento de sessão **permanecem ações desabilitadas** na nova aba até integração segura. Não confundir cancelamento comercial com bloqueio operacional.

**PRODUÇÃO:** `main`, Firebase real, workspaces, assinaturas, Rules, IAM, Google Drive, warehouse e deploy **intocados**.

**VALIDAÇÃO PENDENTE:** Application CI / Core Protection do HEAD, smoke humano do formulário e Gestão no localhost. Fundador ainda não aprovou a nova versão.

**PRÓXIMO PASSO SEQUENCIAL:** certificar CI; Fundador atualizar branch e validar três vistas (Diretório, Cadastro unificado, Gestão) e não vazamento de dados simulados; depois implementar **integração de provisionamento Auth+Firestore em Emulator** e testes de recuperação antes de liberar escrita real.

**HANDOFF:** ONDE ESTAMOS — nova UI unificada e gestão em abas implantadas somente na branch; O QUE ESTAMOS FAZENDO — QA estrutural e certificação; QUEM — chat executor; O QUE FAZER A SEGUIR — CI e localhost; QUEM FARÁ — executor testa, Fundador valida.

---

## 1. Fontes canônicas a reler em toda ativação de chat

1. **Este documento** \`docs/admin2/ADMIN_CORE_CONTINUIDADE_SEQUENCIAL.md\` na **branch ATIVA**, para conhecer o estágio e a última decisão.
2. \`docs/EMPROVEX_MEMORIAL_OFICIAL.md\` na mesma branch, sem presumir que a \`main\` já tenha as atualizações de desenvolvimento.
3. \`docs/ADMIN_2_0_PLANO_MESTRE_WORKERS.md\` — escopo/contratos CORE V2 e **decisão visual V3 no topo**. Partes históricas de execução paralela e sidebar recolhível estão **SUPERADAS** por este documento.
4. \`docs/ADMIN_2_0_MEMORIAL_DESENVOLVIMENTO.md\` — requisitos gerais e backlog histórico; prevalece a decisão de adiamento dos 3 objetivos.
5. \`docs/ADMIN_2_0_AUDITORIA_TECNICA_01.md\` — riscos técnicos históricos, não bloquear o CORE com G-1 interworkspace.
6. \`docs/admin2/LOCAL_SIDEBAR_PREVIEW.md\` — comandos de localhost.
7. \`docs/admin2/ADMIN_CORE_G0_KICKOFF.md\` na branch \`feat/admin2-core-integration\` — proposta **não congelada** de contratos para Cliente/Workspace/Billing/CRM; é referência, não autorização para usar a branch como área de trabalho.

## 2. Decisões do Fundador — congeladas

- **Visual V3 APROVADO:** cabeçalho escuro com marca EMPROVEX Command; **sidebar escura fixa e não recolhível** à esquerda, 288 px, com ícone+rótulo, scrollbar premium e menu móvel drawer; **área de conteúdo clara**, gradientes azulados delicados, cartões claros, cores específicas por KPI (azul/teal/verde/âmbar), Montserrat, motion acessível.
- **Método APROVADO:** desenvolvimento **sequencial** conduzido pelo mesmo chat até ele atingir limite; novo chat é ativado com prompt padrão e leitura do GitHub/memorial; **cada avanço deve ser examinado no localhost pelo Fundador ANTES da próxima etapa**.
- **ESCOPO CORE V2 (13 capacidades):** administração SaaS, Clientes 360° administrativos, cadastro/onboarding, billing/financeiro, CRM/atendimento, dashboard/indicadores, consumo/cotas, sessões, backups, segurança e auditoria; Firestore econômico e compatibilidade.
- **ADIADOS:** (1) entrar e modificar registros operacionais dos workspaces externos, (2) operar depósitos de outros setores, (3) acessar arquivos privados Google Drive dos clientes. Não implementar, nem prometer essas funções.
- **PRODUÇÃO:** \`emprovex.com.br\`, workspaces de usuários, Firestore/warehouse, Rules, deploys, credenciais e dados reais não devem ser modificados por implementação, teste ou preview sem autorização expressa; não fazer merge na \`main\` por conta própria.
- **BILLING:** R$70/mês/workspace, VIP legado isento, trial padrão 30 dias, modo observe, Pix/link externo com confirmação manual e sem suspensão automática por inadimplência.
- **Qualidade:** não chamar mock de funcionalidade real; user normal sem acesso ao Admin; sem regressão do admin operacional existente; sem novas leituras globais evitáveis no Firestore.

## 3. Implementado e evidenciado

- Branch e PR DRAFT #339, rota local \`app/admin2-preview/page.tsx\` **somente em \`NODE_ENV=development\`**, retorna 404 fora de dev; URL \`http://localhost:3001/admin2-preview\`.
- Shell \`components/admin2/shell/AdminCommandSidebar.tsx\` + \`.module.css\`: navegação hierárquica, posição fixa, ícones, scrollbar customizada, estado ativo, drawer mobile.
- \`components/admin2/shell/AdminCommandPreview.tsx\` + \`.module.css\`: header e canvas claro, cards e protótipos de Visão geral/Clientes, navegação \`?area=\`, pesquisa local com **quatro clientes fictícios**.
- \`scripts/admin2-sidebar-preview.test.mjs\`: testes estruturais da prévia.
- Último SHA citado passou Application CI e Core Protection conforme GitHub; não houve teste de integração de dados reais nem publicação.
- Os componentes Admin **antigos continuam inalterados** e funcionando na main; a nova interface não está conectada aos serviços de Admin existentes.

## 4. Próximo marco recomendável: G0 + primeira tela REAL de Clientes

**PRÓXIMA ENTREGA A VALIDAR NO LOCALHOST:**
1. Analisar \`lib/platformIdentity.ts\`, \`lib/platformAdminStore.ts\`, \`hooks/usePlatformAdminDirectory.ts\`, \`lib/server/sectorProvisioningAdmin.ts\`, \`lib/billing.ts\`, \`lib/platformBillingStore.ts\` e Firestore Rules, sem alterá-los automaticamente.
2. Definir contrato mínimo real e retrocompatível de Cliente/OM/UG/Workspace; \`Customer\` comercial **NÃO** é sinônimo de OM/sector/workspace. Os metadados operacionais atuais continuam fonte autoritativa.
3. Criar uma tela administrativa \`Clientes\` com leitura **somente dos metadados já autorizados** (backend/Admin Auth ou emulador de dados sintéticos até a autenticação ficar segura), filtros e paginação; evitar listener de todo o banco. Proteger autenticação; jamais apresentar clientes fictícios como reais.
4. Testar unitariamente, typecheck, CI, Core Protection, negativas multi-tenant, ausência de alteração de Firestore e medir consultas. Mocks só para prévia declarada; rota de laboratório nunca deve acessar produção inadvertidamente.
5. Disponibilizar URL do localhost e comandos PowerShell curtos para atualizar a branch; receber validação do Fundador antes de ir ao próximo módulo.

**IMPORTANTE:** o protótipo /admin2-preview continua totalmente local/sem autenticação. Para telas com dados reais, não tornar a rota demonstrativa pública nem carregar dados de usuários sem um gate de autenticação administrativo seguro; adotar Emulator/QA com dados sintéticos até o mecanismo de autorização ser certificado.

## 5. Política de execução a cada turno — SEM WORKERS PARALELOS

1. Antes de codificar, **ler este memorial na branch, verificar HEAD, PR #339, \`main\` e últimos resultados de CI**, sem confiar cegamente em resumos históricos.
2. Definir uma etapa pequena, com saída visível e reversível; executar diretamente no GitHub via conector, com ownership dos arquivos e sem modificar outro projeto/release.
3. Rodar testes compatíveis com o risco. Quando GitHub Actions ainda não concluiu, informar "pendente", não declarar PASS.
4. Fornecer os comandos PowerShell no diretório local usado pelo Fundador, de preferência \`$HOME\\emprovex-admin2-preview\`, com \`git pull --ff-only origin feat/admin2-w01-sidebar-local-preview\`, \`npm.cmd run dev -- --port 3001\`, \`http://localhost:3001/admin2-preview\`, adaptando nova rota se existir. Não alegar acesso direto ao localhost do usuário.
5. **PARAR no ponto de validação visual/funcional humana** quando apropriado, aguardando feedback em vez de emendar outra fase automaticamente.
6. Registrar aqui **ao final de CADA marco**: data, o que mudou, decisões, branch, último SHA, arquivos, teste CI/QA com evidência, URL local, bloqueios, próximo passo e ambiente produtivo intacto. Complementar o Memorial Oficial na mesma branch se a decisão alterar produto/escopo/arquitetura.
7. Se o chat estiver perto do limite, atualizar este memorial primeiro, produzir **handoff consolidado** e orientar iniciar novo chat com prompt padrão. Nunca depender exclusivamente da memória do chat.
8. Atualizações do memorial permanecem **na branch isolada** durante desenvolvimento para não acionar publicação ao fazer commits na \`main\`. O Memorial Oficial da \`main\` será reconciliado por PR/merge explicitamente aprovado antes da release.

## 6. Handoff para início do próximo chat

**ONDE ESTAMOS:** Visual V3 aprovado e implementado no protótipo local, branch \`feat/admin2-w01-sidebar-local-preview\`, PR DRAFT #339, CI/Application CI e Core Protection PASS no último SHA registrado; G0 ainda não congelado, dados e clientes da prévia ainda fictícios. PR #340 é um registro de coordenação paralelo anterior, **estacionado**.

**O QUE ESTAMOS FAZENDO:** mudança formal do fluxo para **um único chat sequencial**, com commits na branch do localhost e validação humana a cada módulo, atualização persistente do memorial.

**QUEM ESTÁ FAZENDO:** o chat ChatGPT executor vigente, com acesso GitHub; Fundador executa/inspeciona \`localhost\` no próprio Windows.

**O QUE FAZER A SEGUIR:** iniciar contrato G0 mínimo Cliente/Workspace e o primeiro diretório administrativo funcional sem dados fictícios apresentados como reais, protegido e econômico; não alterar dados de produção.

**QUEM O FARÁ:** próximo chat executor ou chat atual, com validação do Fundador depois da entrega.

**ESTADO:** não foi iniciado backend real da Admin 2.0 nem liberada produção. A aprovação visual **não** é GO para deploy.
