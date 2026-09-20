# Bloco 17.2 — Coordenação multiaba da sessão

## Objetivo

Evitar que várias abas do mesmo navegador executem em paralelo a mesma infraestrutura de presença Firestore.

Baseline: `main@7e424b30b00e32c9a1b94044c7a1f0c55d4f1e0a`.

O Bloco 17.1 reduziu cada renovação normal para 0 reads explícitas + 1 write a cada 15 minutos. O Bloco 17.2 complementa essa economia garantindo que, para uma mesma sessão lógica do navegador, **somente uma aba mantenha heartbeat e listener de revogação**.

## Eleição de líder

A estratégia principal usa a **Web Locks API** com lock exclusivo por:

- workspaceId;
- UID Firebase.

Todas as abas da mesma sessão lógica disputam o mesmo lock.

A primeira aba que obtém o lock se torna `leader`. As demais aguardam como `follower`.

Quando a líder fecha ou desmonta o runtime, o lock é liberado pelo navegador e uma follower assume automaticamente.

## Fallback

Em browsers sem Web Locks, existe fallback por `localStorage`:

- registro da aba líder;
- TTL de 12 segundos;
- renovação local a cada 4 segundos;
- confirmação após escrita para reduzir corrida.

Esse fallback não toca Firestore.

## Comunicação entre abas

A comunicação principal usa `BroadcastChannel`.

Fallback: evento `storage`.

O evento compartilhado atualmente é:

- `session-invalidated`.

Quando a líder detecta:

- tombstone de revogação;
- perda terminal do lease;

ela transmite a invalidação às outras abas antes de encerrar a própria sessão.

Followers não precisam manter listener Firestore de tombstone para receber esse evento.

## Recursos exclusivos da líder

Somente a líder mantém:

1. `subscribeWorkspaceSessionRevocation()`;
2. timer de renovação do lease;
3. renovação disparada por `online`;
4. renovação disparada por `visibilitychange`.

Ao assumir liderança, a nova líder chama imediatamente `renewWorkspaceSessionLeaseIfDue()`. Como o timestamp de renovação é compartilhado no `localStorage`, essa chamada só grava Firestore se o lease realmente estiver devido.

## O que permanece por aba

Este bloco deliberadamente **não centraliza os listeners das coleções operacionais**.

Também continuam por aba, por enquanto:

- workspace lifecycle;
- platform account lifecycle;
- branding;
- classes/configurações específicas;
- coleções operacionais do módulo ativo.

A centralização dessas superfícies pertence aos blocos 17.3 e 17.4. Misturá-las ao 17.2 aumentaria significativamente o risco funcional.

## Testes

O Browser E2E passa a verificar:

- duas abas autenticadas da mesma instância possuem exatamente um `leader` e um `follower`;
- ao fechar a líder, a follower assume liderança automaticamente;
- revogação administrativa observada pela líder também derruba a follower via canal local;
- o limite de 2 sessões por setor continua funcionando;
- uma segunda aba do mesmo browser continua ocupando apenas uma vaga lógica.

O papel `leader/follower` é espelhado em `sessionStorage` apenas para diagnóstico e E2E. Ele não é fonte de autoridade.

## Firestore

O 17.2 não altera `firestore.rules`.

A economia vem da redução de duplicação no navegador:

- uma sessão lógica com 1 aba: comportamento equivalente ao 17.1;
- uma sessão lógica com N abas: apenas 1 heartbeat owner e 1 listener de tombstone.

Não é feita afirmação de economia exata de billing porque Rules e demais listeners continuam separados.

## Segurança preservada

Continuam inalterados:

- limite externo de 2 sessões por workspace/UG;
- fundador ilimitado;
- aquisição transacional;
- lease 30 min / renovação 15 min;
- identidade sessionId/browserInstanceId;
- takeover de slot expirado;
- logout explícito;
- revogação remota;
- tombstone imutável;
- isolamento multi-tenant;
- Google Drive exclusivo para documentos.

## Fora do escopo

- centralização das coleções operacionais;
- branding estático;
- paginação/histórico;
- billing;
- deploy Vercel.

## Critério de conclusão

O bloco só pode ser mesclado se:

- existir uma eleição exclusiva de líder;
- followers não iniciarem heartbeat/revocation listener;
- houver failover automático;
- revogação for propagada entre abas;
- E2E provar líder/follower e failover;
- E2E provar revogação multiaba;
- todos os guards anteriores, build e TypeScript permanecerem verdes;
- nenhum deploy de produção for realizado.
