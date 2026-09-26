# ADM Depósito — Plano de Publicação Modular

Data de adoção: 2026-09-26.

## Objetivo

Reduzir o risco de publicação do ADM Depósito por meio de entregas menores, independentes e verificáveis, preservando integralmente a arquitetura completa já construída.

A estratégia substitui temporariamente a tentativa de publicar todo o ADM Depósito de uma vez.

## Preservação obrigatória

A arquitetura completa anterior foi congelada na branch:

`archive/adm-deposito-full-2026-09`

Baseline preservado:

`5b7e6cdad09381ac6e0c6c62c4934e18357e6347`

Nenhum código funcional do ADM Depósito deve ser apagado durante a modularização sem uma decisão explícita e documentada.

## Branch de reconstrução modular

`feat/adm-deposito-modular-release`

Essa branch parte exatamente da baseline preservada e será usada para reintroduzir as capacidades do ADM em grupos pequenos.

## Princípios

1. Publicar por capacidade, não por número histórico de fase.
2. Manter o ADM exclusivo da conta fundadora durante toda a modularização.
3. Não reintroduzir dependência do EMPROVEX operacional no ADM Depósito.
4. Não criar segunda fonte de verdade para materiais, movimentos ou saldos.
5. Não fazer alterações estéticas durante a estabilização.
6. Não publicar uma integração nova antes da release anterior estar validada em ambiente real.
7. Browser E2E somente quando a release introduzir interação relevante.
8. Firestore Rules devem proteger autenticação, tenant, identidade, operações destrutivas e fronteiras críticas, evitando duplicar validações de domínio excessivamente caras.
9. Toda release deve possuir rollback simples para a release anterior.

## Releases

### ADM-R1 — Fundação independente

Capacidades liberadas:
- Cadastro de Itens / Materiais;
- Meus Depósitos;
- Localizações e subposições;
- Destinos de saída;
- Croqui / layouts;
- Configurações básicas do ADM.

Coleções permitidas:
- `warehouse/{workspaceId}/materials`;
- `warehouse/{workspaceId}/depots`;
- `warehouse/{workspaceId}/locations`;
- `warehouse/{workspaceId}/destinations`;
- `warehouse/{workspaceId}/layouts`;
- `warehouse/{workspaceId}/settings`.

Ficam desligados nesta release:
- movements;
- balances;
- locationBalances;
- intakes;
- lots;
- barcodes;
- withdrawals;
- consumptions;
- inventories;
- alerts;
- siscofisSnapshots;
- integração NF → estoque;
- saída expressa;
- inventário físico;
- FEFO;
- relatórios derivados de consumo.

Critério de aprovação:
- Rules compilam e publicam;
- founder acessa e grava somente os caminhos R1;
- usuário externo permanece sem acesso ao ADM;
- materiais, depósitos, locais, destinos e layouts operam em produção;
- nenhum fluxo operacional do EMPROVEX é afetado.

### ADM-R2 — Identificação física

Adicionar:
- códigos de barras;
- lotes e validade.

Critério:
- R1 continua intacta;
- barcode e lote funcionam isoladamente;
- ainda não há movimentação automática de estoque.

### ADM-R3 — Motor mínimo de estoque

Adicionar:
- movements;
- balances;
- idempotência mínima.

Escopo inicial:
- saldo inicial;
- entrada genérica;
- saída genérica.

Ainda sem:
- NF automática;
- locationBalances;
- inventário físico;
- saída expressa;
- FEFO automático.

Critério:
- movimento + saldo atômico;
- sem estouro do orçamento de expressões;
- Rules publicadas e testadas em ambiente real.

### ADM-R4 — Integrações operacionais

Adicionar progressivamente:
- NF → estoque;
- transferências;
- locationBalances;
- reconciliação necessária.

Cada integração deve ser ativada e validada separadamente antes da seguinte.

### ADM-R5 — Operação avançada

Adicionar:
- saída de material;
- scanner;
- inventário físico;
- FEFO;
- relatórios;
- alertas;
- demais integrações já preservadas na arquitetura completa.

## Processo de cada release

```
código existente reaproveitado
        ↓
feature/capacidade habilitada
        ↓
Rules mínimas correspondentes
        ↓
testes específicos
        ↓
Core Protection
        ↓
Firestore Emulator
        ↓
typecheck/build quando aplicável
        ↓
publicação
        ↓
teste real pelo fundador
        ↓
baseline da release
```

## Regra de rollback

Se qualquer release falhar em publicação ou operação:
1. não avançar para a próxima;
2. restaurar a última baseline publicada;
3. manter o código da release problemática preservado na branch;
4. corrigir apenas o bloco novo;
5. repetir a validação.

## Próxima ação

Executar exclusivamente a ADM-R1.

Não avançar para R2 enquanto R1 não estiver:
- compilável;
- publicável;
- funcional em produção;
- validada manualmente pela conta fundadora.
