# EMPROVEX — Central Móvel R1 — Plano Mestre

Data de ativação do programa: **2026-10-02**
Código da rodada: **MOBILE-R1**
Branch integradora: `feat/central-mobile-r1`
Baseline técnico congelado: `saas-r1-i-integration@78d3e9afeeb4176a8d6423cdd8e65d32435ba0a9`
Produção no momento do freeze: `main@e90f92acae1514ee5cbc6ce95fed354bc1454330`

> Este documento define **o que** a Central Móvel R1 deve entregar.  
> O protocolo de desenvolvimento paralelo está em `docs/CENTRAL_MOBILE_R1_EXECUCAO_PARALELA.md`.  
> O estado corrente das frentes está em `docs/CENTRAL_MOBILE_R1_INTEGRATION_STATUS.md`.  
> A troca de Coordenador deve usar `docs/CENTRAL_MOBILE_R1_COORDENADOR_HANDOFF.md`.

---

## 1. Estado da rodada

A Central Móvel R1 está **ATIVADA PARA DESENVOLVIMENTO COORDENADO**.

O MOBILE-0 congela arquitetura, contratos e fronteiras. Após o freeze documental:
- MOBILE-A e MOBILE-B podem iniciar em paralelo;
- MOBILE-C, MOBILE-D e MOBILE-E permanecem bloqueadas até a Integração 1;
- MOBILE-F, MOBILE-G e MOBILE-H permanecem bloqueadas até a Integração 2;
- MOBILE-I e MOBILE-J são etapas do Coordenador.

A ativação desta branch **não autoriza**:
- merge em `main`;
- deploy de produção;
- publicação de Rules;
- migração de dados;
- execução de ações produtivas do SaaS R1.

---

## 2. Dependência upstream registrada

O baseline escolhido é o candidato técnico SAAS-I `78d3e9afe...`, porque ele já contém mudanças transversais em autenticação/aceite legal/Central de Depósitos que colidiriam com uma fundação móvel criada sobre a integradora SaaS anterior.

Evidências do baseline:
- PR técnico SaaS-I #219;
- Application CI #908: SUCCESS;
- EMPROVEX Core Protection #195: SUCCESS;
- Recovery guardrails #595: SUCCESS;
- SAAS-DL Legal Validation #20: SUCCESS;
- preview Vercel do candidato: READY.

A MOBILE-R1 **não assume propriedade da SAAS-I** e não integra o PR #219.

Gate upstream obrigatório:
> antes de MOBILE-I, o Coordenador deve comparar a branch MOBILE-R1 com o estado SaaS consolidado e reconciliar apenas deltas upstream necessários, preservando contratos dos dois programas.

Se a SAAS-I ou etapas posteriores do SaaS alterarem shell, autenticação, acesso da Central, sessão, legal gate ou lifecycle, a mudança deve entrar na MOBILE-R1 por integração coordenada; workers móveis não devem “acompanhar” o SaaS editando esses domínios por conta própria.

---

## 3. Visão de produto

A Central Móvel R1 transforma o navegador do celular em uma ferramenta operacional para execução física dentro do depósito.

Princípio:
> o operador registra a movimentação digital **no mesmo ponto e momento em que realiza a movimentação física**, sem precisar retornar ao computador para informar onde colocou, retirou, contou ou encontrou o material.

A solução:
- usa o mesmo usuário EMPROVEX;
- usa a mesma autenticação;
- usa o mesmo workspace/UG;
- usa os mesmos materiais;
- usa os mesmos lotes/validade;
- usa as mesmas posições;
- usa o mesmo estoque;
- usa o mesmo ledger;
- reflete imediatamente na Central desktop.

A Central Móvel não é:
- outro sistema;
- outro banco;
- outro catálogo;
- outro saldo;
- outro usuário;
- outro módulo comercial.

---

## 4. Experiência desktop x móvel

### Desktop

Permanece responsável pelas superfícies completas:
- administração;
- estrutura de depósitos;
- configuração;
- relatórios;
- croqui;
- controle de materiais;
- supervisão;
- operações existentes.

### Celular

Recebe uma superfície operacional própria, focada em:
- câmera;
- scanner;
- leitura de produto;
- leitura de posição;
- quantidades;
- confirmação;
- feedback claro;
- mínimo de navegação administrativa.

Menu móvel esperado:
1. Alocar recebimento;
2. Transferir material;
3. Consultar localização;
4. Inventário;
5. Saída de material;
6. Conferir posição.

A rota e o nome técnico finais são responsabilidade de MOBILE-A, dentro dos contratos deste plano.

Detecção de dispositivo nunca é mecanismo de autorização.

---

## 5. Contratos canônicos congelados

Nenhuma frente pode criar fonte concorrente.

| Domínio | Autoridade |
| --- | --- |
| autenticação | Firebase Auth vigente |
| usuário/workspace/UG | contratos multi-tenant vigentes |
| sessão/lease | política vigente |
| material | `warehouse_material_v1` |
| barcode de produto | `warehouse_barcode_v1` |
| movimento | `warehouse_movement_v1` |
| saldo agregado | `warehouse_balance_v1` |
| distribuição física | `warehouse_location_balance_v1` |
| depósito/local/subposição | `warehouse_depot_v1` / `warehouse_location_v1` |
| posição operacional | `WarehouseStockPosition` |
| lote/validade | `warehouse_lot_v1` |
| NF/intake | contratos atuais de intake |
| transferência | `TRANSFER` |
| saída | `OUTBOUND` |
| inventário | `warehouse_inventory_v1` + `warehouse_inventory_item_v1` |
| ajuste de inventário | `INVENTORY_ADJUSTMENT` |
| segurança | workspace/UG + fail-closed |
| aceite legal | contrato SaaS-I vigente no baseline |
| autorização Central | contrato vigente da Central |

---

## 6. Regra de uma única fonte de verdade

A Central Móvel pode:
- capturar;
- resolver;
- orientar;
- apresentar;
- solicitar confirmação;
- invocar a operação oficial.

Ela não pode:
- escrever saldo diretamente;
- criar saldo paralelo;
- criar segunda coleção de localização para a mesma finalidade;
- criar material pela leitura sem fluxo explícito permitido;
- reinterpretar movimento;
- editar ledger histórico;
- inventar novo inventário;
- transformar consulta em mutação silenciosa.

---

## 7. Estratégia online-first

A R1 é **online-first**.

Não implementar:
- fila persistente de movimentações offline;
- sincronização posterior automática de saída/transferência;
- commit tardio sem revalidação;
- ajuste de inventário offline.

Com conexão perdida:
1. operação não é considerada confirmada;
2. rascunho pode ser preservado somente quando seguro;
3. reconectar;
4. revalidar estado autoritativo;
5. confirmar;
6. usar idempotência.

Offline completo exige rodada futura própria.

---

## 8. Scanner compartilhado

Deve existir uma infraestrutura única, carregada sob demanda.

Conceito:
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
  ↓
decoder
  ↓
normalização
  ↓
identificação
  ↓
resolver
  ↓
evento validado
```

Requisitos:
- câmera traseira preferencial;
- HTTPS/permissão;
- prevenção de double scan;
- cooldown após leitura aceita;
- fallback manual;
- desmontagem correta;
- feedback visual;
- feedback sonoro quando suportado;
- vibração quando suportada;
- não armazenar vídeo;
- não depender exclusivamente de API experimental sem fallback;
- scanner não altera dados de negócio.

---

## 9. Identidade física das posições

As etiquetas atuais de depósito/local/subposição devem ser evoluídas, não substituídas por cadastro paralelo.

Cada etiqueta:
- continua legível por humanos;
- inclui código lógico visível;
- inclui identificador escaneável;
- mantém identidade estável mesmo após renomeação.

A leitura deve resolver de forma segura:
- depósito;
- local;
- subposição opcional;
- posição operacional.

O payload/código não é autorização.

Após resolver a posição, o backend ainda valida:
- usuário;
- workspace;
- UG;
- status ativo;
- hierarquia;
- permissão da operação.

Código de produto e código de posição devem ser distinguíveis.

---

## 10. MOBILE-A — Plataforma Móvel e Scanner

Branch:
`mobile-r1-a-platform-scanner`

Objetivo:
criar a fundação de UI móvel e a infraestrutura compartilhada de câmera/scanner.

Entregas:
- rota/shell móvel;
- navegação móvel;
- scanner compartilhado;
- contrato de estados;
- feedback;
- fallback manual;
- handling de permissão;
- lazy loading;
- isolamento do bundle desktop;
- testes do decoder/estado;
- smoke responsivo.

Não implementar:
- alocação;
- transferência;
- consulta física de domínio;
- inventário;
- saída;
- conferência;
- mudança de Rules de estoque sem atribuição do Coordenador.

---

## 11. MOBILE-B — Etiquetas e Resolver

Branch:
`mobile-r1-b-location-labels`

Objetivo:
dar identidade escaneável às posições físicas e resolver leitura para `WarehouseStockPosition`.

Entregas:
- contrato do código de posição;
- geração de barcode nas etiquetas;
- evolução do PDF;
- resolver posição;
- validação de hierarquia/status;
- testes de colisão/renomeação;
- mensagens de erro.

Não implementar câmera ou fluxo de estoque.

---

## 12. Integração 1

Gate:
**scanner → identificação → resolver → WarehouseStockPosition**

Sem movimentar estoque.

Critérios:
- código de produto não é aceito como posição;
- código de posição não é aceito como produto;
- posição inativa é recusada;
- outra UG/workspace é recusada;
- renomeação não quebra identidade;
- desktop não carrega scanner;
- celular funciona com fallback manual.

Após Integração 1:
- liberar C/D/E;
- congelar contratos compartilhados de scanner/resolver.

---

## 13. MOBILE-C — Alocação Móvel

Branch:
`mobile-r1-c-intake-allocation`

Fluxo:
```text
NF pendente
→ item pendente
→ quantidade
→ ler produto
→ resolver/associar barcode
→ validade/lote
→ ler posição
→ revisar
→ confirmar
→ ALLOCATE
```

Requisitos:
- alocação parcial;
- divisão do mesmo item em posições diferentes;
- código desconhecido pode ser associado ao material selecionado pelos contratos oficiais;
- conflito com material diferente é bloqueante;
- validade pertence ao lote;
- posição revalidada;
- pendência revalidada;
- idempotência;
- reflexo desktop.

Exemplo:
10 café → 5 Prateleira 1 + 5 Prateleira 4.

---

## 14. MOBILE-D — Transferência Móvel

Branch:
`mobile-r1-d-transfer`

Fluxo:
```text
ler origem
→ ler produto
→ quantidade
→ ler destino
→ revisar
→ confirmar
→ TRANSFER
```

Invariantes:
- saldo agregado não muda;
- origem possui quantidade;
- destino é válido;
- posição ativa;
- idempotência;
- concorrência revalidada;
- não simular transferência com OUTBOUND + entrada.

---

## 15. MOBILE-E — Consulta Física

Branch:
`mobile-r1-e-physical-query`

Fluxo:
```text
ler posição
→ resolver
→ carregar distribuição
→ materiais
→ lotes/validade
→ apresentar
```

Read-only por padrão.

Pode exibir:
- material;
- quantidade;
- lote;
- validade;
- origem;
- outras posições;
- histórico curto/bounded.

É a primeira candidata de integração da segunda onda por menor risco mutável.

---

## 16. Integração 2

Jornada mínima:
1. alocar material em posição A;
2. consultar A;
3. transferir parte A → B;
4. consultar A e B;
5. total agregado deve permanecer;
6. distribuição física deve mudar;
7. desktop deve refletir o mesmo estado.

Após aprovação:
- liberar F/G/H.

---

## 17. MOBILE-F — Inventário Móvel

Branch:
`mobile-r1-f-inventory`

Fluxo:
```text
selecionar/abrir inventário
→ ler posição
→ esperado
→ ler/selecionar material
→ informar contado
→ salvar contagem
→ revisar
→ confirmar
→ INVENTORY_ADJUSTMENT quando aplicável
```

Regras:
- salvar contagem não altera saldo;
- diferença = contado - esperado;
- ajuste só após confirmação;
- preservar STALE/RECONCILIATION_REQUIRED;
- nenhuma segunda autoridade quantitativa;
- permitir evolução de contagem orientada por leitura sem criar inventário paralelo.

---

## 18. MOBILE-G — Saída Móvel

Branch:
`mobile-r1-g-outbound`

Fluxo:
```text
destino/retirado por
→ ler produto
→ quantidade
→ mostrar posições
→ FEFO recomendado
→ chegar ao local
→ ler posição
→ lote quando aplicável
→ revisar
→ confirmar
→ OUTBOUND
```

Regras:
- saldo suficiente;
- posição suficiente;
- lote coerente;
- FEFO segue contrato vigente;
- não há baixa silenciosa;
- idempotência;
- proteção contra saldo negativo.

---

## 19. MOBILE-H — Conferência Física/Digital

Branch:
`mobile-r1-h-position-check`

Pergunta principal:
> este material está registrado nesta posição?

Fluxo:
```text
ler posição
→ ler produto
→ comparar projeção oficial
→ correto / incorreto
```

Se incorreto:
- informar posição registrada;
- oferecer navegação para MOBILE-D;
- não transferir por mecanismo próprio.

Regra:
> Conferência detecta; Transferência corrige.

---

## 20. Integração 3

Validar:
- F/G/H sobre scanner/resolver já congelados;
- inventário sem mutação prematura;
- saída com posição/lote;
- conferência → transferência;
- ausência de duplicação de scanner;
- regressão de C/D/E.

---

## 21. MOBILE-I — Integração Controlada

Conduzida pelo Coordenador.

Não é feature.

Objetivos:
- integrar trabalho aprovado;
- resolver conflitos;
- glue mínimo;
- remover duplicação;
- reconciliar upstream SaaS;
- validar jornadas cruzadas;
- medir conjunto final.

Jornada integrada:
1. login móvel;
2. NF pendente;
3. alocar 5 em posição A;
4. alocar restantes em B;
5. consultar A;
6. transferir parte A → C;
7. consultar A/B/C;
8. conferência;
9. contagem de inventário;
10. saída;
11. consulta final;
12. abrir desktop;
13. confirmar coerência.

---

## 22. MOBILE-J — Certificação Final

Obrigatório:
- TypeScript;
- build;
- diff hygiene;
- Core Protection;
- testes de domínio;
- guards;
- Firestore/isolamento aplicável;
- idempotência;
- concorrência;
- barcode/location;
- regressão de estoque.

Compatibilidade:
- Android + Chrome;
- iPhone + Safari quando disponível;
- câmera permitida;
- câmera negada;
- câmera indisponível;
- fallback manual;
- conexão degradada;
- desktop sem scanner carregado.

Browser E2E: sob demanda conforme risco.

Validação manual com celular real: obrigatória.

---

## 23. Métricas da rodada

Registrar antes/depois:
- First Load JS desktop;
- First Load JS da rota móvel;
- peso do decoder;
- lazy loading;
- tempo de ativação da câmera;
- leitura → identificação;
- confirmação → persistência;
- reads/writes por jornada;
- listeners abertos;
- quantidade de documentos carregados;
- erros/retries.

Nenhum ganho de performance pode justificar pior UX operacional.

---

## 24. Segurança

Preservar:
- fail-closed;
- workspace/UG;
- usuário autorizado;
- lifecycle/status;
- legal gate;
- sessão/lease;
- regras da Central;
- idempotência;
- atomicidade;
- saldo não negativo;
- posição válida.

Nunca confiar na etiqueta para autorização.

---

## 25. Validação manual física

Obrigatória para:
- ergonomia com uma mão;
- botões;
- legibilidade;
- enquadramento;
- velocidade;
- double scan;
- múltiplos códigos no quadro;
- luz fraca/reflexo;
- feedback;
- deslocamento;
- troca produto/local;
- perda e retorno de internet.

---

## 26. Escopo fora da R1

- aplicativo nativo;
- lojas de apps;
- operação integral offline;
- sincronização tardia automática;
- RFID;
- NFC;
- IA visual;
- OCR de validade;
- GS1 avançado obrigatório;
- Bluetooth tracking;
- mapa indoor;
- localização física do operador;
- confirmação automática sem ação humana;
- armazenamento de foto/vídeo.

---

## 27. Critério de sucesso funcional

A R1 está funcionalmente concluída quando:

> o mesmo usuário EMPROVEX consegue, pelo navegador móvel, alocar, transferir, consultar, inventariar, retirar e conferir materiais por leitura de códigos de produto e posição, usando as mesmas autoridades de dados e com estado coerente na Central desktop.

---

## 28. Critério de encerramento da rodada

Necessário:
- A–H aprovadas;
- Integrações 1–3 aprovadas;
- MOBILE-I encerrada;
- upstream reconciliado;
- gates verdes;
- métricas registradas;
- segurança preservada;
- teste de câmera real;
- validação operacional do usuário;
- MOBILE-J aprovada;
- autorização explícita para release.

