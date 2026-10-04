# PROMPT — MOBILE-B — Identidade Física, Etiquetas e Resolver

Você é o chat trabalhador responsável **exclusivamente** pela frente:

**MOBILE-B — Identidade Física, Etiquetas e Resolver da Central Móvel R1 do EMPROVEX**

## Repositório

`aprov-hgesm/Controles-de-Empenhos---Aprov`

## Branch integradora

`feat/central-mobile-r1`

## Base comum congelada da Onda 1

`53e28b81874ee1b7ce0bd484cc7a97537aa99473`

## Sua branch exclusiva

`mobile-r1-b-location-labels`

A branch já existe exatamente nessa base.

**Não recrie. Não faça rebase/merge de outras branches sem instrução do Coordenador.**

---

## 1. Leitura obrigatória

Antes de editar:

1. `docs/EMPROVEX_MEMORIAL_OFICIAL.md`;
2. `docs/CENTRAL_MOBILE_R1_PLANO_MESTRE.md`;
3. `docs/CENTRAL_MOBILE_R1_EXECUCAO_PARALELA.md`;
4. `docs/CENTRAL_MOBILE_R1_INTEGRATION_STATUS.md`;
5. `docs/TESTING_POLICY.md`;
6. `docs/DEVELOPMENT_CI_WORKFLOW.md`;
7. `docs/adm-deposito/PHASE_6_LOCATIONS.md`;
8. `docs/adm-deposito/PHASE_8_BARCODE_SCANNER_EXPRESS_OUTBOUND.md`;
9. `docs/adm-deposito/DECISIONS.md`;
10. `lib/warehouse/location.ts`;
11. `lib/warehouse/labels.ts`;
12. `features/warehouse/pdf/warehouseLabelsPdf.ts`.

Confirme branch e HEAD antes de editar.

---

## 2. Missão exclusiva

Evoluir a infraestrutura atual de etiquetas para que depósito/local/subposição possuam **identificação física escaneável estável**, e criar o resolver que converte uma leitura válida em posição operacional.

A MOBILE-B não implementa câmera nem operação de estoque.

---

## 3. Princípio de identidade

A hierarquia existente continua:

```text
Depósito
└── Local
    └── Subposição opcional
```

Reutilizar IDs técnicos existentes.

O código escaneável:
- deve identificar posição de forma inequívoca;
- não deve depender do nome editável;
- não deve criar uma segunda coleção de localizações;
- deve ser distinguível de barcode comercial de produto;
- não é autorização.

Renomeação de local/subposição não pode invalidar a identidade.

---

## 4. Etiquetas

Evoluir:
- `WarehouseLabelsR1`;
- `lib/warehouse/labels.ts`;
- `warehouseLabelsPdf.ts`;

somente conforme necessário.

A etiqueta deve manter:
- EMPROVEX;
- tipo;
- depósito;
- local/subposição;
- código lógico humano;
- barcode físico;
- legibilidade em tamanhos existentes.

Preservar presets atuais sempre que viável.

Escolha de simbologia deve considerar:
- impressão PDF;
- leitura por câmera móvel;
- capacidade de representar namespace técnico;
- baixa colisão;
- distinção de EAN/UPC de produtos.

Documente a decisão.

---

## 5. Resolver de posição

Criar contrato/helper capaz de:

```text
código lido
→ normalização
→ identificar tipo LOCATION
→ recuperar/validar entidade
→ validar hierarquia
→ validar active
→ produzir WarehouseStockPosition
```

O resolver não deve confiar apenas em texto humano da etiqueta.

Revalidar:
- workspace;
- UG;
- depósito;
- local;
- subposição;
- status.

Não converter etiqueta em permissão.

---

## 6. Segurança e namespace

Garantir que:
- código de outro workspace não resolva para posição operacional do usuário;
- UG incompatível seja recusada;
- entidade inativa seja recusada;
- subposição exija pai coerente;
- payload malformado seja recusado;
- código de produto não seja aceito como posição.

Se uma nova persistência for realmente necessária, pare e devolva ao Coordenador antes de criá-la. A preferência arquitetural é derivar identidade das entidades já existentes.

---

## 7. Fronteira de arquivos

Antes de editar, declare arquivos.

Preferência MOBILE-B:
- `lib/warehouse/labels.ts`;
- `features/warehouse/pdf/warehouseLabelsPdf.ts`;
- novos helpers de location barcode/resolver;
- testes relacionados.

Somente leitura, salvo autorização:
- shell mobile;
- scanner/câmera;
- ledger;
- intake;
- outbound;
- inventory;
- regras de saldo.

Não invada MOBILE-A.

---

## 8. Testes

Cobrir pelo menos:
- depósito;
- local;
- subposição;
- estabilidade após renomeação;
- código inválido;
- código de produto;
- entidade inativa;
- hierarquia inválida;
- workspace/UG incompatível;
- colisão;
- geração de PDF/etiqueta;
- round-trip encode → resolve.

Executar:
- testes específicos;
- TypeScript;
- build quando afetado;
- diff hygiene;
- Core Protection;
- segurança quando houver acesso novo.

---

## 9. Fora do escopo

Não implementar:
- câmera;
- scanner UI;
- alocação;
- transferência;
- consulta móvel completa;
- inventário;
- saída;
- conferência;
- offline;
- app nativo.

---

## 10. Encerramento

Não faça:
- merge em integradora;
- merge em main;
- deploy;
- publicação de Rules.

Entregue:

```text
MOBILE-B — HANDOFF

Branch:
HEAD:
Base:

Status:
APTO PARA REVISÃO / PARCIAL / BLOQUEADO

Objetivo executado:

Arquivos alterados:

Arquivos apenas consultados:

Contratos reutilizados:

Contratos novos:

Mudanças funcionais intencionais:

Testes:
comando -> resultado

Gates não executados:
motivo

Métricas:

Riscos:

Dependências:

Conflitos esperados:

Documentação atualizada:

Não realizado:
- merge main
- deploy produção
- escopo de outra frente
```

Pare e devolva ao Coordenador se a solução exigir nova fonte de verdade, alteração de ledger/saldo, relaxamento de Rules, novo banco ou mudança do contrato congelado de localização.
