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
