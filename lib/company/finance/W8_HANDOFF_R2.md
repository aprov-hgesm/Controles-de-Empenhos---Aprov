# EMPROVEX Empresas W8 — Financeiro manual, handoff R2

**Data:** 05/11/2026. **Base imutável:** W0 PR #511, SHA `16b763e929342b6ea1f5858470cc670c9ea5a3f4`.
**Branch:** `feat/empresa-r2-w8-finance-manual-20261105`. **Destino:** branch W0. Draft, sem merge/deploy.

## Fonte de verdade
- `supplierCompanyWorkspaces/{companyId}/accountsPayable/{id}`: **NF recebida de fornecedor / obrigação a pagar** (`direction=payable`).
- `supplierCompanyWorkspaces/{companyId}/accountsReceivable/{id}`: **NF de saída / obrigação a receber** (`direction=receivable`).
- `invoice` contém número/série/data/valor em centavos, `source=manual`, `verification=unverified`; sem afirmar que NF-e foi validada/emitida. IDs de contraparte e pedido são referências **informadas e ainda não validadas contra W1/W2/W6**.
- `entries[]` é o histórico canônico do respectivo título; cada pagamento/recebimento, ajuste e estorno adiciona um evento (não apaga fato). `balance()` reconstitui `totalCents,appliedCents,outstandingCents,status` com inteiros seguros, rejeita sobrepagamento, estorno duplicado e total negativo.
- `auditEvents/{id}` e `idempotencyKeys/{id}` W0 na **mesma transação** Firestore que o título, usando `currentDocument.updateTime`/CAS para impedir duas baixas concorrentes; 409 em conflito. `expectedRevision` obrigatório em lançamento/cancelamento; `Idempotency-Key` obrigatória em toda mutação.
- **Não há segunda contabilidade:** a projeção financeira e os eventos manuais pertencem ao próprio título. Não foi criada a coleção `paymentEntries`, não prevista no contrato congelado W0.
- Toda rota usa **guard W0 server-side** por UID/workspace/status/ação e conferência de `companyId/workspaceId` persistido. Política W3 `accountsPayable/Receivable:read/write` permite finance/admin e owner; owner é o único usuário resolvido até integração de memberships. Nunca derivar privilégio do papel enviado pelo browser.

## APIs entregues
- `GET/POST /api/company/finance/payables`, `/receivables`: lista paginada ou registra obrigação. Cada título contém a NF manual; não geramos automaticamente título a partir de entrega/NE.
- `GET /api/company/finance/{book}/{id}`: recupera título validado; `PATCH`: cancelamento auditado, somente sem recebimentos/pagamentos ativos.
- `POST /api/company/finance/{book}/{id}/entries`: `{expectedRevision,kind:'settlement'|'adjustment'|'settlement_reversal',amountCents?,reversesEntryId?,occurredOn,reason}`. Liquidação bancária/atesto não inferidos.
- `GET /api/company/finance/summary`: **prévia da primeira página** de cada livro (50 por tipo), `complete=false` e cursors quando há mais dados; nunca rotular como total global.
- `POST /api/company/finance/margin`: projeção com `revenueCents` obrigatório e componentes opcionais `materialCostCents,freightCents,taxesCents,otherCents`; campos ausentes retornam `missing[]` e `complete=false`, não zero implícito.
- UI isolada em `features/company/finance/FinanceWorkspace.tsx` e `FinanceInsights.tsx`; ambas recebem `getIdToken()` do shell. **W4/W10 são donos de `app/empresa/**`; W8 não integrou visualmente as rotas.**

## Dependências de integração, sem ocultar bloqueios
1. **W1 (#513):** ao importar referência de `customerOrder`/NE, validar ownership e ID reais em transação, mantendo preço de venda distinto de custo; verificar dados fiscais de NF de saída antes de vincular.
2. **W2 (#516):** ler o fornecedor de origem vigente e validar `sourceSupplierId`/CNPJ; os preços históricos do catálogo **não são** custos reais nem comprovantes.
3. **W3 (#514):** integrar `checkLiveMemberCapability` ao guard W0 para aplicar revogação/múltiplos papéis em TODA rota; atualmente somente owner pode usar serviço W8, membros não. Não editar arquivos W0/W3 nesta PR.
4. **W4 (#512):** integrar painéis nos destinos Financeiro/NFs da rota `/empresa`, com testes de navegação autenticada.
5. **W5 (#515):** anexar documentação de NF ao storage privado e vincular IDs do título sem URLs públicas; a existência do registro manual não confirma autenticidade fiscal.
6. **W6/W7:** disponibilizar eventos de compra, recebimento físico e custo efetivo; criar mecanismo idempotente de projeção no integrador se aprovado. **W8 não insere compras, estoque, alocações ou movimentações automaticamente**. Eventos de auditoria existentes não são fila garantida.
7. **W9/W10:** relatórios e cronogramas completos precisam percorrer todas as páginas, unir prazos e dados reais, distinguir margem estimada de realizada, realizar E2E Auth/Firestore Emulator A/B e validação de referências W1/W2, além de auditoria de permissões financeiras. Não promover até esses gates.

## Limitações deliberadas
- Registro de NF manual **não** transmite, consulta ou autentica NF-e/SEFAZ; não produz lançamento fiscal, boleto, PIX nem integração com banco.
- Não realiza conciliação automática, pagamento, atesto, liquidação pública, cobrança empresarial, emissão de NF ou escrita no billing militar.
- `dueOn` é vencimento informado, não promessa de recebimento; fluxo de caixa = projeção de obrigações abertas. Sem conclusão automática de inadimplência.
- Reversões de ajustes não são ações independentes; correção de ajuste exige novo ajuste com justificativa. Cancelamento não extingue pagamentos ativos: estes precisam ser estornados, com trilha.
- `sourceOrderId` e contraparte ainda são dados de referência declarados pelo usuário, sem integridade referencial W1/W2; validação fica com integrador assim que as PRs forem consolidadas. Os IDs de título são determinísticos por empresa/direção/contraparte/número/série e bloqueiam duplicidade com outra chave.
- Quaisquer evidências de testes devem se referir a resultados executados, não inferidos da existência do arquivo. `w8.test.mjs` cobre funções puras e transações sob **mock determinístico**, não substitui Firebase Emulator real.

## Testes previstos neste Worker
- `node --test lib/company/finance/w8.test.mjs`: cálculo em centavos, lançamentos parciais, estorno, ajustes, cancelamento, margem/lacunas, caixa, A/B, roles W0 e CAS/idempotência no mock.
- `npm run typecheck`, `npm run build`, regressões Core Protection: verificar resultados de GitHub Actions após abertura da PR.
- E2E financeiro Auth/Firestore emulador com W1/W2/W3 integrado e QA do portal **pendentes**.

**Parecer inicial:** GO apenas para revisão da implementação isolada; **NO-GO para merge/deploy/piloto** até CI W8 verde, integração referencial e E2E real.
