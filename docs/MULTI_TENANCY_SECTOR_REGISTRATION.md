# EMPROVEX — Cadastro administrativo de setores

## Objetivo

O painel administrativo permite cadastrar novos setores sem editar o código para cada unidade.

## Conta administrativa atual

A administração é exercida pela identidade fundadora:

```text
aprov1hgesm@gmail.com
```

Essa mesma sessão pode alternar entre o perfil operacional HGeSM e o perfil Administração EMPROVEX.

## Diretórios administrativos

No modo Administração, a identidade fundadora pode consultar e criar registros em:

```text
/workspaces/{workspaceId}
/platformAccounts/{emailNormalizado}
```

O cadastro de setor cria somente metadados administrativos; não cria coleções operacionais nem libera automaticamente acesso aos dados do HGeSM.

## Cadastro de setor

O formulário coleta:

- nome do setor;
- `workspaceId`;
- conta Google autorizada;
- nome institucional;
- sigla opcional;
- nome da seção;
- local padrão de entrega opcional;
- cargo/função padrão opcional.

A criação usa uma transação Firestore única. `Workspace` e `SectorAccount` são persistidos juntos ou nenhum dos dois é criado.

Duplicidades bloqueadas:

- `workspaceId` já existente;
- conta Google já vinculada;
- reutilização da conta institucional fundadora como novo setor.

## Materialização dos registros fundadores

O bootstrap atual materializa somente:

```text
platformAccounts/aprov1hgesm@gmail.com
  accountType: sector
  workspaceId: hgesm-aprov

workspaces/hgesm-aprov
  legacyWorkspace: true
```

A capacidade administrativa da conta fundadora é resolvida pelo contexto de perfil e pelas Firestore Rules, sem um segundo documento `platformAdmin`.

## Regras de segurança

`firestore.rules` mantém a conta fundadora como:

- usuária autorizada das coleções operacionais legadas do HGeSM;
- administradora dos diretórios `workspaces` e `platformAccounts`.

Novos setores não recebem essa permissão administrativa.

## Dependência de implantação

Alterar `firestore.rules` no GitHub não atualiza automaticamente o banco Firebase usado pelo EMPROVEX. As regras precisam ser publicadas explicitamente no banco nomeado correto.

## Limite atual

Cadastrar um novo setor cria seu perfil administrativo. A operação multi-tenant desse setor depende dos blocos seguintes de paths por workspace, regras por workspace e resolução persistente de identidade.
