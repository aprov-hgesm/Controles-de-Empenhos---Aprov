# PROMPT — MOBILE-C — Alocação Móvel de Recebimento

Você é o chat trabalhador responsável **exclusivamente** pela frente:

**MOBILE-C — Alocação Móvel de Recebimento da Central Móvel R1 do EMPROVEX**

## Repositório
`aprov-hgesm/Controles-de-Empenhos---Aprov`

## Branch integradora
`feat/central-mobile-r1`

## Base comum congelada da Onda 2
`13ca1a50826bdb34b8f63effb0743ac43ecdcddd`

## Sua branch
`mobile-r1-c-intake-allocation`

A branch já existe exatamente nessa base.

**Não recrie. Não faça rebase/merge de outras branches sem instrução do Coordenador.**

## 1. Leitura obrigatória

Antes de editar:
1. `docs/EMPROVEX_MEMORIAL_OFICIAL.md`;
2. `docs/CENTRAL_MOBILE_R1_PLANO_MESTRE.md`;
3. `docs/CENTRAL_MOBILE_R1_EXECUCAO_PARALELA.md`;
4. `docs/CENTRAL_MOBILE_R1_INTEGRATION_STATUS.md`;
5. `docs/CENTRAL_MOBILE_R1_COORDENADOR_HANDOFF.md`;
6. `docs/CENTRAL_MOBILE_R1_INTEGRATION_1_VALIDATION.md`;
7. `docs/TESTING_POLICY.md`;
8. `docs/DEVELOPMENT_CI_WORKFLOW.md`;
9. documentação da Central sobre intake/NF, barcode, lotes, localização e estoque;
10. implementação autoritativa atual da ação `ALLOCATE`, do intake, barcode, lote e posição.

Confirme branch/HEAD antes de editar.

## 2. Missão exclusiva

Implementar o fluxo móvel:

```text
NF pendente
→ item pendente
→ quantidade
→ ler produto
→ resolver/associar barcode com segurança
→ lote/validade quando aplicável
→ ler posição
→ revisar
→ confirmar
→ ALLOCATE oficial
```

Não crie segunda operação de entrada.

## 3. Contratos obrigatórios

Reutilizar sem reescrever:
- `WarehouseMobileScanner`;
- tipos `PRODUCT | LOCATION | UNKNOWN`;
- estados `EXPECT_PRODUCT` / `EXPECT_LOCATION`;
- namespace EPX1;
- resolver oficial de posição;
- `WarehouseStockPosition`;
- `warehouse_barcode_v1`;
- material canônico;
- lote/validade existente;
- intake/NF existente;
- operação autoritativa `ALLOCATE`;
- saldo/ledger oficiais;
- workspace/UG e segurança vigente.

## 4. Invariantes

- quantidade > 0 e <= pendência atual;
- alocação parcial obrigatoriamente suportada;
- o restante permanece pendente;
- um item pode ser dividido entre várias posições;
- barcode já vinculado a outro material = bloqueio;
- barcode desconhecido só pode ser associado por fluxo explícito ao material já selecionado;
- validade é do lote/alocação, não identidade global do material;
- posição deve ser revalidada no momento da confirmação;
- pendência deve ser revalidada no backend;
- operação idempotente;
- não permitir saldo duplicado;
- nunca escrever saldo diretamente no client.

## 5. UX móvel

Fluxo sequencial e explícito:
- `LER MATERIAL`;
- `INFORMAR QUANTIDADE`;
- lote/validade quando necessário;
- `LER LOCAL`;
- resumo;
- `CONFIRMAR ALOCAÇÃO`.

Preservar rascunho seguro em falha transitória, mas não considerar operação confirmada sem resposta autoritativa.

## 6. Fronteira

Preferir componentes próprios MOBILE-C e adapters finos.

Não reescrever:
- scanner;
- EPX1;
- labels/PDF;
- transferência;
- inventário;
- outbound;
- ledger/saldo.

Se o contrato atual de ALLOCATE não suportar o fluxo sem alteração estrutural, pare e devolva ao Coordenador.

## 7. Testes

Cobrir:
- parcial;
- total;
- quantidade acima da pendência;
- concorrência/pendência alterada;
- barcode conhecido;
- barcode desconhecido associado corretamente;
- barcode pertencente a outro material;
- LOCAL;
- SUBPOSITION;
- DEPOT recusado;
- posição inativa;
- workspace/UG incompatível;
- lote/validade;
- replay/idempotência;
- erro de conexão antes/depois da confirmação.

Executar TypeScript, build, diff hygiene, Core Protection e regressões de intake/barcode/localização.

## 8. Fora do escopo

Não implementar:
- TRANSFER;
- consulta física completa;
- inventário;
- OUTBOUND;
- conferência;
- offline sync;
- app nativo;
- novo saldo/ledger.

## 9. Handoff

Entregar `MOBILE-C — HANDOFF` com branch, HEAD, base, arquivos, contratos, testes, métricas, riscos, dependências, conflitos e confirmação de que não houve merge/deploy/Rules.
