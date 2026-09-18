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

O cadastro de setor cria metadados administrativos e a relação de autorização. Ele não copia dados do HGeSM nem concede acesso a qualquer outro workspace.

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

A criação usa uma transação Firestore única. `Workspace`, `SectorAccount` e o contador inicial de Termos de Recebimento são persistidos juntos ou nenhum deles é criado. O contador nasce em `currentNumber = 0`.

Duplicidades bloqueadas:

- `workspaceId` já existente;
- conta Google já vinculada;
- reutilização da conta institucional fundadora como novo setor.

A conta Google deve ser cadastrada usando o e-mail principal que efetivamente será devolvido pelo login Google/Firebase. A normalização preserva o nome local da conta e altera apenas caixa/espaços e o domínio histórico `googlemail.com` para `gmail.com`.

## Materialização dos registros fundadores

O workspace fundador permanece materializado em:

```text
platformAccounts/aprov1hgesm@gmail.com
  accountType: sector
  workspaceId: hgesm-aprov

workspaces/hgesm-aprov
  legacyWorkspace: true
```

A capacidade administrativa da conta fundadora é resolvida pelo contexto de perfil e pelas Firestore Rules, sem um segundo documento `platformAdmin`.

O HGeSM já opera nos paths de workspace com `legacyDataMode=false` e `legacySettingsMode=false`. O marcador `legacyWorkspace` identifica apenas a origem histórica do tenant fundador; ele não redireciona o runtime para coleções raiz.

## Regras de segurança

`firestore.rules` mantém a conta fundadora como administradora dos diretórios `workspaces` e `platformAccounts` e mantém os dados operacionais isolados por workspace.

Novos setores não recebem permissão administrativa e não existe bypass do administrador nas subcoleções operacionais de setores externos.

## Login de setores externos — Bloco 15

O login de setores previamente cadastrados está implementado.

Após o Google Sign-In, o EMPROVEX exige:

```text
platformAccounts/{email} existente e active
  -> accountType = sector
  -> workspaceId cadastrado
  -> workspaces/{workspaceId} existente e active
  -> authorizedEmail coerente
  -> contexto operacional associado à sessão
```

Somente depois dessa resolução são abertas as subscriptions do workspace.

O Bloco 16 complementa este fluxo: no primeiro acesso autorizado, o EMPROVEX grava o `firebaseUid` da sessão. Depois do vínculo, a conta precisa corresponder simultaneamente ao e-mail cadastrado e ao UID persistido.

## Provisionamento automático — Bloco 17

Novos setores já nascem com o estado operacional mínimo:

```text
workspace
+ platformAccount
+ settings/termoRecebimentoCounter (currentNumber = 0)
```

As coleções operacionais começam vazias e são materializadas conforme o uso. `settings/documentStorage` não é criado no cadastro.

## Onboarding Google Drive — Bloco 18

No primeiro acesso operacional, o próprio setor pode ativar seu Google Drive usando a mesma Conta Google autorizada. O EMPROVEX cria ou reutiliza `EMPROVEX / Notas de Empenho / Notas Fiscais` e grava os IDs das pastas em `settings/documentStorage` do próprio workspace.

Tokens não são persistidos; após recarregar a aplicação, o setor apenas reconecta a autorização temporária.

## Próximas dependências

Para que um novo setor seja completamente autônomo, ainda serão implementados:

- blocos seguintes de ciclo de vida, testes de isolamento e homologação do segundo setor.
