# BLOCO 16.1 — CONTROLE DE SESSÕES SIMULTÂNEAS POR UG

## Objetivo

Ativar o primeiro enforcement real da fundação criada no Bloco 16.0.

Setores externos passam a ter no máximo **2 sessões lógicas simultâneas por workspace/UG**. A identidade fundadora permanece ilimitada e não ocupa slot.

## Modelo de slots

Cada workspace externo possui dois caminhos fixos:

- `workspaces/{workspaceId}/sessionSlots/slot-1`
- `workspaces/{workspaceId}/sessionSlots/slot-2`

O cliente lê os dois slots dentro de uma transação Firestore. Ele:

1. reutiliza o slot da mesma sessão lógica, se existir;
2. ocupa um slot inexistente;
3. reaproveita um slot expirado;
4. falha com `SESSION_CAPACITY_EXCEEDED` quando os dois slots estão ativos.

O uso de dois documentos fixos elimina a corrida de "contar sessões e depois criar": duas tentativas concorrentes disputam os mesmos documentos e o Firestore reexecuta a transação quando necessário.

## Sessão lógica por navegador

O EMPROVEX mantém no `localStorage`:

- `browserInstanceId`, estável para o perfil do navegador;
- `sessionId`, estável por usuário + workspace;
- o slot atualmente ocupado;
- o instante local da última renovação.

Abas do mesmo perfil de navegador compartilham esses identificadores e, portanto, reutilizam o mesmo slot.

Outro navegador, perfil ou contexto isolado recebe outro `browserInstanceId` e ocupa outra vaga.

## Lease e heartbeat

- duração do lease: **10 minutos**;
- heartbeat nominal: **5 minutos**;
- o heartbeat também pode ser tentado quando o navegador volta ao foreground ou recupera conectividade;
- o timestamp compartilhado no `localStorage` evita gravações duplicadas por múltiplas abas;
- falhas transitórias de rede não derrubam a sessão imediatamente;
- perda de capacidade, falta de autorização ou lease inválido encerram o acesso operacional.

O logout explícito tenta excluir o próprio slot antes do `signOut`. Se a rede impedir essa liberação, o slot expira naturalmente. A exclusão administrativa definitiva de um setor também remove os dois documentos de slot para não deixar metadados órfãos.

## Conta fundadora

A identidade fundadora:

- continua ilimitada;
- não cria documentos em `sessionSlots`;
- não executa heartbeat de capacidade;
- não pode ser bloqueada por falta de slot.

A leitura administrativa dos slots é permitida como metadado de capacidade, preparando o Bloco 16.2.

## Firestore Rules

As Rules garantem que:

- só existem `slot-1` e `slot-2`;
- um setor só cria/renova slots no próprio workspace;
- UID, e-mail e UG precisam corresponder à sessão e ao diretório;
- uma sessão diferente não sobrescreve slot ativo;
- slot expirado pode ser retomado;
- o fundador não ocupa slots;
- outro workspace não lê os slots alheios;
- o administrador fundador pode observar os slots para futura gestão.

## UX

Quando uma terceira sessão externa tenta entrar, a autenticação Firebase pode ser aceita, porém o workspace não é liberado. A interface exibe:

> Limite de acessos simultâneos atingido. Este setor já possui 2 sessões ativas no EMPROVEX. Encerre uma das sessões existentes para continuar.

Ao liberar uma das duas sessões, uma nova tentativa consegue ocupar a vaga imediatamente.

## Fora de escopo

O Bloco 16.1 não:

- cria ainda o painel administrativo visual de sessões;
- adiciona encerramento remoto pelo fundador;
- altera o limite por UG na interface;
- integra Cloud Monitoring;
- calcula consumo por UG;
- altera regras de negócio de empenhos, NFs, NS, CNPJ ou Google Drive.

Esses itens permanecem para os próximos subblocos do Bloco 16.
