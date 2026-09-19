# EMPROVEX — Bloco 1: Notificações 2.0

## Objetivo

Unificar o feedback transitório do login e da aplicação autenticada com a linguagem visual consolidada do EMPROVEX, sem alterar a API de chamadas nem qualquer regra de negócio.

## Escopo entregue

O componente compartilhado `components/layout/ToastNotification.tsx` foi modernizado para uma superfície escura, técnica e cinematográfica compatível com o login e o App Shell.

A API continua exatamente com os tipos já usados pelo sistema:

- `success`;
- `error`;
- `info`.

Nenhum chamador precisa ser migrado.

## Direção visual

A nova notificação utiliza:

- fundo azul-marinho/grafite profundo;
- translucidez e blur discretos;
- bordas de baixo contraste;
- linha superior de energia;
- microtipografia técnica;
- ícone semântico;
- título semântico textual;
- ponto de status;
- barra temporal inferior;
- aura cromática sutil por estado.

O significado não depende apenas de cor. Cada estado possui ícone, título e rótulo textual próprios.

## Semântica

### Sucesso

Exibe:

- `CheckCircle2`;
- “Operação concluída”;
- `EMPROVEX // CONFIRMAÇÃO`;
- `role="status"`;
- `aria-live="polite"`.

### Erro / atenção

Exibe:

- `AlertTriangle`;
- “Atenção necessária”;
- `EMPROVEX // ALERTA`;
- `role="alert"`;
- `aria-live="assertive"`.

### Informação

Exibe:

- `Info`;
- “Informação do sistema”;
- `EMPROVEX // SISTEMA`;
- `role="status"`;
- `aria-live="polite"`.

## Acessibilidade

O bloco preserva:

- `aria-atomic="true"`;
- botão de fechamento com rótulo acessível;
- foco visível no botão;
- distinção semântica além de cor;
- contraste alto sobre superfície escura.

Também passa a utilizar `useReducedMotion()`. Quando o usuário solicita redução de movimento:

- entrada e saída usam apenas fade curto;
- não há deslocamento nem escala;
- a barra temporal deixa de animar.

A duração lógica da mensagem continua controlada externamente pelo sistema, portanto nenhuma regra de autenticação ou operação foi alterada.

## Responsividade

Em telas pequenas a notificação ocupa a largura útil com margens laterais seguras e fica próxima ao topo. Em telas maiores volta ao canto superior direito, abaixo do cabeçalho da aplicação.

## Invariantes atendidos

Este bloco entrega os itens previstos no contrato congelado:

- **BRAND-005 — Feedback visual compartilhado**;
- **BRAND-006 — Semântica preservada**;
- **BRAND-007 — Acessibilidade preservada**;
- **GAP-BRAND-001 — Toast visualmente incompatível com o login**.

A convergência dos avisos específicos da Administração para este mesmo componente permanece no bloco de Administração, porque essa área ainda possui feedback próprio.

## Fora de escopo

Este bloco não altera:

- login;
- logout;
- Firebase Auth;
- Firestore;
- regras de segurança;
- workspaces;
- logo;
- Administração;
- lógica de salvamento;
- tempo de vida dos toasts;
- mensagens emitidas pelos fluxos existentes.
