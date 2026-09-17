# Bloco 14E — Descomissionamento do Vercel Blob + Auditoria Final

## Objetivo

Encerrar definitivamente o uso do Vercel Blob no EMPROVEX somente depois de concluída e validada a migração documental do Bloco 14D para o Google Drive por workspace.

## Condições obrigatórias para iniciar

O Bloco 14E não deve começar enquanto qualquer uma destas condições não estiver satisfeita:

- migração Blob → Drive concluída;
- contador de documentos legados pendentes igual a `0`;
- referências Firestore de NE/NF apontando para `google-drive`;
- amostragem funcional de PDFs migrados aprovada em visualizar, imprimir e baixar;
- verificação de integridade dos documentos migrados concluída;
- Google Drive do workspace funcionando como provider oficial para novos uploads.

## Etapas

### 14E.1 — Auditoria pré-descomissionamento

Verificar no Firestore e no runtime:

- `0` documentos com provider `vercel-blob`;
- `0` documentos sem metadata `storage` que ainda dependam do Blob;
- `0` referências a pathnames físicos do Blob utilizadas como fonte ativa;
- arquivos Drive acessíveis e coerentes com seus metadados;
- `workspaceId`, `objectKey`, `folderKey` e `sha256` válidos quando aplicável.

Nenhum arquivo do Blob deve ser apagado antes desta etapa ser aprovada.

### 14E.2 — Exclusão física controlada do acervo Blob

Excluir os PDFs remanescentes do Vercel Blob somente após a auditoria prévia.

A exclusão deve ser separada da migração e não deve alterar saldos, empenhos, NFs, TRs, tramitação, comissões ou demais dados operacionais.

### 14E.3 — Remoção do código legado Blob

Remover do EMPROVEX:

- dependência `@vercel/blob`;
- imports e helpers exclusivos do Blob;
- rotas privadas de NE/NF usadas apenas para Blob;
- funções de leitura, upload, exclusão e fallback legadas;
- `createVercelBlobStorageRef` e código equivalente que não tenha mais uso;
- compatibilidade runtime que trate ausência de `storage` como Blob, após confirmação de que não existem documentos antigos dependentes dela.

### 14E.4 — Remoção de configuração e secrets

Após o código deixar de depender do Blob, remover do ambiente de deploy:

- `BLOB_READ_WRITE_TOKEN`;
- `BLOB_STORE_ID`, se presente;
- demais variáveis ou bindings específicos do Vercel Blob.

Nunca remover secrets antes de o código correspondente ter sido retirado e validado.

### 14E.5 — Auditoria final de resíduos

Executar uma varredura integral do repositório procurando, entre outros termos:

```text
@vercel/blob
BLOB_READ_WRITE_TOKEN
BLOB_STORE_ID
vercel-blob
/api/empenho-documents
/api/invoice-documents
isBlobConfigured
createVercelBlobStorageRef
fetchLegacyEmpenhoPdfBlob
fetchLegacyInvoicePdfBlob
```

A auditoria também deve verificar:

- `package.json` e lockfile;
- rotas API;
- tipos e contratos documentais;
- scripts e gates de CI;
- documentação;
- variáveis de ambiente referenciadas;
- fallbacks legados;
- imports mortos;
- referências persistidas no Firestore.

## Critério de conclusão

O Bloco 14E só pode ser considerado concluído quando o estado final for equivalente a:

```text
Provider documental oficial: google-drive
PDFs legados no Blob: 0
Referências Firestore vercel-blob: 0
Dependência @vercel/blob: ausente
Rotas Blob: ausentes
Secrets Blob: ausentes
Fallback Blob: ausente
Typecheck: OK
Build: OK
Auditoria de resíduos: CLEAN
```

## Regra de segurança

O Bloco 14E é irreversível no que diz respeito à remoção física do acervo Blob. Por isso, a exclusão física deve ocorrer somente depois de a migração do Bloco 14D ter sido auditada e validada no Google Drive.
