# ADM Depósito — Estado Atual

Este arquivo registra o estado real de continuidade do projeto.

## Estado geral

Status: **FASE 2 — CONCLUÍDA, VALIDADA E INTEGRADA À MAIN**

Data de fechamento técnico: 2026-09-23.

Módulo:
- ADM Depósito / Área Logística;
- piloto permanece exclusivo da conta fundadora;
- usuários externos continuam sem visibilidade e sem acesso ao módulo;
- DEP-2, DEP-2.1 e DEP-2.2 estão concluídos;
- nenhuma funcionalidade da FASE 3 foi iniciada.

## Repositório e baseline

Repositório:
`aprov-hgesm/Controles-de-Empenhos---Aprov`

Branch oficial:
`main`

Branch da FASE 2:
`feat/adm-deposito-phase-2-ledger-balances`

Baseline operacional final da FASE 1:
`74e271e5b2b04367e75002dce4e8d7bebe72d63a`

HEAD real da `main` no início da FASE 2:
`8a94a3f28c1ebaad4170d811e416d250252fce69`

Commit técnico final da branch aprovado pelos gates:
`c806820a515bdecf928d19098e1e0d6d9e77c366`

PR da implementação:
- PR #161 — `feat: implement ADM Depósito phase 2 ledger and balances`;
- merge via squash;
- commit final da implementação na `main`: `9d4156a8e37cd6c3337afdd31747456eb9935664`.

O PR #160 — `security: bind Firestore authorization to operational sessions` — foi auditado antes da implementação e permaneceu fora do escopo da FASE 2.

## Última fase concluída

**FASE 2 — Ledger e saldos**

Blocos concluídos:
- DEP-2 — Ledger de movimentações;
- DEP-2.1 — Saldo agregado;
- DEP-2.2 — Idempotência.

## Implementação concluída

### DEP-2 — Ledger de movimentações

Foi criado o contrato versionado:

`warehouse_movement_v1`

Tipos iniciais suportados:
- `INITIAL_BALANCE`;
- `INVOICE_ENTRY`;
- `OUTBOUND`;
- `TRANSFER`;
- `INVENTORY_ADJUSTMENT`;
- `INVOICE_CORRECTION`;
- `REVERSAL`.

Características:
- ledger append-only;
- movimentos consolidados não aceitam update/delete;
- cada movimento declara workspace, UG, material, tipo, delta e identidade de idempotência;
- `REVERSAL` referencia explicitamente o movimento compensado;
- correções futuras poderão preservar histórico sem sobrescrever movimentações anteriores.

### DEP-2.1 — Saldo agregado

Foi criado o contrato:

`warehouse_balance_v1`

Persistência:
- movimentos: `warehouse/{workspaceId}/movements/{movementId}`;
- saldo: `warehouse/{workspaceId}/balances/{materialId}`.

O saldo materializado:
- permanece vinculado ao material canônico da FASE 1;
- registra quantidade, revisão monotônica e último movimento;
- é atualizado na mesma transação Firestore do novo movimento;
- não pode ser alterado isoladamente pelas Rules;
- não substitui o ledger auditável.

As Firestore Rules exigem correspondência entre movimento criado e saldo resultante.

### DEP-2.2 — Idempotência

Cada operação repetível recebe uma chave de idempotência.

O ID do movimento é derivado deterministicamente por SHA-256 de:
- workspace;
- chave de idempotência.

Comportamento:
- repetir a mesma operação canônica não duplica saldo;
- replay válido retorna o movimento já existente;
- mesma chave com payload divergente gera conflito;
- o mecanismo prepara a futura integração NF → estoque sem implementá-la antecipadamente.

## Segurança e isolamento

O gate fundador das FASES 0 e 1 foi preservado.

Permanece obrigatório:
- identidade fundadora;
- sessão Google válida;
- workspace fundador `hgesm-aprov`;
- contexto compatível com o bootstrap fundador.

Usuários externos:
- não veem o módulo;
- não acessam a rota;
- não leem ledger;
- não leem saldo;
- não gravam no namespace logístico.

A sessão fundadora autenticada por senha continua bloqueada no ADM Depósito.

O namespace `warehouse` continua sem fallback para `canAccessWorkspace(workspaceId)`.

## Testes e checks

Resultado final do commit técnico `c806820a515bdecf928d19098e1e0d6d9e77c366`:
- Recovery guardrails: **aprovado**;
- Application CI: **aprovado**;
- Browser E2E com Firebase Emulator: **aprovado**;
- suíte multi-tenant Firestore Emulator: **aprovada**;
- gate permanente da FASE 0: **aprovado**;
- testes e gate da FASE 1: **aprovados**;
- testes `test:adm-deposito-ledger`: **aprovados**;
- gate `verify:adm-deposito-phase-2`: **aprovado**;
- Production build: **aprovado**;
- TypeScript final: **aprovado**;
- Diff hygiene: **aprovado**;
- release gates 16, 17, 18, 19, 20 e 21: **aprovados**.

Ocorrências resolvidas durante o desenvolvimento:
1. uma edição intermediária de `firestore.rules` gerou duplicação textual anormal; o problema foi detectado antes do PR e o arquivo foi reconstruído a partir da `main`, deixando o diff final restrito ao esperado;
2. o primeiro Browser E2E falhou após um redirect com `window.location.replace('/')`, que provocava reload completo e expunha uma condição de runtime no servidor de desenvolvimento; a rota passou a usar `router.replace('/')`, mantendo o bloqueio e eliminando o problema;
3. o guard legado da FASE 0 foi atualizado para reconhecer o redirect seguro via App Router;
4. um primeiro rerun do Production build falhou transitoriamente dentro de `next/font`; o rerun subsequente passou sem alteração adicional de código, confirmando falha externa/transitória do runner.

## Arquivos principais da FASE 2

- `lib/warehouse/movement.ts`;
- `lib/warehouse/ledgerRepository.ts`;
- `lib/warehouse/namespace.ts`;
- `firestore.rules`;
- `scripts/warehouse-ledger-contract.test.mjs`;
- `scripts/firestore-multitenancy-security.test.mjs`;
- `scripts/verify-adm-deposito-phase-2.mjs`;
- `scripts/verify-adm-deposito-phase-0.mjs`;
- `.github/workflows/application-ci.yml`;
- `package.json`;
- `app/adm-deposito/page.tsx`;
- `app/api/adm-deposito/status/route.ts`;
- `features/warehouse/components/WarehouseFoundationView.tsx`.

## Decisões arquiteturais consolidadas

A FASE 2 aplica diretamente:
- D-004 — estoque baseado em movimentos;
- D-005 — correções preservam histórico;
- D-026 — isolamento por workspace/UG;
- D-028 — redução de trabalho e prevenção de duplicidade.

Foram registradas também:
- D-029 — identidade idempotente de movimentos;
- D-030 — saldo materializado somente como projeção transacional do ledger.

## Riscos e pendências

1. A FASE 3 deverá reutilizar o ledger da FASE 2; não deve criar uma segunda lógica de saldo.
2. NF → estoque deverá fornecer chaves de idempotência estáveis e ligações permanentes à origem.
3. Alterações/cancelamentos de NF deverão usar movimentos compensatórios, nunca sobrescrever ledger.
4. O PR #160 continua sendo uma mudança paralela relevante em autenticação/Firestore Rules e deve ser reconciliado com a `main` real antes de uma futura integração.
5. A Vercel apresentou rate limit de deploy durante esta execução. Não foi usado Cloud Shell para forçar publicação, seguindo a diretriz de consolidar intervenções externas quando possível.

Pendências bloqueantes da FASE 2:
- nenhuma no código, testes, CI ou integração com a `main`.

## Fora do escopo confirmado

Não foram implementados nesta fase:
- NF → estoque;
- ligação NF ↔ movimento;
- correção/exclusão de NF refletida no ledger;
- cutoff/data de ativação logística;
- SISCOFIS/Marco Zero;
- depósitos/localizações;
- lotes/validade;
- scanner;
- saída expressa;
- mapa do depósito;
- inventário;
- expansão para usuários externos.

## Próxima fase prevista

**FASE 3 — Nota Fiscal → estoque**

Blocos previstos conforme `ROADMAP.md`:
- DEP-3 — Entrada automática pela NF;
- DEP-3.1 — Ligação permanente NF ↔ estoque;
- DEP-3.2 — Alterações de NF;
- DEP-3.3 — Exclusão/estorno controlado;
- DEP-4 — Data de ativação logística.

**A FASE 3 NÃO FOI INICIADA NESTE CHAT.**

## Gate para o próximo chat

Antes de qualquer modificação:

1. Ler `README.md`, `ROADMAP.md`, `DECISIONS.md`, este `STATUS.md` e `HANDOFF_TEMPLATE.md`.
2. Consultar a `main` real.
3. Usar `9d4156a8e37cd6c3337afdd31747456eb9935664` como baseline operacional final da FASE 2.
4. Comparar qualquer commit posterior a esse SHA.
5. Verificar o estado do PR #160 e reconciliar mudanças em autenticação/Firestore Rules antes de editar as mesmas regiões.
6. Executar somente a FASE 3 em um novo chat.
