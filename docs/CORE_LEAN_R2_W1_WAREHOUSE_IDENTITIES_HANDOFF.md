# EMPROVEX CORE LEAN R2 — Worker 1: identidades e comandos Warehouse
**Data-base:** 24/10/2026 · **PR:** #375 (DRAFT) · **Branch:** `feat/core-lean-r2-w1-warehouse-identity`  
**Main consultada:** `afe163139089a1af8ffc81804464429d4d0f9528`. Não promover sem certificação independente.

## 1. Inventário das identidades (não migrar IDs históricos)

| Identidade | Origem e resolução | Persistência / consumidores | Regra de compatibilidade |
| --- | --- | --- | --- |
| `workspaceId`, `ug`, `uid` | `verifyWarehouseRequest` no servidor; claims e autorização institucional | Todos os documentos de escopo, cabeçalhos e ledger | Nunca confiar em valores enviados no comando |
| `mat_*` | `material.ts`, material persistido; entrada avulsa pode derivar do operationId | `materials`, `balances`, lotes, movimentos, relatórios | Preservar a identidade de material e aliases |
| `dep_*`, `loc_*`, `sub_*` | `location.ts` e estrutura canônica, não dos rótulos visuais | `depots`, `locations`, posição nos saldos, lotes e movimentos | Identidade imutável de depósito e posição; croqui 3D intocado |
| `dest_*` | `withdrawal.ts` / `warehouseDestinationWrite.ts` | `destinations`, retiradas, consumos | Resolver nome e status ativo no servidor |
| `bar_*` | Digest canônico da associação por `barcode.ts` | `barcodes`, referências de scanner, movimentos | Resolver apresentação e conversão por associação persistida |
| EPX1, EPX2, código numérico 13 dígitos | `locationBarcode.ts` | etiquetas, resolvedores, navegação | São codificações da localização, não novos IDs persistidos |
| `lot_*` | `lot.ts` e motores de entrada/validade, enriquecimento e transferência | `lots`, movimentos e disponibilidade por posição | Interno, sem escolha manual ou ordenação FEFO; validade vinculada ao saldo atribuído |
| `wd_*` | `createWarehouseWithdrawalId` no comando | `withdrawals`; consumos e movimentos derivados | Reutilizar ID em todo replay; v1/v2 nunca reinterpretados |
| `wline_*` v1/v2 | `createWarehouseWithdrawalLineId` no navegador legado | `consumptions.lineId` / chaves derivadas | IDs existentes nunca regenerados |
| `wline_*` v3 | hash versionado de `withdrawalId + índice lógico + índice de parte` | Mesmos consumidores legados | Estável com linhas iguais e reenvio; não depende da validade/descrição |
| `mov_*` | `createWarehouseMovementId(workspaceId,idempotencyKey)` | `movements`, `balances.lastMovementId` e registros associados | Permanecer determinístico sem recriar ledger |
| `cons_*` | SHA-256 de workspace + chave técnica de retirada e linha | `consumptions`, SISCOFIS, retornos | Imutável após finalização |
| `locbal_*` | `createWarehouseLocationBalanceId(workspaceId,materialId,position)` | `locationBalances` | Chave técnica existente; sem novo `sourcePositionId` |
| `inv_*`, `invit_*` | `warehouseInventoryStart` e itens da sessão | `inventories`, `inventoryItems`, ajustes | Preservar contagens, revisão, sessões e replay |
| `operationId` / `idempotencyKey` | Cliente fornece ID estável de comando; servidor valida e deriva IDs | entradas, transferências, saídas expressas, devoluções | Não mudar identidade após erro de rede ambíguo |
| `invoiceRecordKey`, `invoiceId`, `intakeId` | Fluxo de recebimento de NF e estado da fila de entrada | lotes, entradas, consumos imediatos, rastreabilidade | Preservar referências legais/documentais e vínculos com empenho |
| `outboundReturns/{consumptionId}` | Consumo histórico e `operationId` da devolução | agregados de devolução, movimentos corretivos | Não fundir com ID do movimento; impedir devolução em duplicidade |
| `lotAttributionLocks/{materialId}` | Mutex/revisão por material dos motores que alteram atribuições | Coleção de bloqueios, guardas de concorrência | Revalidar também saldos e lotes; lock sozinho não substitui transação |

**Notas de auditoria:** três produtores de referências precisaram ser corrigidos para incrementar `lotAttributionLocks` na MESMA operação de gravação: entrada avulsa (`warehouseManualEntry.ts`), transferência/divisão (`warehouseTransfer.ts`) e entrada de NF (`app/api/central-depositos/intake-action/route.ts`). A v3 revalida a versão transacional da `locationBalance`, `balance`, material, lotes consultados e mutex para impedir confiar somente em listagem secundária obsoleta. Outros consumidores/atualizadores de quantidade mantêm suas próprias transações sobre saldo e lotes. Novos caminhos de escrita exigirão o mesmo protocolo antes de serem liberados.

## 2. Contrato v3 implementado

Exemplo de intenção mínima, sem rótulos, fator, lote, saldo ou operador:

```json
{
  "schemaVersion": "warehouse_withdrawal_command_v3",
  "withdrawalId": "wd_11111111111111111111111111111111",
  "destinationId": "dest_22222222222222222222222222222222",
  "lines": [{
    "materialId": "mat_33333333333333333333333333333333",
    "position": {
      "kind": "LOCATION",
      "depotId": "dep_44444444444444444444444444444444",
      "locationId": "loc_55555555555555555555555555555555",
      "subpositionId": null
    },
    "requestedQuantity": 2
  }]
}
```

**Campos:** 14 por linha v2 → 3 obrigatórios por linha lógica v3 (redução nominal 78,6%); `presentationCode` ou `barcodeId` só quando necessários. Posição mantém os mesmos IDs estruturais canônicos. O número de linhas derivadas pode superar as linhas de intenção, mas permanece limitado a 40. JSON menor **não implica** automaticamente menos operações Firestore.

**Hash:** SHA-256 com domínio `warehouse_withdrawal_intent_v3\n` sobre destino e linhas normalizadas. Mantém a ordem de linhas, quantidades, IDs canônicos, referência de apresentação e barcode; exclui rótulos, nomes, operador e metadados mutáveis. v1/v2 permanecem byte a byte com seus próprios hashes. `atomicVersion:3` e `intentLineCount` tornam a seleção inequívoca.

**Resolução:** após a autenticação, o servidor consulta material, apresentação, associação de barcode, depósito/posição via contrato existente, saldos, referências de validade e seu mutex. Reutiliza o planejador de alocação automática sem FEFO, gera linhas `wline`, movimentos `mov`, consumos `cons`, lê/valida os documentos dentro da transação e aplica todos ou nenhum.

**Replay:** se o cabeçalho v3 está `FINALIZED`, o mesmo comando retorna sem replanejar/baixar nem exigir saldo atual, status da validade ou descrição original. Reenvio divergente ou tentativa de interpretar v3 como v2 gera conflito. Comandos v2 pendentes no `sessionStorage` móvel mantêm sua versão original e motor de recuperação.

## 3. Fluxos e responsabilidades

| Fluxo | Estado neste PR |
| --- | --- |
| Retirada Mobile | Envia intenção v3; planejador definitivo e validações no servidor |
| Retirada Desktop | Preserva v2 para manter compatibilidade da geração imediata de PDF e histórico documental |
| Saída expressa independente | Motor atual inalterado; integrações devem verificar apresentação e mutex |
| Entrada avulsa/NF | Identidades e links auditados; sem migração de documentos |
| Transferência | Já possui IDs de splits e alocação de validades server-side; sem mudança arriscada |
| Devolução | Já deriva movimento de `consumptionId + operationId`; preservada |
| Consumo imediato | Preservado; depende da trilha de NF e material |
| Inventários e alocações | IDs de sessão/itens e confirmações preservados; sem refatoração prematura |
| Central de Depósitos 3D | Nenhum arquivo 3D alterado |

## 4. Firestore, custo e limites

- v3 acrescenta pré-planejamento autoritativo (materiais, saldos, locationBalances, referências e locks) além das leituras da transação atômica existente: **não há evidência de redução de reads no servidor**. A melhoria comprovável é redução de campos e remoção da responsabilidade técnica do navegador.
- `warehouseAdminBatchRead` limitado a 30 documentos por solicitação; consultas por material até 120 referências, falha fechada em saturação; transação limitada a 450 caminhos/escritas (abaixo do máximo interno de 512 leituras).
- Revisões de consulta e documentos são checadas no contexto transacional, antes de qualquer escrita; divergência rejeita operação completa e permite reenvio do mesmo comando.
- Lotes expirados ou inativos continuam contando como atribuídos, mas nunca são escolhidos para baixa. Sem FEFO.

## 5. Certificação, riscos, handoff

**Não liberar merge/produção com base exclusivamente no código.** Executar `npm run typecheck`, `node --test scripts/mobile-outbound-unified.test.mjs`, `node --test scripts/warehouse-validity-only-r2.test.mjs`, CI completo conforme escopo e Firebase Emulator com validação material + saldos + ledger + consumos: uma/várias linhas, material repetido, múltiplas posições, lotes mistos/livres, conversões, referências expiradas e inativas, saturação, falhas de commit, replay concorrente divergente, outro workspace/UG e v1/v2. Worker 4 deve certificar testes comportamentais independentes.

**Pendências conscientes:** ampliar v3 Desktop só após harmonizar os documentos de saída e pós-commit; certificar concorrência de todos os produtores de validade; medir leitura/escrita do v3 contra baseline; avaliar expansão progressiva para entrada/devolução e inventários somente com testes por domínio. Não remover legados antes da prova.

**Próxima ação coordenada:** Worker 4 certifica transações e invariantes v3 no Emulator; Worker 2 mantém os gates CI; Coordenador autoriza integração apenas com evidências e sem sobreposição dos arquivos proprietários.

## 6. Retomada de segurança /goal — 25/10/2026

### Falhas críticas corrigidas

- **V2 (`atomicVersion=2`):** um `FINALIZED` não é prova suficiente. `auditWarehouseAtomicWithdrawalReplay` deriva `mov_*` e `cons_*` da chave histórica de linha, busca os efeitos persistidos e exige integridade de hash/ID, versão, workspace, UG, ator do commit, quantidade-base, apresentação solicitada, destino, posição, validade e vínculos do consumo. Sem efeitos, lança `WAREHOUSE_WITHDRAWAL_RECONCILIATION_REQUIRED`; **não executa nova baixa**. O hash v2 e IDs v1/v2 não foram modificados.
- **V3 (`atomicVersion=3`):** `effectManifest` e `effectManifestHash` são gravados no MESMO commit do cabeçalho, ledger e consumos. O manifesto contém `intentIndex`, `partIndex`, `lineId`, `materialId`, posição, validade, barcodeId, quantidade-base, apresentação original, fator e IDs determinísticos dos efeitos. Replay usa o manifesto persistido, valida a sua integridade e confere cada documento. **Não replaneja saldos nem lotes após o commit**.
- **Corrida com mesmo `withdrawalId`:** se outro operador confirmou antes da transação atual, o retorno com zero movimentos passa pela mesma auditoria documental fora da transação, sem rebaixar estoque.
- **Conversão:** saída v3 cria movimento interno em unidade-base por referência técnica; `consumptions.requestedQuantity` é registrado na unidade/apresentação do operador. Ex.: **1 caixa de 12 unidades** -> `movement.quantityDelta=-12`, `consumption.quantity=12`, `consumption.requestedQuantity=1`, `consumption.presentationLabel='Caixa de 12 unidades'`. Campos adicionais `operatorRequestedQuantity`, `operatorPresentationCode`, `operatorPresentationLabel`, `operatorFactorToBaseUnit`, `operatorIntentIndex` preservam a intenção documental em linhas subdivididas; manifesto dá rastreabilidade das partes. Histórico v2 mantém a sua semântica.
- **Validades:** `warehouseManualEntry.ts`, `warehouseTransfer.ts` e `app/api/central-depositos/intake-action/route.ts` incrementam `lotAttributionLocks` junto de criações/divisões e mudanças da atribuição no commit. Ajuste de inventário já atualizava mutex ao reduzir atribuição; devolução e retirada alteram quantidades existentes junto de saldos/lotes. A v3 revalida versões de documentos e mutex antes das escritas. FEFO e seleção manual não foram reintroduzidos.

### Provas executadas

**Prova completa autenticada (HEAD de código `57f93259dd94c4567c4e1e4da6f73f2e510e37ca`):** [GitHub Actions #40157629023](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/runs/40157629023) — **PASS**. Ambiente: `demo-emprovex-security`, Firebase Auth Emulator, banco nomeado `emprovex-warehouse` no Firestore Emulator; dados fictícios.

- Contrato histórico v2 copiado **sem modificação** do Worker 4 PR #374 / SHA `a16bab62f9bda3664db724abed44f1f5b2498ce7`: PASS, incluindo hash fixo e IDs determinísticos.
- Emulador de migração/recuperação v1/v2: PASS, incluindo 6 pontos de interrupção legados, transação v2 multilinha, rollback, concorrência, resposta perdida, inventário, entrada, transferência e devolução.
- Suíte adversarial W4 intacta: PASS, incluindo **rejeição de cabeçalho `FINALIZED` v2 forjado sem documentos**.
- Suíte adversarial W1 v3: PASS, incluindo manifesto/head forjados, adulteração de manifesto, consumo ausente, movimento ausente, mesmo ID concorrente e IDs diferentes disputando saldo, lotes, duas posições, base/apresentação, idempotência, reversão sem resíduo, perda de resposta, UG e limites de linhas.
- [Fast CI #40157630862](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/runs/40157630862) PASS: TypeScript, proibição de escritas Warehouse via cliente, testes unitários relevantes, operações móveis, barcode, estoque e validade.
- [Core Protection #40157630857](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/runs/40157630857) PASS.
- Complemento posterior: suíte de paridade Desktop v2/Mobile v3 em `scripts/warehouse-w1-v3-emulator.ts` com dois materiais de 24 unidades, apresentação box de 12, barcode associado server-side, baixa 1 caixa, comparação de saldo, movimento, consumo, UID/destino, provenance e replay; também recusa novo comando com barcode desativado. **Exige nova execução do Emulator sobre o HEAD pós-complemento.**

**Comandos reproduzíveis** (PowerShell, sem WSL):

```powershell
npm.cmd ci
npx.cmd --yes tsx --test scripts/w1-upstream-w4-contract.test.ts
$env:NEXT_PUBLIC_EMPROVEX_E2E_PROJECT_ID='demo-emprovex-security'
npx.cmd --yes firebase-tools emulators:exec --config firebase.warehouse-security-test.json --project demo-emprovex-security --only auth,firestore "npx --yes tsx scripts/warehouse-server-manual-entry-emulator.ts"
npx.cmd --yes firebase-tools emulators:exec --config firebase.warehouse-security-test.json --project demo-emprovex-security --only auth,firestore "npx --yes tsx scripts/w1-upstream-w4-adversarial-emulator.ts"
npx.cmd --yes firebase-tools emulators:exec --config firebase.warehouse-security-test.json --project demo-emprovex-security --only auth,firestore "npx --yes tsx scripts/warehouse-w1-v3-emulator.ts"
```

O workflow isolado da branch é `.github/workflows/core-lean-r2-w1-warehouse-assurance.yml`.

### Fronteiras, custo e integração

- **Não mergear nem publicar automaticamente.** PR #375 permanece DRAFT até o Coordenador certificar a composição com Worker 2 (#372), Worker 3 e PR de autorização; Worker 4 deve avaliar formalmente o SHA final do Worker 1.
- Não houve alteração de Firestore Rules, dados reais, DOM da Central 3D nem modelos históricos.
- O replay agora faz leituras adicionais para confirmar efeitos persistidos. Para 40 linhas podem ser até **80 documentos derivados**, divididos em batches de 30; os comandos novos v3 continuam com pré-leituras para consultas de validade. **Não há alegação de redução de reads Firestore**; medir em QA antes de qualquer promessa de desempenho.
- **Sem migração de IDs históricos.** Manifesto é apenas v3; nenhuma retroadição do manifesto a cabeçalhos v1/v2; contrato v2 valida efeitos derivados com chave histórica.
- Documentos e relatórios de saída Desktop continuam no contrato v2 e não foram reescritos. A equivalência de negócio Desktop/Mobile deve ser verificada na suíte de paridade; a única diferença intencional é a granularidade técnica de referências no ledger v3.

**Handoff:** Worker 1 entregará SHA final testado, links GitHub Actions e manifesto de arquivos no PR #375; Worker 4 fará revisão independente cross-PR, Worker 2 cuidará da composição do CI, Coordenador decidirá GO/NO-GO de integração com `main`. Até essa autorização, **NO-GO para merge/produção**.

## 7. Diagnóstico adicional da prova A/B com barcode

A execução de paridade Desktop v2 / Mobile v3 em [W1 run #40158057123](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/runs/40158057123) revelou **FAIL legítimo** ao testar associação de apresentação com barcode no v3. O v3 preservava `barcodeId` mas o movimento técnico estava marcado `interface:'MANUAL_SEARCH'`, combinação recusada corretamente pelo contrato de `warehouse_movement_v1` (`WAREHOUSE_INVALID_OUTBOUND_MOVEMENT`). Todos os cenários históricos, a suíte adversarial v2 W4 e os cenários v3 anteriores à paridade haviam passado.

**Correção executada:** no motor `warehouseWithdrawalAtomicWrite.ts`, somente as linhas técnicas v3 cuja associação `barcodeId` já foi validada pelo servidor são persistidas com `interface:'BARCODE_SCANNER'`; continuam em unidade-base internamente. Linhas sem associação seguem `MANUAL_SEARCH`. O teste A/B exige explicitamente `BARCODE_SCANNER` nos dois contratos, barcodeId/código corretos, `1 caixa` no histórico, `12 unidades` no ledger, autoria, destino, saldo final, replay e rejeição de barcode desativado.

**Critério de aceite pendente da última revisão:** PASS do workflow W1 Auth/Firestore Emulator e Fast CI no SHA posterior aos commits `99ffaac32529af74d536a2715f84bfa4319a44f6` (motor) e `d9bae156db5619629d1e7ea0f5437e48e2d3a276` (asserção). Após o resultado, o Coordenador e o Worker 4 devem consumir o HEAD final reportado no PR #375. Até lá não promover.
