# FASE 9 — Visão do Depósito, Editor e Persistência

## 1. Objetivo

A FASE 9 transforma a superfície **Visão do Depósito** em uma representação operacional 2D com perspectiva tridimensional leve, sem engine 3D e sem criar uma segunda fonte de verdade do estoque.

Blocos oficiais: DEP-17 a DEP-19.5.

## 2. Autoridades preservadas

- material: `warehouse_material_v1`;
- saldo agregado: `warehouse_balance_v1`;
- distribuição física: `warehouse_location_balance_v1`;
- depósitos/localizações: contratos da FASE 6;
- ledger: `warehouse_movement_v1`;
- lotes/validade: `warehouse_lot_v1`.

O croqui nunca persiste saldo, lote ou quantidade.

## 3. Contrato do layout

Contrato versionado: `warehouse_depot_layout_v1`.

Persistência:
`warehouse/{workspaceId}/layouts/{layoutId}`

Campos principais:
- schemaVersion;
- id;
- workspaceId;
- UG;
- nome;
- depotId opcional;
- dimensões lógicas;
- objetos;
- versão;
- status active/archived;
- previousVersionId;
- autor.

Objetos possuem ID visual estável, tipo, rótulo, X/Y, largura/altura, rotação, camada, elevação visual e `warehouseLocationId` opcional.

## 4. Versionamento

Salvar alterações cria um novo documento ativo. A versão anterior é arquivada na mesma transação. Conteúdo histórico não é sobrescrito silenciosamente.

Não existe delete físico de layout pelas Rules.

## 5. Relação com localizações

Objetos operacionais podem referenciar `loc_...` ou `sub_...` reais. O repository valida:
- existência;
- status ativo;
- mesma UG;
- mesmo depósito quando o layout está associado a um depósito.

Mover, redimensionar, renomear ou remover o objeto visual não chama ledger, saldo ou transferência.

## 6. Pesquisa e FEFO

A tela consulta materiais e `warehouse_location_balance_v1` de forma bounded. Ao selecionar material:
- todas as posições com quantidade positiva são destacadas;
- se houver lote FEFO aplicável, sua posição recebe destaque consultivo distinto;
- FEFO não executa saída e não escolhe lote silenciosamente.

## 7. Editor

Modo visualização e modo edição são separados.

O editor suporta:
- adicionar;
- arrastar/mover;
- redimensionar por campos;
- renomear;
- trocar tipo;
- vincular/desvincular localização;
- remover somente do croqui;
- salvar nova versão;
- cancelar alterações.

O editor não é CAD.

O histórico apresenta versões preservadas e permite carregar uma versão arquivada como base de edição. A recuperação sempre resulta em uma nova versão ativa; a versão histórica original permanece imutável.

## 8. Firestore

**Firestore = estado operacional ativo**.

A coleção `layouts` fica no namespace warehouse, founder-only, isolada por workspace/UG. Rules validam schema, IDs principais, versão, status e a transição limitada active → archived da versão anterior.

A integridade referencial fina de `warehouseLocationId` é reforçada no domínio/repository antes da escrita. No piloto founder-only, isso evita aumentar desnecessariamente o orçamento de expressões das Rules após o hardening da FASE 8.

## 9. Drive da UG

**Drive = cópia complementar/versionada/exportável**, nunca fonte operacional.

Nesta implementação, JSON e SVG derivados podem ser exportados pelo operador. A gravação automática desses artefatos no Drive fica deliberadamente desacoplada enquanto a autorização Drive continuar sendo uma sessão temporária em memória: a FASE 9 não introduz dependência que possa derrubar a sessão ou impedir o uso do croqui.

O contrato e os artefatos exportáveis estão prontos para sincronização complementar sem mudar a fonte de verdade. Nenhuma funcionalidade Drive fictícia é exibida como concluída.

## 10. Preview SVG

`renderWarehouseDepotLayoutSvg()` deriva o SVG exclusivamente do layout. O SVG não é autoridade e não contém saldo.

## 11. Desempenho

A tela usa consultas bounded:
- materiais: até 250;
- depósitos: até 250;
- localizações/projeções: até 500;
- layouts: até 100;
- lotes: consultados somente para o material selecionado.

Não há listener global, carregamento de ledger ou engine gráfica.

## 12. Segurança

- founder-only;
- UG piloto preservada;
- usuário externo sem leitura/escrita;
- layout não possui permissão para alterar saldo;
- delete físico negado;
- conteúdo histórico arquivado permanece disponível.

## 13. Testes

- domínio: `scripts/warehouse-depot-layout.test.mjs`;
- guard: `scripts/verify-adm-deposito-phase-9.mjs`;
- multi-tenant Firestore ampliado;
- Browser E2E: `tests/e2e/warehouse-phase-9.spec.mjs`;
- regressão das FASES 0–8 preservada pelo CI.

## 14. Limitações deliberadas

Não implementados:
- inventário físico;
- dashboard/alertas da FASE 11;
- redesign global da FASE 11.5;
- role externa;
- 3D real/WebGL;
- CAD;
- movimentação automática ao arrastar;
- câmera;
- IA interna.

A próxima fase oficial permanece a FASE 10 — Inventário Físico.


## Consolidação nos Módulos 6 e 7 (2026-09-25)

O contrato `warehouse_depot_layout_v1` permanece inalterado e continua sendo a fonte de verdade do croqui.

A consolidação atual:
- consulta layout ativo e histórico explicitamente por `depotId`;
- preserva histórico independente entre depósitos;
- mantém layouts antigos compatíveis e imutáveis;
- adiciona a biblioteca estática `WAREHOUSE_STRUCTURE_LIBRARY` como catálogo de defaults, sem coleção Firestore;
- persiste somente as instâncias usadas em `objects`;
- mantém `warehouseLocationId` como referência opcional à identidade logística real;
- não adiciona saldo, lote ou movimento ao layout.

O editor avançado continua reservado ao Módulo 8.

## Consolidação do editor visual no Módulo 8 (2026-09-25)

A superfície histórica da Visão do Depósito foi evoluída sem alterar o contrato da FASE 9:
- planta 2D permanece modo oficial de edição;
- prévia 2.5D é uma projeção visual dos mesmos objetos;
- interação local inclui grid/snap, zoom, pan, resize, rotação, duplicação, camadas e undo/redo;
- `warehouseLocationId` continua sendo somente referência visual para localização logística existente;
- nenhum objeto do croqui possui autoridade quantitativa;
- persistência continua versionada e explícita;
- Fabric.js/Konva não foram adicionados porque a camada manual existente era suficiente e mais leve para a arquitetura atual.
