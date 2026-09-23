# FASE 7 — Estoque Operável / Lotes / Validade / FEFO

## 1. Escopo

A FASE 7 transforma a aba **Estoque** em uma superfície operacional de consulta e enriquecimento logístico sem criar uma segunda fonte de verdade para quantidade.

Blocos oficiais cobertos:
- DEP-11;
- DEP-11.1;
- DEP-11.2;
- DEP-12;
- DEP-15;
- DEP-15.1;
- DEP-15.2.

Permanecem fora do escopo:
- código de barras;
- scanner;
- saída expressa;
- croqui/planta do depósito;
- inventário físico;
- expansão para usuários externos.

Essas capacidades continuam nas fases posteriores, começando pela FASE 8.

## 2. Autoridades de estoque preservadas

A FASE 7 não altera as fontes de verdade anteriores:

- material canônico: `warehouse_material_v1`;
- ledger: `warehouse_movement_v1`;
- saldo agregado: `warehouse_balance_v1`;
- distribuição física: `warehouse_location_balance_v1`.

O lote **não é um saldo concorrente**.

A quantidade registrada no lote é uma atribuição/rastreabilidade logística. Criar ou editar `warehouse_lot_v1`:
- não altera `warehouse_balance_v1`;
- não altera `warehouse_location_balance_v1`;
- não cria entrada, saída, transferência ou ajuste;
- não cria um movimento no ledger.

A persistência valida que a quantidade informada não ultrapasse o saldo oficial disponível e, quando existe posição física explícita, não ultrapasse o saldo daquela posição. Eventuais inconsistências de atribuição são sinalizadas como pendência, nunca corrigidas silenciosamente.

## 3. Contrato warehouse_lot_v1

O contrato canônico é:

`warehouse_lot_v1`

Campos de domínio:
- `id` técnico estável no formato `lot_<32 hex>`;
- `workspaceId`;
- `ug`;
- `materialId` canônico;
- `code`;
- `expiresOn` no formato `YYYY-MM-DD` ou `null`;
- `quantity` como atribuição logística;
- `position` reutilizando `WarehouseStockPosition`;
- `origin`;
- `status`;
- `createdBy`;
- `updatedBy`.

Persistência acrescenta:
- `createdAt`;
- `updatedAt`.

A descrição textual do material nunca é usada como chave de identidade. O vínculo é sempre pelo `materialId` canônico.

## 4. Origem

Origem de lote possui contrato estruturado:

- `INVOICE`;
- `MANUAL_ENRICHMENT`;
- `LEGACY`.

Quando a origem é `INVOICE`, o lote referencia o `movementId` oficial e os identificadores da NF. As Firestore Rules verificam que o movimento:
- existe no mesmo workspace;
- pertence à mesma UG;
- pertence ao mesmo material;
- possui origem `INVOICE`;
- corresponde à mesma NF.

NF sem informação de lote continua apta a gerar estoque conforme a FASE 4. O lote enriquece a entrada existente; ele nunca duplica a entrada.

## 5. Validade

`expiresOn` é opcional porque nem todo material possui validade aplicável.

Quando informado:
- deve ser uma data ISO real no formato `YYYY-MM-DD`;
- datas impossíveis são rejeitadas pelo domínio;
- lote vencido recebe estado operacional próprio;
- lote próximo do vencimento é destacado;
- ausência de validade gera aviso informativo quando existe lote ativo.

Estoque legado continua operável mesmo sem lote ou validade.

## 6. FEFO

FEFO — **First Expire, First Out** — é uma recomendação operacional.

A função oficial:
- considera apenas lotes ativos;
- exige quantidade atribuída maior que zero;
- exige validade informada;
- ignora lotes vencidos;
- prioriza a validade futura mais próxima;
- desempata de forma determinística por código/ID.

FEFO não executa saída, não altera quantidade e não cria movimento.

A FASE 8 poderá consumir essa recomendação para a futura saída expressa sem alterar a autoridade do ledger.

## 7. Pendências logísticas

As pendências são avisos auditáveis e não bloqueios artificiais.

A FASE 7 identifica:
- saldo `UNASSIGNED`;
- ausência de informação de lote;
- lote sem validade;
- lote vencido;
- distribuição física maior que o saldo agregado;
- atribuição de lotes maior que o saldo oficial;
- origem documental ainda não vinculada.

O sistema não corrige automaticamente nenhuma dessas situações.

## 8. Estoque operacional

A aba Estoque consulta de forma bounded:
- até 250 materiais/saldos;
- até 500 depósitos/localizações/projeções físicas;
- até 500 lotes;
- histórico de até 50 movimentos somente quando a ficha do material é aberta.

Pesquisa geral cobre:
- descrição;
- ID canônico;
- aliases;
- lote;
- validade;
- NF;
- fornecedor;
- CNPJ;
- depósito/localização.

Filtros específicos:
- depósito;
- localização;
- situação de validade.

A listagem apresenta:
- material;
- saldo total;
- quantidade distribuída;
- quantidade Sem localização;
- quantidade de lotes;
- validade mais próxima;
- recomendação FEFO;
- quantidade de pendências.

## 9. Ficha do material

A ficha consolida:
- identidade canônica;
- unidade/apresentação;
- saldo agregado;
- distribuição física;
- lotes;
- validade;
- recomendação FEFO;
- pendências;
- origem;
- histórico oficial do ledger.

O histórico é consultado por `materialId` e carregado sob demanda.

A ficha permite criar/editar enriquecimento de lote, mas essa ação não altera saldo.

## 10. Localizar no depósito

A ação **Localizar no depósito** utiliza os IDs estáveis da FASE 6 e apresenta:
- depósito;
- local;
- subposição, quando aplicável;
- Sem localização, quando houver.

Nenhum croqui foi implementado.

A FASE 9 continuará recebendo os mesmos IDs para destacar visualmente a posição no futuro mapa.

## 11. SISCOFIS

A FASE 5 permanece integralmente preservada:
- primeiro relatório confirmado pode estabelecer Marco Zero;
- Marco Zero usa `INITIAL_BALANCE`;
- snapshots posteriores são apenas conciliação;
- divergência nunca autocorrige estoque;
- lote/validade não são inferidos quando a fonte não os fornece.

## 12. Segurança

O módulo continua founder-only.

Firestore Rules específicas de `lots` protegem:
- workspace fundador;
- UG;
- ID técnico de lote;
- vínculo lote → material;
- posição física ativa;
- origem de NF → movimento oficial;
- campos imutáveis;
- impossibilidade de delete físico;
- bloqueio de usuários externos.

A coleção `lots` foi retirada do fallback genérico e passou a possuir regras próprias.

## 13. Testes

Gates permanentes da FASE 7:
- `npm run test:adm-deposito-stock-operational`;
- `npm run verify:adm-deposito-phase-7`;
- cenários da FASE 7 na suíte `test:security:multitenant`;
- Browser E2E em `tests/e2e/warehouse-phase-7.spec.mjs`.

Coberturas principais:
- contrato de lote;
- isolamento workspace/UG;
- validade real;
- FEFO;
- vencidos;
- lote sem saldo;
- estoque legado sem lote;
- pendências;
- integridade com material/NF/localização;
- saldo oficial preservado;
- pesquisa/ficha;
- reload/persistência;
- founder-only.

## 14. Limitações intencionais

A FASE 7 não implementa:
- baixa por lote;
- reserva de lote;
- saída automática FEFO;
- barcode/scanner;
- conversão por embalagem para leitura;
- planta do depósito;
- inventário.

A ausência dessas capacidades é intencional para não antecipar a FASE 8 ou posteriores.
