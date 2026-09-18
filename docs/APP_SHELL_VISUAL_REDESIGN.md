# EMPROVEX — App Shell Visual Redesign

## Objetivo

Elevar Header e Sidebar ao mesmo nível de acabamento visual da tela de login, mantendo a área operacional clara, legível e estável.

O redesign deve aproximar o interior do sistema da identidade do Command Gateway sem transformar o ambiente de trabalho em uma tela excessivamente animada ou escura.

## Bloco 0 — baseline protegido

Baseline congelado a partir da `main` no commit `959f8557ef4d1f26f0b352fa00a69e69e24b1c0e`.

### Invariantes funcionais

Estas regras não devem ser alteradas pelo redesign visual:

- Header permanece fixo no topo.
- Altura estrutural do Header: `4rem` / Tailwind `h-16`.
- Sidebar permanece fixa abaixo do Header.
- Largura estrutural da Sidebar: `18rem` / Tailwind `w-72`.
- Altura da Sidebar: `calc(100vh - 4rem)`.
- Layout desktop continua reservando `18rem` por meio de `lg:pl-72`.
- Sidebar continua com rolagem interna em telas de pouca altura.
- Drawer mobile continua abrindo/fechando pelo estado `sidebarOpen`.
- Navegação continua usando os mesmos valores de `AppTab`.
- Logout continua chamando o handler recebido por `onLogout`.
- Upload e remoção do logotipo continuam usando os handlers existentes.
- Controle do Google Drive continua encapsulado por `WorkspaceDriveControl`.
- Alternância para Administração continua usando o fluxo atual de perfil.
- Nenhuma mudança visual pode alterar Firebase Auth, Firestore, Workspace Context, Drive, regras multi-tenant ou handlers operacionais.

### Arquivos funcionais protegidos

O redesign visual deve evitar mudanças de lógica em:

- `hooks/useOperationalData.ts`
- `lib/platformAccess.ts`
- `lib/firebase.ts`
- `lib/workspaceContext.ts`
- `lib/googleDriveWorkspace.ts`
- regras Firestore
- APIs administrativas

## Bloco 1 — fundação visual

A identidade interna será construída como **Dark Structural Chrome + Light Operational Canvas**.

### Linguagem

Toda a interface visível permanece em português.

Vocabulário preferido:

- Operador
- Sistema
- Central Operacional
- Gestão Logística e Financeira
- Ambiente Seguro
- Sincronização
- Conectado
- Administração

### Princípios visuais

A camada estrutural pode reutilizar elementos do login:

- navy profundo;
- vidro escuro;
- azul institucional;
- cyan discreto;
- bordas refrativas;
- halos suaves;
- grain quase invisível;
- linhas técnicas;
- microtipografia mono;
- reflexos e beams de baixa intensidade;
- microinterações curtas.

A área operacional central permanece clara inicialmente para preservar leitura prolongada de tabelas, formulários e documentos.

### Tokens

Os tokens `--emprovex-shell-*` foram adicionados em `app/globals.css`.

Neste bloco eles são apenas fundação: nenhum componente existente consome os tokens ainda. Portanto, o Bloco 1 não deve causar mudança visual perceptível nem comportamento novo.

### Regras de motion futuras

- Movimento apenas quando agrega hierarquia ou feedback.
- Nada deve piscar continuamente.
- Animações de interação preferencialmente entre 160 e 400 ms.
- Ambientação contínua deve ser muito lenta e de baixa opacidade.
- `prefers-reduced-motion` deve continuar respeitado.

## Próximos blocos

1. ~~Sidebar estrutural premium.~~ **Concluído no Bloco 2.**
2. ~~Navegação premium da Sidebar.~~ **Concluído no Bloco 3.**
3. ~~Card do Operador e rodapé do Sistema.~~ **Concluído no Bloco 4.**
4. ~~Header estrutural premium.~~ **Concluído no Bloco 5.**
5. ~~Núcleo visual da marca no Header.~~ **Concluído no Bloco 6.**
6. ~~Controles inteligentes do Header.~~ **Concluído no Bloco 7.**
7. ~~Linha de energia e microinterações.~~ **Concluído no Bloco 8.**
8. ~~Camada artística de assinatura.~~ **Concluído no Bloco 9.**
9. ~~Responsividade e refinamento mobile.~~ **Concluído no Bloco 10.**
10. Acessibilidade, desempenho e homologação.

## Critério de sucesso

Ao sair da tela de login e entrar na plataforma, o usuário deve perceber continuidade de produto: o login funciona como porta de entrada e o Header/Sidebar como a moldura permanente da mesma identidade visual.


## Bloco 2 — Sidebar estrutural premium

Status: concluído.

Alterações estruturais aplicadas sem modificar handlers, tabs ou regras de navegação:

- superfície navy profunda baseada nos tokens `--emprovex-shell-*`;
- vidro escuro e profundidade lateral;
- borda refrativa direita de baixa intensidade;
- grid técnico quase invisível;
- halos azul/cyan estáticos;
- scrollbar discreta compatível com o novo shell;
- manutenção integral da largura de `18rem`, posição fixa e rolagem interna;
- contraste transitório para os itens atuais, até o redesign específico da navegação no Bloco 3.

Nenhuma lógica de autenticação, Drive, Firestore, workspace ou dados foi alterada.


## Bloco 3 — Navegação premium da Sidebar

Status: concluído.

A navegação recebeu tratamento próprio sem alterar os valores de `AppTab` nem os handlers existentes:

- item ativo com barra luminosa lateral;
- superfície azul translúcida com profundidade e halo discreto;
- ícones com realce e glow controlado;
- hover com deslocamento mínimo e resposta luminosa;
- linha técnica vertical conectando visualmente a navegação;
- rótulo `Navegação` em microtipografia mono;
- `Dashboard` renomeado visualmente para `Painel`, mantendo `activeTab='painel'`;
- `aria-current` no item ativo;
- foco de teclado preservado;
- `prefers-reduced-motion` respeitado.

Nenhuma lógica de autenticação, dados, Drive, Firestore, workspace ou navegação foi alterada.


## Bloco 4 — Card do Operador e rodapé do Sistema

Status: concluído.

A Sidebar agora comunica identidade e estado sem alterar qualquer lógica de sessão:

- card `Operador` com nome do usuário recebido pela prop existente;
- indicador visual de acesso autorizado;
- área `Sistema` com estado `Operacional`;
- microtexto `Ambiente seguro`;
- indicador verde de atividade com animação lenta e suporte a `prefers-reduced-motion`;
- botão `Sair da conta` redesenhado sem alterar o handler `onLogout`;
- metadados compactos `EMPROVEX • v1.2.0 • 2026`;
- toda a interface visível mantida em português.

Nenhuma lógica de autenticação, sessão, Firestore, Drive, workspace, multi-tenant ou dados foi alterada.


## Bloco 5 — Header estrutural premium

Status: concluído.

O Header agora funciona como continuação visual direta da Sidebar:

- superfície navy profunda baseada nos tokens do App Shell;
- glassmorphism escuro e profundidade superior;
- borda inferior refrativa de baixa intensidade;
- grid técnico quase invisível;
- halos azul/cyan estáticos e discretos;
- compatibilidade de contraste para menu, marca, subtítulo e nome do usuário;
- manutenção integral da altura de `4rem`, posição fixa e z-index;
- nenhum handler de logo, Drive, Administração, menu ou sincronização foi alterado.

Os controles individuais do Header e o núcleo visual da marca permanecem reservados para os Blocos 6 e 7.


## Bloco 6 — Núcleo visual da marca no Header

Status: concluído.

A marca no Header recebeu um núcleo visual compacto inspirado no `LoginLogoCore`, sem reutilizar sua escala ou complexidade integral:

- novo componente visual `AppShellLogo`;
- dois anéis técnicos compactos com rotação lenta e opcional;
- halo azul de baixa intensidade;
- eixos técnicos internos;
- superfície refrativa para o logotipo;
- manutenção integral do upload e restauração do logotipo;
- microassinatura em português `Central Operacional`;
- `EMPROVEX` e `Gestão Logística e Financeira` preservados;
- foco de teclado e `prefers-reduced-motion` respeitados.

Nenhuma lógica de autenticação, sessão, Drive, Firestore, workspace, administração ou dados foi alterada.


## Bloco 7 — Controles inteligentes do Header

Status: concluído.

Os controles funcionais do Header receberam linguagem visual unificada sem alterar seus fluxos:

- cápsula de sincronização com estado azul e feedback discreto;
- gatilho do Google Drive estilizado por estado real: conectado, configurado/desconectado, não configurado ou carregando;
- botão `Administração` integrado ao shell navy;
- identidade compacta do `Operador` com nome do usuário;
- ícones, indicadores e chevrons usando a mesma linguagem refrativa do Header;
- dropdown do Drive mantido funcionalmente intacto;
- responsividade preservada: rótulo do Drive continua aparecendo apenas em telas largas;
- foco por teclado e `prefers-reduced-motion` mantidos.

Nenhuma lógica de sincronização, autenticação, Drive, Administração, Firestore, workspace ou dados foi alterada.


## Bloco 8 — Linha de energia e microinterações

Status: concluído.

A moldura visual recebeu a camada de assinatura dinâmica, mantendo baixa intensidade:

- linha de energia de 1 px na base do Header;
- beam luminoso lento, com ciclo aproximado de 11 segundos;
- reflexão curta nos controles do Header em hover/foco;
- resposta tipográfica mínima nos itens da Sidebar;
- glow respiratório muito discreto apenas no ícone da aba ativa;
- microelevação do card do Operador;
- refinamento de hover no estado do Sistema e na identidade do Operador do Header;
- intensificação sutil do halo do núcleo da marca em hover;
- todos os efeitos contínuos desativados com `prefers-reduced-motion`.

Nenhum efeito altera layout, handlers, autenticação, Drive, Firestore, workspace, multi-tenant ou dados.


## Bloco 9 — Camada artística de assinatura

Status: concluído.

A moldura recebeu elementos artísticos técnicos de baixíssima opacidade, específicos do domínio do EMPROVEX:

- novo componente puramente decorativo `AppShellSignature`;
- linhas de rede estáticas no Header e na Sidebar;
- nós luminosos com respiração muito lenta e opcional;
- textura grain de baixa intensidade;
- microcódigos `NE`, `NF`, `TR`, `LIQ` e `EXEC`;
- códigos laterais `NE / PROV`, `NF / REC`, `TR / COM` e `LIQ / EXEC`;
- elementos com `aria-hidden`, `pointer-events: none` e sem participação na navegação;
- simplificação automática em telas menores;
- `prefers-reduced-motion` e `prefers-contrast` respeitados.

Nenhum elemento decorativo acessa estado, banco de dados, autenticação, Drive, handlers ou regras de negócio.


## Bloco 10 — Responsividade e refinamento mobile

Status: concluído.

O App Shell recebeu tratamento progressivo para telas menores sem alterar seu comportamento desktop:

- Header com espaçamento e tipografia compactados em celulares;
- controles funcionais preservados como ícones em telas estreitas;
- subtítulo da marca ocultado antes do título principal;
- em telas extremamente estreitas, a marca textual cede espaço aos controles e o núcleo visual permanece;
- drawer mobile limitado à largura disponível, preservando margem lateral;
- novo cabeçalho mobile `Menu principal` com botão explícito de fechar;
- backdrop mais escuro e refinado;
- áreas de toque da navegação mantidas próximas de 48 px;
- efeitos de hover que deslocam elementos são neutralizados em ponteiros touch;
- foco por teclado e `prefers-reduced-motion` permanecem respeitados;
- desktop continua com Header de 4rem e Sidebar fixa de 18rem.

Nenhuma lógica de navegação, autenticação, Drive, Firestore, workspace, multi-tenant ou dados foi alterada.


## Bloco 11 — Acessibilidade, desempenho e contraste

Status: concluído.

O App Shell recebeu uma camada adicional de robustez e acessibilidade:

- estados do Google Drive agora expõem `aria-expanded`, `aria-controls` e `aria-haspopup`;
- painel do Drive identificado semanticamente como diálogo;
- botão de fechar do Drive recebeu rótulo acessível;
- botão de Administração recebeu `aria-label` explícito para telas onde o texto fica oculto;
- ícones puramente decorativos foram removidos da leitura de tecnologias assistivas;
- suporte a `prefers-reduced-transparency` com superfícies sólidas e sem blur;
- contraste reforçado com `prefers-contrast: more`;
- fallback completo para `forced-colors`/alto contraste do sistema operacional;
- grain desativado em celulares com ponteiro touch para reduzir custo gráfico;
- blur reduzido em mobile;
- `touch-action: manipulation` nos controles principais;
- `will-change` restrito apenas aos elementos realmente animados.

Nenhuma lógica de autenticação, Drive, Firestore, workspace, multi-tenant, navegação ou dados foi alterada.


## Bloco 12 — Homologação visual e integração final

Status: concluído.

A revisão final do Header e da Sidebar foi convertida em uma proteção permanente do repositório:

- novo guard `scripts/verify-app-shell.mjs`;
- validação automática da altura fixa do Header;
- validação da largura e posicionamento fixo da Sidebar;
- proteção da reserva de `18rem` no conteúdo desktop;
- verificação da linha de energia e da assinatura visual;
- verificação da semântica ARIA do Google Drive;
- proteção da indicação `aria-current` na navegação;
- garantia de que a assinatura artística permaneça sem acesso a Firebase, Drive ou workspace;
- verificação dos fallbacks de movimento reduzido, transparência reduzida, contraste reforçado e forced colors;
- verificação dos breakpoints mobile críticos;
- novo comando `npm run verify:app-shell`;
- integração do guard no Application CI antes do build de produção.

Com esse guard, futuras alterações em Header, Sidebar ou CSS do App Shell passam a falhar no CI quando quebrarem uma das invariantes homologadas.

### Estado homologado

O redesign interno do EMPROVEX está encerrado com a seguinte arquitetura:

- Login: apresentação cinematográfica;
- Header: identidade, estado e controles operacionais;
- Sidebar: navegação, operador e estado do sistema;
- área central: produtividade e legibilidade;
- mobile: versão compacta e funcional;
- acessibilidade: reduced-motion, reduced-transparency, high contrast e forced colors;
- elementos artísticos: estritamente decorativos e não interativos.

Nenhuma regra de autenticação, Drive, Firestore, workspace, multi-tenant ou dados foi alterada pela homologação final.
