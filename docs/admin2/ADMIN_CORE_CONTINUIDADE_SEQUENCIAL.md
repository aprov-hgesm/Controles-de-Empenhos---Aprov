# EMPROVEX — ADMIN 2.0 CORE V2
## Memorial de continuidade — desenvolvimento SEQUENCIAL no mesmo chat ou em sucessores

**Atualização de método:** 2026-10-18, por decisão expressa do Fundador.
**Status:** Direção visual V3 **aprovada**; **Clientes 360° V1 read-only aprovada pelo Fundador no localhost**, com Application CI e Core Protection PASS no último código inspecionado; próxima etapa Ficha 360° V2 ainda não implementada. Demais módulos continuam demonstrativos.
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
