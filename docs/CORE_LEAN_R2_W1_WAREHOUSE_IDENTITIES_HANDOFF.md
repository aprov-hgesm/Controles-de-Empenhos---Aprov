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
