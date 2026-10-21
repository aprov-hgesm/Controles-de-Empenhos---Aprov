# WAREHOUSE-SERVER-R2 — Migração integral (20/10/2026)

## Autorização e escopo
Fundador autorizou migração em bloco das gravações da Central de Depósitos para servidor, sem necessidade de preservar a interface mutável legada, pois não há usuários ativos no módulo. Preservar Firestore, isolamento workspace/UG, histórico, estrutura física e módulos externos. Não aplicar corte nas Rules antes de migrar todos os produtores.

## Estado de partida
- PR #347/DRAFT fornece entrada avulsa server-only, Firebase Auth, warehouseAdminTransaction e teste Browser E2E aprovado.
- Backend já existente: rota intake-action para alocação de NF e consumo imediato.
- Pontos mutáveis no SDK cliente identificados:
  - locationRepository: criação/atualização de depósito e local, transferência, arquivamento estrutural.
  - ledgerRepository: movimentos e saldos.
  - inventoryRepository: sessão, contagens, revisão, ajustes, confirmação, cancelamento.
  - withdrawalRepository: destinos, saídas, consumo, retorno, consumo imediato, atualização de status.
  - intakeAllocationRepository: alocação de NF legado.
  - intakeRepository: intakes e consumo publicado.
  - lotRepository, materialRepository, barcodeRepository: cadastros e vínculos.
  - Outros: croquis, SISCOFIS, fila, exclusões de fila, alertas e configurações.
- Banco nomeado emprovex-warehouse no Emulator 8081; banco core no Emulator 8080.

## Política de corte
Sem fases de publicação a pedido do fundador, mas desenvolvimento incremental em um PR DRAFT é permitido. Publicação única apenas depois de todas as operações migrarem e as Rules cliente ficarem read-only, com CI e E2E PASS.
Não criar proxy genérico de escrita controlado pelo navegador. O servidor deve recalcular saldos e validar todas as transições. Não confiar em workspace, UG, UID, estoque final ou histórico fornecidos pelo navegador.

## Checklist obrigatória
- [ ] Zero gravação Warehouse por SDK cliente (inclusive SISCOFIS, estrutura, ajustes, índices).
- [ ] Endpoints autenticados com verifyWarehouseRequest e regras de negócio server-side.
- [ ] Transações, idempotência e prevenção de concorrência/duplicação.
- [ ] Lotes FEFO nas transferências e saídas.
- [ ] Inventário por sessão e progressão sem inconsistências.
- [ ] Testes negativos para permissões, workspace/UG, concorrência, replay.
- [ ] Security Emulator, Browser E2E e mobile, Application CI, Core Protection, Recovery Guard.
- [ ] Corte das Rules read-only só depois da remoção completa de SDK writes.
- [ ] QA isolado e conferência do banco real antes de publicar.

## Handoff
Onde estamos: migração SERVER-R2 na branch própria, baseada no motor aprovado de entrada avulsa.
O que fazendo: mapear e substituir operações mutáveis com o mesmo contrato servidor.
Quem: assistente técnico/GitHub, Fundador autoriza publicação.
Próximo: implementar e testar domínios, cortar Rules em lote quando estiver completo.

## Execução técnica iniciada em 20/10/2026 — estado parcial

Implementações presentes no PR #348 (não publicadas):
- Transporte autenticado comum de comandos do Warehouse (serverCommandClient).
- Rota API operações com verificação server-side de Firebase Auth, workspace/UG e erros seguros.
- Transferência física server-side com conservação de saldo total, planner FEFO, divisão atômica de lote, replay e rejeição por estoque insuficiente. Teste de integração adicionado ao Emulator.
- Escrita de material via servidor, com bloqueio da mudança de unidade de base quando já existe saldo.
- Criação/inativação de destinos via servidor.
- CRUD de depósito, local e subposição via servidor, verificações de escopo e reivindicação determinística de código para novas estruturas.
- Consulta REST filtrada do Firestore com escopo restrito para o planner do servidor.
- Rules server-only **preparadas mas não ativadas** em firestore.warehouse.server-only.rules.
- Auditoria estática de gravações do SDK cliente em scripts/warehouse-r2-direct-write-audit.mjs; em CI no modo REPORT, e não STRICT.

**Não concluído — blockers de publicação:** lotRepository direto, ledger genérico, inventoryRepository, withdrawal/consumption/returns, intakeAllocation legado, SISCOFIS, layouts/croquis, índices/filas, alertas e outras gravações auxiliares. Rastrear todas no relatório de auditoria, migrar para servidores, então habilitar auditoria STRICT e Rules read-only. Não alterar firestore.warehouse.rules em produção antes de zero direct writes.

**Testes:** CI em execução na branch; não considerar PASS antes de consultar resultado do HEAD. Core Protection tinha PASS em commits anteriores. A integração das novas operações foi adicionada a scripts/warehouse-server-manual-entry-emulator.ts, mas o resultado conjunto ainda não estava certificado nesta atualização documental. Não houve merge nem deploy.

**Handoff:** Onde estamos: PR #348 Draft; o que fazendo: migração centralizada; quem: assistente/GitHub; próximo: corrigir regressões, certificar transferência/estrutura, migrar estoque e inventário com plano FEFO, zero SDK writes, corte read-only, CI/E2E/Preview; quem fará: próxima sessão técnica com ferramentas GitHub, sem ação do operador até liberar QA.


## Adendo 20/10/2026 — Auditoria concluída parcialmente e política CI LEAN

> Este adendo prevalece sobre o parágrafo histórico acima que ainda informa modo REPORT e motores não migrados. O código mudou desde aquele ponto; a migração **não está certificada** nem publicada.

- PR #348 DRAFT, HEAD funcional de referência `690d20da9fca104bc66451a04ab42d95029bf8a8`, sem merge nem deploy. Motores server-only foram estendidos para ledger, lote, saída, devolução, inventário, estrutura/arquivamento, barcode, croquis, estado e índice da fila NF, alertas, SISCOFIS; autenticação e workspace/UG devem continuar revisados em cada rota.
- `WAREHOUSE_R2_STRICT=1` já é gate do Application CI; resultado **zero gravações diretas pelo SDK** nos diretórios cobertos pelo scanner estático. Não interpretar como validação dinâmica universal.
- No commit `690d20d`, Core Protection, Smoke Warehouse Auth/Firestore e Browser E2E foram **SUCCESS**. **Application CI FAIL**, teste Fase 9 `scripts/warehouse-depot-layout.test.mjs:451` tem regex inválida (`Unterminated group`). Recuperação: corrigir a regex, fazer `node --check scripts/warehouse-depot-layout.test.mjs`, `npm run test:adm-deposito-depot-layout`, depois Application CI completo. Não mover Rules nem publicar antes dos gates.
- **Diretriz EMPROVEX CI LEAN, ainda não implementada:** Nível 1 Fast CI (TypeScript, zero-write estrito, Core e teste afetado); Nível 2 Firestore Emulator direcionado para mutação de dados e segurança; Nível 3 CI integral, segurança, Recovery, E2E e Preview antes de merge/release/corte de Rules.
- Corrigir guards que exigem sintaxe client-side antiga, substituindo por testes de comportamento e invariantes. Agregar falhas de forma segura numa rodada; eliminar execuções repetidas de `npm ci`/Emulator/Chromium e Smoke duplicado, quando possível; revisar gatilhos `paths` do Smoke para todos os novos motores.
- Invariantes irredutíveis: não permitir estoque negativo, conservar saldo agregado e localizado, preservar lotes/FEFO, histórico, replay, concorrência e isolamento workspace/UG. Proibido desativar guards para obter falso PASS.
- **Handoff:** Onde estamos — PR #348 sob certificação, com guard de Fase 9 quebrado. O que fazemos — consertar teste isoladamente e seguir certificação; CI LEAN documentado como etapa posterior. Quem — executor GitHub. Próximo — `node --check`, teste do croqui, CI completo, análise de bloqueios; só depois proposta técnica do Fast CI. Quem fará — executor GitHub; Fundador decide merge, Rules e publicação.

## Certificação funcional PASS e introdução do CI LEAN — 20/10/2026

- Certificação do motor WAREHOUSE-SERVER-R2: `40c5a6ad7f11fc5dbbbf720191f895ad177a30df` — Application CI #39524796663 **SUCCESS**, Core #39524796550 **SUCCESS**, Smoke Warehouse #39524796528 **SUCCESS**, Browser E2E #39524796594 **SUCCESS**; Rules simplificadas permanecem **não ativadas**.
- `871c1ee4833f180527b7245d284e8e10996e9b18`: implantação dos workflows de N1/N2/N3 em PR #348 DRAFT, sem merge. Fast CI automático em Draft; Application CI completo e 6 gates ao ficar ready ou quando acionado manualmente. Browser E2E e Warehouse Smoke condicionados ao estado ready/manual e com caminhos de código do servidor ampliados. Core Protection permanece separado.
- O Fast CI usa `scripts/ci-fast-tests.mjs` para selecionar testes pelo diff, com falhas agregadas sem falso PASS. TypeScript e scanner de zero client SDK writes continuam automáticos. Não desativar os testes de saldos, lotes, idempotência, concorrência, segurança multi-tenant ou Recovery na etapa de release.
- O Application CI integral também permanece no push main. O SKIP do CI completo em Draft é intencional e não habilita merge. O código certificado está no SHA de referência anterior à mudança de workflows; antes da integração de qualquer HEAD novo, verificar todos os gates.
- Próximo: acompanhar Fast CI na branch de implementação, depois preparar a release via ready_for_review e executar os gates completos no HEAD final; sem ativar Rules de produção nem publicar sem autorização.

## CI LEAN validado no novo HEAD — 20/10/2026

- `cd6308ae95d0a82737f5b84438ec24a5107ac517`: Fast CI #39526632360 e Core Protection #39526632356 **SUCCESS**. Escopo: TypeScript, zero-client-writes estrito, testes unitários por diff e invariantes essenciais.
- Teste legado `scripts/warehouse-outbound-return.test.mjs` passou a certificar o contrato real do motor `warehouseReturnWrite.ts` com tipo `OUTBOUND_RETURN`, limites de quantidade, operação atômica, replay e posição física; também passou a integrar o Application CI de release.
- CI completo/Smoke/E2E no commit CI LEAN: **SKIPPED intencionalmente em DRAFT**. Última certificação integral com todos os jobs **SUCCESS** continua no SHA `40c5a6ad` anterior a alterações de workflows/testes. Ao preparar merge, mudar PR para ready e executar todos os gates no HEAD final.
- Sem merge, deploy ou alteração das Rules de produção. **Handoff:** executor prepara QA/release somente sob autorização; Fundador decide publicação.
