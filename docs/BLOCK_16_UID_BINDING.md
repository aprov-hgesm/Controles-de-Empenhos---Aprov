# EMPROVEX — Bloco 16 — Vinculação segura de identidade

## Objetivo

Vincular a conta operacional de um setor ao UID real da sessão Firebase no primeiro acesso autorizado e, a partir daí, exigir esse mesmo UID em todos os acessos posteriores.

## Fluxo

Para setores externos:

```text
Google Sign-In
  -> e-mail verificado
  -> platformAccounts/{email}
  -> conta active / accountType=sector
  -> workspaces/{workspaceId}
  -> workspace active / authorizedEmail coerente
  -> se não existe firebaseUid: gravar UID da sessão
  -> se existe firebaseUid: exigir correspondência exata
  -> liberar contexto operacional
```

O vínculo ocorre em transação Firestore. Conta e workspace são lidos e validados antes da gravação.

## Primeiro login

No primeiro login válido, o próprio setor pode alterar somente:

- `firebaseUid`;
- `firstLoginAt`;
- `lastLoginAt`;
- `updatedAt`.

O valor de `firebaseUid` precisa ser exatamente `request.auth.uid`.

Campos como e-mail, `workspaceId`, status, `createdAt` e `createdBy` permanecem imutáveis para o próprio setor.

## Logins posteriores

Depois que `firebaseUid` existe, as Rules exigem simultaneamente:

- e-mail autenticado igual ao e-mail cadastrado;
- UID autenticado igual ao `firebaseUid` persistido.

Conhecer o e-mail do setor não é suficiente para acessar o workspace.

Em logins válidos posteriores, o próprio setor pode atualizar somente `lastLoginAt` e `updatedAt`.

## Conta fundadora

A identidade fundadora do HGeSM preserva o fluxo multiperfil já consolidado. O Bloco 16 endurece o fluxo de setores externos sem alterar a alternância HGeSM/Administração EMPROVEX.

## Segurança

O Bloco 16 é fail-closed:

- UID divergente bloqueia a resolução;
- conta desativada bloqueia o vínculo;
- workspace desativado bloqueia o vínculo;
- relação conta/workspace incoerente bloqueia o vínculo;
- falha de transação não libera subscriptions operacionais;
- o administrador da plataforma continua sem bypass de leitura nas subcoleções operacionais de outros setores.

## Validação

Gate local:

```bash
npm run verify:uid-binding
```

Resultado esperado:

```text
UID BINDING: READY
```

Como o bloco altera `firestore.rules`, sua ativação em produção depende da publicação explícita das Rules no banco EMPROVEX correto.
