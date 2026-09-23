# EMPROVEX — ADM Depósito — FASE 6

## Depósitos / Localizações / Transferências

Documento técnico permanente da FASE 6.

Esta fase transforma a dimensão física do estoque em capacidade operacional sem criar um segundo estoque e sem reinterpretar o Marco Zero SISCOFIS.

## 1. Contratos

Novos contratos:

- `warehouse_depot_v1`;
- `warehouse_location_v1`;
- `warehouse_location_balance_v1`.

Contratos preservados:

- `warehouse_material_v1`;
- `warehouse_movement_v1`;
- `warehouse_balance_v1`;
- integração NF → Estoque da FASE 4;
- `warehouse_siscofis_import_v1`;
- `warehouse_siscofis_snapshot_v1`;
- Marco Zero SISCOFIS da FASE 5.

Nenhum novo catálogo de materiais e nenhum segundo ledger são introduzidos.

## 2. Estrutura física

A hierarquia operacional é:

```text
Depósito
└── Local
    └── Subposição opcional
```

Cada entidade possui:

- ID técnico estável;
- código lógico legível e imutável após a criação;
- nome e descrição editáveis;
- status `active | inactive`;
- workspace e UG;
- ator de criação/alteração;
- timestamps de criação/alteração.

Padrões de ID:

- depósito: `dep_<32 hex>`;
- local: `loc_<32 hex>`;
- subposição: `sub_<32 hex>`.

Renomear uma entidade não altera sua identidade.

A exclusão física de depósito/local/subposição é negada pelas Firestore Rules. O ciclo operacional usa ativação/inativação.

## 3. Distribuição física como projeção

O saldo geral permanece em:

```text
warehouse/{workspaceId}/balances/{materialId}
```

e continua sendo uma projeção do ledger.

A distribuição física fica em:

```text
warehouse/{workspaceId}/locationBalances/{locationBalanceId}
```

com contrato `warehouse_location_balance_v1`.

Essa coleção não é uma nova fonte de verdade. Ela é uma projeção derivada do mesmo movimento de ledger que governa o saldo agregado.

Uma mesma identidade de material pode possuir N posições físicas simultaneamente.

## 4. Sem localização

Saldos existentes antes da FASE 6 não são migrados artificialmente nem regravados.

Quando ainda não existe projeção física persistida, a diferença entre o saldo agregado e as quantidades já localizadas é apresentada como:

```text
UNASSIGNED → “Sem localização”
```

No primeiro movimento que parte dessa posição, a projeção é materializada atomicamente com base no saldo agregado imediatamente anterior.

Novos movimentos externos ao fluxo de transferência, processados pelo serviço oficial do ledger, projetam sua variação em `UNASSIGNED`. Assim:

- entradas continuam aumentando o saldo geral pelo ledger;
- a nova quantidade entra como ainda não organizada fisicamente;
- o operador pode depois transferi-la para uma posição real;
- nenhuma transferência interna muda o total da OM.

## 5. Transferência interna

Transferência reutiliza o tipo existente:

```text
warehouse_movement_v1.type = TRANSFER
quantityDelta = 0
```

A origem estruturada do movimento é:

```text
kind = LOCATION_TRANSFER
actorUid
quantity
from
to
fromBalanceId
toBalanceId
```

A operação é uma única transação Firestore:

1. valida material;
2. valida depósito/local/subposição ativos;
3. lê o saldo agregado;
4. lê as projeções físicas de origem e destino;
5. rejeita saldo insuficiente;
6. cria o movimento `TRANSFER`;
7. atualiza a revisão do saldo agregado sem alterar sua quantidade;
8. reduz a origem;
9. aumenta o destino.

Não existe caminho operacional de transferência por decremento/incremento direto de saldo.

O serviço genérico do ledger rejeita `TRANSFER` e exige o fluxo específico de localização.

## 6. Idempotência

A identidade idempotente da FASE 2 permanece válida.

A interface cria uma chave por tentativa confirmável. Se houver falha de rede e o operador repetir a confirmação com a mesma revisão pendente, o mesmo `movementId` é reutilizado.

Se o movimento já existir e seu payload coincidir, o serviço retorna replay sem movimentar novamente.

Se a mesma identidade for reapresentada com payload diferente, a operação falha por conflito.

## 7. Segurança

A FASE 6 permanece founder-only.

As Rules específicas protegem:

- depósitos;
- localizações;
- projeções de saldo por localização;
- origem estruturada de `TRANSFER`;
- proibição de delete físico;
- workspace;
- UG do piloto;
- ator autenticado;
- imutabilidade de IDs/códigos;
- vínculo entre movimento e projeções;
- transferência para posição ativa;
- atualização atômica da origem/destino.

Usuários externos continuam sem acesso ao namespace `warehouse`.

## 8. Interface

A subaba **Localizações** passa a permitir:

- listar depósitos;
- criar depósito;
- editar nome/descrição;
- ativar/inativar;
- criar local;
- criar subposição opcional;
- editar e ativar/inativar posições;
- visualizar distribuição física por material;
- identificar saldo “Sem localização”;
- selecionar material/origem/quantidade/destino;
- revisar a transferência;
- confirmar;
- verificar o resultado.

A aba **Movimentações** reconhece a origem `LOCATION_TRANSFER`.

## 9. Compatibilidade com fases anteriores

### FASE 4 — NF → Estoque

O cutoff e a idempotência existentes são preservados. NF integrada não é reintegrada.

A entrada continua usando o ledger oficial. A dimensão física nova recebe essa variação inicialmente em `UNASSIGNED`.

### FASE 5 — SISCOFIS

Marco Zero continua usando `INITIAL_BALANCE`.

Snapshots posteriores continuam somente conciliando.

A FASE 6 não transforma divergência SISCOFIS em movimento e não altera snapshots.

## 10. Testes permanentes

Gates específicos:

- `npm run test:adm-deposito-locations`;
- `npm run verify:adm-deposito-phase-6`;
- suíte multi-tenant Firestore;
- Browser E2E completo.

O Browser E2E cobre:

```text
login fundador
→ ADM Depósito
→ Localizações
→ selecionar depósito
→ criar local
→ selecionar material
→ origem Sem localização
→ revisar transferência
→ confirmar
→ verificar distribuição
→ reload
→ confirmar persistência
→ Movimentações
→ confirmar TRANSFER auditável
```

## 11. Fora do escopo

A FASE 6 não implementa:

- lotes;
- validade;
- FEFO;
- scanner;
- código de barras operacional;
- saída expressa;
- editor/planta/Visão do Depósito;
- inventário;
- expansão para usuários externos.

Essas capacidades permanecem nas fases posteriores do ROADMAP.
