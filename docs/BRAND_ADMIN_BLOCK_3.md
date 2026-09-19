# EMPROVEX — Bloco 3: Administração integrada

## Objetivo

Alinhar a área exclusiva da conta fundadora à mesma família visual do login e do App Shell, preservando integralmente autorização, isolamento multi-tenant e lógica administrativa.

O resultado é uma **central de comando da plataforma**, não uma cópia da tela de login.

## Identidade visual

A Administração agora utiliza:

- fundo profundo `#020817`;
- superfícies `#071225` translúcidas;
- iluminação azul controlada;
- linhas de energia discretas;
- microtipografia técnica;
- profundidade por borda, blur e sombra;
- transições suaves com respeito a `prefers-reduced-motion`.

O cabeçalho deixa de depender de um bloco textual isolado como identidade principal e passa a renderizar o **logotipo global oficial** quando disponível.

A origem continua sendo `settings/global.logo`, resolvida pelo mesmo mecanismo de branding já usado no restante do sistema.

## Feedback administrativo

Mensagens transitórias de sucesso e erro passam a usar o componente compartilhado:

`components/layout/ToastNotification.tsx`

Isso unifica o feedback entre:

- login;
- aplicação operacional;
- Administração.

Foram removidas as mensagens transitórias locais baseadas em `successMessage`.

## Confirmações

A confirmação nativa `window.confirm()` usada para suspensão e reativação de setores foi removida.

Em seu lugar existe um `alertdialog` visualmente integrado ao EMPROVEX, com:

- identificação da operação;
- nome e conta do setor;
- descrição clara do efeito;
- ação explícita de cancelamento;
- ação explícita de confirmação;
- estado de carregamento.

A confirmação de exclusão permanente continua sendo um `alertdialog` próprio e recebeu a mesma linguagem visual.

## Modais administrativos

Os modais de criação e edição de setor preservam toda a lógica anterior, mas agora usam:

- overlay `#020817` translúcido;
- blur mais consistente;
- painel `#071225`;
- bordas de baixo contraste;
- sombras profundas compatíveis com o login.

Nenhuma validação foi alterada.

## Carregamento da rota administrativa

A tela de validação do perfil também passa a utilizar a marca oficial e a mesma atmosfera visual.

## Segurança preservada

Este bloco não altera:

- `resolveWorkspaceContext`;
- critério de `platformAdmin`;
- Firebase Auth;
- Firestore Rules;
- vínculo UID;
- provisionamento de setores;
- exclusão server-side;
- isolamento de workspace;
- subscriptions operacionais;
- Google Drive;
- regras de suspensão/reativação.

A Administração continua sem abrir subscriptions de empenhos, notas fiscais, comissões ou cronogramas.

## Invariantes atendidos

- **BRAND-001** — identidade visual única;
- **BRAND-004** — Administração usa a marca oficial;
- **BRAND-005** — feedback visual compartilhado;
- **BRAND-007** — acessibilidade preservada;
- **BRAND-009** — Administração isolada da operação;
- **GAP-BRAND-002** — linguagem administrativa anterior;
- **GAP-BRAND-005** — feedback administrativo independente.

A numeração de execução passou a chamar esta entrega de **Bloco 3** porque o novo Bloco 2 foi inserido para corrigir a arquitetura da aba Empenhos. Os invariantes congelados não foram alterados.

## Fora de escopo

A capacidade técnica de upload/remoção do logotipo ainda existe no runtime do App Shell.

Ela será removida no próximo bloco, que tornará a identidade institucional somente leitura na aplicação.
