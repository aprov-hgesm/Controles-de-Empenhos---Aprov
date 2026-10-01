# PERF-D — Fila leve de Recebimento / Intake

Data: 2026-10-01
Branch trabalhadora: `perf-r3-d-intake-queue`
Base congelada da frente: `076a233cf250c95882e78498e89dd2a44d034f74`
Branch integradora: `feat/performance-r3-commercializacao`

> Este documento registra exclusivamente a frente PERF-D. Ele não altera o quadro de integração, que permanece sob responsabilidade do Chat Coordenador / Integrador / Avaliador.

## 1. Problema confirmado

O caminho normal de abertura da fila de recebimento tinha custo crescente com o histórico:

- `listOperationalBounded()` fazia `getDocs()` da coleção operacional inteira;
- `listPersistedIntakes()` fazia `getDocs()` de todos os intakes;
- `loadWarehouseInvoiceIntakeQueue()` carregava NFs, intakes, até 250 movimentos recentes, empenhos e exclusões antes de montar a fila;
- os limites conceituais existentes não eram limites reais de leitura nos dois primeiros casos.

O problema estrutural adicional é o contrato D-063: **ausência de documento de intake é o estado canônico inicial PENDING**. Firestore não possui anti-join para consultar “NFs cujos itens não possuem documento correspondente em outra coleção”. Portanto, um simples `where(status != PROCESSED)` em `intakes` perderia precisamente as NFs nunca tratadas.

## 2. Arquitetura adotada

### 2.1 Caminho operacional normal

A abertura padrão “A tratar” agora usa um índice derivado mínimo:

`warehouse/{workspaceId}/intakeQueueIndex/{stateId}`

Ele contém somente a identidade necessária para descobrir itens ainda candidatos ao tratamento. Não é fonte quantitativa, não substitui intake, NF, ledger ou saldo e não cria movimento.

Fluxo:

1. lê o cutoff existente;
2. sincroniza apenas NFs novas após um watermark com sobreposição de 5 minutos;
3. lê candidatos ativos paginados;
4. busca as NFs canônicas somente pelos `invoiceRecordKey` candidatos;
5. busca intakes somente pelos IDs determinísticos candidatos;
6. busca empenhos somente dos candidatos;
7. consulta movimentos legados somente para NFs candidatas sem intake persistido, com limite de 51 documentos por NF;
8. desativa no índice candidatos concluídos, excluídos ou obsoletos.

O custo steady-state passa a ser proporcional ao conjunto operacional atual.

### 2.2 Bootstrap único

Como NFs históricas sem intake não podem ser descobertas por anti-join, o primeiro acesso após a adoção do índice executa um **bootstrap único e paginado** das NFs elegíveis.

- página de descoberta: 200 NFs;
- intakes são consultados somente pelos IDs dos itens das NFs daquela página;
- exclusões são consultadas somente pelos IDs das NFs da página;
- somente itens ainda tratáveis são materializados como candidatos ativos;
- ao concluir, grava-se o documento `intakeQueueIndex/state`.

Esse é o único caminho operacional que pode crescer com o histórico preexistente. Ele existe para preservar integralmente o contrato “sem intake = PENDING” sem criar intake artificial. Depois do bootstrap, a fila deixa de repetir esse custo.

A integração pode executar/observar esse bootstrap antes da abertura comercial para evitar que o primeiro operador arque com o custo inicial.

### 2.3 Caminho histórico e reconciliação

Os filtros existentes continuam disponíveis sem alteração visual:

- **A tratar** → caminho operacional leve;
- **Todas as situações** → caminho histórico sob demanda;
- **Tratadas** → caminho histórico sob demanda;
- **Reconciliação** → caminho histórico sob demanda.

O histórico é paginado e protegido por teto de segurança:

- NFs: 300 por página, até 40 páginas;
- intakes: 500 por página, até 40 páginas;
- se o teto for atingido, `truncated=true` mantém o aviso de cobertura limitada;
- movimentos legados deixaram de ser um scan global dos 250 mais recentes e passaram a ser consultados por `source.invoiceRecordKey`, limitados a 51 por NF relevante.

Assim, o histórico não foi apagado nem escondido; apenas saiu do caminho normal.

## 3. Consultas antigas

Abertura normal:

- todas as invoices do workspace;
- todos os intakes do workspace;
- 250 movimentos recentes independentemente de relação com pendências;
- empenhos referenciados por todas as invoices carregadas;
- exclusões/reconciliação sobre o conjunto histórico.

Complexidade prática aproximada:

`O(invoices_históricas + intakes_históricos + 250 movimentos + empenhos_históricos)`

## 4. Consultas novas

Abertura normal em steady-state:

- 1 estado do índice;
- pequena janela incremental de NFs desde o watermark;
- candidatos ativos;
- NFs canônicas pelos IDs candidatos;
- intakes pelos IDs candidatos;
- empenhos relacionados aos candidatos;
- exclusões relacionadas aos candidatos;
- movimentos relacionados somente às NFs candidatas sem intake.

Complexidade prática:

`O(pendências_atuais + NFs_novas_desde_watermark + movimentos_das_NFs_pendentes)`

O volume histórico acumulado deixa de participar do custo normal após o bootstrap.

## 5. Métricas sintéticas antes/depois

Os números abaixo representam **documentos retornados/efetivamente consultados pela aplicação**, antes de mínimos de cobrança por query vazia que o Firestore possa aplicar.

| Cenário | Invoices históricas | Intakes históricos | Movements históricos | Empenhos históricos | Itens pendentes atuais | NFs pendentes | Antes — docs principais | Depois steady-state — docs principais |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| A — workspace médio | 1.000 | 700 | 5.000 | 200 | 20 | 14 | ~2.151 | ~59 |
| B — 10× histórico, mesma operação | 10.000 | 8.000 | 50.000 | 500 | 20 | 14 | ~18.751 | ~59 |
| C — operação maior | 10.000 | 8.000 | 50.000 | 500 | 200 | 120 | ~18.751 | ~500 |

Hipóteses do “depois” nos cenários A/B:

- cutoff: 1;
- estado do índice: 1;
- sobreposição/delta de NFs: 2;
- candidatos ativos: 20;
- NFs canônicas: 14;
- intakes persistidos entre os pendentes: 8;
- movimentos legados correspondentes: 1;
- empenhos relacionados: 12;
- exclusões encontradas: 0.

Total: ~59 documentos retornados.

No cenário C, foram considerados aproximadamente:

- 200 candidatos;
- 120 NFs;
- 90 intakes persistidos;
- 6 movimentos relacionados;
- 80 empenhos;
- pequena janela incremental + cutoff/estado.

A propriedade importante é que aumentar o histórico de 1.000 para 10.000 NFs, mantendo 20 pendências atuais, não altera materialmente o custo steady-state.

## 6. Paginação e truncamento

### Operacional

- candidatos ativos: 250 por página;
- teto: 20 páginas = 5.000 candidatos ativos;
- ao atingir o teto: `truncated=true`;
- consultas por ID usam lotes de até 30 IDs;
- movimentos legados: máximo de 51 por NF candidata;
- NF com 51 ou mais movimentos relacionados entra em cobertura limitada/reconciliação, preservando a mesma barreira de segurança usada pela própria alocação.

### Histórico

- invoices: 300 × 40 páginas = até 12.000 documentos;
- intakes: 500 × 40 páginas = até 20.000 documentos;
- atingir o teto marca truncamento e bloqueia operações que dependam de cobertura completa.

## 7. Materialização mínima — justificativa formal

A coleção derivada é necessária porque:

1. `intake` ausente significa PENDING por contrato;
2. consultar somente `intakes` não encontra itens nunca tratados;
3. Firestore não oferece anti-join entre `invoices` e `intakes`;
4. fazer scan de todas as invoices a cada abertura viola o objetivo da PERF-D;
5. criar intakes PENDING somente para indexação violaria D-063.

Logo, o índice derivado é a menor estrutura que permite preservar simultaneamente:

- semântica atual;
- descoberta de pendências antigas;
- ausência de intake artificial;
- custo operacional desacoplado do histórico.

## 8. Índices Firestore

**Nenhum índice composto novo.**

As consultas novas usam apenas capacidades já cobertas por índices de campo simples/document ID:

- `active == true`;
- `registeredAt >= watermark` + `orderBy(registeredAt)` no mesmo campo;
- `source.invoiceRecordKey == ...` — consulta já existente no caminho de alocação;
- `documentId() in [...]`.

Não foi criado índice preventivo.

## 9. Contratos preservados

Não foram alterados:

- significado de NF cadastrada;
- contrato `warehouse_item_intake_v1/v2`;
- ausência de intake como PENDING;
- idempotência do intake;
- ledger;
- saldo agregado;
- saldos por posição;
- consumo imediato;
- FEFO/lote/barcode;
- Saída de Material;
- regra de reconciliação antes de movimento incompatível;
- estética/markup visual da fila.

## 10. Segurança

Foi criado apenas o namespace derivado `intakeQueueIndex`.

Rules:

- exigem o mesmo workspace/UG da sessão autorizada;
- exigem `updatedBy == request.auth.uid`;
- aceitam somente os dois schema versions do índice;
- proíbem delete físico;
- não concedem qualquer autoridade sobre intake, ledger ou saldo.

O teste multi-tenant existente foi ampliado para cobrir:

- ALLOW no próprio workspace/UG;
- DENY de leitura cruzada;
- DENY de gravação com UG divergente.

## 11. Riscos e observações para integração

1. **Bootstrap inicial:** pode ler todo o histórico elegível uma única vez. É custo de migração, não custo steady-state.
2. **Concorrência no primeiro bootstrap:** duas sessões podem repetir parte do trabalho, mas as escritas são determinísticas/idempotentes e não alteram fonte canônica.
3. **Teto operacional:** mais de 5.000 candidatos ativos marca cobertura limitada; não há truncamento silencioso.
4. **Sobreposição de arquivos:** a branch integradora avançou durante a execução e a PERF-E alterou `WarehouseItemRegistrationOperational.tsx`. A integração precisa resolver esse arquivo semanticamente, preservando tanto o carregamento sob demanda da PERF-D quanto as otimizações de render da PERF-E.
5. **PERF-F:** pode usar a fronteira estabilizada da PERF-D depois da integração, mas não deve transformar o índice derivado em autoridade nem cachear saldo/ledger de forma divergente.

## 12. Fora do escopo

Não realizado:

- merge em `feat/performance-r3-commercializacao`;
- merge em `main`;
- deploy;
- alteração de saldo/ledger;
- alteração de Saída de Material;
- cache da PERF-F;
- redesign visual;
- criação de índice Firestore composto.
