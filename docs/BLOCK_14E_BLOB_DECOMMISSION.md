# Bloco 14E — Descomissionamento do armazenamento legado

## Status

**CONCLUÍDO** para o workspace `hgesm-aprov`.

O objetivo deste bloco foi encerrar o armazenamento documental legado somente depois de concluir e validar a migração integral dos PDFs para o Google Drive por workspace.

## Evidências de conclusão

A auditoria pré-descomissionamento confirmou:

```text
Empenhos no workspace:       59
Notas Fiscais no workspace:  138
NEs com PDF atual:            47
NFs com PDF atual:            3
PDFs únicos referenciados:    50
Google Drive:                 50
Referências legadas:          0
Achados bloqueantes:          0
```

A validação funcional também confirmou visualização, download e impressão de documentos migrados diretamente pelo EMPROVEX.

A limpeza física do provedor antigo foi executada e verificada:

```text
Cópias físicas pendentes: 0
Referências no Drive:      50
Processados:               50/50
Excluídos:                 50
Já ausentes:               0
Falhas:                    0
```

## Arquitetura resultante

O Google Drive tornou-se o único provider documental ativo do EMPROVEX.

O runtime atual:

- exige metadata `storage` válida;
- aceita somente `provider: 'google-drive'`;
- utiliza `fileId` como `objectKey`;
- mantém `folderId`, `workspaceId` e SHA-256 quando aplicável;
- não possui fallback de leitura para o provider anterior;
- não possui rotas API específicas do armazenamento descomissionado;
- mantém o token do Drive apenas em memória durante a sessão.

## Validação final

Os gates permanentes do projeto são:

```bash
npm run verify:storage-provider
npm run verify:workspace-drive
npm run audit:legacy-runtime
npm run typecheck
npm run build
```

Critério final esperado:

```text
Provider documental: google-drive
Referências legadas no Firestore: 0
Rotas legadas: ausentes
Fallback legado: ausente
Dependência do provider anterior: ausente
Typecheck: OK
Build: OK
Auditoria documental final: READY
```

## Observação operacional

O campo `pathname` dos documentos migrados pode conservar valor histórico para rastreabilidade, porém não é utilizado como fonte física do arquivo. A leitura e demais operações documentais usam exclusivamente a metadata do Google Drive.
