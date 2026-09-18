# EMPROVEX — Bloco 18 — Onboarding do Google Drive por setor

## Objetivo

Permitir que cada workspace operacional conecte sua própria Conta Google e ative o armazenamento documental sem compartilhar credenciais, pastas ou metadados com outros setores.

## Fluxo

No primeiro acesso do setor, `settings/documentStorage` ainda não existe. O cabeçalho operacional exibe a ação **Ativar Google Drive**.

A ativação:

1. exige reautenticação Google;
2. exige a mesma conta e o mesmo UID da sessão Firebase;
3. solicita somente o escopo `drive.file`;
4. cria ou reutiliza pastas marcadas pelo `workspaceId`;
5. persiste somente os IDs das pastas e metadados do workspace;
6. mantém o access token apenas em memória.

Estrutura:

```text
EMPROVEX
├─ Notas de Empenho
└─ Notas Fiscais
```

## Persistência

O documento oficial é:

```text
/workspaces/{workspaceId}/settings/documentStorage
```

Ele contém somente:

- provider = google-drive;
- status = configured;
- workspaceId;
- accountEmail;
- rootFolderId;
- empenhosFolderId;
- invoicesFolderId;
- configuredAt;
- updatedAt.

Nenhum access token ou refresh token é persistido.

## Segurança

As Firestore Rules tratam `documentStorage` separadamente dos demais settings.

A gravação exige:

- acesso válido ao próprio workspace;
- provider google-drive;
- workspaceId igual ao path;
- accountEmail igual ao e-mail autenticado;
- IDs de pasta válidos;
- timestamps;
- conjunto fechado de campos.

O documento não pode ser excluído pelo runtime. Em reconexões, `configuredAt` é preservado.

A regra genérica de settings exclui explicitamente `documentStorage`, evitando bypass.

## Setores externos

O controle do Drive recebe diretamente o `workspaceContext` já validado pelo login multi-tenant. Ele não reconstrói autorização apenas pelo e-mail, evitando estado obsoleto durante o primeiro login externo.

## Validação

```bash
npm run verify:workspace-drive-onboarding
npm run verify:workspace-drive
```

Resultados esperados:

```text
DRIVE ONBOARDING: READY
WORKSPACE DRIVE STORAGE: READY
```

Como o bloco altera `firestore.rules`, as Rules devem ser publicadas antes do frontend.
