# EMPROVEX — Bloco 19 — Ciclo de vida administrativo dos setores

## Objetivo

Permitir que a Administração EMPROVEX altere dados institucionais e controle o acesso de setores externos sem apagar documentos, trocar identidades ou quebrar vínculos já estabelecidos.

## Operações administrativas

O painel oferece, para workspaces externos:

- editar cadastro institucional;
- suspender setor;
- reativar setor.

O workspace fundador `hgesm-aprov` é protegido e não pode ser alterado por esse fluxo.

## Campos editáveis

A edição permite alterar:

- nome exibido do workspace;
- nome institucional;
- sigla;
- nome da seção;
- local padrão de entrega;
- cargo/função padrão do responsável.

Permanecem imutáveis:

- `workspaceId`;
- conta Google autorizada;
- `firebaseUid`;
- dados de criação;
- vínculo com o workspace.

## Suspensão e reativação

Workspace e `platformAccount` possuem o mesmo status.

A alteração é executada em uma única transação Firestore:

```text
workspaces/{workspaceId}.status
platformAccounts/{authorizedEmail}.status
```

Estados permitidos:

```text
active
disabled
```

A transação é bloqueada se os registros estiverem ausentes ou inconsistentes.

## Efeito imediato

As Firestore Rules exigem workspace e conta com status `active` para qualquer acesso operacional.

Além disso, setores externos mantêm listeners sobre seus próprios metadados administrativos. Quando uma conta ou workspace passa para `disabled`, o cliente:

1. limpa o contexto resolvido;
2. limpa os dados operacionais em memória;
3. encerra a sessão Firebase.

Assim, uma sessão já aberta também é encerrada após a suspensão.

## UID obrigatório para dados operacionais

O bootstrap do primeiro login continua podendo consultar apenas os metadados necessários para vincular o UID.

Depois disso, coleções operacionais exigem `firebaseUid == request.auth.uid`. A exceção histórica da identidade fundadora é restrita explicitamente ao workspace `hgesm-aprov`.

## Regras administrativas

Atualizações administrativas de workspace podem afetar somente:

```text
name
status
institutionalProfile
updatedAt
```

Atualizações administrativas de `platformAccounts` podem afetar somente:

```text
status
updatedAt
```

As Rules também exigem que o status de workspace e conta seja idêntico após a gravação.

Exclusão administrativa permanece desabilitada.

## Validação

```bash
npm run verify:sector-lifecycle
npm run verify:uid-binding
```

Resultados esperados:

```text
SECTOR LIFECYCLE: READY
UID BINDING: READY
```

Como o bloco altera `firestore.rules`, as Rules devem ser publicadas antes do frontend.
