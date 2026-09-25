# ADM Depósito — Estado Atual

Este arquivo registra o estado real de continuidade do projeto e deve ser tratado como memória operacional oficial do módulo.

## Estado geral

Status: **FASE 11 IMPLEMENTADA E VALIDADA LOCALMENTE — CI/MERGE DIFERIDOS ATÉ O FECHAMENTO DO ADM DEPÓSITO**

Data de fechamento: 2026-09-24.

Situação:
- FASES 0, 1, 2, 3, 4, 5, 6, 7, 8, 9 e 10 concluídas;
- FASE 10 — Inventário Físico integrada à `main` pelo PR #180;
- FASE 3 — Walking Skeleton integrada à `main` pelo PR #164;
- FASE 4 — NF → Estoque implementada originalmente no PR #167 e posteriormente desacoplada do lifecycle operacional pelo hotfix #184;
- FASE 5 — SISCOFIS / Marco Zero / Conciliação implementada no PR #171;
- FASE 6 — Depósitos / Localizações / Transferências implementada e validada no PR #173;
- FASE 7 — Estoque Operável / Lotes / Validade / FEFO implementada e validada no PR #174;
- FASE 8 — Código de Barras / Scanner / Saída Expressa implementada e validada no PR #176;
- FASE 9 — Visão do Depósito / Editor / Persistência implementada no PR #179;
- piloto permanece exclusivo da conta fundadora;
- usuários externos continuam sem visibilidade e sem acesso ao módulo ADM Depósito;
- houve uma tentativa de FASE 11 no PR #182, fechada sem merge após a revisão arquitetural que priorizou a independência operacional do EMPROVEX;
- EMPROVEX Core Protection foi integrado à `main` pelo PR #185, squash merge `55e53c6724f8bf34f0bfe94bc771150c5f009398`;
- FASE 11 foi reconstruída sobre essa fronteira na branch `feat/adm-deposito-phase-11-protected`;
- gates locais da FASE 11 aprovados em 2026-09-24: Core Protection `OK`, domínio logístico 5/5, guard protegido `PASS` e walking skeleton 6/6.

## FASE 11 — implementação atual

Capacidades implementadas:
- Entregas derivadas de Empenhos + Cronogramas + NFs em modo somente leitura;
- correlação NF/Empenho → material por movimentos `source.kind = INVOICE` do ledger do ADM;
- Dashboard Logístico real na Visão Geral;
- alertas logísticos próprios em `warehouse/{workspaceId}/alerts`;
- limiar opcional de baixo estoque em `warehouse/{workspaceId}/settings/logistics-alerts`;
- aba/rota Alertas no ADM Depósito;
- Rules novas restritas ao bloco `warehouse/{workspaceId}`;
- D-025 atualizada para proibir escrita do ADM na Central de Avisos operacional;
- sem associação artificial de NF a remessa do Cronograma;
- sem mutação de Empenhos, Cronogramas, NFs ou Alertas operacionais pelo ADM.

Validação local concluída:
- `verify:emprovex-core-protection` — OK;
- `test:adm-deposito-logistics` — 5/5;
- `verify:adm-deposito-phase-11` — PASS;
- `test:adm-deposito-walking-skeleton` — 6/6.

A regressão pesada completa e o GitHub CI permanecem diferidos até o fechamento da implementação do ADM Depósito, conforme D-054. O PR #186 foi fechado sem merge para evitar CI prematuro; a branch da FASE 11 permanece como baseline de continuidade para as fases seguintes.

## FASE 11.5 — Consolidação Visual e UX

Estado atual: **EM EXECUÇÃO — shell EMPROVEX, nova Home e reorganização funcional em quatro áreas implementados na branch da fase**.

Estrutura atual:
- **Início** — croqui 2.5D branco, seleção de depósito, consulta de material, localização, saldo, lotes e validade;
- **Cadastro de Itens** — fila de itens de NF lida do EMPROVEX, alocação física, consumo imediato, relatório para lançamento no SISCOFIS e migração SISCOFIS manual/JSON por prompt externo;
- **Meus Depósitos** — depósitos/localizações e croquis por depósito, com estante, rack, armário, freezer, geladeira, palete e demais estruturas personalizáveis;
- **Controle de Itens** — resumo logístico, itens disponíveis, saída expressa, movimentações, inventário, entregas, alertas e configurações.

Integração nova:
- contrato `warehouse_item_intake_v1`;
- persistência exclusiva em `warehouse/{workspaceId}/intakes`;
- NFs/Empenhos continuam somente leitura para o ADM;
- alocação de NF usa ledger/saldos/localizações/lotes/barcode do próprio ADM;
- consumo imediato não entra no estoque e gera fila própria para lançamento no SISCOFIS;
- layouts passam a ter ativo/histórico por depósito, sem conflito global entre depósitos;
- “excluir” depósito/localização significa inativar e preservar auditoria.

Branch:
`feat/adm-deposito-phase-11-5-visual-ux`

Pendência operacional conhecida:
- as Firestore Rules atualizadas desta branch ainda precisam ser publicadas no banco nomeado antes de testar cadastros reais no Preview;
- o erro observado anteriormente ao listar `warehouse/hgesm-aprov/depots` permanece compatível com Rules de produção desatualizadas ou sessão não reconhecida, e deve ser reavaliado após publicação das Rules atuais.

Política de validação:
- por D-057, não executar agora suites/CI por incremento;
- todos os testes, guards, TypeScript/build, Emulator, E2E e regressão integrada ficam consolidados para a FASE 13;
- PowerShell local do fundador está disponível para intervenções necessárias e deve ser usado de forma consolidada.


## Estratégia de validação vigente

D-057 substitui a cadência intermediária anteriormente descrita em D-054:

- não executar baterias de testes ou CI a cada incremento restante das FASES 11.5 e 12;
- preservar guards, testes de domínio, Firestore Emulator, Browser E2E, TypeScript/build e regressão para execução consolidada na FASE 13;
- não abrir PR nem disparar intencionalmente Application CI durante a implementação restante;
- usar PowerShell local apenas quando necessário para publicação/configuração ou diagnóstico pontual;
- Core Protection continua sendo uma invariável arquitetural, mesmo sem execução repetida do guard a cada commit.


## Repositório e baseline

Repositório:
`aprov-hgesm/Controles-de-Empenhos---Aprov`

Branch oficial:
`main`

Baseline funcional da FASE 3:
`0b8aed23da504deeb0bd18de404f0298a7c7cf2c`

Baseline da `main` imediatamente antes do desenvolvimento da FASE 6:
`f0aa080ff48b10ba04c18c9fb6b54ab51ecfbfaa`

Esse baseline:
- já contém as FASES 0–5;
- foi auditado antes da criação da branch da FASE 6;
- permaneceu como merge-base durante toda a execução da FASE 6.

Branch da FASE 6:
`feat/adm-deposito-phase-6-locations`

Baseline da `main` imediatamente antes do desenvolvimento da FASE 7:
`a2eb3f7853bac9a13ccc0e8e7d09b46fee97f970`

Branch da FASE 7:
`feat/adm-deposito-phase-7-stock-lots-fefo`

Baseline da `main` imediatamente antes do desenvolvimento da FASE 8:
`12ea72a1a7e18a6d1b819fc8a8749da081fbb72e`

Branch da FASE 8:
`feat/adm-deposito-phase-8-barcode-scanner-express-outbound`

Baseline da `main` imediatamente antes do desenvolvimento da FASE 9:
`ac523b4e29cfd6aaf723427ddeb104581860c3cd`

Branch da FASE 9:
`feat/adm-deposito-phase-9-depot-view-layout`

Baseline da `main` imediatamente antes do desenvolvimento da FASE 10:
`44bd77451138ace7b113704abd8bd873675f09e5`

Branch da FASE 10:
`feat/adm-deposito-phase-10-physical-inventory`

PR técnico da FASE 10:
- PR #180 — `feat: ADM Depósito phase 10 physical inventory`;
- escopo exclusivo DEP-20 a DEP-20.3;
- squash merge na `main`: `0a15586ff39d740f48f71c33c7cbff578835e11f`;
- Application CI #702 aprovado integralmente;
- Recovery guardrails #463 aprovado;
- `validate-application` aprovado;
- Browser E2E com Firebase Emulator aprovado;
- gates finais dos Blocos 16, 17, 18, 19, 20 e 21 aprovados;
- FASE 11 ainda não integrada; PR #182 foi encerrado sem merge e deverá ser refeito sobre a fronteira de isolamento atual.

PR técnico da FASE 9:
- PR #179 — `feat: ADM Depósito phase 9 depot view layout`;
- escopo exclusivo DEP-17 a DEP-19.5;
- FASE 10 não iniciada.


PR da FASE 8:
- PR #176 — `feat: ADM Depósito phase 8 barcode scanner express outbound`;
- squash merge na `main`: `de11ad4f742eed3ca25a7f526c1ea5c78e113ec2`;
- Recovery guardrails aprovado;
- Application CI aprovado;
- testes multi-tenant/Firestore aprovados com 218/218 cenários;
- FASE 8 domain tests aprovados;
- FASE 8 permanent guard aprovado;
- build de produção aprovado;
- TypeScript final aprovado;
- diff hygiene aprovado;
- Browser E2E com Firebase Emulator aprovado;
- PR encerrado mergeável e sem regressão funcional conhecida.

PR da FASE 7:
- PR #174 — `feat: implement ADM Depósito phase 7 stock lots FEFO`;
- squash merge na `main`: `7a469d1700b2783ba7f789a63617c90e349dced9`;
- Recovery guardrails aprovado;
- Application CI aprovado;
- testes multi-tenant/Firestore aprovados;
- gates permanentes das FASES 0–7 aprovados;
- FASE 7 domain tests aprovados;
- build de produção aprovado;
- TypeScript final aprovado;
- diff hygiene aprovado;
- Browser E2E com Firebase Emulator aprovado.

PR da FASE 6:
- PR #173 — `feat: implement ADM Depósito phase 6 locations and transfers`;
- Recovery guardrails aprovado;
- Application CI aprovado;
- testes multi-tenant/Firestore aprovados;
- gates permanentes das FASES 0–6 aprovados;
- build de produção aprovado;
- TypeScript final aprovado;
- diff hygiene aprovado;
- Browser E2E com Firebase Emulator aprovado;
- validação dirigida no Cloud Shell: 199/199 cenários multi-tenant aprovados.

Observação de deploy:
- o check automático da Vercel retornou `build-rate-limit`, uma limitação de cota da plataforma, não uma falha de build do código;
- a publicação/estado de produção deve ser conferida separadamente do gate técnico do GitHub.

## Fases concluídas

### FASE 0 — Fundação e isolamento
Concluída.

### FASE 1 — Fundação do material
Concluída.

Contrato canônico:
- `warehouse_material_v1`;
- identidade estável de material;
- unidade/apresentação normalizada;
- isolamento por workspace/UG.

### FASE 2 — Ledger e saldos
Concluída.

Contratos oficiais:
- `warehouse_movement_v1`;
- `warehouse_balance_v1`;
- ledger append-only;
- saldo materializado como projeção do ledger;
- idempotência determinística.

### FASE 3 — Walking Skeleton
Concluída e integrada.

Superfícies estruturais:
- Visão Geral;
- Estoque;
- Movimentações;
- Localizações;
- Visão do Depósito;
- Inventário;
- SISCOFIS/Conciliação;
- Entregas;
- Configurações.

### FASE 4 — NF → Estoque / projeção logística desacoplada
Concluída.

Capacidade vertical preservada:
- NF confirmada gera `INVOICE_ENTRY`;
- edição/correção usa `INVOICE_CORRECTION`;
- exclusão integrada usa estorno compensatório;
- vínculo persistido NF → empenho → item → material → movimento → saldo;
- material é autoridade por ID persistido, sem matching textual implícito;
- idempotência protege retry/duplo clique;
- cutoff por workspace impede backfill silencioso;
- Estoque e Movimentações leem as fontes reais do warehouse.

Decisão correspondente:
- D-033 em `DECISIONS.md`.

### FASE 5 — SISCOFIS / Marco Zero / Conciliação
Concluída.

Capacidade vertical entregue:
- aba SISCOFIS / Conciliação deixou de ser placeholder e tornou-se operacional;
- EMPROVEX gera prompt oficial para interpretação por IA externa;
- IA continua fora do EMPROVEX;
- contrato de importação versionado: `warehouse_siscofis_import_v1`;
- validação rígida recusa JSON inválido, campos inesperados, UG divergente, IDs inválidos, unidades desconhecidas e duplicidades críticas;
- avisos de inconsistência são exibidos antes da confirmação;
- preview identifica explicitamente `MARCO_ZERO` ou `SNAPSHOT`;
- primeiro SISCOFIS confirmado estabelece o Marco Zero;
- Marco Zero persiste auditoria em `siscofisSnapshots/marco-zero`;
- saldo inicial entra exclusivamente pelo ledger oficial como `INITIAL_BALANCE`;
- saldo materializado continua sendo projeção do ledger;
- hash da importação e chaves idempotentes permitem retry sem duplicar estoque;
- Marco Zero usa transição `APPLYING → CONFIRMED` para permitir recuperação segura de interrupção;
- uma fonte diferente não pode substituir Marco Zero em andamento ou confirmado;
- cutoff da FASE 4 é reutilizado e sobreposição histórica ambígua é bloqueada;
- se o cutoff ainda não existir, a confirmação do Marco Zero o estabelece no contrato existente da FASE 4;
- linhas explicitamente vinculadas exigem `materialId` canônico válido, mesma UG e unidade compatível;
- no Marco Zero, linha sem `materialId` pode criar material canônico determinístico sem criar catálogo paralelo;
- após o Marco Zero, linha sem vínculo permanece `UNRESOLVED`;
- relatórios posteriores são snapshots de conciliação e nunca geram movimento de estoque;
- conciliação mostra quantidade SISCOFIS, quantidade EMPROVEX, diferença e estado;
- estados: `MATCHED`, `DIVERGENT` e `UNRESOLVED`;
- divergência nunca corrige saldo automaticamente;
- histórico é consultado sob demanda e bounded;
- Firestore Rules específicas protegem criação, transição e imutabilidade dos snapshots;
- founder-only e isolamento por workspace/UG permanecem intactos;
- Número de Ficha SISCOFIS continua fora do núcleo da primeira versão.

Contratos/documentos:
- `warehouse_siscofis_import_v1`;
- `warehouse_siscofis_snapshot_v1`;
- `docs/adm-deposito/PHASE_5_SISCOFIS.md`;
- decisão permanente D-036 em `DECISIONS.md`.

### FASE 6 — Depósitos / Localizações / Transferências
Concluída.

Capacidade vertical entregue:
- suporte a 1..N depósitos por UG;
- estrutura Depósito → Local → Subposição opcional;
- identidades técnicas estáveis e códigos lógicos preparados para uso futuro pela Visão do Depósito;
- ativação/inativação sem exclusão física;
- distribuição física por material persistida como projeção derivada do ledger;
- estado `UNASSIGNED` / “Sem localização” preserva compatibilidade com saldos anteriores;
- transferência interna usa `warehouse_movement_v1.type = TRANSFER`;
- transferência altera origem/destino físico sem alterar o saldo agregado da OM;
- origem, destino, movimento e revisão do saldo agregado são tratados de forma atômica;
- idempotência determinística protege retries;
- Localizações deixou de ser placeholder e tornou-se superfície operacional;
- Movimentações identifica transferências internas auditáveis;
- Firestore Rules protegem depósitos, locais, subposições, projeções físicas e transferências;
- usuários externos permanecem sem acesso ao módulo;
- nenhuma capacidade de lotes, validade, FEFO, scanner, mapa ou inventário foi antecipada.

Contratos/documentos:
- `warehouse_depot_v1`;
- `warehouse_location_v1`;
- `warehouse_location_balance_v1`;
- `docs/adm-deposito/PHASE_6_LOCATIONS.md`;
- decisões permanentes D-037 e D-038 em `DECISIONS.md`.

### FASE 7 — Estoque Operável / Lotes / Validade / FEFO
Concluída.

Capacidade vertical entregue:
- contrato `warehouse_lot_v1` para lote, validade, posição e origem logística;
- lote atua como enriquecimento do estoque existente e não cria saldo concorrente;
- criar/editar lote não gera entrada, saída, transferência nem ajuste no ledger;
- validade opcional em formato ISO real, com estados válido, próximo do vencimento, vencido e sem validade;
- recomendação FEFO prioriza lote ativo, com saldo atribuído, validade futura e vencimento mais próximo;
- FEFO é recomendação e não executa baixa automática;
- pendências logísticas são avisos não bloqueantes para estoque sem lote, sem validade, `UNASSIGNED`, vencidos e inconsistências;
- tela Estoque tornou-se operacional com pesquisa por material, lote, validade, NF, fornecedor e localização;
- filtros por depósito, localização e situação de validade;
- ficha do material consolida saldo, distribuição física, lotes, validade, origem e histórico do ledger;
- ação “Localizar no depósito” reutiliza IDs estáveis da FASE 6 sem antecipar o croqui da FASE 9;
- histórico por material é bounded e carregado sob demanda;
- origem de NF, quando informada, referencia movimento oficial do mesmo material/workspace/UG;
- Firestore Rules próprias para `lots`, com founder-only, integridade material/origem/UG e delete físico bloqueado;
- usuários externos permanecem sem visibilidade nem acesso ao módulo;
- código de barras, scanner, saída expressa, croqui e inventário não foram antecipados.

Contratos/documentos:
- `warehouse_lot_v1`;
- `docs/adm-deposito/PHASE_7_STOCK_LOTS_FEFO.md`;
- decisões permanentes D-039, D-040 e D-041 em `DECISIONS.md`.

### FASE 8 — Código de Barras / Scanner / Saída Expressa
Concluída.

Capacidade vertical entregue:
- contrato `warehouse_barcode_v1` para múltiplos códigos e apresentações por material canônico;
- barcode permanece identificador auxiliar e nunca substitui `materialId`;
- associação explícita de código desconhecido, sem criação automática de material;
- conversão de embalagem reutiliza a conversão canônica do material;
- leitor USB HID funciona como teclado, com fluxo código + ENTER;
- digitação/pesquisa manual converge para o mesmo serviço transacional;
- fluxo operacional contínuo `SCAN → quantidade → ENTER`, com retorno de foco ao scanner;
- saída expressa reutiliza `warehouse_movement_v1.type = OUTBOUND`;
- movimento, saldo agregado e projeção física são atualizados atomicamente;
- saldo agregado ou físico insuficiente aborta toda a operação;
- saldo negativo é bloqueado;
- lote é opcional; quando selecionado, sua atribuição logística é reduzida na mesma transação;
- FEFO permanece recomendação consultiva e exige ação explícita do operador;
- retry idêntico reutiliza a idempotência do ledger e não baixa estoque duas vezes;
- tela Estoque pesquisa e exibe associações de barcode;
- rota `/adm-deposito/saida-expressa` integrada ao shell e à navegação;
- usuários externos permanecem sem acesso ao namespace logístico;
- nenhuma capacidade de croqui/Visão do Depósito da FASE 9 foi antecipada.

Contratos/documentos:
- `warehouse_barcode_v1`;
- `EXPRESS_OUTBOUND` como origem estruturada de `OUTBOUND`;
- `docs/adm-deposito/PHASE_8_BARCODE_SCANNER_EXPRESS_OUTBOUND.md`;
- decisões permanentes D-042, D-043 e D-044 em `DECISIONS.md`.

## Regras permanentes após a FASE 8

1. NF permanece fonte canônica do EMPROVEX; a projeção NF → estoque reutiliza o ledger da FASE 2 sem participar da transação operacional da NF.
2. Não existe segundo saldo concorrente.
3. Correções, cancelamentos e futuros ajustes devem permanecer auditáveis por movimentos.
4. O identificador persistido do material é a autoridade; descrição textual não é chave de identidade.
5. Marco Zero usa `INITIAL_BALANCE` no ledger e nunca grava saldo diretamente.
6. Após Marco Zero, SISCOFIS é snapshot de comparação e nunca entrada automática de estoque.
7. Divergência SISCOFIS nunca pode autocorrigir o EMPROVEX.
8. O cutoff da FASE 4 continua protegendo o histórico contra duplicação.
9. Isolamento por workspace/UG continua obrigatório.
10. Founder-only continua obrigatório durante o piloto.
11. Usuários externos não podem ganhar acesso ao módulo por consequência de fases internas.
12. Consultas devem permanecer bounded e sem listeners globais desnecessários.
13. Cloud Shell pode ser usado de forma ativa quando reduzir ciclos, conforme `docs/DEVELOPMENT_CI_WORKFLOW.md`.
14. Browser E2E deve continuar cobrindo mudanças reais de jornada; gates das fases anteriores permanecem permanentes.
15. Distribuição física é projeção derivada do ledger; não existe segundo saldo de estoque.
16. Saldo legado sem posição explícita permanece representado como `UNASSIGNED` até transferência/localização operacional.
17. Transferência interna deve usar `TRANSFER`, preservar o saldo agregado da OM e atualizar origem/destino atomicamente.
18. Depósitos, locais e subposições possuem identidade lógica estável; renomear não pode trocar a identidade técnica.
19. `warehouse_lot_v1` é enriquecimento logístico; `warehouse_balance_v1` e `warehouse_location_balance_v1` continuam autoridades quantitativas.
20. Ausência de lote/validade continua não bloqueante; o sistema deve avisar sem inventar dado nem autocorrigir saldo.
21. FEFO é recomendação derivada e nunca pode executar saída automática.
22. Histórico do material deve continuar bounded e sob demanda; a listagem Estoque não deve carregar o ledger global.
23. Barcode é identidade auxiliar; `materialId` continua sendo a identidade canônica.
24. Código desconhecido exige associação explícita e nunca cria material automaticamente.
25. Saída expressa deve continuar sendo `OUTBOUND` no ledger oficial, sem saldo paralelo.
26. Movimento, saldo agregado e projeção física da saída expressa devem permanecer atômicos.
27. Nenhuma saída pode produzir saldo agregado ou físico negativo.
28. Scanner HID e pesquisa manual devem convergir para o mesmo serviço transacional.
29. FEFO continua consultivo; escolha de lote exige ação humana explícita.
30. Firestore Rules da Saída Expressa usam caminho especializado para permanecer dentro do orçamento de avaliação sem enfraquecer isolamento, atomicidade ou integridade.

## Validação da FASE 5

Gates específicos:
- `npm run test:adm-deposito-siscofis`;
- `npm run verify:adm-deposito-phase-5`;
- cenários SISCOFIS/Marco Zero no teste multi-tenant Firestore.

Gates integrados executados no PR #171:
- Multi-tenant Firestore security;
- FASES 0–4;
- FASE 5 domain tests;
- FASE 5 permanent guard;
- build de produção;
- TypeScript final;
- diff hygiene;
- Browser E2E com Firebase Emulator;
- Recovery guardrails.

A suíte Browser E2E valida regressão de navegador e preservação do bloqueio externo. A lógica específica do novo fluxo SISCOFIS é coberta por testes de domínio, Rules/emulador e guard estrutural permanente.

## Validação da FASE 6

Gates específicos:
- `npm run test:adm-deposito-locations`;
- `npm run verify:adm-deposito-phase-6`;
- cenários de depósitos/localizações/transferências no teste multi-tenant Firestore;
- Browser E2E específico da jornada de Localizações.

Gates integrados executados no PR #173:
- Multi-tenant Firestore security: aprovado;
- FASES 0–5: aprovadas sem regressão;
- FASE 6 domain tests: aprovado;
- FASE 6 permanent guard: aprovado;
- build de produção: aprovado;
- TypeScript final: aprovado;
- diff hygiene: aprovado;
- Browser E2E com Firebase Emulator: aprovado;
- Recovery guardrails: aprovado.

Correções de fechamento:
- Rules de transferência redistribuídas para permanecer dentro do limite de avaliação do Firestore;
- guards estruturais das FASES 4 e 5 tornados compatíveis com a evolução da FASE 6 sem remover suas invariantes;
- autenticação founder no Browser E2E aceita token do Auth Emulator somente sob gate explícito de teste, host local e projeto `demo-*`, sem bypass em produção.

## Validação da FASE 7

Gates específicos:
- `npm run test:adm-deposito-stock-operational`;
- `npm run verify:adm-deposito-phase-7`;
- cenários de lotes/validade/FEFO no teste multi-tenant Firestore;
- Browser E2E específico da jornada Estoque.

Gates integrados executados no PR #174:
- Multi-tenant Firestore security: aprovado;
- FASES 0–6: aprovadas sem regressão;
- FASE 7 domain tests: aprovado;
- FASE 7 permanent guard: aprovado;
- build de produção: aprovado;
- TypeScript final: aprovado;
- diff hygiene: aprovado;
- Browser E2E com Firebase Emulator: aprovado;
- Recovery guardrails: aprovado.

Correções de fechamento:
- `firestore.rules` foi reconstruído a partir do baseline limpo após detecção de expansão textual acidental no diff, reduzindo a alteração para o bloco real da FASE 7;
- teste externo de leitura de lote foi corrigido para usar efetivamente a sessão externa;
- guard documental da FASE 7 foi alinhado ao título oficial sem alterar a regra de domínio.


### FASE 9 — Visão do Depósito / Editor / Persistência
Concluída.

Capacidade vertical entregue:
- contrato `warehouse_depot_layout_v1`;
- croqui 2D com perspectiva tridimensional leve, sem WebGL/engine 3D;
- objetos estruturais simples sem desenhar produtos;
- vínculo opcional por `warehouseLocationId` com IDs reais da FASE 6;
- pesquisa por material canônico destacando todas as posições físicas positivas aplicáveis;
- FEFO reutilizado somente como destaque consultivo;
- editor separado do modo operacional;
- adicionar, mover, redimensionar, renomear, tipar, vincular e remover representação visual;
- mover/remover objeto visual nunca movimenta estoque nem apaga localização logística;
- layout ativo no Firestore com histórico versionado;
- versão anterior arquivada sem sobrescrita silenciosa;
- recuperação de versão arquivada como base para uma nova versão;
- JSON e SVG derivados/exportáveis;
- Firestore permanece fonte operacional da configuração;
- Drive permanece complementar e não bloqueante; sincronização automática não foi fingida quando a autorização temporária não está disponível;
- consultas bounded e sem listener global/ledger global;
- founder-only e isolamento workspace/UG preservados.

Contratos/documentos:
- `warehouse_depot_layout_v1`;
- `docs/adm-deposito/PHASE_9_DEPOT_VIEW_LAYOUT.md`;
- decisões permanentes D-046, D-047 e D-048 em `DECISIONS.md`.

## Validação da FASE 8

Gates específicos:
- `npm run test:adm-deposito-barcode-outbound`;
- `npm run verify:adm-deposito-phase-8`;
- cenários de barcode, scanner, saída expressa, saldo e posição no teste multi-tenant Firestore;
- Browser E2E específico da jornada da Saída Expressa.

Gates integrados executados no PR #176:
- Multi-tenant Firestore security: aprovado, 218/218 cenários;
- FASES 0–7: aprovadas sem regressão;
- FASE 8 domain tests: aprovado;
- FASE 8 permanent guard: aprovado;
- build de produção: aprovado;
- TypeScript final: aprovado;
- diff hygiene: aprovado;
- Browser E2E com Firebase Emulator: aprovado;
- Recovery guardrails: aprovado;
- gates finais globais dos blocos existentes: aprovados.

Correções de fechamento:
- caminho de segurança `EXPRESS_OUTBOUND` foi especializado em movimento, saldo e projeção física para eliminar o estouro do limite de 1.000 expressões do Firestore;
- wildcard recursivo do namespace warehouse foi removido e o domínio `inventories` passou a possuir regra explícita, mantendo domínios desconhecidos negados por padrão;
- guards permanentes das fases anteriores foram tornados compatíveis com a evolução estrutural das Rules sem remover suas invariantes;
- validações de barcode e lote evitam leituras desnecessárias nos fluxos em que não são aplicáveis;
- `firestore.rules` permaneceu estruturalmente íntegro e o CI final confirmou a operação válida de Saída Expressa.


## Validação da FASE 9

Gates específicos:
- `npm run test:adm-deposito-depot-layout`;
- `npm run verify:adm-deposito-phase-9`;
- cenários de layout/versionamento/isolamento no teste multi-tenant Firestore;
- Browser E2E específico da Visão do Depósito.

O PR #179 é o gate técnico da fase. O fechamento somente é válido com Application CI, Recovery guardrails, build, TypeScript, diff hygiene e Browser E2E verdes.

Decisões de segurança/performance:
- layout não importa ou escreve repository de saldo/ledger;
- histórico é bounded;
- layout ativo é consultado diretamente;
- lotes são carregados apenas para o material selecionado;
- Rules mantêm caminho explícito `/layouts/{layoutId}` sem wildcard recursivo;
- versões arquivadas não podem ter conteúdo reescrito.

### FASE 10 — Inventário Físico
Concluída e integrada à `main`.

Capacidade vertical implementada:
- contrato de sessão warehouse_inventory_v1;
- itens bounded warehouse_inventory_item_v1;
- inventário total/parcial por depósito, localização ou subposição;
- esperado derivado de warehouse_balance_v1 e warehouse_location_balance_v1;
- contagem sem efeito colateral no estoque;
- revisão de divergências e confirmação humana;
- INVENTORY_ADJUSTMENT com origem PHYSICAL_INVENTORY;
- idempotência estável por sessão/item;
- atualização transacional de ledger, saldo agregado e posição;
- detecção de concorrência por revision/lastMovementId da posição;
- RECONCILIATION_REQUIRED em referência obsoleta;
- fila derivada de materiais sem localização;
- histórico sem exclusão física;
- bloqueio integral de usuários externos;
- Browser E2E e guards específicos adicionados.

Contratos/documentos:
- warehouse_inventory_v1;
- warehouse_inventory_item_v1;
- docs/adm-deposito/PHASE_10_PHYSICAL_INVENTORY.md;
- decisões D-049, D-050 e D-051.

Validação de fechamento aprovada:
- domain tests FASE 10;
- permanent guard FASE 10;
- multi-tenant Firestore;
- gates permanentes das fases anteriores;
- TypeScript;
- build;
- diff hygiene;
- Browser E2E;
- Recovery guardrails;
- Application CI #702 integralmente verde.

## Planejamento futuro aprovado — FASE 11.5

Foi aprovada a inclusão da **FASE 11.5 — Consolidação Visual e UX do ADM Depósito**, posicionada entre a FASE 11 e a FASE 12.

Diretrizes:
- a fase será dedicada à consolidação estética e de experiência do módulo já funcional;
- a direção criativa será conduzida pessoalmente pelo fundador, de forma iterativa;
- detalhes como cores, referências, composição, intensidade de efeitos e prioridades visuais permanecem deliberadamente abertos até a execução da fase;
- o agente atuará na tradução dessas decisões em design system, componentes, tokens, responsividade, consistência e implementação técnica;
- FASES 8 a 11 não devem antecipar uma reformulação estética global; nelas cabem apenas ajustes necessários à usabilidade e à conclusão funcional;
- a FASE 11.5 não deverá alterar regras de negócio, ledger, saldos ou contratos logísticos;
- a FASE 12 começará sobre a interface visual consolidada, permitindo hardening, segurança, performance e telemetria sobre a experiência definitiva.

A definição detalhada da FASE 11.5 está registrada em `docs/adm-deposito/ROADMAP.md`.
## Próxima fase oficial

**Concluir a FASE 11.5 — Consolidação Visual e UX**, incluindo revisão visual pelo fundador e ajustes restantes da experiência. Depois, iniciar a FASE 12 — segurança, performance e telemetria. A FASE 13 executará a validação consolidada.


## Sequência futura resumida

1. Core Protection — gate permanente de operacionalidade do EMPROVEX;
2. FASE 11 — entregas / dashboard / alertas;
3. FASE 11.5 — consolidação visual / UX conduzida pelo fundador;
4. FASE 12 — segurança / performance / telemetria + testes de falha controlada;
5. FASE 13 — validação integrada e fechamento do piloto;
6. FASE 14 — expansão externa futura.

## Regra operacional de CI documental

Política oficial registrada em `docs/DEVELOPMENT_CI_WORKFLOW.md`:
- alterações exclusivamente em `docs/**` não disparam o Application CI;
- encerramentos documentais de fase, atualização de STATUS, ROADMAP e HANDOFF podem ser feitos sem repetir a bateria completa quando nenhum arquivo funcional/configuracional fizer parte do diff;
- qualquer alteração fora de `docs/**` restaura o fluxo normal de CI;
- esta exceção não se aplica a código, Firestore Rules, scripts, testes, workflows ou infraestrutura;
- `Recovery guardrails` continua obedecendo seu filtro específico de arquivos.

A regra foi implementada na `main` em 2026-09-24 pelo commit `a09efba4d9dc595073fdb629791d44fc47135e5e`.

## Gate para o próximo chat

Antes de modificar código:
1. consultar a `main` real;
2. ler `README.md`, `ROADMAP.md`, `DECISIONS.md`, `STATUS.md`, `HANDOFF_TEMPLATE.md`, `../EMPROVEX_CORE_PROTECTION.md`, `PHASE_6_LOCATIONS.md`, `PHASE_7_STOCK_LOTS_FEFO.md`, `PHASE_8_BARCODE_SCANNER_EXPRESS_OUTBOUND.md` e `PHASE_9_DEPOT_VIEW_LAYOUT.md`;
3. comparar a `main` com o fechamento funcional da FASE 10 registrado aqui;
4. analisar commits posteriores ao merge da FASE 10;
5. preservar material canônico, ledger, saldo, projeção NF → estoque desacoplada, cutoff, Marco Zero, snapshots SISCOFIS, distribuição física, lotes, FEFO, barcodes, Saída Expressa, layout versionado e, acima de tudo, a independência operacional do EMPROVEX;
6. executar a FASE 11 somente se todos os gates de Core Protection permanecerem verdes e sem introduzir escrita do ADM no namespace operacional;
7. não iniciar a FASE 11.5 no mesmo chat;
8. atualizar STATUS ao fechar a fase.

## Atualização 2026-09-24 — nova estrutura funcional e módulos oficiais

Estado atual da FASE 11.5:
- **EM EXECUÇÃO**;
- branch: `feat/adm-deposito-phase-11-5-visual-ux`;
- navegação principal reorganizada para quatro áreas:
  - **Início**;
  - **Cadastro de Itens**;
  - **Meus Depósitos**;
  - **Controle de Itens**;
- rotas legadas estão sendo preservadas por redirecionamento/compatibilidade, não como áreas paralelas;
- a fila inicial de itens de NF foi criada em Cadastro de Itens;
- a migração SISCOFIS foi reposicionada sob Cadastro de Itens;
- Localizações e Visão do Depósito foram agrupadas sob Meus Depósitos;
- Estoque, Saída Expressa, Movimentações, Inventário, Entregas, Alertas e Configurações foram agrupados sob Controle de Itens;
- a Home/Início com consulta e croqui permanece como superfície central de visualização.

Pendências funcionais oficiais passam a seguir os 14 módulos descritos no ROADMAP.

Próximo módulo:
- **Módulo 1 — Motor de pendências das Notas Fiscais**.

Importante:
- a fila atual já apresenta os itens das NFs, mas a classificação persistida entre **Alocar no depósito** e **Consumo imediato** ainda não é considerada concluída;
- o fluxo completo de alocação física, lote/validade/barcode, consumo imediato, multi-depósito com layout ativo próprio e editor visual avançado permanece pendente nos módulos seguintes;
- nenhuma suíte completa ou CI foi executada para esta reorganização, em conformidade com D-057;
- a campanha consolidada de validação permanece reservada ao Módulo 14.

## Atualização 2026-09-24 — Módulo 1 concluído: Motor de pendências das Notas Fiscais

Estado:
- **MÓDULO 1 CONCLUÍDO** na branch `feat/adm-deposito-phase-11-5-visual-ux`;
- HEAD de entrada auditado: `8e8c1d7b1606076322e02fda56d427ef563c611a`;
- commit funcional principal: `e9bfeccebcaf8636214c510309f455abb3d4cbae`;
- correção de integridade das Rules durante inspeção estática: `d86f20ed433bd789e3acdc204946b9af40217531`;
- nenhum Módulo 2 foi iniciado.

Implementação:
- criado `warehouse_item_intake_v2` como estado versionado de tratamento parcial no path `warehouse/{workspaceId}/intakes/{intakeId}`;
- identidade determinística continua usando `workspaceId + invoiceRecordKey + itemId`, portanto refresh/reentrada não cria pendências concorrentes;
- a fila mostra NF, fornecedor, empenho, material, recebido, alocado, consumo imediato, pendente e status;
- cálculo: `pendingQuantity = receivedQuantity - allocatedQuantity - immediateConsumptionQuantity`;
- estados persistidos: `PENDING`, `PARTIALLY_PROCESSED`, `PROCESSED`;
- `RECONCILIATION_REQUIRED` é derivado na leitura quando o warehouse diverge da fonte canônica, sem reescrever histórico;
- ausência de estado persistido continua representando PENDING, com ID logístico estável calculado e sem escrita durante refresh;
- `warehouse_item_intake_v1` foi preservado para registros históricos completos;
- o relatório legado de consumo imediato continua lendo somente v1 e ignora documentos v2, evitando quebra de compatibilidade.

Alteração/exclusão da NF:
- quantidade recebida persistida no v2 é imutável;
- mudança posterior da quantidade canônica gera `CANONICAL_QUANTITY_CHANGED`;
- NF/item ausente gera `CANONICAL_SOURCE_MISSING` somente quando a janela canônica não está truncada;
- projeção legada de NF sem intake compatível gera `LEGACY_INVOICE_PROJECTION`;
- nenhum caso executa compensação de saldo ou correção silenciosa;
- cutoff logístico existente continua sendo respeitado e não foi criada retrointegração de NFs antigas.

Performance e isolamento:
- nova leitura da fila não reutiliza `loadWarehouseDeliveriesContext` e, portanto, não carrega cronogramas, balances e demais domínios desnecessários;
- limites atuais: 250 empenhos, 300 NFs, 500 intakes e 250 movimentos recentes de compatibilidade legada;
- não existem listeners globais nem N+1 para montar a fila;
- Rules v2 permanecem sob `warehouse`, com founder-only no piloto, UG/workspace validados e delete negado;
- nenhum arquivo do fluxo operacional de cadastro/edição/exclusão de NF, Empenho ou Cronograma foi alterado;
- `warehouse_balance_v1` continua sendo a autoridade quantitativa de estoque.

Interface:
- botões **Alocar no depósito** e **Consumo imediato** não fingem conclusão;
- **Alocar no depósito** apenas informa que a execução física será habilitada no Módulo 2;
- **Consumo imediato** apenas informa que a classificação operacional pertence a módulo posterior;
- itens divergentes bloqueiam continuação visual e exibem a causa da reconciliação.

Arquivos funcionais principais:
- `lib/warehouse/intakeState.ts`;
- `lib/warehouse/intakeStateRepository.ts`;
- `lib/warehouse/intakeRepository.ts`;
- `features/warehouse/components/WarehouseItemRegistrationOperational.tsx`;
- `firestore.rules`.

Validação:
- por decisão D-057 e pela ordem modular vigente, **não foram executados** suíte completa, Browser E2E, Application CI, regressão completa ou PR;
- nenhum teste pontual foi necessário, pois os bloqueios encontrados foram diagnosticados e resolvidos por inspeção do diff;
- campanha consolidada permanece reservada ao **Módulo 14**.

Próximo módulo oficial:
- **Módulo 2 — Alocação física do item recebido**;
- não iniciado neste fechamento.



## Atualização 2026-09-24 — Módulos 2 e 3 concluídos: Alocação física + lote, validade e barcode

Estado:
- **MÓDULO 2 CONCLUÍDO**;
- **MÓDULO 3 CONCLUÍDO**;
- branch: `feat/adm-deposito-phase-11-5-visual-ux`;
- HEAD de entrada auditado antes das alterações: `c81db9c129938da3a59dfb9f6c724b468bfb7993`;
- repository transacional criado em `7166820098f4f2a88cec0c99e04473f775f0433a`;
- normalização defensiva de identidade de material em `44c24f9744300959ba772d4e2e9f9a8d83416ea3`;
- jornada operacional de interface em `cd35f7db308e357439b351d1a65f31e3fa68570f`;
- fingerprint do payload incorporado ao replay idempotente em `cc548560a200191998902d65bc85f1a414061484`;
- preservação correta de data-only de validade e captura HID/ENTER em `a451b48d75c9aa437e2024fd5b95576ba5863c76`;
- nenhuma implementação do Módulo 4 foi iniciada.

### Fluxo final de alocação

A ação **Alocar no depósito** agora executa uma jornada única:
`item de NF → quantidade parcial → depósito → localização → subposição opcional → lote → validade/sem validade → barcode opcional → resumo → confirmar`.

A interface apresenta:
- material;
- NF;
- fornecedor;
- empenho;
- quantidade recebida;
- já alocada;
- consumo imediato;
- pendente;
- seleção de quantidade limitada ao pendente;
- somente depósitos/localizações/subposições ativos;
- lote;
- validade ou opção explícita **Sem validade**;
- barcode por digitação ou scanner USB HID;
- resumo antes da confirmação;
- atualização automática da fila após sucesso.

### Quantidade parcial e intake v2

Uma confirmação pode tratar apenas parte da pendência.

Exemplo válido:
- recebido: 100;
- alocação 1: 40;
- `allocatedQuantity = 40`;
- `pendingQuantity = 60`;
- status `PARTIALLY_PROCESSED`;
- nova operação futura pode tratar os 60 restantes sem repetir a primeira.

Após cada transferência confirmada:
`allocatedQuantity += quantidadeAlocada`

e:
`pendingQuantity = receivedQuantity - allocatedQuantity - immediateConsumptionQuantity`.

O status permanece derivado entre `PENDING`, `PARTIALLY_PROCESSED` e `PROCESSED`.

### Relação entre intake, ledger e saldos

O intake continua sendo somente estado de tratamento.

Autoridades:
- `warehouse_movement_v1`: trilha auditável;
- `warehouse_balance_v1`: saldo agregado;
- `warehouse_location_balance_v1`: distribuição física;
- `warehouse_item_intake_v2`: progresso de tratamento.

A primeira operação v2 garante uma entrada quantitativa idempotente por item/NF quando ainda não existe projeção anterior. Essa entrada usa o repository oficial do ledger e coloca a quantidade recebida em `UNASSIGNED`.

Cada alocação parcial posterior usa:
`UNASSIGNED → depósito/local/subposição`

com movimento `TRANSFER` e `quantityDelta = 0`.

O saldo agregado não é somado novamente durante a alocação; apenas recebe a revisão auditável do movimento. Origem e destino físicos são atualizados conjuntamente.

### Prevenção de duplicação da antiga projeção NF → estoque

Antes de criar a entrada quantitativa v2, o repository consulta de forma bounded movimentos `INVOICE` da mesma `invoiceRecordKey`.

Se outro movimento já representar o mesmo `itemId`, a nova entrada é bloqueada com reconciliação necessária. Nenhuma segunda entrada é criada.

Identidade da entrada v2:
`adm-intake-v2:<intakeId>:invoice-entry`.

Repetições da própria entrada v2 retornam como replay idempotente.

A fila continua marcando projeções legadas detectadas como `LEGACY_INVOICE_PROJECTION`; esses itens não recebem alocação automática.

### Atomicidade e recuperação

As Firestore Rules atuais exigem que cada movimento seja refletido como `lastMovementId` do saldo final. Portanto, entrada e transferência permanecem duas fronteiras de movimento.

Estratégia segura:
1. criar/reutilizar `INVOICE_ENTRY` idempotente;
2. executar uma única transação de alocação contendo:
   - `TRANSFER`;
   - revisão do saldo agregado sem mudar a quantidade;
   - débito de `UNASSIGNED`;
   - crédito da posição física;
   - lote;
   - barcode novo, quando aplicável;
   - avanço do intake v2.

Se a entrada existir e a alocação falhar, a quantidade permanece em `UNASSIGNED`, o intake não avança e o retry reutiliza a entrada. Não existe compensação silenciosa.

### Idempotência e concorrência

Cada confirmação recebe um `operationId` estável.

Identidade da transferência:
`adm-intake-v2:<intakeId>:allocation:<operationId>`.

O `operationId` é mantido em `sessionStorage` durante a tentativa, permitindo replay seguro após refresh, duplo clique ou resposta de rede ambígua. O movimento registra ainda um fingerprint compacto de quantidade, posição, lote, validade e barcode; a mesma identidade com payload divergente gera conflito em vez de reaplicar a transferência.

Dentro da transação, o repository relê:
- intake;
- saldo agregado;
- origem/destino físicos;
- depósito/local/subposição;
- lote;
- barcode;
- movimento de entrada;
- eventual movimento de transferência existente.

A operação exige que `allocatedQuantity` e `immediateConsumptionQuantity` ainda sejam iguais aos valores observados pela tela. Se outra tela avançou o item, ocorre conflito explícito e nenhuma quantidade é movimentada.

### Lote e validade

Contrato reutilizado:
`warehouse_lot_v1`.

O lote não altera saldo.

A identidade usada pela jornada é determinística por:
- workspace;
- intake;
- movimento de entrada;
- código de lote;
- posição física.

Consequências:
- mesmo lote + mesma posição pode receber várias parcelas e acumular a atribuição;
- mesmo item pode ser dividido entre múltiplos lotes;
- mesmo lote em posições diferentes permanece rastreável separadamente.

Validade:
- data ISO válida; ou
- escolha explícita **Sem validade**.

Nenhuma validade é inferida automaticamente.

### Barcode e scanner

Contrato reutilizado:
`warehouse_barcode_v1`.

Regras preservadas:
- barcode nunca substitui `materialId`;
- código conhecido precisa permanecer vinculado ao mesmo material/apresentação;
- conflito com outro material é bloqueado;
- barcode inativo ou associação incompatível é bloqueado;
- código desconhecido pode ser associado somente ao material canônico já resolvido;
- nenhum material é criado a partir de barcode desconhecido.

Na interface:
- digitação manual e leitor USB HID usam o mesmo campo;
- ENTER captura a leitura;
- não foi criado SDK específico de scanner;
- scanner de saída continua pertencendo às capacidades já existentes e não foi expandido neste módulo.

### Firestore paths utilizados

- `warehouse/{workspaceId}/materials/{materialId}`;
- `warehouse/{workspaceId}/movements/{movementId}`;
- `warehouse/{workspaceId}/balances/{materialId}`;
- `warehouse/{workspaceId}/locationBalances/{locationBalanceId}`;
- `warehouse/{workspaceId}/depots/{depotId}`;
- `warehouse/{workspaceId}/locations/{locationId}`;
- `warehouse/{workspaceId}/lots/{lotId}`;
- `warehouse/{workspaceId}/barcodes/{barcodeId}`;
- `warehouse/{workspaceId}/intakes/{intakeId}`.

Nenhuma escrita nova foi adicionada em `workspaces/{workspaceId}/invoices`, Empenho ou Cronograma.

### Performance

A fila principal permanece com os limites do Módulo 1.

Ao abrir a alocação:
- depósitos: até 250;
- localizações/subposições: até 500;
- nenhuma leitura de histórico global de lotes;
- nenhum carregamento global de barcodes;
- prevenção de projeção antiga: até 51 movimentos da NF específica;
- nenhuma consulta de movimentos completa por linha da fila;
- nenhum listener global novo.

### Compatibilidade

`warehouse_item_intake_v1` continua histórico e não é convertido para v2.

Registro v1 já tratado não recebe nova alocação.

`RECONCILIATION_REQUIRED` continua bloqueando execução e não corrige:
- ledger;
- saldo;
- quantidade recebida;
- posição;
- lote;
- NF/Empenho.

### Firestore Rules e Core Protection

As Rules existentes já suportavam material, `INVOICE_ENTRY`, `TRANSFER`, saldos, localizações, lotes, barcodes e intake v2 com as invariantes necessárias.

Por isso:
- **nenhuma alteração de Firestore Rules foi necessária**;
- founder-only permanece;
- workspace e UG permanecem isolados;
- movimentos continuam imutáveis;
- saldos continuam derivados do ledger;
- lotes e barcodes não criam saldo;
- deletes físicos continuam negados nos domínios históricos;
- nenhum wildcard permissivo foi introduzido.

Inspeção estática do escopo funcional confirmou alterações somente em:
- `lib/warehouse/intakeAllocationRepository.ts`;
- `features/warehouse/components/WarehouseItemRegistrationOperational.tsx`.

Nenhum serviço crítico de cadastro/edição/exclusão de NF, Empenho ou Cronograma foi alterado. Nenhuma dependência `lib/warehouse` foi adicionada ao núcleo operacional.

### Validação

Conforme D-057:
- não foi executada suíte completa;
- não foi executado Browser E2E completo;
- não foi executado Application CI;
- não foi executada regressão completa;
- não foi executada campanha multi-tenant completa;
- nenhum PR de fechamento foi aberto;
- nenhum merge foi realizado;
- nenhum deploy foi realizado.

Nenhum teste pontual foi necessário; a implementação e os contratos foram verificados por inspeção estática.

A campanha consolidada continua reservada ao **Módulo 14**.

## Fechamento consolidado — Módulo 3.5 + Módulo 4

Data do fechamento: 2026-09-24.

HEAD inicial auditado:
`515508b577420ed0b3635643113c4a3245fdee3e`.

O hash esperado do fechamento anterior coincidiu com o HEAD real de entrada; nenhum commit legítimo posterior precisou ser preservado antes do início deste trabalho.

### Módulo 3.5 — Saída de Material — CONCLUÍDO

A área operacional continua com quatro áreas principais. Nenhuma quinta área foi criada.

Superfície:
**Controle de Itens → Saída de Material**.

Subabas:
- **Nova Saída**;
- **Relatórios**.

A antiga `WarehouseExpressOutbound` foi transformada em wrapper de compatibilidade que renderiza `WarehouseMaterialWithdrawal`. A rota antiga continua funcional sem manter dois motores concorrentes.

#### Checkout

Fluxo:
`SCAN/barcode → material → quantidade → ENTER/TAB → próximo barcode`.

Comportamento:
- foco automático no barcode;
- leitor USB HID funciona como teclado;
- entrada manual usa o mesmo campo;
- ENTER no barcode resolve associação existente;
- barcode desconhecido não cria material;
- associação de barcode desconhecido só pode apontar para material canônico existente;
- quantidade aceita ENTER e TAB;
- ambas as teclas adicionam a linha ao carrinho e devolvem foco ao barcode;
- adicionar linha não baixa estoque;
- carrinho permite edição e remoção antes da primeira tentativa de finalização.

O carrinho exibe:
- material;
- apresentação;
- barcode quando utilizado;
- quantidade solicitada;
- quantidade convertida para unidade-base;
- posição;
- lote quando selecionado;
- saldo observado da posição.

A interface usa a estética do ADM/EMPROVEX, com terminal escuro, hierarquia de checkout, foco visual no item e carrinho.

#### Destino e retirante

Contrato:
`warehouse_destination_v1`.

Path:
`warehouse/{workspaceId}/destinations/{destinationId}`.

Campos:
- `dest_<32 hex>`;
- workspace/UG;
- nome;
- `active | inactive`;
- createdBy/updatedBy;
- timestamps.

Destinos são cadastráveis e não hardcoded. Delete físico é negado; o ciclo normal é inativação.

`withdrawnBy` é obrigatório e separado do operador autenticado.

#### Operação auditável de retirada

Contrato:
`warehouse_material_withdrawal_v1`.

Path:
`warehouse/{workspaceId}/withdrawals/{withdrawalId}`.

Identidade:
- retirada: `wd_<32 hex>`;
- linha: `wline_<32 hex>`;
- baixa: `material-withdrawal:<withdrawalId>:<lineId>`.

Estados:
- `FINALIZING`;
- `PARTIALLY_APPLIED`;
- `FINALIZED`.

Limite:
- máximo de 40 linhas por retirada.

O cabeçalho armazena `payloadHash` SHA-256 do carrinho. Repetição com a mesma identidade e conteúdo divergente é bloqueada.

A baixa real só ocorre durante **Finalizar saída**.

Cada linha reutiliza `applyWarehouseExpressOutbound`; portanto:
- ledger continua `warehouse_movement_v1`;
- movimento continua `OUTBOUND`;
- balance continua derivado;
- locationBalance continua derivado;
- barcode, lote, posição e conversão continuam sob os contratos da FASE 8;
- não existe novo saldo nem novo ledger.

#### FEFO, lote e posição

A implementação reutiliza `selectWarehouseFefoLot`.

O FEFO permanece recomendação operacional, conforme a Saída Expressa anterior:
- não cria baixa automática;
- lote continua opcional no contrato de saída existente;
- posição selecionada continua sendo validada no OUTBOUND;
- saldo, posição, barcode e lote são relidos no momento de cada baixa.

A concorrência entre montagem do carrinho e finalização é detectada pelo repository existente.

#### Falha parcial e retry

A retirada usa finalização idempotente por linha.

Se uma linha já foi aplicada:
- replay com a mesma identidade não duplica movimento;
- projeção de consumo também é idempotente.

Se uma linha posterior falhar:
- operação permanece `PARTIALLY_APPLIED`;
- interface não mostra sucesso completo;
- carrinho fica bloqueado para preservar identidade;
- retry usa o mesmo `withdrawalId`, `lineId` e fingerprint;
- `FINALIZED` só é gravado quando todas as linhas foram aplicadas.

#### Relatórios e SISCOFIS

Contrato:
`warehouse_consumption_record_v1`.

Path:
`warehouse/{workspaceId}/consumptions/{consumptionId}`.

A coleção é projeção operacional de consumo, nunca autoridade de saldo.

Origens:
- `STOCK_OUTBOUND`;
- `IMMEDIATE_CONSUMPTION`.

Estados locais SISCOFIS:
- `PENDING`;
- `PREPARED`;
- `POSTED`.

Não existe integração automática com SISCOFIS.

Presets:
- Diário;
- Semanal: segunda a domingo;
- Quinzenal: 1–15 e 16–último dia;
- Mensal: mês-calendário;
- personalizado.

Filtros:
- Todos;
- Saída de estoque;
- Consumo imediato;
- destino;
- retirante.

Consolidações:
- material;
- destino;
- retirante/recebedor;
- dia.

Detalhamento:
- data/hora;
- origem;
- material;
- quantidade/unidade;
- destino;
- retirante;
- retirada/intake;
- movementId;
- estado SISCOFIS.

Saídas:
- copiar;
- CSV;
- imprimir.

Performance:
- consumos modernos: consulta temporal limitada a 250;
- compatibilidade de Saída Expressa legada: até 100 movimentos do período;
- movimento legado já representado por `warehouse_consumption_record_v1` não é somado novamente;
- nenhum listener global;
- nenhuma reconstrução de histórico completo.

### Módulo 4 — Consumo imediato e fila/relatórios SISCOFIS — CONCLUÍDO

O botão **Consumo imediato** em **Cadastro de Itens → Notas Fiscais pendentes** está operacional.

Campos:
- quantidade;
- destino;
- recebido/retirado por;
- confirmação.

Regra:
`0 < quantidade <= pendingQuantity`.

A classificação pode ser parcial.

Exemplo preservado pelo contrato:
- recebido 100;
- alocado 40;
- consumo imediato 30;
- pendente 30;
- status `PARTIALLY_PROCESSED`.

#### Efeito quantitativo real

D-064 materializa a quantidade recebida inteira em `UNASSIGNED` através do `INVOICE_ENTRY` antes da primeira classificação física.

Por isso, o consumo imediato implementado neste módulo não se limita a incrementar o intake.

A operação:
1. cria/reutiliza a entrada quantitativa idempotente;
2. abre uma transação;
3. relê intake, material, saldo, `UNASSIGNED`, entrada da NF, destino, movimento/consumo de replay;
4. cria `OUTBOUND` da quantidade consumida em `UNASSIGNED`;
5. reduz `warehouse_balance_v1`;
6. reduz `warehouse_location_balance_v1` de `UNASSIGNED`;
7. incrementa `immediateConsumptionQuantity`;
8. recalcula `pendingQuantity`;
9. deriva `PENDING | PARTIALLY_PROCESSED | PROCESSED`;
10. cria a projeção `warehouse_consumption_record_v1`.

Não cria:
- depósito/localização física;
- lote;
- transferência para posição;
- segunda baixa posterior para a mesma parcela.

Idempotência:
`adm-intake-v2:<intakeId>:immediate:<operationId>`.

O `operationId` é mantido em `sessionStorage`.

Concorrência:
- `allocatedQuantity` e `immediateConsumptionQuantity` são comparados com a revisão observada pela tela;
- divergência aborta a operação;
- quantidade nunca pode ultrapassar o pendente atual.

### Motor SISCOFIS compartilhado

Saída normal e consumo imediato convergem para a mesma subaba:
**Saída de Material → Relatórios**.

Uma mesma movimentação é representada uma única vez pelo `movementId`.

O histórico legado de `warehouse_item_intake_v1` continua preservado na subaba renomeada:
**Histórico legado / SISCOFIS**.

Não foi executada migração em massa.

### Firestore Rules

Novos matches explícitos:
- `/warehouse/{workspaceId}/destinations/{destinationId}`;
- `/warehouse/{workspaceId}/withdrawals/{withdrawalId}`;
- `/warehouse/{workspaceId}/consumptions/{consumptionId}`.

Preservado:
- founder-only do piloto;
- workspace/UG;
- movimento imutável;
- saldo/locationBalance derivados;
- lote sem autoridade quantitativa;
- barcode sem autoridade quantitativa;
- intake v2 monotônico;
- delete físico negado em destinos históricos, retiradas e consumos;
- nenhum wildcard permissivo.

Durante a inspeção estática foi detectada corrupção textual local em uma edição intermediária de `firestore.rules` causada pelo tratamento de `$` em substituição textual. O arquivo foi reconstruído a partir do baseline limpo do HEAD inicial antes de qualquer deploy.

Validação final da estrutura do Rules após reconstrução:
- 1 bloco `service cloud.firestore`;
- 1 helper de destinos;
- 1 helper de retiradas;
- 1 helper de consumos;
- 1 match de destinos;
- 1 match de retiradas;
- 1 match de consumos;
- marcadores originais de intake preservados uma única vez.

### Core Protection

Inspeção estática do diff funcional confirmou alterações somente em:
- `features/warehouse/**`;
- `lib/warehouse/**`;
- `firestore.rules`;
- documentação ADM.

Não houve alteração em código de:
- cadastro de NF;
- edição de NF;
- exclusão permitida de NF;
- Empenho;
- Cronograma.

Nenhum fluxo EMPROVEX Core passou a depender do ADM.

### Validação diferida — D-057

Não foram executados:
- suíte completa;
- Browser E2E completo;
- Application CI;
- regressão completa;
- campanha multi-tenant completa;
- PR;
- merge;
- deploy.

Nenhum teste pontual foi necessário após a correção por inspeção estática.

### Próximo módulo oficial

**Módulo 5 — Migração inicial do SISCOFIS**.

Ele permanece **NÃO INICIADO** neste fechamento.
