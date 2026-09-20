# Bloco 17.2 — Coordenação multiaba de sessão

## Objetivo

Reduzir a duplicação de listeners e trabalho de presença quando o mesmo operador abre várias abas do EMPROVEX no mesmo navegador, sem mudar o limite de duas sessões por UG.

Baseline: `main@7e424b30b00e32c9a1b94044c7a1f0c55d4f1e0a`.

O Bloco 17.1 já reduziu o heartbeat normal para 0 reads explícitas + 1 write a cada 15 minutos. Porém, cada aba ainda mantinha separadamente:

1. listener do workspace;
2. listener da conta `platformAccounts`;
3. listener do tombstone de revogação;
4. timers/eventos locais relacionados ao heartbeat.

O 17.2 centraliza esse plano de controle.

## Arquitetura

### Eleição de líder

Quando o navegador oferece simultaneamente:

- Web Locks API;
- BroadcastChannel;

cada aba disputa um Web Lock exclusivo:

`emprovex-session-leader:{workspaceId}:{uid}`

Somente a aba que possui o lock executa as responsabilidades de controle Firestore.

O lock é local ao perfil/navegador. Outro computador ou outro contexto de navegador não compartilha essa eleição e continua representando outra sessão lógica, exatamente como antes.

### Responsabilidades da aba líder

A líder mantém:

- listener do documento do workspace;
- listener da conta da plataforma;
- listener da revogação do `sessionId`;
- timer de renovação do lease;
- renovação oportunista em `visibilitychange`;
- renovação oportunista ao voltar `online`.

### Responsabilidades das abas seguidoras

As seguidoras:

- não abrem esses três listeners Firestore de controle;
- não mantêm timer próprio de renovação;
- recebem invalidação da líder por BroadcastChannel;
- tentam assumir o Web Lock a cada 4 segundos.

Se a líder fechar, travar ou liberar o lock, uma seguidora assume a liderança automaticamente e reabre somente os três listeners necessários.

## Revogação e ciclo de vida

A líder publica uma mensagem `session-invalid` quando detecta:

- tombstone de revogação;
- perda terminal do lease;
- suspensão/alteração incompatível do workspace;
- suspensão/alteração incompatível da conta.

Todas as abas da mesma sessão lógica recebem a mensagem pelo canal escopado por workspace + UID e executam o mesmo fail-closed já existente: limpam estado local e encerram Firebase Auth.

Assim, centralizar listeners não transforma a aba seguidora em uma sessão menos protegida.

## Fallback conservador

Se Web Locks ou BroadcastChannel não estiverem disponíveis, o EMPROVEX usa modo `fallback`.

Nesse modo cada aba continua mantendo seu próprio plano de controle, como antes do 17.2.

Isso significa:

- menos economia naquele navegador;
- nenhuma dependência de polyfill;
- nenhuma perda de heartbeat;
- nenhuma perda de revogação;
- nenhuma perda do watcher de suspensão.

A otimização nunca prevalece sobre segurança.

## Redução de listeners de controle

Antes do 17.2:

`listeners de controle = 3 × número de abas`

Depois do 17.2, em modo coordenado:

`listeners de controle = 3 por sessão lógica do navegador`

| Abas no mesmo navegador | Antes | Depois | Redução |
| --- | ---: | ---: | ---: |
| 1 | 3 | 3 | 0% |
| 2 | 6 | 3 | 50% |
| 3 | 9 | 3 | 66,67% |
| 5 | 15 | 3 | 80% |

Esses números representam **instâncias de listeners de controle**, não cobrança oficial. Security Rules, reconnects e snapshots continuam devendo ser observados nas métricas reais.

## Heartbeat

O 17.2 não muda os números do 17.1:

- lease: 30 minutos;
- renovação nominal: 15 minutos;
- renovação normal: 0 reads explícitas + 1 write.

A diferença é que somente a líder mantém a rotina que decide quando renovar. O `localStorage` continua compartilhando o último timestamp de renovação como defesa adicional.

## Testes de failover

O Browser E2E agora prova:

1. duas abas do mesmo contexto convergem para exatamente uma `leader` e uma `follower`;
2. fechar a aba líder promove a seguidora em até a janela de retry;
3. o `sessionId` lógico permanece o mesmo após o failover;
4. a navegação operacional permanece ativa;
5. revogação administrativa observada pela líder derruba também a seguidora.

## Escopo deliberadamente não alterado

O 17.2 não centraliza ainda:

- listeners das coleções operacionais de empenhos/NFs/relatórios;
- listener de classes de empenho;
- listener de configuração do Google Drive;
- branding global.

Esses pontos continuam para 17.3/17.4 porque possuem ciclos de dados diferentes e exigem desenho próprio de cache/broadcast.

## Firestore Rules

`firestore.rules` não é alterado neste bloco.

Todas as mesmas validações de tenant, UID, UG, sessionId e browserInstanceId permanecem vigentes.

## Critério de conclusão

O Bloco 17.2 está concluído quando:

- a eleição usa Web Locks;
- a invalidação usa BroadcastChannel;
- existe fallback seguro;
- somente a líder possui os 3 listeners de controle em modo coordenado;
- failover é automático;
- revogação chega a todas as abas;
- limite de duas sessões continua preservado;
- testes multi-tenant, Browser E2E, build e TypeScript permanecem verdes;
- nenhum deploy Vercel é realizado.
