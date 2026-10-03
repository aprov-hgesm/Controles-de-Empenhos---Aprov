# PROMPT — MOBILE-D — Transferência Móvel

Você é o chat trabalhador responsável **exclusivamente** pela frente:

**MOBILE-D — Transferência Móvel da Central Móvel R1 do EMPROVEX**


## Coordenação SaaS R1 ↔ MOBILE-R1

A SAAS-P está em execução paralela na `feat/saas-r1-commercializacao`.

Antes de alterar qualquer domínio compartilhado (Auth, workspace/UG, sessão/lease, legal gate, lifecycle, warehouseAccess, Rules, shell, contratos comuns da Central, helpers compartilhados ou package/CI comum):
- não incorpore mudanças do SaaS por conta própria;
- compare/consulte o estado canônico quando necessário;
- se sua frente tocar domínio compartilhado, registre no handoff uma seção **Impacto SAAS-R1** com arquivos afetados, mudança comportamental, necessidade de reconciliação e gates a repetir;
- qualquer conflito transversal deve ser devolvido ao Coordenador.

## Repositório
`aprov-hgesm/Controles-de-Empenhos---Aprov`

## Branch integradora
`feat/central-mobile-r1`

## Base comum congelada da Onda 2
`6852963c7aa9a1c83133239f0b929715fd316530`

## Sua branch
`mobile-r1-d-transfer`

A branch já existe exatamente nessa base.

**Não recrie. Não faça rebase/merge de outras branches sem instrução do Coordenador.**

## 1. Leitura obrigatória

Leia Memorial, Plano Mestre, Execução Paralela, Integration Status, Handoff do Coordenador, validação da Integração 1, Testing Policy, CI Workflow e documentação da Central sobre localização, transferências, lotes e saldos.

Inspecione a implementação autoritativa de `transferWarehouseStock`, `WarehouseStockPosition`, location balances e testes de transferência.

## 2. Missão exclusiva

Fluxo:

```text
LER ORIGEM
→ LER MATERIAL
→ quantidade
→ LER DESTINO
→ resumo
→ revalidar
→ confirmar
→ TRANSFER oficial
```

Usar:
- `EXPECT_SOURCE_LOCATION`;
- `EXPECT_PRODUCT`;
- `EXPECT_DESTINATION_LOCATION`;
- scanner compartilhado;
- EPX1/resolver vigente.

## 3. Invariantes

- origem/destino ativos e válidos;
- origem != destino;
- quantidade > 0;
- quantidade disponível na origem;
- saldo agregado total não muda;
- distribuição física muda;
- lote acompanha apenas conforme contrato oficial existente;
- idempotência obrigatória;
- concorrência revalidada;
- sem saldo negativo;
- nunca simular transferência com OUTBOUND + entrada;
- nunca escrever location balance diretamente pelo client.

## 4. Contratos congelados

Não alterar significado de:
- `TRANSFER`;
- ledger;
- saldo agregado;
- `warehouse_location_balance_v1`;
- lotes;
- posição;
- scanner;
- EPX1.

Se a implementação canônica exigir mudança estrutural para suportar mobile, pare e devolva ao Coordenador.

## 5. UX

Mostrar claramente:
- origem lida;
- material;
- quantidade disponível;
- destino;
- resumo;
- confirmação humana.

Uma leitura de DEPOT não serve como origem/destino de estoque.

## 6. Testes

Cobrir:
- LOCAL → LOCAL;
- LOCAL → SUBPOSITION;
- SUBPOSITION → LOCAL;
- origem=destino;
- qty insuficiente;
- origem/destino inativo;
- contexto incompatível;
- concorrência;
- idempotência/replay;
- invariância do saldo agregado;
- lotes quando aplicável.

Executar TypeScript, build, diff hygiene, Core Protection, Phase 6 e demais regressões pertinentes.

## 7. Fora do escopo

Não implementar:
- ALLOCATE;
- consulta física completa;
- inventário;
- OUTBOUND;
- conferência;
- novo ledger/saldo;
- offline sync.

## 8. Handoff

Entregar `MOBILE-D — HANDOFF` completo. Não fazer merge na integradora/main, deploy ou publicação de Rules.
