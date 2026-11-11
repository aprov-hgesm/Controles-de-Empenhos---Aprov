# W05 | Distribuição, etiquetas e entrega — handoff QA R1
Base imutável W0: 4bcfee7730fc0da3177d9af8a81eabeb7f844abb.
Branch: feat/cozinha-dietetica-w5-distribuicao (PR Draft contra feat/cozinha-dietetica-w0-fundacao).

## Integração W9
- Exportar DistributionView de features/hospital/distribution/DistributionView.tsx; passar organizationId, unitId, mealIds e função client-only getAuthorization(): Promise<Bearer token>. Nunca passar HospitalScope fabricado.
- DistributionService(store) recebe a mesma instância de HospitalQAStore de W0. Métodos command(scope,operation,payload), status(scope,{unitId,mealId}), printLabel(scope,{unitId,mealId,format}). Handler createDistributionHandler({store,verifyToken?}).
- Comandos: assembly.start, assembly.complete, assembly.check, batch.dispatch, batch.receive, meal.deliver, meal.return, meal.cancel, route.flag.
- Consultas: distribution.status e label.print. Somente POST, Bearer verificado, escopo OM/unidade, sem identificador clínico em URL. HTML escapado, no-store, código opaco sem QR público.
- Estados persistem em records.kind=label de W0 com ID dist_<hash do pedido>; eventos de entrega em records.kind=delivery_event e hospital_events imutável. Sem alterar esquema central.
- Produção W4/W3: exige meal.status=READY e mapa enviado. batchId opcional, mas informado deve corresponder a production_batch.status=COMPLETE e conter todas as refeições. Não presumir existência de W4.
- W2: patient.referenceCode e patient.displayName são necessários para dois identificadores na entrega. W0 cria referenceCode, mas não preenche displayName. Entrega falha fechada se o segundo não existir.
- Eventos para W8: meal.assembly.started/completed/checked, meal.dispatched, meal.received, meal.delivered, meal.suspended, meal.route.reconciliation_required. Exibir cada estado separadamente.
- Transferência confirmada W0 suspende pedido e altera a unidade. W5 bloqueia entrega antiga e exige reconciliação manual; nunca autoconfirma entrega no novo leito.
- Atraso de refeição principal gera alerta, não silencia exceção clínica; pedido secundário pertence ao W3.

## QA
O endpoint app/api/hospital/distribution/route.ts fica desabilitado em produção; somente next dev com HOSPITAL_QA_DISTRIBUTION_ENABLED=1 e HOSPITAL_QA_DB_PATH apontando para SQLite temporário QA. Firebase Admin deve verificar ID token; não há seed via HTTP.

Comandos:
- node --test tests/hospital/distribution/distribution.test.mjs
- npm run typecheck
- npm run build

Uma adição de CI fora do escopo funcional (.github/workflows/hospital-w5-qa.yml) foi necessária para executar o teste isolado sem alterar qualquer pipeline existente. Os resultados reais constarão na PR.

## Riscos/pendências
1. W2 deve fornecer segundo identificador conforme protocolo institucional.
2. W4 deve homologar contrato de lotes e READY com W0.
3. Recebimento sem confirmação e reencaminhamento após transferência dependem de protocolo institucional e não têm atalhos automáticos.
4. Banco clínico dedicado, LGPD, impressora, protocolo de identificação e integração W9 não estão homologados.
5. NO-GO para operação clínica real, deploy e produção. Sem merge nem dados reais.
