# EMPROVEX Empresas — Worker W5 / handoff documental R2

**Origem fixa:** PR #511 @ `16b763e929342b6ea1f5858470cc670c9ea5a3f4`; PR Draft W5 contra a branch W0, sem merge/deploy. **Ownership exclusivo:** `lib/company/documents/**`, `features/company/documents/**` e `app/api/company/documents/**`.

## Contratos de integração

1. **Identidade:** todas as rotas exigem `requireCompanyContext(request, { action })`, da fundação W0. Consultas usam exclusivamente `supplierCompanyWorkspaces/{ctx.companyId}`; recurso persistido deve ter `companyId===workspaceId===ctx.companyId`. Nada de SDK de dados empresariais no navegador.
2. **Documento:** `documents/{id}` estende `CompanyOwnedRecord` v1. Campos: `kind` (`ne|purchase|proof|other`), `displayName`, `mediaType`, `byteLength`, `sha256`, `storageObject` privado, `referenceType/referenceId`, `review`, `originalExtraction`, `confirmedAt/ByUid`, `expiresAt`. O `storageObject` nunca sai da API de metadados.
3. **Importação de NE:** `POST /api/company/documents/import-ne` (`multipart/form-data: file`) retorna `{ extracted, sourceSha256, warnings, requiresHumanConfirmation: true, persisted:false }`. Reusa exclusivamente `parseEmpenhoPdfBytes` puro, sem invocar API/billing militar. **Nenhuma gravação** na leitura inicial.
4. **Confirmação:** `POST /api/company/documents/confirm-ne` recebe o *mesmo PDF*, `sourceSha256`, `review` JSON, `confirmed=true` e cabeçalho `Idempotency-Key` (8–128 caracteres); revalida o PDF no servidor, preserva revisão versus extração original, registra documento privado; **não** cria `commitment` ou `customerOrder`. `referenceType=commitments` + `referenceId` são opcionais **apenas** se existir registro W1 do mesmo tenant.
5. **Anexo:** `POST /api/company/documents` (`multipart: file, kind, referenceType, referenceId` + idempotency key) guarda PDF/PNG/JPEG até 10 MiB **somente** se referência empresarial existir. NE textual até 12 MiB. `GET /api/company/documents` lista 25 por página; `GET /api/company/documents/{id}` retorna metadados; `GET /api/company/documents/{id}/download` exige Bearer e retransmite bytes privados após novo guard e verificação SHA-256. Nenhuma URL pública/assinada é emitida.
6. **Exportação para W6/W9:** `GET /api/company/documents/export/purchase-order/{id}` lê `purchaseOrders/{id}.pdfSnapshot`; `GET /api/company/documents/export/packing-list/{id}` lê `deliveries/{id}.pdfSnapshot`. O servidor exige snapshot com `id, companyId, workspaceId, documentNumber, customerName, issuedAt, lines[]`; cada linha tem `id, description, quantity, unit, unitPriceCents?`; opcionais `supplierName, deliveryAddress, notes`. Documento gerado em memória, nunca duplica linha ou cria persistência. W6/W9 são donos da escrita de snapshots, W5 apenas os consome.
7. **Compartilhamento:** `buildDocumentShareDraft` retorna `status:'draft'` para WhatsApp/e-mail. Não envia, não registra enviado, não chama serviços de mensagens.

## Persistência e segurança

Firestore REST por identidade gerenciada Cloud Run, com commit atômico em `documents`, `idempotencyKeys` e `auditEvents`. Arquivos privados em Google Cloud Storage por API autenticada, objeto sob `company-documents/{companyId}/{documentId}/{filename}`. É exigida a variável `EMPROVEX_COMPANY_DOCUMENTS_BUCKET` (bucket já provisionado com permissão de leitura/escrita para a identidade do serviço). **Nenhum bucket, IAM, Rules ou produção são alterados por W5**. Testes com `EMPROVEX_E2E_SERVER_AUTH=1` só podem usar Firestore Emulator `demo-*` e armazenamento local explícito em `http://127.0.0.1:4443` / `http://localhost:4443` via `EMPROVEX_COMPANY_GCS_EMULATOR_URL`; sem isso falha 503, não alcança GCS real.

## Limitações e próximo integrador

- W4 deve inserir `CompanyNeReview` no portal empresarial e fornecer `getIdToken` da sessão autenticada; W5 não altera `app/empresa/**` ou componentes compartilhados.
- W1 deve consumir o documento de NE **já revisado** para criar seu `commitment` por rota própria e regras de idempotência; a confirmação documental isoladamente não valida pedido, entrega ou aceite público.
- W6/W9 devem persistir `pdfSnapshot` de seus próprios registros com autorizações, revisões e itens validados; exportação retorna 422 até isso existir. A eventual configuração de bucket e permissões mínimas deve ser homologada pelo integrador **antes** de piloto.
- Sem integração de serviço real de WhatsApp, e-mail ou links de download expostos. Nenhum documento atravessa A/B ou recebe token temporário em URL.
- Não executar testes com dados ou Storage de produção. Critério final de produção pertence a W10, após E2E documental com emulador/QA e revisão de IAM.

**Exemplo QA fictício:** NE `2026NE123`, UG do comprador `160416` apenas metadado, `items:[{id:'linha-1', description:'Produto QA', quantity:'2', unit:'UN', unitPriceCents:500, totalCents:1000}]`; exportação `purchaseOrders/oc-qa-01` usando `pdfSnapshot` da mesma empresa.

**Testes W5:** `node --test lib/company/documents/documents.test.mjs`; `npm run typecheck`, `npm run build` e checks centrais via GitHub Actions da PR. Anexar resultados reais, nunca pressupor que teste passou.
