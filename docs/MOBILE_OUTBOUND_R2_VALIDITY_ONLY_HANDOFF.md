# EMPROVEX — Handoff integral: Operador Móvel Saída R2, FEFO retirado e validade sem lotes (24/10/2026)

## LEIA PRIMEIRO — Estado comprovado no GitHub

- Repositório: aprov-hgesm/Controles-de-Empenhos---Aprov
- PR aberto **#371**: https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/371
- Branch de integração: **feat/mobile-outbound-unified-scan-r2**
- HEAD de trabalho no momento deste memorial: **4a2a2dc44bd505749c689bdc978b534b2315985f**. Este documento entra em commit posterior: obter HEAD atualizado no GitHub antes de executar qualquer coisa.
- main preservada: **47323e3b8583e68c8344336a265ddd7d63563c36** (squash R1 do Motor de Confiança, PR #369).
- **PR #371 ABERTO, NÃO MESCLADO, NÃO PUBLICADO.** NÃO afirmar que a R2 está em produção ou certificada.
- A versão anterior R1 foi promovida pelo Fundador no PowerShell: commit main 47323e3b8583e68c8344336a265ddd7d63563c36, deployment https://controles-de-empenhos-aprov-kyr6ijjuc-aprov-hgesms-projects.vercel.app; verificado pelo log do usuário PRODUCAO=PASS. O domínio oficial é https://emprovex.com.br.
- O projeto Vercel é **aprov-hgesms-projects/controles-de-empenhos-aprov**, administrado em conta do Fundador. Não há autorização para deploy da R2. O deploy Git segue desativado em vercel.json; não mudar Firestore Rules, IAM, dados reais ou domínio durante certificação.

## Decisões funcionais do Fundador — NÃO REVERTER

1. A jornada **Saída de Materiais do Operador Móvel** deve ter exatamente quatro etapas: (1) Ler código de barras — **item OU local/subposição**, (2) Indicar quantidade, (3) Destino, (4) Revisar e confirmar.
2. Se leu LOCAL: mostrar lista de materiais com saldo daquele local; escolher material. Se leu ITEM: mostrar posições com saldo desse item; se apenas uma, escolher automaticamente, sem exigir outra leitura de localização.
3. **NÃO pedir nome do responsável pela retirada** no móvel. O servidor recupera a identidade a partir de verifyWarehouseRequest e preenche withdrawnBy com o email autenticado. Não aceitar autoria arbitrária enviada pelo navegador.
4. **FEFO completamente retirado das recomendações, classificações de prioridade e seleções da Central de Depósitos — Desktop e Mobile.** Validade permanece como informação, com alertas de vencimento e controles de integridade, sem priorizar automaticamente retirada por vencimento.
5. **NÃO mostrar código, número ou seleção de lotes nas telas, consultas, relatórios, CSV e documentos da Central; apresentar somente validade.** Os documentos internos lotId/lotCode/lot e respectivos contratos persistidos podem/deverão continuar existindo no servidor para integridade histórica, idempotência, conciliação por validade e baixas transacionais. Não eliminar coleções nem dados e não quebrar contratos externos.
6. Manter integralmente a Central de Depósitos 3D, layouts 2D/3D, outros módulos operantes; máximo reaproveitamento, mínimo de burocracia e custo Firestore. Sem novo login nem novo mecanismo de autorização.

## Implementação real já executada no PR #371

A. Scanner unificado: lib/warehouse/mobileScanner.ts adiciona EXPECT_PRODUCT_OR_LOCATION; WarehouseMobileOutbound.tsx aceita produto ou etiqueta EPX da posição com o mesmo scanner. Sem relaxar os outros modos do scanner.

B. Novo componente de saída móvel: features/warehouse/mobile/WarehouseMobileOutbound.tsx foi substituído por experiência de quatro etapas, com seleção contextual e origem automática quando única; lê material via servidor mobile-barcode, lista conteúdo físico via mobilePhysicalQuery e saldo/validade via mobileOutboundRepository; informa quantidade, destino, revisão e confirmação. Sem escolha manual de lote e sem responsável preenchido pelo usuário.

C. Operação protegida: app/api/central-depositos/operations/route.ts inclui WITHDRAWAL_FINALIZE_MOBILE, autorizado pelo lib/server/warehouseMobileTrust.mjs; operação chama finalizeWarehouseWithdrawalServer, com withdrawnBy tomado da identidade verificada no servidor. Não há gravação client-SDK para saída. Preserva transações canônicas, idempotência, saldo geral, saldo por posição, consumo/SISCOFIS e segregação workspace/UG.

D. Algoritmo compartilhado: lib/warehouse/mobileOutboundPlan.mjs exporta planMobileOutboundAutomaticLots e divide a baixa por referências técnicas de validade/lote (ou estoque comprovadamente não atribuído), com validação da soma e limites. **FEFO removido da ordenação:** hoje a ordem é estável por ID técnico, NÃO por validade. O planejador ainda rejeita referências vencidas/inativas e excesso de atribuição; isto é política de segurança/consistência independente da prioridade FEFO. Não transformar falhas em retirada sem rastreio. A retirada Desktop WarehouseMaterialWithdrawal.tsx reutiliza esse planejador no carrinho e deixa de permitir escolher um lote.

E. Alocação móvel: WarehouseMobileIntakeAllocation.tsx remove campo e seleção manual de lote; mantém validade como entrada e envia lotCode vazio para o motor canônico criar referência técnica. Entrada avulsa não tinha seletor equivalente. Os contratos de persistência permanecem.

F. FEFO/indicação de lotes retirados/renomeados em diversas áreas:
- WarehouseStockOperational.tsx: remove sugestão FEFO da ficha, mantém validade mais próxima e cartões de validade sem rótulos de lote.
- WarehouseHomeOperational.tsx e WarehouseDepotViewOperational.tsx: elimina destaque/prioridade FEFO, preservando consultas e alerta de validade e representação 3D.
- WarehouseMaterialWithdrawal.tsx: remove controle de seleção de validade/lote no Desktop, usa baixa automática; carrinho mostra validade em vez de código de lote.
- WarehouseMobileItemQuery.tsx, WarehouseMobilePhysicalQueryResult.tsx, WarehouseMobileTransfer.tsx: mostram validade, não códigos internos.
- WarehouseLocationInspection.tsx, WarehouseLocationsOperational.tsx, WarehouseLocationsR1Operational.tsx, WarehouseMobileDepotLocations.tsx: ajuste de orientação visual/terminologia.
- WarehouseLogisticsAlerts.tsx e lib/warehouse/logisticsAlerts.ts, WarehouseLogisticsDashboard.tsx: alertas sobre validade; eliminar códigos de lote na experiência.
- WarehouseConsumptionReports.tsx: remove coluna Lote do CSV/exportação; WarehouseOutboundDocuments.ts: documentos de saída priorizam validade e código de barras.
- lib/warehouse/lot.ts remove exportação de selectWarehouseFefoLot; stockView.ts e mobileOutbound.ts ficam sem classificação/posição FEFO.
- Nomes internos de arquivos e campos legados de domínio ainda podem conter lot/lotId/lotCode (compatibilidade interna intencional). Buscar e corrigir **apenas referências apresentadas ao usuário ou decisão FEFO ativa**; não apagar persistência.
- Os commits do PR #371 entre f2186cf e 4a2a2dc documentam a sequência das mudanças; obter diff GitHub do PR para análise linha a linha.

## Testes e CI — Estado sem exageros

- No commit 357ddb885fe045ad71a400759f5e1b9d18e0bde9, Fast CI, Core Protection, Recovery, Legal, Warehouse Server R2 Emulator e Browser E2E passaram; Application CI falhou porque o guard MOBILE-C exigia literal antigo 'lotCode: lotCode.trim()'. O guard foi atualizado no commit f1639dc... para aceitar lotCode vazio. NÃO inferir certificação de versões posteriores a partir dessa rodada.
- No commit c850f0a8e61d4e6bdd0b4268424a457d0f0e3e90: Core Protection PASS, Recovery guardrails PASS, SAAS-DL Legal PASS, VISUAL-R1 W4 PASS e Warehouse Server R2 Smoke PASS. Fast CI FAIL em scripts/warehouse-depot-layout.test.mjs, pois o teste antigo exigia selectWarehouseFefoLot e 'prioridade FEFO' no Início 3D. O ajuste desse teste já entrou em **4a2a2dc44bd505749c689bdc978b534b2315985f**, trocando expectativas para ausência de FEFO e preservação de validade. Application CI / Browser E2E da rodada anterior foram interrompidos/cancelados por atualizações posteriores; não há PASS consolidado para o último HEAD.
- **Na consulta anterior à criação deste documento não havia workflows associados ao commit 4a2a2dc.** Reconsultar o HEAD FINAL após o commit do memorial. As execuções e possíveis falhas posteriores exigem investigação; não afirmar PASS global sem evidência atual.
- Novos testes: scripts/mobile-outbound-unified.test.mjs (scanner dual, baixa automatizada, autor autenticado), scripts/warehouse-validity-only-r2.test.mjs (proíbe prioridade FEFO e exibição técnica de lotes), ajustes em scripts/mobile-r1-outbound.test.mjs, scripts/verify-mobile-r1-outbound.mjs, scripts/verify-mobile-r1-intake-allocation.mjs, scripts/warehouse-barcode-outbound.test.mjs, scripts/warehouse-stock-operational.test.mjs e scripts/warehouse-depot-layout.test.mjs. Testes de integração Fast CI selecionados por scripts/ci-fast-tests.mjs.
- **Perigo de falso PASS:** testes estáticos não substituem teste de API real com identidades, quantidade, várias validades, concorrência e idempotência. Checar o caminho que cria várias linhas e reconcilia os saldos do motor canônico.

## Pendências objetivas para o PR #371

1. Atualizar branch e reexecutar todos os gates do **HEAD final**: Fast CI, Application CI, Core Protection, Recovery, Legal, Warehouse Server R2 Smoke/Emulator, Browser E2E e Visual QA (se áreas visuais alteradas). Inspecionar primeiro jobs/logs com failure, corrigir só os erros reais e os guards legados incompatíveis com a nova decisão. Não restaurar FEFO/campos de lote para fazer testes passarem.
2. Auditar toda UI do Desktop, Mobile e PDF/CSV por termos visíveis 'FEFO', 'Lote', 'lotes', 'lotCode' e priorização por vencimento. Exibir 'Validade', 'Validades', 'Vencido' ou 'Sem validade', conforme função. Buscar também textos de avisos/toasts/legendas e mensagens de confirmação. NÃO renomear identificadores de persistência nem eliminar histórico.
3. Conferir a semântica da baixa sem FEFO: sem lotes; um registro de validade; dois ou mais registros; mistura com saldo sem validade; vencido/inativo; excesso de quantidades atribuídas; transferência de posição; várias linhas do carrinho Desktop; quantity em apresentação diferente da unidade-base; saldo insuficiente/negativo; replay da mesma chave; concorrência de dois usuários; perda de rede após confirmação; outros workspaces/UGs devem ser negados. Garantir que saldos geral, local e referências de validade permaneçam coerentes.
4. Verificar fluxo ponta a ponta: ler item com uma posição e com múltiplas; ler local com um e vários materiais; determinar quantidade; destino existente ou novo; confirmação server-only com withdrawnBy exclusivamente da conta autenticada; nenhuma dupla baixa. Validar política sobre validade vencida como regra independente do FEFO.
5. Inspecionar componentes de visualização 3D após alterações na Home/DepotView: **não reduzir, ocultar ou modificar a Central de Depósitos 3D**. Evitar tocar em módulos estranhos ao PR.
6. Se todos os gates PASS, registrar evidências e propor squash único na main APENAS quando a versão for aceita. Não publicar/merge prematuramente. Em Vercel, publicar por PowerShell do Fundador no projeto correto, um deployment staged com health e smoke humano autenticado, e promover o mesmo deployment após aprovação. Não pedir segredos no chat e não alterar Firestore Rules.

## Contexto arquitetural e distinções

- O R1 do Motor de Confiança (PR #369, main 47323e3b8583e68c8344336a265ddd7d63563c36) permanece produtivo e não deve ser quebrado. Reaproveitar verifyWarehouseRequest, warehouseMobileTrust, Warehouse Server R2 e Firestore IAM, NÃO criar servidor/motor paralelo e NÃO reintroduzir SDK de gravação no celular.
- **Remoção de FEFO** = sem ordenação/priorização por proximidade de vencimento. **Remoção de indicação de lotes** = sem seleção nem exposição de código/número nas interfaces. **Preservação de validade** = continuar vinculando vencimento às quantidades e posição e exibindo alertas de prazo, sem inconsistência.
- Embora os arquivos se chamem lot.ts e lotRepository.ts e as tabelas usem identificadores lot_*, isto é implementação técnica preexistente, não obrigação de a UI expor lotes. Preferir reaproveitamento ao refatorar o banco/Rules.
- Governança GOV-SIMP-01: desenvolvimento desburocratizado; poucos testes relevantes, nenhum framework/camada duplicada; nunca eliminar autorização, integridade, isolamento ou idempotência.
- Outros projetos (Quaestor/Alexa) não estão no escopo.

## Handoff obrigatório — formato pedido pelo Fundador

**Onde estamos:** PR #371, branch feat/mobile-outbound-unified-scan-r2, base main 47323e3b8583e68c8344336a265ddd7d63563c36, HEAD no momento do checkpoint 4a2a2dc44bd505749c689bdc978b534b2315985f, com fix do guard do croqui incluído. Memoriais em arquivo separado e indexados no Memorial Oficial.

**O que estamos fazendo:** implantação de novo fluxo de Saída Móvel em quatro passos, remoção de FEFO de toda a Central e exclusão das indicações visíveis de lotes, mantendo só validades e motores de estoque íntegros; corrigindo CI.

**Quem está fazendo:** executor ChatGPT conectado ao GitHub; Fundador atua somente no smoke humano e PowerShell/Vercel quando houver aceite de release.

**O que fazer a seguir:** consultar novo HEAD, executar/revisar gates CI, corrigir pendências e regressões, auditar todos os textos visíveis e testar saídas autenticadas e conservação dos saldos; registrar resultado no PR. Apenas depois planejar squash/deploy.

**Quem o fará:** próximo chat executor GitHub; Fundador valida manualmente o operador móvel/desktop em staged e promove no PowerShell mediante autorização explícita.

**Sinalização:** memorial é checkpoint de continuidade, **NÃO certificação e NÃO autorização para publicar**.
