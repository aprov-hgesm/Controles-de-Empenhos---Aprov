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
