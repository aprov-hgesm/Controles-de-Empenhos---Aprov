# Bloco 17.1 — Eficiência do lease e heartbeat de sessão

## Objetivo

Reduzir drasticamente as operações periódicas do controle de sessões externas sem enfraquecer o limite de **2 sessões lógicas por workspace/UG**.

Baseline de entrada: `main@815ac5ba9b4e1c3ff9b3151a9be447dc12eebf9a`.

O Bloco 17.0 registrou o comportamento anterior: lease de 10 minutos, heartbeat de 5 minutos e renovação reutilizando a aquisição completa, com **3 reads explícitas + 1 write por ciclo**.

## Novo desenho

### Aquisição inicial

Permanece transacional e inalterada conceitualmente.

A sessão lê:

1. `sessionRevocations/{sessionId}`;
2. `sessionSlots/slot-1`;
3. `sessionSlots/slot-2`.

A transação decide entre slot já pertencente à sessão, slot vazio ou slot expirado. Se os dois slots estiverem ativos por outras identidades lógicas, a terceira sessão continua bloqueada.

Custo explícito de aquisição: **3 reads + 1 write**.

### Renovação conhecida

Depois que a sessão já possui um slot, ela não redescobre capacidade.

`renewKnownWorkspaceSessionLease()` executa um `updateDoc()` diretamente no slot salvo localmente e envia novamente toda a identidade imutável:

- leaseVersion;
- slotId;
- sessionId;
- workspaceId;
- UG;
- UID;
- e-mail da conta;
- browserInstanceId.

Os únicos campos que podem mudar efetivamente são:

- `lastSeenAt`;
- `expiresAt`.

Isso é importante porque todos os operadores de um mesmo setor podem compartilhar o mesmo UID/e-mail Firebase. Se uma sessão antiga tentar renovar um slot que já foi retomado por outra sessão lógica, o `sessionId` ou `browserInstanceId` não coincidirá com o documento atual e as Firestore Rules negarão o write.

### Janela temporal

Runtime atual após o 17.1:

- lease: **30 minutos**;
- intervalo nominal de renovação: **15 minutos**.

As Rules aceitam `expiresAt` entre 25 e 35 minutos à frente de `request.time`, acomodando pequena diferença entre relógio cliente e servidor sem permitir leases arbitrariamente longos.

Eventos `visibilitychange` e `online` continuam tentando renovação somente quando `shouldRenewWorkspaceSessionLease()` indica que o intervalo venceu.

## Economia explícita

### Antes — baseline 17.0

Por sessão/hora:

- 12 ciclos;
- 36 reads explícitas;
- 12 writes explícitas;
- 48 operações periódicas explícitas.

### Depois — 17.1

Por sessão/hora:

- 4 renovações;
- **0 reads explícitas de renovação**;
- 4 writes explícitas;
- 4 operações periódicas explícitas.

Redução:

- reads explícitas de renovação: **100%**;
- writes de renovação: **66,67%**;
- operações periódicas explícitas: **91,67%**.

Cenários somente de renovação:

| Cenário | Reads | Writes |
| --- | ---: | ---: |
| 50 sessões × 8h | 0 | 1.600 |
| 100 sessões × 8h | 0 | 3.200 |
| 100 sessões × 24h | 0 | 9.600 |

Aquisições iniciais continuam fora desses números e preservam 3 reads + 1 write por nova sessão lógica.

## Security Rules

O Bloco 17.1 **não remove `canAccessWorkspace()`** da validação do lease.

Isso significa que as Rules continuam podendo fazer dependent document reads para validar workspace e conta. A economia não é obtida enfraquecendo o isolamento multi-tenant, e sim:

1. eliminando as três reads explícitas em cada renovação normal;
2. reduzindo a frequência de 12 para 4 renovações por hora.

Portanto, “0 reads explícitas de renovação” não significa “0 custo de Rules”.

## Concorrência e takeover

Foi adicionado cenário de emulator que prova:

1. um slot expirado pode ser retomado por uma nova sessão;
2. a sessão antiga, mesmo autenticada com o mesmo UID/e-mail setorial, **não consegue renovar o slot retomado**;
3. a sessão vencedora consegue renová-lo diretamente.

Esse teste protege especificamente contra a regressão mais perigosa do modelo de write direto.

## Revogação administrativa

O listener de tombstone continua ativo.

O encerramento remoto continua:

1. criando `sessionRevocations/{sessionId}`;
2. removendo o slot;
3. registrando auditoria imutável;
4. fazendo a sessão cliente sair.

Uma renovação contra slot inexistente passa a ser tratada como `SESSION_LEASE_LOST` e encerra a sessão de forma fail-closed.

## Logout

O logout explícito continua usando validação transacional antes de apagar o slot. Nenhuma otimização deste bloco transforma o logout em delete cego.

## Recuperação rara

Se o runtime perde apenas o registro local do slot, a renovação direta não é tentada às cegas. O sistema volta à aquisição transacional completa para reconstruir o estado.

Esse fallback pode consumir novamente 3 reads, mas não faz parte do caminho periódico normal.

## O que não pertence ao 17.1

Não foram implementados neste bloco:

- eleição de aba líder;
- BroadcastChannel;
- compartilhamento de listeners entre abas;
- remoção do Firestore do branding;
- otimização das coleções operacionais;
- alteração de billing.

Esses pontos permanecem para 17.2+.

## Critério de conclusão

O Bloco 17.1 só pode ser mesclado se:

- acquisition continuar transacional;
- renovação normal usar `updateDoc`, sem `transaction.get`;
- telemetria da renovação registrar 0 reads explícitas e 1 write;
- lease/renovação estiverem em 30/15 minutos;
- Rules preservarem identidade completa e acesso ao workspace;
- stale owner não puder renovar slot retomado;
- takeover, logout e revogação continuarem cobertos;
- suíte multi-tenant, Browser E2E, build e TypeScript permanecerem verdes;
- nenhum deploy Vercel for executado.
