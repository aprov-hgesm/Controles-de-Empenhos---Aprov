# EMPROVEX — Central Móvel R1 — MOBILE-B — Identidade Física, Etiquetas e Resolver

Data: **2026-10-02**
Frente: **MOBILE-B**
Branch: 'mobile-r1-b-location-labels'
Base congelada: '53e28b81874ee1b7ce0bd484cc7a97537aa99473'

## 1. Decisão de identidade física

A identidade física escaneável é derivada exclusivamente dos IDs técnicos já existentes de:

- depósito: 'dep_<32 hex>';
- local: 'loc_<32 hex>';
- subposição: 'sub_<32 hex>'.

Nenhuma coleção, índice auxiliar persistido, segundo catálogo de localizações ou novo banco é criado.

Renomear 'name', 'description' ou 'code' lógico não altera o código físico.

## 2. Namespace

Formato lógico do payload:

'EPX1' + 'kind' + 'decimal128'

Onde:

- 'EPX1' = namespace EMPROVEX Location Barcode versão 1;
- 'kind' = '1' depósito, '2' local, '3' subposição;
- 'decimal128' = ID técnico de 128 bits convertido de hexadecimal para decimal, com 39 dígitos e zero-padding.

Exemplo estrutural:

'EPX12<39 dígitos>'

O formato é reversível, sem hash truncado e sem perda de informação do ID técnico.

EAN/UPC comerciais são numéricos e não possuem o prefixo 'EPX1'; portanto não são aceitos pelo decoder de posição.

## 3. Simbologia física

A impressão usa **Code 128**.

Motivos:

- leitura ampla por câmera móvel e scanners;
- suporte a namespace alfanumérico;
- checksum próprio da simbologia;
- melhor densidade que Code 39;
- não exige dependência nova no projeto;
- permite alternância automática de Code Set B para Code Set C, compactando a cauda numérica de 40 dígitos.

O encoder do PDF é interno, determinístico e limitado a ASCII imprimível.

Os presets A4 'COMPACT', 'MEDIUM' e 'LARGE' são preservados. A validação física final de contraste, foco e distância permanece obrigatória na Integração 1 com impressão real e câmera real.

## 4. Resolver

Existem dois níveis deliberadamente separados:

1. 'resolveWarehousePhysicalIdentityCode'
   - resolve depósito, local ou subposição;
   - revalida contrato, workspace, UG, status e hierarquia;
   - retorna a entidade física autoritativa;
   - para local/subposição também retorna 'WarehouseStockPosition'.

2. 'resolveWarehouseStockPositionCode'
   - aceita apenas leituras que resultem em posição operacional;
   - LOCAL → 'WarehouseStockPosition.kind = LOCATION';
   - SUBPOSITION → 'WarehouseStockPosition.kind = SUBPOSITION';
   - DEPOT falha fechado com 'DEPOT_NOT_STOCK_POSITION'.

A separação é necessária porque o contrato congelado 'WarehouseStockPosition' não possui uma variante “DEPOT”. A MOBILE-B não altera esse contrato e não fabrica uma posição inexistente.

## 5. Revalidação autoritativa

O adapter 'locationBarcodeResolver.ts' reutiliza:

- 'getWarehouseDepot';
- 'getWarehouseLocation'.

As leituras são **uncached de propósito** no momento da resolução operacional.

O repository existente já exige usuário autenticado e 'getCurrentOperationalScope' compatível com o workspace informado. O resolver ainda revalida:

- workspace;
- UG;
- contrato da entidade;
- status 'active';
- tipo da entidade;
- vínculo local → depósito;
- vínculo subposição → local pai → depósito.

A etiqueta nunca concede autorização.

## 6. Segurança

Falha fechada para:

- payload fora do namespace;
- namespace malformado;
- ID inexistente;
- entidade inválida;
- workspace divergente;
- UG divergente;
- entidade inativa;
- hierarquia inválida;
- depósito usado como posição de estoque.

Código comercial de produto não é interpretado como posição.

Nenhuma Firestore Rule é relaxada e nenhum novo caminho de escrita é criado.

## 7. Etiquetas

Cada 'WarehouseLabelItem' passa a conter 'physicalBarcode'.

O PDF mantém:

- EMPROVEX;
- tipo;
- código lógico humano;
- nome;
- depósito;
- hierarquia opcional;
- UG opcional;
- workspace;
- código físico em Code 128;
- representação textual do payload.

A geração automática passa a ignorar depósito inativo, coerente com a regra já vigente de etiquetas apenas para estruturas ativas.

## 8. Limites de escopo

Não implementado nesta frente:

- câmera;
- decoder de câmera;
- scanner UI;
- alocação;
- transferência;
- inventário;
- saída;
- conferência;
- offline;
- app nativo;
- nova persistência;
- mudança de ledger/saldo;
- mudança de Rules.

## 9. Contrato esperado para MOBILE-A / Integração 1

MOBILE-A deve tratar o namespace 'EPX1' como código de posição/estrutura física e encaminhá-lo ao resolver da MOBILE-B.

A integração deve preservar a separação:

- barcode comercial → fluxo de produto;
- 'EPX1...' → fluxo de identidade física;
- nenhum dos dois namespaces deve ser reinterpretado silenciosamente como o outro.
