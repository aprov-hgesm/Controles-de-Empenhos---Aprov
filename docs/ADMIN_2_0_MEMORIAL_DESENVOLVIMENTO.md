# EMPROVEX — ADMIN 2.0 / EMPROVEX COMMAND

## Decisão visual atualizada — Admin 2.0 V3 (2026-10-18)

A prévia foi refinada após avaliação do Fundador. **Sidebar desktop fixa e não recolhível**, ocupando borda esquerda, com rótulos sempre visíveis, 288px de largura e rolagem interna com scrollbar premium (track discreto, thumb arredondado, hover). Removidos botão Recolher menu e persistência de modo compacto. No mobile permanece drawer com backdrop/teclado. **Conteúdo principal claro** com gradientes azulados suaves, cards de superfície branca, sombras refinadas e KPIs azul/teal/verde/âmbar. Header e sidebar permanecem azul-marinho como EMPROVEX/Central de Depósitos. Este contrato **substitui a descrição anterior de sidebar recolhível e corpo predominantemente escuro**. Código demonstrativo em branch isolada `feat/admin2-w01-sidebar-local-preview` PR #339, sem alterações em produção, sem dados reais. W01 implementa, W11 audita, Fundador valida antes de integração.

## Memorial especializado de desenvolvimento da Área Administrativa

> **ALTERAÇÃO VIGENTE DE ESCOPO — 2026-10-18 / CORE V2:** Por decisão posterior do Fundador, **não desenvolver nesta etapa** (i) acesso global para entrar ou modificar registros operacionais dos workspaces de outros clientes; (ii) operação assistida dos depósitos de setores externos; (iii) acesso administrativo aos arquivos privados Google Drive dos clientes. As descrições anteriores dessas capacidades neste Memorial passam a ser **backlog histórico/futuro**, não requisitos de aceite do CORE V2. **Nova fonte de execução obrigatória:** [ADMIN_2_0_PLANO_MESTRE_WORKERS.md](./ADMIN_2_0_PLANO_MESTRE_WORKERS.md), revisão V2, com **13 capacidades e W00 + 8 especialistas**. A auditoria G-1 cross-workspace permanece tecnicamente válida para futuro projeto de acesso assistido, mas **não bloqueia a atual entrega administrativa/comercial**. Preservar denies de acesso operacional nas Firestore Rules. A aba Clientes 360° mostra somente dados administrativos autorizados e indicadores agregados; sem impersonação/alterações operacionais. Não houve implementação/deploy nesta atualização.

- **Data da decisão:** 2026-10-17.
- **Programa:** ADMIN-2.0 — arquitetura administrativa, Clientes 360°, experiência visual premium e acesso administrativo global.
- **Autoridade de produto:** Fundador / Superadministrador EMPROVEX.
- **Estado:** **DIRETRIZES E ESCOPO FUNCIONAL DEFINIDOS; PROPOSTA ESTÉTICA EM VALIDAÇÃO; IMPLEMENTAÇÃO NÃO INICIADA NESTE REGISTRO**.
- **Natureza:** documento de planejamento e continuidade; **não representa feature publicada, alteração de Firestore Rules, deploy ou autorização para modificar dados reais**.
- **Memorial de entrada:** [EMPROVEX_MEMORIAL_OFICIAL.md](./EMPROVEX_MEMORIAL_OFICIAL.md).
- **Plano Mestre de workers paralelos:** [ADMIN_2_0_PLANO_MESTRE_WORKERS.md](./ADMIN_2_0_PLANO_MESTRE_WORKERS.md) — W00 a W12, fases de integração, ownership exclusivo, 15 capacidades e QA. O plano não constitui implementação.
- **Documentos precedentes:** [ADMIN_INFORMATION_ARCHITECTURE.md](./ADMIN_INFORMATION_ARCHITECTURE.md), [BRAND_ADMIN_BLOCK_3.md](./BRAND_ADMIN_BLOCK_3.md).
- **Referência de código inspecionado:** `app/admin/page.tsx`, `components/admin/PlatformAdminView.tsx`, `components/admin/AdminBillingPanel.tsx`, `lib/platformAdminStore.ts`, `lib/platformBillingStore.ts`, `lib/platformIdentity.ts`, `lib/workspaceContext.ts`, `lib/profileMode.ts`, `lib/auditTrail.ts`, `firestore.rules` (branch `main`, inspeção 2026-10-17).

---

## 1. Objetivo e posicionamento

Evoluir o painel de gestão de setores para uma **central de gestão de um negócio SaaS escalável**, com estética consistente com todo o EMPROVEX, navegação simples e custo operacional eficiente. A futura Administração deve permitir gerenciar clientes, contas comerciais, workspaces, faturamento, atendimento, consumo, segurança, governança e crescimento em uma experiência coesa.

**Decisão de produto:** adotar o conceito visual/funcional **EMPROVEX Command — Admin 2.0** como proposta-base para refinamento e validação humana antes da implementação. A estética definitiva não se declara aprovada por este documento.

Diretrizes permanentes:
- Não vender à Organização Militar como pressuposto contratual: em regra, o relacionamento comercial é com o militar/responsável, e a OM/UG é contexto institucional do setor.
- Minimizar burocracia administrativa e leituras/custos Firestore.
- Preservar isolamento multi-tenant e dados operacionais dos setores.
- Manter compatibilidade com workspaces, contas, billing, auditoria, integração Drive, sessões e regras de domínio existentes.
- Planejar crescimento de dezenas para milhares de workspaces sem obrigar, por antecipação, microsserviços ou migração de banco.

## 2. Benchmark e premissas de design

Padrões de referência estudados conceitualmente (não integrar esses serviços por padrão):
- **HubSpot CRM:** empresas, contatos, histórico de relacionamento e ficha unificada.
- **Intercom:** suporte contextual e atividade associada ao cliente.
- **Stripe:** visão organizada de clientes, cobrança e histórico financeiro.
- **Chargebee:** ciclo de vida de assinaturas, trial, isenções e renovação.
- **Clerk:** separação organização, membros, identidade e permissões.
- **PostHog:** indicadores de adoção por organização/workspace.
- **Vercel/Linear:** navegação hierárquica, densidade informacional, estados consistentes e monitoramento de consumo.

Síntese: **CRM operacional compacto + gestão SaaS + inteligência de adoção + centro de operações**, sem importar a complexidade dos produtos de referência.

## 3. Modelo de entidades e contratos de negócio

NÃO tratar Cliente, OM, Workspace, Conta Firebase e Assinatura como sinônimos.

| Entidade | Papel |
|---|---|
| Cliente / conta comercial | Titular/responsável pelo relacionamento e eventual contratação |
| Organização/OM | Instituição de referência; UG e identificação institucional |
| Workspace | Ambiente operacional isolado, vinculado à UG/setor |
| Conta / identidade | Firebase Auth, autenticação, membros/sessões e permissões |
| Assinatura | Plano, preço, trial, status, exceções e vigência |
| Ciclo financeiro | Competência, vencimento, confirmação, valor e referência |
| Atendimento | Solicitações, resolução, acompanhamento e eventos |
| Auditoria | Atores reais, ações, motivo/contexto quando aplicável, correlação e alterações |

A interface inicial poderá continuar com relação próxima de 1 cliente por workspace; **o modelo futuro não deve tornar impossível 1 cliente gerir vários workspaces**. Compatibilidade com identificadores atuais é obrigatória, inclusive UG, workspaceId e UID; não migrar operacional apenas para adequar a nomenclatura comercial.

### Estados separados

Não unificar no mesmo status:
- relacionamento: interessado / implantação / cliente / encerrado;
- acesso: ativo / suspenso;
- assinatura: trial / ativa / pendente / suspensa / cancelada / isenta;
- implantação: não iniciada / em andamento / concluída;
- adoção: inicial / regular / atenção / crítica / sem dados;
- atendimento: sem pendência / aberto / escalado.

A inadimplência NÃO equivale automaticamente a suspensão operacional. Isenções VIP legadas são permanentes conforme contrato já vigente; valor faturável e receita de VIPs = zero.

## 4. Navegação administrativa proposta

### Contrato de design aprovado — barra lateral da Administração 2.0 (2026-10-18)

A Administração 2.0 terá uma **sidebar própria fixa à esquerda no desktop**, compartilhando linguagem visual, ícones, marcação de item ativo e o modelo responsivo com o EMPROVEX e a Central de Depósitos, mas com as seções administrativas Central / Negócio / Operação / Inteligência / Governança. Será a navegação principal da administração, em vez de uma grade de abas horizontais.

**Requisitos acordados:** expandida com ícones + nomes por padrão; **modo desktop compacto/recolhível somente ícones**, com tooltips e comando para reexpandir; persistência local da preferência, sem custos Firestore; indicação inequívoca da rota ativa com destaque azul discreto e \`aria-current\`; navegação profunda com histórico; drawer em mobile/tablet com backdrop e fechar; tema escuro/claro, foco/teclado, \`prefers-reduced-motion\`, Montserrat e qualidade premium consistente. A implementação desktop compacta será uma **melhoria nova no Admin 2.0**, não deve ser falsamente atribuída às sidebars atuais se elas ainda não possuírem esse estado.

**Responsáveis:** W01 constrói o componente shell e seu laboratório visual; W00 integra à navegação administrativa legada; W11 testa usabilidade, responsividade, estado ativo, acessibilidade, persistência e economia de leituras. **Aceite exige prova no navegador, não apenas um mockup.**

**Escopo CORE V2:** a sidebar pode apresentar *Workspaces* para gestão de metadados/status, mas **não** um seletor de acesso operacional a workspaces de clientes nem ações adiadas de outros bancos ou Google Drive.

Barra lateral com agrupamentos — evitando crescimento indefinido de abas planas:

1. **Central:** Visão geral; Pendências e alertas.
2. **Negócio:** Clientes; Financeiro e assinaturas; Atendimento.
3. **Operação da plataforma:** Workspaces; Consumo e custos; Sessões e acessos; Saúde dos serviços; Backups e recuperação.
4. **Inteligência:** Relatórios e indicadores.
5. **Governança:** Segurança; Auditoria; Configurações.

A ação `Cadastrar Setor` migra conceitualmente de aba primária para fluxo acionável em Clientes/Workspaces; o motor de provisionamento atual é preservado. O painel inicial mostra prioridades e métricas agregadas, **não** duplicata da listagem de Clientes.

### Diretório de Clientes

- Busca por cliente, setor, nome/sigla da OM, UG, contato, e-mail e identificador.
- Filtros combináveis: acesso, billing, trial, VIP, implantação, utilização, pendências; paginação/ordenação e exportação autorizada.
- Colunas essenciais: cliente/setor, OM/UG, acesso, situação financeira, última atividade/adoção, próxima ação.
- Métricas agregadas: clientes cadastrados, ativos operacionais, atenção, trials, VIPs, MRR definido sem confundir com caixa recebido.
- Ações sensíveis em menu contextual/ficha: evitar aglomerado de botões em cada linha.

### Ficha 360° do Cliente

Rota conceitual: `/admin/clientes/{clientId}`.

Seções internas:
1. **Visão geral:** identidade, setor/UG, estado operacional, financeiro, utilização, alertas e próximos passos;
2. **Cadastro:** responsável comercial e contatos, OM/UG, vínculos e dados institucionais;
3. **Acesso:** workspace(s), identidade, sessões, integrações e suporte assistido;
4. **Financeiro:** plano, trial, VIP, competências, confirmação de pagamento e histórico;
5. **Utilização:** atividade e adoção por módulo, consumo estimado, telemetria com limites;
6. **Suporte e histórico:** tickets, notas administrativas e linha do tempo de eventos.

Timeline consolidada: cadastro, provisionamento, primeiro acesso, trial, alterações, pagamentos, solicitações, intervenções, suspensão/reativação. Sempre distinguir **evento automático** de **anotação humana**.

### Onboarding assistido

Fluxo: dados comerciais -> OM/UG e setor -> plano e trial/VIP -> provisionamento seguro -> primeiro acesso/ativação e Drive opcional. Cadastro público irrestrito não é prioridade atual; evitar duplicidade, validar identidades e preservar os mecanismos já existentes.

## 5. Diretriz EXPLÍCITA do Fundador — Acesso Administrativo Global

**Decisão expressa posterior à proposta inicial:** o **Superadministrador** terá a capacidade de **entrar em QUALQUER workspace dos clientes, a qualquer momento, sem limite de tempo específico para a função e sem esperar aceite/autorização interativa do usuário a cada acesso**. Esta definição substitui para o Superadministrador a proposta anterior de sessão assistida obrigatoriamente de 30 minutos e de aprovação por sessão.

### Requisitos funcionais

- Disponibilizar **Gerenciar Workspace** na Ficha 360°, mais um **Seletor Global de Workspace** no cabeçalho da Admin.
- Permitir alternância `Admin -> workspace A -> workspace B -> Admin` sem pedir senhas de clientes e sem novos logins deliberados a cada troca.
- Permitir navegação completa e operações de inclusão, edição, correção e exclusão **por meio dos mesmos motores e invariantes do domínio** que protegem empenhos, NF, depósitos, inventário, transferências, saídas, saldos e documentos.
- O acesso privilegiado **não requer duração máxima própria nem justificativa manual a cada ação**. Não confundir isso com desabilitar expiração normal de autenticação, proteções de sessão, reautenticação em operações realmente sensíveis ou revogação administrativa de acesso comprometido.
- O acesso deve ser restrito ao papel **Superadministrador**, não automaticamente concedido a futuros administradores de suporte/comercial.
- Evidenciar continuamente a condição de **Contexto Superadmin — Workspace X/UG Y**; não disfarçar acesso como sessão normal do cliente nem atribuir falsamente operações ao titular.
- Registrar ator verdadeiro, alvo, data/hora, operação, before/after ou referência de delta quando apropriado, correlação e origem administrativa. Implementar auditoria robusta e, sempre que viável, visível/consultável ao cliente.
- Proibir contornar validações, adulterar a trilha de auditoria, assinar documentos em nome de terceiros ou burlar requisitos de identidade/assinatura.
- Documentar a finalidade e a possibilidade de intervenção administrativa nos termos e transparência de privacidade; observar LGPD, minimização e governança de informações institucionais.

### Contrato técnico de segurança

**A função NÃO EXISTE operacionalmente no código inspecionado em 2026-10-17.** O `resolveWorkspaceContext` e `firestore.rules` atualmente separam Admin do contexto operacional de outros tenants. Não basta alterar `workspaceId` no navegador, trocar `sessionStorage` ou criar um botão: isso quebraria isolamento ou seria negado.

Projetar acesso privilegiado **delegado e validado no servidor**, mantendo identidade Firebase real do Superadmin e escopo de workspace explícito. Se serviços usarem Firebase Admin SDK, aplicar verificações equivalentes às Rules e validações de domínio, porque o Admin SDK não depende das Security Rules do cliente. **Não** entrar com credenciais do usuário, não emitir um token que o faça parecer o usuário e não criar bypass amplo e não auditado das coleções.

A proposta mantém **acesso contínuo por autorização de papel**, mas cada mutação precisa permanecer autenticada, autorizada, atribuída, auditada e íntegra. Superadmin não substitui controles de consistência e de proteção de dados.

#### Localização na experiência
- Clientes -> Ficha 360° -> **Gerenciar Workspace**;
- cabeçalho Administração -> **Seletor Global de Workspace**;
- Governança -> Auditoria -> histórico de acesso/alterações Superadmin;
- Central -> indicadores de atendimentos/intervenções, sem monitoramento invasivo.

## 6. Identidade estética — EMPROVEX Command

**Intenção aprovada para desenvolvimento, acabamento visual sujeito a validação no protótipo:**
- Mesmo DNA visual premium do EMPROVEX, porém com linguagem mais executiva, limpa, precisa e orientada a gestão.
- Azul-marinho profundo `#020817`, superfícies `#071225`, contrastes claros, linhas e bordas finas, profundidade e iluminação controlada.
- Preservar Montserrat e hierarquia forte: títulos claros, números com presença, legendas legíveis e espaçamentos consistentes.
- Superfícies mais sóbrias, sombras refinadas, indicadores compactos e gráficos com boa legibilidade; tabelas eficientes e responsivas.
- Efeitos decorativos **mínimos e seletivos**; sem bolhas azuis, gradientes esféricos, filamentos, brilhos excessivos nem animação competindo com dados.
- Thinking Orb de Início **não replicado como decoração espalhada**. Loaders administrativos, se necessários, discretos/monocromáticos e com redução de movimento.
- Border Beam monocromático, `low`, aproximadamente 24 s, somente superfícies excepcionais/foco quando houver ganho real; sem contornos animados em toda a tela.
- Microinterações rápidas (tipicamente 160–300 ms), entrada de modais discreta (~220 ms), carregamento não bloqueante, suporte a `prefers-reduced-motion`, foco por teclado e contraste WCAG.
- Responsividade de desktop à operação móvel; temas claro/escuro consistentes e estados completos: carregando, vazio, erro, sucesso, indisponível, sem dados e sem permissão.

**Protótipo visual discutido:** EMPROVEX Command Prévia 1 — Visão geral, Clientes, Ficha 360°, Financeiro e versão móvel. Foi oferecido como artefato de conversa; **o protótipo não está publicado no repositório nem vinculado à produção por este memorial**. Exigir validação humana antes de congelar direção estética.

## 7. Eficiência Firestore e estratégia técnica de crescimento

Achados no código atual:
- `PlatformAdminView.tsx` concentra múltiplas seções em componente grande.
- `subscribePlatformAdminDirectory` escuta coleções inteiras `workspaces` e `platformAccounts`;
- billing escuta `billingAccounts` e `billingCycles` como coleções completas;
- sessões usam `collectionGroup(..., 'sessionSlots')`;
- telemetria de consumo estimado pode ler **um documento por workspace elegível** no carregamento;
- `ensurePlatformBillingFoundation` faz transações por workspace a partir de fluxo associado ao diretório.

**Direção:** rotas/componentes por domínio, consultas paginadas, filtros e índices, resumos materializados enxutos, históricos e sessões carregados sob demanda, telemetria agregada, processamento idempotente e desacoplado dos carregamentos de interface. Separar rotinas de provisionamento/migração financeira do simples ato de abrir a Administração.

Coleções conceituais adicionais (nomes em discussão): `platformCustomers`, `customerContacts`, `customerActivities`, `customerSupportTickets`, `adminCustomerSummaries`. Não substituir automaticamente `workspaces`, `platformAccounts`, `billingAccounts` e `billingCycles`; projetar ponte de compatibilidade.

A abertura do painel **não** deve exigir leituras proporcionais a todo o histórico de pagamentos, sessões ou dados operacionais de todos os workspaces. Medir leituras, writes, latência, tamanho e custo antes/depois, inclusive em bases sintéticas crescentes.

Escalas ilustrativas de planejamento (não limites técnicos certificados):
- 0–50: operação manual assistida, ficha 360°, financeiro e suporte simples;
- 50–500: filtros, paginação, resumos e automação de tarefas;
- 500–5.000: jobs assíncronos, observabilidade e permissões por equipe;
- acima de 5.000: avaliar busca/analítica separada e retenção avançada conforme evidência.

## 8. Financeiro e inteligência

Contratos vigentes a preservar:
- **Plano Completo R$ 70/mês por workspace**, salvo condições existentes;
- trial padrão 30 dias;
- isenção fundada/legado VIP protegida;
- pagamento externo Link/Pix e confirmação administrativa;
- billing `observe` como padrão atual, **sem suspensão automática por inadimplência**;
- manutenção da distinção entre cobrança, suspensão comercial e lifecycle operacional.

Indicadores por nível:
- negócio: clientes, trial, pagantes, VIPs, inadimplência, cancelamentos, MRR e recebimentos separados;
- produto: ativação, frequência/adoção por workspace, módulos usados, sem inferir usuário individual por sessão de setor compartilhada;
- operação: custo Firebase, sessões, disponibilidade medida, atendimentos, incidentes e backup.

Health Score somente como **proposta**, não dado certificado. Pesos exemplificativos: ativação 30%, recursos essenciais 30%, regularidade 20%, suporte 10%, financeiro 10%; calibrar com dados reais e marcar `sem dados` quando telemetria insuficiente. Não consultar conteúdo sensível de NF, empenhos e estoques para compor indicadores de adoção.

## 9. Escopo, fases e gates

### Etapa A — Fundação
Contratos Cliente/Workspace/Conta/OM; papéis e auditoria; rotas e consultas paginadas; desenho seguro da delegação administrativa. Mapeamento de invariantes antes de implementação.

### Etapa B — Experiência Clientes
Diretório; ficha 360°; filtros; histórico; onboarding; protótipo e aprovação estética; acesso Global Superadmin em infraestrutura devidamente protegida.

### Etapa C — Gestão comercial e atendimento
Financeiro reorganizado; onboarding monitorado; histórico financeiro e CRM compacto; suporte; indicadores de negócio e adoção.

### Etapa D — Inteligência e escala
Health Score validado; alertas; automações; resumos materializados; relatórios históricos e papéis futuros.

### Gates não negociáveis
1. Nenhuma intervenção altera dados de outro workspace por engano; contratos e UG vinculada permanecem isolados.
2. Acesso Global Superadmin **não usa impersonação e não desativa Rules/validações**; autorização server-side demonstrada com testes positivos e negativos.
3. Testar escrita legítima, tentativa de acesso por usuário comum, revogação de privilégio, troca de tenant, logs e falhas parciais.
4. Operações de estoque, alocação, transferência, saída, inventário, documento e assinatura preservam integridade e idempotência.
5. Nenhuma alteração retroativa em VIPs/isentos; sem suspensão por inadimplência implícita.
6. Sem alteração em produção, autenticação, Firestore, Rules ou billing durante apenas a fase documental/prototipação.
7. Testes CI, Core Protection, Recovery/Security, Emulator e QA navegador conforme risco; relatórios de leitura e custo Firestore antes/depois.
8. Não assumir estado PASS, deploy ou feature ativa até evidência e GO explícito.

## 10. Handoff operacional padrão

**ONDE ESTAMOS:** programa Admin 2.0 formalizado em memorial especializado; código da Administração atual é referência, não foi alterado.

**O QUE ESTAMOS FAZENDO:** planejamento da reestruturação administrativa e estudo estético EMPROVEX Command; definição do Superadmin Global conforme decisão expressa do Fundador.

**QUEM ESTÁ FAZENDO:** Fundador decide prioridade, comportamento e valida estética; coordenação/arquitetura detalharão contratos; futuros workers separados para interface, backend de autorização, financeiro/dados, Firestore/performance e QA independente.

**O QUE FAZER A SEGUIR:** validar a proposta estética navegável; transformar este escopo em especificações e critérios de aceite por tela/API; desenhar ameaça e delegação Superadmin; medir baseline Firestore; somente depois criar branches de implementação e homologar isoladamente.

**QUEM FARÁ:** coordenação Admin 2.0 + workers designados após priorização do Fundador. **Nenhuma implementação, merge, deploy ou migração autorizada somente por este documento.**

---

## 11. Regra de leitura histórica

O documento `ADMIN_INFORMATION_ARCHITECTURE.md` descreve a arquitetura anterior **implementada** e suas garantias. O presente documento representa uma **decisão nova de produto para desenvolvimento futuro**. A frase histórica “nenhum bypass administrativo para dados operacionais” permanece verdadeira sobre a implementação existente, mas não veta o futuro recurso Global Superadmin — que exigirá desenho de autorização explícita e novas provas de isolamento. Não tratar projeto aprovado conceitualmente como funcionalidade já implantada.
