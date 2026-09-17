# EMPROVEX — Paths operacionais por workspace (Bloco 7)

## Objetivo

O Bloco 7 remove do runtime operacional o conhecimento direto de paths globais do Firestore e introduz uma camada única de resolução por workspace.

A mudança é conservadora: nenhum documento do HGeSM é movido neste bloco.

## Workspace fundador — compatibilidade legada

Enquanto a migração física não for executada, o workspace `hgesm-aprov` continua usando exatamente as coleções atuais:

```text
/empenhos
/alerts
/invoices
/comissoes
/cronogramas
/settings/termoRecebimentoCounter
```

O contexto do HGeSM mantém `legacyDataMode=true`. A nova camada traduz esse contexto para os paths existentes, portanto o comportamento e os dados atuais são preservados.

## Futuros workspaces

Um workspace não legado terá seus dados resolvidos para:

```text
/workspaces/{workspaceId}/empenhos/{id}
/workspaces/{workspaceId}/alerts/{id}
/workspaces/{workspaceId}/invoices/{id}
/workspaces/{workspaceId}/comissoes/{id}
/workspaces/{workspaceId}/cronogramas/{id}
/workspaces/{workspaceId}/settings/termoRecebimentoCounter
```

Essa estrutura evita colisão entre setores e prepara o isolamento efetivo das regras do Firestore.

## Implementação central

O arquivo `lib/operationalPaths.ts` é a única camada responsável por decidir onde um dado operacional deve ser lido ou escrito.

Ele fornece:

- resolução do escopo operacional da sessão atual;
- validação do UID esperado antes de writes;
- paths de coleções e documentos;
- referências Firestore para coleções e documentos;
- path do contador de Termo de Recebimento por workspace.

## Leituras em tempo real

`hooks/useOperationalData.ts` deixou de abrir listeners em strings globais fixas.

Agora os listeners são criados a partir do `workspaceContext` e da camada `operationalPaths`.

No HGeSM isso continua produzindo os paths legados. Quando a resolução persistente de novos setores for ativada em bloco posterior, o mesmo hook poderá abrir diretamente as subcoleções do workspace correspondente.

## Escritas e transações

`lib/firebaseSync.ts` também deixou de construir diretamente os paths operacionais.

Foram cobertos:

- empenhos;
- alertas;
- notas fiscais;
- comissões;
- cronogramas;
- batches de recebimento/exclusão;
- transação do Termo de Recebimento;
- contador de TR.

Antes de um write, a camada valida que:

1. existe uma sessão Firebase ativa;
2. o UID da sessão corresponde ao UID que iniciou a operação;
3. a identidade atual resolve para um contexto operacional `sector`.

## Configuração global da plataforma

`settings/global` permanece intencionalmente fora do workspace neste bloco, pois contém identidade visual/configuração global da plataforma e não dados operacionais de um setor.

## O que este bloco NÃO faz

O Bloco 7 não:

- migra os dados do HGeSM;
- ativa login operacional para novos setores;
- altera os documentos PDF no Vercel Blob;
- amplia permissões Firestore para subcoleções de novos workspaces;
- altera a numeração histórica de TR do HGeSM.

As regras de segurança para os novos paths serão tratadas no Bloco 8 antes que qualquer setor externo possa operar.

## Critério de compatibilidade

Para `hgesm-aprov`, a resolução deve permanecer:

```text
legacyDataMode = true
empenhos -> /empenhos
invoices -> /invoices
settings -> /settings
```

Assim, o Bloco 7 é uma preparação arquitetural sem migração física nem mudança de dados em produção.
