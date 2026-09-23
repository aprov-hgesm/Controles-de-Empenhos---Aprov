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

Branch de fechamento documental:
`docs/adm-deposito-phase-2-closure`

HEAD real da `main` no início da FASE 2:
`8a94a3f28c1ebaad4170d811e416d250252fce69`

Baseline técnico final da FASE 1:
`74e271e5b2b04367e75002dce4e8d7bebe72d63a`

Commit técnico final da branch da FASE 2 aprovado pelos gates:
`c806820a515bdecf928d19098e1e0d6d9e77c366`

PR da implementação:
- PR #161 — `feat: implement ADM Depósito phase 2 ledger and balances`;
- merge via squash;
- commit final da implementação na `main`: `9d4156a8e37cd6c3337afdd31747456eb9935664`.

Após o merge do PR #161, a comparação de
`9d4156a8e37cd6c3337afdd31747456eb9935664...main`
retornou `identical`, 0 ahead e 0 behind.

## Auditoria inicial da FASE 2

Antes da implementação:
- a `main` continha a FASE 1 concluída e o fechamento documental correspondente;
- commits posteriores ao baseline técnico da FASE 1 eram apenas documentação;
- o namespace `warehouse` continuava isolado e founder-only;
- a FASE 2 não possuía branch, commit ou PR anterior parcialmente executado;
- o PR #160 — `security: bind Firestore authorization to operational sessions` — estava e permanece em draft, fora do escopo da FASE 2;
- o PR #160 altera autenticação e `firestore.rules`, portanto deverá ser reconciliado com a `main` atual antes de qualquer futura integração.

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
- cada movimento possui ID interno determinístico;
- cada movimento pertence explicitamente a `workspaceId`, UG e material canônico;
- quantidades usam precisão controlada;
- direção/sinal da quantidade é validada por tipo;
- `REVERSAL` exige referência explícita ao movimento revertido;
- o ledger é append-only após persistência;
- update e delete de movimentos consolidados são negados pelas Firestore Rules.

Persistência:
`warehouse/{workspaceId}/movements/{movementId}`

### DEP-2.1 — Saldo agregado

Foi criado o contrato versionado:

`warehouse_balance_v1`

Persistência:
`warehouse/{workspaceId}/balances/{materialId}`

O saldo materializado possui:
- `workspaceId`;
- UG;
- `materialId`;
- quantidade agregada;
- revisão monotônica;
- referência ao último movimento aplicado.

Invariantes:
- movimento e saldo são gravados na mesma transação Firestore;
- um novo movimento não pode ser persistido sem o saldo correspondente;
- um saldo não pode ser alterado sem um novo movimento correspondente;
- criação do primeiro saldo inicia revisão 1;
- cada novo movimento incrementa a revisão;
- saldo continua derivado do ledger auditável.

### DEP-2.2 — Idempotência

A chave de idempotência:
- é normalizada;
- é combinada com o workspace;
- gera SHA-256;
- produz ID determinístico no formato `mov_<sha256>`.

Comportamento:
- repetir a mesma operação com a mesma chave e mesmo payload não reaplica o delta;
- replay idempotente retorna o movimento e saldo já existentes;
- mesma chave com payload divergente gera `WAREHOUSE_IDEMPOTENCY_CONFLICT`;
- a proteção é estrutural, não apenas de interface.

Isso prepara a futura FASE 3 para NF → estoque sem duplicar entradas quando uma operação for repetida.

## Segurança e isolamento

A FASE 0 continua preservada.

O módulo permanece:
- habilitado somente para o fundador;
- vinculado ao workspace `hgesm-aprov`;
- protegido na rota, API e Firestore;
- invisível e inacessível para usuários externos.

As Firestore Rules:
- continuam sem fallback de `canAccessWorkspace(workspaceId)` no namespace `warehouse`;
- validam os contratos de movimento e saldo;
- exigem correspondência com o material canônico ativo;
- impedem alteração/remoção do ledger consolidado;
- impedem saldo avulso sem movimento;
- impedem movimento sem atualização atômica do saldo.

Cenários aprovados no Firebase Emulator incluem:
- fundador cria movimento e saldo atomicamente;
- segundo movimento atualiza saldo e revisão;
- ledger é append-only;
- saldo não aceita alteração sem novo movimento;
- movimento não é aceito sem saldo correspondente;
- usuário externo não lê ledger;
- usuário externo não lê saldo;
- sessão fundadora por senha continua sem acesso ao módulo.

## Correções realizadas durante a FASE 2

### Reconstrução segura de Firestore Rules

Durante uma edição intermediária, uma substituição textual gerou duplicação anormal no arquivo `firestore.rules`.

O problema:
- foi detectado pela auditoria do diff antes do merge;
- chegou a produzir mais de 18 mil linhas adicionadas na branch intermediária;
- nunca foi integrado à `main`.

Correção:
- `firestore.rules` foi reconstruído a partir da versão íntegra da `main`;
- somente o bloco necessário da FASE 2 foi reaplicado;
- o diff final ficou restrito a aproximadamente 293 adições e 1 remoção no arquivo;
- Emulator, CI e diff hygiene aprovaram a versão final.

### Redirect da rota ADM Depósito

O Browser E2E revelou uma condição de runtime ao redirecionar usuário externo de
`/adm-deposito` para `/` usando `window.location.replace('/')`.

Sintoma observado no ambiente E2E:
- `SyntaxError: Unexpected end of JSON input`;
- resposta 500 transitória da página inicial;
- Fast Refresh realizando reload completo.

Correção:
- a rota passou a usar `useRouter().replace('/')`;
- o gate da FASE 0 foi atualizado para validar o redirect via router;
- o isolamento de acesso permaneceu o mesmo;
- Browser E2E completo passou após a correção.

## Arquivos principais alterados na FASE 2

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

## Testes e checks

Resultado final do commit técnico
`c806820a515bdecf928d19098e1e0d6d9e77c366`:

- Recovery guardrails: **aprovado**;
- Application CI: **aprovado**;
- Browser E2E com Firebase Emulator: **aprovado**;
- suíte multi-tenant Firestore Emulator: **aprovada**;
- gate `verify:adm-deposito-phase-0`: **aprovado**;
- testes `test:adm-deposito-material`: **aprovados**;
- gate `verify:adm-deposito-phase-1`: **aprovado**;
- testes `test:adm-deposito-ledger`: **aprovados**;
- gate `verify:adm-deposito-phase-2`: **aprovado**;
- Production build: **aprovado** na tentativa final;
- TypeScript final: **aprovado**;
- Diff hygiene: **aprovado**;
- release gates 16, 17, 18, 19, 20 e 21: **aprovados**.

Ocorrência externa não bloqueante:
- uma tentativa de Production build falhou dentro do loader `next/font`/Google Fonts;
- a repetição do mesmo commit passou sem alteração de código;
- foi classificado como falha transitória do carregamento de fonte no ambiente do runner.

## Deploy / publicação externa

O status automático da Vercel para o commit final da branch retornou:

`Deployment rate limited — retry in 24 hours.`

Isso não impediu:
- CI;
- build final;
- Emulator;
- Browser E2E;
- merge do PR #161;
- integração da FASE 2 à `main`.

Nenhuma publicação manual via Cloud Shell foi exigida para validar a FASE 2.

Conforme a diretriz oficial do projeto, publicação externa pode ser consolidada com fases posteriores quando tecnicamente seguro.

As alterações de `firestore.rules` estão versionadas na `main`, mas não se deve presumir publicação produtiva dessas Rules sem confirmação explícita do pipeline/Cloud Shell correspondente.

## Decisões arquiteturais

Nenhuma nova decisão definitiva foi adicionada a `DECISIONS.md`.

A FASE 2 implementa decisões já congeladas, especialmente:
- D-001 — piloto exclusivo da conta fundadora;
- D-004 — estoque baseado em movimentos;
- D-005 — correções por compensação;
- D-026 — isolamento por workspace/UG;
- D-028 — reduzir redigitação e preservar contratos reutilizáveis.

## Riscos e pendências

1. O PR #160 permanece draft e agora está baseado em uma `main` anterior à FASE 2. Antes de qualquer merge futuro, deve ser atualizado/reconciliado, principalmente em `firestore.rules`.
2. A FASE 3 deverá reutilizar `warehouse_movement_v1`, `warehouse_balance_v1` e o mecanismo de idempotência; não deve criar uma segunda fonte de saldo.
3. A ligação NF → estoque deve usar movimentos e nunca sobrescrever saldo diretamente.
4. Correção/exclusão de NF deverá usar movimentos compensatórios conforme D-005.
5. Deploy produtivo de Rules e Vercel deve ser confirmado em gate operacional futuro; não presumir publicação apenas porque o código foi integrado.
6. O piloto continua founder-only; usuários externos não devem ser habilitados antes do gate previsto no roadmap.

Pendências bloqueantes da FASE 2:
- nenhuma no código;
- nenhuma nos testes;
- nenhuma no CI;
- nenhuma na integração com a `main`.

## Fora do escopo confirmado

Não foram implementados nesta fase:
- geração automática de estoque a partir de NF;
- ligação permanente NF ↔ movimento;
- correção/exclusão de NF conectada ao ledger;
- cutoff/data de ativação logística;
- Marco Zero SISCOFIS;
- depósitos/localizações operacionais;
- lotes/validade/FEFO;
- scanner/código de barras operacional;
- mapa do depósito;
- inventário;
- dashboard/alertas logísticos;
- liberação para usuários externos.

## Próxima fase prevista

**FASE 3 — Nota Fiscal → estoque**

Blocos previstos conforme `ROADMAP.md`:
- DEP-3 — Entrada automática pela NF;
- DEP-3.1 — Ligação permanente NF ↔ estoque;
- DEP-3.2 — Alterações de NF por movimentos compensatórios;
- DEP-3.3 — Exclusão/estorno controlado;
- DEP-4 — Data de ativação logística.

**A FASE 3 NÃO FOI INICIADA NESTE CHAT.**

## Gate para o próximo chat

Antes de qualquer modificação:

1. Ler `README.md`, `ROADMAP.md`, `DECISIONS.md`, este `STATUS.md` e `HANDOFF_TEMPLATE.md`.
2. Consultar a `main` real.
3. Usar `9d4156a8e37cd6c3337afdd31747456eb9935664` como baseline técnico final da FASE 2.
4. Comparar qualquer commit posterior a esse SHA.
5. Auditar o estado do PR #160 e qualquer alteração intermediária em autenticação, workspace/UG, Firestore Rules, Firebase ou contratos do ADM Depósito.
6. Reutilizar o ledger, saldo materializado e idempotência existentes.
7. Executar somente a FASE 3 em um novo chat.
