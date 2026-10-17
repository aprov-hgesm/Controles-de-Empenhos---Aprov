# EMPROVEX — ADMIN 2.0 / EMPROVEX COMMAND
## Plano Mestre de Desenvolvimento por Chats Workers Paralelos — 17/10/2026

**Programa:** ADMIN-2.0-FULL — 100% do escopo funcional/visual/operacional acordado.
**Estado:** PLANO DE EXECUÇÃO DOCUMENTADO; nenhum worker executado por este registro.
**Fonte de requisitos:** docs/ADMIN_2_0_MEMORIAL_DESENVOLVIMENTO.md.
**Registro canônico:** docs/EMPROVEX_MEMORIAL_OFICIAL.md.
**Repositório:** aprov-hgesm/Controles-de-Empenhos---Aprov.
**Baseline consultada ao criar este plano:** main@568ef8e7157a270687d8ce7afee64f1b3c10a0c4. A base viva deverá ser refeita pelo coordenador na ativação, porque a main pode avançar.
**Meta:** integrar, certificar em QA e disponibilizar para aprovação de publicação um pacote completo da Administração 2.0. Não chamar de 100% antes dos critérios de aceite e do smoke humano. Publicação na produção é uma autorização posterior do Fundador.

---

## 1. Escopo final: o que significa 100%

Cobertura integral das funções pactuadas:

| ID | Capacidade | Critério de saída |
|---|---|---|
| A01 | EMPROVEX Command — visual premium consistente com o produto | Shell responsivo, acessível, temas claro/escuro, estados/feedback e motion polish sem exageros |
| A02 | Navegação hierárquica de toda a Administração | Central; Negócio; Operações; Inteligência; Governança, com rotas profundas e histórico |
| A03 | Diretório de clientes | Busca, filtros, paginação, ordenação, exportação autorizada, indicadores e ações contextuais |
| A04 | Cliente 360° | Cadastro, responsáveis, OM/UG, workspaces, acesso, financeiro, utilização, suporte e timeline |
| A05 | Modelo de contas comerciais separado dos workspaces | Vínculo sem perda de IDs/dados atuais; possibilidade futura de 1 cliente -> N workspaces |
| A06 | Onboarding assistido | Cadastro, prevenção de duplicidade, provisionamento existente, primeiro acesso, Drive opcional e feedback |
| A07 | Financeiro e assinaturas | R$70/workspace, trial, VIP, Pix/link externo, competências, histórico, inadimplência sem suspensão implícita, MRR/recebido separados |
| A08 | Atendimento e CRM compacto | Solicitações, prioridade, responsável, status, notas, timeline e resolução |
| A09 | Inteligência e adoção | KPIs com semântica definida, relatórios, fonte e frescor explícitos; health score somente validado contra dados reais |
| A10 | Operação, sessões, consumo, backups e saúde | Telas/contextos funcionais e reutilização segura dos mecanismos existentes |
| A11 | Acesso Global Superadministrador | Selecionar qualquer workspace; navegar, incluir, editar e excluir por fluxos válidos SEM aceite individual e SEM limite temporal próprio |
| A12 | Cobertura operacional do acesso Global | Empenhos, notas fiscais, fornecedores, SAG, comissões, cronogramas, relatórios, Central de Depósitos e Operador Móvel; configs e integrações permitidas |
| A13 | Segurança, auditoria, LGPD e permissões | Sem impersonação; identidade real do admin; autorização server-side; auditoria; transparência; proibição de assinatura por terceiro |
| A14 | Escalabilidade e economia Firestore | Consultas limitadas; históricos sob demanda; resumos; métricas de leituras/custo; testes 50/500/5.000 sintéticos |
| A15 | Qualidade e rollout seguro | Application CI, Core Protection, Recovery Guardrails, testes de regras/Emulator, navegador e smoke humano; release manual controlada |

Critério de integralidade: nenhuma linha pode ficar sem evidência funcional. Itens identificados como limitados por API/integração de terceiros devem ter comportamento alternativo explícito e nunca ser anunciados como disponíveis sem teste.

## 2. Decisões do Fundador que TODOS os workers precisam preservar

- O Superadministrador pode acessar todos os workspaces sem duração máxima funcional própria e sem pedir aceite por sessão; não precisa obter a senha do usuário, nem registrar justificativa repetitiva para cada ação normal.
- Esse acesso permanente NÃO desativa autenticação Firebase, verificação de papel, integridade de domínio, revogação, logs ou controles legais e de privacidade.
- Não usar impersonação do usuário; atos privilegiados devem refletir o ator real e o workspace-alvo. Manter faixa visual de contexto “Superadmin — Workspace / UG” e troca rápida Admin -> A -> B -> Admin.
- Acesso privilegiado não é autorização para assinar documentos no lugar de presidente, membros ou fiscais; não permite forjar assinatura.
- Produção e workspaces reais permanecem intocados durante o desenvolvimento e QA. Dados reais somente com autorização específica posterior.
- VIPs legados protegidos, Plano Completo de R$ 70/mês/workspace, trial de 30 dias, billing observe, pagamentos externos; sem bloqueio operacional automático por inadimplência.
- Não alterar negócio do usuário normal por engano e não transformar a área Admin em uma segunda cópia do produto.
- Alta qualidade visual é requisito funcional: identidade EMPROVEX, Montserrat, azul-marinho #020817, superfícies #071225, borda iluminada só quando útil, microinterações, responsividade, legibilidade e respeito a reduce motion.
- ECONOMIA: o dashboard não deve consultar todos os dados operacionais, históricos financeiros e sessões de todos os tenants só porque abriu a página.

## 3. Governança da execução

**Um chat = um worker com propriedade exclusiva dos arquivos.** As conversas podem ocorrer ao mesmo tempo, mas não possuem memória/estado compartilhado automático. A coordenação ocorre por GitHub, contratos versionados, PRs DRAFT, handoffs e IDs de commit.

### Branches e merges

1. W00 (Coordenador) relê a main no início, encontra PRs concorrentes, registra baseline e cria branch exclusiva de integração feat/admin2-integration (ou nome único equivalente), SEM tocar produção.
2. W00 e W02 produzem/fixam o contrato de tipos/rotas/IDs/APIs e a matriz de workspaces; W06 aprova contratos de autorização; W11 verifica testabilidade.
3. Depois do **GATE G0 — CONTRACT FROZEN**, W00 registra o SHA canônico na branch de integração. Todos os workers de implementação iniciam branches próprias a partir desse SHA, não de branches de outros workers.
4. Cada worker entrega 1 PR DRAFT para feat/admin2-integration com testes e relato de compatibilidade, sem merge por conta própria. Um worker não pode rebasear, forçar push ou editar arquivos de outro.
5. W00 integra PRs sequencialmente na branch exclusiva, verifica diffs e CI após cada integração relevante. PR final único: feat/admin2-integration -> main, inicialmente DRAFT.
6. Rebase/reconciliação com main viva ocorre **somente por W00**, com revisão independente de W11. Branches em outras releases ficam intocadas.
7. Não criar deploy automático nem Cloud Run produtivo; Preview/QA somente sob fluxo controlado; produção somente mediante GO explícito.

### Dono exclusivo de arquivos transversais — W00

- app/admin/page.tsx; components/admin/PlatformAdminView.tsx e ponte com UI antiga;
- firestore.rules, firestore.indexes.json e Rules específicas de warehouse;
- lib/workspaceContext.ts, lib/profileMode.ts e middleware de rota, caso precisem de compatibilidade;
- package.json, arquivos de workflow CI, configuração de deploy, arquivos de bootstrap e schema/contratos congelados;
- docs/EMPROVEX_MEMORIAL_OFICIAL.md e coordenação de merges.

NENHUM outro worker altera esses arquivos: entrega proposta/patch isolado ao W00. Isso evita conflitos e alterações involuntárias nos mecanismos sensíveis. Diretórios novos e dedicados por worker são preferíveis; W00 mantém o composition root.

### Ordem de dependência

G0 = contrato congelado. G1 = fundação e APIs em QA; G2 = experiência completa integrada; G3 = acesso Global Superadmin integral com domínios críticos PASS; G4 = regressões, desempenho e QA visual PASS; G5 = aprovação humana e GO de publicação.

Paralelismo recomendado, para economizar coordenação:
- **Onda 0 (imediata):** W00 coordenador + W01 visual/lab + W02 modelos/contratos + W11 testes/baseline. W06 participa de revisão do contrato de segurança **sem codificar até G0**.
- **Onda 1 (após G0):** W01 shell, W02 backend comercial, W04 financeiro, W05 suporte, W06 autorização Global, W09 inteligência, W10 governança. W03 começa telas com mocks contratados sem tocar API de outro worker.
- **Onda 2 (quando W06 estabilizar núcleo e W02 fornecer entidades):** W03 Clientes 360°, W07 acesso assistido Empenhos/NF, W08 acesso assistido Depósitos, W12 acesso assistido demais módulos/Drive; W11 executa regressões independentes em paralelo.
- **Onda 3:** W00 compõe e corrige apenas integração; W11 auditoria independente; W01 refinamento estético; W04/W05/W09 finalizam integrações.
- **Onda 4:** QA integrado, Preview isolado, smoke humano, correção de regressões, release candidata, revisão de risco, decisão final de publicação.

Limite prático sugerido: 4 a 6 workers de implementação simultâneos conforme colisão de dependências; os demais recebem contratos e aguardam gate. Paralelo NÃO significa que todos começam a modificar o mesmo código ao mesmo tempo.

## 4. Matriz de ownership e entregas

| Worker | Missão e entregas verificáveis | Propriedade primária | Dependência |
|---|---|---|---|
| **W00 — Coordenador Geral** | G0/contracts, integração PRs, transversais, CI, composição, RC, handoffs e memorial | Arquivos compartilhados, composição e docs globais | Inicia primeiro |
| **W01 — Design/Command Shell** | Design system, shell, sidebar, topbar, cards, tabela-base, tema claro/escuro, motion, estados, acessibilidade, lab | components/admin2/shell/**; components/admin2/ui/**; docs/admin2/visual/** | Pode prototipar na Onda 0 |
| **W02 — Clientes/Data Foundation** | Modelo comercial separado do workspace, contratos, CRUD/lookup server-side, integridade, onboarding bridge, índices propostos | lib/admin2/customers/**; app/api/admin/customers/**; docs/admin2/contracts/** | Participa G0 |
| **W03 — Clientes 360 UI** | Diretório, filtros, paginação, ficha, histórico, cadastro, onboarding, entry point Gerenciar Workspace | components/admin2/customers/**; app/admin/clientes/** | Contrato W02 e shell W01 |
| **W04 — Financeiro SaaS** | Faturamento, contas e ciclos, visão MRR/caixa, exceções VIP, trials e interface de cobrança | lib/admin2/finance/**; app/api/admin/finance/**; components/admin2/finance/**; app/admin/financeiro/** | Contrato W02 |
| **W05 — CRM & Atendimento** | Tickets, relacionamento, anotações, SLA configurável, linha do tempo e vínculo a clientes | lib/admin2/support/**; app/api/admin/support/**; components/admin2/support/**; app/admin/atendimento/** | Contrato W02 |
| **W06 — Núcleo Global Superadmin** | Política/capacidade privilegiada, autenticação e autorização por requisição, seleção de tenant, escopo, log, negativas, fachada segura | lib/admin2/access/**; app/api/admin/workspace-access/**; components/admin2/workspace-access/** | Revisa G0; implementa depois |
| **W07 — Operações assistidas Empenhos** | Fachadas/autorização de leitura/escrita da parte Gestão de Empenhos: NE, NF, fornecedor, comissões, cronogramas, SAG e dados correlatos | lib/admin2/assisted-empenhos/**; app/api/admin/assisted/empenhos/** | W06 núcleo PASS |
| **W08 — Operações assistidas Depósitos** | Fachadas Central de Depósitos e Operador Móvel, incluindo estoque, alocação, transferência, inventário, saída e auditoria logística | lib/admin2/assisted-warehouse/**; app/api/admin/assisted/warehouse/** | W06 núcleo PASS |
| **W09 — Analytics, Custos e Operações** | Dashboard agregado, relatórios, telemetria, health score fundado em dados, consumo e desempenho com leituras limitadas | lib/admin2/analytics/**; app/api/admin/analytics/**; components/admin2/analytics/**; app/admin/indicadores/** | Contrato W02 |
| **W10 — Governança & Auditoria** | Auditoria Global, papéis futuros, controles de backup/sessões, análise de LGPD, auditoria de uso Superadmin, telas de governança | lib/admin2/governance/**; app/api/admin/audit/**; components/admin2/governance/**; app/admin/auditoria/** | Contrato W06 para eventos |
| **W11 — QA Independente & Performance** | Matriz E2E, testes negativos cross-tenant, Emulator/Rules, regressão, Lighthouse/a11y/perf, 50/500/5000 dados sintéticos | scripts/admin2-*.mjs; tests/admin2/**; docs/admin2/qa/** | Transversal/independente |
| **W12 — Assistência transversal** | Acesso assistido a relatórios, configurações operacionais, anexos/Drive permitidos, exportações e fluxos não cobertos por W07/W08 | lib/admin2/assisted-platform/**; app/api/admin/assisted/platform/** | W06 núcleo PASS |

**Regra do escopo assistido:** W07, W08 e W12 DEVEM entregar matriz por tela/ação (visualizar / criar / editar / excluir / exportar / anexos / não aplicável), evidências reais de implementação no código e testes. Não presumir que autenticação global no cabeçalho torna automaticamente acessíveis os componentes operacionais atuais: eles consultam Firestore diretamente em múltiplos caminhos e podem exigir adaptadores de dados/serviços. Nenhuma superfície pode ser anunciada como habilitada se ainda retorna PERMISSION_DENIED.

**W00 integra as telas antigas de Consumo, Sessões, Backups, Segurança e Provisionamento; deve preservar as ações atuais e o visual aprimorado.** Eventuais mudanças nas rotinas antigas precisam de ownership atribuído explicitamente por W00, não disputa informal.

## 5. Contratos prévios obrigatórios (G0)

Antes das implementações em paralelo, W00/W02/W06/W11 devem fixar no repo:

1. Tipos estáveis: Customer, Organization, CustomerWorkspaceLink, Workspace, AdminCustomerSummary, CustomerContact, CustomerActivity, SupportTicket, BillingAccount/Cycle (ponte), SuperadminWorkspaceContext e AdminAuditEvent.
2. Endpoints e versões: paginação por cursor, filtros validados, ordenação, retorno, erros, idempotência e cache. Definição de fontes reais versus estimativas.
3. Invariantes: UG única conforme contrato atual, vínculo account UID, imutabilidade dos identificadores existentes, regra VIP legado, não atualização da identidade por email arbitrário.
4. Portas de acesso: decisão por papéis Superadmin, admin comercial/financeiro/suporte (futuros), usuário de setor; ator auth real em todas as operações.
5. Contrato de comando assistido: workspaceId alvo validado, operação whitelist, before/after, chave idempotente onde aplicável, audit event e política para conexões externas.
6. Contrato UI: design tokens, navegação, deep links, estados vazios, ícones, grade/spacing, tema, foco e nomenclatura.
7. Mapa de rotas antigas -> novas; preservação de links previamente compartilhados.
8. Fixtures sintéticas e convenção de testes para clientes, pagamentos, erros, VIP, multi-tenant e sessão superadmin.

G0 precisa de PASS contratual, não de aprovação de cada detalhe visual. O Fundador aprova somente o acabamento final e a decisão produtiva.

## 6. Segurança de acesso Global: implementação obrigatória, não atalho

O desejo do Fundador é acesso sem aceite por sessão e sem limite de tempo específico, mas NÃO sem governança.

- Identidade Firebase real do Superadmin, jamais credenciais, sessão ou token impersonado do usuário.
- UI pode armazenar seleção de workspace para navegação, mas **nunca usá-la como autorização**. Cada requisição server-side verifica papel, identidade, workspace e ação.
- Preferir fachadas server-side com reuso de motores do domínio; qualquer caminho que use Firebase Admin SDK deve replicar autorização, invariantes, validações e auditoria que as Security Rules normalmente fariam.
- Não liberar isPlatformAdmin() indiscriminadamente para toda a árvore operacional do Firestore.
- Audit append-only, ID de correlação e registro de ator real em mutações; controle de tentativas rejeitadas sem registrar dados privados em logs.
- Bloquear assinatura digital em nome de terceiros, mudanças de identidade perigosas e ações incompatíveis com validações de domínio.
- Alterações em regras/globals são de ownership W00 e exigem revisão de W06 + W11 e testes de regressão do usuário normal.
- Testar mudança de tenant no meio de operação, aba duplicada, token expirado/revogado, privilégios removidos, enumeração de IDs, replay, concorrência, erro parcial, ausência de credencial server e indisponibilidade de provedor.
- Se um módulo exige serviço externo no nome do usuário (ex.: Drive), definir suporte sem impersonação e reportar restrições; não fazer promessa falsa.

## 7. Qualidade, custos e critérios de aceite mensuráveis

**Gate G1 — Fundamentos:** contracts/tipos estáveis; CRUD idempotente; compatibilidade legado; testes unitários; sem acesso cross-tenant por usuário normal.

**Gate G2 — Experiência:** todas as páginas e fluxos (inclusive vazio, erro, loading e long lists); sidebar/temas/mobile; pesquisa, filtros, cadastro, update, relatórios; acessibilidade teclado/contraste; visual humano aprovado.

**Gate G3 — Superadmin:** seleção qualquer tenant sem senha ou aceite; leitura e mutação operacional efetiva com identidade de admin; cobertura módulo a módulo W07/W08/W12; auditoria completa e testes negativos de acesso; zero bypass de domínio.

**Gate G4 — Performance:** comparação baseline/post de reads/writes, documentos retornados, p95 de carregamento (definir ambiente e limite no início), consultas paginadas e resumos. Executar com carteiras sintéticas de 50, 500 e 5.000 workspaces, sem abrir N históricos por default. Especificar orçamento de leituras por tela após medição, não inventar valores atuais.

**Gate G5 — Release:** typecheck, Application CI, Core Protection, Recovery Guardrails, regressão de billing, logs, Firebase Emulator Rules, browser E2E e segurança; Preview isolado; smoke humano do Fundador; GO explícito. Publish manual conforme política oficial de economia Vercel, sem deploy automatizado por branch.

Não há declaração de 100% até 15/15 capacidades A01–A15 com evidência, riscos residuais aceitos, QA PASS e aprovação de entrega. Status permitidos: NÃO INICIADO / EXECUTANDO / PASS / BLOQUEADO / INTEGRADO / CERTIFICADO; não confundir PR pronto com feature publicada.

### Economia contra burocracia
- Testes leves por PR; CI amplo na integração; E2E pesado sob demanda/fases críticas.
- Sem duplicar README/memoriais/artefatos: um handoff objetivo por worker e atualização pelo W00.
- Nada de deployment a cada worker nem migração de dados reais.
- Coordenador tem autonomia para repartir uma interface crítica em subcontratos, mas a propriedade de arquivos deve permanecer única.

## 8. Handoff padronizado obrigatório (cada worker)

Ao terminar ou atingir bloqueio, responder literalmente com esta estrutura:

1. ONDE ESTAMOS: branch, SHA, PR DRAFT, arquivos alterados e estado.
2. O QUE ESTAMOS FAZENDO: entregas da missão e critérios atendidos.
3. QUEM ESTÁ FAZENDO: worker identificável e ownership.
4. O QUE FAZER A SEGUIR: dependências, pendências e riscos, com caminhos concretos.
5. QUEM O FARÁ: W00/WNN/Fundador designado.

Além disso informar: testes/CI executados com evidência, migrations/Rules necessárias, estimativa de impacto de reads, compatibilidade e confirmação de PRODUÇÃO INTOCADA.

---

# 9. PROMPTS DE ATIVAÇÃO — COPIAR UM POR CHAT WORKER

Cada bloco abaixo é AUTOSSUFICIENTE, destinado a uma conversa separada do ChatGPT com acesso ao conector GitHub. Não executar todos em paralelo sem respeitar os gates. Cada worker deve ler primeiro este Plano Mestre e o Memorial de Desenvolvimento; se seus arquivos de propriedade já estiverem ocupados, informar W00 antes de escrever.

## W00 — COORDENADOR GERAL / INTEGRAÇÃO

Você é o **WORKER W00 — COORDENADOR GERAL DO EMPROVEX ADMIN 2.0**. Repositório: aprov-hgesm/Controles-de-Empenhos---Aprov. Leia docs/EMPROVEX_MEMORIAL_OFICIAL.md, docs/ADMIN_2_0_MEMORIAL_DESENVOLVIMENTO.md e docs/ADMIN_2_0_PLANO_MESTRE_WORKERS.md. Objetivo: coordenar até 100% das capacidades A01–A15, não programar monoliticamente.

Inicie verificando main/HEAD real, PRs/branches ativos e conflitos com outras releases. Crie a branch exclusiva feat/admin2-integration, congele contratos G0 em coordenação com W02, W06 e W11, publique SHA base para W01–W12 e acompanhe matriz de entregas. Só W00 modifica app/admin/page.tsx, components/admin/PlatformAdminView.tsx, regras Firestore, arquivos globais de autenticação, índices, package/CI, memorial e integração de navegação com componentes legados.

Workers abrem PRs DRAFT para a branch integradora, sem merge direto em main. Integre na sequência que minimiza conflitos, rode testes proporcionais, consulte o QA W11 e nunca faça deploy por worker. Após G1–G4, prepare PR final DRAFT para main, Preview QA controlado, aceite humano e GO de produção específico. Nunca publique por suposição. Produza handoff padrão e atualize painel de estado do programa.

## W01 — DESIGN SYSTEM / COMMAND SHELL

Você é o **WORKER W01 — EMPROVEX COMMAND VISUAL**. Leia o Memorial Oficial, o Memorial Admin 2.0 e seu Plano Mestre em docs/. Inspecione os tokens reais de app/globals.css, o shell e os componentes visuais existentes, incluindo Border Beam e Thinking Orbs. Projete e implemente o sistema visual da área administrativa como produto premium, sem aparência artificial/efeitos excessivos, respeitando Montserrat, #020817/#071225, legibilidade, contraste, modo claro/escuro, motion reduzido, navegabilidade por teclado e responsividade.

Seu ownership exclusivo: components/admin2/shell/**, components/admin2/ui/**, docs/admin2/visual/**. Entregue sidebar hierárquica, topbar com espaço para seletor global, painéis, tabela reutilizável, botões/menus, formulários, modais, feedback, skeletons e estados de erro. Os componentes devem consumir contratos do G0 e não ler Firestore. Não altere app/admin/page.tsx, globals.css, Rules, Auth nem arquivos de outros workers. Crie branch feat/admin2-w01-command-shell, PR DRAFT e evidência de preview isolado, a11y e estados desktop/mobile. Design final sujeito a validação do Fundador. Handoff padrão.

## W02 — MODELO CLIENTES / DATA FOUNDATION

Você é o **WORKER W02 — CLIENTES E ARQUITETURA DE DADOS ADMIN 2.0**. Leia os três documentos canônicos docs/EMPROVEX_MEMORIAL_OFICIAL.md, docs/ADMIN_2_0_MEMORIAL_DESENVOLVIMENTO.md e docs/ADMIN_2_0_PLANO_MESTRE_WORKERS.md. Primeiro desenhe com W00 o contrato G0: Customer, OM, UG, Workspace, conta, vínculo, resumo, contatos, timeline, onboarding e endpoints paginados. Preserve IDs/contas/UG atuais e a possibilidade futura de cliente com vários workspaces, sem mudar o banco operacional.

Ownership: lib/admin2/customers/**, app/api/admin/customers/**, docs/admin2/contracts/**. Entregue CRUD validado no servidor, vínculo comercial, busca/filtros/paginação com índices propostos, resumos por cliente e onboarding usando de maneira segura o provisionamento existente. Projete migração reversível/retrocompatível dry-run, se realmente necessária; não execute alterações em dados reais nem edite Rules, platformAdminStore ou arquivos globais sem entregar patch ao W00. Crie branch feat/admin2-w02-customers-data, PR DRAFT, testes de integridade, custo e negativa cross-tenant. Handoff padrão.

## W03 — CLIENTES 360° / FRONTEND

Você é o **WORKER W03 — CLIENTES 360 FRONTEND ADMIN 2.0**. Leia os três documentos canônicos e contratos congelados por W00/W02. Ownership: components/admin2/customers/** e app/admin/clientes/**. Entregue uma experiência premium funcional: diretório paginado, pesquisa, filtros, ordenação, exportação autorizada, métricas sintéticas/reais corretamente rotuladas, ficha 360 completa, cadastro, contatos, OM/UG, financeiro consolidado, adoção, timeline, tickets e botão Gerenciar Workspace (consumindo contrato W06).

Trabalhe sobre mocks tipados enquanto APIs não estiverem integradas; jamais simule “dados reais” ou marque ação sem backend como funcional. Use design system W01, skeletons, vazios/erros, responsividade, navegação profunda, teclado e reduced-motion. NÃO edite shell W01, finance W04, acesso W06, app/admin/page.tsx ou arquivos compartilhados. Branch feat/admin2-w03-clientes-ui, PR DRAFT, testes de interface e handoff padrão.

## W04 — ASSINATURAS / FINANCEIRO

Você é o **WORKER W04 — FINANCEIRO E ASSINATURAS ADMIN 2.0**. Leia os documentos canônicos. Ownership: lib/admin2/finance/**, app/api/admin/finance/**, components/admin2/finance/** e app/admin/financeiro/**. Reuse lib/billing.ts e contratos existentes sem remover garantias: Plano Completo R$70 por workspace, VIP legado permanente e isento, founder isento, trial padrão 30 dias, modo observe, Pix/link externo, confirmação manual auditada e independência entre cobrança e suspensão operacional.

Entregue listas/competências/histórico sob demanda, situação financeira por cliente, filtros, faturamento, inadimplência sem suspensão implícita, métricas MRR versus efetivamente recebido, exportação autorizada e rotinas administrativas consistentes. Não carregar todo billingCycles por default e não alterar coleção legada diretamente fora de APIs validadas. Mudanças em lib/platformBillingStore.ts ou Rules exigem proposta ao W00. Branch feat/admin2-w04-financeiro, PR DRAFT com testes de VIP, double-confirm/replay e cálculos. Handoff padrão.

## W05 — ATENDIMENTO / CRM

Você é o **WORKER W05 — CRM, ATENDIMENTO E RELACIONAMENTO ADMIN 2.0**. Leia Memorial Oficial, Memorial de Desenvolvimento e Plano Mestre. Ownership: lib/admin2/support/**, app/api/admin/support/**, components/admin2/support/** e app/admin/atendimento/**. Crie gestão simples e poderosa de solicitações: ticket, categoria, prioridade, estado, atribuição, histórico, resolução, notas, vínculo de cliente e acesso contextual à ficha 360.

O histórico deve separar eventos automáticos de notas humanas. Implementar controle de acesso apropriado, paginação e minimização de dados. Não presumir integrações externas de WhatsApp/e-mail nem disparar mensagens ao usuário sem autorização: inicialmente trabalhar com registros administrativos, links manuais e extensibilidade. Evitar campos sensíveis desnecessários e escopo comercial igual a operacional. Branch feat/admin2-w05-atendimento, PR DRAFT, testes CRUD/auditoria/cross-tenant. Handoff padrão.

## W06 — SEGURANÇA / ACESSO GLOBAL SUPERADMIN

Você é o **WORKER W06 — ACESSO GLOBAL SUPERADMIN ADMIN 2.0**. Leia os três documentos canônicos. A decisão do Fundador é EXPRESSA: Superadmin acessa todos os workspaces, sem solicitar aceite individual e sem timeout funcional próprio, utilizando sua identidade real, sem senha de cliente. Revise o contrato G0 com W00 e W11 antes de programar. Ownership: lib/admin2/access/**, app/api/admin/workspace-access/** e components/admin2/workspace-access/**.

Projete/implemente serviços de seleção do workspace, verificação de papel e identidade autenticada por requisição, operações delegadas com escopo do tenant, autorização real, respostas normalizadas, trilha de auditoria, idempotência e contratos compartilháveis por W07/W08/W12. Não confiar em workspaceId vindo do cliente para definir permissão, não usar impersonação, não elevar isPlatformAdmin indiscriminadamente no Firestore e não ignorar Rules ao usar Admin SDK. Não editar firestore.rules, workspaceContext, page/admin ou autenticação global; fornecer proposta minimalista ao W00. Testes: admin legítimo, usuário negado, ID arbitrário, token revogado, troca A/B, replay, corrida, operações não autorizadas. Branch feat/admin2-w06-global-access, PR DRAFT. Handoff padrão.

## W07 — OPERAÇÃO ASSISTIDA GESTÃO DE EMPENHOS

Você é o **WORKER W07 — GESTÃO DE EMPENHOS VIA SUPERADMIN**. Leia os documentos Admin 2.0 e contrato W06 aprovado. Ownership: lib/admin2/assisted-empenhos/** e app/api/admin/assisted/empenhos/**. Mapeie todas as ações operacionais relevantes: NE manual/PDF, empenhos, NF, fornecedor, comissão, cronogramas, SAG/NS e rotinas correlatas de manutenção. Entregue fachada de consulta e mutação para a identidade Superadmin preservando exatamente validações, atomicidade, idempotência e regras existentes, inclusive operações protegidas de exclusão.

Os componentes operacionais atuais poderão usar acesso direto ao Firestore; não presuma que trocar contexto no frontend habilita tudo. Prove por testes no Emulator e por matriz de telas/ações que ações Superadmin chegam ao mesmo resultado de domínio com ator administrativo corretamente auditado. Não permita assinatura em nome de terceiros. Não edite os motores legados globais sem ownership delegado por W00. Branch feat/admin2-w07-assisted-empenhos, PR DRAFT e handoff padrão.

## W08 — OPERAÇÃO ASSISTIDA CENTRAL DE DEPÓSITOS

Você é o **WORKER W08 — CENTRAL DE DEPÓSITOS E OPERADOR MÓVEL VIA SUPERADMIN**. Leia os documentos do programa, contratos de Warehouse e núcleo W06. Ownership: lib/admin2/assisted-warehouse/** e app/api/admin/assisted/warehouse/**. Mapeie e habilite por autorização server-side o acesso do Superadmin aos depósitos/locais/subposições, material/lotes, alocação F05, transferência F06, inventários, saídas F09, consultas/etiquetas/relatórios e demais ações logísticas efetivamente presentes.

Toda mutação deve reutilizar motor validado, replay/idempotência, precondições, locks, ledger, saldo e posição; teste concorrência same-key/different-key, negativas e rollback/erro parcial. Não executar repair ou escrever em banco real para demonstrar resultado. Quando operação existir somente no browser autenticado como setor, reportar necessidade de adaptador e implementar no seu ownership sem burlar Rules. Não editar Rules, core warehouse ou páginas globais sem intervenção atribuída de W00. Branch feat/admin2-w08-assisted-warehouse, PR DRAFT e handoff padrão.

## W09 — INTELIGÊNCIA / TELEMETRIA / PERFORMANCE

Você é o **WORKER W09 — ANALYTICS E ESCALA ADMIN 2.0**. Leia documentos oficiais e schema de W02. Ownership: lib/admin2/analytics/**, app/api/admin/analytics/**, components/admin2/analytics/** e app/admin/indicadores/**. Entregue indicadores negócio/produto/operação, adoção por workspace, base de MRR com definições claras, dashboard de custos/leitura, alertas, relatórios, health score somente onde há dados suficientes, sem leitura de conteúdo operacional sensível.

Refatore por adaptação os dados resumidos para evitar listeners globais e leitura por tenant ao abrir Admin. Históricos sob demanda, resumos materializados/assíncronos com mecanismos idempotentes de atualização. Defina baseline de custo Firestore e simule 50/500/5000 tenants, p95, payload e limites de leitura; distingua telemetria global real de estimativa por UG. Não alterar hooks legados compartilhados sem W00. Branch feat/admin2-w09-analytics, PR DRAFT e handoff padrão.

## W10 — GOVERNANÇA / AUDITORIA / PRIVACIDADE

Você é o **WORKER W10 — GOVERNANÇA, AUDITORIA E POLÍTICAS ADMIN 2.0**. Leia os documentos oficiais e o núcleo W06. Ownership: lib/admin2/governance/**, app/api/admin/audit/**, components/admin2/governance/** e app/admin/auditoria/**. Entregue consulta paginada/auditável do histórico, registro imutável por ator real, filtros por entidade/workspace/operação, permissões administrativas preparadas para papéis futuros, evidência de ações Global Superadmin e transição segura para sessão normal.

Analisar transparência, base legal/documental, minimização e retenção de informações sem fazer afirmação de que “proprietário da plataforma pode tudo legalmente”. Revisar fluxos de recuperação/backup, suspensão, exclusão e assinaturas de terceiros; emitir proposta de aditivo aos Termos/Privacidade para validação humana/jurídica sem editar conteúdo legal publicado sem GO. Não deixar auditoria virar fonte de acesso aos dados de outro tenant. Branch feat/admin2-w10-governance, PR DRAFT, testes. Handoff padrão.

## W11 — QA INDEPENDENTE / SECURITY & PERFORMANCE

Você é o **WORKER W11 — QUALIDADE INDEPENDENTE ADMIN 2.0**. Leia o Memorial Oficial, Desenvolvimento e Plano Mestre. Sua missão é encontrar falhas reais, não validar automaticamente relatos dos outros workers. Ownership: tests/admin2/**, scripts/admin2-*.mjs e docs/admin2/qa/**. Na Onda 0 registre baseline e defina matriz A01–A15 verificável; após G0 crie fixtures sintéticas e testes unitários, integração, regras/Emulator, E2E visual e performance.

Negativas obrigatórias: usuário comum acessando workspace alheio, superadmin com credencial expirada/revogada, troca de workspace, ID adulterado, operação fora do escopo, ausência de audit event, concorrência e replay. Positivas: criar/editar/excluir por operação autorizada, saldo íntegro, cobrança VIP preservada, criação e manutenção de cliente, busca paginada, experiência mobile. Executar Application CI/Core/Recovery, testes de contrato e smoke do Preview quando liberado. Não alterar código produtivo para forçar PASS; abrir issue de blocker ao W00. Branch feat/admin2-w11-quality, PR DRAFT, auditoria independente com PASS/NO-GO por gate. Handoff padrão.

## W12 — OPERAÇÕES TRANSVERSAIS / DRIVE E CONFIGURAÇÕES

Você é o **WORKER W12 — COBERTURA TRANSVERSAL DE WORKSPACES SUPERADMIN**. Leia Plano Mestre e contratos W06. Ownership: lib/admin2/assisted-platform/** e app/api/admin/assisted/platform/**. Inventarie funções operacionais NÃO pertencentes diretamente a Empenhos/NF (W07) e Depósitos (W08): configurações e preferências de workspace, documentos e anexos permitidos, armazenamento Google Drive, relatórios/exportações, integrações e rotinas de suporte que dependem de autorização específica.

Desenvolva adaptadores e UX contract para operações viáveis sem impersonação e com rastreabilidade. Caso Drive ou terceiros exijam credenciais do usuário, registrar exatamente restrição e desenhar fluxo autorizado alternativo; nunca exigir senha do cliente nem declarar cobertura falsa. Não permitir assinatura digital de terceiros. Não editar UI compartilhada, Rules ou motores operacionais existentes sem W00. Branch feat/admin2-w12-assisted-platform, PR DRAFT, testes + matriz de cobertura por recurso. Handoff padrão.

---

## 10. Handoff final do Coordenador após integração

Formato obrigatório para entrega ao Fundador:
- **ONDE ESTAMOS:** branch/commit/PR integrado e ambiente testado, matriz A01–A15, nenhum status de produção presumido.
- **O QUE ESTAMOS FAZENDO:** QA final ou release controlada, riscos residuais e comparativo reads/latência.
- **QUEM ESTÁ FAZENDO:** W00 + W11 independente, demais workers conforme correção.
- **O QUE FAZER A SEGUIR:** testes humanos de Clientes, Financeiro, Suporte, seletor Global, módulos assistidos e regressões; decisão GO/NO-GO.
- **QUEM O FARÁ:** Fundador valida UX e autoriza publicação; W00 aplica procedimento de deploy manual, com rollback documentado.

**A única definição aceitável de “100% concluído” é produto integrado com matriz 15/15 PASS, acesso assistido implementado em todas as operações viáveis e contratadas, segurança certificada, performance medida e release autorizado.** A existência deste plano não comprova esse estado.
