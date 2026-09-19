# EMPROVEX — Bloco 5: Validação final de experiência

## Objetivo

Encerrar a sequência de refinamento visual com uma auditoria transversal de:

- responsividade;
- acessibilidade;
- movimento reduzido;
- navegação por teclado;
- semântica de diálogos;
- consistência de notificações;
- identidade administrativa;
- imutabilidade do logotipo;
- regressão de build e TypeScript.

Este bloco não cria uma nova identidade. Ele valida e endurece o comportamento das entregas anteriores.

## Correções encontradas pela auditoria

### 1. Movimento reduzido nas subabas de Empenhos

As subabas **Cadastrar Empenho** e **Configurar Classes** utilizavam animação de entrada, mas ainda não consultavam a preferência do sistema operacional.

Foi adicionado `useReducedMotion()`.

Quando redução de movimento está ativa:

- a entrada usa somente fade curto;
- deslocamento vertical é removido;
- a duração é reduzida.

### 2. Navegação de teclado nas subabas de Empenhos

O conjunto já utilizava `tablist / tab / tabpanel`, mas foi completado com o padrão de teclado para tabs horizontais.

Agora:

- `ArrowRight` avança;
- `ArrowLeft` retorna;
- `Home` seleciona a primeira subaba;
- `End` seleciona a última subaba;
- somente a tab ativa permanece no fluxo principal de Tab (`tabIndex=0`);
- tabs inativas usam `tabIndex=-1`;
- o foco visual é explícito;
- `aria-orientation="horizontal"` documenta a orientação.

### 3. Semântica dos modais administrativos

Os modais de **Cadastrar novo setor** e **Editar setor** receberam:

- `role="dialog"`;
- `aria-modal="true"`;
- `aria-labelledby`;
- `aria-describedby`;
- IDs estáveis para título e descrição.

Nenhuma validação ou persistência desses fluxos foi alterada.

## Auditoria das entregas anteriores

### Notificações

Confirmado:

- componente compartilhado entre login, operação e Administração;
- estados success/error/info;
- `role=status` / `role=alert`;
- `aria-live`;
- botão de fechamento acessível;
- `useReducedMotion()`;
- layout móvel com margens laterais seguras.

### Empenhos

Confirmado:

- Visão geral, Cadastrar Empenho e Configurar Classes são subabas persistentes;
- não existem overlays extensos nesses dois fluxos;
- revisão JSON possui overflow horizontal controlado;
- navegação por teclado e movimento reduzido estão ativos.

### Administração

Confirmado:

- mesma família visual do login/App Shell;
- logo oficial compartilhado;
- feedback via ToastNotification;
- suspensão/reativação usa `alertdialog`, não `window.confirm()`;
- exclusão mantém confirmação explícita;
- área continua sem subscriptions operacionais cross-workspace.

### Logotipo institucional

Confirmado no código e nos testes do Firestore Emulator:

- fonte única `settings/global.logo`;
- leitura disponível antes do login;
- nenhum input de upload;
- nenhum botão de remoção;
- nenhum handler cliente de mutação;
- nenhum helper `savePlatformLogo`;
- `settings/global` usa `allow write: if false`.

## Responsividade

A auditoria preserva os breakpoints e fallbacks existentes do App Shell:

- mobile principal abaixo de 640 px;
- fallback para telas extremamente estreitas abaixo de 370 px;
- sidebar fixa somente em desktop;
- tabs de Empenhos usam overflow horizontal em viewport estreita;
- toast ocupa a largura útil no mobile;
- header administrativo oculta rótulos secundários quando necessário.

## Acessibilidade sistêmica

São preservados os guards existentes para:

- `prefers-reduced-motion`;
- `prefers-reduced-transparency`;
- `prefers-contrast: more`;
- `forced-colors: active`.

Este bloco adiciona proteção específica para que as subabas de Empenhos não regressem no suporte a reduced-motion e teclado.

## Segurança e domínio

Nenhuma alteração deste bloco modifica:

- Firebase Auth;
- provider de login;
- Firestore Rules;
- workspaces;
- UID binding;
- dados de empenhos;
- notas fiscais;
- NS;
- Google Drive;
- provisionamento de setores;
- lógica de exclusão;
- formato de documentos.

## Observação de produção sobre Firestore Rules

O repositório contém o bloqueio `allow write: if false` para `settings/global`.

A validação deste bloco confirma o código e o comportamento no **Firestore Emulator**. A regra só protege o ambiente Firebase de produção depois de ser publicada no projeto correspondente.

A ausência de deploy automático de Rules no repositório é tratada como uma etapa operacional externa, não como autorização para reintroduzir escrita no runtime.

## Critério de aceite final

O ciclo está validado quando:

1. guard deste bloco passa;
2. guards dos blocos anteriores passam;
3. testes Firebase passam;
4. build de produção passa;
5. TypeScript termina com zero erros;
6. diff hygiene passa;
7. Recovery guardrails passa.
