# EMPROVEX Empresas — W7 R2: ledger, reservas, alocações e handoff
**Origem exata:** PR #511 `16b763e929342b6ea1f5858470cc670c9ea5a3f4` (W0). **Destino:** branch W0, PR Draft. Sem merge, deploy, alteração de Rules, IAM, billing ou Warehouse militar.

## Ownership e situação das dependências
- W7 cria apenas `lib/company/inventory/**`, `features/company/inventory/**`, `features/company/allocation/**`, `app/api/company/inventory/**` e um workflow **novo**, isolado (`.github/workflows/emprovex-empresas-w7.yml`). Não modifica workflows existentes nem arquivos setoriais.
- W0 #511: guard `requireCompanyContext`, root privado `supplierCompanyWorkspaces/{companyId}`, versão `company-r1-v1`, 503 com flag piloto OFF; acesso W0 é owner-only.
- W1 #513 (`e27ef500f0bacf9b7e43ed21805be92f91e86d9f`): `customerOrders/{id}.lines[].{id,quantity,fulfilledQuantity}`, estado `active`. W7 **não** modifica `fulfilledQuantity` no despacho; entregar/atestar pertencem ao W9 e à integração.
- W2 #516 (`09dbc3f11feee9d7b0ce403a0ee68346624e2f99`): `catalogItems/{id}.canonicalUnit/sourcingOptions[].conversion` é a única fonte da conversão. W7 não altera nem duplica o catálogo. **Nenhuma conversão arbitrária fornecida pelo cliente é aceita.**
- W3 #514 (`a6508281f7daa633891c4aa89cb0ad3a8278236a`): RBAC fino ainda não conectado ao guard W0. O titular W0 é o único usuário que consegue operar até a integração de membership. Nenhuma role do navegador tem valor.
- W4 #512, W5 #515: painéis W7 isolados; rotas no shell e evidências de PDF/romaneio são responsabilidades W10/W9.
- **W6 ainda sem contrato/PR congelado na preparação desta branch**: comandos dependentes de `purchaseOrders` falham fechados se a compra não existir ou não satisfizer `status=active`, confirmação e esquema previsto. Não importar código W6 nem inventar recebimento.

## Contrato 1 — ledger empresarial único e projeções CAS
- `stockEvents/event_{uuid}`: evento imutável de `adjust_in/out, reserve, release, dispatch, return, plan_purchase, unplan_purchase, receive_purchase, convert_purchase, direct_dispatch` e variantes `*_converted`, com ator, timestamp, item, unidade, quantidade e origem. Não é ledger militar.
- `stockEvents/balance_{sha256(catalogItemId)}`: projeção materializada de `onHand` e `reserved`; reconstruível dos eventos. Livres = físicos - reservados. Não há `stockBalances` paralela.
- `allocations/order_{sha256(orderId:lineId)}`: total da linha `stockReserved + purchasePlanned + dispatched <= ordered` e SKU/unit fixados na primeira operação.
- `allocations/link_{sha256(...)}`: N:M por origem e linha do pedido: vínculo de estoque ou de compra; `reserved,planned,dispatched`.
- `inboundShipments/inbound_{sha256(poId:lineId)}`: `purchaseQuantity, allocated,received,converted,directDispatched`. Material planejado/em trânsito **não** vira saldo físico. Receber exige documento de compra confirmada verificado no mesmo commit.

## Contrato 2 — integridade e unidade
- Quantidade decimal string, no máximo três casas; cálculo interno em `BigInt` de milésimos. Não usar float em lógica de saldo; UI é apenas visualização.
- Unidade é `catalogItems.canonicalUnit`. Compra com unidade diferente exige `sourcingOptions` do mesmo fornecedor e conversão racional **exata**; fração não representável é rejeitada.
- `onHand >= reserved >= 0`, sem saída livre negativa. Compra N:M limitada à quantidade confirmada por linha. Nenhum despacho é interpretado como entrega, atesto ou pagamento.

## Contrato 3 — API / autorização
- `GET /api/company/inventory`: posições paginadas; `GET /api/company/inventory/{catalogItemId}`: posição de SKU; `GET /api/company/inventory/events`: trilha paginada; `GET /api/company/inventory/allocations?orderId=...`: agregados por pedido.
- `POST /api/company/inventory` corpo: `{kind,catalogItemId,quantity:{value,unit},customerOrderId?,customerOrderLineId?,purchaseOrderId?,purchaseLineId?,reason?}`; cabeçalho `Idempotency-Key` 8..128. Retorno com `eventId`, snapshot atualizado e indicação explícita `dispatchedIsNotDelivered`.
- Todos os métodos passam no `requireCompanyContext` W0 antes de ler dados. POST valida `company:read` primeiro e ação fina `stockEvents:write | allocations:write | inboundShipments:write` segundo, antes de Firestore. Se faltar W3 não há permissão extra além de owner.
- Dados e documento de origem são carregados **somente** de `ctx.companyId`. O commit usa `currentDocument.updateTime / exists:false` e operações `verify` para garantir que pedido, catálogo e compra não mudaram entre leitura e escrita. Projeções, evento append-only, auditoria e chave de idempotência são gravados em um único commit; reexecução retorna o resultado persistido e hash diferente retorna 409.
- Sem SDK de gravação Firestore no navegador; REST usa identidade gerenciada Cloud Run. Em `EMPROVEX_E2E_SERVER_AUTH=1`, somente Auth/Firestore Emulators em loopback + `demo-*`, negando endpoint de produção.

## Contrato 4 — ponte W6 e handoff W9
- **Formato ainda sujeito à ratificação W6**: `purchaseOrders/{id}` status `active`, `confirmationState | workflowState | state` igual a `confirmed` ou `partially_received`, `sourceSupplierId`, `lines:[{id,catalogItemId,quantity:{value,unit}}]`. Todos os campos obrigatórios devem existir; caso contrário, comando retorna erro e não há estoque novo.
- `receive_purchase` representa recebimento físico auditado e explicitamente confirmado **pelo operador autorizado**, não um evento automático de confirmação do fornecedor. W9/W10 devem reconciliar com evento inbound real W6 e comprovante de recebimento antes do piloto, proibindo dupla importação.
- `direct_dispatch` altera apenas compra planejada e estado de expedição por pedido; **não** acrescenta/subtrai `onHand`. W9 precisa capturar prova e confirmar entrega; não existe baixa de W1 `fulfilledQuantity` nem atesto da OM.
- `dispatch` / `dispatch_converted` marcam expedição, não entrega. `return` / `return_converted` restauram fisicamente o saldo; uma devolução direta origem→OM exige reconciliação própria W9.
- O integrador deve mapear eventos de W6 para inbound, habilitar W3 live membership em cada request, montar os componentes W7 no shell W4, reconciliar estado de W1 e criar E2E da cadeia completa.

## Reprodução e limites de QA
- Testes de invariantes: `node --test lib/company/inventory/inventory.test.mjs`.
- Testes CAS/idempotência em Firestore Emulator **real**, projeto demo sem credenciais: `NEXT_PUBLIC_EMPROVEX_E2E_PROJECT_ID=demo-emprovex-company-w7 EMPROVEX_E2E_SERVER_AUTH=1 npx --yes firebase-tools emulators:exec --config firebase.security-test.json --project demo-emprovex-company-w7 --only auth,firestore "node --test lib/company/inventory/firestore-emulator.test.mjs"`.
- Workflow próprio roda unitários, Emulator, `npm run typecheck`, Core Protection e `npm run build`. **Um teste escrito não é um PASS**; consultar CI do head final.
- O teste Firestore exercita atomicidade e concorrência de operações REST reais, **não** autenticação empresarial A/B da API W7. E2E completo via Auth+Firestore Emulator, W1/W2 integrados, role revogada, piloto OFF, browser e visual W4 é obrigatório para GO de integração.
- W7 não toca fontes/dados do militar. Nenhum comando toca billing, NF, atesto, Rules, IAM ou Cloud Run.

**Parecer preliminar:** GO somente para revisão do domínio e integração controlada; **NO-GO para merge/deploy/piloto** enquanto W6 não estiver congelado, W3 ainda não oferecer autorização fina na sessão W0, testes de integração com dados QA não concluírem e W10 não homologar a jornada.
