# ADM Depósito — Estado Atual

Este arquivo registra o estado real de continuidade do projeto.

## Estado geral

Status: **FASE 2 CONCLUÍDA + ROADMAP V2 ADOTADO**

Data da reprogramação: 2026-09-23.

Situação:
- FASES 0, 1 e 2 estão concluídas, validadas e integradas à `main`;
- piloto permanece exclusivo da conta fundadora;
- usuários externos continuam sem visibilidade e sem acesso ao módulo;
- nenhum requisito funcional futuro foi removido;
- o plano futuro foi reorganizado para Walking Skeleton + fatias verticais completas;
- a antiga FASE 3 de NF → estoque foi renumerada para FASE 4;
- a nova FASE 3 é exclusivamente o Walking Skeleton do módulo.

## Repositório e baseline

Repositório:
`aprov-hgesm/Controles-de-Empenhos---Aprov`

Branch oficial:
`main`

Commit final da implementação da FASE 2 na `main`:
`9d4156a8e37cd6c3337afdd31747456eb9935664`

Baseline da `main` usado para a reprogramação do roadmap:
`5855cb1b8a66d2b2c454ee4d5336f366c4104cf5`

PR da FASE 2:
- PR #161 — `feat: implement ADM Depósito phase 2 ledger and balances`;
- merge concluído;
- Application CI aprovado;
- Recovery guardrails aprovado;
- Browser E2E aprovado;
- Vercel teve rate limit de build, sem invalidar código ou CI.

## Fases concluídas

### FASE 0 — Fundação e isolamento
Concluída.

### FASE 1 — Fundação do material
Concluída.

### FASE 2 — Ledger e saldos
Concluída.

Blocos:
- DEP-2 — Ledger de movimentações;
- DEP-2.1 — Saldo agregado;
- DEP-2.2 — Idempotência.

Contratos oficiais já disponíveis:
- `warehouse_movement_v1`;
- `warehouse_balance_v1`;
- material canônico da FASE 1;
- ledger append-only;
- saldo materializado como projeção do ledger;
- idempotência determinística.

## Mudança de estratégia aprovada

O desenvolvimento futuro passa a seguir:

**Fundação → Walking Skeleton → funcionalidades verticais → integração progressiva → hardening.**

Motivo:
- o EMPROVEX já possui base madura e múltiplos módulos interdependentes;
- construir pequenas camadas horizontais separadas aumenta retrabalho;
- cada fase futura deve terminar com uma capacidade funcionalmente coerente;
- o esqueleto completo será estabelecido antes do aprofundamento das próximas funcionalidades.

Os requisitos DEP-0..DEP-37 e EXT-1..EXT-6 continuam válidos. Apenas o agrupamento em fases foi alterado.

## Próxima fase oficial

**FASE 3 — Walking Skeleton do ADM Depósito**

Objetivo:
- criar a estrutura navegável e arquitetural completa do módulo;
- preparar superfícies, rotas, estados e contratos de integração;
- não implementar antecipadamente NF→estoque, SISCOFIS, scanner, mapa, inventário ou outras capacidades futuras.

Superfícies-base esperadas:
- Visão Geral;
- Estoque;
- Movimentações;
- Localizações;
- Visão do Depósito;
- Inventário;
- SISCOFIS/Conciliação;
- Entregas;
- Configurações.

Gate:
- estrutura completa navegável;
- founder-only preservado;
- usuário externo bloqueado;
- contratos das FASES 1 e 2 reutilizados;
- build e testes estruturais verdes.

## Sequência futura resumida

1. FASE 3 — Walking Skeleton;
2. FASE 4 — NF → estoque;
3. FASE 5 — SISCOFIS / Marco Zero / conciliação;
4. FASE 6 — depósitos / localizações / transferências;
5. FASE 7 — estoque operável / lotes / FEFO;
6. FASE 8 — saída expressa / código de barras / scanner;
7. FASE 9 — Visão do Depósito / editor / persistência;
8. FASE 10 — inventário;
9. FASE 11 — entregas / dashboard / alertas;
10. FASE 12 — segurança / performance / telemetria;
11. FASE 13 — validação integrada e fechamento do piloto;
12. FASE 14 — expansão externa futura.

## Riscos e pendências preservados

1. NF → estoque deve reutilizar o ledger da FASE 2.
2. Nenhuma funcionalidade futura pode criar segundo saldo concorrente.
3. Correções/cancelamentos de NF usam movimentos compensatórios.
4. Isolamento por workspace/UG continua obrigatório.
5. O PR #160 ou qualquer evolução equivalente de autenticação/Firestore Rules deve ser reconciliado com a `main` real antes de editar regiões sobrepostas.
6. Intervenções Cloud Shell devem ser consolidadas quando não forem bloqueantes.

## Gate para o próximo chat

Antes de modificar código:
1. ler README, ROADMAP, DECISIONS, STATUS e HANDOFF_TEMPLATE;
2. consultar a `main` real;
3. comparar a `main` atual com o baseline registrado aqui;
4. analisar commits posteriores;
5. executar exclusivamente a FASE 3 — Walking Skeleton;
6. não iniciar a FASE 4 no mesmo chat;
7. atualizar STATUS ao fechar a fase.
