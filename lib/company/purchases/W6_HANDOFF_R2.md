# EMPROVEX Empresas — W6 Compras / Inbound R2 (handoff)

**Base:** W0 PR #511 SHA 16b763e929342b6ea1f5858470cc670c9ea5a3f4. W1 #513, W2 #516, W3 #514, W4 #512, W5 #515 estão em PRs **não integradas**. Este Worker não fez merge nem deploy. Piloto OFF e kill switches intactos.

## API funcional

| Operação | Contrato |
|---|---|
| POST /api/company/purchases | Cria rascunho purchaseOrders com 1 fornecedor e várias linhas, cada uma com alocações planejadas N:M a customerOrders de OMs. Preço de compra informado explicitamente, cotação e data obrigatórias; nunca usa preço de venda da OM ou cotação histórica como preço atual. |
| GET /api/company/purchases | Paginação tenant (limit 1–50, cursor opaco). Com ?needFor=orderId, informa demanda bruta pendente da W1 e **netShortage=null**, nunca inventando estoque W7. |
| GET /api/company/purchases/{id} | Consulta individual autorizada. |
| PATCH /api/company/purchases/{id} | Revisão obrigatória e ações sent (envio confirmado pelo operador), reply (quantidade cumulativa confirmada pelo fornecedor), receive (deltas de recebimento com comprovante), reschedule (prazo fornecedor) e cancel (sem entrada prévia). |
| GET /api/company/purchases/{id}/events | Eventos inbound paginados; filtro de purchaseOrderId local à página com cursor avançando mesmo se página sem correspondência. |

Resposta mutável: envelope ok=true com result, event opcional, replayed; escrita POST/PATCH com Idempotency-Key 12–128 caracteres e corpo JSON até 64 KiB. E-mails/WhatsApp não são enviados automaticamente. Campo de envio só é marcado após atestação explícita do operador com referência.

## Contratos

- PurchaseOrder contém CompanyOwnedRecord W0, sourceSupplierId, linhas (quantidade de compra, conversão racional, valor em BRL centavos, preço/cotação explícitos, alocações planejadas, quantidade confirmada e recebida separadas), desiredAt (solicitado) e supplierPromisedAt (confirmado e independente). Receber 250 de 400 não converte tudo em recebido.
- Eventos imutáveis: supplierCompanyWorkspaces/{companyId}/inboundShipments/{eventId} com kind = purchase.sent / purchase.reply / purchase.received / purchase.rescheduled / purchase.cancelled; receivedDeltas traz somente delta, stockPosted=false. W7 consumirá por event.id de forma idempotente, sem recalcular recebimentos pela PO.
- Escritas somente em purchaseOrders, inboundShipments, idempotencyKeys e auditEvents. Reads W1 customerOrders, W2 sourceSuppliers e catalogItems na raiz empresarial. **Nenhuma escrita em stockEvents, allocations, NF militar, Warehouse, ledger financeiro ou faturamento**.
- Guard W0 requireCompanyContext no início de todos os handlers. Releitura de fornecedor e catálogo ativos; commit do Firestore inclui verify updateTime para supplier/catalog/customerOrders e CAS da compra + audit + idempotency no mesmo commit. Alteração concorrente ou suspensão na transação retorna conflito 409. 401/403/503 continuam fail-closed.
- Dados privados por companyId do contexto assinado, sem UG/CNPJ como chave de autorização. Emuladores aceitos somente em projeto demo e hosts loopback.
- Rate-limit por instância, 30 mutações/minuto por UID/empresa. **Não é quota distribuída** e precisa de complemento W10 para Cloud Run multi-instância.
- pdfSnapshot de purchaseOrders inclui nome empresarial confirmado pela sessão W0, nome do fornecedor W2 e linhas conforme contrato W5. Nenhum PDF ou comprovante é tratado como entregue ficticiamente.
- UI isolada features/company/purchases/CompanyPurchasesWorkspace e features/company/inbound/CompanyInboundTimeline. Editor JSON temporário de QA; W4/W9 fará montagem visual e seleção assistida.

## Integração obrigatória

1. **W1 #513:** homologar CustomerOrder.lines, quantidade, fulfilledQuantity, parcialidade e pedido independente da NE. W6 usa somente leitura compatível, sem importar branch ainda não integrada.
2. **W2 #516:** conferir supplier.status + lifecycle e sourcingOptions/conversion dentro da transação; E2E W2+W6. Status suspenso/inativo sempre bloqueia novas compras.
3. **W3 #514:** Owner W0 continua único autorizado até que integrador W10 inclua membership ativa e papéis no guard em cada request. W6 não altera guard nem outorga papel.
4. **W4 #512:** inserir painel de compras no shell /empresa/compras com getIdToken legítimo, sem editar componentes W4 por este Worker.
5. **W5 #515:** exportador apenas lê pdfSnapshot sem replicar serviços nem afirmar envio efetivo.
6. **W7:** contrato de consulta de estoque em tempo real, reservas e alocações concorrentes N:M; sem isso falta líquida é desconhecida e alocações são plano (não reserva). Consumir cada evento purchase.received/cancelled uma única vez e distinguir trânsito de disponível.
7. **W8:** derivar financeiro de preço de custo autorizado e eventos, sem criar segundo serviço financeiro. W9/W10: jornadas completas com os domínios consolidados, limite distribuído e homologação QA no browser.

## Evidências / limites

- Unidade: node --experimental-strip-types --test lib/company/purchases/w6-domain.test.mjs.
- Integração real Firestore Emulator: npx --yes firebase-tools emulators:exec --config firebase.security-test.json --project demo-emprovex-company-w6 --only auth,firestore "node --test lib/company/purchases/w6-emulator.test.mjs" com hosts 127.0.0.1, E2E_SERVER_AUTH=1 e project demo. Esta suite exercita CAS, replay e isolamento A/B do **serviço** com documentos fixture compatíveis W1/W2. Não afirma autenticação E2E das rotas via token: esse cenário depende da integração W0/W3 e de QA navegador.
- Typecheck e build são executados na workflow isolada W6; verificar status da CI da PR para registrar resultado verdadeiro. Suite W0 Auth/Firestore e checks centrais continuam independentes.
- Testes de estoque líquido/dupla reserva exigem W7 integrado; nenhuma homologação com dados reais.

**GO condicional** apenas para revisão da entrega técnica isolada; **NO-GO para merge, deploy, financeiro, reservas ou piloto** até integração W1/W2/W3/W7, QA W9/W10 e autorização específica.
