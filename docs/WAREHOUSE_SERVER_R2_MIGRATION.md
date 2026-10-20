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
