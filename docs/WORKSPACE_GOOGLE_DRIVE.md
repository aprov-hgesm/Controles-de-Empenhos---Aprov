# EMPROVEX — Bloco 14C: Google Drive por workspace

## Objetivo

Provisionar uma estrutura de Google Drive própria para cada workspace operacional sem migrar documentos existentes e sem persistir credenciais OAuth de longa duração.

## Modelo de autorização

- O usuário já precisa estar autenticado no EMPROVEX pelo Firebase Auth.
- A conexão do Drive exige reautenticação explícita com Google OAuth.
- O único escopo solicitado é `https://www.googleapis.com/auth/drive.file`.
- O e-mail retornado pelo Google deve corresponder ao e-mail autorizado do workspace.
- O access token fica somente em memória React durante a sessão da página.
- Não existe refresh token persistido no Firestore, localStorage, sessionStorage ou banco da aplicação.

Após reload do sistema, o workspace continua configurado, mas o Drive fica desconectado até nova autorização do usuário.

## Estrutura criada no Google Drive

Cada conta de setor recebe uma estrutura criada pelo próprio EMPROVEX:

- `EMPROVEX`
  - `Notas de Empenho`
  - `Notas Fiscais`

As pastas possuem `appProperties` com:

- `ownerApp = EMPROVEX`
- `emprovexWorkspaceId = <workspaceId>`
- `emprovexFolderRole = root | empenhos | invoices`

Isso permite reencontrar a mesma estrutura após uma nova autorização sem depender de nomes ou de token anterior.

## Metadados no Firestore

A configuração não sensível fica em:

`/workspaces/{workspaceId}/settings/documentStorage`

Campos:

- `provider = google-drive`
- `status = configured`
- `workspaceId`
- `accountEmail`
- `rootFolderId`
- `empenhosFolderId`
- `invoicesFolderId`
- `configuredAt`
- `updatedAt`

O runtime valida se `workspaceId` e `accountEmail` correspondem ao workspace autenticado antes de aceitar a configuração.

## Comportamento visual

O cabeçalho operacional exibe o estado:

- Configurar Drive
- Drive configurado: metadados existem, mas a sessão OAuth não está ativa
- Drive conectado: access token temporário disponível em memória

O usuário pode desconectar a sessão Drive sem sair do EMPROVEX. Essa ação descarta somente o token temporário; a estrutura de pastas e os metadados do workspace permanecem.

## Compatibilidade com armazenamento atual

O Bloco 14C **não altera o provedor oficial de uploads**.

- Novos PDFs de NE continuam no Vercel Blob.
- Novos PDFs de NF continuam no Vercel Blob.
- PDFs antigos continuam onde estão.
- `/drive-poc` permanece disponível como ambiente experimental isolado.

A utilização do Google Drive para os uploads oficiais será ativada apenas em bloco posterior, após validação do provisionamento por workspace.

## Segurança e isolamento

- Cada workspace utiliza seu próprio caminho de settings protegido pelas Firestore Rules existentes.
- O Google Drive só pode ser conectado pela mesma conta Google autorizada para o workspace.
- As pastas são marcadas com o `workspaceId` e reencontradas somente dentro da autorização `drive.file` do usuário.
- Nenhum administrador da plataforma recebe automaticamente acesso ao conteúdo do Drive de outro setor.
- Não há credencial permanente armazenada pelo EMPROVEX.

## Gate

Executar:

```bash
npm run verify:workspace-drive
```

Resultado esperado:

`WORKSPACE DRIVE STORAGE: READY`
