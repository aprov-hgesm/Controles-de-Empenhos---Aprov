# ADM Depósito — Estado Atual

Este arquivo registra o estado real de continuidade do projeto.

## Estado geral

Status: **FASE 1 — CONCLUÍDA E APROVADA TECNICAMENTE**

Data de fechamento técnico: 2026-09-22.

Módulo:
- ADM Depósito / Área Logística;
- piloto permanece exclusivo da conta fundadora;
- usuários externos continuam sem visibilidade e sem acesso ao módulo;
- DEP-1 e DEP-1.1 estão concluídos;
- nenhuma funcionalidade da FASE 2 foi iniciada.

## Repositório e baseline

Repositório:
`aprov-hgesm/Controles-de-Empenhos---Aprov`

Branch oficial:
`main`

Branch da FASE 1:
`feat/adm-deposito-phase-1-material-foundation`

Branch de fechamento documental:
`docs/adm-deposito-phase-1-closure`

HEAD real da `main` no início da FASE 1:
`86be9a1db7dc340939cdd7a8ac76b679297b4ad5`

Baseline operacional final da FASE 0:
`cb1e0b652248122d7e49975c34f2362c04d7761f`

Auditoria inicial:
- a `main` ainda estava exatamente em `86be9a1db7dc340939cdd7a8ac76b679297b4ad5`;
- não existiam commits nem PRs mesclados após o fechamento documental da FASE 0;
- autenticação fundadora, isolamento por workspace/UG e namespace `warehouse` permaneciam íntegros;
- `firestore.rules` continuava sem fallback de `canAccessWorkspace(workspaceId)` para o namespace logístico;
- FASE 1 ainda não havia sido iniciada.

Commit técnico final da branch aprovado pelos gates:
`62d34f1ac0941d0eb16fd671504099f24d51c30c`

PR da implementação:
- PR #157 — `feat: establish ADM Depósito phase 1 material foundation`;
- merge via squash;
- commit final da implementação na `main`: `74e271e5b2b04367e75002dce4e8d7bebe72d63a`.

Após o merge do PR #157, a comparação de `74e271e5b2b04367e75002dce4e8d7bebe72d63a...main` retornou `identical`, 0 ahead e 0 behind.

## Última fase concluída

**FASE 1 — Fundação do material**

Blocos concluídos:
- DEP-1 — Modelo canônico de material;
- DEP-1.1 — Unidades e conversões.

## Implementação concluída

### DEP-1 — Modelo canônico de material

Foi criado o contrato de domínio versionado:

`warehouse_material_v1`

O material canônico possui:
- ID interno estável no formato `mat_<uuid sem hífens>`;
- `workspaceId`;
- UG;
- descrição principal;
- aliases normalizados e deduplicados;
- unidade canônica;
- status `active` ou `inactive`;
- lista explícita de conversões de apresentação.

A validação de domínio:
- normaliza workspace, UG, descrição, aliases e unidades;
- rejeita IDs, workspaces, UGs, status, unidades e conversões inválidos;
- pode exigir workspace e UG esperados;
- permanece independente de React e das futuras telas operacionais.

Persistência:
- domínio reservado utilizado: `warehouse/{workspaceId}/materials/{materialId}`;
- foi criado repositório Firestore específico para listar, obter e salvar materiais;
- nenhuma árvore paralela de dados foi criada;
- o documento persistido continua declarando o mesmo `workspaceId` do caminho Firestore.

### DEP-1.1 — Unidades e conversões

Unidades/apresentações iniciais suportadas:
- unidade;
- kg;
- g;
- L;
- mL;
- pacote;
- caixa;
- fardo;
- `other` para outras apresentações necessárias.

O contrato permite rótulos de apresentação, por exemplo:
- `Caixa 30 kg`;
- `Bombona 20 L`.

Conversões são explícitas para a unidade canônica do material por `factorToBaseUnit`.

A FASE 1 não cria saldo nem movimentação ao converter quantidades; a função de conversão é apenas parte do contrato reutilizável de domínio.

## Segurança e isolamento

A FASE 0 permanece integralmente preservada.

O gate continua exigindo:
- módulo habilitado;
- identidade fundadora;
- sessão Google válida;
- workspace fundador `hgesm-aprov`;
- contexto compatível com o bootstrap fundador.

As Firestore Rules da FASE 1:
- mantêm o gate fundador como condição obrigatória;
- validam o envelope canônico dos documentos em `materials`;
- exigem que `workspaceId` do documento corresponda ao workspace do caminho;
- impedem que o match genérico dos demais domínios funcione como bypass para `materials`;
- continuam sem usar `canAccessWorkspace(workspaceId)` como fallback para `warehouse`.

Cenários aprovados no Firebase Emulator:
- fundador grava material canônico;
- fundador lê material canônico;
- fundador lista materiais;
- documento não pode declarar workspace diferente do caminho;
- usuário externo não lê material do fundador;
- usuário externo não grava material nem usando o próprio workspace;
- sessão fundadora autenticada por senha não lê materiais;
- fundador não grava material em workspace externo.

O Browser E2E legado que comprova invisibilidade e bloqueio da rota para usuários externos também permaneceu aprovado.

## Arquivos principais alterados

- `lib/warehouse/material.ts`;
- `lib/warehouse/materialRepository.ts`;
- `lib/warehouse/namespace.ts`;
- `firestore.rules`;
- `scripts/warehouse-material-contract.test.mjs`;
- `scripts/firestore-multitenancy-security.test.mjs`;
- `scripts/verify-adm-deposito-phase-1.mjs`;
- `.github/workflows/application-ci.yml`;
- `package.json`;
- `app/api/adm-deposito/status/route.ts`;
- `features/warehouse/components/WarehouseFoundationView.tsx`.

## Testes e checks

Resultado final do commit técnico `62d34f1ac0941d0eb16fd671504099f24d51c30c`:
- Recovery guardrails: **aprovado**;
- Application CI: **aprovado**;
- suíte multi-tenant Firestore Emulator: **aprovada**;
- gate `verify:adm-deposito-phase-0`: **aprovado**;
- testes `test:adm-deposito-material`: **aprovados**;
- gate `verify:adm-deposito-phase-1`: **aprovado**;
- Browser E2E com Firebase Emulator: **aprovado**;
- Production build: **aprovado**;
- TypeScript final: **aprovado**;
- Diff hygiene: **aprovado**;
- release gates 16, 17, 18, 19, 20 e 21: **aprovados**;
- Vercel preview do PR #157: **Ready**;
- deploy automático da Vercel para o commit `74e271e5b2b04367e75002dce4e8d7bebe72d63a`: **success**.

Ocorrência resolvida durante o desenvolvimento:
- uma edição intermediária de `firestore.rules` na branch foi corrompida pelo mecanismo de substituição textual usado durante a automação;
- o problema foi detectado antes da abertura/validação final do PR;
- o arquivo foi reconstruído a partir da versão íntegra da `main`;
- o diff final de Rules ficou restrito à alteração esperada da FASE 1;
- CI, emulator, build e diff hygiene validaram a versão corrigida.

## Decisões arquiteturais

Nenhuma decisão definitiva nova foi necessária.

`docs/adm-deposito/DECISIONS.md` não foi alterado.

A FASE 1 permanece alinhada especialmente a:
- D-001 — piloto exclusivo da conta fundadora;
- D-012 — apresentações/conversões preparadas desde a fundação do material, sem antecipar scanner operacional;
- D-026 — isolamento estrutural por workspace/UG;
- D-028 — reduzir redigitação e manter contratos reutilizáveis.

## Riscos e pendências

Riscos conhecidos após a FASE 1:
1. Toda futura rota/API/serviço do ADM Depósito deve continuar reutilizando o gate fundador enquanto D-001 permanecer vigente.
2. A FASE 2 deverá usar o material canônico sem introduzir uma segunda identidade concorrente de item/material.
3. Conversões de apresentação existem como contrato; não devem ser confundidas com saldo, movimentação, código de barras ou embalagem operacional antes das fases correspondentes.
4. Alterações futuras em autenticação, workspace/UG ou Firestore Rules precisam ser comparadas com a `main` real antes de cada nova fase.
5. O deploy da aplicação na Vercel foi confirmado. Este ambiente não possui canal autenticado para publicar `firestore.rules` diretamente no projeto Firebase; portanto a versão nova das Rules foi confirmada no repositório e no Emulator, mas uma publicação independente das Rules de produção não foi presumida. Antes de expor qualquer gravação operacional de materiais, essa publicação deve ser confirmada.

Pendências bloqueantes da FASE 1:
- nenhuma no código, testes, CI ou integração com a `main`.

## Fora do escopo confirmado

Não foram implementados nesta fase:
- ledger de movimentações;
- saldo agregado;
- NF → estoque;
- entrada/saída operacional;
- lotes;
- validade;
- depósitos/localizações operacionais;
- inventário;
- SISCOFIS;
- scanner/código de barras operacional;
- FEFO;
- mapa do depósito;
- dashboard ou alertas de estoque;
- liberação para usuários externos.

## Próxima fase prevista

**FASE 2 — Ledger e saldos**

Blocos previstos conforme `ROADMAP.md`:
- DEP-2 — Ledger de movimentações;
- DEP-2.1 — Saldo agregado;
- DEP-2.2 — Idempotência.

**A FASE 2 NÃO FOI INICIADA NESTE CHAT.**

## Gate para o próximo chat

Antes de qualquer modificação:

1. Ler `README.md`, `ROADMAP.md`, `DECISIONS.md`, este `STATUS.md` e `HANDOFF_TEMPLATE.md`.
2. Consultar a `main` real.
3. Usar `74e271e5b2b04367e75002dce4e8d7bebe72d63a` como baseline operacional final da FASE 1.
4. Comparar qualquer commit posterior a esse SHA.
5. Avaliar impacto de mudanças intermediárias em autenticação, workspace/UG, Firestore Rules, Firebase e contratos de material.
6. Executar somente a FASE 2 em um novo chat.
