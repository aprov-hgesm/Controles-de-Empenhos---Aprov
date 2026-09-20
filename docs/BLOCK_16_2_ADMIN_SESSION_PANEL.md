# BLOCO 16.2 — PAINEL ADMINISTRATIVO DE SESSÕES

## Objetivo

Dar à conta fundadora uma visão centralizada das sessões simultâneas dos setores externos e permitir encerramento remoto seguro sem alterar o limite de duas vagas definido no Bloco 16.1.

## Painel

A Administração passa a exibir uma seção "Sessões simultâneas por UG" com:

- conta fundadora explicitamente marcada como ilimitada;
- quantidade total de sessões externas ativas;
- quantidade de UGs com as duas vagas ocupadas;
- ocupação por workspace/UG no formato 0/2, 1/2 ou 2/2;
- slot ocupado;
- identificador abreviado da sessão;
- horário de início;
- último heartbeat;
- ação administrativa "Encerrar".

Slots expirados permanecem tecnicamente no Firestore até serem reutilizados, porém não são contabilizados como sessões ativas no painel.

## Observabilidade

A conta fundadora usa um único listener de collection group em `sessionSlots`. Isso evita um listener separado para cada UG e mantém o custo administrativo limitado mesmo com crescimento do número de workspaces.

Setores externos continuam sem acesso aos slots de outras UGs.

## Encerramento remoto

O encerramento remoto é uma transação única que:

1. confirma que o slot ainda representa a sessão selecionada;
2. cria `workspaces/{workspaceId}/sessionRevocations/{sessionId}`;
3. exclui o slot ativo, liberando a vaga;
4. grava `session.terminate` em `platformAuditEvents`.

A revogação possui validade lógica de 24 horas e impede a mesma sessão lógica de recriar a vaga.

## Reação do cliente

Cada sessão externa observa o tombstone do próprio `sessionId`. Como o documento normalmente não existe, as Rules permitem `get` pontual em `sessionRevocations` apenas dentro do próprio workspace; `list` continua exclusivo da fundadora.

Quando a revogação aparece:

- o estado local do lease é limpo;
- o acesso operacional é encerrado;
- o Firebase Auth é finalizado;
- o operador retorna ao login.

Se o computador estava offline durante a revogação, a próxima resolução de workspace consulta o tombstone e recusa o antigo `sessionId`. Depois disso, um novo login cria um novo identificador e pode ocupar uma vaga disponível.

## Segurança

As Firestore Rules garantem que:

- somente a conta fundadora pode criar revogações;
- uma exclusão administrativa de slot exige a revogação correspondente na mesma transação;
- o setor pode fazer `get` pontual de revogações somente dentro do próprio workspace, inclusive quando o documento ainda não existe;
- o setor não pode listar revogações e outro workspace não pode lê-las;
- revogações são append-only;
- o evento de auditoria usa a operação `session.terminate` e entityType `session`.

## Fora de escopo

O Bloco 16.2 não:

- altera o limite padrão de 2 sessões;
- cria configuração variável de limite por UG;
- integra Cloud Monitoring;
- calcula reads/writes por UG;
- estima custo do Firebase;
- altera empenhos, NFs, NS, CNPJ ou Google Drive.

A telemetria e o visor de consumo continuam nos próximos subblocos do Bloco 16.
