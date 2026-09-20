# Bloco 17.2 — Controle multiaba simplificado

## Objetivo

Preservar o compartilhamento de uma única sessão lógica entre abas do mesmo navegador sem introduzir um coordenador persistente de líder/seguidora.

Baseline: `main@68d7044bc3b6b36e1610a28fb1dfe821eefcb027`.

O Bloco 17.1 já reduziu o heartbeat normal para 0 reads explícitas + 1 write a cada 15 minutos. O 17.2 inicialmente tentou centralizar listeners por Web Locks + BroadcastChannel, mas esse desenho adicionava eleição, failover e estado transitório para economizar somente listeners de controle. A arquitetura foi deliberadamente simplificada em favor de previsibilidade.

## Arquitetura adotada

Cada aba operacional é autônoma e mantém diretamente:

1. listener do workspace;
2. listener da conta `platformAccounts`;
3. listener do tombstone de revogação;
4. timer/eventos locais de heartbeat.

Não existe:

- líder ou seguidora;
- eleição permanente;
- BroadcastChannel;
- lock persistente;
- failover entre papéis;
- marcador de papel em `sessionStorage`.

Fechar uma aba não exige promover outra: as abas restantes já estão protegidas e operacionais.

## Sessão lógica compartilhada

As abas do mesmo navegador continuam compartilhando pelo `localStorage`:

- `browserInstanceId`;
- `sessionId`;
- identificação do slot;
- timestamp da última renovação.

Assim, abrir várias abas no mesmo perfil de navegador continua consumindo **uma única vaga** do limite externo. Outro navegador, perfil ou dispositivo continua representando outra sessão lógica.

## Heartbeat com mutex curto

O único ponto que usa Web Locks é a renovação quando ela está realmente vencida.

Fluxo:

1. a aba verifica o timestamp compartilhado da última renovação;
2. se ainda não venceu, não solicita lock nem escreve no Firestore;
3. se venceu, solicita o lock curto `emprovex-session-renew:{workspaceId}:{uid}`;
4. já dentro do lock, verifica novamente o timestamp;
5. somente a primeira aba ainda vencida executa o write;
6. o lock é liberado imediatamente após a decisão/renovação.

O lock não define papel de aba e não permanece pendente durante a sessão.

Em navegadores sem Web Locks, o sistema continua funcional e seguro. Duas abas podem raramente produzir uma renovação redundante na mesma janela, mas nenhuma regra de capacidade, identidade ou revogação é relaxada.

## Revogação e ciclo de vida

Cada aba observa diretamente o Firestore.

Se o administrador revogar a sessão, todas as abas ativas recebem o tombstone independentemente. Se workspace ou conta forem suspensos ou alterados de forma incompatível, cada aba aplica o mesmo fail-closed.

Não há retransmissão entre abas e, portanto, nenhuma aba depende de outra para detectar uma invalidação.

## Custo deliberadamente aceito

Os listeners de controle permanecem:

`3 × número de abas ativas`

| Abas no mesmo navegador | Listeners de controle |
| --- | ---: |
| 1 | 3 |
| 2 | 6 |
| 3 | 9 |
| 5 | 15 |

Esse custo é aceito porque o 17.1 já removeu a maior fonte periódica de operações do lease, enquanto 17.3 e 17.4 reduzem outros listeners permanentes e subscriptions ociosas. A simplicidade do plano de controle tem prioridade sobre uma economia fina de listeners.

## Testes

O Browser E2E deve provar comportamento observável:

1. duas abas do mesmo navegador compartilham o mesmo `sessionId` e uma única vaga;
2. fechar uma aba não interrompe a outra;
3. revogação administrativa derruba todas as abas da sessão;
4. duas sessões externas continuam sendo o limite;
5. uma terceira sessão independente continua recusada;
6. heartbeat mantém lease de 30 minutos e renovação nominal de 15 minutos.

O teste não depende de papéis internos de aba.

## Firestore Rules

`firestore.rules` não é alterado neste bloco. As validações de tenant, UID, UG, sessionId e browserInstanceId permanecem vigentes.

## Critério de conclusão

O Bloco 17.2 está concluído quando:

- não existe coordenador persistente multiaba;
- cada aba observa lifecycle e revogação diretamente;
- a sessão lógica continua compartilhada entre abas;
- o heartbeat usa apenas mutex curto quando suportado;
- fechar uma aba não exige failover;
- revogação chega a todas as abas;
- limite de duas sessões continua preservado;
- testes multi-tenant, Browser E2E, build e TypeScript permanecem verdes;
- nenhum deploy Vercel é realizado.
