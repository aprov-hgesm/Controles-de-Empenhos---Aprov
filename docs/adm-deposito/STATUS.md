# ADM Depósito — Estado Atual

Este arquivo registra o estado real de continuidade do projeto e deve ser tratado como memória operacional oficial do módulo.

## Estado geral

Status: **FASE 5 CONCLUÍDA — SISCOFIS / MARCO ZERO / CONCILIAÇÃO**

Data de fechamento: 2026-09-23.

Situação:
- FASES 0, 1, 2, 3, 4 e 5 concluídas;
- FASE 3 — Walking Skeleton integrada à `main` pelo PR #164;
- FASE 4 — NF → Estoque implementada e validada no PR #167;
- FASE 5 — SISCOFIS / Marco Zero / Conciliação implementada no PR #171;
- piloto permanece exclusivo da conta fundadora;
- usuários externos continuam sem visibilidade e sem acesso ao módulo ADM Depósito;
- nenhuma capacidade da FASE 6 foi iniciada.

## Repositório e baseline

Repositório:
`aprov-hgesm/Controles-de-Empenhos---Aprov`

Branch oficial:
`main`

Baseline funcional da FASE 3:
`0b8aed23da504deeb0bd18de404f0298a7c7cf2c`

Baseline funcional da FASE 5 na `main` após o merge do PR #171:
`f0aa080ff48b10ba04c18c9fb6b54ab51ecfbfaa`

**Este é o baseline oficial para o próximo chat.**

Baseline imediatamente anterior ao desenvolvimento da FASE 5:
`b376def63732eda84fe1ff9c1507527d0a96bcfd`

O baseline anterior:
- já continha a FASE 4;
- já continha o PR #169 e as mudanças posteriores reconciliadas antes do desenvolvimento;
- foi auditado antes da criação da branch da FASE 5.

Branch da FASE 5:
`feat/adm-deposito-phase-5-siscofis`

PR da FASE 5:
- PR #171 — `feat: add SISCOFIS Marco Zero and reconciliation`;
- Recovery guardrails aprovado;
- Application CI aprovado na validação técnica inicial;
- testes multi-tenant/Firestore aprovados;
- gates das FASES 0–5 aprovados;
- build de produção aprovado;
- TypeScript final aprovado;
- diff hygiene aprovado;
- Browser E2E com Firebase Emulator aprovado.

Deploy:
- o primeiro disparo de preview encontrou `build-rate-limit`, limitação temporária de cota da plataforma;
- um preview posterior do PR ficou `Ready`;
- após o merge, o check Vercel do commit `f0aa080ff48b10ba04c18c9fb6b54ab51ecfbfaa` concluiu com `success`.

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

## Regras permanentes após a FASE 5

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

## Próxima fase oficial

**FASE 6 — Depósitos / Localizações / Transferências**

Objetivo de alto nível:
- permitir 1..N depósitos por UG;
- criar estrutura Depósito → Local → Subposição opcional;
- localizar materiais por identidade lógica estável;
- transferir localização sem alterar o saldo total da OM;
- preparar IDs lógicos para a futura Visão do Depósito.

A FASE 6 ainda não foi iniciada e deve ser executada em novo chat/branch.

## Sequência futura resumida

1. FASE 6 — depósitos / localizações / transferências;
2. FASE 7 — estoque operável / lotes / FEFO;
3. FASE 8 — saída expressa / código de barras / scanner;
4. FASE 9 — Visão do Depósito / editor / persistência;
5. FASE 10 — inventário;
6. FASE 11 — entregas / dashboard / alertas;
7. FASE 12 — segurança / performance / telemetria;
8. FASE 13 — validação integrada e fechamento do piloto;
9. FASE 14 — expansão externa futura.

## Gate para o próximo chat

Antes de modificar código:
1. consultar a `main` real;
2. ler `README.md`, `ROADMAP.md`, `DECISIONS.md`, `STATUS.md`, `HANDOFF_TEMPLATE.md` e `PHASE_5_SISCOFIS.md`;
3. comparar a `main` com o baseline registrado aqui;
4. analisar commits posteriores ao fechamento da FASE 5;
5. preservar material canônico, ledger, saldo, NF → estoque, cutoff, Marco Zero e snapshots SISCOFIS;
6. executar exclusivamente a FASE 6 — Depósitos / Localizações / Transferências;
7. não iniciar a FASE 7 no mesmo chat;
8. atualizar STATUS ao fechar a fase.
