# EMPROVEX — Firestore Rules por workspace

## Estado atual

O EMPROVEX opera com isolamento por workspace em:

```text
/workspaces/{workspaceId}/empenhos/{id}
/workspaces/{workspaceId}/alerts/{id}
/workspaces/{workspaceId}/invoices/{id}
/workspaces/{workspaceId}/comissoes/{id}
/workspaces/{workspaceId}/cronogramas/{id}
/workspaces/{workspaceId}/settings/{id}
```

O HGeSM fundador já usa os paths de workspace com `legacyDataMode=false` e `legacySettingsMode=false`. As coleções raiz permanecem apenas como legado somente leitura para recuperação controlada.

## Princípio de autorização

O acesso operacional de um workspace exige simultaneamente:

1. sessão Firebase autenticada e e-mail verificado;
2. workspace existente e com `status = active`;
3. `platformAccounts/{authorizedEmail}` existente;
4. conta com `accountType = sector` e `status = active`;
5. `account.workspaceId` igual ao workspace solicitado;
6. `account.email` igual ao `authorizedEmail` do workspace;
7. e-mail autenticado igual ao e-mail da conta;
8. se a conta já possui `firebaseUid`, UID autenticado igual ao UID vinculado.

Conhecer ou manipular um `workspaceId` no cliente não concede acesso a outro setor.

## Vinculação de UID — Bloco 16

Antes do primeiro vínculo, uma conta ativa pode consultar somente o próprio `platformAccount` e o metadata do próprio workspace usando o e-mail autenticado correspondente.

No primeiro acesso válido, o setor pode gravar apenas:

```text
firebaseUid
firstLoginAt
lastLoginAt
updatedAt
```

O `firebaseUid` precisa ser exatamente `request.auth.uid`.

Depois do vínculo, a função de identidade exige **e-mail + UID**. O e-mail isolado deixa de ser suficiente.

Em logins posteriores, o próprio setor pode atualizar somente:

```text
lastLoginAt
updatedAt
```

Campos críticos da conta permanecem imutáveis para o setor, incluindo e-mail, `workspaceId`, status, `createdAt`, `createdBy` e o próprio UID vinculado.

## Provisionamento de workspace — Bloco 17

O cadastro administrativo pode criar atomicamente o documento:

```text
/workspaces/{workspaceId}/settings/termoRecebimentoCounter
```

somente quando o workspace e a conta de setor correspondentes também existem após a transação, estão ativos e consistentes. O valor inicial obrigatório é `currentNumber = 0`.

O contador possui regra específica: não pode ser excluído, não pode regredir e a regra genérica de `settings` exclui explicitamente esse ID para evitar bypass. Essa exceção de provisionamento não concede ao administrador acesso às demais configurações ou dados operacionais do setor.

## Administrador da plataforma

A identidade fundadora `aprov1hgesm@gmail.com` administra os diretórios:

```text
/workspaces/{workspaceId}
/platformAccounts/{accountId}
```

Não existe bypass administrativo nas subcoleções operacionais. Administrar os metadados da plataforma não concede acesso automático aos dados dos setores externos.

## Compatibilidade legada

As coleções raiz de empenhos, alertas, NFs, comissões, cronogramas e settings históricos são somente leitura para a identidade fundadora. Writes do runtime normal permanecem bloqueados.

`/settings/global` continua com leitura pública por conter configuração global necessária antes do login.

## Implantação

Alterações em `firestore.rules` só passam a valer depois de publicação explícita no banco EMPROVEX:

```text
Projeto: gen-lang-client-0982077967
Banco: ai-studio-logsticahospital-3eeee498-faa1-4326-8f4f-95d34b382ec1
```

Após o deploy, devem ser repetidos os gates de login externo, vinculação de UID, runtime legado e um smoke test do HGeSM.
