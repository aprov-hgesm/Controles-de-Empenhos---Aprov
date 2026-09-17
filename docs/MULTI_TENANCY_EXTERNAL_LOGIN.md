# EMPROVEX — Bloco 15: Login de setores externos

## Objetivo

Permitir que uma conta Google de setor, previamente cadastrada pelo painel Administração EMPROVEX, autentique no sistema e seja encaminhada exclusivamente ao seu próprio workspace.

O Bloco 15 não cria contas automaticamente e não grava `firebaseUid`. A vinculação persistente do UID é responsabilidade do Bloco 16.

## Fluxo de autorização

O acesso operacional segue esta sequência:

```text
Google Sign-In
  -> Firebase Auth autenticado
  -> e-mail verificado
  -> platformAccounts/{email}
  -> accountType = sector
  -> status = active
  -> workspaces/{workspaceId}
  -> status = active
  -> authorizedEmail compatível
  -> contexto do workspace associado à sessão Firebase
  -> subscriptions e writes operacionais liberados
```

Qualquer falha nessa cadeia resulta em `unauthorized`, limpeza do contexto operacional e encerramento da sessão.

## Implementação

A resolução externa está concentrada em:

- `lib/platformAccess.ts` — consulta e valida `platformAccounts` e `workspaces`;
- `lib/workspaceContext.ts` — mantém em memória o contexto já validado da sessão;
- `hooks/useOperationalData.ts` — somente abre subscriptions após a resolução do diretório;
- `lib/operationalPaths.ts` — writes recuperam o contexto associado ao UID da sessão;
- `scripts/verify-external-sector-login.mjs` — gate estático do Bloco 15.

## Compatibilidade do HGeSM

A identidade fundadora `aprov1hgesm@gmail.com` continua com dois modos de interface:

- perfil operacional no workspace `hgesm-aprov`;
- perfil Administração EMPROVEX.

O HGeSM já opera exclusivamente em paths workspace-scoped, com:

```text
legacyDataMode: false
legacySettingsMode: false
```

O Bloco 15 não altera seus dados, contadores, PDFs ou permissões administrativas.

## Setores externos

Um setor externo precisa existir previamente em dois registros coerentes:

```text
platformAccounts/{email}
workspaces/{workspaceId}
```

A conta precisa estar `active`, ser do tipo `sector` e apontar para o mesmo `workspaceId` cujo `authorizedEmail` corresponde à conta autenticada.

O frontend não aceita um `workspaceId` informado manualmente pelo usuário. O workspace é obtido do diretório administrativo e depois protegido pelas Firestore Rules.

## Segurança

O Bloco 15 aplica fail-closed:

- conta não cadastrada: negada;
- e-mail não verificado: negado;
- conta desativada: negada;
- workspace inexistente: negado;
- workspace desativado: negado;
- divergência entre conta e workspace: negada;
- `firebaseUid` já existente e diferente do UID atual: negado no cliente;
- subscriptions operacionais antes da resolução: não são abertas.

As Firestore Rules continuam sendo a barreira autoritativa para os dados. Não existe bypass administrativo nas subcoleções operacionais de outros setores.

## Limite deliberado do Bloco 15

A autorização inicial ainda pode ocorrer por e-mail verificado quando a conta não possui `firebaseUid` persistido. O Bloco 15 não grava esse UID.

O Bloco 16 deverá:

1. vincular o UID de forma segura no primeiro login;
2. registrar os metadados de primeiro/último acesso definidos para a plataforma;
3. endurecer as Firestore Rules para que, depois da vinculação, o UID se torne obrigatório em vez de existir uma alternativa por e-mail.

## Gate

Executar:

```bash
npm run verify:external-sector-login
npm run typecheck
npm run build
npm run typecheck
```

Resultado esperado do gate específico:

```text
EXTERNAL SECTOR LOGIN: READY
```

## Critério de conclusão

O código do Bloco 15 é considerado validado quando o gate específico, TypeScript e build passam sem erro.

A homologação prática com uma segunda conta Google real será feita antes da liberação ampla de novos setores e permanece separada do vínculo definitivo de UID do Bloco 16.
