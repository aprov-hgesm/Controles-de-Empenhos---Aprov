# ADM Depósito — Estado Atual

Este arquivo registra o estado real de continuidade do projeto e deve ser tratado como memória operacional oficial do módulo.

## Estado geral

Status: **FASE 8 CONCLUÍDA — CÓDIGO DE BARRAS / SCANNER / SAÍDA EXPRESSA**

Data de fechamento: 2026-09-23.

Situação:
- FASES 0, 1, 2, 3, 4, 5, 6, 7 e 8 concluídas;
- FASE 3 — Walking Skeleton integrada à `main` pelo PR #164;
- FASE 4 — NF → Estoque implementada e validada no PR #167;
- FASE 5 — SISCOFIS / Marco Zero / Conciliação implementada no PR #171;
- FASE 6 — Depósitos / Localizações / Transferências implementada e validada no PR #173;
- FASE 7 — Estoque Operável / Lotes / Validade / FEFO implementada e validada no PR #174;
- FASE 8 — Código de Barras / Scanner / Saída Expressa implementada e validada no PR #176;
- piloto permanece exclusivo da conta fundadora;
- usuários externos continuam sem visibilidade e sem acesso ao módulo ADM Depósito;
- nenhuma capacidade da FASE 9 foi iniciada.

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

### FASE 4 — NF → Estoque
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

1. NF → estoque continua reutilizando o ledger oficial da FASE 2.
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

**FASE 9 — Visão do Depósito, Editor e Persistência**

Objetivo de alto nível:
- transformar a superfície Visão do Depósito em croqui 2D operacional com perspectiva tridimensional leve;
- representar apenas estrutura física simples, sem desenhar produtos;
- vincular objetos visuais a `warehouseLocationId` estável;
- pesquisar material e destacar no croqui a localização real já existente;
- permitir destaque consultivo de prioridade FEFO quando aplicável;
- oferecer editor simplificado sem fazer movimento de estoque ao mover objetos;
- persistir layout versionado em Firestore com JSON versionado;
- preparar sincronização complementar com Drive da UG e histórico de versões;
- manter estoque, ledger, barcode e Saída Expressa como fontes já consolidadas.

A FASE 9 deve ser executada em novo chat/branch e não deve iniciar a FASE 10 no mesmo ciclo.

## Sequência futura resumida

1. FASE 9 — Visão do Depósito / editor / persistência;
2. FASE 10 — inventário;
3. FASE 11 — entregas / dashboard / alertas;
4. FASE 11.5 — consolidação visual / UX conduzida pelo fundador;
5. FASE 12 — segurança / performance / telemetria;
6. FASE 13 — validação integrada e fechamento do piloto;
7. FASE 14 — expansão externa futura.

## Gate para o próximo chat

Antes de modificar código:
1. consultar a `main` real;
2. ler `README.md`, `ROADMAP.md`, `DECISIONS.md`, `STATUS.md`, `HANDOFF_TEMPLATE.md`, `PHASE_6_LOCATIONS.md`, `PHASE_7_STOCK_LOTS_FEFO.md` e `PHASE_8_BARCODE_SCANNER_EXPRESS_OUTBOUND.md`;
3. comparar a `main` com o baseline funcional da FASE 8 registrado aqui;
4. analisar commits posteriores ao fechamento da FASE 8;
5. preservar material canônico, ledger, saldo, NF → estoque, cutoff, Marco Zero, snapshots SISCOFIS, distribuição física, lotes, FEFO, barcodes e Saída Expressa;
6. executar exclusivamente a FASE 9 — Visão do Depósito, Editor e Persistência;
7. não iniciar a FASE 10 no mesmo chat;
8. atualizar STATUS ao fechar a fase.
