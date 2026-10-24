# EMPROVEX — HANDOFF INTEGRAL WAREHOUSE R2
Data-base: 24/10/2026. Continuidade oficial do desenvolvimento no PR #371. NÃO É TERMO DE CERTIFICAÇÃO.

## 1. Estado exato no GitHub e na produção
- Repositório: aprov-hgesm/Controles-de-Empenhos---Aprov.
- PR: https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/371 — aberto, não mesclado.
- Branch: feat/mobile-outbound-unified-scan-r2.
- HEAD de código imediatamente anterior a este handoff: 77127c2fa2d79b9b9566a4694f3f1f8ef63c1e42. Consultar HEAD atualizado após o commit documental.
- main verificada: 47323e3b8583e68c8344336a265ddd7d63563c36.
- O Fundador confirmou produção anterior com PRODUCAO=PASS para o SHA 47323e3... e deployment https://controles-de-empenhos-aprov-kyr6ijjuc-aprov-hgesms-projects.vercel.app. **As alterações R2 NÃO foram publicadas.**
- Vercel: conta/equipe externa aprov-hgesms-projects, projeto controles-de-empenhos-aprov. Git deploy automático desativado em vercel.json. Publicação manual via PowerShell Windows, staged, health, smoke, promoção do MESMO deployment; jamais promover sem autorização/GO.
- Fluxo original Motor de Confiança R1 já estava na main por PR #369. Este PR #371 é evolução NOVA de Saída e validade; não confundir as certificações.

## 2. Requisitos literais do Fundador
SAÍDA DO OPERADOR MÓVEL: (1) Ler código de barras do ITEM ou da LOCALIZAÇÃO no MESMO leitor. Se local, mostrar itens daquela posição para escolher; se item, mostrar locais com saldo, dispensar seleção quando só houver um. (2) Informar QUANTIDADE. (3) Escolher DESTINO, sem campo responsável: autoria exclusivamente derivada do login e autorizada no servidor. (4) REVISAR E CONFIRMAR.
CENTRAL DE DEPÓSITOS INTEIRA: remover lógica e indicadores de FEFO e remover da UX toda indicação/código e seleção de lotes, inclusive Desktop, Mobile, relatórios, PDF, planilhas e painéis, mas PRESERVAR VALIDADE e alertas de vencimento. Manter integridade e rastreabilidade de saldos/movimentos anteriores. Objetivo de máxima desburocratização e redução de reads Firestore, sem relaxar segurança.

## 3. O que foi efetivamente implementado na branch R2
- features/warehouse/mobile/WarehouseMobileOutbound.tsx: UI reescrita em quatro etapas. Primeiro scanner admite EXPECT_PRODUCT_OR_LOCATION, usa leitor autenticado mobile de produto ou resolvedor de posição física e consulta seu conteúdo. Escolha de material ou origem só quando há alternativas. Quantidade em apresentação reconhecida com conversão oficial; destino e revisão; chamada de baixa canônica com idempotência, tela de sucesso.
- lib/warehouse/mobileScanner.ts: expectativa scanner dual apenas para esse fluxo; outras expectativas seguem estritas.
- app/api/central-depositos/operations/route.ts e lib/server/warehouseMobileTrust.mjs: ação WITHDRAWAL_FINALIZE_MOBILE passa por verifyWarehouseRequest e bind de confiança; servidor desconsidera withdrawnBy vindo do aparelho e usa access.email autenticado. Mantido finalizeWarehouseWithdrawalServer para integridade transacional.
- lib/warehouse/mobileOutbound.ts: produto inicialmente lido por local pode usar apresentação oficial sem barcode comercial; opções de posição deixam de recomendar FEFO.
- lib/warehouse/mobileOutboundPlan.mjs: planejamento técnico neutro por ID de referência/lote, **sem ordem por vencimento**. Divide retirada entre registros internos mantendo soma da quantidade. Protege contra referência inativa/vencida não elegível, lotes que excedem saldo físico, saldo livre não comprovado e número excessivo de linhas. Controle de validade é diferente de priorização FEFO.
- features/warehouse/mobile/WarehouseMobileIntakeAllocation.tsx: retirado campo lote; mantém data de validade; contrato legado recebe lotCode vazio.
- features/warehouse/components/WarehouseMaterialWithdrawal.tsx: retirada Desktop sem seleção de lote e sem FEFO; reutiliza planner técnico para dividir linhas e conservar rastreabilidade. Carrinho, edição de linhas, PDFs, transações e retry **ainda exigem smoke e revisão crítica**. Campo Retirado por permanece na interface DESKTOP; o pedido de removê-lo era específico ao Operador Móvel.
- lib/warehouse/lot.ts: helper selectWarehouseFefoLot removido; funções de vencimento, IDs, validação e pendências mantidas.
- lib/warehouse/stockView.ts e WarehouseStockOperational.tsx: estoque deixa de ordenar por vencimento; cartão de recomendação FEFO removido; validade continua informativa com quantidades e estados.
- WarehouseHomeOperational.tsx e WarehouseDepotViewOperational.tsx: removidos destaques de prioridade FEFO da home e do croqui. Alertas e marcações por validade continuam.
- WarehouseMobileItemQuery.tsx, WarehouseMobilePhysicalQueryResult.tsx: exibem validade em vez do código de lote.
- WarehouseConsumptionReports.tsx: CSV exportado sem coluna código de lote.
- features/warehouse/pdf/WarehouseOutboundDocuments.ts: cabeçalho agora VALIDADE / CÓDIGO, mantendo barcode comercial.
- WarehouseLocationInspection.tsx, WarehouseLogisticsDashboard.tsx, WarehouseLogisticsAlerts.tsx, WarehouseLocationsOperational.tsx, WarehouseLocationsR1Operational.tsx, WarehouseMobileDepotLocations.tsx, WarehouseMobileTransfer.tsx, lib/warehouse/logisticsAlerts.ts: nomenclatura e alertas voltados a validade e integridade em vez de código de lote.
- scripts/mobile-outbound-unified.test.mjs e scripts/warehouse-validity-only-r2.test.mjs: novos testes de scanner, transações/contrato, atribuição neutra, ausência de FEFO UI e preservação de validade.
- scripts/verify-mobile-r1-outbound.mjs, scripts/verify-mobile-r1-intake-allocation.mjs, scripts/mobile-r1-outbound.test.mjs, scripts/warehouse-stock-operational.test.mjs, scripts/warehouse-barcode-outbound.test.mjs, scripts/warehouse-depot-layout.test.mjs: guards/testes legados adaptados. package.json e scripts/ci-fast-tests.mjs selecionam testes específicos.

## 4. Histórico REAL de testes e bugs (não inferir aprovação do HEAD)
- SHA 357ddb885fe045ad71a400759f5e1b9d18e0bde9: Application CI falhou porque guard MOBILE-C exigia antiga expressão lotCode: lotCode.trim(); guard adaptado depois.
- SHA d0c5b87ca167d2b58125a4d69d75251c3d5c4d11: TypeScript legal falhou por dois imports remanescentes de selectWarehouseFefoLot em WarehouseDepotViewOperational e WarehouseHomeOperational. Código corrigido em 77d6ec78ce01ae527a046933fac50a97ecbb2d04.
- SHA c850f0a8e61d4e6bdd0b4268424a457d0f0e3e90: Core Protection PASS, Recovery PASS, Legal/TypeScript PASS, Warehouse Server R2 Smoke/Emulator PASS, VISUAL-R1 W4 QA PASS. Fast CI FAIL (run 40067132218), em scripts/warehouse-depot-layout.test.mjs:318 porque o teste ainda esperava selectWarehouseFefoLot. Application CI e Browser E2E do SHA foram CANCELLED por commits posteriores, não são PASS.
- SHA 4a2a2dc44bd505749c689bdc978b534b2315985f: commit mais recente de código antes do memorial; alterou o assert do teste do croqui para ausência de FEFO. Na consulta feita antes deste handoff, ainda NÃO havia runs devolvidos para esse SHA. Após salvar o memorial, consultar checks novamente no NOVO HEAD e certificar tudo.
- PR Strix security bot informou que trial de análise externa acabou (billing); não confundir com falha funcional do sistema.
- Todos os gates devem ser confirmados no MESMO SHA final: EMPROVEX Fast CI, Application CI, Browser E2E, Warehouse Server R2 Smoke autenticado e Firestore Emulator, SAAS-DL Legal, Core Protection, Recovery e Visual W4 para componentes visuais modificados.

## 5. Trabalho ainda pendente e riscos
1. **Excel não convertido:** lib/server/warehouseBulkStockWorkbook.ts AINDA expõe a coluna Lote (opcional), índice 8; features/warehouse/components/WarehouseBulkManualEntryOperational.tsx AINDA manda lotCode:row.lot. Remover lote do NOVO template mantendo compatibilidade de planilhas ANTIGAS de 11 colunas, acrescentar teste que valida as novas 10 colunas e a leitura das 11 legadas. Tentativa anterior de commit falhou com erro GitHub GraphQL; NÃO foi salva (confirmado no repositório).
2. features/warehouse/components/WarehouseItemControlOperational.tsx: descrição ainda menciona FEFO; NÃO corrigida devido à mesma falha de commit.
3. features/warehouse/components/WarehouseCroquisR1Operational.tsx: textos visíveis citam lotes ativos na inativação/exclusão; substituir apresentação por referência/validade SEM retirar os guards que evitam perdas. WarehouseIsometricPreview.tsx contém texto de lotes/validades incompletas; revisar. WarehouseImmediateConsumptionPanel.tsx, WarehouseLocationInspectionLocalPreview.tsx podem conter outras mensagens de lote. Realizar varredura abrangente de UX, PDF, CSV e textos; NÃO substituir o termo “operação em lote” quando significar bulk, e não apagar nomes técnicos/contratos internos.
4. **Segurança muito importante:** planejar lotes no cliente não é igual a certificar plano no servidor. Motor canônico revalida lotId, quantidades, workspace/UG e saldo, mas examinar explicitamente se o cliente pode mandar plano adulterado que passe pela rota sem o algoritmo neutro. Se necessário, recalcular/restringir no servidor e testar bypass, concorrência, idempotência e rollback de linhas múltiplas.
5. Revisar Desktop WarehouseMaterialWithdrawal: múltiplos lotes/ref. por item, múltiplas linhas, reserva no carrinho, quantidades e PDFs; validar ausência de baixa parcial em erro e idempotência no server.
6. Revisar comportamento de lotes vencidos/inativos: FEFO removido, porém validade vencida é alerta de segurança. Não assumir automaticamente que material vencido pode ser expedido. Preservar regra fail-closed até decisão clara e teste.
7. **Não fazer merge/deploy R2 até corrigir todos os gates e executar smoke autenticado** em workspace QA isolado: entrada por item/local, posição única/várias, quantidade normal e excedente, saldo sem validade, mais de uma validade, troca de destino, replay idempotente, workspace estranho, Desktop, inventário/transferência e PDF.
8. Nenhuma mudança Firestore Rules, IAM, produção, dados existentes ou aplicativo instalado foi autorizada para publicação R2 nesta etapa. O código está somente no PR.

## 6. Comandos e referências para o próximo executor
GitHub PR: https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/371
Branch: feat/mobile-outbound-unified-scan-r2
Memorial: docs/EMPROVEX_MEMORIAL_OFICIAL.md
Testes introduzidos: npm run test:mobile-outbound-unified ; npm run test:warehouse-validity-only
Outros: npm run test:mobile-r1-outbound ; npm run verify:mobile-r1-outbound ; npm run verify:mobile-r1-intake-allocation
Testes críticos adicionais: scripts/warehouse-depot-layout.test.mjs, scripts/warehouse-bulk-stock-r1.test.ts, Browser E2E e workflow .github/workflows/warehouse-server-r2-smoke.yml.
Rodar npm ci, typecheck, testes do domínio afetado; certificar GitHub Actions. Somente após GO considerar squash na main e script de publicação manual PowerShell existente scripts/publicar-mobile-trust.ps1, adaptando SHA final.

## 7. Handoff GOV-SIMP-01 obrigatório
ONDE ESTAMOS: PR #371 aberto; HEAD antes deste handoff 77127c2fa2d79b9b9566a4694f3f1f8ef63c1e42; main/prod no commit R1 47323e3...
O QUE ESTAMOS FAZENDO: concluir retirada de FEFO, esconder campos/códigos de lote em TODA a Central, manter validade, simplificar Saída Móvel e certificar integração.
QUEM ESTÁ FAZENDO: ChatGPT executor GitHub (código, testes, CI, PR, memorial); Fundador (somente validação humana e publicação PowerShell após GO).
O QUE FAZER A SEGUIR: (1) terminar Excel e varredura UX; (2) auditoria da baixa server, multi-linhas e idempotência; (3) corrigir CI e guards antigos; (4) rodar gates e smoke; (5) documentar resultados e preparar merge/release SEM publicar autonomamente.
QUEM FARÁ: próximo executor ChatGPT até certificação; Fundador opera Vercel no seu PowerShell depois da liberação.

**CLASSIFICAÇÃO: IMPLEMENTAÇÃO PARCIAL, AINDA NÃO CERTIFICADA E NÃO PUBLICADA.**
