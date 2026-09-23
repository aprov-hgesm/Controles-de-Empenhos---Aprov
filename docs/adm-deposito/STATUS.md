# ADM Depósito — Estado Atual

Este arquivo registra o estado real de continuidade do projeto.

## Estado geral

Status: **FASE 3 CONCLUÍDA — WALKING SKELETON INTEGRADO**

Data do fechamento: 2026-09-23.

Situação:
- FASES 0, 1, 2 e 3 estão concluídas, validadas e integradas à `main`;
- ROADMAP V2 permanece vigente;
- piloto continua exclusivo da conta fundadora;
- usuários externos continuam sem visibilidade e sem acesso ao módulo;
- o ADM Depósito agora possui corpo estrutural completo e navegável;
- nenhuma funcionalidade operacional da FASE 4+ foi antecipada;
- nenhuma nova coleção Firestore, Rules, fonte de saldo, ledger ou material foi criada na FASE 3.

## Repositório e baseline

Repositório:
`aprov-hgesm/Controles-de-Empenhos---Aprov`

Branch oficial:
`main`

HEAD inicial auditado antes da FASE 3:
`d0dcd2f003a7d02c599772a32ce4c7a2e018f53d`

Esse HEAD correspondia ao PR #163 / reorganização documental que adotou o ROADMAP V2.

Branch de implementação:
`feat/adm-deposito-phase-3-walking-skeleton`

PR de implementação:
- PR #164 — `feat: add ADM Depósito phase 3 walking skeleton`;
- integrado por squash após validação técnica completa.

Commit funcional final da FASE 3 na `main`:
`0b8aed23da504deeb0bd18de404f0298a7c7cf2c`

Esse commit é o **baseline funcional oficial da FASE 3**.

## Fases concluídas

### FASE 0 — Fundação e isolamento
Concluída e preservada.

### FASE 1 — Fundação do material
Concluída e preservada.

Contrato canônico:
- material versionado;
- unidades/apresentações;
- identidade única por workspace/UG.

### FASE 2 — Ledger e saldos
Concluída e preservada.

Contratos oficiais:
- `warehouse_movement_v1`;
- `warehouse_balance_v1`;
- ledger append-only;
- saldo materializado como projeção do ledger;
- idempotência determinística.

### FASE 3 — Walking Skeleton
Concluída.

Objetivo atingido:
> transformar a fundação técnica do ADM Depósito em um módulo estruturalmente completo, navegável e preparado para receber as próximas fatias verticais sem antecipá-las.

## Arquitetura criada na FASE 3

A FASE 3 introduziu:

1. **Gate compartilhado de acesso**
   - `features/warehouse/components/WarehouseProtectedSurface.tsx`;
   - reutiliza autenticação, contexto de workspace e `canAccessWarehouseModule`;
   - confirma o acesso também pela API `/api/adm-deposito/status`;
   - acesso negado usa hard redirect para `/`;
   - permanece founder-only.

2. **Shell interno do ADM Depósito**
   - `features/warehouse/components/WarehouseModuleShell.tsx`;
   - identidade visual alinhada ao EMPROVEX;
   - navegação responsiva;
   - desktop, tablet e mobile;
   - sem animações pesadas ou nova dependência visual.

3. **Contrato de navegação**
   - `features/warehouse/navigation.ts`;
   - define as superfícies oficiais e suas rotas;
   - centraliza labels, caminhos e indicação das fases futuras.

4. **Conteúdo estrutural compartilhado**
   - `features/warehouse/components/WarehouseSectionContent.tsx`;
   - reutiliza contratos oficiais das FASES 1 e 2;
   - estados futuros são explícitos;
   - não simula dados operacionais;
   - não dispara queries ou listeners por simples navegação.

## Superfícies criadas

O módulo possui agora as nove superfícies-base oficiais:

1. Visão Geral — `/adm-deposito`;
2. Estoque — `/adm-deposito/estoque`;
3. Movimentações — `/adm-deposito/movimentacoes`;
4. Localizações — `/adm-deposito/localizacoes`;
5. Visão do Depósito — `/adm-deposito/visao-do-deposito`;
6. Inventário — `/adm-deposito/inventario`;
7. SISCOFIS / Conciliação — `/adm-deposito/siscofis-conciliacao`;
8. Entregas — `/adm-deposito/entregas`;
9. Configurações — `/adm-deposito/configuracoes`.

Cada superfície:
- abre dentro do mesmo shell;
- possui estado estrutural coerente;
- indica claramente quando a capacidade funcional pertence a uma fase posterior;
- não inventa indicadores;
- não cria persistência apenas para sustentar placeholder.

## Reutilização obrigatória confirmada

A FASE 3 reutiliza:
- material canônico da FASE 1;
- `warehouse_movement_v1`;
- `warehouse_balance_v1`;
- tipos oficiais do ledger;
- namespace `warehouse/{workspaceId}/...`;
- feature flag existente;
- gate founder-only;
- autenticação e resolução de workspace existentes;
- App Shell e identidade visual do EMPROVEX.

Não foram criados:
- segundo modelo de material;
- segundo ledger;
- segundo saldo;
- identificador paralelo de workspace;
- autenticação paralela;
- permissões logísticas externas;
- central paralela de alertas.

## Firestore e performance

A FASE 3 foi deliberadamente conservadora:

- `firestore.rules` não foi alterado;
- nenhuma coleção nova foi criada;
- nenhum índice novo foi necessário;
- nenhum listener novo foi adicionado;
- nenhuma query automática é executada por abrir uma superfície;
- nenhum preload do ledger foi introduzido;
- nenhuma escrita operacional ocorre no Walking Skeleton.

O PR #160 continua aberto em estado draft e não foi incorporado nem sobreposto pela FASE 3.

## Testes adicionados ou ajustados

Arquivos principais:
- `scripts/warehouse-walking-skeleton.test.mjs`;
- `scripts/verify-adm-deposito-phase-3.mjs`;
- `scripts/verify-adm-deposito-phase-0.mjs` ajustado para o gate compartilhado;
- `tests/e2e/operator-critical-flow.spec.mjs` ampliado para cobertura de rota interna do ADM Depósito.

Scripts:
- `npm run test:adm-deposito-walking-skeleton`;
- `npm run verify:adm-deposito-phase-3`.

Cobertura comprovada:
- nove superfícies roteáveis;
- navegação interna;
- founder-only preservado;
- usuário externo redirecionado;
- rota interna `/adm-deposito/estoque` também protegida;
- contratos das FASES 1 e 2 continuam disponíveis;
- ausência de nova persistência/listeners na UI estrutural;
- estados futuros honestos;
- responsividade estrutural.

## Gates finais da FASE 3

No HEAD final do PR #164:

- Recovery Guardrails: **PASS**;
- Application CI / validate-application: **PASS**;
- FASE 0 isolation guard: **PASS**;
- FASE 1 material tests + guard: **PASS**;
- FASE 2 ledger tests + guard: **PASS**;
- FASE 3 walking skeleton tests + guard: **PASS**;
- segurança multi-tenant: **PASS**;
- Production build: **PASS**;
- TypeScript final: **PASS**;
- Diff hygiene: **PASS**;
- Browser E2E with Firebase Emulator: **PASS**;
- Vercel preview: **PASS**;
- release gates agregados: **PASS**.

## Falhas encontradas durante a validação e correções

Duas regressões da própria FASE 3 foram detectadas antes do merge e corrigidas:

1. A primeira tentativa de concentrar o gate no `layout.tsx` não preservou corretamente o redirecionamento externo no Browser E2E.
   - solução: gate compartilhado no nível das superfícies via `WarehouseProtectedSurface`.

2. A transição client-side com `router.replace('/')` atualizava o URL, mas podia não remontar o App Shell dentro do timeout do E2E.
   - solução: acesso negado passou a usar `window.location.replace('/')`, encerrando a árvore logística e carregando a aplicação principal de forma limpa.

Também houve um erro sintático pontual no array de dependências durante essa troca, identificado pelo TypeScript error budget e corrigido antes da rodada final.

Nenhuma dessas falhas chegou à `main`.

## Arquivos principais da FASE 3

Novos:
- `features/warehouse/navigation.ts`;
- `features/warehouse/components/WarehouseModuleShell.tsx`;
- `features/warehouse/components/WarehouseProtectedSurface.tsx`;
- `features/warehouse/components/WarehouseSectionContent.tsx`;
- oito novas rotas estruturais sob `app/adm-deposito/*`;
- `scripts/warehouse-walking-skeleton.test.mjs`;
- `scripts/verify-adm-deposito-phase-3.mjs`.

Alterados:
- `app/adm-deposito/page.tsx`;
- `package.json`;
- `.github/workflows/application-ci.yml`;
- `scripts/verify-adm-deposito-phase-0.mjs`;
- `tests/e2e/operator-critical-flow.spec.mjs`.

Não alterados pela FASE 3:
- `firestore.rules`;
- `lib/warehouse/material.ts`;
- `lib/warehouse/materialRepository.ts`;
- `lib/warehouse/movement.ts`;
- `lib/warehouse/ledgerRepository.ts`;
- contratos persistidos da FASE 1 e da FASE 2.

## Riscos e pendências preservados

1. O PR #160 continua draft; qualquer futura evolução de autenticação/Firestore Rules deve ser reconciliada com a `main` real antes de editar regiões sobrepostas.
2. NF → estoque deve reutilizar o ledger da FASE 2 e o saldo materializado existente.
3. Nenhuma funcionalidade futura pode criar um segundo saldo concorrente.
4. Correções/cancelamentos de NF deverão usar movimentos compensatórios.
5. Isolamento por workspace/UG permanece obrigatório.
6. As superfícies da FASE 3 são estruturais; seus placeholders não representam funcionalidade operacional concluída.
7. Intervenções via Cloud Shell devem continuar consolidadas quando não forem bloqueantes.

## Próxima fase oficial

**FASE 4 — NF → Estoque**

A FASE 4 **NÃO foi iniciada** neste ciclo.

Ela deverá ser executada em uma nova conversa e mediante ordem explícita, seguindo o ROADMAP vigente.

## Gate para o próximo chat

Antes de modificar código:
1. ler `README.md`, `ROADMAP.md`, `DECISIONS.md`, `STATUS.md` e `HANDOFF_TEMPLATE.md`;
2. consultar a `main` real;
3. comparar o HEAD atual com o baseline funcional da FASE 3:
   `0b8aed23da504deeb0bd18de404f0298a7c7cf2c`;
4. analisar commits e PRs posteriores, especialmente alterações paralelas de autenticação/Rules;
5. executar exclusivamente a fase explicitamente solicitada;
6. não tratar as superfícies do Walking Skeleton como funcionalidades operacionais prontas;
7. atualizar `STATUS.md` ao fechar a próxima fase.
