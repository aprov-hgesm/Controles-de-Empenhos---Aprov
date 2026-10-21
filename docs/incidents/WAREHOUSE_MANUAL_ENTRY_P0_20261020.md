# INCIDENTE P0 — Entrada avulsa e leitura de movimentos (20/10/2026)

Status: **DIAGNÓSTICO CONFIRMADO NO CÓDIGO; REMEDIAÇÃO AINDA BLOQUEADA POR TESTE DE RULES**. Não publicar esta branch em produção.

## Evidências reais
- Commit Firestore rejeitado com 403 permission-denied em `gen-lang-client-0982077967/emprovex-warehouse`, workspace `hgesm-aprov`, UG `160416`.
- Escritas atômicas pretendidas: `movements` (`MANUAL_ENTRY`, +80), `balances` (+80), `locationBalances` (+80 em `SUBPOSITION`). A transação rejeitada não foi confirmada. **A criação de material pode ter ocorrido antes** da transação, em `ensureMaterial`; conferir antes de repetir.
- Na leitura `warehouse/hgesm-aprov/movements`: `WAREHOUSE_INVALID_MOVEMENT` por `INVENTORY_ADJUSTMENT` sem origem `PHYSICAL_INVENTORY` auditável.
- Telemetria da UG também apresenta `permission-denied` — incidente distinto até prova em contrário.
- Operador móvel relata barcode já cadastrado: confirmar vínculo real; não presumir duplicação.

## Defeito estrutural identificado na main
- `lib/warehouse/manualEntryRepository.ts`: exige posição diferente de `UNASSIGNED` e escreve movimento, saldo geral e saldo de localização em `runTransaction`.
- `firestore.warehouse.rules`: `warehouseLocationBalanceMatchesNonTransfer` requer `request.resource.data.position.kind == 'UNASSIGNED'`; entradas `MANUAL_ENTRY` em LOCAL/SUBPOSITION não encontram caminho válido nas Rules para o saldo por localização.
- A consulta `getAfter(movementPath)` não basta para autorizar qualquer localização; adicionar exceção genérica sem vincular de forma auditável a posição ao movimento permitiria múltiplos saldos derivados de um único movimento. **NÃO fazer bypass**.

## Correção obrigatória (ordem)
1. Implementar caminho específico e estrito de `MANUAL_ENTRY` localizada nas Rules; registrar no movimento referência inequívoca à posição e ao `locationBalanceId`, com validação recíproca e manutenção de idempotência, UG, workspace, revisão e quantidade. Não liberar caminhos genéricos.
2. Exercitar no Firestore Emulator: criação LOCAL/SUBPOSITION, atualização de saldo, replay idêntico, replay divergente, cross-UG, cross-workspace, posição inativa, duplicação de locationBalances, ausência de material, quantityDelta inválido, falsa localização, saldo negativo e falha transacional atômica; verificar orçamento de regras e CI.
3. Auditar `lib/warehouse/ledgerRepository.ts` na listagem de movimentos; identificar IDs históricos de `INVENTORY_ADJUSTMENT` incompatíveis **somente leitura**, registrar categoria e origem. Separar compatibilidade de leitura histórica das regras de novas escritas; reparo somente com evidência e autorização, sem apagar histórico.
4. Auditar `getWarehouseBarcodeByCode` e `saveWarehouseBarcodeAssociation`, distinguir vínculo existente legítimo, namespace de etiquetas de posição e retorno de permission-denied; conferir material que `ensureMaterial` possa ter criado antes da falha.
5. Rever operações de telemetria para reduzir consultas e isolar erro não crítico do cadastro.
6. Revisão independente, gates, preview isolado e smoke humano antes de qualquer deploy. Conferir Rules **efetivamente publicadas** no banco nomeado; a main não prova a versão em produção.

## Guardrails
- Não realizar deploy de Rules ou aplicação sem verificação de compatibilidade no Emulator.
- Não modificar nem reparar dados reais de produção sem plano reversível e autorização específica.
- Não simular PASS; incidentes permanecem P0 enquanto entrada avulsa e leitura de movimentos não forem validadas fim-a-fim.
- Reduzir burocracia: um PR de correção, testes focados; não repetir leitura/scan nem realizar deploys intermediários.

## Implementação realizada na branch (ainda não homologada)
- `movement.ts`: fonte de MANUAL_ENTRY localizada com posição e ID do saldo, mantendo leitura retrocompatível para movimentos manuais anteriores.
- `manualEntryRepository.ts`: inclui vínculo no movimento transacional.
- `firestore.warehouse.rules`: vinculação recíproca movement ↔ locationBalance, validação da posição ativa e saldo inicial local isolado do saldo global.
- `ledgerRepository.ts`: isolamento de registros históricos incompatíveis nas três listagens; registros inválidos são identificados no console, omitidos da visualização, sem correção nem exclusão automática. Histórico **não está plenamente recuperado** enquanto documentos inválidos permanecerem; precisa trilha de quarentena/diagnóstico para auditoria.
- Revisão estática direcionada: 7/7 verificações de presença dos contratos PASS (não equivale a TypeScript, testes funcionais ou Rules Emulator).
- **Emulator: NÃO EXECUTADO** neste ambiente: rede indisponível para baixar repositório/dependências e execução de Firebase CLI. GitHub Actions: nenhum workflow/status registrado para HEAD consultado.
- **Revisão pendente antes de merge**: avaliação do orçamento de `getAfter`, testes reais de Rules (LOCAL/SUBPOSITION, material preexistente, novo material, privilégio e simultaneidade), compilação TypeScript e verificação de leitura parcial no UI.
- Também pendente: diagnóstico/ajuste de fluxo de código de barras móvel e vínculo eventual de material pré-criado, mais telemetria.

## Comandos sugeridos para validação local (não executados)
```powershell
npm ci
npm run typecheck
node --test scripts/warehouse-manual-entry.test.mjs scripts/mobile-r1-manual-entry.test.mjs
npx firebase-tools emulators:exec --config firebase.warehouse-security-test.json --project demo-emprovex-warehouse --only auth,firestore "node --test scripts/warehouse-modular-r1-security.test.mjs"
```
Não considerar o último comando prova do novo caminho sem testes específicos de operações localizadas adicionados à suite.


## 20/10/2026 — Limpeza de dados de teste CONFIRMADA pelo Fundador
- Alvo: `gen-lang-client-0982077967 / emprovex-warehouse / warehouse/hgesm-aprov`, UG `160416`.
- Autorização expressa do Fundador para excluir registros históricos de materiais de teste; preservação de estruturas físicas e outros módulos.
- Executor PowerShell `Limpar-Materiais-EMPROVEX.ps1`: execução mostrou `EXCLUÍDOS=3241/3241` e instruiu VERIFY.
- VERIFY real recebido: `VERIFICACAO=PASS; DOCUMENTOS_OPERACIONAIS_RESTANTES=0; ESTRUTURA_FISICA_PRESERVADA=PASS`.
- Coleções limpas: materials (57), movements (821), balances (56), locationBalances (70), lots (12), barcodes (3), inventories (1), inventories/*/items (4), intakes (917), intakeQueueIndex (285), queueExclusions (79), withdrawals (13), consumptions (922), outboundReturns (1); demais coleções operacionais verificadas vazias.
- Preservação confirmada: depots (11), locations (268), layouts (25), settings (1), destinations (4) — total 309 documentos.
- Durante execução anterior, o guard detectou atualização em `intakeQueueIndex/state`, causada potencialmente pelo `syncWarehouseIntakeQueueIndex` que grava `updatedAt`; abortou sem deletar. Novo PLAN e execução posterior resultaram em exclusão completa e VERIFY PASS.
- Backup local foi gerado pelo PLAN no Windows do Fundador; **não foi transferido nem validado independentemente neste chat**. Não apagar esse backup.
- Estado do banco referenciado é o da hora do VERIFY: operações posteriores e rebootstrap de índices baseados em notas fiscais da base operacional podem recriar documentos. Não prometer que permanecerá zerado indefinidamente.
- A limpeza **não valida nem corrige** as Rules, o fluxo `MANUAL_ENTRY`, o código de barras ou a telemetria. PR #347 continua DRAFT/NO-GO até Emulator + regressão e smoke humano.
- Próximo trabalho: simplificar fluxo material+movimento+saldos como uma operação atômica, minimizar round-trips e listagens de lotes, validar vínculo de barcode e proteger no Emulator a autorização de LOCAL/SUBPOSITION sem regressões. Publicação não autorizada apenas com limpeza.
