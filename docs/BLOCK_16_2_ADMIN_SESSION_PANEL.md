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


## Hardening 2026-09-22 — autorização vinculada à sessão

### Ameaça confirmada

O desenho original do Bloco 16.2 fazia o cliente oficial observar o tombstone e executar
`signOut`, mas a função `canAccessWorkspace()` das Firestore Rules não consultava a
sessão operacional. Um cliente que preservasse um ID token Firebase `password` válido
podia continuar tentando acessar o próprio workspace diretamente, mesmo depois de o
administrador excluir o slot daquela sessão.

Isso não demonstrou acesso entre UGs e não altera o isolamento multi-tenant já existente.
A falha estava na granularidade da autorização **dentro do mesmo UID/workspace**: duas
sessões legítimas podem usar o mesmo UID/e-mail e, portanto, o UID sozinho não identifica
qual sessão foi encerrada.

### Identidade autoritativa da sessão

O login visível do operador continua sendo e-mail + senha. Depois que o diretório,
workspace/UG e lease são validados, o cliente executa silenciosamente uma troca de
credencial em `/api/auth/session-credential`.

O servidor:

1. verifica o ID token Firebase `password` apresentado;
2. valida novamente conta, UID, workspace e UG;
3. consulta somente a capacidade dos dois slots e escolhe exclusivamente uma vaga ausente
   ou expirada;
4. gera no servidor novos `sessionId` e `browserInstanceId` — o cliente não escolhe
   nem pode pedir a identidade de um slot já ativo;
5. emite um Firebase custom token assinado com a credencial server-side já existente,
   contendo a vaga escolhida e a identidade nova;
6. já sob o provider `custom`, o cliente materializa o lease exatamente nesse slot.

Os claims de autorização são versionados por `emprovex_session_auth_v1`. O navegador
usa `signInWithCustomToken()` sem nova tela, código, CAPTCHA, MFA ou seleção manual de
slot. O UID e o e-mail permanecem os mesmos.

### Enforcement nas Firestore Rules

Para dados operacionais de setor, a autorização passa a exigir simultaneamente:

- conta/workspace ativos e coerentes;
- UID/e-mail/UG corretos;
- claims de sessão emitidos pelo servidor;
- slot indicado no token ainda existente;
- slot pertencente ao mesmo UID, e-mail, workspace, UG, `sessionId` e navegador;
- `expiresAt > request.time`.

Assim, excluir o slot faz a credencial antiga perder autorização de dados mesmo que o ID
token Firebase ainda não tenha expirado. Uma segunda sessão legítima do mesmo UID continua
válida porque possui outro slot/`sessionId`.

Os caminhos de **bootstrap e manutenção do lease** são deliberadamente separados da
autorização de dados. Em modo final, o token `password` pode somente resolver a identidade
e inspecionar a capacidade necessária ao bootstrap; ele não cria, renova nem exclui slots.
A criação/renovação/liberação pertence ao token `custom` vinculado. Uma credencial
customizada não pode trocar silenciosamente de `sessionId`, navegador, workspace, UG ou
slot.

### Revogação, refresh e limites

A revogação administrativa continua criando o tombstone e excluindo o slot na mesma
transação. O bloqueio autoritativo das novas leituras/gravações depende do estado do slot
nas Rules, não do tempo restante do ID token.

O refresh normal do Firebase preserva a sessão autenticada e os claims de autorização.
Em uma recarga normal, o token `custom` já existente restaura o estado local necessário
ao heartbeat a partir dos próprios claims assinados; `localStorage` não volta a ser
autoridade.

O endpoint de bootstrap aceita somente `password` e sempre cria **uma identidade nova**.
Mesmo que duas sessões compartilhem UID/e-mail, uma credencial `password` não pode pedir
o `sessionId`, o navegador ou o slot de outra sessão legítima. Em corrida pela mesma
vaga, o cliente repete silenciosamente a seleção usando o token inicial mantido apenas em
memória durante a tentativa.

Este mecanismo não promete neutralizar toda credencial deliberadamente compartilhada ou
roubada: uma credencial `password` recém-obtida ainda pode tentar abrir **uma nova sessão**
sujeita ao limite normal de capacidade e às demais validações. O objetivo deste hardening
é garantir que **uma sessão específica já revogada** não herde a autorização de outra
sessão legítima do mesmo UID.

### Custo e desempenho

Não existe polling por entidade nem validação remota em cada clique da UI.

Mudanças de custo esperadas:

- cada avaliação operacional das Rules passa a consultar também o documento do slot
  exato da sessão; isso pode acrescentar uma leitura dependente de Rules;
- o bootstrap consulta pontualmente conta, workspace e os dois slots para escolher uma
  vaga disponível;
- o heartbeat continua com 15 minutos e o lease com 30 minutos;
- o listener de revogação existente continua sendo usado pelo cliente oficial para
  reação imediata de UX.

Métricas estimadas devem continuar separadas das métricas efetivamente observadas no
Google Cloud Monitoring.

### Rollout compatível

A mudança foi construída com um gate interno de Rules,
`requireBoundSessionAuthorization()`, para permitir ativação em duas etapas sem janela
de indisponibilidade:

1. publicar Rules de compatibilidade, que ainda permitem ao cliente legado administrar
   leases e já aceitam a nova credencial vinculada;
2. publicar aplicação/servidor com o bootstrap server-side e a troca silenciosa para
   custom auth;
3. confirmar que não permanecem sessões legadas ativas (janela controlada de rollout);
4. publicar as Rules finais com o gate obrigatório, quando tokens `password` deixam de
   criar/renovar/excluir slots e deixam de autorizar dados operacionais.

Não se deve inverter a ordem: Rules finais antes do cliente novo bloqueariam usuários
legítimos; cliente novo antes das Rules de compatibilidade teria o provider `custom`
recusado pelo modelo anterior.

### Rollback

Se o cutover final precisar ser revertido, o rollback seguro é retornar apenas o gate
`requireBoundSessionAuthorization()` ao modo de compatibilidade. A aplicação nova pode
continuar instalada, pois credenciais vinculadas também são aceitas nesse modo. Não é
necessário excluir dados, slots ou tombstones.

Nenhuma etapa deste documento, por si só, autoriza merge, deploy, publicação de Rules,
alteração de IAM/segredos ou revogação de sessões reais.
