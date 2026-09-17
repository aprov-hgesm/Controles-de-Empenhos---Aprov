# EMPROVEX — Document Storage Provider

## Objetivo

Preparar o EMPROVEX para operar documentos privados em mais de um provedor sem interromper os PDFs históricos nem alterar prematuramente o fluxo oficial de upload.

## Bloco 14B — estado atual

Providers reconhecidos pelo contrato:

- `vercel-blob`
- `google-drive`

O provider oficial de NE e NF continua sendo `vercel-blob`.

A POC de Google Drive continua isolada em `/drive-poc` e não participa do fluxo operacional de NE/NF.

## Compatibilidade legada

Documentos históricos possuem `pathname`, mas não possuem o campo `storage`.

Regra definitiva de compatibilidade:

> Documento sem `storage` é tratado como `vercel-blob`, `active`, usando o `pathname` histórico como `objectKey`.

Assim, nenhum documento antigo precisa ser migrado para adotar a abstração.

## Metadata de armazenamento

Novos documentos podem registrar:

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

No Vercel Blob, `objectKey` corresponde ao `pathname` validado.

No futuro Google Drive, `objectKey` corresponderá ao `fileId` e `folderKey` ao `folderId`.

## Regras deste bloco

1. Nenhum PDF histórico é movido ou regravado.
2. Nenhum upload oficial é enviado ao Google Drive ainda.
3. Novos uploads feitos pelo Blob passam a registrar explicitamente `storage.provider = "vercel-blob"`.
4. A ausência do bloco `storage` continua válida e significa Blob legado.
5. `sha256`, `workspaceId` e ciclo de exclusão serão habilitados em blocos posteriores.
6. Exclusão de documentos encerrados nunca será automática; dependerá de política e confirmação explícita.

## Próximo bloco

O Bloco 14C poderá introduzir Google Drive por workspace. Antes do cutover de qualquer setor, leitura, upload, exclusão e reconexão serão roteados pelo provider explícito do documento, preservando simultaneamente arquivos históricos no Blob.

## Gate

Execute:

```bash
npm run verify:storage-provider
```

O resultado esperado é:

```text
STORAGE PROVIDER ABSTRACTION: READY
```

O gate bloqueia a etapa caso o fluxo oficial de NE/NF deixe de usar Vercel Blob ou caso código da POC Google Drive vaze para as APIs operacionais antes do cutover planejado.
