# FASE 8 — Código de Barras, Scanner e Saída Expressa

Status deste documento: implementação funcional da FASE 8. O fechamento oficial em `STATUS.md` e `ROADMAP.md` somente ocorre após CI verde e merge na `main`.

## 1. Escopo

A FASE 8 implementa DEP-13, DEP-13.1, DEP-14, DEP-14.1, DEP-14.2, DEP-16, DEP-16.1, DEP-16.2 e DEP-16.3 sem antecipar a FASE 9.

Capacidades:
- múltiplos códigos de barras por material canônico;
- apresentações subordinadas às conversões já existentes em `warehouse_material_v1`;
- scanner USB HID/teclado e digitação manual no mesmo fluxo;
- associação segura de código desconhecido a material existente;
- saída expressa `SCAN → quantidade → ENTER`;
- baixa transacional no ledger, saldo agregado e projeção física;
- escolha opcional de lote com atualização da atribuição logística;
- FEFO apenas como recomendação explícita;
- proteção contra saldo negativo;
- busca da tela Estoque por barcode;
- piloto permanece founder-only.

## 2. Autoridades preservadas

A FASE 8 não cria uma fonte quantitativa paralela.

| Responsabilidade | Autoridade |
| --- | --- |
| identidade do material | `warehouse_material_v1` |
| apresentação/conversão | `warehouse_material_v1.conversions` |
| movimentação auditável | `warehouse_movement_v1` |
| saldo agregado oficial | `warehouse_balance_v1` |
| distribuição física | `warehouse_location_balance_v1` |
| lote/validade | `warehouse_lot_v1` |
| barcode | `warehouse_barcode_v1` como identificador auxiliar |

O barcode jamais é usado como `materialId`.

## 3. Contrato warehouse_barcode_v1

Persistência:

`warehouse/{workspaceId}/barcodes/{barcodeId}`

Campos de domínio:
- `schemaVersion = warehouse_barcode_v1`;
- `id`;
- `workspaceId`;
- `ug`;
- `materialId`;
- `barcode`;
- `presentation`;
- `factorToBaseUnit`;
- `status`;
- `createdBy`;
- `updatedBy`;
- timestamps.

O ID é determinístico por SHA-256 de `workspaceId + barcode normalizado` no repository. A associação é imutável em material, código, apresentação e fator; apenas o status pode ser alterado. Isso evita reassociação silenciosa de um código já usado operacionalmente.

## 4. Apresentações e conversão

A conversão não é redefinida na FASE 8. `warehousePresentationFactor()` resolve exclusivamente:
1. unidade canônica do material → fator 1;
2. apresentação presente em `warehouse_material_v1.conversions` → fator cadastrado.

Exemplo:

`Caixa 12 frascos × 3 = 36 frascos`.

Um código desconhecido pode ser associado somente a uma dessas apresentações existentes. O fluxo não cria material nem conversão implicitamente.

## 5. Scanner HID

A tela `/adm-deposito/saida-expressa` usa um input com foco operacional.

Contrato:
- scanner USB atua como teclado;
- o scanner digita o código;
- ENTER dispara identificação;
- o mesmo input aceita digitação manual;
- nenhum SDK, driver proprietário ou API de fabricante é necessário;
- após sucesso o foco retorna ao campo de leitura.

## 6. Código desconhecido

Código sem associação:
1. é sinalizado como desconhecido;
2. não cria material automaticamente;
3. exige escolha explícita de material ativo existente;
4. exige escolha de apresentação/conversão existente;
5. persiste `warehouse_barcode_v1`;
6. retorna ao fluxo da saída.

## 7. Saída expressa

A operação específica vive em `outboundRepository.ts` e não usa escrita avulsa de saldo.

A transação lê:
- material;
- saldo agregado;
- movimento/idempotência;
- saldo da posição física;
- barcode quando aplicável;
- lote quando explicitamente escolhido.

Depois valida e grava atomicamente:
- um `warehouse_movement_v1.type = OUTBOUND`;
- `warehouse_balance_v1`;
- a `warehouse_location_balance_v1` da posição escolhida;
- opcionalmente a quantidade atribuída do lote escolhido.

A origem estruturada do movimento é `EXPRESS_OUTBOUND` e registra:
- interface `BARCODE_SCANNER` ou `MANUAL_SEARCH`;
- ator;
- quantidade informada;
- quantidade convertida para unidade oficial;
- apresentação/fator;
- barcode quando existente;
- posição física;
- lote quando escolhido.

A chave de idempotência permanece estável durante uma tentativa. Replay idêntico não baixa novamente; tentativa divergente conflita.

## 8. Proteção contra saldo negativo

A proteção existe em mais de uma camada:
- preparação de domínio recusa quantidade superior ao saldo agregado;
- repository revalida saldo e posição dentro da transação Firestore;
- projeção física não admite quantidade negativa;
- Firestore Rules exigem o saldo agregado pós-`OUTBOUND` não negativo;
- Rules exigem a projeção física correspondente na mesma operação para `EXPRESS_OUTBOUND`.

Não existe baixa parcial silenciosa.

## 9. Localização

A FASE 8 reutiliza integralmente a FASE 6:
- `WarehouseStockPosition`;
- IDs estáveis de depósito/local/subposição;
- `warehouse_location_balance_v1`;
- `UNASSIGNED` para legado.

Nenhum croqui, planta ou perspectiva visual foi implementado. Isso permanece na FASE 9.

## 10. Lote e FEFO

A FASE 8 reutiliza `selectWarehouseFefoLot()`.

Regras:
- FEFO é exibido como sugestão;
- o lote não é selecionado silenciosamente;
- o botão “Usar lote recomendado” representa escolha humana explícita;
- sem lote/validade a saída continua possível;
- lote escolhido deve pertencer ao material e à posição selecionada e ter atribuição suficiente;
- quando escolhido, sua atribuição é reduzida na mesma transação da saída;
- `warehouse_lot_v1.quantity` continua não sendo o saldo oficial.

## 11. Busca operacional

`WarehouseStockOperational` carrega barcodes de forma bounded e adiciona seus códigos ao índice de busca em memória. Pesquisar um barcode leva à ficha do material canônico correspondente. A ficha mostra os códigos associados.

Não foi criada uma segunda tela independente de estoque.

## 12. Firestore Rules e segurança

A FASE 8 mantém:
- namespace segregado por workspace;
- UG piloto `160416`;
- `canAccessWarehouseModule()` founder-only;
- leitura/escrita de barcodes bloqueada para setor externo;
- identidade crítica do barcode imutável;
- barcode da saída deve existir, estar ativo e pertencer ao mesmo material/UG;
- saída expressa deve possuir projeção física correspondente;
- lote explícito deve sofrer decremento coerente;
- barcode não pode ser apagado fisicamente.

## 13. Feedback operacional

A tela apresenta:
- material;
- saldo oficial;
- apresentação/fator;
- localização;
- FEFO;
- lote opcional;
- impacto na unidade oficial;
- sucesso/erro explícitos;
- saldo anterior e posterior;
- histórico curto da sessão.

Erros de código desconhecido, inativo, quantidade, saldo, localização, lote e persistência são diferenciados.

## 14. Testes

Cobertura introduzida:
- `scripts/warehouse-barcode-outbound.test.mjs`;
- `scripts/verify-adm-deposito-phase-8.mjs`;
- extensão de `scripts/firestore-multitenancy-security.test.mjs`;
- `tests/e2e/warehouse-phase-8.spec.mjs`;
- extensão do E2E permanente de usuário externo.

O Browser E2E cobre associação de código desconhecido, scanner + ENTER, FEFO explícito, duas saídas consecutivas, saldo insuficiente, código desconhecido, persistência após reload e busca por barcode na aba Estoque.

## 15. Limitações deliberadas

Não pertencem à FASE 8:
- croqui/mapa;
- editor visual;
- inventário físico/cíclico;
- expansão para usuários externos;
- redesign integral do módulo;
- SDK de scanner;
- parsing GS1 avançado de lote/validade embutidos no código.

## 16. Decisões permanentes

As decisões D-042 a D-044 em `DECISIONS.md` consolidam:
- barcode subordinado ao material/conversão;
- saída expressa como transação atômica/idempotente;
- scanner HID e FEFO com confirmação humana.

## 17. Próxima fase

Após o fechamento formal da FASE 8, a próxima fase do ROADMAP é a FASE 9 — Visão do Depósito, Editor e Persistência. Este documento não a inicia.
