# PROMPT — MOBILE-A — Plataforma Móvel e Scanner

Você é o chat trabalhador responsável **exclusivamente** pela frente:

**MOBILE-A — Plataforma Móvel e Scanner da Central Móvel R1 do EMPROVEX**

## Repositório

`aprov-hgesm/Controles-de-Empenhos---Aprov`

## Branch integradora

`feat/central-mobile-r1`

## Base comum congelada da Onda 1

`53e28b81874ee1b7ce0bd484cc7a97537aa99473`

## Sua branch exclusiva

`mobile-r1-a-platform-scanner`

A branch já existe exatamente na base acima.

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
7. `docs/adm-deposito/README.md`;
8. `docs/adm-deposito/STATUS.md`;
9. `docs/adm-deposito/DECISIONS.md`;
10. documentação existente de barcode/scanner pertinente.

Confirme branch e HEAD antes de qualquer alteração.

---

## 2. Missão exclusiva

Criar a **fundação móvel compartilhada** da Central de Depósitos:

- rota/superfície móvel própria;
- shell móvel leve;
- infraestrutura compartilhada de câmera;
- scanner de barcode;
- contrato de estados de leitura;
- feedback operacional;
- fallback manual;
- lazy loading do decoder;
- proteção do bundle desktop.

A MOBILE-A **não implementa** alocação, transferência, consulta física de domínio, inventário, saída ou conferência.

---

## 3. Contratos congelados

Preservar integralmente:

- Firebase Auth;
- workspace/UG;
- sessão/lease;
- legal gate do baseline;
- autorização da Central;
- `warehouse_material_v1`;
- `warehouse_barcode_v1`;
- ledger;
- saldos;
- localizações;
- lotes;
- intake;
- outbound;
- inventário.

O scanner é infraestrutura de captura. Ele **não cria movimento e não escreve saldo**.

---

## 4. Scanner compartilhado

Conceito esperado:

`WarehouseMobileScanner`

Tipos:
- `PRODUCT`;
- `LOCATION`;
- `UNKNOWN`.

Estados:
- `EXPECT_PRODUCT`;
- `EXPECT_LOCATION`;
- `EXPECT_SOURCE_LOCATION`;
- `EXPECT_DESTINATION_LOCATION`.

Pipeline:

```text
camera
→ decoder
→ normalização
→ identificação
→ evento validado
```

A resolução completa de barcode de posição pertence à MOBILE-B.

---

## 5. Requisitos

A solução deve:

- funcionar no navegador móvel;
- preferir câmera traseira quando suportado;
- solicitar permissão apenas quando necessário;
- tratar permissão negada;
- tratar câmera indisponível;
- desmontar stream ao sair;
- impedir double scan;
- possuir cooldown/debounce coerente;
- oferecer entrada manual;
- fornecer feedback visual;
- permitir feedback sonoro/tátil quando suportado, sem depender deles;
- não armazenar imagem/vídeo;
- carregar decoder sob demanda;
- não inserir dependência pesada no First Load desktop;
- possuir estados explícitos de loading/erro/pronto;
- preservar acessibilidade mínima e botões adequados ao toque.

Não dependa exclusivamente de uma API experimental se isso comprometer compatibilidade real.

---

## 6. Fronteira de arquivos

Antes de editar, declare ao Coordenador os arquivos pretendidos.

Preferência de propriedade MOBILE-A:

- nova rota móvel;
- novos componentes `WarehouseMobile*` de plataforma/scanner;
- hooks/helpers de câmera;
- contratos de scanner;
- navegação móvel nova.

Considere somente leitura, salvo necessidade estritamente demonstrada:

- `lib/warehouse/intake*`;
- `lib/warehouse/outbound*`;
- `lib/warehouse/inventory*`;
- ledger/saldos;
- `lib/warehouse/labels.ts`;
- PDF de etiquetas;
- Rules de estoque.

Se precisar alterar arquivo estrutural compartilhado, registre a necessidade antes de ampliar escopo.

---

## 7. Performance

A câmera/decoder não pode degradar a abertura normal da Central desktop.

Comprovar:
- boundary lazy;
- ausência do decoder no caminho inicial desktop quando possível;
- tamanho do código introduzido;
- comportamento de montagem/desmontagem.

---

## 8. Testes

Executar proporcionalmente ao impacto:

- testes de domínio/estado do scanner;
- TypeScript;
- build;
- diff hygiene;
- Core Protection;
- smoke de navegador/responsividade quando aplicável.

Browser E2E completo é sob demanda, mas interação de câmera/estado deve ter evidência suficiente.

Não alegar validação de câmera física se ela não foi realmente executada em aparelho.

---

## 9. Fora do escopo

Não implementar:

- barcode das posições;
- PDF de etiqueta com barcode;
- resolver código → WarehouseStockPosition;
- ALLOCATE;
- TRANSFER;
- OUTBOUND;
- inventário;
- conferência;
- offline sync;
- app nativo.

---

## 10. Encerramento

Não faça:
- merge em `feat/central-mobile-r1`;
- merge em `main`;
- deploy;
- publicação de Rules.

Entregue:

```text
MOBILE-A — HANDOFF

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

Pare e devolva ao Coordenador se descobrir necessidade de alterar contrato canônico, segurança, ledger, fonte de saldo, modelo de posição ou escopo de MOBILE-B/C–H.
