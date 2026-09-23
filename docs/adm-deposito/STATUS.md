# ADM Depósito — Estado Atual

Este arquivo registra o estado real de continuidade do projeto e deve ser tratado como memória operacional oficial do módulo.

## Estado geral

Status: **FASE 6 CONCLUÍDA — DEPÓSITOS / LOCALIZAÇÕES / TRANSFERÊNCIAS**

Data de fechamento: 2026-09-23.

Situação:
- FASES 0, 1, 2, 3, 4, 5 e 6 concluídas;
- FASE 3 — Walking Skeleton integrada à `main` pelo PR #164;
- FASE 4 — NF → Estoque implementada e validada no PR #167;
- FASE 5 — SISCOFIS / Marco Zero / Conciliação implementada no PR #171;
- FASE 6 — Depósitos / Localizações / Transferências implementada e validada no PR #173;
- piloto permanece exclusivo da conta fundadora;
- usuários externos continuam sem visibilidade e sem acesso ao módulo ADM Depósito;
- nenhuma capacidade da FASE 7 foi iniciada.

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

## Regras permanentes após a FASE 6

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

## Próxima fase oficial

**FASE 7 — Estoque Operável / Lotes / Validade / FEFO**

Objetivo de alto nível:
- enriquecer o estoque existente com lotes e validade;
- tratar pendências logísticas como avisos, sem criar bloqueios indevidos;
- introduzir recomendação FEFO;
- tornar a tela Estoque pesquisável por contexto logístico;
- oferecer ficha do material com saldo, origem, lotes, locais e histórico;
- preparar a ação “Localizar no depósito” para a futura FASE 9.

A FASE 7 ainda não foi iniciada e deve ser executada em novo chat/branch.

## Sequência futura resumida

1. FASE 7 — estoque operável / lotes / FEFO;
2. FASE 8 — saída expressa / código de barras / scanner;
3. FASE 9 — Visão do Depósito / editor / persistência;
4. FASE 10 — inventário;
5. FASE 11 — entregas / dashboard / alertas;
6. FASE 12 — segurança / performance / telemetria;
7. FASE 13 — validação integrada e fechamento do piloto;
8. FASE 14 — expansão externa futura.

## Gate para o próximo chat

Antes de modificar código:
1. consultar a `main` real;
2. ler `README.md`, `ROADMAP.md`, `DECISIONS.md`, `STATUS.md`, `HANDOFF_TEMPLATE.md`, `PHASE_5_SISCOFIS.md` e `PHASE_6_LOCATIONS.md`;
3. comparar a `main` com o baseline registrado aqui;
4. analisar commits posteriores ao fechamento da FASE 6;
5. preservar material canônico, ledger, saldo, NF → estoque, cutoff, Marco Zero, snapshots SISCOFIS e distribuição física da FASE 6;
6. executar exclusivamente a FASE 7 — Estoque Operável / Lotes / Validade / FEFO;
7. não iniciar a FASE 8 no mesmo chat;
8. atualizar STATUS ao fechar a fase.
