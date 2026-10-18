# EMPROVEX — ADMIN 2.0 / EMPROVEX COMMAND

## Contrato visual V3 — decisão mais recente do Fundador (2026-10-18)

A Administração 2.0 terá **barra lateral escura fixa na borda esquerda, em largura permanente de 288px, SEM recolhimento desktop e SEM botão 'Recolher menu'**. A decisão substitui todas as referências anteriores deste plano a modo compacto, expansão ou armazenamento da compactação. A sidebar usa rolagem interna independente com scrollbar fina/arredondada, trilho transparente, hover elegante, rodapé fixo e menu drawer responsivo no mobile. O cabeçalho permanece azul-marinho; **a área principal adota fundo claro institucional, gradientes suaves e cards brancos**, inspirados no painel operacional do EMPROVEX. KPIs com acentos discretos azul, teal, verde e âmbar, contraste e acessibilidade. W01 implementa na branch isolada PR #339, W11 testa e W00 integra somente após validação. Esta nova definição tem precedência sobre o contrato de sidebar anterior abaixo.

## Plano Mestre de Desenvolvimento — V2 / Escopo Atual CORE
**Decisão do Fundador:** 2026-10-18. **Este documento V2 prevalece sobre as instruções conflitantes da V1 e da Auditoria Técnica 01 no que se refere à etapa atual.**
**Repositório:** aprov-hgesm/Controles-de-Empenhos---Aprov.
**Memorial:** [EMPROVEX_MEMORIAL_OFICIAL.md](./EMPROVEX_MEMORIAL_OFICIAL.md).
**Requisitos históricos:** [ADMIN_2_0_MEMORIAL_DESENVOLVIMENTO.md](./ADMIN_2_0_MEMORIAL_DESENVOLVIMENTO.md).
**Auditoria histórica:** [ADMIN_2_0_AUDITORIA_TECNICA_01.md](./ADMIN_2_0_AUDITORIA_TECNICA_01.md).
**Estado:** PLANO V2 DOCUMENTADO; nenhuma implementação/QA validada neste registro. Na ativação, W00 deve verificar HEAD e PRs atuais; jamais tomar SHA antigo como baseline imutável.

---

## 0. Recorte vigente e decisões inegociáveis

### Objetivos RETIRADOS DESTA ETAPA — adiados, não cancelados
1. **Entrar nos workspaces operacionais dos clientes e criar, modificar ou excluir seus registros** usando acesso global Superadmin.
2. **Operar a Central de Depósitos dos setores externos** como Superadministrador, incluindo seus materiais, inventários, movimentações e saldos.
3. **Abrir, editar, baixar ou gerenciar arquivos privados do Google Drive das contas dos clientes** pelo administrador.

**Consequências técnicas imediatas:**
- Não criar seletor global para assumir o workspace operacional de terceiros; nem botão “Gerenciar Workspace” que sugira funcionalidade indisponível.
- Não implementar delegação inter-workspace, impersonação, autorização global de dados operacionais, W06/W07/W08/W12/W13 da proposta original nem spike obrigatório G-1 da Auditoria 01.
- **Manter intocados os guards e as Rules** de dados operacionais dos usuários e warehouse; não introduzir bypass administrador.
- Adiar políticas e integrações especiais de Drive; pode-se **exibir somente metadados administrativos existentes**, sem expor documentos nem acessar arquivos privados.
- A decisão anterior sobre ausência de aceite por sessão e duração ilimitada continua **histórica para uma etapa futura**, mas **NÃO deve ser codificada agora**.
- Não confundir adiamento da operação sobre registros do cliente com retirada dos poderes administrativos **já existentes**: provisionamento de setor, gestão de status, contas, billing, sessões, segurança e backup existentes permanecem funcionais.

### O que continua integralmente NO ESCOPO
Administração de plataforma e negócio SaaS: visual premium, dashboard, diretório e Cliente 360°, contas comerciais relacionadas a workspaces, cadastro/onboarding, assinaturas/financeiro, CRM/atendimento, indicadores, cotas, sessões, backups/recuperação administrativa existente, segurança, auditoria e eficiência Firestore.

**Meta de entrega:** 100% do **CORE V2**, não 100% de funcionalidades antigas deliberadamente retiradas. Uso normal dos workspaces por clientes permanece sem mudança de comportamento.

## Design Premium — contrato explícito da sidebar ADMIN-2.0 (W01 + W00 + W11)

**Decisão do Fundador confirmada em 2026-10-18:** a Administração 2.0 terá **barra lateral própria à esquerda, visual e navegação coerentes com a barra lateral do EMPROVEX operacional e com a da Central de Depósitos**, usando identidade visual unificada, mas agrupamentos administrativos exclusivos. Não substituir a sidebar por abas horizontais como navegação principal.

**Comportamento obrigatório:**
1. **Desktop:** sidebar vertical à esquerda; padrão expandido com ícones + rótulos; pode ser **recolhida em modo compacto somente ícones** pelo Superadministrador e reexpandida pelo mesmo controle, sem perda de contexto ou navegação. O colapso no desktop é **uma melhoria nova de Admin 2.0**, não assumir que as sidebars atuais já oferecem exatamente esse recurso.
2. **Preferência visual:** persistir escolha expandida/compacta de maneira local ao navegador, sem leitura ou escrita Firestore; não tratar preferência local como autorização.
3. **Mobile/tablet:** menu lateral em modo drawer/overlay acionado no cabeçalho, com backdrop, botão fechar, navegação acessível e fechamento após selecionar rota; não ocupar permanentemente toda a largura útil.
4. **Hierarquia:** CENTRAL (Visão Geral, Pendências), NEGÓCIO (Clientes, Financeiro, Atendimento), OPERAÇÃO (Workspaces, Consumo e Cotas, Sessões, Backups), INTELIGÊNCIA (Indicadores/Relatórios), GOVERNANÇA (Segurança, Auditoria, Configurações). As opções podem ser ajustadas por contratos de permissão; **não mostrar ação de entrada no workspace operacional alheio**, retirada do escopo CORE V2.
5. **Item ativo:** ícone/rótulo destacados com marcação azul suave e inequívoca, \`aria-current="page"\`, coerente com a rota/URL profunda; manter seleção correta no refresh, histórico do navegador e navegação por teclado. No modo compacto, identificar ações por tooltip e \`aria-label\`.
6. **Estética:** azul-marinho profundo \`#020817\`, superfícies \`#071225\`, Montserrat, ícones consistentes, linhas e iluminação discretas, contraste adequado; conservar o DNA do shell existente e evitar bolhas esféricas, filamentos ou beams excessivos. Bordas e transições em ~160–300 ms, respeitando \`prefers-reduced-motion\`.
7. **Área de identificação:** marca EMPROVEX Command, distinção clara do contexto ADMIN, identidade administrativa e ação de retorno/navegação previstas no header/shell; sem sugerir identidade do usuário de outro workspace.
8. **Resiliência:** carregamento, permissões, abas vazias, rotas inexistentes, modo claro/escuro, textos longos, 320px/mobile e largura desktop sem layout quebrado. Sidebar não dispara consultas/assinaturas Firestore somente por expandir ou recolher.

**Referência de implementação existente (verificar código vivo):** \`components/layout/AppSidebar.tsx\` e \`features/warehouse/components/WarehouseSidebar.tsx\` usam padrões visuais \`emprovex-app-sidebar\`, \`emprovex-sidebar-nav-item\`, status ativo e drawer mobile. Reaproveitar **princípios e tokens**, não acoplar Admin à árvore operacional de setor. O módulo \`features/warehouse/components/WarehouseModuleShell.tsx\` controla abertura mobile. Não presumir que existe persistência do modo desktop compacto nessas sidebars.

**Ownership e testes:** W01 entrega \`components/admin2/shell/**\` e componentes visuais; W00 integra no roteamento e substituição compatível de \`PlatformAdminView\`; W11 prova expansão/compactação, menu mobile, foco/teclado, \`aria-current\`, deep-link, tema, prefers-reduced-motion e ausência de novas reads Firestore por alternância visual. **Critério de aceite de A01/A02 obrigatório**, não opcional.

---

## 1. Matriz de capacidades e aceitação — 13/13

| ID | Entrega da fase CORE V2 | Evidência de aceite |
|---|---|---|
| A01 | EMPROVEX Command, tema premium | Shell, tipografia, cores, estados, responsividade, a11y, reduced-motion |
| A02 | Navegação administrativa hierárquica | Central, Negócio, Operação, Inteligência, Governança; deep-links/retorno |
| A03 | Diretório Clientes | Busca, paginação, filtros, ordenação, exportação autorizada e estados vazios |
| A04 | Cliente 360° **administrativo/comercial** | Identidade, contatos, UG/OM, status do workspace, financeiro, uso/consumo estimado, suporte e timeline; **sem abrir dados operacionais** |
| A05 | Identidade Cliente / OM / Workspace / Conta separadas | Vínculo sem alterar UID/UG/IDs; mapeamento comercial preparado para 1 cliente/N workspaces |
| A06 | Onboarding administrativo | Cadastro com validação e prevenção de duplicados, provisionamento atual, trial/VIP e primeiro acesso; **sem acesso administrativo aos Drive dos setores** |
| A07 | Financeiro/assinaturas | R$70/workspace, trial 30d, VIP protegido, manual Link/Pix, billing observe, ciclos, MRR versus caixa |
| A08 | CRM e Atendimento | Tickets, status, notas e histórico vinculados ao Cliente, paginação e privacidade |
| A09 | Inteligência e indicadores | Métricas com fontes/frescor claros, adoção agregada, health score somente com evidência |
| A10 | Operação administrativa existente | Sessões, quotas, consumo, backups, saúde, provisionamento, segurança — ações atuais preservadas |
| A13-CORE | Governança, segurança e auditoria **administrativas** | Proteção da Admin, isolamento entre tenants, trilhas de ações administrativas, LGPD, sem nova autorização operacional global |
| A14 | Escalabilidade / economia Firestore | Listas limitadas, resumos sob demanda, sem listeners globais indiscriminados; medição real de reads/latência |
| A15-CORE | CI, QA e release do CORE V2 | Testes, Emulator, regressão, Preview, aceite humano, GO explícito para produção |

**A11/A12 da V1:** fora de escopo. A13/A15 da V1 são mantidos **somente no recorte administrativo CORE**. O conjunto não deve ser somado como “15/15” nesta fase: o aceite é **13/13 capacidades V2** com evidência e sem fingir recursos adiados.

## 2. Estrutura de chats workers paralelos — 8 especialistas + W00

| Chat | Papel | Ownership primário |
|---|---|---|
| **W00** | Coordenador/Integração/contratos/UI legado | Contratos comuns, shell raiz, app/admin/page.tsx, PlatformAdminView, CI/guards, memorial |
| **W01** | Design premium EMPROVEX Command | components/admin2/shell/**; components/admin2/ui/**; docs/admin2/visual/** |
| **W02** | Modelo Cliente/Workspace e API administrativa | lib/admin2/customers/**; app/api/admin/customers/**; docs/admin2/contracts/** |
| **W03** | Diretório/Clientes 360° frontend | components/admin2/customers/**; app/admin/clientes/** |
| **W04** | Financeiro/assinaturas/VIP | lib/admin2/finance/**; app/api/admin/finance/**; components/admin2/finance/**; app/admin/financeiro/** |
| **W05** | CRM/Atendimento/Timeline | lib/admin2/support/**; app/api/admin/support/**; components/admin2/support/**; app/admin/atendimento/** |
| **W09** | Analytics/Consumo/Performance | lib/admin2/analytics/**; app/api/admin/analytics/**; components/admin2/analytics/**; app/admin/indicadores/** |
| **W10** | Governança/Auditoria/Segurança | lib/admin2/governance/**; app/api/admin/audit/**; components/admin2/governance/**; app/admin/auditoria/** |
| **W11** | QA independente e benchmark Firestore | tests/admin2/**; scripts/admin2-*.mjs; docs/admin2/qa/** |

**Workers preservados SOMENTE COMO BACKLOG FUTURO:** W06 (acesso Global Superadmin), W07 (operações assistidas Empenhos), W08 (operações assistidas Warehouse), W12 (Drive e operações assistidas), W13 (bridge operacional identificada pela auditoria). **NÃO ativar esses chats na fase CORE V2.** A existência histórica de seus prompts anteriores não constitui autorização.

Ownership de arquivos globais/antigos:
- **Somente W00** altera \`app/admin/page.tsx\`, \`components/admin/PlatformAdminView.tsx\`, \`lib/platformAdminStore.ts\`, \`lib/platformBillingStore.ts\`, \`hooks/usePlatformAdminBilling.ts\`, integrações legadas e scripts de guards globais, se necessários; recebe diffs/sugestões dos especialistas.
- **Nenhum worker** deve alterar \`firestore.rules\`, \`firestore.warehouse.rules\`, \`lib/workspaceContext.ts\`, \`lib/operationalPaths.ts\`, \`lib/server/warehouseAccess.ts\`, \`features/operational/**\` ou \`features/warehouse/**\` para habilitar acesso a outros tenants. Se o CORE exigir alguma mudança legítima em Rules/índices do **modelo administrativo novo**, W00 propõe alteração mínima documentada a W11, testa em Emulator e mantém os denies operacionais.
- Alterações de \`package.json\`, \`firestore.indexes.json\`, CI, \`app/admin/\` root, documentação do memorial e config de deploy são exclusivas de W00.

## 3. Dependências e execução

### G0 — Contratos ADMIN CORE
W00 e W02 definem Customer, contatos, UG/OM, workspace links, atributos comerciais, Client Summary, CRM Timeline, Financial Summary e endpoints com autenticação administrativa; W11 revisa segurança e casos negativos. Estabelecer fonte de verdade para dados de clientes e billing, compatibilidade legada, busca/paginação e índices, definição de MRR/caixa, política de resumos. **NÃO exige G-1 (spike cross-workspace).**

### Onda 0 — Início imediato, sem modificação de produção
W00 prepara branch exclusiva \`feat/admin2-core-integration\` e verifica HEAD/PRs; W01 faz UI kit/protótipo isolado; W02 desenha e fecha G0; W11 define fixtures, matriz 13/13 e baseline de leituras. Nenhum worker faz deploy por conta própria.

### Onda 1 — Paralelismo após G0
W01 (shell), W02 (dados), W04 (financeiro), W05 (CRM), W09 (indicadores), W10 (governança); W11 independente. Em média 4–6 chats codificando simultaneamente para reduzir conflitos. W03 pode construir mock tipado com W01 enquanto aguarda backend W02; integra dados depois.

### Onda 2 — Integração real
W03 conecta diretório e ficha 360°; W00 conecta os módulos legados de gestão de setores, consumo, sessões, billing, backup e segurança aos novos contextos de navegação. **Nenhuma tela deve incluir um controle funcional de entrar no workspace alheio**; usuários podem abrir metadados de workspace e executar ações administrativas já existentes.

### Onda 3 — Estabilidade
W00 compõe PRs DRAFT um por vez na branch \`feat/admin2-core-integration\`; W11 roda suite adaptada de CI, Emulator e E2E browser sob demanda; W01 aperfeiçoa visual; W02/W04/W09 medem Firestore e resolvem inconsistências.

### Onda 4 — Entrega controlada
PR integrador -> main (DRAFT até aprovação), Preview isolado (sem alterar dados reais), smoke humano, 13/13 PASS, documentação e decisão explícita do Fundador para deploy manual conforme política de economia Vercel. QA/Preview não se confunde com produção.

## 4. Regras comerciais e de dados

1. **Plano Completo: R$70/mês/workspace**; VIP legado com R$0 e proteção permanente; Founder isento; trial padrão 30 dias; cobrança Link/Pix com confirmação administrativa; billing em \`observe\` sem suspensão automática por inadimplência.
2. Relação Cliente -> N workspaces apenas **comercial**, sem conceder novas identidades ou permitir acesso operacional em múltiplos setores.
3. Diretório e ficha 360 só consultam os **metadados administrativos que o perfil já pode acessar**, resumos de uso e serviços por APIs validadas; não consultar NF/empenhos/saldos privados de outro tenant.
4. Evitar snapshot/listeners de toda a coleção workspaces, accounts, billingCycles ou sessionSlots no carregamento das páginas. Usar limite, cursor, índices e resumos; transações de fundação de billing fora de \`useEffect\` de abertura.
5. Preservar integridade e mecanismos existentes sem reescrever provisão/login; mudanças pontuais de backend administrativo precisam de teste contra conta normal.

## 5. Gates de qualidade e segurança

**G0 — Contratos:** Tipos, query/API, autorização admin, backfill dry-run, compatibilidade e matriz de privacidade fixados.

**G1 — Backend:** CRUD comercial/admin, relação workspace, financeiro e suporte válidos, sem efeito nos registros operacionais.

**G2 — Interface:** todos os módulos e estados funcionam (vazio, erro, carregando), tema escuro/claro, mobile, acessibilidade, botões com funções reais.

**G3 — Compatibilidade:** usuário comum sem privilégios administrativos, Admin somente com acesso à plataforma (e não a operações de outro workspace), VIP/trial preservados, sessões/backup intactos; sem bypass de Rules.

**G4 — Economia:** baseline vs novo consumo em 50/500/5000 workspaces sintéticos; medir leituras e p95, não inventar meta antes de medir. Dashboard não pode exigir 1 chamada por cliente para carregar indicadores básicos.

**G5 — Release:** typecheck/Build, Application CI, Core Protection, Recovery Guardrails, admin old guards adaptados **sem apagar cobertura**, Rules/Emulator, E2E e Preview QA. Aceite do Fundador e GO explícito antes de produção.

**Atenção:** o guard \`scripts/verify-admin-information-architecture.mjs\` testa strings exatas da antiga interface; W00 e W11 devem modernizar sua cobertura sem simular componentes/strings apenas para passar no CI.

## 6. Critérios de sucesso

- **13/13 capacidades CORE V2 com evidências**; não contar objetivos retirados como pendências.
- 100% dos fluxos administrativos já existentes preservados, inclusive provisionamento, lifecycle, VIP, pagamentos, sessões, backups e segurança.
- Qualidade visual premium compatível com o restante do EMPROVEX, não apenas mockup.
- Firestore escalável, sem listeners globais inadvertidos nem leitura de dados operacionais do cliente.
- Sem credenciais de cliente, sem mudança de banco, sem deploy ou migração reais realizados pelos workers.
- PRs separados e integração centralizada, QA independente, nenhuma promoção automática à produção.

## 7. Prompts oficiais para ativação nesta fase

> Todos os workers devem ler os três documentos: \`docs/EMPROVEX_MEMORIAL_OFICIAL.md\`, \`docs/ADMIN_2_0_MEMORIAL_DESENVOLVIMENTO.md\`, e **este Plano Mestre V2**, observando sua precedência sobre as instruções antigas. Verificar o HEAD real ao iniciar. Branch/PR exclusivo, nunca merge em main ou deploy. Entregar handoff final na estrutura **ONDE ESTAMOS / O QUE ESTAMOS FAZENDO / QUEM ESTÁ FAZENDO / O QUE FAZER A SEGUIR / QUEM O FARÁ**, citando SHA, PR, arquivos, testes, impactos Firestore e confirmação de produção intacta.

### W00 — Coordenador Geral / ADMIN CORE
Coordene o programa \`ADMIN-2.0-CORE\` com 8 workers especialistas, 13 capacidades ativas, no repositório \`aprov-hgesm/Controles-de-Empenhos---Aprov\`. Leia memorial, auditoria e **Plano Mestre V2**, confira main viva e PRs concorrentes. Prepare \`feat/admin2-core-integration\`, congele G0 com W02/W11, atribua ownership, integre módulos administrativos novos e legados sem quebrar login, provisionamento, billing, consultas, sessões e backup. **Não implemente acesso Superadmin ao workspace operacional alheio, nem operação nos depósitos externos nem Google Drive privado dos clientes. G-1 antigo NÃO é gate da fase CORE.** PR DRAFT de integração e CI/QA; produção apenas com GO do Fundador. Entregue plano de ativação por ondas e handoff.

### W01 — Design Premium / EMPROVEX Command
Desenvolva UI kit e shell premium (sidebar, topbar, tabelas, estados, skeletons, modais, feedback, tema, responsividade, acessibilidade e animações contidas) em \`components/admin2/shell/**\` e \`components/admin2/ui/**\`. Use Montserrat, cores EMPROVEX, estética refinada, sem orbs decorativos em massa. Reserve área para contexto admin real, **sem seletor de workspace operacional externo**. Não editar componentes/arquivos globais de W00 nem banco. Protótipo e testes; PR DRAFT e handoff.

### W02 — Modelo Cliente / APIs
Defina contratos e crie Cliente comercial, contatos, relação OM/UG/workspace, resumos, onboarding e endpoints paginados em \`lib/admin2/customers/**\` e \`app/api/admin/customers/**\`. Reutilize identidade/provisionamento existente sem duplicar criação do setor nem migrar dados reais. Não criar permissão de acesso operacional a outro tenant. Apresente backfill dry-run, testes e impacto Firestore; PR DRAFT e handoff.

### W03 — Diretório / Ficha 360°
Implemente em \`components/admin2/customers/**\` e \`app/admin/clientes/**\` pesquisa, filtros, paginação, Cliente 360°, contatos, associação OM/UG, status do workspace, extrato financeiro administrativo, indicador de uso, tickets e timeline. Desenvolva mocks tipados até integração das APIs W02/W04/W05/W09. **Ficha mostra metadados do workspace, NÃO possui botão funcional Gerenciar Workspace de terceiros.** Estados responsivos/acessíveis, sem dados fictícios declarados como reais; PR DRAFT e handoff.

### W04 — Financeiro / Assinaturas
Trabalhe em \`lib/admin2/finance/**\`, \`app/api/admin/finance/**\`, \`components/admin2/finance/**\` e \`app/admin/financeiro/**\`. Preserve 70 reais por workspace, VIP legado isento, trial 30d, cobrança manual Link/Pix, \`observe\`, não suspensão por inadimplência. Traga competências paginadas, MRR separado do dinheiro recebido, ações atuais e histórico auditado. Não carregar billingCycles integralmente. PR DRAFT, testes e handoff.

### W05 — CRM / Atendimento
Trabalhe em \`lib/admin2/support/**\`, \`app/api/admin/support/**\`, \`components/admin2/support/**\`, \`app/admin/atendimento/**\`. Tickets, notas, pendências, atribuição, histórico, notificações na interface e integração Cliente 360° por IDs estáveis. Sem integração externa automática assumida. Paginação, proteção de dados e rastreio de alterações. PR DRAFT, testes e handoff.

### W09 — Analytics / Custos / Relatórios
Trabalhe em \`lib/admin2/analytics/**\`, \`app/api/admin/analytics/**\`, \`components/admin2/analytics/**\`, \`app/admin/indicadores/**\`. Métricas operacionais administrativas com fonte/frescor, resumos paginados, custos Firestore, alertas, relatórios e adoção agregada, nunca leitura de registros operacionais de terceiros. Medir consumo em fixtures de 50/500/5000 workspaces e descrever possíveis migrations/índices ao W00. PR DRAFT, testes e handoff.

### W10 — Governança / Auditoria
Trabalhe em \`lib/admin2/governance/**\`, \`app/api/admin/audit/**\`, \`components/admin2/governance/**\`, \`app/admin/auditoria/**\`. Auditoria de ações administrativas permitidas já hoje (provisionamento, lifecycle, financeiro, segurança, sessão), relatórios e privacidade; preserve escopo e denies para acesso operacional de outros tenants. Não introduza claims de Superadmin global ou OAuth de Drive do cliente. PR DRAFT, testes e handoff.

### W11 — QA Independente / Performance
Trabalhe em \`tests/admin2/**\`, \`scripts/admin2-*.mjs\` e \`docs/admin2/qa/**\`. Construa matriz de 13 capacidades, fixtures e auditoria de CI/security/regressão/Firestore. Cobrir usuário comum negado em Admin, visibilidade de metadados permitidos, manutenção de VIP/trial/billing, onboarding, lifecycle, sessões, backups, dashboard, responsividade e p95. Os testes de acesso global aos dados operacionais alheios permanecem como **negação esperada** nesta fase. Reporte PASS/NO-GO com evidências; não ajustar código de domínio para fabricar PASS.

---

## 8. Handoff de gestão e backlog explicitamente adiado

**ONDE ESTAMOS:** ADMIN-2.0-CORE documentado para desenvolvimento; frontend/CRM/financeiro/analytics/QA ainda a certificar; produção intocada.

**O QUE ESTAMOS FAZENDO:** entregando Administração premium e escalável com visão Cliente 360°, sem operações diretas nos dados privados dos tenants.

**QUEM ESTÁ FAZENDO:** W00 + W01/W02/W03/W04/W05/W09/W10/W11 por ondas; demais workers adiados.

**O QUE FAZER A SEGUIR:** W00 cria branch de integração, fixa G0, distribui primeiras frentes e gera quadro vivo. Nenhum bloqueio G-1 antigo impede esse recorte.

**QUEM O FARÁ:** coordenador e especialistas; Fundador aprova estética/GO produtivo.

**BACKLOG FUTURO (NÃO EXECUTAR AGORA):** acesso Global Superadmin entre workspaces; operações assistidas Gestão de Empenhos; operações assistidas Central de Depósitos; acesso a arquivos Google Drive dos clientes; bridge operacional W13. Permanecem historicamente especificados, exigirão projeto/QA de autorização independente caso sejam retomados.
