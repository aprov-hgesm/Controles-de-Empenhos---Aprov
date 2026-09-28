## Atualização modular — Croqui R1 reativado

- A aba **Meus Depósitos → Croquis** voltou a ser operacional na branch modular.
- O novo fluxo R1 consulta somente domínios liberados nesta release: `depots`, `locations` e `layouts`.
- O editor não carrega `locationBalances`, lotes, materiais, movimentos ou outros domínios avançados bloqueados.
- O operador seleciona um depósito cadastrado, insere estruturas da biblioteca, move/redimensiona/gira no editor, vincula o objeto a um Local/Subposição real e salva versões do `warehouse_depot_layout_v1`.
- Alterações no croqui permanecem estritamente visuais e não movimentam estoque.
- O histórico versionado por depósito permanece preservado.

## Atualização modular — Etiquetas físicas A4

- Implementada central de impressão de etiquetas na ADM-R1.
- Escopos: depósito, Locais, estrutura completa, Local selecionado e Subposições.
- Presets A4: 21, 12 ou 8 etiquetas por folha.
- PDF monocromático otimizado para toner, com identidade EMPROVEX e opção de hierarquia/UG.
- Implementação não altera Firestore Rules nem reativa domínios avançados.
- Validação específica: `npm run test:adm-deposito-labels-r1`.

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

## Módulos 6 e 7 — fechamento consolidado em 2026-09-25

HEAD auditado no início do trabalho:
`8eeacf083d6424980c67a63697ef361e1b06e620`.

**Módulo 6 — Meus Depósitos multi-depósito: CONCLUÍDO.**
- os contratos históricos de depósito/localização foram reaproveitados sem nova fonte de verdade;
- criação, edição, inativação, locais e subposições continuam nas APIs oficiais da FASE 6;
- `UNASSIGNED` permanece intacto;
- layout ativo e histórico agora são recuperados por consulta scoped ao `depotId`;
- a interface mostra somente ativo/histórico do depósito selecionado e possui estado vazio próprio para depósito sem layout;
- versionamento continua criando documento novo e arquivando a versão anterior do mesmo depósito.

**Módulo 7 — Biblioteca de estruturas físicas: CONCLUÍDO.**
- criado catálogo estático central `WAREHOUSE_STRUCTURE_LIBRARY`;
- catálogo inclui Estante, Rack, Armário, Freezer, Geladeira, Câmara, Palete, Área de Paletes, Bancada, Corredor, Área Livre e Outra estrutura;
- defaults incluem proporções/dimensões iniciais, rotação, categoria, variante visual e suporte conceitual a níveis/subposições;
- instâncias continuam persistidas somente em `warehouse_depot_layout_v1.objects`;
- nenhum tipo de estrutura foi persistido em coleção própria;
- layouts legados continuam aceitos, inclusive tipos que não aparecem como template principal;
- biblioteca foi exposta no editor existente sem antecipar drag/resize/grid/zoom/pan/undo-redo do Módulo 8;
- teste contratual do croqui foi preparado para validar o catálogo na campanha do Módulo 14.

Firestore Rules: **sem alteração nos Módulos 6/7**. A auditoria confirmou founder-only, isolamento por workspace/UG, delete físico negado para depósito/localização/layout e versionamento de layout já compatível.

Core Protection: preservada. Nenhum arquivo do Core operacional de NF, Empenho, Cronograma, Comissão, Liquidação ou Tesouraria foi alterado.

Validação: conforme D-057, não foram executados Application CI completo, Browser E2E completo, suíte Firestore completa, build global ou regressão global. Não houve PR, merge ou deploy.

Próximo módulo oficial: **Módulo 8 — Editor visual do croqui**.

Pendência operacional conhecida:
- as Firestore Rules atualizadas desta branch ainda precisam ser publicadas no banco nomeado antes de testar cadastros reais no Preview;
- o erro observado anteriormente ao listar `warehouse/hgesm-aprov/depots` permanece compatível com Rules de produção desatualizadas ou sessão não reconhecida, e deve ser reavaliado após publicação das Rules atuais.

Política de validação:
- por D-057, não executar agora suites/CI por incremento;
- todos os testes, guards, TypeScript/build, Emulator, E2E e regressão integrada ficam consolidados para o Módulo 14;
- PowerShell local do fundador está disponível para intervenções necessárias e deve ser usado de forma consolidada.


## Estratégia de validação vigente

D-057 substitui a cadência intermediária anteriormente descrita em D-054:

- não executar baterias de testes ou CI a cada incremento restante das FASES 11.5 e 12;
- preservar guards, testes de domínio, Firestore Emulator, Browser E2E, TypeScript/build e regressão para execução consolidada no Módulo 14;
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


### Endurecimentos finais após o fechamento funcional

HEAD funcional imediatamente antes da atualização documental final:
`fc9d1012c437f74921a187ae94c7b8d7e9a2fb76`.

A inspeção final acrescentou dois ajustes sem alterar arquitetura:
- `2fdfc343ed158a4fd6e2851eed581d28b5f8e538`: carrinho passou a sinalizar lote vencido e lote próximo do vencimento usando `warehouseLotExpiryState`, sem criar nova lógica de FEFO;
- `fc9d1012c437f74921a187ae94c7b8d7e9a2fb76`: a projeção de relatório da saída passou a usar `result.plan.baseQuantity` efetivamente aplicada pelo OUTBOUND oficial, garantindo que o relatório permaneça coerente com o ledger mesmo se a configuração de apresentação tiver mudado entre montagem do carrinho e finalização.

Esses ajustes não alteraram NF, Empenho, Cronograma, política multi-tenant, Módulo 5 ou o diferimento de testes/CI definido por D-057.


## Módulo 5 — Migração inicial do SISCOFIS — IMPLEMENTADO NA BRANCH 11.5

- contrato externo `emprovex_siscofis_inventory_v1` com quatro campos;
- entrada manual e JSON convergem para o mesmo draft externo e adaptador;
- prompt oficial não expõe catálogo, materialId, UG ou estruturas internas;
- Nº Ficha é preservado por linha e não é usado como identidade canônica;
- valor total é calculado deterministicamente pelo EMPROVEX;
- motor histórico de Marco Zero/snapshot/ledger foi reutilizado;
- snapshots novos usam `warehouse_siscofis_snapshot_v2`, com leitura retrocompatível de v1;
- Rules alteradas somente para aceitar explicitamente snapshot v1 ou v2;
- `INITIAL_BALANCE` já materializa `UNASSIGNED` atomicamente pelo ledger oficial; nenhuma adaptação paralela foi necessária;
- prévia editável bloqueia confirmação após correção até nova validação;
- unidade ausente em material novo usa o fallback canônico explícito da integração de NF, sem inventar unidade concreta;
- sem PR, merge ou deploy; Módulo 6 não iniciado.

## Módulo 8 — Editor visual do croqui — CONCLUÍDO

Data: 2026-09-25.

Baseline inicial confirmado:
`ba651652426964adf4c3cd331a99c988250959a1`.

Implementado:
- novo componente `WarehouseDepotLayoutEditor.tsx`;
- edição 2D com grade, snap, zoom e pan;
- drag, resize por alças e rotação em passos de 45°;
- prévia 2.5D leve derivada dos mesmos `layout.objects`;
- duplicar, copiar/colar, excluir somente do croqui;
- bring-to-front/send-to-back por `layer`;
- undo/redo local com histórico limitado em memória;
- atalhos de teclado sem interceptar inputs/selects;
- editor continua consumindo `WAREHOUSE_STRUCTURE_LIBRARY`;
- propriedades, renomeação e vínculo logístico existentes foram preservados;
- versionamento segue pelo repository histórico, somente no comando Salvar versão.

Arquitetura:
- `warehouse_depot_layout_v1` continua autoridade;
- nenhum schema/coleção visual paralela;
- nenhum write durante drag/resize/rotate;
- mover geometria não altera estoque, posição lógica ou movimento;
- isolamento por `depotId` permanece no repository;
- Firestore Rules: sem alteração;
- Core EMPROVEX: sem alteração.

Validação:
- teste contratual do editor foi preparado em `scripts/warehouse-depot-layout.test.mjs`;
- por D-057, Application CI, Browser E2E completo, suíte Firestore, build/typecheck global e regressão global NÃO foram executados;
- nenhum PR, merge ou deploy foi realizado.

Decisão de biblioteca:
- Fabric.js foi avaliado, mas não adotado;
- a base já possuía interação visual manual compatível com o contrato atual;
- manter essa camada evita dependência/peso extra e favorece máquinas antigas;
- ver D-068.

Próximo módulo oficial: **Módulo 9 — Integração croqui ↔ estoque**.


## Módulo 9 — Integração croqui ↔ estoque — CONCLUÍDO

Data: 2026-09-25.

- material canônico ligado às posições por saldos oficiais;
- `warehouseLocationId` reutilizado como ponte visual;
- múltiplas posições destacadas;
- depósito selecionado respeitado integralmente;
- FEFO usa `selectWarehouseFefoLot`;
- localizações sem representação visual continuam listadas;
- estruturas sem localização continuam válidas;
- clique em estrutura mostra contexto da pesquisa;
- croqui não movimenta estoque nem cria nova fonte quantitativa.

## Módulo 10 — Finalização da aba Início — CONCLUÍDO

Data: 2026-09-25.

- seletor de depósito e troca segura de contexto;
- layout ativo carregado sob demanda com `getActiveWarehouseDepotLayout`;
- histórico não é carregado na Início;
- pesquisa, saldo, localizações, lotes, validade e FEFO consolidados;
- croqui em consulta 2.5D/vista superior;
- estados para depósito sem croqui e item sem saldo;
- edição permanece em Meus Depósitos / Croquis;
- Firestore Rules inalteradas;
- Core EMPROVEX inalterado;
- D-057 preservada: sem CI global, Browser E2E completo, build/typecheck global ou regressão global;
- sem PR, merge ou deploy.

Próximo módulo oficial: **Módulo 11 — Consolidação do Controle de Itens**.
Módulo 11: **NÃO INICIADO**.


## FECHAMENTO 2026-09-25 — MÓDULOS 11 E 12

### Baseline inicial auditada
- branch: `feat/adm-deposito-phase-11-5-visual-ux`;
- HEAD inicial real: `1e6fbc905182698cf14a27d4e2c77fce206272f6`;
- nenhum commit posterior precisava ser reconciliado;
- Módulos 1 a 10 tratados como concluídos e não refeitos.

### Módulo 11 — CONCLUÍDO
`WarehouseItemControlOperational` passou a concentrar:
- Resumo logístico;
- Estoque;
- Saída de Material;
- Movimentações;
- Inventário;
- Entregas;
- Alertas;
- SISCOFIS;
- Relatórios;
- Configurações.

Reutilizações principais:
- `WarehouseLogisticsDashboard`;
- `WarehouseStockOperational`;
- `WarehouseMaterialWithdrawal` via `WarehouseExpressOutbound`;
- `WarehouseMovementsOperational`;
- `WarehouseInventoryOperational`;
- `WarehouseDeliveriesOperational`;
- `WarehouseLogisticsAlerts`;
- `WarehouseSiscofisOperational`;
- `WarehouseLogisticsSettings`.

Rotas antigas continuam compatíveis por redirect; nenhuma segunda tela de domínio foi criada.

### Módulo 12 — CONCLUÍDO
Novo componente:
- `features/warehouse/components/WarehouseLogisticsReports.tsx`.

Cobertura:
- estoque/localizações/lotes/validade: reutiliza `WarehouseStockOperational`;
- consumo imediato/saídas: reutiliza `WarehouseConsumptionReports`;
- movimentações/entradas por NF: leitura bounded de `warehouse_movement_v1` + join em memória com materiais + filtros + CSV;
- inventários: reutiliza `WarehouseInventoryOperational`;
- SISCOFIS: reutiliza `WarehouseSiscofisOperational`.

Rota adicionada:
- `/adm-deposito/relatorios` → `/adm-deposito/controle-de-itens?aba=reports`.

### Performance / Firestore
- nenhum listener novo;
- nenhuma consulta por hover;
- nenhuma consulta por linha;
- nenhum N+1 intencional;
- movimentos limitados a 250;
- materiais carregados uma vez e indexados em `Map`;
- relatórios derivados sem coleção/cache paralelo;
- Firestore Rules: **não alteradas**;
- índices Firestore: **não alterados**.

### Core e autoridades
- Core EMPROVEX: **não alterado**;
- ledger continua autoridade de movimentos;
- `warehouse_balance_v1` e `warehouse_location_balance_v1` continuam autoridades quantitativas;
- relatórios não possuem autoridade e não escrevem saldo.

### Validação conforme D-057
Executado:
- auditoria estática de imports, rotas, contratos e limites;
- inspeção de compatibilidade das superfícies reutilizadas.

Deliberadamente NÃO executado:
- Application CI;
- Browser E2E completo;
- regressão global;
- suíte Firestore completa;
- build global;
- TypeScript global;
- bateria multi-tenant completa.

### Continuidade
- Módulo 11: **ENCERRADO**;
- Módulo 12: **ENCERRADO**;
- Módulo 13: **NÃO INICIADO**;
- próximo módulo oficial: **Módulo 13 — Segurança, Firestore, performance e telemetria**.


## FECHAMENTO 2026-09-25 — MÓDULO 13

### Baseline real
- branch: `feat/adm-deposito-phase-11-5-visual-ux`;
- HEAD inicial confirmado: `0c35f723c87b366d2b50b3b511d0e8e356115d75`;
- HEAD conhecido e HEAD real eram idênticos;
- nenhum commit posterior legítimo precisou ser reconciliado.

### Segurança
- founder-only confirmado no gate cliente, API/server e Firestore Rules;
- workspace piloto permanece `hgesm-aprov`, UG `160416`;
- setores externos continuam sem leitura/escrita no namespace warehouse;
- material canônico não pode mais ser apagado fisicamente;
- ledger continua append-only;
- saldos agregado e por localização continuam protegidos por movimento/revisão;
- relatórios não ganharam caminhos de escrita;
- nenhuma Rule operacional do Core foi aberta para atender o ADM.

### Firestore / performance
- nenhuma consulta por hover;
- nenhum listener realtime novo;
- consultas principais continuam bounded;
- `listWarehouseMovementsForMaterial` continua bounded e ordena em memória, sem índice composto preventivo;
- Estoque passou a indexar locationBalances/lots/barcodes por material antes de derivar cards;
- Inventário reutiliza o mesmo lote de materiais já carregado para derivar saldo sem localização, eliminando uma leitura duplicada de até 500 materiais por abertura;
- layout continua limitado a 160 objetos;
- SISCOFIS continua limitado a 500 linhas por importação/snapshot;
- itens de inventário permanecem em subcoleção, não em array crescente dentro da sessão;
- `firestore.indexes.json` não existe na branch e nenhum índice foi criado no Módulo 13.

### Resiliência
- falha em Inventários, SISCOFIS ou Configurações como fonte auxiliar do Dashboard gera estado degradado explícito;
- dados principais permanecem visíveis quando possível;
- alertas existentes não são resolvidos automaticamente enquanto o contexto estiver degradado;
- reconciliação de alertas permanece best-effort;
- Core EMPROVEX continua independente do ADM.

### Telemetria
- criado `lib/warehouse/telemetry.ts` como adaptador best-effort para a infraestrutura existente `workspaceUsageTelemetry`;
- leituras de snapshots bounded nos repositories principais passam a registrar contagem estimada;
- reconciliações de alertas registram writes estimados;
- nenhum acesso Firestore paralelo foi criado pela telemetria;
- nenhuma gravação por render/interação foi adicionada;
- flush continua bufferizado pela infraestrutura existente.

### Guard/testes preparados
- novo `scripts/verify-adm-deposito-phase-13.mjs`;
- `package.json` registra `verify:adm-deposito-phase-13`;
- Application CI passa a incluir o guard quando a campanha oficial for executada;
- suíte multi-tenant ganhou cenário que nega delete físico de material;
- guard da FASE 1 passou a exigir esse cenário.

### Validação conforme D-057
Neste módulo foi feita auditoria estática direcionada e validação do conteúdo consolidado. Deliberadamente não foram disparados:
- Application CI;
- build global;
- TypeScript global;
- Firestore Emulator completo;
- Browser E2E completo;
- regressão EMPROVEX/ADM completa.

Essas baterias pertencem ao Módulo 14.

### Continuidade
- Módulo 13: **ENCERRADO**;
- Módulo 14: **NÃO INICIADO**;
- expansão externa: **NÃO AUTORIZADA**;
- publicação/merge: **NÃO REALIZADOS**.


## PLANEJAMENTO 2026-09-25 — MÓDULO 14 AUDITADO E REGISTRADO

Estado:
- Módulo 13: **ENCERRADO**;
- Módulo 14: **PLANEJADO / NÃO INICIADO**;
- branch: `feat/adm-deposito-phase-11-5-visual-ux`;
- baseline confirmada: `2d8160db956296779bcf86c7040829776d4e20ef`;
- comparação branch x baseline: idêntica, sem commits posteriores.

Documento oficial:
- `docs/adm-deposito/MODULE_14_FINAL_VALIDATION_PLAN.md`.

A auditoria preparatória confirmou que o repositório já possui ampla cobertura de domínio/guards do ADM e suíte multi-tenant.

Pendências de cobertura a tratar no Módulo 14:
- preparar/rodar jornada Browser E2E específica do ADM, pois o E2E genérico atual não contém referências identificáveis às novas superfícies warehouse;
- executar obrigatoriamente `verify:adm-deposito-phase-11-5` localmente e avaliar sua presença na certificação remota final.

Ordem de campanha aprovada:
- gates rápidos;
- domínio;
- TypeScript;
- Emulator/security;
- walking skeleton;
- build;
- E2E ADM;
- regressão EMPROVEX/ADM;
- correções consolidadas;
- regressão final;
- PR/Application CI.

Execução local deverá usar PowerShell de forma consolidada e evitar comando monolítico excessivamente grande. GitHub CI será certificação final. Cloud Shell somente quando houver necessidade remota real.

Nenhum teste pesado, PR, merge, deploy ou expansão externa foi realizado por este registro documental.


## PRIORIDADE OPERACIONAL REGISTRADA — 2026-09-25

Decisão do fundador:
- foco atual: terminar o ADM Depósito;
- depois: bateria dedicada de testes e melhorias do ADM;
- em seguida: pacote de hardening de segurança de dados do EMPROVEX.

Estado:
- conclusão ADM/Módulo 14: **PRIORIDADE ATUAL**;
- estabilização e melhoria pós-ADM: **PLANEJADA**;
- hardening transversal de segurança: **PLANEJADO**;
- base externa atual: pequena, com um usuário externo;
- expansão ampla: não autorizada automaticamente.

A auditoria preventiva de segurança não apontou evidência de vazamento ativo, mas gerou um backlog de hardening que deve ser retomado após a estabilização do ADM. Vulnerabilidade crítica confirmada é exceção e interrompe a fila normal.

Plano oficial:
`docs/adm-deposito/POST_ADM_STABILIZATION_AND_SECURITY_PLAN.md`

## MÓDULO 14.0 + 14.1 — CONCLUÍDOS EM 2026-09-25

Baseline oficial de entrada da campanha:
`88dff395649f7700f2c9c080ba9d7de0acf13ae9`.

Resultado:
- 14.0 — baseline congelada: **CONCLUÍDO**;
- 14.1 — auditoria estática final: **CONCLUÍDO**;
- 14.2+ — **NÃO INICIADOS**;
- nenhum teste dinâmico, build, Emulator, E2E, CI, PR, merge ou deploy foi executado;
- nenhum arquivo funcional/Rule/API/dependência foi alterado.

Relatório oficial:
`docs/adm-deposito/MODULE_14_STATIC_AUDIT.md`.

Gate estático: **B — autorizado avançar para 14.2 quando PowerShell estiver disponível**, sem alegar aprovação de testes dinâmicos.

Achados não bloqueantes principais:
- jsPDF 2.5.2 em faixas com advisories de 2026, sem caminho explorável confirmado nesta inspeção;
- CSP ausente;
- App Check client-side presente, enforcement do Console não verificável;
- `security_spec.md` desatualizado para o modelo workspace/UG;
- leitura pública deliberada de `settings/global` exige disciplina para permanecer somente com dados públicos.

A produção real não pôde ser vinculada a um SHA com a integração Vercel disponível; branch, `main` e produção continuam estados distintos.

## DECISÃO DE PUBLICAÇÃO E EXPANSÃO — 2026-09-25

Estado autorizado para o encerramento atual:
- ADM Depósito em produção: **FOUNDER-ONLY**;
- usuários externos: **SEM ACESSO AO ADM POR PADRÃO**;
- publicação na Vercel não autoriza abertura externa;
- testes e ajustes pós-publicação serão realizados primeiro pela conta fundadora.

Planejamento posterior:
- criar no Admin um controle individual `ADM Depósito habilitado` por usuário externo;
- controle externo deve iniciar desativado;
- habilitação deve liberar navegação e rota somente para o usuário autorizado;
- desabilitação deve retirar ambos os acessos;
- autorização de um usuário não pode afetar os demais;
- implementação futura deve ser testada contra acesso direto, isolamento workspace/UG e multi-tenant antes de qualquer piloto externo.

Referência: **D-071** em `docs/adm-deposito/DECISIONS.md`.

Esta atualização é documental. O modelo de acesso atual continua founder-only e nenhuma expansão externa foi executada.

## MÓDULO 14 — REGRESSÃO LOCAL FINAL APROVADA — 2026-09-25

Estado atual:
- 14.0 baseline: **CONCLUÍDO**;
- 14.1 auditoria estática: **CONCLUÍDO**;
- 14.2 gates rápidos: **CONCLUÍDO**;
- 14.3 domínio ADM: **CONCLUÍDO**;
- 14.4 TypeScript: **CONCLUÍDO**;
- 14.5 Emulator/multi-tenant: **CONCLUÍDO**;
- 14.6 walking skeleton integrado: **CONCLUÍDO**;
- 14.7 build: **CONCLUÍDO**;
- Browser E2E específico ADM: **CONCLUÍDO**;
- regressão local final EMPROVEX + ADM: **APROVADA**;
- Application CI final: **PENDENTE**;
- merge/deploy: **NÃO REALIZADOS**.

Resultados consolidados:
- domínio completo da campanha: **91/91**;
- regressão de domínio final principal: **85/85**;
- walking skeleton integrado: **70/70**;
- TypeScript: **0 erros**;
- multi-tenant: **244/244**;
- homeSnapshot: **1/1**;
- build Next.js 15.5.24: **PASS**, 24/24 páginas estáticas;
- Browser E2E: **21/21**, 0 falhas, code 0;
- Core Protection e isolamento EMPROVEX/ADM: verdes.

Nenhuma regressão real bloqueante permanece conhecida na estação local.

Próximo passo obrigatório:
**certificação remota via PR + Application CI**, após revisão do diff final.

O ADM Depósito permanece founder-only. A futura liberação granular por usuário externo continua registrada em D-071 e não faz parte da certificação atual.

## ESTRATÉGIA DE PUBLICAÇÃO DO FECHAMENTO — 2026-09-25

Após a certificação final do Módulo 14, a publicação do ADM Depósito seguirá D-072:

- a PR de fechamento deverá preferir **Squash and Merge**;
- os muitos commits históricos da branch não serão publicados individualmente na Vercel;
- a `main` receberá um único commit consolidado representando o estado final certificado;
- evitar novos commits pequenos na `main` entre o merge e a publicação;
- preferir publicação única/controlada em produção;
- quando útil, executar `vercel build --prod` antes e publicar o artefato validado com `vercel deploy --prebuilt --prod`;
- a economia de cota da Vercel não autoriza bypass de CI, segurança ou E2E;
- após deploy, validar produção com a conta fundadora;
- ADM permanece founder-only durante a estabilização inicial, conforme D-071.

Objetivo operacional: permitir a publicação integral das melhorias acumuladas do ADM sem transformar cada commit histórico em um deployment separado.

## REABERTURA CONTROLADA DA FASE 9 — CROQUI OPERACIONAL v2

Data: 2026-09-25.

Motivo:
- a regressão local completa chegou a 21/21 no Browser E2E;
- no GitHub Actions/Linux, a Fase 9 apresentou falhas visuais recorrentes e não determinísticas de sobreposição/visibilidade;
- Core Protection, Recovery, validate-application, segurança multi-tenant, domínio, TypeScript, build e demais jornadas permaneceram aprovados;
- decidiu-se não continuar adicionando workarounds ao teste/interface antiga.

Estado oficial:
- Fase 9 antiga — domínio: **PRESERVADO**;
- Fase 9 antiga — UI: **SUPERSEDIDA**;
- Fase 9 v2: **EM DESENVOLVIMENTO — 9.0 a 9.3 CONCLUÍDOS**;
- Módulo 14: **PAUSADO NA CERTIFICAÇÃO REMOTA**;
- merge: **NÃO AUTORIZADO**;
- deploy: **NÃO REALIZADO**;
- acesso ADM: **FOUNDER-ONLY**.

Plano aprovado:
- 9.0 auditoria/congelamento;
- 9.1 estrutura da tela;
- 9.2 Visualizar/Localizar;
- 9.3 destaque operacional;
- 9.4 Editor v2;
- 9.5 persistência/versionamento;
- 9.6 UX/estabilidade;
- 9.7 testes específicos;
- 9.8 integração/regressão;
- 9.9 fechamento/certificação.

Invariantes:
- `warehouse_depot_layout_v1` continua único contrato persistido do croqui;
- croqui não altera saldos ou ledger;
- nenhum novo domínio quantitativo será criado;
- Core EMPROVEX permanece independente;
- workspace/UG e founder-only permanecem inalterados;
- sem Application CI completo durante 9.0–9.6;
- certificação ampla somente após 9.7–9.9.

Referência: **D-073** em `docs/adm-deposito/DECISIONS.md`.

## FECHAMENTO DOS MÓDULOS 9.0 E 9.1 — FASE 9 v2

Data: 2026-09-25.

### Estado inicial

- branch: `feat/adm-deposito-phase-11-5-visual-ux`;
- HEAD inicial auditado: `6642a3cbd37e17352a83bb330ad99cdbb0449381`;
- branch estava 241 commits à frente da `main` e 0 atrás;
- D-073 confirmada;
- Fase 9 antiga: domínio preservado e UI supersedida;
- Módulo 14 continua pausado na certificação remota;
- merge/deploy não autorizados.

### Módulo 9.0 — CONCLUÍDO

Arquivos/domínios auditados:
- `WarehouseDepotViewOperational`;
- `WarehouseDepotLayoutEditor`;
- `WarehouseDepotsOperational`;
- rota `Meus Depósitos`;
- `layoutRepository`;
- repositories de depósitos/localizações, materiais e lotes;
- contrato/renderização de `warehouse_depot_layout_v1`;
- guard permanente da Fase 9;
- Browser E2E histórico da Fase 9;
- documentação oficial e Core Protection.

Matriz de reaproveitamento:
- `warehouse_depot_layout_v1`: **PRESERVAR**;
- `layoutRepository`: **PRESERVAR**;
- depósitos/localizações/materiais/lotes e FEFO consultivo: **PRESERVAR**;
- `WarehouseDepotLayoutEditor`: **REUTILIZAR COM ADAPTAÇÃO**;
- pesquisa + seletor + edição na mesma faixa dinâmica: **SUBSTITUIR NA UI**;
- saldos, locationBalances, ledger, Firestore Rules e Core: **NÃO TOCAR**.

Acoplamentos encontrados:
- `selectedDepotId`, `queryText`, `selectedMaterialId` e `mode` viviam no mesmo componente operacional;
- o layout ativo/histórico já era carregado por depósito e foi preservado;
- FEFO já era derivado somente para consulta e foi preservado;
- a fragilidade estava na composição visual: pesquisa e seletor compartilhavam o mesmo cartão/flex e a lista de resultados alterava a geometria da faixa superior.

Gate 9.0:
- contratos preservados: **SIM**;
- bloqueio arquitetural: **NÃO**;
- autorização para 9.1: **SIM**.

### Módulo 9.1 — CONCLUÍDO

Criado:
- `features/warehouse/components/WarehouseDepotCroquis.tsx`.

Refatorado:
- `features/warehouse/components/WarehouseDepotViewOperational.tsx`;
- `scripts/verify-adm-deposito-phase-9.mjs`.

Estrutura resultante:
- `WarehouseDepotSelector`;
- `WarehouseCroquiModeSwitch`;
- `WarehouseCroquiViewMode`;
- `WarehouseCroquiEditMode`;
- `WarehouseCroquiMainRegion`;
- canvas/editor existentes preservados.

Estabilidade geométrica:
- seletor em container próprio;
- modo consulta e modo edição não dividem a mesma superfície dinâmica;
- resultados de pesquisa com altura limitada e scroll interno;
- `min-w-0` nas regiões críticas;
- sem overlay/absolute/fixed em controles operacionais;
- seletor independente da altura da pesquisa;
- editor não contém a pesquisa de materiais.

Compatibilidade preservada:
- rota `Meus Depósitos → Croquis`;
- redirects existentes;
- acesso founder-only;
- depósitos existentes;
- layouts ativos e históricos;
- versões antigas;
- `warehouse_depot_layout_v1`;
- `warehouseLocationId`;
- FEFO consultivo.

Segurança/domínio:
- Firestore Rules: **NÃO ALTERADAS**;
- nova coleção/schema/índice: **NÃO**;
- `warehouse_balance_v1`: **NÃO ALTERADO**;
- `warehouse_location_balance_v1`: **NÃO ALTERADO**;
- `warehouse_movement_v1`: **NÃO ALTERADO**;
- Core EMPROVEX: **NÃO ALTERADO**;
- workspace/UG: **PRESERVADOS**;
- founder-only: **PRESERVADO**.

Validação:
- auditoria estática e inspeção dos imports/contratos: realizadas;
- guard estrutural da Fase 9 atualizado para proteger a nova composição;
- Application CI completo: **NÃO EXECUTADO**, conforme D-073;
- Browser E2E completo: **NÃO EXECUTADO**, conforme D-073;
- regressão global: **NÃO EXECUTADA**, conforme D-073;
- nenhuma aprovação dinâmica foi presumida sem evidência.

Commits:
- `2283a9f8e7f06cea4713f3d90c21c3bfe69f52cd` — estrutura base do Croqui v2;
- `7549ab75f5131b38f73f291f928b3d88fa70616a` — separação de seleção e modos;
- `74d051f30cbd5687843282fe813c56a2dc55fade` — guard estrutural;
- fechamento documental registrado em commits subsequentes.

Estado:
- Módulo 9.0: **CONCLUÍDO**;
- Módulo 9.1: **CONCLUÍDO**;
- Fase 9 v2: **EM DESENVOLVIMENTO**;
- Módulo 14: **PAUSADO**;
- Merge: **NÃO REALIZADO**;
- Deploy: **NÃO REALIZADO**;
- Próximo módulo: **9.2 — Visualizar / Localizar**.

Próximo trabalho oficial:
**Fase 9 v2 — Módulo 9.4, Editor de Croqui v2.**


## FECHAMENTO DOS MÓDULOS 9.2 E 9.3 — FASE 9 v2

Data: 2026-09-25.

### Estado inicial

- branch: `feat/adm-deposito-phase-11-5-visual-ux`;
- HEAD inicial confirmado antes da implementação: `efd7fba8da19e91a277ff2724a04d365aaaf9574`;
- baseline coincidia exatamente com o fechamento de 9.0/9.1;
- D-073 confirmada;
- Módulo 14 permaneceu pausado;
- merge/deploy não autorizados.

### Módulo 9.2 — CONCLUÍDO

Arquitetura/UX:
- o modo **Visualizar / Localizar** permanece separado do seletor de depósito e do editor;
- a busca continua usando o conjunto bounded de materiais já carregado;
- filtro é realizado em memória por descrição, aliases e ID técnico;
- resultados possuem altura limitada e scroll interno;
- nenhuma lista principal usa `position: absolute`;
- seleção é feita por clique explícito e não depende de hover;
- material selecionado possui resumo operacional.

Estados tratados:
- material sem saldo positivo: mensagem clara e nenhum destaque;
- `UNASSIGNED`: quantidade apresentada como estoque sem posição física;
- múltiplas posições: todas consideradas;
- múltiplos depósitos: resumo preserva a existência das demais posições;
- troca de depósito: destaque passa a ser recalculado para o depósito atual.

Gate 9.2:
- Pesquisa: **OK**;
- Resultados bounded: **OK**;
- Seleção estável: **OK**;
- Sem mutação de estoque: **OK**;
- Sem sobreposição estrutural com seletor: **OK**;
- Autorização para 9.3: **SIM**.

### Módulo 9.3 — CONCLUÍDO

Fonte das posições:
- `warehouse_location_balance_v1`;
- somente `quantity > 0`;
- ponte visual oficial: `warehouseLocationIdForPosition(...)`;
- nenhum segundo algoritmo concorrente de identidade visual foi criado.

Filtro por depósito:
- somente posições cujo `position.depotId` corresponde ao depósito atual entram no conjunto de destaque;
- posições do mesmo material em outros depósitos permanecem informativas no resumo.

Destaque e cobertura visual:
- todas as posições reais do depósito atual vinculadas a objetos do layout são destacadas;
- objetos não relacionados são apenas atenuados visualmente;
- localização física válida sem objeto correspondente continua aparecendo no resumo;
- nenhum objeto é criado automaticamente;
- `UNASSIGNED` nunca recebe representação visual.

FEFO:
- continua sendo apenas recomendação consultiva;
- reutiliza `selectWarehouseFefoLot`;
- FEFO do depósito atual pode receber diferenciação visual própria;
- FEFO em outro depósito gera informação textual, sem destaque falso no canvas atual;
- FEFO em `UNASSIGNED` é informado como sem posição física.

Canvas:
- modo Visualizar / Localizar permanece read-only;
- nenhuma seleção de material altera geometria;
- nenhuma ação de consulta salva layout;
- drag/resize/rotate continuam pertencendo ao editor, não ao modo consulta.

### Segurança e domínio

- Firestore Rules: **NÃO ALTERADAS**;
- workspace/UG: **PRESERVADOS**;
- founder-only: **PRESERVADO**;
- Core EMPROVEX: **NÃO ALTERADO**;
- `warehouse_balance_v1`: **NÃO ALTERADO**;
- `warehouse_location_balance_v1`: somente leitura;
- `warehouse_movement_v1`: **NÃO ALTERADO**;
- `warehouse_depot_layout_v1`: somente leitura no modo consulta;
- nova coleção/schema/índice: **NÃO**.

### Performance

- listeners novos: **0**;
- polling novo: **0**;
- leitura Firestore por tecla: **0**;
- leitura Firestore por hover: **0**;
- filtros: em memória;
- engine gráfica adicional: **NÃO**;
- animação contínua nova: **NÃO**.

### Testes executados na estação PowerShell do fundador

1. `npm.cmd run test:adm-deposito-depot-locator`
   - 4 testes;
   - 4 PASS;
   - 0 falhas.

Cenários comprovados:
- saldo positivo + separação de `UNASSIGNED`;
- destaque somente no depósito atual;
- preservação das posições de outros depósitos no resumo;
- material sem saldo positivo;
- cobertura visual somente por objetos com `warehouseLocationId`.

2. `npm.cmd run verify:adm-deposito-phase-9`
   - resultado: **ADM Depósito FASE 9 guard: PASS**.

3. `npm.cmd run typecheck`
   - resultado: **PASS**;
   - TypeScript: **0 erros**.

Também observado no GitHub:
- EMPROVEX Core Protection automático: **PASS**;
- Recovery guardrails automático: **PASS**;
- Application CI foi disparado automaticamente pela configuração da PR após push, embora D-073 determine que ele não é gate destes submódulos; não foi usado como requisito para declarar 9.2/9.3 concluídos.

### Commits funcionais principais

- `01a0f7c8821f1b60bfbd7620ccc7d56003d87216` — localizar materiais por posição física;
- `f8697529ed0758f70ddc4d199d8c58568aa87226` — isolar derivação de localização;
- `ffc346ac8489737c0573f29b40d483c707077640` — usar projeção testável de posições;
- `e1c612d91c7d81da244bc2992867e8f71a5116ee` — testes de localização e destaque;
- `d63f7f25b9e994a3ae9a0e2872204c47a7da3aba` — registrar comando de teste;
- `62c0eeae57ffe3e416860f44e53e0bef7fe70175` — reforçar guard permanente da Fase 9.

### Estado final

- Módulo 9.2: **CONCLUÍDO**;
- Módulo 9.3: **CONCLUÍDO**;
- Fase 9 v2: **EM DESENVOLVIMENTO**;
- Módulo 14: **PAUSADO**;
- Merge: **NÃO REALIZADO**;
- Deploy: **NÃO REALIZADO**;
- Próximo módulo: **9.4 — Editor de Croqui v2**.

## FECHAMENTO DOS MÓDULOS 9.4, 9.5 E 9.6 — FASE 9 v2

Data: 2026-09-25.

### Estado inicial

- branch: `feat/adm-deposito-phase-11-5-visual-ux`;
- baseline funcional de entrada: `4c265d420742c998570766bc0e15f4a1759b5f79`;
- Módulos 9.2 e 9.3: **CONCLUÍDOS**;
- D-073 preservada;
- Módulo 14: **PAUSADO NA CERTIFICAÇÃO REMOTA**;
- merge/deploy: **NÃO AUTORIZADOS / NÃO REALIZADOS**;
- acesso ADM: **FOUNDER-ONLY**.

### Módulo 9.4 — Editor de Croqui v2 — CONCLUÍDO

Entregas:
- editor dedicado continua separado da pesquisa/localização de materiais;
- operações de geometria e propriedades permanecem locais até salvamento explícito;
- histórico de undo/redo foi unificado entre canvas e painel de propriedades;
- duplicar/colar objeto remove o vínculo `warehouseLocationId` da cópia;
- o painel impede novo vínculo com localização real já representada por outro objeto;
- validação pré-save também recusa vínculos duplicados;
- campos geométricos são limitados aos bounds lógicos do canvas;
- cancelar edição descarta o draft e retorna ao modo de consulta.

### Módulo 9.5 — Persistência e versionamento — CONCLUÍDO

Entregas:
- `warehouse_depot_layout_v1` continua sendo o único contrato persistido;
- histórico e versão ativa foram preservados;
- salvamento permanece transacional e versionado;
- foi criada leitura estrita do layout ativo para o caminho de pré-salvamento;
- falha de leitura não pode mais degradar para `null` e produzir falsa primeira versão;
- referências duplicadas de `warehouseLocationId` são bloqueadas no repository;
- nenhuma escrita em `warehouse_balance_v1`, `warehouse_location_balance_v1`, `warehouse_movement_v1` ou estoque foi adicionada;
- restauração histórica continua produzindo nova versão em vez de sobrescrever histórico.

### Módulo 9.6 — UX e estabilidade visual — CONCLUÍDO

Entregas:
- layout do editor passa a empilhar painel/canvas em larguras menores e usar colunas apenas em telas muito amplas;
- toolbar e viewport receberam estrutura estável e testável;
- viewport usa altura responsiva limitada;
- painel de propriedades possui rolagem controlada;
- controles críticos receberam `aria-label`;
- estado transitório do editor é resetado ao mudar o contexto;
- nenhuma engine gráfica adicional, listener, polling ou animação contínua foi introduzida.

### Arquivos funcionais/testes alterados neste bloco

- `features/warehouse/components/WarehouseDepotLayoutEditor.tsx`;
- `features/warehouse/components/WarehouseDepotViewOperational.tsx`;
- `lib/warehouse/layoutRepository.ts`;
- `scripts/warehouse-depot-layout.test.mjs`;
- `scripts/verify-adm-deposito-phase-9.mjs`.

### Segurança e arquitetura preservadas

- Firestore Rules: **NÃO ALTERADAS**;
- novos índices/schemas quantitativos: **NÃO**;
- Core EMPROVEX: **NÃO ALTERADO**;
- workspace/UG: **PRESERVADOS**;
- founder-only: **PRESERVADO**;
- saldo/ledger: **NÃO ALTERADOS**;
- `warehouse_depot_layout_v1`: **PRESERVADO**;
- croqui continua representação visual, não fonte de quantidade.

### Validação executada na estação PowerShell do fundador

1. `npm.cmd run test:adm-deposito-depot-layout`
   - **14/14 PASS**;
   - 0 falhas.

2. `npm.cmd run verify:adm-deposito-phase-9`
   - **ADM Depósito FASE 9 guard: PASS**.

3. `npm.cmd run typecheck`
   - **PASS**;
   - TypeScript: **0 erros**.

Conforme D-073:
- Browser E2E específico: **NÃO EXECUTADO NESTE BLOCO** — reservado ao Módulo 9.7;
- regressão ampla: **NÃO EXECUTADA**;
- Application CI global: **NÃO UTILIZADO COMO GATE**;
- nenhum CI global foi disparado manualmente para certificar 9.4–9.6.

### Estado final

- Módulo 9.4: **CONCLUÍDO**;
- Módulo 9.5: **CONCLUÍDO**;
- Módulo 9.6: **CONCLUÍDO**;
- Fase 9 v2: **EM DESENVOLVIMENTO — 9.0 a 9.6 CONCLUÍDOS**;
- Módulo 9.7: **NÃO INICIADO**;
- Módulo 14: **PAUSADO**;
- Merge: **NÃO REALIZADO**;
- Deploy: **NÃO REALIZADO**.

Próximo trabalho oficial:
**Fase 9 v2 — Módulo 9.7, testes específicos do Croqui Operacional v2.**



## FASE 9 v2 — Módulo 9.7 — decisão operacional sobre Browser E2E

Data: 2026-09-25.

Validações específicas já aprovadas na estação PowerShell do fundador:
- `npm.cmd run test:adm-deposito-depot-locator` — **7/7 PASS**;
- `npm.cmd run test:adm-deposito-depot-layout` — **16/16 PASS**;
- `npm.cmd run verify:adm-deposito-phase-9` — **PASS**;
- `npm.cmd run typecheck` — **PASS / 0 erros**.

Browser E2E:
- a execução automatizada específica do Croqui foi interrompida durante o refinamento dos cenários de teste;
- não foi identificada falha de integridade do Croqui que justificasse alteração de Rules, schema, saldo, ledger ou Core EMPROVEX;
- por decisão operacional do fundador, o Browser E2E do Croqui será **ADIADO** para a validação da versão já integrada à `main`, com operação acompanhada pelo próprio fundador;
- este adiamento **não deve ser registrado como PASS** e também **não deve ser tratado como falha funcional comprovada**;
- até essa validação na `main`, permanece pendente apenas o gate visual/operacional de navegador do Módulo 9.7.

Impacto no fluxo:
- os gates locais não-browser do 9.7 permanecem válidos;
- o desenvolvimento pode seguir para o **Módulo 9.8 — integração/regressão**, preservando a pendência explícita do Browser E2E para a `main`;
- merge/deploy continuam **NÃO REALIZADOS / NÃO AUTORIZADOS** neste registro.


## FECHAMENTO CONSOLIDADO — MÓDULOS 9.8 E 9.9 — FASE 9 v2

Data: 2026-09-25.

### Módulo 9.8 — Integração/regressão ADM — CONCLUÍDO

Revalidação integrada executada no Application CI da PR #187:
- Fase 6 — locations/transfers: **PASS**;
- Fase 6 — permanent guard: **PASS**;
- Fase 7 — estoque/lotes/FEFO: **PASS**;
- Fase 7 — permanent guard: **PASS**;
- Fase 8 — barcode/saída: **PASS**;
- Fase 8 — permanent guard: **PASS**;
- Fase 9 — depot layout: **PASS**;
- Fase 9 — permanent guard: **PASS**;
- Fase 10 — inventário físico: **PASS**;
- Fase 10 — permanent guard: **PASS**;
- Fases 11, 11.5 e Módulo 13: **PASS**;
- multi-tenant Firestore security: **PASS**;
- production multi-tenant readiness: **PASS**.

Auditoria de integração/performance:
- listeners novos no Croqui: **0**;
- polling novo: **0**;
- leitura Firestore por tecla/hover: **0**;
- UI do Croqui sem acesso direto ao Firestore;
- persistência Firestore continua encapsulada no `layoutRepository`;
- workspace/UG e founder-only: **PRESERVADOS**;
- autoridade de estoque permanece fora do Croqui.

### Módulo 9.9 — Fechamento/certificação — CONCLUÍDO TECNICAMENTE

Baseline oficial da reabertura controlada:
- `6642a3cbd37e17352a83bb330ad99cdbb0449381`.

Diff auditado até o fechamento:
- 30 commits à frente do baseline e 0 atrás no ponto da auditoria;
- mudanças funcionais restritas a componentes do Croqui, `depotLocator`, `layoutRepository`, testes e infraestrutura de teste;
- documentação atualizada em `ROADMAP.md` e `STATUS.md`;
- `firestore.rules`: **NÃO ALTERADO**;
- índices Firestore: **NÃO ALTERADOS**;
- schemas quantitativos: **NÃO CRIADOS**;
- Auth/sessões: **NÃO ALTERADOS**;
- Empenhos/NF/Comissão/Tesouraria/Cronograma: **NÃO ALTERADOS**;
- `warehouse_balance_v1`, `warehouse_location_balance_v1` e `warehouse_movement_v1`: autoridade preservada;
- `warehouse_depot_layout_v1`: permanece o único contrato persistido do Croqui.

Certificação remota — Application CI run #765:
- job principal `validate-application`: **SUCCESS**;
- Production build: **PASS**;
- Final TypeScript validation: **PASS**;
- Diff hygiene: **PASS**;
- EMPROVEX Core Protection automático: **PASS**;
- Recovery guardrails automático: **PASS**.

### Browser E2E — pendência deliberada para a main

Por decisão operacional do fundador:
- o Browser E2E/validação visual do Croqui não é requisito de fechamento desta branch;
- a validação será feita após integração à `main`, com o fundador operando junto;
- esta pendência não é registrada como PASS nem como falha funcional;
- qualquer execução automática de Browser E2E no workflow atual não substitui a validação operacional acordada na `main`.

### Estado final da Fase 9 v2

- Módulos 9.0–9.6: **CONCLUÍDOS**;
- Módulo 9.7: **CONCLUÍDO NOS GATES NÃO-BROWSER; E2E OPERACIONAL DIFERIDO PARA A MAIN**;
- Módulo 9.8: **CONCLUÍDO**;
- Módulo 9.9: **CONCLUÍDO TECNICAMENTE**;
- Fase 9 v2: **FECHADA TECNICAMENTE, COM VALIDAÇÃO VISUAL/OPERACIONAL CONTROLADA PENDENTE NA MAIN**;
- Módulo 14: **PODE SER RETOMADO EM ETAPA PRÓPRIA**;
- merge: **NÃO REALIZADO**;
- deploy: **NÃO REALIZADO**;
- acesso ADM: **FOUNDER-ONLY**.

Próximo passo autorizado pela memória oficial:
- retomar o Módulo 14 em fluxo próprio, sem confundir essa retomada com merge/deploy;
- quando houver decisão explícita de integração à `main`, realizar a validação visual/operacional do Croqui com o fundador antes da publicação definitiva.


## MÓDULO 14 — RETOMADA E FECHAMENTO TÉCNICO — 2026-09-25

A certificação foi retomada após o fechamento técnico da Fase 9 v2.

Estado confirmado:
- 14.0 — baseline: **CONCLUÍDO**;
- 14.1 — auditoria estática: **CONCLUÍDO**;
- 14.2 — gates rápidos: **CONCLUÍDO**;
- 14.3 — domínio ADM: **CONCLUÍDO**;
- 14.4 — TypeScript: **CONCLUÍDO / 0 regressões**;
- 14.5 — Firestore Emulator + multi-tenant: **CONCLUÍDO**;
- 14.6 — walking skeleton: **CONCLUÍDO**;
- 14.7 — build de produção: **CONCLUÍDO**;
- regressão integrada ADM/Core: **CONCLUÍDA**;
- PR de fechamento: **#187 aberta**;
- Application CI #765 — `validate-application`: **SUCCESS**;
- EMPROVEX Core Protection: **SUCCESS**;
- Recovery guardrails: **SUCCESS**.

Browser E2E remoto:
- job específico: **FAILURE**;
- causa observada: timeout em `tests/e2e/warehouse-phase-9.spec.mjs` durante a jornada visual do Croqui;
- os demais gates técnicos não apontaram regressão de domínio associada;
- conforme D-074, essa pendência foi deslocada para validação controlada na `main`, com o fundador operando junto;
- não registrar como PASS.

Estado final do Módulo 14:
- **ENCERRADO TECNICAMENTE COM RELEASE GATE VISUAL PENDENTE NA MAIN**;
- merge: **NÃO REALIZADO**;
- deploy: **NÃO REALIZADO**;
- ADM: **FOUNDER-ONLY**;
- abertura para usuário externo: **NÃO AUTORIZADA**.

Próximo passo somente mediante decisão explícita do fundador:
1. preparar integração consolidada na `main` conforme D-072;
2. validar o Browser E2E/uso real do Croqui na `main` com o fundador;
3. somente após essa validação, decidir publicação em produção.


## PUBLICAÇÃO MODULAR DO ADM DEPÓSITO — INICIADA EM 2026-09-26

Motivação:
- a arquitetura funcional completa foi preservada;
- a tentativa de publicação integral das Firestore Rules revelou excesso de complexidade operacional no bloco warehouse, incluindo estouro do orçamento de expressões em fluxos integrados;
- não há decisão de reconstruir o domínio do zero.

Baseline congelada:
- branch: `archive/adm-deposito-full-2026-09`;
- commit: `5b7e6cdad09381ac6e0c6c62c4934e18357e6347`.

Branch ativa de modularização:
- `feat/adm-deposito-modular-release`.

Plano oficial:
- `docs/adm-deposito/MODULAR_RELEASE_PLAN.md`.

Estado:
- ADM-R1: **INICIADA**;
- R2–R5: **BLOQUEADAS até validação real da R1**;
- acesso externo: **NÃO AUTORIZADO**;
- estética nova: **PAUSADA**;
- prioridade: compilação/publicação das Rules mínimas e operação real da fundação independente.


## Atualização 2026-09-26 — Prévia 2.5D modular do Croqui

Implementada na branch `feat/adm-deposito-modular-release`:
- novo componente `WarehouseIsometricPreview.tsx`;
- alternância explícita entre **Edição 2D** e **Prévia 2.5D**;
- visão isométrica clara, leve e derivada do croqui atual;
- estruturas físicas posicionadas de acordo com as coordenadas do layout;
- caixas/volumes aparecem somente quando existe saldo físico positivo;
- consulta de item disponível dentro da prévia;
- Local correspondente recebe brilho/destaque;
- Subposição específica recebe marcador luminoso quando o saldo consultado está nela;
- materiais e saldos são carregados sob demanda ao abrir a prévia;
- nenhuma mutação quantitativa é executada pela visualização;
- fallback estrutural preservado quando o domínio quantitativo não puder ser lido.

Commits funcionais:
- `a8fe7dce23de36a3a41bb4513d4ee57b948a1f9e` — renderer isométrico;
- `dbbe30f080e8c6dd11ee9a218a97cdb3acb70bc4` — integração no Croqui, ocupação e consulta.


### Redesign isométrico 2.5D — 2026-09-26

Após validação visual do primeiro protótipo, a implementação foi reformulada:
- substituído o visual de cartões inclinados por renderer SVG isométrico;
- piso, paredes e volumes agora seguem projeção isométrica coerente;
- estantes/racks exibem níveis e estrutura metálica;
- paletes e equipamentos frios possuem representação volumétrica própria;
- caixas aparecem somente em posições com saldo físico positivo;
- destaque de consulta continua iluminando Local e Subposição;
- `locationBalances` ganhou leitura founder-only específica para a prévia, mantendo toda escrita bloqueada;
- teste de segurança direcionado atualizado para validar leitura do fundador, negação externa e negação de escrita.

Commits:
- `ba9cd5c49a44b7b81778b7317b3db693fb24fc16` — renderer isométrico;
- `08523406e52848f35cac3e460a43e17420952bbf` — leitura segura de locationBalances;
- `ae275e0e76a61601694f6a310afad6ea3b933997` — teste de segurança atualizado.


### Catálogo visual fixo — cinco elementos — 2026-09-26

Decisão aplicada na branch `feat/adm-deposito-modular-release`:
- seleção de tipo visual do croqui limitada a **Estante, Palete, Freezer, Geladeira industrial e Mesa**;
- aliases legados são normalizados para um desses cinco tipos;
- dimensões continuam livres dentro dos limites do croqui;
- Subposições continuam variáveis;
- porta permanece estrutural e fora do catálogo de Locais;
- objetivo: manter uma linguagem 2.5D uniforme para todos os usuários e concentrar o refinamento estético em cinco modelos profissionais.

Commit funcional:
- `ca7417505061839370b20efacdb079277b859866`.


### Realismo profissional dos cinco modelos — 2026-09-26

Implementado na branch `feat/adm-deposito-modular-release`:
- refinamento profundo dos cinco modelos oficiais da Prévia 2.5D;
- Estante, Palete, Freezer, Geladeira industrial e Mesa agora possuem geometria e materiais próprios;
- adição de decks, contraventamentos, longarinas, blocos, vidro, iluminação fria, painéis, ventilação, prateleiras e detalhes metálicos;
- piso e paredes receberam rodapés, marcações internas e acabamento mais coerente;
- continua sem WebGL/engine 3D pesada.

Commit funcional:
- `0666499de89598d8d95091eedbaac075362941da`.


### Motor visual premium 2.5D — 2026-09-26

A Prévia 2.5D foi reconstruída como motor visual operacional:
- biblioteca canônica de cinco modelos;
- sombras de contato por objeto;
- materiais diferenciados;
- Estantes com montantes perfurados, contraventamentos, decks e travessas;
- Paletes com ripas, longarinas e blocos inferiores;
- Freezers com tampa de vidro, painel, puxador e ventilação;
- Geladeiras industriais com portas de vidro, iluminação fria, prateleiras e painel;
- Mesas inox com tampo, prateleira inferior, pés e sapatas;
- porta estrutural ganhou representação metálica dedicada;
- ocupação em Estantes respeita Subposições individualmente;
- consulta de item atenua objetos não relacionados e ilumina o destino correto;
- profundidade de cena usa ordenação por X+Y e camada.

Commit funcional:
- `d5b704ebae9a77fa40d4d412abe28debdca7ddbd`.


## Cadastro de Itens — visualização por NF e encaminhamento por Pregão — 2026-09-27

Implementado na branch `feat/adm-deposito-modular-release`:
- a fila de Cadastro de Itens deixa de renderizar cada item de NF como unidade principal;
- a unidade principal de visualização passa a ser a **Nota Fiscal**;
- itens ficam recolhidos e aparecem somente em **Detalhar NF**;
- a NF exibe fornecedor, data, empenho, Pregão, quantidade de itens, itens a tratar, reconciliação e progresso;
- busca cobre NF, fornecedor, empenho, Pregão e descrição de item;
- filtro dedicado por **Pregão** foi adicionado;
- filtro por situação mantém foco em NFs a tratar, tratadas ou em reconciliação;
- quando um Pregão específico é selecionado, fica disponível a ação **Encaminhar Pregão**;
- Encaminhar Pregão possui dois modos:
  - mesmo depósito/localização/subposição para todos os itens pendentes das NFs carregadas daquele Pregão;
  - consumo imediato para um mesmo destino operacional e recebedor;
- o processamento em lote reutiliza os repositórios transacionais oficiais de alocação e consumo imediato;
- não há escrita direta de saldo fora do ledger;
- cada item é atômico e idempotente; falhas isoladas são apresentadas sem desfazer itens já concluídos;
- se a cobertura da fila estiver truncada, o encaminhamento integral do Pregão é bloqueado para não prometer tratamento incompleto.

Commit funcional inicial:
- `7cbd6d2f6dd94cb25fe21bd5e210c68587b92183`.


## Consumo imediato leve — 2026-09-27

O fluxo de consumo imediato foi simplificado para refletir a operação real:
- consumo imediato integral de um item ainda totalmente pendente **não é tratado como transferência nem como entrada seguida de saída de estoque**;
- nesse cenário o EMPROVEX não cria material canônico, movimento `INVOICE_ENTRY`, movimento `OUTBOUND`, saldo agregado ou `locationBalance`;
- a operação mantém somente:
  - o estado `warehouse_item_intake_v2`, encerrando a pendência;
  - um registro `warehouse_consumption_record_v1` para auditoria e SISCOFIS;
- o registro leve pode ter `movementId = null` e `materialId = null`, pois o material nunca ingressou no estoque;
- as Firestore Rules exigem que o registro de consumo imediato esteja ligado ao intake atualizado na mesma transação;
- quando o item já teve alocação ou consumo parcial anterior, o fluxo quantitativo completo continua sendo usado para não deixar saldo fantasma;
- o objetivo é reduzir leituras/escritas, latência e custo sem perder rastreabilidade.

Validação adicionada:
- teste de segurança direcionado cobre consumo imediato integral sem movimento de estoque;
- guard modular exige o helper de consistência do intake;
- `firestore.rules` permanece abaixo do orçamento interno de 200 KiB.


## Encaminhamento integral por Nota Fiscal — 2026-09-27

Implementado em Cadastro de Itens:
- cada card de NF que possui itens pendentes ganhou a ação **Encaminhar NF**;
- não é necessário abrir `Detalhar NF` para tratar a nota inteira;
- o encaminhamento da NF reutiliza o mesmo motor de lote do Pregão;
- modos disponíveis:
  - mesmo depósito/localização/subposição para todos os itens pendentes da NF;
  - consumo imediato para o mesmo destino operacional;
- somente os itens ainda pendentes/parcialmente tratados entram na ação;
- itens já concluídos não são processados novamente;
- a ação por NF não depende da cobertura global de outras NFs/Pregões, pois todos os itens da nota já estão contidos no documento canônico carregado;
- continuam disponíveis os três níveis de operação: Pregão, NF e item individual.

Commit funcional:
- `3731d0e713e59c084d046a10b24eaa41b8d34a7e`.


## Correção de falso conflito no encaminhamento em lote — 2026-09-27

- identificado falso `WAREHOUSE_ITEM_INTAKE_CONCURRENT_MODIFICATION` após a fila ultrapassar a janela global de 500 estados persistidos;
- causa: itens com estado já salvo podiam reaparecer na projeção canônica como `VIRTUAL_PENDING` quando seu documento de intake ficava fora da janela global;
- não foi aumentado o limite global, para evitar transformar cada abertura da tela em leitura massiva;
- antes de encaminhar NF ou Pregão, o sistema agora revalida sob demanda somente os `stateId` dos itens efetivamente selecionados, em lotes de até 30 IDs;
- itens já tratados são removidos da operação;
- itens parcialmente tratados entram com os quantitativos reais atuais;
- a transação continua mantendo a proteção de concorrência para alterações que ocorram depois da revalidação;
- commits funcionais: `a77d1b750d9df0ae720f8369c35b6bff007fbc6f` e `d61c3d9fda1ef985990bd0d95aaab5ffe77f02e3`.


### Complementação da fila após atingir 500 estados

- corrigido o caso em que a operação confirmava que os itens já estavam tratados, mas a NF continuava aparecendo como pendente após o refresh;
- quando a consulta global de `intakes` atinge 500 documentos, a fila agora identifica apenas as linhas canônicas ainda marcadas como não persistidas e consulta seus `stateId` exatos;
- os 500 estados já carregados não são relidos;
- o resultado complementado passa a alimentar diretamente a lista principal de NFs, evitando que itens tratados reapareçam como `VIRTUAL_PENDING`;
- preservada a estratégia de baixo consumo do Firestore, sem elevar indiscriminadamente o limite global;
- commit funcional: `7751c953cba6a70d88b1a95a3172761c72098e5d`.


## Remoção lógica de NF/Pregão da fila — 2026-09-27

- alterada a sistemática de tratamento coletivo da fila de NFs;
- ações de NF/Pregão passam a oferecer:
  - encaminhar para armazenamento;
  - remover da fila do ADM Depósito;
- removido o consumo imediato como opção coletiva de NF/Pregão;
- a remoção é lógica e persistente por NF, em `warehouse/{workspaceId}/queueExclusions`;
- remover da fila NÃO apaga a NF canônica, empenho ou recebimento;
- remover da fila NÃO cria material, consumo, movimento, saldo, lote ou barcode;
- Pregão é removido criando uma exclusão por NF pendente pertencente ao Pregão, preservando granularidade e idempotência;
- a leitura da fila consulta somente os IDs determinísticos das NFs carregadas, evitando varredura global da coleção de exclusões;
- o consumo imediato histórico e a operação individual permanecem preservados por compatibilidade;
- nova coleção protegida por Rules founder-only e contrato próprio;
- Rules permaneceram abaixo do orçamento interno de 200 KiB após reconstrução segura do arquivo.


### Ajuste de compilação das Firestore Rules — 2026-09-27

- a ativação do ruleset novo no Google Cloud Console retornou `400 Invalid Argument` após sucessivos `503` no compilador da Rules API;
- diagnóstico alinhado à documentação oficial do Firebase: o arquivo fonte pode permanecer abaixo de 256 KiB e ainda exceder o limite de 250 KiB do binário compilado;
- o helper novo `validWarehouseQueueExclusion` havia sido definido no escopo global das Rules, o que aumenta o custo de compilação por herança nos vários `match`;
- o helper foi movido para dentro de `match /queueExclusions/{exclusionId}`, preservando a mesma validação e restringindo sua compilação somente à coleção que o utiliza;
- nenhuma regra operacional existente foi relaxada;
- commits: `0cafb735148b27904a48c5eae0b03ad1ffcf0e22` e `dbdfd60a7d87e08d34b087007cb8fbfb6379007b`.


### Correção da reconstrução das Rules — 2026-09-27

- o primeiro ajuste de escopo local do validador de `queueExclusions` introduziu truncamento acidental no regex do ID e deixou o arquivo sintaticamente inválido;
- o arquivo foi reconstruído a partir do último estado válido anterior à quebra;
- removido o helper específico de `queueExclusions`;
- a validação passou a ficar inline apenas no `match /queueExclusions/{exclusionId}`, evitando herança/replicação de helper global;
- o regex `^qex_[a-f0-9]{64}$` foi restaurado integralmente;
- o arquivo voltou para aproximadamente 192 KiB, abaixo do orçamento interno de 200 KiB;
- nenhum domínio operacional foi reaberto e a exclusão continua restrita ao fundador do workspace piloto;
- commits: `eca90bd90e42a1e74555bdaffd8757f57802064c` e `d834bb72dd31ac42178682b9243e63640a617ce9`.


## Migração para database dedicado — iniciada em 2026-09-27

Infraestrutura criada:
- database: `emprovex-warehouse`;
- projeto: `gen-lang-client-0982077967`;
- região: `us-east1`;
- edição: `STANDARD`;
- modo: `FIRESTORE_NATIVE`;
- delete protection: habilitada;
- freeTier: false.

Preparação no repositório:
- `lib/firebase.ts` passa a expor `warehouseDb`;
- `firestore.warehouse.rules` contém as Rules exclusivas do ADM;
- `firebase.json` registra os dois databases;
- teste de segurança modular passa a usar `firebase.warehouse-security-test.json`;
- guard modular passa a validar `firestore.warehouse.rules`.

Ainda pendente:
1. validar localmente guard + Emulator no database nomeado;
2. publicar `firestore.warehouse.rules` em `emprovex-warehouse`;
3. migrar/verificar `warehouse/hgesm-aprov/*` do banco antigo;
4. trocar os repositories ADM de `db` para `warehouseDb`;
5. validar operação real founder-only;
6. somente então remover o bloco warehouse das Rules do banco principal.


## Migração database dedicado — cutover de repositories iniciado

Data: 2026-09-27.

Estado:
- database `emprovex-warehouse`: **CRIADO**;
- `lib/firebase.ts`: expõe `warehouseDb`;
- `firebase.json`: registra Rules separadas para o database principal e para `emprovex-warehouse`;
- `firestore.warehouse.rules`: Rules dedicadas do ADM preparadas;
- teste de segurança modular: configurado para o database nomeado;
- repositories puramente logísticos do ADM: **redirecionados para `warehouseDb`**;
- migrador controlado `scripts/migrate-warehouse-database.mjs`: **CRIADO**;
- comandos disponíveis:
  - `npm run warehouse:db:plan`;
  - `npm run warehouse:db:copy`;
  - `npm run warehouse:db:verify`.

Segurança do cutover:
- banco antigo permanece intacto e continua servindo como rollback;
- a migração não apaga documentos na origem;
- o migrador copia somente `warehouse/hgesm-aprov/*`;
- documentos já idênticos no destino são ignorados;
- verificação compara contagem e SHA-256 canônico por domínio;
- referências Firestore internas, se existirem, são remapeadas para o database de destino.

Pendências imediatas antes de operação real:
1. `typecheck` + guard modular + Emulator do database nomeado;
2. publicar `firestore.warehouse.rules` no `emprovex-warehouse`;
3. executar `warehouse:db:plan`, `warehouse:db:copy` e `warehouse:db:verify` no Cloud Shell;
4. validar visualmente o ADM com a conta fundadora;
5. revisar a ponte legada `invoiceIntegrationService.ts`, pois transações não podem atravessar os dois databases;
6. somente após o cutover validado retirar o bloco warehouse das Rules do banco principal.


## Auditoria da fundação multi-database — 2026-09-27

Auditoria executada diretamente na branch `feat/adm-deposito-modular-release`.

Constatações:
- a branch já havia avançado além do handoff inicial e continha a fundação do database dedicado;
- `db` continua apontando para o banco operacional principal;
- `warehouseDb` aponta explicitamente para `emprovex-warehouse`;
- `firebase.json` mantém configurações independentes de Rules para os dois databases;
- os repositories operacionais do ADM e `siscofisService.ts` estão direcionados para `warehouseDb`;
- a fila de Cadastro de Itens lê NF/Empenho canônicos no banco principal e combina essas leituras, fora de transação distribuída, com estados logísticos persistidos no `warehouseDb`;
- nenhuma transação Firestore válida precisa abranger os dois databases.

Correções aplicadas durante a auditoria:
1. o migrador passou a copiar e verificar também
   `warehouse/{workspaceId}/inventories/{inventoryId}/items/{itemId}`;
2. a comparação `plan/copy/verify` passou a projetar `referenceValue` da origem para o database de destino antes do SHA-256, preservando idempotência real;
3. a antiga ponte `invoiceIntegrationService.ts`, que aceitava `Transaction` externa e construía referências warehouse no `db` principal, foi aposentada como integração ativa e agora falha de forma explícita caso algum código legado tente reutilizá-la;
4. o guard modular passou a exigir:
   - `warehouseDb`;
   - repositories apontando para o database dedicado;
   - migração da subcoleção de itens de inventário;
   - normalização de referências Firestore;
   - ausência de imports de runtime da ponte transacional legada.

Commits da correção:
- `4c8eb10afee63aeb29a61973edf3628870107271` — migrador completo/idempotente;
- `5957e04e7354873fae69fe8148c3f8cf8e1bfae3` — bloqueio seguro da ponte transacional legada;
- `fd26f1949f42bfa92fc502fca06c296df0afb8ff` — guard da separação de databases.

### Fronteira operacional atual

Ainda **não remover** o namespace warehouse de `firestore.rules` do banco principal e **não apagar** os dados antigos.

Ordem de cutover:
1. validar TypeScript + guard + testes direcionados;
2. validar/publicar `firestore.warehouse.rules` exclusivamente em `emprovex-warehouse`;
3. executar migração `plan -> copy -> verify`;
4. validar o ADM com a conta fundadora usando o database dedicado;
5. manter a origem intacta durante a janela de rollback;
6. somente após validação real retirar o bloco warehouse do ruleset principal em alteração separada.

O deploy do aplicativo que efetiva o uso de `warehouseDb` não deve preceder a cópia/verificação dos dados atuais.


### Validação local da separação multi-database — PASS — 2026-09-27

Executado no PowerShell do ambiente de desenvolvimento:

- `npm.cmd run verify:adm-deposito-modular-r1` — **PASS**;
- `npm.cmd run test:adm-deposito-modular-r1-security` — **PASS**.

Resultados relevantes do guard:
- Meus Depósitos e Cadastro de Itens permanecem operacionais;
- `firestore.warehouse.rules` em aproximadamente 109,73 KiB, abaixo do orçamento interno de 200 KiB;
- repositories persistem exclusivamente em `warehouseDb`;
- migrador cobre `inventories/*/items`;
- referências Firestore são normalizadas na verificação;
- ponte transacional legada NF/warehouse permanece bloqueada por fail-safe.

Resultados relevantes do Emulator:
- fundador autorizado nos domínios liberados;
- usuário não fundador sem acesso ao ADM;
- gravações arbitrárias em ledger/saldos/lotes/barcodes/intakes permanecem negadas;
- exclusão física de `queueExclusions` permanece negada;
- `alerts`, `inventories` e `withdrawals` continuam estacionados nesta release;
- consumo imediato histórico e invariantes de estoque permanecem protegidos.

Os registros `PERMISSION_DENIED` observados durante o teste correspondem aos cenários deliberados `[PASS] DENY` e não representam falha.

Gate ainda pendente antes do cutover real:
- `npm.cmd run typecheck`.

Após o TypeScript passar, a próxima etapa autorizável é:
1. publicar somente `firestore.warehouse.rules` no database `emprovex-warehouse`;
2. executar `warehouse:db:plan`;
3. executar `warehouse:db:copy`;
4. executar `warehouse:db:verify`;
5. manter origem intacta para rollback.


### TypeScript gate da separação multi-database — PASS — 2026-09-27

Executado no PowerShell:

- `npm.cmd run typecheck` — **PASS / 0 erros**.

Com isso, os três gates locais da fundação multi-database estão aprovados:
1. guard modular — PASS;
2. Firestore Emulator/security — PASS;
3. TypeScript — PASS.

A etapa seguinte deixa de ser alteração estrutural local e passa a ser **cutover controlado de infraestrutura**:
- publicar somente as Rules do database `emprovex-warehouse`;
- executar migração em ordem `plan -> copy -> verify`;
- manter o database antigo e seus dados intactos como rollback;
- não remover ainda o bloco warehouse do ruleset principal;
- não realizar deploy da aplicação antes da migração e verificação dos dados.


### Rules do database dedicado publicadas — 2026-09-27

Publicação realizada com sucesso no projeto `gen-lang-client-0982077967`:

- database alvo: `emprovex-warehouse`;
- ruleset: `firestore.warehouse.rules`;
- compilação: **PASS**;
- publicação: **PASS**;
- banco operacional principal: **não alterado**.

O Firebase CLI em execução via `npx` falhou inicialmente por ausência de `@grpc/grpc-js` na instalação temporária. O deploy foi repetido com instalação isolada de `firebase-tools@15.31.0` + `@grpc/grpc-js@1.14.3` em `/tmp/firebase-cli-emprovex`, sem modificar as dependências do repositório.

Aviso não bloqueante observado na compilação:
- `firestore.warehouse.rules` — variável `workspaceId` não utilizada na linha indicada pelo compilador.

Próximo gate:
- concluir e revisar `warehouse:db:plan`;
- somente após conferência das contagens executar `warehouse:db:copy`;
- em seguida executar `warehouse:db:verify`;
- preservar integralmente a origem para rollback.


### PLAN da migração — leitura parcial + hardening de autenticação — 2026-09-27

Primeira execução real de `warehouse:db:plan` no Cloud Shell:
- `materials`: origem 47 / destino 0;
- `depots`: 5 / 0;
- `locations`: 146 / 0;
- `movements`: 780 / 0;
- `balances`: 47 / 0;
- `locationBalances`: 47 / 0;
- `settings`: 0 / 0;
- `lots`: 0 / 0;
- `barcodes`: 0 / 0;
- `layouts`: 14 / 0;
- `inventories`: 0 / 0;
- `inventories/*/items`: 0 / 0;
- `siscofisSnapshots`: 0 / 0;
- `alerts`: 0 / 0;
- `intakes`: 905 / 0;
- `queueExclusions`: 0 / 0;
- `destinations`: 1 / 0;
- `withdrawals`: 0 / 0.

A execução foi interrompida durante a paginação de `consumptions` por HTTP 401 após expiração do token OAuth obtido no início do processo. Nenhuma gravação ocorreu porque o modo era `plan`.

Hardening aplicado no migrador:
- cache do token continua evitando chamadas desnecessárias ao `gcloud`;
- em HTTP 401, quando não há token explícito fixado via ambiente, o migrador renova `gcloud auth print-access-token` e repete a requisição uma vez;
- isso protege também execuções longas de `copy` e `verify`.

Correção: commit `72324517849bc7e62e23f0652060fc766e1f46ca`.

Próximo passo: atualizar a cópia local no Cloud Shell e repetir `warehouse:db:plan` até obter `WAREHOUSE DATABASE MIGRATION PLAN: OK`. Não executar `copy` antes disso.


### COPY da migração para `emprovex-warehouse` — PASS — 2026-09-27

Execução real no Cloud Shell:

- modo: `copy`;
- origem: `ai-studio-logsticahospital-3eeee498-faa1-4326-8f4f-95d34b382ec1`;
- destino: `emprovex-warehouse`;
- workspace: `hgesm-aprov`;
- documentos na origem: **2897**;
- documentos no destino antes da operação: **0**;
- documentos gravados/atualizados: **2897**;
- resultado: **WAREHOUSE DATABASE MIGRATION: PASS**;
- exit code: **0**.

Coleções com dados migrados e conferidos durante o próprio COPY:
- materials 47;
- depots 5;
- locations 146;
- movements 780;
- balances 47;
- locationBalances 47;
- layouts 14;
- intakes 905;
- destinations 1;
- consumptions 905.

Coleções vazias também foram verificadas e permaneceram coerentes:
settings, lots, barcodes, inventories, inventories/*/items, siscofisSnapshots, alerts, queueExclusions e withdrawals.

A origem foi preservada e não houve operação de exclusão. O banco operacional principal do EMPROVEX continua sendo a fonte canônica para empenhos, notas fiscais, usuários e demais módulos não pertencentes ao ADM Depósito.

Próximo gate obrigatório:
- executar `warehouse:db:verify` de forma independente;
- somente após PASS do verify considerar a cópia validada;
- manter origem e rules legadas intactas para rollback até validação funcional pelo fundador.


### VERIFY independente da migração — PASS — 2026-09-27

Execução real no Cloud Shell:

- modo: `verify`;
- origem: `ai-studio-logsticahospital-3eeee498-faa1-4326-8f4f-95d34b382ec1`;
- destino: `emprovex-warehouse`;
- workspace: `hgesm-aprov`;
- documentos na origem: **2897**;
- documentos no destino: **2897**;
- todas as coleções previstas: **PASS**;
- resultado final: **WAREHOUSE DATABASE MIGRATION: PASS**;
- exit code: **0**.

Contagens verificadas:
- materials 47 = 47;
- depots 5 = 5;
- locations 146 = 146;
- movements 780 = 780;
- balances 47 = 47;
- locationBalances 47 = 47;
- layouts 14 = 14;
- intakes 905 = 905;
- destinations 1 = 1;
- consumptions 905 = 905;
- coleções vazias previstas também permaneceram equivalentes.

Conclusão:
- cópia do namespace ADM Depósito validada de forma independente;
- database dedicado `emprovex-warehouse` contém a réplica íntegra do escopo migrado;
- origem permanece intacta para rollback;
- dados canônicos do EMPROVEX fora do ADM Depósito permanecem no database operacional principal;
- não remover ainda dados/rules legados antes da validação funcional do cutover da aplicação pelo fundador.

Próxima etapa:
- validar a aplicação apontando os repositories do ADM para `warehouseDb`;
- realizar teste funcional direcionado do fundador;
- somente depois considerar merge/deploy de produção e posterior limpeza controlada do legado.


### Rules do database principal publicadas — PASS — 2026-09-27

Publicação realizada com sucesso no database operacional principal:

- database: `ai-studio-logsticahospital-3eeee498-faa1-4326-8f4f-95d34b382ec1`;
- ruleset: `firestore.rules`;
- compilação: **PASS**;
- publicação: **PASS**;
- deploy seletivo: somente o database principal;
- database `emprovex-warehouse`: não alterado nesta operação.

Avisos não bloqueantes do compilador:
- função `invoiceLockMatchesAfter` não utilizada;
- variável `workspaceId` não utilizada.

Conclusão:
- o ruleset principal atual cabe no limite aceito pelo Firebase e foi publicado com sucesso;
- o bloqueio anterior de publicação foi superado;
- a separação multi-database permanece preservada;
- ainda não remover o namespace warehouse legado nem seus dados do database principal até a validação funcional final do cutover.


### Cutover funcional — preview autorizado — 2026-09-27

Após os gates de segurança e migração:
- guard modular: PASS;
- security emulator: PASS;
- typecheck: PASS;
- Rules do database principal: publicadas;
- Rules do `emprovex-warehouse`: publicadas;
- migração: 2897 documentos copiados;
- verify independente: 2897 = 2897 / PASS.

Fica autorizado o primeiro deploy funcional da branch `feat/adm-deposito-modular-release` para validação founder-only usando `warehouseDb` / `emprovex-warehouse`.

Restrições durante a validação:
- não apagar dados legados do namespace warehouse no database principal;
- não remover ainda as Rules legadas do database principal;
- manter o banco antigo disponível para rollback;
- validar prioritariamente carregamento do ADM Depósito, Meus Depósitos, Cadastro de Itens, croqui/layout, movimentos/saldos e fila de intakes;
- somente após a validação funcional considerar promoção/merge para produção.


### Consumo imediato em lote por NF/Pregão — gates PASS — 2026-09-27

Implementação validada localmente na branch `feat/adm-deposito-modular-release`, HEAD `3b7901c`.

Resultado:
- `npm run verify:adm-deposito-modular-r1`: **PASS**;
- `npm run typecheck`: **PASS**;
- Pregão/NF suportam três ações: armazenamento, consumo imediato e remoção lógica da fila;
- consumo imediato em lote reutiliza o motor oficial `applyWarehouseImmediateConsumption`;
- destino, responsável e idempotência por item preservados;
- contratos de ledger/saldo/localização/lote/barcode/intake preservados;
- repositories permanecem em `warehouseDb`;
- founder-only preservado.

Próximo gate:
- validação funcional no localhost em `/adm-deposito/cadastro-de-itens`, conferindo visualmente ações por Pregão/NF/item e comportamento de saída da fila quando `pendingQuantity = 0`.


### Correção do falso positivo de reconciliação — gates PASS — 2026-09-27

Validado localmente após o commit `738cf49`:
- `npm run verify:adm-deposito-modular-r1`: **PASS**;
- `npm run typecheck`: **PASS**;
- `INVOICE_ENTRY` do intake v2 isolado não é mais classificado como `LEGACY_INVOICE_PROJECTION`;
- contratos de ledger/saldo/localização/lote/barcode/intake preservados;
- founder-only preservado;
- repositories continuam em `warehouseDb`.

Próximo diagnóstico:
1. atualizar o Cadastro de Itens e confirmar que o item afetado retorna a estado PENDENTE;
2. confirmar o valor efetivo de `NEXT_PUBLIC_EMPROVEX_WAREHOUSE_FIRESTORE_DATABASE_ID` no ambiente local antes de nova tentativa de alocação;
3. somente então repetir a alocação controlada.


### TRANSFER sem escrita redundante no saldo agregado — gates PASS — 2026-09-27

Validação local concluída na branch `feat/adm-deposito-modular-release`, HEAD `a5a3843`.

Resultados:
- `npm run verify:adm-deposito-modular-r1`: **PASS**;
- `npm run test:adm-deposito-modular-r1-security`: **PASS**;
- `npm run typecheck`: **PASS**;
- `INVOICE_ENTRY` válido continua aceito sobre saldo existente;
- alocação positiva `TRANSFER + locationBalances + lote + intake` passou no emulador;
- `TRANSFER` não regrava mais `balances` quando `quantityDelta = 0`;
- Rules reduziram acessos cruzados redundantes sem liberar gravação arbitrária;
- founder-only e domínios estacionados continuam preservados.

Diagnóstico real da NF 46546:
- `INVOICE_ENTRY` existente e coerente;
- saldo agregado = 100;
- `UNASSIGNED` = 100;
- nenhuma alocação parcial foi commitada;
- movimento `mov_10d8166020457f238cf6ab5139df5de4da932295df45c819a9b0f44dd7152045` não existe no banco, compatível com TRANSFER rejeitado integralmente.

Próximo gate:
- publicar exclusivamente `firestore.warehouse.rules` no database `emprovex-warehouse`;
- depois repetir uma única alocação controlada da NF 46546.


### Deploy das Rules otimizadas do warehouse — PASS — 2026-09-27

Publicação concluída com sucesso no projeto `gen-lang-client-0982077967`, database `emprovex-warehouse`.

Resultado:
- `firestore.warehouse.rules` compilado com sucesso;
- rules publicadas em `cloud.firestore`;
- deploy concluído com `Deploy complete!`;
- nenhum dado do Firestore foi alterado por esse deploy;
- banco principal e suas rules não foram publicados nesta operação;
- warning de variável não utilizada permaneceu não bloqueante.

Próximo gate:
- repetir uma única alocação controlada da NF 46546 / item Camomila no localhost;
- verificar se `UNASSIGNED` cai de 100 para 0, localização escolhida sobe para 100 e intake fica `PROCESSED`.


### Segunda alocação parcial em subposição distinta — gates PASS — 2026-09-27

Validação concluída no HEAD `3c23e47`.

Resultados:
- `npm run verify:adm-deposito-modular-r1`: **PASS**;
- `npm run test:adm-deposito-modular-r1-security`: **PASS**;
- `npm run typecheck`: **PASS**;
- primeira alocação parcial em subposição A: **ALLOW**;
- segunda alocação do mesmo intake em subposição B: **ALLOW**;
- transição `PARTIALLY_PROCESSED → PROCESSED`: **ALLOW**;
- gravações arbitrárias continuam **DENY**;
- acesso externo continua **DENY**;
- founder-only preservado;
- causa do erro real confirmada como limite de 1000 expressões das Security Rules;
- `TRANSFER` agora usa validador dedicado e o update de intake elimina comparações redundantes já cobertas por `diff().affectedKeys().hasOnly(...)`.

Próximo gate:
- publicar exclusivamente `firestore.warehouse.rules` no database `emprovex-warehouse`;
- repetir uma única tentativa controlada dos 50 restantes da NF 46546.


### Deploy da correção do limite de expressões — PASS — 2026-09-27

Publicação concluída no projeto `gen-lang-client-0982077967`, database `emprovex-warehouse`, com HEAD `a372a0c`.

Resultado:
- `firestore.warehouse.rules` compilado com sucesso;
- Rules publicadas em `cloud.firestore`;
- deploy concluído com `Deploy complete!`;
- correção do limite de 1000 expressões está ativa no banco real;
- nenhuma alteração de dados foi executada;
- banco operacional principal não foi publicado nesta etapa.

Próximo gate:
- repetir uma única tentativa controlada dos 50 restantes da NF 46546;
- validar estado final 50 + 50 em subposições distintas, `UNASSIGNED = 0`, intake `PROCESSED`.


### Ficha de Alocação Física de Materiais — implementada — 2026-09-27

Nova ponte operacional entre o depósito físico e o lançamento digital do EMPROVEX.

Escopo implementado:
- emissão da **Ficha de Alocação Física de Materiais** por Nota Fiscal;
- emissão consolidada por Pregão;
- download direto em PDF e abertura para impressão;
- A4 retrato, preto e branco, otimizado para impressora de toner;
- cabeçalho institucional EMPROVEX / ADM Depósito / Área Logística;
- identificação de NF(s), empenho(s), Pregão, fornecedor(es), UG, workspace, emissor e data/hora;
- somente itens ainda pendentes ou parcialmente processados entram na ficha;
- cada item possui três linhas independentes de alocação manual;
- campos por parcela: depósito, local, subposição, quantidade e observação;
- quantidade recebida e quantidade ainda a alocar impressas para conferência;
- instruções de preenchimento operacional;
- bloco final de conferência com assinatura do responsável pela alocação física e do operador que lançou no EMPROVEX;
- paginação e rodapé institucional;
- emissão por Pregão é bloqueada quando a consulta não garante cobertura completa das NFs;
- nenhuma nova leitura/listener do Firestore foi adicionada: o PDF usa os dados já carregados na fila.

Arquitetura:
- gerador dedicado em `features/warehouse/pdf/WarehouseAllocationSheet.ts`;
- integração em `WarehouseItemRegistrationOperational.tsx`;
- geração client-side com `jsPDF`, dependência já existente;
- guard da ADM-R1 atualizado para proteger a funcionalidade.

Próximo gate:
- `npm run verify:adm-deposito-modular-r1`;
- `npm run typecheck`;
- teste visual no navegador gerando uma ficha por NF e outra por Pregão;
- Browser E2E é justificável por se tratar de nova interação do usuário, mas deve ser executado apenas após os gates estáticos passarem.


### Refinamento visual da Ficha de Alocação Física — 2026-09-27

A primeira ficha real gerada para a NF 46546 foi revisada visualmente.

Problemas identificados:
- os tons que deveriam ser cinza foram interpretados pelo jsPDF como cores escuras, gerando faixas azul/verde;
- o contraste ficou inadequado para impressão com toner preto e branco;
- o cabeçalho longo de quantidade pendente ultrapassava a largura disponível;
- campos com listas longas de NFs, empenhos, fornecedores e descrições precisavam de contenção mais robusta.

Correções aplicadas:
- grayscale neutro explícito em hexadecimal (#F2F2F2 e #EDEDED);
- texto preto e bordas mais definidas;
- bloco de instruções com maior respiro vertical;
- “QTD. PARA ALOCAÇÃO” simplificado visualmente para “PARA ALOCAR”;
- colunas de UN., recebido e para alocar centralizadas e dimensionadas;
- helper de ajuste automático de fonte/quebra/reticências para impedir extravasamento;
- compactação segura de listas longas de NFs, empenhos, Pregões e fornecedores;
- altura do cabeçalho do item e cálculo de paginação ajustados.

Objetivo preservado:
- documento institucional, legível, econômico em toner e adequado para preenchimento manual na ponta física da operação.


### Renomeação da aba para Alocação de Material — 2026-09-27

A aba anteriormente exibida como **Cadastro de Itens** passa a ser apresentada ao usuário como **Alocação de Material**.

Motivo:
- o nome passa a refletir melhor a função operacional real da tela: tratar NFs pendentes e registrar a destinação física dos materiais entre depósito, local e subposição.

Preservado:
- rota interna `/adm-deposito/cadastro-de-itens` mantida por compatibilidade;
- IDs internos e contratos técnicos mantidos;
- nenhuma alteração de dados, Firestore Rules ou persistência.


### Aba Saída de Material + PDF operacional/SISCOFIS — 2026-09-27

A **Saída de Material** passa a ser uma aba principal própria do ADM Depósito, separada de Controle de Itens.

Fluxo preservado/reutilizado:
- leitor de código de barras e pesquisa manual;
- quantidade e apresentação;
- seleção da posição física;
- FEFO consultivo;
- lote opcional;
- carrinho;
- destino cadastrado;
- identificação de quem retirou/recebeu;
- finalização auditável via OUTBOUND oficial;
- idempotência e retry seguro;
- relatórios de saída/consumo.

Nova documentação automática ao finalizar:
1. **Ficha de Saída de Material**
   - localização física exata (depósito/local/subposição);
   - descrição, quantidade, unidade, lote e código de barras quando existentes;
   - destino e retirante;
   - campos de conferência/assinatura.
2. **Ficha Auxiliar de Pedido de Material - SISCOFIS**
   - detalhamento do material;
   - Nota Fiscal de origem quando resolvida;
   - Nota de Empenho obtida do movimento INVOICE de origem;
   - fornecedor quando disponível;
   - quantidade e unidade;
   - campos para número/data do pedido SISCOFIS e assinaturas.

Os dois documentos são gerados dentro de um único PDF em preto e branco, otimizado para toner.

Controle documental:
- número de controle determinístico no formato `AAAAMMDD-NNNNNN`;
- código alfanumérico no formato `EMX-SM-DDMMAA-XXXX`, derivado da data e do número de controle;
- número/código permanecem estáveis para a mesma retirada porque derivam do `withdrawalId` persistido e da data de finalização;
- se a origem NF/NE não puder ser determinada automaticamente (por exemplo, estoque legado sem vínculo documental), a ficha sinaliza explicitamente a necessidade de conferência manual, sem inventar dados.

Arquitetura:
- nova rota `/adm-deposito/saida-de-material`;
- nova seção principal `outbound` na navegação;
- `WarehouseMaterialWithdrawal` ativado diretamente na release modular;
- subaba duplicada de Saída de Material removida de Controle de Itens;
- gerador PDF dedicado em `features/warehouse/pdf/WarehouseOutboundDocuments.ts`;
- após finalização, o PDF é baixado automaticamente e permanece disponível para baixar novamente/imprimir enquanto a tela estiver aberta.

Segurança:
- domínio `warehouse/{workspaceId}/withdrawals` liberado no database dedicado;
- criação founder-only exige destino ativo, payload válido e estado `FINALIZING`;
- progresso é monotônico;
- finalização exige `appliedLineCount == expectedLineCount`;
- retirada `FINALIZED` não pode ser reaberta;
- delete físico permanece proibido.


### Correção estrutural das Rules após liberação de withdrawals — 2026-09-27

Durante o primeiro gate de segurança da nova aba **Saída de Material**, o emulador recusou a compilação de `firestore.warehouse.rules`.

Causa identificada:
- a rotina usada para inserir o novo bloco de `withdrawals` tratou a sequência `$'`, presente no final das regex das Rules, como token especial de substituição JavaScript;
- isso duplicou um grande sufixo do arquivo;
- o sintoma foi o crescimento anormal das Rules de ~110 KiB para ~197 KiB e erros `Unexpected let` / `Unexpected allow`.

Correção:
- restaurada a última versão íntegra das Rules anterior à liberação de `withdrawals`;
- reaplicado somente o contrato de `withdrawals` usando inserção por posição, sem interpretação de tokens de replacement;
- arquivo voltou para ~115 mil caracteres / ~2,5 mil linhas;
- exatamente um `rules_version`, um helper `validWarehouseWithdrawalBase` e um `match /withdrawals/{withdrawalId}`;
- guard interno reduzido de 200 KiB para 150 KiB e fortalecido para detectar duplicações estruturais e conteúdo residual após o fechamento final.

Nenhuma Rule foi publicada no banco real nesta etapa. O próximo gate continua sendo emulator security PASS + typecheck PASS antes de qualquer deploy.


### Alinhamento visual da Saída de Material ao tema claro oficial — 2026-09-27

A primeira versão da aba principal **Saída de Material** reaproveitou o fluxo funcional antigo ainda com dívida visual de tema escuro. A revisão foi feita contra a referência obrigatória `docs/adm-deposito/VISUAL_IDENTITY.md` e a decisão D-076.

Correção aplicada:
- conteúdo operacional migrado integralmente para tema claro;
- cards principais em branco/translúcido, bordas slate/blue suaves e sombra discreta;
- azul institucional `#00288e` voltou a comandar tabs ativas, ícones de contexto e ações primárias;
- inputs e selects passaram para fundo branco, texto slate-800 e foco institucional;
- títulos passaram para slate-900 e textos auxiliares para slate-500/600;
- estados de sucesso/aviso/erro usam emerald/amber/rose em fundos claros;
- carrinho, fechamento da retirada, gestão de destinos e último PDF deixaram de usar superfícies pretas;
- a subaba **Relatórios** foi migrada junto para evitar que a mesma aba alternasse entre tema claro e dark mode;
- rótulo visual “terminal premium” foi substituído por “terminal de saída”, mais institucional.

Guard adicional:
- `verify:adm-deposito-modular-r1` agora falha se Saída de Material ou seus Relatórios reintroduzirem tokens centrais do dark mode operacional (`bg-[#071020]`, `bg-black/*`, bordas brancas escuras ou gradiente preto);
- o guard também exige azul institucional e formulários claros nessas superfícies.

Nenhum contrato de estoque, ledger, PDF, Firestore Rules ou persistência foi alterado por esta revisão visual.


### Auditoria da Saída de Material e reflexo no croqui — 2026-09-27

Foi auditado o fluxo completo **Saída de Material → ledger → saldo agregado → saldo físico por posição → lote → projeção visual do croqui**.

Comportamento confirmado:
- cada linha finalizada usa `applyWarehouseExpressOutbound`;
- o movimento gerado é `OUTBOUND` com `quantityDelta` negativo;
- `balances/{materialId}` é reduzido na mesma operação;
- `locationBalances/{locationBalanceId}` da posição escolhida é reduzido na mesma operação;
- lote selecionado é reduzido pela mesma quantidade;
- saldo negativo é recusado;
- retirada total de uma posição deixa o `locationBalance` com `quantity = 0`, preservando o documento para auditoria em vez de apagá-lo;
- o cadastro canônico do material também é preservado;
- Início/croqui e Prévia 3D consideram somente posições com quantidade positiva para localização e ocupação;
- portanto uma posição zerada deixa de representar aquele material no croqui; se houver saldo do mesmo material em outra posição, apenas a posição zerada deixa de destacá-lo;
- estruturas físicas do croqui não são apagadas por saída de estoque.

Rules confirmadas:
- `OUTBOUND` exige redução correspondente do saldo agregado;
- exige redução correspondente do `locationBalance`;
- exige posição física válida/ativa;
- quando há lote, exige redução correspondente do lote;
- gravações arbitrárias e saldos negativos continuam bloqueados;
- documentos de ledger, saldos, locationBalances, lots e withdrawals permanecem sem delete físico.

Cobertura reforçada:
- teste modular de segurança passou a incluir retirada total real de uma subposição, comprovando saldo agregado reduzido, `locationBalance = 0` e lote = 0;
- teste do localizador passou a comprovar que saldo zerado deixa de compor a projeção do croqui;
- guard modular passou a proteger os vínculos entre saída, baixa física e filtros de saldo positivo da visualização.

Observação operacional:
- “excluir do depósito” significa retirar quantitativamente a presença física da posição, não apagar o cadastro/histórico do material.


### Controle de Itens — configuração completa e reativação do Inventário — 2026-09-27

A aba **Controle de Itens** foi retirada do estado estacionado da release modular e configurada como superfície permanente para o material já armazenado.

Arquitetura final:
- **Resumo** — indicadores bounded de materiais com saldo, material sem posição, validade, inventários em andamento e movimentações recentes;
- **Estoque** — saldo oficial, distribuição física, localização, lotes, validade, FEFO, barcodes, origem documental e histórico;
- **Movimentações** — histórico somente leitura do ledger;
- **Inventário** — contagem física operacional, revisão humana e ajuste auditável;
- **Relatórios** — estoque/localização/validade, consumo/saídas, ledger/NF, histórico de inventários e histórico SISCOFIS.

Duplicidades removidas:
- Saída de Material não existe mais dentro de Controle de Itens;
- Entregas não são duplicadas e permanecem no fluxo de Cronogramas/Entregas;
- Alertas e Configurações não são subabas do Controle;
- migração/importação SISCOFIS permanece em Alocação de Material;
- SISCOFIS dentro de Relatórios é somente leitura;
- Inventário dentro de Relatórios é somente leitura; contagem e ajustes permanecem somente na subaba Inventário.

UX:
- Controle de Itens, Estoque e Inventário foram alinhados ao tema claro oficial D-076/VISUAL_IDENTITY;
- cards brancos, bordas slate/blue, azul institucional `#00288e`, formulários claros e estados semânticos de alto contraste;
- guard modular protege contra regressão para dark mode nas superfícies do Controle.

Firestore dedicado:
- `inventories/{inventoryId}` e `inventories/{inventoryId}/items/{itemId}` foram reintegrados a `firestore.warehouse.rules`;
- foi reutilizado o contrato certificado da Fase 10, adaptado ao ruleset dedicado atual;
- contagem isolada não altera saldo;
- ajuste exige `INVENTORY_ADJUSTMENT` / `PHYSICAL_INVENTORY`, vínculo com o item do inventário, atualização atômica de ledger + saldo agregado + saldo físico e estado `CONFIRMING`;
- concorrência/stale, histórico imutável, UG/workspace e founder-only permanecem protegidos;
- `alerts` continua estacionado e não foi liberado nesta etapa.

Cobertura adicionada:
- segurança direcionada agora inclui abertura, contagem, revisão, confirmação, `INVENTORY_ADJUSTMENT`, bloqueio de alteração direta, bloqueio de reabertura, delete físico e acesso externo;
- guard modular exige a ativação do Controle, as cinco subabas, Rules de inventário, tema claro e relatórios de Inventário/SISCOFIS somente leitura.

Próximos gates obrigatórios antes de publicar as novas Rules:
- `verify:adm-deposito-modular-r1`;
- `typecheck`;
- `test:adm-deposito-stock-operational`;
- `test:adm-deposito-inventory`;
- `test:adm-deposito-modular-r1-security`.

As novas Rules de inventário **ainda não devem ser consideradas publicadas** até os gates acima passarem e houver deploy explícito somente de `firestore:emprovex-warehouse`.


### Deploy das Rules do Controle de Itens / Inventário — 2026-09-27

Deploy concluído com sucesso no database dedicado `emprovex-warehouse`.

Confirmações do Cloud Shell:
- branch sincronizada no commit `ad1ef45`;
- Firebase CLI autenticado e direcionado ao projeto `gen-lang-client-0982077967`;
- ruleset criado: `c6cf2fe4-b308-4812-a910-053859126f1d`;
- release atualizada em `cloud.firestore/emprovex-warehouse`;
- API respondeu HTTP 200;
- `firestore.warehouse.rules` foi liberado em produção;
- deploy finalizado com `Deploy complete!`.

Com isso, o domínio `inventories` e a configuração completa de **Controle de Itens** passaram a estar habilitados também no banco real dedicado, mantendo founder-only, workspace/UG, invariantes de ledger/saldo e bloqueio de gravações arbitrárias.

Próxima validação operacional: smoke test no localhost das subabas **Resumo, Estoque, Movimentações, Inventário e Relatórios**, sem necessidade de novo deploy Vercel.


### Estoque — somente saldo disponível e prioridade por validade — 2026-09-27

Correção aplicada após validação visual da subaba **Estoque**:

Problema encontrado:
- documentos de `balances` com quantidade zero ainda eram carregados e materializados na lista;
- isso fazia materiais consumidos integralmente como **consumo imediato** continuarem aparecendo como se fossem estoque;
- a lista não tinha prioridade explícita pela menor validade.

Correção:
- nova consulta `listWarehousePositiveBalances` usa `where('quantity', '>', 0)` diretamente no Firestore dedicado;
- a UI mantém uma segunda defesa local com `hasWarehouseAvailableStock(balance.quantity)`;
- somente lotes ativos e com quantidade positiva compõem a validade atual do item;
- a lista é ordenada por menor `nearestExpiry`;
- materiais sem validade ficam ao final;
- empate é resolvido pela descrição;
- o cartão passa a contar apenas lotes atuais com saldo;
- o filtro por validade ignora lotes esgotados/inativos.

Impacto:
- consumo imediato com saldo zero deixa de aparecer em Estoque;
- saída total também retira o item da lista;
- estoque físico positivo continua visível;
- nenhuma Firestore Rule ou contrato de persistência foi alterado;
- a mudança reduz leituras desnecessárias de balances zerados.

Cobertura:
- testes unitários adicionados para saldo > 0, ordenação por validade e desempate por descrição;
- guard modular protege a consulta Firestore positiva, o filtro local e a ordenação por validade.
