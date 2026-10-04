# BLOCO 16.0 — FUNDAÇÃO DE CAPACIDADE, SESSÕES E CONSUMO

> **Status vigente — SESSION-CAP-01 (2026-10-04):** este documento preserva a baseline histórica do bloco. Referências a teto de 2 sessões, dois slots fixos, lease de 10 min ou heartbeat de 5 min descrevem o estado histórico e **não** o contrato atual. O contrato RC vigente usa lease dinâmico por `browserInstanceId`, sem teto fixo, lease de 30 min, heartbeat de 15 min e mantém `slot-1`/`slot-2` somente para compatibilidade transitória. Ver `docs/SESSION_CAP_01_RULES_AUDIT_01.md`.


## Objetivo

Criar o contrato técnico que será usado pelos próximos subblocos do Bloco 16 sem alterar o comportamento atual do EMPROVEX.

O 16.0 não bloqueia logins, não cria leases no Firestore, não grava telemetria e não altera Firestore Rules. Ele apenas congela tipos, defaults, semântica e guardrails para que a implementação posterior não nasça acoplada à lógica operacional de empenhos e notas fiscais.

## Regras de produto congeladas

- setores externos começam com limite padrão de **2 sessões simultâneas por UG/workspace**;
- a identidade fundadora é **ilimitada**;
- abrir múltiplas abas do mesmo navegador deverá reutilizar uma única sessão lógica nos subblocos seguintes;
- o limite poderá ser configurado administrativamente por UG;
- orçamento interno de consumo não bloqueia operações críticas por padrão;
- a conta fundadora poderá observar sessões e consumo de todas as UGs.

## Fontes de métricas

O contrato separa duas fontes que nunca podem ser apresentadas como equivalentes:

### Global real

`FirebaseGlobalUsageSnapshot` usa `source: google-cloud-monitoring`.

Esse dado representará métricas observadas no projeto Firebase/Firestore, como reads, writes, deletes, conexões ativas e snapshot listeners.

### Por UG estimado

`WorkspaceUsageEstimate` usa `source: emprovex-workspace-estimate`.

Esse dado será uma atribuição interna do EMPROVEX por workspace/UG e não deverá ser rotulado como faturamento oficial do Google.

## Política de capacidade

`WorkspaceCapacityPolicy` inclui:

- `workspaceId`;
- `ug`;
- `simultaneousSessionLimit`;
- orçamento interno diário opcional para reads, writes e deletes.

`simultaneousSessionLimit = null` significa ilimitado e é o default apenas para a identidade fundadora.

Setores externos recebem `DEFAULT_EXTERNAL_SECTOR_SESSION_LIMIT = 2`.

## Lease de sessão

O contrato `WorkspaceSessionLease` já define os campos mínimos que o 16.1 usará:

- `sessionId`;
- `workspaceId`;
- `ug`;
- `uid`;
- `accountEmail`;
- `browserInstanceId`;
- `startedAt`;
- `lastSeenAt`;
- `expiresAt`.

O 16.0 não persiste esse objeto.

## Faixas de orçamento interno

A função `assessUsageBudget` usa estas faixas:

- abaixo de 70%: normal;
- 70% a <85%: atenção;
- 85% a <95%: elevado;
- 95% a 100%: crítico;
- acima de 100%: excedido;
- orçamento não configurado: unconfigured.

Essas faixas são administrativas e não equivalem às cotas oficiais do Firebase.

## Limites deste subbloco

O 16.0 não:

- altera autenticação;
- limita sessões de verdade;
- cria heartbeat;
- cria novas coleções Firestore;
- altera Rules;
- chama Google Cloud Monitoring;
- altera a área administrativa visual;
- interfere no Google Drive;
- altera empenhos, NFs, NS, CNPJ, auditoria ou listeners do Bloco 14.

## Critério de aceite

O 16.0 está concluído quando:

1. o domínio de capacidade está versionado;
2. o default externo é 2 sessões;
3. a identidade fundadora é explicitamente ilimitada;
4. métricas globais reais e estimativas por UG possuem fontes distintas;
5. existe contrato de lease para o 16.1;
6. existe contrato de orçamento interno;
7. o guard do bloco roda na Application CI;
8. build e TypeScript permanecem verdes.

## SESSION-CAP-01 — atualização pré-RC

Este documento preserva o histórico do Bloco 16.0, mas o contrato de capacidade
foi supersedido antes do RC conjunto SaaS R1 + Mobile R1.

- setores externos: **sem teto fixo de sessões externas**;
- fundador: continua ilimitado e isento de lease operacional externo;
- `DEFAULT_EXTERNAL_SECTOR_SESSION_LIMIT = null`;
- `slot-1` / `slot-2`: apenas **compatibilidade transitória** para rollout/rollback;
- o runtime RC usa um lease dinâmico por `browserInstanceId`;
- lease permanece em **30 minutos**;
- heartbeat permanece em **15 minutos**;
- remover o teto não remove Auth, workspace/UG, UID, revogação, lifecycle, auditoria ou fail-closed.

O SESSION-CAP-01 não transforma capacidade ilimitada em autorização ilimitada:
cada sessão continua individualmente identificada e revogável.
