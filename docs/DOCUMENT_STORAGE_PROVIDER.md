# EMPROVEX — Document Storage Provider

## Estado final — Bloco 14E concluído

O EMPROVEX utiliza **Google Drive** como único provider documental ativo para PDFs de Nota de Empenho e Nota Fiscal.

Não existe fallback para outro armazenamento. Documentos sem metadata `storage` válida são tratados como inválidos no runtime documental.

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

Os IDs das pastas são persistidos no Firestore. O access token não é salvo em Firestore, localStorage ou sessionStorage; existe somente em memória durante a sessão da página.

## Metadata documental

Documentos ativos registram metadata equivalente a:

```ts
storage: {
  provider: 'google-drive',
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

O campo `pathname` permanece apenas como identificador lógico/rastreabilidade. A fonte física do PDF é determinada exclusivamente pela metadata `storage`.

## Operações documentais

Uploads, leitura, visualização, impressão, download e exclusão utilizam diretamente a sessão temporária do Google Drive do workspace.

Se o Drive estiver desconectado, operações que exigem acesso aos arquivos falham com orientação para reconectar a conta correta. Não há fallback silencioso.

Novos uploads são verificados por tamanho e SHA-256 antes da metadata ser considerada válida.

## Segurança

- OAuth restrito a `drive.file`;
- conta Google validada contra o e-mail autorizado do workspace;
- token temporário somente em memória;
- pastas marcadas com `workspaceId`;
- metadata de storage vinculada ao workspace;
- integridade documental por SHA-256;
- ausência de rotas server-side específicas para um provider legado.

## Gates

Execute:

```bash
npm run verify:drive-poc
npm run verify:storage-provider
npm run verify:workspace-drive
npm run audit:legacy-runtime
npm run typecheck
npm run build
```

Resultados principais esperados:

```text
DRIVE POC SAFETY: READY
DOCUMENT STORAGE FINAL: READY
WORKSPACE DRIVE STORAGE: READY
LEGACY RUNTIME GUARD: READY
```

## Estado do acervo HGeSM

Na conclusão do Bloco 14E, a auditoria documental confirmou:

```text
PDFs únicos referenciados: 50
Google Drive: 50
Referências legadas: 0
Achados bloqueantes: 0
Limpeza física: 50/50 concluída
```

O Google Drive é, portanto, a fonte documental oficial e exclusiva do EMPROVEX para o workspace HGeSM.
