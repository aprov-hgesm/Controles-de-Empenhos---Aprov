# ADM Depósito — Estado Atual

Este arquivo registra o estado real de continuidade do projeto e deve ser tratado como memória operacional oficial do módulo.

## Estado geral

Status: **FASE 4 CONCLUÍDA — NF → ESTOQUE**

Data de fechamento: 2026-09-23.

Situação:
- FASES 0, 1, 2, 3 e 4 concluídas;
- FASE 3 — Walking Skeleton integrada à `main` pelo PR #164;
- FASE 4 — NF → Estoque implementada e validada no PR #167;
- piloto permanece exclusivo da conta fundadora;
- usuários externos continuam sem visibilidade e sem acesso ao módulo ADM Depósito;
- nenhum requisito futuro foi antecipado;
- FASE 5 ainda não foi iniciada.

## Repositório e baseline

Repositório:
`aprov-hgesm/Controles-de-Empenhos---Aprov`

Branch oficial:
`main`

Baseline funcional da FASE 3 na `main`:
`0b8aed23da504deeb0bd18de404f0298a7c7cf2c`

Baseline da `main` imediatamente antes do fechamento da FASE 4:
`1b391a24216fbcda0ea7f1e8945d332d965cb4ba`

Esse baseline já inclui o PR #168, que estabilizou o Browser E2E ao desabilitar HMR/file watching durante os testes Playwright.

PR da FASE 4:
- PR #167 — `feat: integrate NF receipts with ADM Depósito stock`;
- implementação reconstruída sobre a `main` atual para incorporar o #168 sem conflito;
- Application CI aprovado;
- Recovery guardrails aprovado;
- Browser E2E com Firebase Emulator aprovado;
- release gates dos blocos 16, 17, 18, 19, 20 e 21 aprovados.

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

Superfícies estruturais preservadas:
- Visão Geral;
- Estoque;
- Movimentações;
- Localizações;
- Visão do Depósito;
- Inventário;
- SISCOFIS/Conciliação;
- Entregas;
- Configurações.

A FASE 3 não implementou antecipadamente capacidades funcionais futuras.

### FASE 4 — NF → Estoque
Concluída.

Capacidade vertical entregue:
- confirmação existente de Nota Fiscal permanece como único ponto operacional de entrada;
- item de empenho é vinculado ao material canônico por identidade persistida, sem matching por texto livre;
- primeira relação pode criar deterministicamente o material canônico a partir de workspace + empenho + item;
- NF, empenho, material, movimento e saldo são tratados no mesmo lifecycle transacional;
- recebimento confirmado gera movimento `INVOICE_ENTRY`;
- edição gera apenas o delta por `INVOICE_CORRECTION`;
- exclusão individual de NF integrada gera estorno compensatório auditável;
- exclusão em lote não pode contornar o estorno de NFs já integradas;
- origem estruturada preserva NF, empenho, itens, fornecedor/CNPJ, operador, workspace/UG e data/hora;
- vínculo NF → movimentos é persistido;
- idempotência protege contra duplo clique/retry;
- cutoff por workspace impede backfill silencioso de histórico anterior ao piloto;
- NFs históricas não integradas permanecem históricas até uma migração explícita futura;
- integração continua founder-only durante o piloto;
- fluxo dos usuários externos permanece inalterado;
- aba Estoque lê saldos reais materializados;
- aba Movimentações lê o ledger oficial;
- consultas são bounded e não introduzem listeners globais.

Decisão arquitetural correspondente:
- D-033 em `DECISIONS.md`.

## Regras permanentes após a FASE 4

1. NF → estoque deve continuar reutilizando o ledger oficial da FASE 2.
2. Não criar segundo saldo concorrente.
3. Correções e cancelamentos devem usar movimentos compensatórios.
4. O identificador persistido do material é a autoridade; texto descritivo não é chave de identidade.
5. Isolamento por workspace/UG continua obrigatório.
6. Founder-only continua obrigatório durante o piloto.
7. Histórico anterior ao cutoff não deve ser integrado silenciosamente.
8. Usuários externos não podem ganhar acesso ao módulo por consequência de fases internas.
9. Cloud Shell deve ser usado apenas quando necessário, preferencialmente de forma consolidada.
10. Toda fase futura deve preservar gates permanentes das fases anteriores.

## Próxima fase oficial

**FASE 5 — SISCOFIS / Marco Zero / Conciliação**

Objetivo de alto nível:
- iniciar a integração operacional com a realidade existente do estoque/SISCOFIS;
- estabelecer Marco Zero explícito;
- permitir conciliação sem recriar ou competir com o ledger oficial;
- preservar toda a rastreabilidade criada na FASE 4.

A FASE 5 deve ser executada em novo chat e não deve avançar automaticamente para a FASE 6.

## Sequência futura resumida

1. FASE 5 — SISCOFIS / Marco Zero / conciliação;
2. FASE 6 — depósitos / localizações / transferências;
3. FASE 7 — estoque operável / lotes / FEFO;
4. FASE 8 — saída expressa / código de barras / scanner;
5. FASE 9 — Visão do Depósito / editor / persistência;
6. FASE 10 — inventário;
7. FASE 11 — entregas / dashboard / alertas;
8. FASE 12 — segurança / performance / telemetria;
9. FASE 13 — validação integrada e fechamento do piloto;
10. FASE 14 — expansão externa futura.

## Gate para o próximo chat

Antes de modificar código:
1. consultar a `main` real;
2. ler `README.md`, `ROADMAP.md`, `DECISIONS.md`, `STATUS.md` e `HANDOFF_TEMPLATE.md`;
3. comparar a `main` com o baseline registrado aqui;
4. analisar commits posteriores ao fechamento da FASE 4;
5. preservar os contratos canônicos de material, ledger, saldo e NF → estoque;
6. executar exclusivamente a FASE 5 — SISCOFIS / Marco Zero / Conciliação;
7. não iniciar a FASE 6 no mesmo chat;
8. atualizar STATUS ao fechar a fase.
