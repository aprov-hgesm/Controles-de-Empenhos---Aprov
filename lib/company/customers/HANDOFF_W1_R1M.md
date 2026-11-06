# EMPROVEX Empresas W1 — handoff de contratos para W6/W7/W8

**Base:** W0 PR #511, SHA 16b763e929342b6ea1f5858470cc670c9ea5a3f4.
**Namespace:** supplierCompanyWorkspaces/{companyId}/{publicCustomers|commitments|customerOrders}; documentos autenticados pelo servidor via W0 requireCompanyContext, sem Rules/IAM novos.

## Entidades
- PublicCustomer: kind, name, ug/uasg **como atributos de cliente**, contacts, addresses, notes; CompanyOwnedRecord v1.
- Commitment (NE): publicCustomerId, neNumber, fiscalYear, lines(id, description, quantity, orderedQuantity, salePrice); reviewedByUid, reviewedAt, extractionSource(manual/pdf_reviewed), reviewHistory.
- CustomerOrder: commitmentId, publicCustomerId, reference, lines(id, commitmentLineId, quantity, salePrice, fulfilledQuantity), requestedDelivery, negotiationHistory, fulfillmentState. Pedido efetivo da OM distinto da NE e de purchaseOrder.

## Contratos de consumo para W6/W7/W8
- W6 lê customerOrder.lines.quantity (necessidade comercial), não interpreta NE como pedido de compra; customerOrder.id + line.id são chaves de vínculo para futuros purchaseOrders.
- W7 é único dono de fulfilledQuantity e de alocações/entregas via integração futura, sem alterar saldo committed na NE fora de transação e sem inventar ledger neste Worker.
- W8 trata salePrice.amountCents em BRL como **preço de venda**, nunca como custo ou margem.
- Eventos de domínio gravados por mutação em auditEvents sob mesmo commit Firestore: publicCustomers:create/update, commitments:create/update, customerOrders:create/update/cancel. Audit aponta actorUid, correlationId, revisions, entityId. Nunca usar auditoria como fila de entrega garantida.
- Idempotency-Key: cabeçalho obrigatório, string alfanumérica 8..128; valor em idempotencyKeys com hash do conteúdo validado, UID+ação+chave como índice, replay com mesmo resultado e conflito 409 para requisição diferente.
- Quantity: decimal string com no máximo três casas; cálculo em BigInt/1000, unidade explícita; não converter unidade silenciosamente.
- Update: PATCH exige expectedRevision, número inteiro; alteração negociada e revisão de campos extraídos preserva histórico de hashes. Pedidos não podem exceder saldo da NE. Commit atômico inclui pedido, saldo alocado da NE, audit e idempotencyKey.

## Endpoints
GET/POST /api/company/customers, /commitments, /customer-orders; GET/PATCH em /[id].
GET aceita limit=1..50 e cursor opaco; response {ok,result:{items,nextCursor}}. POST exige Idempotency-Key; PATCH também. Mutação nunca aceita companyId/role do request como autoridade. DELETE intencionalmente ausente.

## Pendências do integrador
- W4: montar componentes CompanyCustomersPanel, CompanyCommitmentsPanel e CompanyOrdersPanel no shell; nenhum arquivo app/empresa ou components/company foi editado.
- W5: ao extrair NE PDF, submeter somente campos revisados por operador ao contrato parseCommitment, com extractionSource pdf_reviewed.
- W7/W9: integrar entregas parciais reais e atualização autorizada de fulfilledQuantity via ledger/eventos do domínio; W1 inicializa em zero, sem declarar entrega fictícia.
- O piloto permanece OFF por padrão. Sem merge, deploy, Rules, IAM ou escritas de produção.

## QA
Teste unitário em features/company/customers/w1-domain.test.mjs (executável com npm ci + node --test). Validar adicionalmente integração A/B em Auth/Firestore Emulators com fixtures independentes antes de piloto.
