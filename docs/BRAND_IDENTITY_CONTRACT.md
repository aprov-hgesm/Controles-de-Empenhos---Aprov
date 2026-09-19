# EMPROVEX — Contrato de Identidade Visual e Branding v1

## Status

**Congelado no Bloco 0.**

Este contrato registra o estado atual das superfícies de identidade do EMPROVEX e define os invariantes que os próximos blocos devem respeitar. O Bloco 0 é deliberadamente documental: **não altera runtime, layout, autenticação, permissões, Firestore Rules ou dados**.

A fonte estruturada é `ops/brand-identity-contract.json`.

## Objetivo

Unificar três áreas que hoje evoluíram em velocidades diferentes:

1. notificações e avisos após ações;
2. Administração da Plataforma;
3. logotipo global do EMPROVEX.

A referência estética é a família visual já consolidada no login e no App Shell: superfícies escuras, profundidade, luz azul controlada, tipografia técnica, microinterações discretas e leitura clara.

A Administração continuará sendo uma central de comando e não uma cópia da tela de login.

## Estado auditado no início do Bloco 0

### Notificações

O componente compartilhado existe em:

`components/layout/ToastNotification.tsx`

Ele já possui:

- animação de entrada e saída;
- `role` e `aria-live`;
- distinção de sucesso, erro e informação;
- fechamento manual;
- barra de duração.

O gap é visual: as superfícies atuais são claras e destoam da linguagem escura do login.

### Administração

A rota administrativa é:

`app/admin/page.tsx`

e a superfície principal está em:

`components/admin/PlatformAdminView.tsx`

O acesso continua restrito ao perfil administrativo da conta fundadora. A área não abre subscriptions operacionais de outros workspaces.

Visualmente, porém, ela mantém uma camada anterior da identidade e ainda exibe um bloco textual `EMP` no cabeçalho em vez do logotipo global.

### Logotipo

A resolução atual passa por:

- `hooks/usePlatformBranding.ts`;
- `components/layout/chrome/AppShellLogo.tsx`;
- documento Firestore `settings/global`, campo `logo`.

A configuração global é legível antes do login, o que permite a mesma marca na autenticação e no ambiente autenticado.

No estado atual ainda existem:

- upload de imagem no `AppShellLogo`;
- botão de remoção/restauração;
- `handleLogoUpload`;
- `handleRemoveLogo`;
- escrita em `settings/global` permitida à conta fundadora.

Esses pontos serão removidos no Bloco 3, depois da unificação visual.

## Invariantes congelados

| ID | Invariante | Regra |
| --- | --- | --- |
| BRAND-001 | Identidade visual única | Login, operação e Administração pertencem à mesma família visual |
| BRAND-002 | Fonte única do logotipo | A marca oficial é resolvida pela configuração global e reutilizada |
| BRAND-003 | Logo não editável no runtime | Não haverá upload, troca ou remoção casual pela aplicação |
| BRAND-004 | Administração usa marca oficial | Não haverá placeholder paralelo quando a marca oficial estiver disponível |
| BRAND-005 | Feedback compartilhado | Avisos transitórios convergem para um componente visual comum |
| BRAND-006 | Semântica preservada | Sucesso, erro, atenção e informação continuam distinguíveis por mais de um sinal |
| BRAND-007 | Acessibilidade | ARIA, foco, contraste e reduced-motion continuam preservados |
| BRAND-008 | Sem mudança de autorização | Refatoração estética não amplia acesso nem muda autenticação |
| BRAND-009 | Admin isolado da operação | Visual novo não introduz leitura operacional cross-workspace |
| BRAND-010 | Troca de marca deliberada | Mudança futura do logo exige manutenção consciente |

## Limites de segurança

Os blocos visuais não podem modificar:

- provedor de autenticação;
- critérios de conta fundadora;
- perfil `platformAdmin`;
- isolamento multi-tenant;
- autorização de dados operacionais;
- regras de acesso aos workspaces;
- identidade ou persistência de empenhos, NFs, comissões ou cronogramas.

No Bloco 3 haverá uma mudança de segurança **restritiva**: `settings/global` deixará de aceitar escrita pelo runtime. Essa alteração reduz a superfície de mutação da marca e não amplia permissões.

## Plano congelado

### Bloco 1 — Notificações EMPROVEX 2.0

Modernizar o componente compartilhado para a linguagem escura/cinematográfica do login, preservando semântica e acessibilidade.

### Bloco 2 — Administração integrada

Levar a Administração para a mesma família visual, utilizar o logotipo oficial e convergir feedback administrativo para o sistema compartilhado, sem tocar na autorização.

### Bloco 3 — Logo institucional permanente

Remover upload, câmera, botão de exclusão, handlers de escrita e tornar `settings/global` somente leitura no runtime.

### Bloco 4 — Validação final

Executar regressão responsiva, acessibilidade, `prefers-reduced-motion`, contraste, build, TypeScript e guards.

## Gaps reconhecidos

- **GAP-BRAND-001:** toast visualmente incompatível com o login;
- **GAP-BRAND-002:** Administração usa linguagem anterior e placeholder `EMP`;
- **GAP-BRAND-003:** shell ainda permite upload e remoção do logo;
- **GAP-BRAND-004:** hook e Firestore ainda permitem mutação da marca pela conta fundadora;
- **GAP-BRAND-005:** Administração possui feedback e confirmações visuais próprios.

Declarar esses gaps não significa aceitá-los como estado final. Eles são o ponto de partida controlado para os próximos blocos.

## Não objetivos do Bloco 0

Este bloco não:

- altera `ToastNotification.tsx`;
- altera `PlatformAdminView.tsx`;
- altera `AppShellLogo.tsx`;
- altera `usePlatformBranding.ts`;
- altera `firestore.rules`;
- muda CSS;
- troca a imagem armazenada;
- muda login ou logout;
- muda qualquer regra operacional.

## Critério de aceite

O Bloco 0 está concluído quando:

1. contrato estruturado e versionado existe;
2. baseline e gaps estão documentados;
3. os 10 invariantes estão congelados;
4. existe um guard permanente;
5. o CI executa esse guard;
6. nenhuma superfície de runtime foi alterada.
