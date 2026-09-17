# EMPROVEX — Document Storage Provider

## Estado atual — Blocos 14B a 14D

O EMPROVEX reconhece dois providers documentais:

- `vercel-blob` — legado temporário, mantido apenas para leitura e migração dos PDFs históricos;
- `google-drive` — provider oficial para novos PDFs de Nota de Empenho e Nota Fiscal.

A ausência do campo `storage` continua significando documento legado do Vercel Blob, usando o `pathname` histórico como `objectKey`.

## Google Drive por workspace

Cada setor possui configuração própria em:

```text
/workspaces/{workspaceId}/settings/documentStorage
```

A conta Google conectada ao Drive precisa ser a mesma conta autorizada do workspace. O EMPROVEX usa somente o escopo OAuth `drive.file`.

A estrutura provisionada é:

```text
EMPROVEX
├── Notas de Empenho
└── Notas Fiscais
```

Os IDs das pastas podem ser persistidos no Firestore. O access token não é salvo em Firestore, localStorage ou sessionStorage; existe somente em memória durante a sessão da página.

## Metadata documental

Documentos ativos podem registrar:

```ts
storage: {
  provider: 'vercel-blob' | 'google-drive',
  status: 'active' | 'scheduled-for-deletion' | 'deleted',
  objectKey: string,
  folderKey?: string,
  workspaceId?: string,
  sha256?: string,
  deletedAt?: string,
  deletedBy?: string,
}
```

No Google Drive:

- `objectKey` = `fileId` do Drive;
- `folderKey` = `folderId` da pasta de destino;
- `workspaceId` = proprietário lógico do documento;
- `sha256` = hash calculado pelo EMPROVEX.

## Cutover oficial

A partir do Bloco 14D, novos uploads de NE/NF não utilizam mais `@vercel/blob/client`.

Se o Google Drive estiver desconectado, o upload deve falhar com orientação para reconectar o Drive. Não existe fallback silencioso para Blob.

Leitura de documentos é roteada pelo provider:

- `google-drive` → Drive API usando a sessão temporária do workspace;
- `vercel-blob` ou ausência de metadata → APIs legadas privadas do EMPROVEX.

As rotas Vercel Blob continuam temporariamente no código porque ainda são necessárias para ler e migrar o acervo legado.

## Migração automática Blob → Drive

O painel do Google Drive do setor possui uma migração assistida em lote.

Fluxo por documento:

```text
Vercel Blob
  ↓ download autenticado
SHA-256 da origem
  ↓
Google Drive
  ↓
verificação de tamanho
  ↓
download de conferência
  ↓
SHA-256 do arquivo gravado
  ↓
Firestore recebe metadata google-drive
```

A migração opera por registro (Empenho ou Nota Fiscal). Se qualquer PDF do registro falhar antes da gravação do Firestore, os arquivos Drive criados naquele lote são excluídos e o registro continua apontando para o Blob.

O processo é retomável: documentos já marcados como `google-drive` são ignorados em novas execuções.

## Política de segurança da migração

Nesta etapa:

1. nenhum PDF do Vercel Blob é apagado automaticamente;
2. a migração só altera a referência no Firestore depois de verificar tamanho e SHA-256 do arquivo rebaixado do Drive;
3. erros de um registro não interrompem necessariamente os demais;
4. arquivos Drive órfãos criados por um registro que falhou são removidos;
5. o `pathname` histórico do documento migrado é preservado, permitindo auditoria e futura limpeza controlada do Blob;
6. a exclusão definitiva dos arquivos do Blob ocorrerá somente após auditoria confirmar `0` documentos legados pendentes.

## Gates

Execute:

```bash
npm run verify:drive-poc
npm run verify:storage-provider
npm run verify:workspace-drive
npm run verify:drive-cutover
npm run audit:legacy-runtime
npm run typecheck
npm run build
```

Resultados principais esperados:

```text
DRIVE POC SAFETY: READY
STORAGE PROVIDER ABSTRACTION: READY
WORKSPACE DRIVE STORAGE: READY
DRIVE CUTOVER MIGRATION: READY
LEGACY RUNTIME GUARD: READY
```

## Etapa posterior

Depois de migrar todo o acervo e executar uma auditoria independente, será possível remover:

- PDFs físicos remanescentes do Vercel Blob;
- rotas legadas de documentos Blob;
- `@vercel/blob` do projeto;
- `BLOB_READ_WRITE_TOKEN` da configuração da Vercel.

Essa remoção não faz parte do Bloco 14D e não deve ocorrer antes da auditoria final.
