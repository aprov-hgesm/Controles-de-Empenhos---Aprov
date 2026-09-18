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

1. Sidebar estrutural premium.
2. Navegação premium da Sidebar.
3. Card do Operador e rodapé do Sistema.
4. Header estrutural premium.
5. Núcleo visual da marca no Header.
6. Controles inteligentes do Header.
7. Linha de energia e microinterações.
8. Camada artística de assinatura.
9. Responsividade e refinamento mobile.
10. Acessibilidade, desempenho e homologação.

## Critério de sucesso

Ao sair da tela de login e entrar na plataforma, o usuário deve perceber continuidade de produto: o login funciona como porta de entrada e o Header/Sidebar como a moldura permanente da mesma identidade visual.
