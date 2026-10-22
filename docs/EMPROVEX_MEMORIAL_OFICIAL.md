# EMPROVEX — Memorial Oficial

## PUBLICAÇÃO CONGELADA — RELEASE ÚNICA, POWERSHELL PROPRIETÁRIO (20/10/2026)

- Processo de deploy já validado pelo Fundador: alterações consolidadas em um único commit na main, gates de CI, prebuild e deploy manual Vercel pelo PowerShell na equipe `aprov-hgesms-projects`.
- A ausência de acesso do conector Vercel do ChatGPT é **irrelevante** para a publicação pelo PowerShell proprietário. Não exigir novas contas ou membros pagos; não criar projeto alternativo.
- A configuração `vercel.json` mantém `git.deploymentEnabled=false`, portanto integrar a main não atualiza automaticamente `emprovex.com.br`.
- Runbook: `docs/EMPROVEX_RELEASE_POWERSHELL.md`. Fazer `vercel.cmd pull --environment=production`, `vercel.cmd build --prod`, `vercel.cmd deploy --prebuilt --archive=tgz --prod --skip-domain` e, após smoke/IAM GO, `vercel.cmd promote` usando o MESMO deployment.
- Regras Firestore reduzidas **não** são ativadas no mesmo deploy. Preservar as Rules produtivas até validação e janela de corte própria. O Marco Zero SISCOFIS ainda usa projeção UNASSIGNED de compatibilidade; acompanhar em release.
- O executor GitHub pode compor/certificar/mesclar o código, mas não operar a sessão PowerShell local. O Fundador executa prebuild e deploy na própria conta.

**Handoff:** onde — PR #349 certificado e preparando squash único em main; fazendo — commit/documentação/gates; quem — executor GitHub; próximo — PowerShell proprietário: prebuild, staged, testes de IAM e promover; quem — Fundador.

---

## HARDENING DE SEGURANÇA E PREPARAÇÃO DA HOSPEDAGEM — 20/10/2026

- **PR #349 (RC sobre main, sem merge):** motor de ledger limitado internamente ao Marco Zero SISCOFIS (chave de origem validada, tipo `INITIAL_BALANCE`, fonte nula); API `LEDGER_MOVEMENT` agora retorna 403 `WAREHOUSE_LEDGER_DIRECT_COMMAND_DISABLED` sem executar transação. Elimina a capacidade de forjar `quantityDelta` e saldo `UNASSIGNED` pela operação genérica. Motores especializados de NF/alocação, saída, devolução, transferência e inventário permanecem disponíveis. Atenção: helper legado `ensureWarehouseIntakeEntryContext` chama `applyWarehouseMovement`; se reutilizado no futuro precisa migrar, a alocação ativa delega a `allocateWarehousePendingItemFast`.
- **Provas regressivas:** novo `scripts/warehouse-server-command-security.test.mjs` no Application CI, Emulator rejeita tentativas internas fora do SISCOFIS e Browser E2E testa recusa explícita de seis tipos de ledger com 403; não considerar aprovado sem resultados SUCCESS do HEAD final.
- **Hospedagem:** nova API restrita ao fundador `GET /api/central-depositos/health`, que valida token de servidor e transação somente de leitura em `emprovex-warehouse`, sem devolver chaves ou payload Firestore. O E2E localhost cobre acesso sem token negado e caminho fundador no Emulator; check com IAM real só no deployment de staging autorizado.
- **Bloqueio externo confirmado:** integração Vercel disponível pertence a outra equipe e retorna 403 para `aprov-hgesms-projects`. Não foi possível ler, criar ou alterar variáveis do projeto real; não foram usados segredos fora da equipe. `vercel.json` mantém deploy por Git desativado.
- **Plano e segurança operacional:** `docs/WAREHOUSE_HOSTING_PREPUBLICACAO.md`. Configurar `FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON` apenas server-side no escopo correto com IAM mínimo; jamais compartilhar segredo na conversa ou rodar workflow PR com secret de produção. Validar staging `--prod --skip-domain`, founder-only health, workspace isolado, rollback, só depois Rules server-only e promoção ao domínio.
- **Produção:** não tocada. NO-GO para merge/deploy/promote/Rules até CI integral do HEAD, credenciais Vercel e IAM real comprovadas, QA/aceite isolado e autorização do Fundador.

**Handoff:** onde — PR #349 Draft com hardening de segurança; fazendo — validar TypeScript, guard de ledger, Playwright localhost e CI integral; quem — executor GitHub; próximo — obter concessão da integração à equipe Vercel proprietária, executar staged check e decidir GO sem tocar em workspaces reais; quem fará — Fundador para acesso/autorização, executor para CI e QA.

---

## RELEASE CANDIDATE DE INTEGRAÇÃO — 20/10/2026 · WAREHOUSE SERVER R2 + CI LEAN

> **Documento de integração, não comprovante de publicação.** Esta branch é composta diretamente sobre a main atual, preservando as atualizações anteriores do memorial e unindo as mudanças dos PRs #347 e #348. Os testes do RC e o aceite de Preview/Rules ainda devem ser verificados separadamente.

- **Origem funcional:** PR #348, HEAD `049d7e55e3b890ecb85b45cc01f2f5ac9137a89e` (sobre PR #347). No HEAD original, Application CI integral com seis gates, Core Protection, Fast CI, Auth/Firestore Smoke e Browser E2E tiveram **SUCCESS**.
- **Motivo da composição:** PR #347 ainda era DRAFT e incompatível para merge direto com a main atual; não descartar as atualizações da main nem tentar alterar produção sem validação da composição.
- **Política CI LEAN:** PR em desenvolvimento recebe Fast CI/Core; PR pronto para revisão e main mantêm certificação integral. Os gates completos de release permanecem obrigatórios.
- **Rules:** `firestore.warehouse.server-only.rules` é candidato NÃO PUBLICADO. O banco atual continua com as Rules vigentes até análise de equivalência e validação em ambiente isolado; não aplicar o arquivo reduzido por simples substituição sem conferir os demais acessos.
- **Não é autorização automática de publicação:** nunca fazer merge/publicar/promover sem CI PASS no RC, verificação de configuração administrativa do backend, Preview autenticado, isolamento workspace/UG e aprovação operacional. O conector Vercel não possui autorização atual na equipe administrativa de produção.

**Handoff:** onde — branch release candidate construída em cima de `main@abb111e6`, com conteúdo funcional de #347+#348; fazendo — validar CI e identificar blockers externos de Preview/Rules; quem — executor GitHub; próximo — PR de integração para main, CI completo e QA isolado, publicação apenas com autorização e ambiente acessível; quem fará — executor GitHub/Coordenador e Fundador para operação Vercel.

---
## CONFIRMAÇÃO FINAL DE TESTES — EMPROVEX CI LEAN (20/10/2026)

- **Fast CI do código atualizado:** `cd6308ae95d0a82737f5b84438ec24a5107ac517` — [EMPROVEX Fast CI #39526632360](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/runs/39526632360) **SUCCESS**, incluindo TypeScript, scanner estrito zero SDK client writes e testes unitários selecionados por diff. [Core Protection #39526632356](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/runs/39526632356) **SUCCESS**.
- O Fast CI identificou um teste de devolução anteriormente não executado na suíte integral. Foi modernizado para verificar o tipo de movimento **OUTBOUND_RETURN**, autorização/posição física, limite de devolução, saldo, histórico e idempotência **no motor servidor**. O teste atualizado passou e agora também está incluído como gate do Application CI integral.
- **Estado intencional da branch:** Application CI, Warehouse Smoke e Browser E2E aparecem como SKIPPED no SHA `cd6308ae` por se tratar de PR **DRAFT**. Isso NÃO é um PASS de release. A última certificação integral efetivamente executada permanece no SHA funcional `40c5a6ad`, com todos os jobs SUCCESS. A mudança posterior abrange testes, documentação e workflows, não motores de produção.
- **Obrigação antes de merge/publicação:** marcar PR como ready, executar Application CI integral (incluindo o novo teste de devolução), Core, Smoke, Browser E2E e QA necessário no HEAD de release. Não houve merge, alteração de Rules em produção ou deploy nesta execução.

**Handoff:** onde estamos — PR #348 DRAFT e CI LEAN validado; o que fazemos — apenas registrar evidência, preservando a produção; quem faz — executor GitHub; próximo — preparar PR para ready e recertificar HEAD completo quando houver decisão de integrar/ativar Rules; quem fará — executor/Coordenador com autorização expressa do Fundador.

---

## EMPROVEX CI LEAN — Implementação real após certificação (20/10/2026)

> Este registro é posterior à seção de proposta CI LEAN. O modelo foi implementado nos workflows do PR #348, mas não publicado nem incorporado à main.

- **Certificação do código funcional:** commit `40c5a6ad7f11fc5dbbbf720191f895ad177a30df`. Application CI completo **SUCCESS** (run #39524796663, com seis gates finais PASS), Core Protection **SUCCESS** (#39524796550), Warehouse Server R2 Smoke **SUCCESS** (#39524796528), Browser E2E **SUCCESS** (#39524796594). Build, TypeScript, Recovery, segurança e auditoria estrita zero SDK writes concluídos no Application CI. A auditoria de SDK é estática e cobre os diretórios mapeados.
- **Implementação CI LEAN:** commit `871c1ee4833f180527b7245d284e8e10996e9b18` cria `.github/workflows/emprovex-fast-ci.yml` e `scripts/ci-fast-tests.mjs`, separa Draft (Fast CI + Core Protection) de PR pronto (Application CI completo, Smoke e Browser E2E aplicável). Preserva Application CI em push main e workflow_dispatch.
- **Seleção de testes:** alterações Warehouse executam subconjuntos unitários por arquivos afetados, deduplicados; o runner acumula as falhas e reprova se alguma ocorrer. Mudanças de autenticação, Rules e recuperação possuem guards rápidos específicos. TypeScript e scanner zero-client-write executam sempre no Fast CI.
- **Economia:** PR Draft não inicializa repetidamente Browser/Chromium e Firestore Emulator nem roda Application CI integral em cada commit. Os jobs pesados continuam disponíveis por workflow_dispatch e são executados ao marcar PR como ready para revisão; não se dispensou o gate de release. O Core Protection separado permanece automático.
- **Proteção:** Full CI em SKIPPED no Draft **não é PASS de release**. Antes do merge, deixar PR não-Draft e exigir todos os gates no HEAD final, incluindo Firestore/Rules, isolamento, recuperação, QA e teste humano aplicável. Proteção efetiva de branch/ruleset deve ser conferida separadamente; não pressupor existência.
- **Sem impacto na produção:** nenhum merge, deploy, alteração das Rules ativas, gravação de dados reais ou mudança de workspaces.
- **Documentação:** `docs/CI_LEAN_20261020.md` e `docs/WAREHOUSE_SERVER_R2_MIGRATION.md`.

**Handoff:** onde estamos — PR #348 DRAFT, motor certificado no SHA `40c5a6ad`, CI LEAN implementado no SHA `871c1ee4`; o que fazemos — confirmar Fast CI e manutenção dos gatilhos; quem faz — executor GitHub; próximo — revisar FAST PASS no SHA do código CI, ativar release gates ao converter PR para ready somente na preparação do merge, manter Rules de produção intactas até autorização; quem fará — executor/Coordenador e Fundador para publicação.

---

## DIRETRIZ DE DESENVOLVIMENTO — EMPROVEX CI LEAN (20/10/2026)

> **Decisão de organização registrada, ainda não implementada nos workflows.** Objetivo: desburocratizar a validação durante o desenvolvimento, sem reduzir as garantias de segurança, integridade de estoque ou exigências de release. Não confundir recomendação com gate já alterado.

### Diagnóstico objetivo
- O `.github/workflows/application-ci.yml` da branch WAREHOUSE-SERVER-R2 possui **738 linhas**, dezenas de guards e três grandes sobreposições de validação: Application CI, Warehouse Server R2 Smoke e Browser E2E. Um ajuste isolado no Warehouse pode provocar testes de SAG, Administração, relatórios e estética sem mudanças nesses módulos.
- Houve múltiplas falhas de **guards de presença literal de código antigo**, que exigiam `runTransaction`/`writeBatch` ou variáveis no navegador após migração para transações autenticadas no servidor. Corrigir esses guards preservando seus invariantes de comportamento; não recriar o código cliente antigo e não silenciar a reprovação.
- Parte do custo/tempo é repetição de `npm ci`, inicialização de Firebase Emulator e instalação do Chromium em cada rodada. O ganho de tempo ainda **não foi medido**; não registrar percentuais inventados.

### Política proposta de testes proporcionais ao risco
1. **Nível 1 — Fast CI (cada alteração):** TypeScript, auditoria estrita de zero gravações diretas no cliente, Core Protection e testes unitários/contratuais dos arquivos/domínios alterados. Execução curta, automática e bloqueante.
2. **Nível 2 — Integração dirigida (ao concluir uma funcionalidade e após mudanças de risco):** Firestore Auth/Emulator com cenários positivos e negativos do motor afetado. Obrigatórios sempre que houver efeitos sobre saldo agregado/localizado, lotes FEFO, histórico, replay/idempotência, concorrência, autenticação, workspace/UG ou contratos de API. Testar estados adversos e degradação, sem usar dados produtivos para o smoke.
3. **Nível 3 — Certificação integral (antes do merge/deploy/corte de Rules):** Application CI completo, proteção Core, segurança multi-tenant, Recovery, build, testes de integração, Browser E2E aplicável, QA Preview e aceite humano quando necessário. Reexecutar sobre o **HEAD funcional final** se uma correção invalidar a certificação.

### Simplificações aprovadas como diretriz de trabalho (não executadas ainda)
- Criar pipeline **EMPROVEX Fast CI**, orientado a caminhos alterados. Mudanças em bibliotecas compartilhadas, autenticação, modelos, persistência, Rules, CI ou infraestrutura acionam validações transversais adequadas; nunca permitir que um filtro deixe uma alteração crítica sem gate.
- Substituir progressivamente guards que procuram strings por testes de **resultado observável**, preservando bloqueio para regressão. Preferir resultado de movimento/saldo/lote, isolamento de workspace/UG, transação, replay e concorrência a nomes ou posição textual de funções.
- **Consolidar falhas por rodada:** executar os testes pertinentes de modo que gerem um relatório único de erros e falhar ao final se qualquer um reprovar. Não usar `continue-on-error` como aprovação e não mascarar erros.
- Evitar rodar o mesmo smoke do servidor simultaneamente em múltiplos workflows: reutilizar o resultado de um job especializado ou racionalizar testes, preservando o gate. Corrigir `paths` do Warehouse Smoke para cobrir todos os novos motores e seus testes.
- Executar Browser E2E completo sob demanda e na certificação; nos commits apenas de testes/guard internos, rodar o subconjunto atingido. Não repetir publicação Vercel nem modificar Rules por causa de ajustes documentais ou de testes.
- Um PR/branch de integração, commits objetivos e workers paralelos **somente** em frentes independentes quando reduzirem trabalho real. Não criar PRs, rounds de auditoria e memorializações redundantes a cada correção.
- **Não dispensar:** estoque não negativo, conservação da transferência, FEFO, movimentações e histórico imutável, idempotência, concorrência, autorização real, workspace/UG, casos negativos, rollback/recovery e prova de zero escritas diretas pelo cliente.

### Estado real do WAREHOUSE-SERVER-R2 neste registro
- **PR [#348](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/348) DRAFT**, branch `feat/warehouse-server-r2-migration-20261020`, HEAD funcional auditado `690d20da9fca104bc66451a04ab42d95029bf8a8`. Não houve merge, deploy nem corte/ativação de Rules server-only.
- Nesse HEAD, **Core Protection**, **Warehouse Server R2 Smoke (Auth + Firestore Emulator)** e **Browser E2E** concluíram em **SUCCESS**. No Application CI, TypeScript, auditoria estrita **0 SDK client writes** (dentro dos diretórios examinados), os testes de segurança/contratos anteriores ao bloqueio passaram; o job completo terminou **FAIL**, não PASS.
- **Bloqueio exato:** `scripts/warehouse-depot-layout.test.mjs:451`, expressão regular inválida no teste de arquivamento: `assert.doesNotMatch(repository, /\\b(?:writeBatch|runTransaction)\\s*\\(/)` causa `SyntaxError: Invalid regular expression: Unterminated group`. Falha do arquivo **de teste**; corrigir sintaxe, verificar o teste localmente com `node --check` e `npm run test:adm-deposito-depot-layout` antes de repetir Application CI. Após isso, tratar quaisquer falhas reais posteriores sem eliminá-las.
- **Limitação importante:** o scanner `scripts/warehouse-r2-direct-write-audit.mjs` verifica padrões de operações do SDK em `lib/warehouse`, `features/warehouse`, `app/central-depositos` e `components/warehouse`; **zero ocorrências estáticas não é prova suficiente de segurança de todos os caminhos dinâmicos**. Manter review da autorização do motor, concorrência, transações, integridade, Rules e cobertura de rotas.
- CI LEAN é uma **proposta registrada**, não uma alteração feita agora. A certificação completa da migração #348 e a manutenção da produção continuam sob a política de bloqueios vigente até aprovação e implementação explícita de um novo pipeline.

### Handoff de continuidade — quem faz o quê
**Onde estamos:** migração server-only em PR #348/DRAFT, sem publicação; há um teste da Fase 9 com `SyntaxError` no HEAD funcional `690d20d`. **O que fazemos:** primeiro fechar corretamente a auditoria/certificação desse PR; em seguida separar e implementar o Fast CI/seleção de testes sem dispensar gates de release. **Quem faz:** executor técnico/GitHub. **O que fazer a seguir:** corrigir a regex do teste, executar o teste isolado, rerodar Application CI e resolver apenas blockers reais; após PASS completo, planejar refatoração de CI em alteração controlada. **Quem fará:** assistente executor no GitHub; Fundador autoriza qualquer merge, Rules ou deploy.

---

## REGISTRO DE INCIDENTE — 20/10/2026 · LIMPEZA DE MATERIAIS DE TESTE CONCLUÍDA (PR #347 DRAFT)

> **Registro documental na branch do PR #347, não publicado na `main`.** O estado de release do EMPROVEX continua sujeito aos gates independentes.

- **Banco/escopo:** `gen-lang-client-0982077967`, database `emprovex-warehouse`, workspace `hgesm-aprov`, UG `160416`. Autorização expressa do Fundador para excluir dados de materiais de teste, preservando a estrutura física.
- **Resultado do PowerShell:** `EXCLUÍDOS=3241/3241`; verificação final apresentada pelo Fundador: `VERIFICACAO=PASS; DOCUMENTOS_OPERACIONAIS_RESTANTES=0; ESTRUTURA_FISICA_PRESERVADA=PASS`.
- **Preservado e conferido:** 11 depósitos, 268 locais/subposições, 25 croquis, 1 configuração e 4 destinos (309 documentos).
- **Coleções de material/estoque/histórico/índices:** sem documentos operacionais restantes no momento da verificação. Backup local existente no ambiente do Fundador; manter protegido.
- **Nota operacional:** `intakeQueueIndex/state` é atualizado pela sincronização da fila; plano anterior abortou ao detectar mudança de versão (nenhuma exclusão), seguido de novo plano e execução bem-sucedida. A fila pode se reconstruir a partir de NFs que permanecem no módulo operacional.
- **Próximo passo P0:** PR #347 contém implementação parcial das Rules de `MANUAL_ENTRY` localizada e tratamento de leitura histórica. Falta executar Emulator, regressão, compilação e smoke humano; nenhuma publicação desse PR foi validada. Simplificar cadastro em transação consistente e economizar leituras redundantes mantendo workspace/UG, rastreabilidade e saldos corretos.
- **Detalhes:** `docs/incidents/WAREHOUSE_MANUAL_ENTRY_P0_20261020.md`.

---


## WAREHOUSE-SERVER-R2 — HANDOFF DE CONTINUIDADE (20/10/2026 · PR #348 · HEAD 94306ab)

**Natureza deste registro:** snapshot técnico para continuidade em outro chat; não representa conclusão, liberação de release nem autorização para cortar Rules. Verificado no GitHub em 20/10/2026 por ocasião da solicitação do Fundador. Em caso de commits posteriores, atualizar o HEAD/checks antes de continuar.

### Decisão e objetivo do Fundador
- Concluir a migração **integral** de TODAS as gravações da Central de Depósitos para motores no servidor confiável, prioritariamente **saída/devolução → inventário → alocação/NF → demais produtores**.
- Eliminar definitivamente SDK writes do navegador e celular e habilitar Rules mínimas de leitura/autorização e **negação total de gravação direta cliente**, **somente após** inventário estrito ZERO e CI/Emulator/E2E/segurança aprovados.
- Manter Firestore como banco, dados existentes (estrutura, saldo, lote, movimento, consumo, trilha histórica), isolamento por workspace/UG, autorização por identidade e proteção contra operações concorrentes/replay; preservar os demais módulos do EMPROVEX. Como o Fundador informou não haver usuários ativos na Central de Depósitos, a implantação pode ser única após certificação, não por fases operacionais.
- Diretriz de otimização: evitar leituras e writes redundantes; medir consumo efetivo do Firestore e impacto em custo antes/depois; não confundir redução de Rules com economia automática.

### Repositório e estado EXATO consultado
- Repositório: `aprov-hgesm/Controles-de-Empenhos---Aprov`.
- **PR #348 DRAFT e aberto**: https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/348
- Branch: `feat/warehouse-server-r2-migration-20261020`, HEAD consultado: **`94306ab51d1f0d8914b54ee0ad38352fcfc8dcc1`**; base empilhada `fix/warehouse-manual-entry-p0-audit-20261020` (PR #347, entrada avulsa server-side).
- **Sem merge, sem deploy, sem publicação das Rules server-only** deste PR; produção não alterada pela migração documentada nesta sessão.
- Memorial técnico da branch: `docs/WAREHOUSE_SERVER_R2_MIGRATION.md`. Auditoria de pontos restantes: `scripts/warehouse-r2-direct-write-audit.mjs`.
- Rules mínimas **somente preparadas**: `firestore.warehouse.server-only.rules`. Rules operacionais ativas não devem ser substituídas antes dos gates.

### Código já adicionado/refatorado no PR #348 (IMPLEMENTADO ≠ APROVADO)
- API autenticada `app/api/central-depositos/operations/route.ts`, `lib/warehouse/serverCommandClient.ts`, verificação de autorização por `verifyWarehouseRequest`, backend Firestore REST `lib/server/warehouseFirestoreTransaction.ts`.
- Operações expostas na rota: `TRANSFER`, `MATERIAL_SAVE`, `DESTINATION_CREATE`, `DESTINATION_STATUS`, `STRUCTURE`, `LANDING_VISUAL_SAVE`, `LOGISTICS_SETTINGS_SAVE`, `QUEUE_EXCLUDE`, `LOT_CREATE`, `LOT_UPDATE`, `EXPRESS_OUTBOUND`, `STOCK_RETURN`, `WITHDRAWAL_FINALIZE`, `INVENTORY_COUNT`, `INVENTORY_REVIEW`, `INVENTORY_REOPEN`, `INVENTORY_BEGIN_CONFIRM`, `INVENTORY_FINISH_CONFIRM`, `INVENTORY_CANCEL`, `INVENTORY_STALE`, `INVENTORY_ADJUST`, `INVENTORY_START`, `LEGACY_INTAKE_POSTED`. A presença no `switch` não comprova sucesso ou eliminação total do legado.
- Transferência por FEFO com lote/split e replay; material, destinos, depósito/local/subposição; configurações visuais/logísticas, fila NF, lotes manuais; saída expressa; devolução; retirada de múltiplas linhas com consumo e progresso retomável; inventário server-side em desenvolvimento (`lib/server/warehouseInventoryLifecycle.ts`, `warehouseInventoryAdjustment.ts` e demais motores). Registrar como **parcialmente certificado**, não como migração completa.
- A retirada processa linhas com progresso/idempotência: conferir consistência em falhas intermediárias e paralelismo; não presumir commit único para uma retirada inteira. O arquivamento estrutural via simples update foi bloqueado (`WAREHOUSE_ARCHIVE_SERVER_FLOW_REQUIRED`); falta implementar operação própria segura.

### RESULTADOS dos checks no HEAD 94306ab (consultados em 20/10)
- **EMPROVEX Core Protection: SUCCESS** — run `39507486562`.
- **Application CI: FAILURE** — run `39507486428`, job `validate-application` falhou em **TypeScript error budget** (10 erros; orçamento zero), principalmente:
  - `lib/server/warehouseInventoryLifecycle.ts`: retorno de tipos diferentes no mesmo `warehouseAdminTransaction` (item / summary / `{ok:true}`) nas linhas próximas a 75 e 103.
  - `lib/server/warehouseWithdrawalWrite.ts`: `WarehouseMaterialWithdrawal` incompatível com `Record<string, unknown>` no campo de `writes`, fazendo `header` ficar inferido como `unknown`; erros em torno das linhas 86, 113, 164, 165, 191 e 205.
  - Os gates finais derivados ficaram FAIL em cascata porque o job crítico falhou. **Não declarar Application CI PASS.**
- **Warehouse Server R2 Smoke: FAILURE** — run `39507486127`. Antes de parar, o log confirmou PASS para entrada avulsa e replay, transferência FEFO com split, lotes, saída expressa, devolução, estrutura e duplicidade, retirada com consumo e replay. Ao começar inventário, `warehouseInventoryLifecycleServer` disparou **`WarehouseStoreError: WAREHOUSE_SERVER_INVALID_DOCUMENT_PATH`**, `lib/server/warehouseFirestoreTransaction.ts:62`, originado em `fullName()` durante `warehouseAdminTransaction` chamada em `warehouseInventoryLifecycle.ts:103` (fixture `scripts/warehouse-server-manual-entry-emulator.ts:325`). **Investigar o caminho real, validar regex/estrutura de itens aninhados e manter o guard de escopo estrito; não relaxar paths genericamente.**
- **Browser E2E On Demand: IN PROGRESS** — run `39507486395` na consulta; verificar conclusão do run/novo HEAD antes de relatar PASS.
- Execuções PASS anteriores pertencem a SHAs anteriores e **não liberam** o HEAD atual.

### BLOQUEIOS restantes para a meta zero direct writes
- A auditoria histórica em começo da R2 identificou **109 pontos de escrita SDK cliente**; migrações subsequentes eliminaram parte deles. **Contagem atual NÃO certificada**. Não supor ZERO nem publicar porcentagem de conclusão.
- Ainda verificar e migrar completamente: inventário inteiro (início, contagem, revisão, ajuste, confirmação, cancelamento); retirada/consumo/devolução de todos os caminhos alternativos; alocação NF/intakes legados, código de barras, `ledgerRepository`, arquivamento de estrutura, croquis/layouts, índices/filas, SISCOFIS e demais gravações de `lib/warehouse`, `features/warehouse` e componentes auxiliares. Rastrear call sites e evitar manter bypass em outro repositório.
- Os testes dinâmicos precisam cobrir tenant/UG diferente, token não autorizado, estado suspenso/revogado, concorrência, saldo negativo, FEFO, lote órfão, duplicidade/replay, interrupção de lote de retirada, reativação de depósito e reconciliação de inventário; considerar limites/cotas Firestore.

### Passos operacionais para o PRÓXIMO CHAT (ordem obrigatória)
1. Reabrir PR #348 no GitHub, **consultar o HEAD atual** e os runs (não assumir que ainda é `94306ab`).
2. Corrigir todos os erros TypeScript relatados sem `any`, sem aumento de error budget, sem ignorar guard. Para warehouseInventoryLifecycle usar tipagem explícita de união retornada por transação; para WithdrawalWrite converter objetos de domínio para `Record<string,unknown>` sem perder validação, e tipar retorno `WarehouseMaterialWithdrawal`.
3. Reproduzir e corrigir o `WAREHOUSE_SERVER_INVALID_DOCUMENT_PATH` do inventário; inspecionar caminho exato e preservar o validador de documentos, sem abrir acesso genérico.
4. Rerodar `Warehouse Server R2 Smoke`, `Application CI`, `Core Protection` e `Browser E2E` no MESMO HEAD; investigar e corrigir cada FAIL, cobrindo cenários positivos/negativos.
5. Concluir operações ainda mutáveis pelo SDK cliente e executar `WAREHOUSE_R2_STRICT=1 node scripts/warehouse-r2-direct-write-audit.mjs`. Gate de corte: **ZERO**. Auditar também código fora dos diretórios percorridos pelo script e chamadas indiretas.
6. Validar Rules mínimas no Firestore Emulator: isolamento por workspace/UG, leitura autorizada, cliente sem escrita, motor backend IAM sem bypass; garantir Backup/Recovery e métricas de custo.
7. Somente com gates completos PASS, planejar corte único de Rules e release; **não publicar automaticamente sem validação/aceite do Fundador**. Não testar gravação com materiais reais em produção.

### Handoff no formato exigido
- **Onde estamos:** PR #348 DRAFT, branch `feat/warehouse-server-r2-migration-20261020`, HEAD de referência `94306ab`, migração parcial e CI/smoke bloqueados.
- **O que estamos fazendo:** levar todas as mutações Warehouse para servidores transacionais com segurança e economia de Firestore; o corte de Rules não ocorreu.
- **Quem está fazendo:** executor técnico com acesso ao GitHub e Actions; Fundador fornece diretrizes e aprova release.
- **O que fazer a seguir:** corrigir TS e path do inventário, certificar smoke, finalizar módulos legados, comprovar ZERO direct writes, CI/E2E/Core/Recovery PASS; só depois habilitar Rules simplificadas.
- **Quem o fará:** próximo worker/assistente técnico; Fundador apenas no aceite da publicação.

---

## BACKLOG APÓS WAREHOUSE-SERVER-R2 — MIGRAÇÃO DAS FIRESTORE RULES DO EMPROVEX PRINCIPAL (DECISÃO 20/10/2026)

> **PLANEJADO, NÃO IMPLEMENTADO. EXECUTAR SOMENTE APÓS A CONCLUSÃO E HOMOLOGAÇÃO DA CENTRAL DE DEPÓSITOS (WAREHOUSE-SERVER-R2, PR #348 DRAFT, dependente do PR #347).** Este registro é uma decisão de arquitetura e prioridade futura; não constitui autorização de merge, deploy, alteração imediata das Rules do banco principal ou modificação da produção.

### Objetivo e fundamento
- **Desburocratizar, reduzir consumo cobrado do Firestore e diminuir falhas de Security Rules**, sem enfraquecer o isolamento SaaS por usuário, workspace e UG.
- Repetir no restante do EMPROVEX o padrão arquitetural do Warehouse: cliente computador/celular -> API autenticada -> motores de domínio **no servidor confiável** -> transações Firestore com precondições, idempotência e auditoria. **Firestore continua sendo o banco.**
- Regras operacionais/de negócio passam para código executado no backend (não para JavaScript do navegador). Security Rules permanecem como **fronteira restritiva de acesso direto**, com leituras autorizadas e, para comandos efetivamente migrados, **nenhuma gravação pelo SDK cliente**. SDK Admin/REST com credencial de serviço deve ser protegido por IAM e nunca exposto ao cliente.
- Não usar `allow write: if true`; não liberar permissões genéricas; não aceitar workspace, UG, papel, ator, total, contador, saldo ou mudança de estado informados pelo navegador sem validação no servidor. Verificar Firebase ID token e estado ativo/autorizações, incluindo revogações/suspensões e acesso multi-tenant.

### Escopo da próxima frente, em ordem recomendada
1. **Notas Fiscais/SAG/NS (prioridade máxima):** mover para motor server-side as verificações atuais de `validInvoiceCreate/Update/Delete`, correspondência entre NF, empenho, fornecedor, UG, trava `sagNsLock_*`, unicidade por número/UG, mudança de titular, atualização e exclusão segura. Reservar NS em transação com identificador determinístico e reconciliar referências; evitar documentos órfãos e disputas concorrentes.
2. **Gestão de Empenhos (prioridade máxima):** cadastro, edição, revisão sequencial, vínculos com alertas/cronogramas/NF e exclusão por ciclo de vida com trava. Centralizar integridade, autoria, auditoria e tratamento de repetição no motor do servidor.
3. **Termos de Recebimento e Fornecedores (alta):** contador/numeração atômicos, proteção de duplicidade, identidade/CNPJ, campos imutáveis e vínculos documentais.
4. **Comissões, Cronogramas, Avisos e documentos (alta):** fluxos de atualização, condições de vínculo, estados e validações no servidor; preservar direitos específicos de cada setor.
5. **Auditoria, backups e legal (alta sensibilidade):** geração de eventos e status confiáveis no backend, preservando histórico append-only, autoria, horário e evidência de aceite expresso. Não flexibilizar a leitura das aceitações ou permitir que um operador forje aceite, backup ou auditoria.
6. **Indicadores, snapshots e cotas (otimização):** geração server-side do snapshot da Home, consolidação e contabilização por UG, eliminação de escritas sem alteração e leituras/listeners redundantes. Consolidar cálculo diário/semanal/mensal em R$ com valores de tarifa e consumo efetivamente observados.
7. **Administração SaaS e sessões (fase sensível):** contas/workspaces, faturamento, ciclos, assinaturas, suspensão, leases e revogação; priorizar backends já existentes e preservar resposta rápida de sessão, limites de acesso e revogação de identidades. Não migrar leases sem testes de concorrência e encerramento remoto.

### Observações técnicas da auditoria
- O banco principal usa `firestore.rules` (aproximadamente 2.552 linhas na revisão de 20/10/2026); o Warehouse usa `firestore.warehouse.rules` separadamente (aproximadamente 3.462 linhas). A redução de linhas é consequência desejável, **não a métrica de economia**.
- Pontos de custo: leituras dependentes nas Rules (`get`, `exists`, `getAfter`), consultas redundantes, ouvintes desnecessários, varreduras, atualizações inalteradas e projeções regravadas. **Mover lógica não economiza automaticamente**: leituras administrativas do servidor também são cobradas; pode haver custo de hospedagem adicional.
- Medir **antes e depois por comando/UG**: leituras, gravações, exclusões, verificações de Rules, latência, tamanho das operações, custo diário/semanal/mensal em R$ e economia real. Considerar preços e condições vigentes e que a cota gratuita não se multiplica por banco adicional.
- Conferir quais operações já utilizam servidor antes de reconstruí-las. Priorizar reutilizar infraestrutura de autenticação, verificação de papel, IAM, limites, logs, proteção de replay e testes.

### Gates obrigatórios — sem corte antecipado
- [ ] Central de Depósitos concluída, testes e QA aprovados; PR #348 e dependências tratados formalmente.
- [ ] Abrir **nova frente/PR específica para o banco principal**, sem substituir silenciosamente regras dos usuários ativos.
- [ ] Inventariar todos os call-sites de escrita direta, operações de negócio e permissões do banco principal; definir migração por domínio e plano de rollback.
- [ ] Implementar backend de cada domínio, testar escopos UG/workspace/papéis, concorrência, replays, limites, suspensão/revogação, preservação de trilha de auditoria e consistência transacional.
- [ ] Comparar consumo/custo real antes/depois; não prometer percentual de economia sem medição.
- [ ] Habilitar Rules mínimas/read-only **apenas depois** de constatar que os caminhos legítimos foram migrados, com Emulator Security, Browser E2E, Application CI, Core Protection, Recovery e smoke em QA.
- [ ] Nenhum merge/deploy de Rules ou alterações de produção sem gates PASS e autorização de release.

### Handoff futuro obrigatório
- **Onde estamos:** concluir a migração do Warehouse no PR #348; este tema do banco principal é backlog **pós-Warehouse**.
- **O que estamos fazendo agora:** registrar a decisão e seus critérios no memorial oficial; **não iniciar** esta nova migração nesta etapa.
- **Quem está fazendo:** coordenação técnica documenta e realiza auditoria; Fundador valida prioridade e posterior release.
- **O que fazer a seguir:** após a conclusão do Warehouse, abrir frente `FIRESTORE-CORE-SERVER-R1` começando por Notas Fiscais/SAG/NS, depois Empenhos, demais módulos e otimização de custo.
- **Quem o fará:** worker/coordenação técnica com GitHub, Emulator e CI; Fundador dá aceite de Preview/produção.

---

## ESTADO VIGENTE GLOBAL — 19/10/2026 · 3D PREMIUM R4 — PR #346 PUBLICADO

> **ESTADO DE PRODUÇÃO MAIS RECENTE.** Este registro prevalece sobre a seção histórica imediatamente abaixo intitulada “EMPROVEX R4 PUBLICADA”, que continua correta como marco anterior, mas não representa mais o deployment atualmente associado ao domínio.

### GitHub — melhoria pós-R4 consolidada

- **PR #346:** [WAREHOUSE R4 — profundidade de paletes e acabamento premium do piso/paredes](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/346), **MERGED / CLOSED**.
- **Commit funcional integrado por squash único:** `6d3fddae4b7212e745a75b241504f71541148a54`, sobre `main@9075c8e766ecd330210394238bf4cae63e503df0`. Não reexecutar o merge.
- **Mudança funcional:** apenas `features/warehouse/components/WarehouseIsometricPreview.tsx`. Ordem de pintura dos objetos considera a extensão da planta física, reduzindo sobreposição indevida entre paletes/freezers. Piso com tratamento industrial, juntas e brilho discreto; paredes com painéis e acabamento refinado.
- **Aceite visual:** Fundador aprovou a prévia em localhost:3001 antes do merge.
- **Gates no HEAD do PR pré-squash `0edf9a6d...`:** Application CI **SUCCESS**, EMPROVEX Core Protection **SUCCESS**, VISUAL-R1 W4 QA (isolated) **SUCCESS após reexecução**. O primeiro run de QA falhou em teste de hover de local vazio; a reexecução do mesmo run foi aprovada. Não atribuir essas execuções ao SHA pós-squash.
- **Sem alteração de Firestore, Rules, esquema, autorização, saldos ou migração.** As funcionalidades anteriores R4 permanecem preservadas.

### Vercel — publicação e promoção efetivamente confirmadas

- **Equipe/projeto:** `aprov-hgesms-projects/controles-de-empenhos-aprov`.
- **Domínio oficial:** https://emprovex.com.br
- **Deployment atual:** `dpl_FKhz2Jq9d6jpLRF1kvDL3y4QuiTV`, URL individual `https://controles-de-empenhos-aprov-qxnc2nql2-aprov-hgesms-projects.vercel.app`.
- **Método:** exportação limpa do commit aprovado, `vercel.cmd link`, `vercel.cmd deploy --prod --skip-domain --archive=tgz --scope aprov-hgesms-projects`, teste de `/api/health`, promoção do **mesmo deployment** com `vercel.cmd promote`, seguida por `vercel.cmd inspect https://emprovex.com.br`.
- **Evidência fornecida pelo Fundador:** deploy `Ready`; `/api/health` do URL individual retornou `{"status":"ok","timestamp":"2026-10-19T22:28:23.273Z"}`; comando de promoção retornou `Success!`; `inspect` do domínio oficial resolveu para o **mesmo ID `dpl_FKhz2Jq9d6jpLRF1kvDL3y4QuiTV`**, com status `Ready`. Assim, **promoção concluída e domínio conferido**.
- **Custo operacional reportado:** build 1m01s, pós-build 47s, duração faturável 2m / 4 CPU-minutos. Não realizar novo deployment para repetir a publicação.
- **Referência histórica para eventual rollback:** deployment anterior `dpl_6mQA5J1tuLNvQBnsaqdbVQcV9MUA` (R4 antes do PR #346). Rollback somente com autorização expressa.
- **Limite da evidência:** não houve confirmação documental de um novo smoke autenticado completo de todos os fluxos no domínio após a promoção. Saúde e inspeção de domínio foram verificadas, e o aceite visual ocorreu no localhost.

### Handoff oficial

**Onde estamos:** `main@6d3fddae` com PR #346 incorporado em squash único; melhoria 3D **publicada no domínio oficial** no deployment `dpl_FKhz2Jq9d6jpLRF1kvDL3y4QuiTV`. **O que estamos fazendo:** encerramento documental e preservação de evidências. **Quem está fazendo:** Fundador realizou publicação/promoção via Vercel CLI; Coordenador registra rastreabilidade. **O que fazer a seguir:** verificar a nova visualização no navegador autenticado em `emprovex.com.br` e acompanhar possíveis regressões; novos ajustes somente por branch isolada e sem redeploy redundante. **Quem fará:** Fundador valida o fluxo real, Coordenador trata eventuais regressões.

---

## ESTADO VIGENTE GLOBAL — 19/10/2026 · EMPROVEX R4 PUBLICADA

> **REGISTRO DE PRODUÇÃO VERIFICADO.** Esta seção supera os estados históricos que, mais abaixo, ainda mencionam PR #345 DRAFT, R4 aguardando publicação, PR #341 sem merge, ou itens de R2/R3 ausentes da main. As seções históricas continuam úteis como evidência da evolução, **não como o estado atual de publicação**.

### GitHub — consolidação definitiva em commit único

- **Repositório:** `aprov-hgesm/Controles-de-Empenhos---Aprov`.
- **PR integrado:** [#345 — RELEASE R4 Warehouse R2/R3 + 3D premium](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/345), **MERGED / CLOSED**.
- **Main consolidada:** `e61c2675e97990c6dd78ccdce0fc1a56a98561ca`, título `feat(release): EMPROVEX R4 depósitos 3D e funcionalidades recuperadas`.
- **Composição:** squash em **um único commit** diretamente sobre `main@2c30a354a466b6c727c90f1f4f83428ac8a54cfb`; o commit R4 tem um único pai, `2c30a354...`. A release anterior da main não foi descartada.
- **Head funcional aprovado e testado antes do merge:** `1664f805021ddcf7aa4baf913c75a243514f92b1` (`feat/warehouse-r3-restoration-consolidated`). O merge usa o mesmo conteúdo da entrega aprovada.
- **PR #344:** continua DRAFT como registro de desenvolvimento anterior; **seu conteúdo foi incorporado pela release consolidada #345**. Não fazer um segundo merge do #344 para repetir as mudanças. PRs históricos #331–#338 permanecem referências da origem do código recuperado, não uma fila de merges obrigatórios.

### Vercel — deployment R4 confirmado pelo Fundador

- **Projeto:** `controles-de-empenhos-aprov`; **equipe:** `aprov-hgesms-projects`.
- **Domínio oficial em produção:** [https://emprovex.com.br](https://emprovex.com.br).
- **Deployment R4 promovido:** `dpl_6mQA5J1tuLNvQBnsaqdbVQcV9MUA`.
- **URL individual:** `https://controles-de-empenhos-aprov-bvhzq2yed-aprov-hgesms-projects.vercel.app`.
- **Logs informados pelo Fundador:** `GITHUB_R4=PASS`, `FONTE_R4=PASS`, `PROJETO_VERCEL=PASS`, `DEPLOY_R4=PASS` (`Ready`), `SAUDE_R4=PASS`, `PROMOCAO_R4=PASS`, `INSPECAO_R4=PASS`.
- **Confirmação da promoção:** CLI retornou `Success!` para o **mesmo deployment `dpl_6mQA5J1tuLNvQBnsaqdbVQcV9MUA`** e consulta subsequente do domínio `emprovex.com.br` retornou o mesmo ID com `status Ready`.
- **Duração informada:** build remoto 1m19s, pós-build 56s, consumo de 3 minutos faturáveis (6 CPU-minutos). Não houve necessidade de um segundo build após o `promote`.
- **Método operacional certificado:** `git archive` do SHA aprovado em pasta isolada **sem `.git`**, `vercel.cmd link` no projeto administrativo correto, `vercel.cmd deploy --prod --skip-domain --archive=tgz --scope aprov-hgesms-projects`; consultar `/api/health`; depois `vercel.cmd promote <URL> --yes --scope aprov-hgesms-projects` e confirmar domínio com `vercel.cmd inspect`. Não utilizar `--prebuilt` nesta infraestrutura Hobby.
- **Referência histórica de rollback imediato:** deployment anterior confirmado `dpl_73K2tXFi9NQMw4v1YLn6HSuxtR8c` (main `2c30a354`). Qualquer rollback exige decisão expressa e conferência do alvo atual; não executar automaticamente.

### Cinco workflows aprovados — HEAD funcional `1664f805`

1. [Application CI #39310659373](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/runs/39310659373): **SUCCESS**.
2. [EMPROVEX Core Protection #39310659282](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/runs/39310659282): **SUCCESS**.
3. [Recovery Guardrails #39310659261](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/runs/39310659261): **SUCCESS**.
4. [SAAS-DL Legal Validation #39310659257](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/runs/39310659257): **SUCCESS**.
5. [VISUAL-R1 W4 QA (isolated) #39310659259](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/runs/39310659259): **SUCCESS**.

**Precisão:** esses cinco resultados se referem ao **HEAD funcional pré-squash `1664f805...`**, não a uma suposta nova execução no SHA do squash. O Fundador informou aprovação da prévia localhost antes de autorizar o merge e o deploy. A publicação foi validada pela saúde e inspeção do domínio; não afirmar que foi realizado um segundo smoke autenticado completo de todas as funções em produção sem nova evidência.

### Funcionalidades efetivamente incluídas na R4

- **R2 recuperada:** inspeção de locais no hover/foco/teclado, painel fixo abaixo da cena que não cobre equipamentos, modal de detalhes por local, relatório PDF com conteúdo/local/prateleira/lote/validade; detecção de locais vazios com saldo zero; pesquisa de material **em todos os depósitos do mesmo workspace**, navegando ao local e à subposição; cadastro de novos locais e subposições **em depósitos existentes**, com validações de integridade.
- **R3 recuperada:** apresentação sem sobreposição para inspeção e empilhamento de volumes em paletes com projeção isométrica; correções de `Meus Depósitos`; entrada detalhada de alocação de NF preservada em paralelo às ações em lote. Referência histórica da R3: `release/emprovex-r3-hotfix-inspecao-20261017@eb1935a9` e PRs #331–#338.
- **3D premium atual preservado:** geladeira de portas duplas e freezer baú, frente física coerente com o lado maior e quatro câmeras; **reflexo branco discreto se o equipamento estiver ocupado**; volumes apoiados e empilhados em paletes/mesas; caixas em níveis físicos e subposições de estantes; indicação de validade pela cor da caixa (**amarelo entre hoje e 14 dias inclusive**, **vermelho para vencidos**), com destaque suave do local.
- **Sem alerta inventado:** vínculo entre lote ativo, quantidade positiva, mesmo material e mesma posição física (depósito/local/subposição), baseado em saldo real; estados agregados para a estrutura sem confundir o saldo de outra posição.
- **Experiência existente preservada:** sidebar organizada e acesso à Central de Depósitos por setores externos autorizados, sem bypass do servidor, autenticação nem isolamento multi-workspace.

### Limites, banco e economia de cota

- **Sem alteração de Firestore Rules, esquema ou migração no ato da publicação da R4.** A atualização de código não executou movimentações ou alteração de saldos do Firestore; operações futuras da interface continuam sujeitas aos contratos de domínio e autorização.
- A sinalização visual usa leitura indexada de lotes por `expiresOn` até o 14º dia (inclui já vencidos), sob demanda, com limite de **500** e aviso explícito de cobertura potencialmente incompleta quando saturado. A inspeção detalhada e emissão de PDF consultam lotes completos separadamente somente quando necessárias, evitando listeners e leituras por hover/tecla/câmera.
- A regra geral de FEFO/alerta de vencimento de **30 dias** no domínio não foi substituída: **14 dias é a convenção visual da cena 3D**.
- Preservadas cautelas de custo de Firestore, integridade, permissões e isolamento entre UGs/workspaces.

### Handoff oficial — estado após a publicação

**Onde estamos:** `main@e61c2675` consolidada e **R4 promovida, Ready em `emprovex.com.br`**, deployment `dpl_6mQA5J1tuLNvQBnsaqdbVQcV9MUA`. **O que estamos fazendo:** registrar encerramento operacional da release e preservar rastreabilidade. **Quem está fazendo:** Fundador fez aceite local e deploy/promote administrativo via PowerShell; GitHub/assistente fez a reconciliação e integração. **O que fazer a seguir:** apenas conferir no navegador autenticado os fluxos de 3D, inspeção, PDF, busca global, cadastro e validade com dados permitidos; não executar novo deploy apenas para repetir publicação. **Quem fará:** Fundador valida operação, próximo executor corrige qualquer regressão em branch isolada. A migração Cloud Run permanece assunto independente e não foi executada nesta release.

**Documentação de origem:** `docs/releases/EMPROVEX_WAREHOUSE_R4_RECONCILIACAO_20261019.md`, `docs/adm-deposito/STOCK_3D_VISUAL_R1_20261019.md`; os textos desses arquivos descrevem etapas anteriores ao fechamento e devem ser lidos à luz deste estado de produção.

---


## HISTÓRICO — 2026-10-19 · ADMINISTRAÇÃO ORIGINAL VISUAL + TELEMETRIA POR UG R3 · PR #341

> **Este é o recorte vigente para o trabalho da Administração.** As notas históricas abaixo sobre ADMIN-2.0, EMPROVEX Command, novos módulos/13 abas ou CORE V2 foram **superadas** pela decisão expressa de abandonar aquele desenvolvimento. Permanecem como histórico, não como escopo autorizado.

### Decisões do Fundador e estado efetivo

- **ADMIN-2.0 abandonada:** PR [#339](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/339) fechado **sem merge**; antiga branch `feat/admin2-w01-sidebar-local-preview` excluída remotamente pelo Fundador via PowerShell (comando `git push origin --delete` confirmado). Não reativar o código antigo, as 13 abas propostas nem criar outra Administração paralela.
- **Novo trabalho autorizado:** melhorar **a Administração original de oito abas**, preservar todas as funções existentes e reaproveitar identidade visual do EMPROVEX operacional. Primeira etapa: fundo claro `#edf3fb`, cartões claros, tipografia contrastante, header escuro fixo e **sidebar escura fixa no desktop** com navegação agrupada e indicador luminoso do App Shell. Rota **`/admin`**, e não `/admin2-preview`.
- **Ampliação expressa posterior:** por solicitação do Fundador, foi implementada **telemetria por UG R3** dentro do mesmo desenvolvimento, ultrapassando o escopo inicialmente só estético. A alteração inclui código operacional de atribuição de eventos e `firestore.rules` **candidatas na branch**, não publicadas.
- **Repositório:** `aprov-hgesm/Controles-de-Empenhos---Aprov`.
- **Branch isolada:** `feat/admin-visual-organizacao-base-emprovex`.
- **PR:** [#341 — ADMIN-VISUAL + UG R3](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/341), **OPEN/DRAFT, sem merge**.
- **SHA de código certificado antes desta atualização documental:** `5c61636799c53b7464f387a07d37131ead490808`; o SHA mudará ao gravar este memorial, logo **reverifique os runs do novo HEAD antes de declarar certificação daquele SHA**.
- **Validações no SHA certificado:** Application CI **SUCCESS**, EMPROVEX Core Protection **SUCCESS**, SAAS-DL Legal Validation **SUCCESS**. Application CI incluiu testes multi-tenant no Firestore Emulator (novas categorias permitidas/rejeitadas), guardas das telemetrias v1/v2/R3, painel global, reconciliação, alertas, build e TypeScript. **CI verde não é autorização de publicação**.
- **Produção:** `main`, deploys, dados reais, cobrança, Auth, workspaces de usuários e Rules ativas **não alterados por esta iniciativa**.

### Escopo entregue no código da branch

1. **Navegação e estética:** mesma Administração de oito abas: Visão Geral, Setores, Cadastrar Setor, Consumo e Cotas, Sessões, Assinaturas, Backups e Segurança. Fundo claro, sidebar fixa, cabeçalho EMPROVEX, abas agrupadas, acabamento visual; funções originais mantidas.
2. **Consumo e Cotas compreensível:** resumo da cota; conceitos de leituras, gravações, listeners, atualização e `Read Units` explicados; Google global separado de estimativa por UG; diagnósticos técnicos recolhidos; ausência de amostra não apresentada como consumo zero.
3. **UG R3 — origem por módulo:** `empenhos`, `notas`, `deposito`, `sessoes`, `outros` nos eventos **que já são instrumentados**. O campo opcional `moduleOperations` fica no documento diário `workspaces/{workspaceId}/usageEstimates/{billingDay}`, usando buffer local e `increment()` no `setDoc(..., {merge:true})` existente, sem consulta/assinatura por evento.
4. **Compatibilidade e segurança:** registros antigos sem `moduleOperations` mostram ausência de detalhamento. Rules candidatas limitam chaves e proíbem decrementos, preservando a identidade da UG. Testes Emulator ALLOW/DENY incluídos.
5. **Reconciliação com Google:** leitura das mesmas métricas globais já carregadas, aproximação proporcional de `Read Units` por UG apenas para fração instrumentada. Parcela **não atribuída não é rateada**; módulos representam contagem de operações observadas, **não custo real**.
6. **Qualidade observacional:** snapshots exclusivamente locais/cache não são classificados como leitura de servidor comprovada; falta de cobertura continua declarada.

**Limitações R3 explícitas:** cobertura incompleta de caminhos não instrumentados (backend, índices, Security Rules, retries/transações etc.), peso real das consultas não calibrado por Query Explain, e buffer com `increment()` ainda sem garantia de entrega exatamente uma vez se houver confirmação de rede ambígua. Não anunciar 100% de precisão nem fatura oficial por UG. Evoluções futuras exigem teste e análise de custo adicional, não improvisar em produção.

### Próxima solicitação exata do Fundador — estimador financeiro Firestore em reais (**PENDENTE, AINDA NÃO IMPLEMENTADO**)

Pergunta formulada antes deste pedido de atualização:

> **“é possível incluir um calculo em cima do consumo do firestore para saber qual vai ser o meu custo (diário, semanal e mensal) em reais considerando os dados que o firebase dispoe?”**

**Primeiro próximo passo do chat sucessor:** responder a viabilidade e **propor um cálculo auditável** antes de alterar código. Se o Fundador solicitar execução, implementar na mesma branch do PR #341, com CI e validação isolada, sem produção.

Critérios para esse cálculo:
- Separar claramente **(a) uso observado**, **(b) custo parcial estimado**, **(c) projeção diária/semanal/mensal**, **(d) gasto/fatura oficial do Google Cloud Billing**, que não são conceitos equivalentes.
- Utilizar dados já existentes: `lib/server/googleCloudMonitoring.ts` (métricas globais e referência diária), `lib/platformCapacity.ts`, `lib/platformAdminUsageHistory.ts`, `lib/server/globalUsageHistory.ts`, `lib/usageReconciliation.ts`, `components/admin/AdminConsumptionHub.tsx` e subpainéis. Confirmar SKU/região/banco Firestore Enterprise, free tier elegível, preços atuais do Google Cloud, armazenamento, rede, backups, operações e créditos/impostos antes de afirmar **R$**; cobertura parcial deve ser indicada.
- Conversão cambial BRL deve ter fonte/data da cotação ou parâmetro configurável explícito. **Não inventar preços, câmbio ou impostos**. Melhor distinguir preços configurados e medidos; se preços/cotação ausentes, mostrar “estimativa indisponível”, não `R$ 0`.
- Dia deve respeitar a janela de faturamento já adotada (`America/Los_Angeles`); semanal e mensal devem declarar se são soma de dias fechados ou projeção com base no período parcial. Métricas do Cloud Monitoring têm atraso e snapshots não são a fatura.
- Preferir **computação em memória sobre histórico já disponível**, sem polling/listeners ou leituras adicionais desnecessárias. Não inventar rateio financeiro por UG; se incluído, rotular como proxy experimental e não faturamento.
- Registrar cenários de exemplo com resultados conhecidos e testes de falta de medição, free tier, excedente, projeção, câmbio, limites e mudança de preços, com testes automatizados.

### Handoff operacional vigente

**Onde estamos:** PR #341 DRAFT com modernização visual da Administração existente + UG R3 tecnicamente implementada e CI aprovado no SHA de código `5c616367`. **O que estamos fazendo:** aguardando aceite humano no navegador/localhost; preparar decisão sobre estimativa do custo global do Firestore em BRL. **Quem está fazendo:** executor GitHub no PR e Fundador como autoridade de aceite/publicação. **O que fazer a seguir:** responder à pergunta financeira, verificar fontes reais de preço/metricas, decidir se deve implementar, validar em branch e certificar novo HEAD. **Quem o fará:** próximo chat como executor sob solicitação do Fundador, sem merge/deploy sem autorização.

**Como abrir localmente se a pasta ainda não existir:** clonar a **nova** branch em `$HOME\emprovex-admin-visual` usando `git clone --single-branch --branch feat/admin-visual-organizacao-base-emprovex https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov.git "$HOME\emprovex-admin-visual"`; depois `npm.cmd ci`, `npm.cmd run dev -- --port 3001`, abrir `http://localhost:3001/admin?tab=consumo`. Se já existir, executar `git pull --ff-only origin feat/admin-visual-organizacao-base-emprovex` **na pasta nova**. Não usar a antiga `emprovex-admin2-preview`, cuja branch remota foi excluída.

**Memorial especializado:** [ADMIN_VISUAL_REORGANIZACAO_BASE_20261018.md](./admin/ADMIN_VISUAL_REORGANIZACAO_BASE_20261018.md). O presente recorte tem precedência, para esta frente, sobre planejamento ADMIN-2.0 histórico abaixo.

---


## Recorte vigente ADMIN-2.0 — 2026-10-18 · CORE V2 (decisão posterior do Fundador)

- **Diretriz atual e prioritária:** desenvolver a nova Administração premium **sem** os três objetivos anteriormente previstos: **(1)** entrar e modificar registros operacionais nos workspaces externos; **(2)** operar a Central de Depósitos de outros setores; **(3)** acessar arquivos privados Google Drive dos clientes. Os três foram **ADIADOS**, não cancelados definitivamente, e **não bloqueiam o CORE V2**.
- **Escopo de execução imediato:** Clientes 360° com **metadados administrativos/comerciais** (sem abrir dados operacionais do cliente), dashboard, onboarding/gestão de setores existentes, financeiro/billing, CRM/atendimento, indicadores, sessões, consumo/cotas, backup/segurança e identidade visual EMPROVEX Command, com escalabilidade e economia Firestore.
- **Plano Mestre de referência:** [ADMIN_2_0_PLANO_MESTRE_WORKERS.md](./ADMIN_2_0_PLANO_MESTRE_WORKERS.md) **V2 / CORE**, 13 capacidades em escopo, W00 + 8 especialistas (W01/W02/W03/W04/W05/W09/W10/W11); W06/W07/W08/W12 e futuro W13 **NÃO são ativados nesta etapa**.
- **Gates:** contrato G0, backend/UI, compatibilidade, economia Firestore, QA e GO produtivo. **O G-1 de acesso global cross-workspace da auditoria anterior foi retirado como pré-requisito do CORE**, porque os objetivos que ele validaria foram adiados. Permanecem obrigatórios testes negativos de acesso a dados operacionais de outros tenants.
- **Precedência documental:** este registro de 2026-10-18 **substitui apenas o escopo e a prioridade** das notas de 2026-10-17 e do veredito prévio de G-1. A auditoria histórica conserva seu valor técnico **para o dia em que as funcionalidades adiadas forem retomadas**. Nenhum código/dado/regra/deploy alterado por esta decisão documental.

---

## Programa ADMIN-2.0 — decisão de produto 2026-10-17 · EMPROVEX Command (DESENVOLVIMENTO)

- **Estado:** estudo estratégico e diretrizes funcionais **registrados para desenvolvimento futuro**; estética EMPROVEX Command em refinamento/validação humana; **nenhuma implementação, alteração de Rules/Firestore, migração ou deploy** realizada neste marco.
- **Objetivo:** transformar a Administração em uma central de gestão SaaS escalável, com **Clientes 360°**, CRM compacto, relação cliente↔OM/UG↔workspace↔identidade↔assinatura, onboarding assistido, financeiro, atendimento, telemetria, indicadores, governança e auditoria.
- **Navegação proposta:** Central; Gestão de Negócio; Operação da Plataforma; Inteligência; Governança. Ação Cadastrar Setor permanece disponível como fluxo contextual, preservando o provisionamento atual.
- **Sidebar Admin 2.0 — contrato visual confirmado em 2026-10-18:** lateral esquerda como EMPROVEX/Central de Depósitos, com grupos administrativos próprios; desktop expandido e modo compacto apenas com ícones (melhoria nova), mobile drawer, item ativo iluminado discretamente, tooltips, acessibilidade, estado preservado localmente sem Firestore e estética premium. W01 implementa, W00 integra, W11 certifica. Detalhes nos dois memoriais especializados.
- **Estética:** identidade premium EMPROVEX Command; azul-marinho `#020817`, superfícies `#071225`, iluminação sutil, Montserrat, legibilidade e microinterações consistentes; Border Beam discreto/monocromático; Thinking Orb não espalhado como decoração; acessibilidade, responsividade e redução de movimento. **Aparência final sujeita a aprovação no protótipo.**
- **Decisão explícita e mais recente do Fundador — Superadministrador:** acesso global a **qualquer workspace** dos clientes com inclusão/edição/correção/exclusão por motores operacionais válidos, **sem aceite individual por entrada e sem limite temporal específico para o recurso**; troca rápida entre workspaces, sem senha do usuário e sem impersonação. Permanecem autenticação, autorização privilegiada no servidor, auditoria atribuída ao verdadeiro ator, transparência e invariantes de segurança/integridade. **Ainda não implementado; Firestore Rules e `workspaceContext` atuais não concedem este acesso.**
- **Escalabilidade e custo:** evitar listeners/consultas globais de todas as contas, cobranças, sessões e históricos; introduzir paginação, resumos, consultas sob demanda, índices e separação das migrações do carregamento de interface. Medir cota Firestore e latência em bases sintéticas crescentes.
- **Contrato comercial preservado:** Plano Completo R$ 70/mês/workspace; VIP legado isento e protegido; trial de 30 dias; billing em modo `observe` por padrão; cobrança externa e sem suspensão operacional automática por inadimplência.
- **Fonte detalhada canônica para continuidade:** [ADMIN_2_0_MEMORIAL_DESENVOLVIMENTO.md](./ADMIN_2_0_MEMORIAL_DESENVOLVIMENTO.md) — benchmarking, arquitetura, fluxos, visão estética, acesso Superadmin, limites técnicos, fases, gates e handoff.
- **Plano de execução por chats workers (2026-10-17):** [ADMIN_2_0_PLANO_MESTRE_WORKERS.md](./ADMIN_2_0_PLANO_MESTRE_WORKERS.md) — 12 workers especializados + W00 Coordenador; contrato inicial G0, PRs DRAFT, 15 capacidades A01–A15, integração/QA independente e release manual condicionada a GO. **Plano documentado, nenhum worker executado por este registro.**
- **Auditoria técnica 01 (2026-10-18):** [ADMIN_2_0_AUDITORIA_TECNICA_01.md](./ADMIN_2_0_AUDITORIA_TECNICA_01.md) — **VIÁVEL COM AJUSTES / NO-GO PARA EXECUÇÃO MASSIVA ATÉ G-1**. Necessária prova de acesso Superadmin nos dois Firestores e UI, limitação Google Drive/OAuth, ownership W13 Bridge, adequação de testes/guards e contratos. Ver detalhes no relatório; nenhum teste dinâmico executado nesta auditoria. A decisão de acesso global sem aceite por sessão permanece vigente.
- **Próximas ações:** validar estética do protótipo; especificar telas e contratos; desenhar delegação Superadmin; medir baseline; implementar isoladamente e certificar em QA antes de qualquer GO de produção.
- **Precedência:** este checkpoint registra decisões **futuras de produto**. Não altera retroativamente o estado operacional certificado em 2026-10-15 nem desautoriza a proteção atual de isolamento entre tenants.

---

## Checkpoint operacional vigente — 2026-10-15 · Release Premium + proteção da cota Vercel

- **Produção:** https://emprovex.com.br — Fundador confirmou a publicação consolidada e a **validação visual das melhorias** após release em `main@63aad90bf80a50cf1cf875024cde21d5e792a3cf` (`chore(release): EMPROVEX Central de Depositos Premium`). Build de produção e prebuild pelo PowerShell aprovados; a confirmação de uso no site foi humana, não uma nova inspeção remota por este agente.
- **PR #314:** integrado em `303ffb7389d0ab5d3559767b7e9c2e3dd735b603` (D-123 a D-126). Central de Depósitos `/central-depositos`, Operador Móvel `/operador-movel`, visual premium e croqui 3D com autoenquadramento/rotação física das vistas Frente, Direita, Trás e Esquerda. Rotas antigas mantidas por redirects/aliases. Cinco gates automatizados PASS no PR. Validação visual humana declarada pelo Fundador como concluída após publicação.
- **Política operacional de custo de deploy (D-127):** `vercel.json → git.deploymentEnabled = false` desativa gatilhos automáticos GitHub → Vercel em **todas** as branches, inclusive `main`; validação por `scripts/vercel-manual-deploy.test.mjs` no Application CI. Cron diário de uso às 09:15 UTC (`/api/cron/usage-snapshot`) preservado. Repositório GitHub e integração continuam utilizáveis para código/CI; a publicação na Vercel é **manual e consolidada**, via `vercel pull --environment=production`, `vercel build --prod`, `vercel deploy --prebuilt --archive=tgz --prod --scope aprov-hgesms-projects` em worktree limpa e com identidade de autoria autorizada. A política não desliga os gates nem impede deploy manual de preview sob demanda.
- **Limite de verificação:** a configuração versionada é fonte de verdade após integração na `main`; não houve confirmação administrativa pelo conector da equipe Vercel (permissão 403). Verificar no painel Vercel se algum outro gatilho externo/deploy hook continua ativo; não assumir que os 100 deployments anteriores vieram exclusivamente do GitHub.
- **Segurança e dados:** não altera Firestore, Rules, estoque, autenticação, cron nem domínio público da versão já publicada. Este checkpoint substitui as notas antigas abaixo que ainda descrevem PR #314 como DRAFT/Preview pendente; essas notas permanecem apenas como rastreabilidade histórica.

---

**Notas históricas do desenvolvimento anterior à publicação de 2026-10-15 (superadas quando conflitarem com o checkpoint acima):**

> **Auditoria adicional de vistas — 2026-10-15 (D-126, PR #314):** corrigida deformação de pallets/locais ao mudar para Direita/Esquerda em depósitos retangulares. A rotação agora preserva medidas reais, troca as dimensões projetadas do cômodo e mantém vínculo das subposições e materiais. Incluídos testes de regressão em quatro vistas e geometrias alongadas; aguarda gates e smoke visual humano.
> **Visão 3D de Meus Depósitos — 2026-10-15 (D-126, PR #314 em validação):** substituição do viewBox fixo por auto-fit centralizado com base na geometria isométrica de piso, paredes, estruturas e etiquetas, recalculado em cada perspectiva. Proporções, estoque e persistência preservados; sem leituras extras no Firestore. CI e smoke visual pendentes, produção não alterada.

> **Visual Operador Móvel — 2026-10-15 (D-125, PR #314 em validação):** redesenho da home do Operador Móvel para superfície institucional premium, com cabeçalho contextual/UG real, painel de acesso autorizado e leitura por etiqueta sob demanda, oito cartões em grupos **Movimentações** e **Consulta e conferência**, estados de foco/toque e movimento reduzido. Sem novas leituras ao Firestore, sem efeito orbital pesado ou alteração da operação. Navegação inferior contextual segue D-124. Aguardando CI e validação humana; produção não alterada.

> **Operador Móvel — 2026-10-15 (PR #314 em validação):** a antiga identificação pública **Central Móvel** passa a ser **Operador Móvel**, integrado visualmente à barra lateral da Central de Depósitos (abaixo dos demais recursos). Endereço canônico `/operador-movel`, redirects dos links antigos `/central-mobile`, mesmo acesso founder-only e contratos de estoque preservados. Referência: D-124. Sem merge/deploy de produção nesta etapa.

> **Roteamento oficial da Central de Depósitos — 2026-10-15 (refatoração em branch):** nome de produto **Central de Depósitos**, rota pública canônica `/central-depositos` e APIs `/api/central-depositos/{status,intake-action}`. A rota `/adm-deposito` recebe redirect permanente, enquanto as APIs legadas preservam aliases diretos sem mudar o método HTTP. Firestore, namespace `warehouse`, regras e IDs persistidos permanecem intactos. Decisão D-123 em `docs/adm-deposito/DECISIONS.md`; aguardando os gates do PR e eventual autorização de merge/deploy.

> **Atualização pontual — 2026-10-15 (Central de Depósitos):** saldo legado de testes do Suco, 5 unidades em `UNASSIGNED`, **regularizado com PASS no Firestore real**. A alteração foi exclusivamente de dados, sem deploy, merge, Rules ou atualização da aplicação. Evidências: [PR #310](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/310), `docs/WAREHOUSE_INTEGRITY_RECONCILE_01.md` e `docs/WAREHOUSE_DATA_REPAIR_EXECUTION_01.md`. **A sincronização global e os demais estados abaixo permanecem no recorte histórico indicado (2026-10-04); esta nota não certifica outros programas nem todos os saldos dos depósitos.**


Sincronização global histórica de referência: **2026-10-04 — SESSION-CAP-01 + RULES-AUDIT-01 encerradas / pré-composição do RC** (estado superado para release e navegação pelo checkpoint de 2026-10-15).

Produção na baseline histórica de 2026-10-04: `main@e90f92acae1514ee5cbc6ce95fed354bc1454330` (não é a release vigente; ver checkpoint de 2026-10-15).

Integradora SaaS R1: `feat/saas-r1-commercializacao@54aba792cb9e7bb195e21401fb50a21ed50add19` — SESSION-CAP-01 integrada; commits posteriores podem ser documentais de Program Control

Integradora Mobile R1: `feat/central-mobile-r1@7b7717b6eebabf911310d2b8ac56ed13c9cb9238` — avanço documental, sem novo delta runtime

Estado global: **Performance R3 em produção; desenvolvimento funcional SaaS R1 e Mobile R1 encerrado; SESSION-CAP-01 em PASS técnico completo e integrada na linha SaaS/RC; RULES-AUDIT-01 em PASS — RULES APTAS PARA RC; TTL produtivo de sessionSlots/sessionRevocations ACTIVE; HARDEN-A1/A2/C/D em PASS; HARDEN-B parcial por dependência temporal; MOBILE-J aguarda Preview HTTPS; composição do RC único SaaS+Mobile é a próxima barreira; Preview HTTPS ainda não publicado.**

---

## 0. Finalidade e regra de leitura

Este é o **documento de entrada canônico do EMPROVEX**.

O objetivo do Memorial é permitir que um novo Coordenador, worker ou sessão de continuidade responda rapidamente:

1. o que está efetivamente em produção;
2. quais programas estão ativos;
3. quais contratos estão congelados;
4. quais riscos e bloqueios permanecem;
5. qual é o próximo gate global;
6. onde encontrar a evidência detalhada.

O Memorial **não apaga histórico** e não substitui os documentos especializados. Ele organiza o conhecimento em camadas.

### Camadas documentais

**Camada 1 — Estado global e contratos vigentes**

Este arquivo: `docs/EMPROVEX_MEMORIAL_OFICIAL.md`.

**Camada 2 — Estado operacional de cada programa**

- **ADMIN-2.0 (estudo/planejamento):** `docs/ADMIN_2_0_MEMORIAL_DESENVOLVIMENTO.md` — Clientes 360°, EMPROVEX Command, acesso Global Superadmin e escalabilidade (2026-10-17; não implementado).
- `docs/SAAS_R1_INTEGRATION_STATUS.md`
- `docs/SAAS_R1_COORDENADOR_HANDOFF.md`
- `docs/CENTRAL_MOBILE_R1_INTEGRATION_STATUS.md`
- `docs/CENTRAL_MOBILE_R1_COORDENADOR_HANDOFF.md`
- planos mestres e documentos especializados de cada programa.

**Camada 3 — Histórico detalhado integral**

`docs/EMPROVEX_MEMORIAL_HISTORICO_ATE_2026-10-03.md`

Esse arquivo contém **a versão anterior completa do Memorial, preservada integralmente**, incluindo registros de PRs, commits, métricas, fases, incidentes, decisões e checkpoints históricos.

### Regra de precedência canônica

Quando houver divergência aparente entre trechos, aplicar esta precedência:

1. **Snapshot Global + Contratos Permanentes deste Memorial** — estado vigente;
2. **documentos especializados de Integration Status / Coordenador / runbooks** — evidência operacional detalhada;
3. **Cronologia e checkpoints históricos** — explicam como o estado foi alcançado, mas não revogam decisão posterior;
4. **Memorial Histórico Integral / Git history** — arquivo de rastreabilidade, não estado vivo.

Um checkpoint histórico que diga “bloqueado”, “parcial” ou “aguardando” deixa de governar o sistema quando uma seção posterior e vigente registrar explicitamente PASS/encerramento.

Números operacionais devem refletir o **runtime atual**. Se uma especificação antiga divergir do código integrado, o Memorial deve registrar o contrato efetivamente implementado e apontar a divergência como histórica.

### Regra estrutural a partir desta reorganização

Novos estados não devem ser simplesmente anexados ao fim do Memorial.

Sempre atualizar primeiro:

1. **Snapshot Global**;
2. **Programa afetado**;
3. **Riscos/Gates**;
4. **Cronologia**, quando houver marco histórico;
5. documento especializado correspondente.

Quando um estado deixar de ser vigente, ele deve sair do quadro vivo e permanecer na cronologia/documentação histórica.

### Concorrência documental

Como SaaS e Mobile podem atualizar documentação em paralelo, qualquer edição do Memorial deve:

- reler o HEAD vivo imediatamente antes da gravação;
- preservar alterações concorrentes;
- mover novos checkpoints para a seção temática correta;
- nunca sobrescrever uma atualização de outro Coordenador apenas para restaurar uma versão anterior.


---

# PARTE I — ESTADO VIVO

## 1. Snapshot Global

> **Critério temporal:** a linha Produção está reconciliada com o checkpoint 2026-10-15 acima; as demais linhas SaaS/Rules/RC sem atualização datada nesta rodada conservam o recorte histórico do programa e **não** são consideradas re-certificadas por este ajuste de deploy.

| Domínio | Estado vigente | Contrato/observação |
| --- | --- | --- |
| Produção | **EMPROVEX Premium — PUBLICADO / VALIDAÇÃO HUMANA CONFIRMADA (15/10)** | `main@63aad90bf80a50cf1cf875024cde21d5e792a3cf`; PR #314 integrado, prebuild Vercel aplicado |
| ADMIN-2.0 — Clientes e EMPROVEX Command (2026-10-17) | **ESTUDO E DIRETRIZES DE DESENVOLVIMENTO REGISTRADOS — NÃO IMPLEMENTADO** | Ficha 360°, arquitetura escalável/eficiente em Firestore, design premium, acesso Global Superadmin sem aceite por sessão nem prazo próprio; autorização servidor/auditoria obrigatórias. Ver memorial especializado. |
| SaaS R1 | **FUNCIONALMENTE CONCLUÍDO / PRONTO PARA RC** | A1/A2/C/D PASS; B parcial/temporal |
| Mobile R1 | **FUNCIONALMENTE CONCLUÍDO** | A–I integradas; MOBILE-J em certificação final |
| MOBILE-J | **PARCIAL TECNICAMENTE SAUDÁVEL / CERTIFICAÇÃO EM EXECUÇÃO** | aguarda RC em Preview HTTPS para testes físicos reais |
| SESSION-CAP-01 | **PASS TÉCNICO COMPLETO / INTEGRADA** | PR #248 squash-merged; sessões externas dinâmicas sem teto fixo |
| RULES-AUDIT-01 | **PASS — RULES APTAS PARA RC** | Rules vivas sem drift; TTL dos dois grupos ACTIVE |
| RC conjunto | **PRONTO PARA COMPOSIÇÃO / NÃO CONGELADO** | SESSION-CAP + RULES-AUDIT encerradas; próximo trabalho transversal |
| CT-01 | **PENDENTE NO RC** | `camera=(self), microphone=(), geolocation=()` |
| Rules candidatas | **AUDITADAS / APTAS PARA RC** | produção R3 sem drift; principal RC `bc91185...`; Warehouse RC `6e1f105...`; rollout Rules RC → app RC |
| HARDEN-B | **PARCIAL / ESPERA CONTROLADA** | PITR/delete protection/schedule/retention ativos; backup READY/verify/restore pendentes |
| Warehouse — saldo legado Suco (2026-10-15) | **PASS — REPARO DE DADOS CONFIRMADO** | 5 `UNASSIGNED` → 0, saldo agregado 5 → 0; ledger de ajuste preserva a trilha; PR #310 DRAFT; demais materiais não foram auditados neste evento |
| Billing R1 | **IMPLEMENTADO EM MODO OBSERVE** | R$ 70; trial; cobrança externa; confirmação manual; sem suspensão automática |
| Piloto real | **NÃO INICIADO** | vem depois do RC tecnicamente fechado/publicação controlada |
| Abertura comercial ampla | **NÃO AUTORIZADA** | exige piloto, correções, SAAS-J e GO explícito do Fundador |

### Snapshots técnicos relevantes

- SaaS/RC após SESSION-CAP + RULES-AUDIT: `54aba792cb9e7bb195e21401fb50a21ed50add19`;
- Mobile integradora documental: `7b7717b6eebabf911310d2b8ac56ed13c9cb9238`;
- MOBILE-J: `mobile-r1-j-final-certification@90d646372aae3e92318a78b90d71f72c5eb6b00e`;
- HARDEN-B: `saas-harden-b-recovery-restore@910cca1ea9f14e4ef080ee649624042f63206d51`.

A produção só muda por autorização explícita e posterior do Fundador.

## 2. Próxima barreira global

A próxima fase não é nova feature. É **Release Engineering / Certificação**.

Sequência canônica:

```text
SaaS final + Mobile final
→ SESSION-CAP-01 — PASS / integrada
→ RULES-AUDIT-01 — PASS / Rules aptas para RC
→ branch única de composição do RC
→ reconciliação semântica dos contratos compartilhados
→ CT-01
→ Rules/package/lockfile/Application CI consolidados
→ gates no SHA exato
→ RC CANDIDATE
→ RC FROZEN
→ Preview HTTPS
→ testes SaaS + MOBILE-J físicos
→ correções rastreáveis, se houver
→ nova reconciliação/freeze quando necessário
→ GO/NO-GO explícito
→ eventual produção controlada
→ piloto real
→ correções pós-piloto
→ SAAS-J
→ autorização explícita
→ abertura comercial ampla
```

### Condições para declarar RC CANDIDATE

Obrigatório:

- SESSION-CAP-01 concluída e reconciliada, salvo decisão explícita do Fundador de adiar a mudança para release posterior;
- RULES-AUDIT-01 concluída em **PASS** sobre o ruleset final pós-SESSION-CAP-01;
- nenhuma Rule produtiva nova pode ser publicada sem esse PASS;
- nenhum novo conflito SaaS↔Mobile;
- CT-01 materializada;
- Rules candidata principal e warehouse registradas;
- rollback de Rules preparado;
- package/lockfile/CI reconciliados;
- build/TypeScript/diff hygiene verdes;
- Core/Legal/Recovery e segurança multi-tenant verdes;
- contratos de Auth/workspace/UG/sessão/lifecycle/Legal/billing/Central coerentes;
- source of truth logística única.

### Condições para RC FROZEN

Registrar no mínimo:

- `RC_BRANCH`;
- `RC_SHA`;
- `SAAS_SOURCE_SHA`;
- `MOBILE_SOURCE_SHA`;
- resultado HARDEN-A2;
- hashes das Rules de produção e do RC;
- hash de `next.config.ts`;
- hash de `package-lock.json`;
- resultados dos gates.

Após o freeze, só entram correções de blocker, regressão, segurança ou defeito real da certificação. Não entram melhorias oportunistas.

# PARTE II — GOVERNANÇA GLOBAL

## 3. Hierarquia oficial

### Fase funcional — modelo histórico

Durante o desenvolvimento paralelo:

```text
Fundador
→ Coordenador Geral / Program Control
   → Coordenador SaaS R1
   → Coordenador Mobile R1
      → workers especializados
```

### Fase atual — composição do RC

Por decisão do Fundador, o **Coordenador Geral também assume a Coordenação operacional do RC**.

Modelo vigente:

```text
FUNDADOR
   ↓
PROGRAM CONTROL + COORDENAÇÃO DO RC
   ├── Coordenador SaaS — consulta/evidência sob demanda
   ├── Coordenador Mobile — consulta/evidência sob demanda
   ├── HARDEN-B — frente especializada temporal
   └── MOBILE-J — frente especializada de certificação física
```

Os Coordenadores SaaS e Mobile não foram apagados: permanecem como fontes especializadas de contexto e evidência. Porém **não existe nova wave funcional autorizada** em nenhum dos dois programas.

### Separação de autoridade mesmo no mesmo chat

O mesmo chat pode executar dois papéis, mas as decisões continuam separadas por evidência:

- **Coordenação RC**: compõe candidato, reconcilia, executa gates, prepara Preview e consolida evidências;
- **Program Control**: aceita/rejeita checkpoints, declara RC CANDIDATE/FROZEN, classifica risco e prepara GO/NO-GO;
- **Fundador**: autoriza ações produtivas protegidas e lançamento.

O Coordenador Geral não transforma “continue”, “próximo passo”, CI verde ou PASS técnico em autorização de produção.

## 4. Classificação oficial de problemas

- **LOCAL** → worker.
- **PROGRAM** → Coordenador do programa.
- **TRANSVERSAL** → Coordenador Geral.
- **RELEASE/PRODUÇÃO** → Coordenador Geral + Fundador quando aplicável.

## 5. Semáforo global

- **VERDE** — pode prosseguir.
- **AMARELO** — risco/delta conhecido; pode avançar até a próxima barreira.
- **VERMELHO** — bloquear somente a menor unidade necessária.

O objetivo é evitar que um risco localizado paralise programas independentes.

## 6. WIP e desenvolvimento paralelo

O EMPROVEX adota como método oficial:

> **frentes independentes em paralelo + integração semântica + barreiras explícitas de sincronização.**

A capacidade de revisão determina o WIP, não a quantidade possível de chats.

SaaS e Mobile podem evoluir simultaneamente enquanto seus contratos comuns permanecerem compatíveis.

Não fazer sincronização por merge/rebase cego entre integradoras.

---

# PARTE III — PRODUTO E ARQUITETURA

## 7. Stack vigente

- Next.js 15 / App Router;
- Firebase Auth;
- Firestore;
- Cloud Monitoring;
- Vercel;
- Vercel Blob;
- integrações Google usadas pelos fluxos institucionais.

## 8. Núcleo funcional do EMPROVEX

Capacidades consolidadas incluem:

- Empenhos;
- Itens;
- Notas Fiscais;
- Comissão;
- Tesouraria/Liquidação;
- Cronogramas/Entregas;
- Central de Avisos;
- Relatórios/SAG;
- Administração;
- usuários e sessões;
- telemetria/consumo;
- Central de Depósitos;
- Central Móvel R1 em desenvolvimento.

Performance R3 é a baseline de produção atual.

## 9. Contratos de identidade, sessão e multi-tenant

### 9.1 Identidade autenticada

Fonte: Firebase Auth.

Contrato atual:

- fundador: login **Google-only**;
- usuários externos/setores: login **e-mail/senha only**;
- e-mail verificado é obrigatório;
- sessão com provider inesperado falha fechada;
- Mobile e Desktop usam a mesma identidade; não existe Auth Mobile paralelo.

### 9.2 Relação conta ↔ workspace ↔ UG

Na R1:

- 1 cliente operacional externo = 1 workspace;
- 1 workspace = 1 UG;
- 1 workspace externo possui 1 conta operacional primária;
- conta, workspace e sessão precisam concordar em e-mail/UID/workspace/UG;
- inconsistência de UID, e-mail, UG, status ou provider resulta em **fail-closed**;
- o usuário não recebe subscriptions operacionais antes da validação do contexto.

### 9.3 UID e primeiro vínculo

Contas novas já podem chegar pré-vinculadas ao UID Firebase pelo provisionamento.

Para registros legados sem UID, o bootstrap histórico de primeiro acesso pode vincular o UID após validar:

- e-mail;
- provider;
- conta ativa;
- workspace ativo;
- UG coerente.

Após o vínculo, e-mail idêntico não basta: o UID precisa continuar sendo exatamente o mesmo.

### 9.4 Sessões simultâneas — contrato de runtime atual

O runtime atualmente integrado define:

- usuário externo: **sem teto fixo de sessões simultâneas por workspace/UG no candidato integrado**;
- founder: **isento do limite de capacidade**;
- documentos de sessão: IDs dinâmicos por `browserInstanceId`; `slot-1` e `slot-2` permanecem apenas como compatibilidade transitória;
- lease nominal: **30 minutos**;
- heartbeat/renovação nominal: **15 minutos**;
- decisão temporal baseada em relógio confiável do servidor, não no relógio local do Windows;
- revogação administrativa cria tombstone e remove slots conhecidos;
- perda de lease/revogação/mudança de acesso invalida a sessão local.

**Estes números 30/15 são o contrato implementado atual e substituem referências históricas anteriores com valores diferentes.**

### 9.4.1 Mudança autorizada — remoção do teto fixo de duas sessões

Decisão do Fundador em 2026-10-03:

**o limite fixo de 2 sessões simultâneas para usuários externos deve ser removido.**

Motivação operacional:

- a Central Móvel R1 transforma o celular em ferramenta operacional do depósito;
- uma única equipe pode precisar de vários operadores simultâneos;
- alocação, conferência, inventário, transferência e saída podem ocorrer em paralelo;
- limitar o workspace a apenas duas sessões cria gargalo artificial justamente no cenário Mobile;
- Desktop e múltiplos celulares precisam poder coexistir durante a operação.

### Estado atual versus estado alvo

**Estado integrado na linha SaaS/RC:**

- limite externo: **sem teto fixo**;
- documentos: `sessionSlots/{browserInstanceId}`;
- compatibilidade transitória: `slot-1` e `slot-2`;
- lease: 30 minutos;
- heartbeat: 15 minutos;
- revogação administrativa: ativa;
- painel de sessões: ativo;
- telemetria: ativa;
- TTL `expiresAt`: ACTIVE em `sessionSlots` e `sessionRevocations`.

**Estado alvo autorizado e alcançado:**

- **sem teto fixo de duas sessões por workspace/UG**;
- permitir múltiplas sessões externas simultâneas compatíveis com o uso operacional real;
- manter controle individual de identidade de cada sessão;
- manter lease, heartbeat, revogação, auditoria e telemetria;
- manter possibilidade de encerramento remoto de uma sessão específica;
- manter lifecycle fail-closed;
- manter proteção cross-workspace;
- não transformar “sem limite fixo” em “sem controle de sessão”.

### Princípio arquitetural

A mudança deve remover o **limite de capacidade**, não remover a **camada de segurança de sessão**.

Continuam obrigatórios:

- `sessionId`;
- `browserInstanceId`;
- UID;
- e-mail;
- workspaceId;
- UG;
- lease temporal;
- heartbeat;
- tombstone de revogação;
- invalidação por mudança de acesso;
- painel administrativo de sessões;
- auditoria `session.terminate`;
- telemetria de sessões/consumo.

### Implicação técnica conhecida

A implementação atual usa apenas:

- `slot-1`;
- `slot-2`.

Portanto **não basta alterar `DEFAULT_EXTERNAL_SECTOR_SESSION_LIMIT`**.

A frente deverá substituir a reserva física fixa por uma coleção de sessões dinâmicas ou mecanismo equivalente, preservando identidade e revogação.

Direção preferida:

```text
workspaces/{workspaceId}/sessionSlots/{sessionIdOuIdDinamico}
```

ou contrato equivalente que:

- aceite N sessões simultâneas;
- permita identificar cada sessão;
- permita revogar uma sessão específica;
- permita listar sessões no painel;
- permita expiração por lease;
- impeça overwrite de sessão alheia;
- preserve isolamento por workspace.

O nome final do documento/coleção pode ser mantido por compatibilidade se isso simplificar a migração, mas o ID não deve continuar restrito a `slot-1`/`slot-2`.

### Momento ideal de execução

Esta alteração deve ser executada:

**ANTES DO RC CANDIDATE / ANTES DO RC FROZEN.**

Motivo:

- a certificação física Mobile deve representar o comportamento real que será lançado;
- testar o RC com limite 2 e removê-lo depois invalidaria parte da certificação;
- a mudança toca Auth/sessão/Rules/telemetria e precisa estar estabilizada antes do Preview final.

Sequência recomendada:

```text
estado atual consolidado
→ frente transversal SESSION-CAP-01
→ regressão de Auth/sessão/Rules/telemetria
→ integração SaaS + Mobile
→ composição do RC
→ freeze
→ Preview HTTPS
→ testes físicos com múltiplos operadores
```

Se a composição do RC já tiver começado quando a frente for ativada, a alteração deve entrar **antes do freeze**, com repetição dos gates afetados.

Não aplicar após `RC FROZEN` como melhoria oportunista; nesse caso, somente reabrir o freeze por decisão explícita do Program Control/Fundador.

### Escopo executado/auditado da SESSION-CAP-01

Arquivos/contratos afetados ou auditados:

- `lib/platformCapacity.ts`;
- `lib/platformSessionLease.ts`;
- `lib/platformSessionControl.ts`;
- `lib/platformAdminSessions.ts`;
- `hooks/useOperationalData.ts`;
- `hooks/usePlatformAdminSessions.ts`;
- painel administrativo de sessões;
- provisionamento/exclusão de setor;
- lifecycle/suspensão;
- `firestore.rules`;
- testes multi-tenant;
- E2E de sessão;
- guards Block 16.0/16.1/16.2;
- guards Block 17.1/17.2;
- telemetria/consumo;
- documentação de capacidade.

### Regras de segurança da alteração

A remoção do teto não pode:

- permitir sessão de outro workspace;
- aceitar UG divergente;
- permitir uma sessão renovar lease de outra;
- permitir recriar sessão revogada;
- permitir que cliente altere identidade do lease;
- remover revogação administrativa;
- remover expiração temporal;
- remover painel de sessões;
- remover auditoria;
- quebrar suspensão/reativação;
- criar acesso anônimo ou bypass de Auth.

### Performance e custo

Mais sessões simultâneas podem aumentar:

- listeners;
- reads;
- writes de heartbeat;
- conexões;
- consumo Firestore;
- telemetria.

Por isso a frente deve medir:

- custo por sessão;
- writes de heartbeat;
- listeners por aba;
- pico de sessões por workspace;
- impacto no Cloud Monitoring;
- comportamento com vários celulares simultâneos.

A ausência de teto fixo não elimina observabilidade de capacidade. O EMPROVEX deve continuar podendo alertar sobre uso anormal ou excessivo.

### Critérios de aceitação utilizados

A frente foi considerada PASS após provar:

1. terceiro, quarto e demais logins externos não são bloqueados apenas por capacidade fixa;
2. cada navegador/celular possui identidade de sessão coerente;
3. múltiplas abas da mesma sessão continuam sem duplicação indevida de lease;
4. revogação de uma sessão não derruba sessões diferentes sem intenção;
5. suspensão do workspace invalida todas as sessões operacionais;
6. reativação não ressuscita tombstones antigos;
7. Rules permanecem fail-closed;
8. cross-workspace continua DENY;
9. painel admin lista/encerra sessões corretamente;
10. telemetria registra aumento de sessões;
11. Android + Desktop + múltiplos celulares podem coexistir;
12. Application CI/Core/Rules/multi-tenant/build/typecheck/diff hygiene passam;
13. MOBILE-J repete os testes afetados no RC.

### Classificação

Esta é uma **mudança funcional explicitamente autorizada pelo Fundador**, apesar do freeze geral de novas features.

Ela é tratada como exceção controlada porque remove uma limitação operacional que conflita diretamente com o uso Mobile do depósito.

A implementação e a certificação técnica da SESSION-CAP-01 foram concluídas em PASS; a mudança está integrada na linha SaaS/RC, ainda sem promoção da aplicação RC à produção.

### 9.5 Lifecycle observado em tempo real

Sessões externas monitoram:

- `workspaces/{workspaceId}`;
- `platformAccounts/{email}`;
- revogação da sessão.

Se workspace/conta deixa de estar `active`, identidade deixa de coincidir ou Rules negam acesso, a sessão é invalidada.

### 9.6 Autoridade da Central

A Central de Depósitos adiciona `warehouseAccess` como autorização específica do banco `emprovex-warehouse`.

Suspensão/reativação coordenada deve preservar coerência entre:

- workspace;
- platformAccount;
- warehouseAccess;
- sessões.

### 9.7 Regra multi-tenant

Nunca criar caminhos alternativos que permitam:

- ler outro workspace;
- trocar workspaceId/UG por input do cliente;
- usar barcode como autorização;
- contornar `warehouseAccess`;
- confiar apenas em estado visual/client-side.

Auth, workspace/UG, Legal Gate, lifecycle, sessão e Rules são contratos compartilhados por SaaS, Desktop e Mobile.

# PARTE IV — CENTRAL DE DEPÓSITOS

## 10. Nome e compatibilidade

Nome vigente de produto: **Central de Depósitos**.

O caminho técnico histórico `adm-deposito` e documentos antigos permanecem por compatibilidade.

## 11. Fontes da verdade logísticas

Não criar fontes paralelas para:

- material;
- posição;
- saldo;
- lote;
- barcode;
- ledger;
- transferência;
- autorização de depósito.

Contratos centrais reutilizados pelo Desktop e pela Mobile:

- materiais canônicos;
- depósitos/localizações/subposições;
- `WarehouseStockPosition`;
- lotes/validade;
- FEFO;
- barcode;
- ledger;
- saldos materializados;
- intake;
- transferência;
- outbound.

### 11.1 Saneamento pontual do saldo legado de testes — Suco (2026-10-15)

**Estado: PASS — dados reais regularizados; não houve alteração de runtime.**

- **Contexto anterior:** `docs/WAREHOUSE_INTEGRITY_RECONCILE_01.md` comprovou um saldo positivo de 5 unidades em `UNASSIGNED`; `docs/WAREHOUSE_DATA_REPAIR_EXECUTION_01.md` corrigiu excessos de lotes, mas deixou expressamente essa pendência fora do reparo anterior.
- **Alvo único:** projeto `gen-lang-client-0982077967`, banco `emprovex-warehouse`, workspace `hgesm-aprov`, material Suco `mat_272f2d996ee65ed3530ad2d7e27b66d7`.
- **Autorização:** Fundador confirmou que as 5 unidades não existem fisicamente e eram apenas saldo antigo de testes; autorizou a regularização para deixar os depósitos limpos.
- **Pré-condições verificadas no Firestore vivo:** saldo agregado 5; soma dos `movements.quantityDelta` = 5; nenhuma posição física positiva; uma posição `UNASSIGNED` positiva de 5; nenhum lote ativo com quantidade positiva. Dry-run **PASS**.
- **Segurança:** backup JSON local pré-commit no PowerShell do Fundador; commit atômico com precondições de versão para exatamente dois saldos (agregado e `UNASSIGNED`) e um movimento novo; sem exclusão de registros.
- **Resultado pós-commit:** executor retornou `PASS — Suco zerado; histórico preservado` após reler saldo agregado = 0, `UNASSIGNED` = 0 e novo movimento persistido; `INVENTORY_ADJUSTMENT` de -5, com nota de regularização de testes. Movimento `mov_d5f92bf0378af1f7c259f258188fac7a5bf39355c0c509f9fcd23af669127834`.
- **Escopo preservado:** nenhuma NF, intake, outros materiais/workspaces, `firestore.rules`, `firestore.warehouse.rules`, aplicação, deploy ou branch `main` foi alterada pela execução de dados.
- **Limite da conclusão:** esta evidência confirma o Suco zerado, **não** comprova que todos os demais saldos do banco estão zerados. A confirmação visual da lista vazia e/ou auditoria read-only global permanece uma verificação distinta, se requerida.
- **Rastreabilidade:** [PR #310 — executor pontual e memorial de execução](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/310), mantido em DRAFT, sem merge. Não promover o script de manutenção pontual ao runtime permanente.

**Contrato permanente:** `UNASSIGNED` é legado/projeção não física, não origem de `TRANSFER` nem `OUTBOUND`; reconciliações requerem causa comprovada, backup e operação auditável sem apagar o ledger.

## 12. Operações canônicas

### Entrada / ALLOCATE

A alocação móvel e desktop deve reutilizar operações oficiais, com:

- idempotência;
- revalidação concorrente;
- associação de barcode;
- lote/validade;
- ausência de escrita client-side paralela de saldo/ledger.

### TRANSFER

Transferência oficial:

- altera distribuição física;
- preserva o total agregado;
- usa operação `TRANSFER`;
- `quantityDelta = 0`;
- não simula transferência por OUTBOUND + nova entrada;
- não escreve diretamente `locationBalance`.

### OUTBOUND

Saída de material deve preservar:

- carrinho/draft;
- idempotência;
- lotes;
- FEFO;
- saldo não negativo;
- ledger oficial.

### Identidade física

Namespace Mobile: **EPX1**.

EPX1 deriva da identidade técnica e sempre é resolvido novamente contra entidades canônicas.

EPX1 não é fonte paralela de posição.

---

# PARTE V — PERFORMANCE R3

## 13. Estado

**PUBLICADA E ENCERRADA.**

Produção:

`main@e90f92acae1514ee5cbc6ce95fed354bc1454330`

A Performance R3 permanece como baseline técnica da produção enquanto SaaS R1/Mobile R1 não forem publicados.

## 14. Resultados consolidados relevantes

Resultados finais registrados durante a rodada:

- Home: First Load caiu aproximadamente de 460 kB para 335 kB;
- principais rotas da Central: aproximadamente 579 kB para 106 kB;
- shared global: aproximadamente 104 kB;
- lazy loading ampliado;
- consultas históricas movidas para demanda;
- invoices quentes separadas semanticamente do histórico;
- cache curto em memória com TTL e isolamento por workspace;
- shell persistente da Central;
- budgets e métricas versionados;
- validação de UX obrigatória.

Detalhes completos de PERF-A...J e PERF-X permanecem no histórico integral e nos documentos `PERFORMANCE_R3_*`.

## 15. Regra permanente herdada da R3

> Ganho técnico que piora significativamente a experiência do operador não é aceito como otimização.

Performance não pode justificar:

- perda de formulário;
- clique aparentemente sem resposta;
- ausência de feedback;
- quebra de foco/teclado/scanner;
- navegação menos previsível;
- informação visual enganosa;
- necessidade nova de refresh manual.

---

# PARTE VI — SAAS R1

## 16. Objetivo

Transformar o EMPROVEX operacional em serviço comercial controlado, sem reconstruir o núcleo do produto.

Princípios:

- vender inicialmente de forma assistida;
- preservar usuários existentes;
- não automatizar finanças antes de haver necessidade real;
- manter billing separado da autorização operacional;
- preservar multi-tenant, segurança, legal, recovery e auditoria;
- só abrir comercialmente após RC, piloto, correções e certificação final.

## 17. Contrato comercial, pagamento, onboarding, legal e lifecycle

### 17.1 Plano comercial congelado

R1 possui um único plano:

**Plano Completo EMPROVEX — R$ 70,00/mês por workspace**

Inclui acesso funcional completo às funcionalidades disponibilizadas para aquele tenant.

Não existem na R1:

- tiers Bronze/Prata/Pro;
- módulos pagos separadamente;
- feature flags comerciais por preço;
- checkout embutido;
- assinatura criada por API;
- webhook de pagamento;
- suspensão automática;
- signup público de organização.

### 17.2 Trial, vencimento e tolerância

Contrato:

- trial padrão: **30 dias**;
- início: provisionamento/concessão administrativa;
- extensão: somente administrativa e auditada;
- vencimento: **5º dia útil**;
- tolerância: **10 dias corridos**;
- feriados adicionais podem ser configurados;
- fim do trial não apaga dados;
- fim do trial não suspende automaticamente;
- competências históricas preservam o valor já materializado.

### 17.3 Fonte de verdade de billing

Coleções/contratos principais:

- configuração: `platformBillingConfig/main`;
- conta comercial: `billingAccounts/{workspaceId}`;
- competências: `billingCycles/{workspaceId}__{referenceMonth}`.

Estados de `BillingAccount`:

- `trial` — teste em andamento;
- `active` — comercialmente regular;
- `pending` — atenção/regularização;
- `suspended` — estado comercial explícito;
- `canceled` — encerramento comercial;
- `exempt` — founder ou VIP/isento.

Estados de competência:

- `open`;
- `pending`;
- `paid`;
- `waived`.

Não criar estados comerciais concorrentes.

### 17.4 Modo de cobrança vigente

Configuração canônica R1:

- `billingMode = observe`;
- `requirePayment = false`;
- `automaticSuspension = false`;
- método administrativo: `pix_manual`.

Consequência essencial:

**billing acompanha e audita a situação comercial, mas billing sozinho não autoriza nem bloqueia o uso operacional.**

Marcar `billingAccounts.status = suspended` não substitui a ação de lifecycle que realmente desabilita workspace/conta/Central.

### 17.5 Pagamento e regularização

O EMPROVEX **não processa cartão/Pix internamente**.

Fluxo canônico:

```text
cliente precisa regularizar
→ abre /regularizacao
→ usa Link de Pagamento HTTPS e/ou copia Pix
→ pagamento ocorre fora do EMPROVEX
→ Fundador/admin confere o recebimento no provedor/banco
→ confirma a competência no painel
→ competência = paid (ou waived quando aplicável)
→ billing account = active
→ evento auditado
```

Configurações administrativas disponíveis:

- `paymentLinkUrl` — URL pública HTTPS;
- `pixKey`;
- `pixKeyType` — CPF/CNPJ/e-mail/telefone/chave aleatória;
- `pixRecipientName`;
- `supportContact`;
- `holidayDates`;
- trial/tolerância dentro dos limites aceitos.

A mensalidade R1 é fixada em R$ 70 pelo domínio; o painel não deve aceitar outro preço como configuração casual.

### 17.6 Provedor de pagamento

O desenho comercial inicial documenta Mercado Pago/Pix como referência operacional.

A implementação, porém, armazena apenas **uma URL pública HTTPS de pagamento**, sem credencial do provedor. Portanto o RC não fica tecnicamente acoplado a um único gateway.

Se outro provedor for adotado:

- deve oferecer URL HTTPS pública apropriada;
- nenhum token/secret deve ir para o cliente;
- Termos/Privacidade devem ser revistos se a mudança alterar materialmente terceiros envolvidos;
- a fonte de verdade da competência continua no EMPROVEX, não no gateway.

API/webhook permanece fora da R1.

### 17.7 Dados financeiros que o EMPROVEX não armazena

Não armazenar:

- número de cartão;
- CVV;
- credencial do gateway;
- Access Token de pagamento no cliente;
- token de cartão;
- comprovante financeiro por padrão.

Podem existir apenas metadados administrativos mínimos e auditáveis, como nota/referência textual da confirmação.

### 17.8 Página pública de regularização

Rota:

`/regularizacao`

Deve apresentar:

- Plano Completo;
- mensalidade;
- vencimento/tolerância;
- Link de Pagamento quando configurado;
- Pix quando configurado;
- contato de suporte.

A página declara que o pagamento ocorre fora do EMPROVEX e não solicita cartão/CVV.

Regularização, Termos, Privacidade e recuperação de credenciais não devem ficar inutilizáveis justamente quando o usuário está suspenso ou precisa recuperar acesso.

### 17.9 Confirmação/reabertura da competência

A confirmação manual é auditada.

- `paid` ou `waived` → competência confirmada; billing account comercial passa para `active`;
- reabertura/não confirmação → billing account passa para `pending`.

**Importante:** se o workspace tiver sido operacionalmente desabilitado pelo lifecycle, confirmar pagamento não equivale automaticamente a reativá-lo. A reativação de acesso é uma ação administrativa separada e explícita.

### 17.10 Suspensão operacional e reativação

A suspensão real da R1 é manual e founder-only.

Para suspender:

1. validar ator/admin;
2. validar coerência workspace/e-mail/UG/conta;
3. desabilitar `warehouseAccess`;
4. alterar `workspaces.status` e `platformAccounts.status` para `disabled`;
5. revogar sessões conhecidas e remover slots;
6. registrar auditoria;
7. compensar/rollback parcial se um banco falhar.

Reativação:

1. retorna workspace/conta principal para `active`;
2. retorna `warehouseAccess` para `active`;
3. se a segunda etapa falhar, o código tenta compensar para impedir estado incoerente;
4. falha parcial não é escondida: pode resultar em `RECOVERY_REQUIRED`.

Suspensão/reativação **não altera dados operacionais**.

### 17.11 Cancelamento e exclusão

`canceled` é estado comercial, não comando de delete.

Cancelamento não:

- apaga workspace;
- apaga documentos;
- apaga histórico;
- apaga estoque/ledger;
- reaproveita UG/e-mail automaticamente.

Retenção, exportação e exclusão são processos separados e sujeitos à política legal/administrativa aplicável.

### 17.12 Onboarding assistido

Não existe auto-cadastro de organização.

Fluxo canônico:

1. Fundador/admin confirma dados mínimos;
2. cria workspace/UG pelo painel;
3. informa e-mail operacional primário;
4. concede trial quando aplicável;
5. provisionamento cria Auth/diretório/billing;
6. credencial inicial é enviada por canal seguro;
7. primeiro acesso valida e-mail/provider/UID/workspace/UG;
8. usuário aceita pacote legal vigente;
9. checklist curto de primeiro acesso é exibido;
10. Google Drive é opcional;
11. usuário começa a operar.

Conta externa: password-only. Founder: Google-only.

### 17.13 Recuperação e troca de senha

R1 inclui:

- “Esqueci minha senha” usando fluxo nativo do Firebase;
- resposta neutra para reduzir enumeração de contas;
- troca da própria senha com reautenticação;
- mensagens humanas para credencial inválida, conta suspensa, workspace inconsistente e limite de sessão.

### 17.14 Legal Gate versionado

Pacote legal atual:

- `legalBundleVersion = saas-r1-2026-10-01`;
- `termsVersion = terms-2026-10-01-r1`;
- `privacyVersion = privacy-2026-10-01-r1`.

Aceite canônico:

`workspaces/{workspaceId}/legalAcceptances/{uid}__{legalBundleVersion}`

Registro contém:

- workspaceId;
- UG;
- UID;
- e-mail;
- versão do bundle;
- versão dos Termos;
- versão da Privacidade;
- timestamp autoritativo.

O runtime verifica especificamente a versão vigente. Novo aceite só é exigido quando o pacote legal configurado muda.

Falha na verificação é **fail-closed**: nenhum aceite é presumido.

Termos e Privacidade permanecem consultáveis no próprio gate.

Aceite contratual não significa que todo tratamento de dados pessoais dependa de “consentimento LGPD”.

### 17.15 Arquitetura de dados SaaS

Não criar terceiro Firestore apenas para billing/legal/onboarding.

Arquitetura R1:

1. banco principal — identidade, workspace, billing, legal, auditoria e núcleo operacional;
2. `emprovex-warehouse` — Central de Depósitos;
3. nenhum terceiro banco SaaS.

Rules são específicas por banco e continuam parte do contrato de release.

## 18. VIP e isenção comercial

### 18.1 Founder

Founder permanece:

- `exempt`;
- preço efetivo R$ 0;
- sem trial;
- sem inadimplência;
- isento do limite padrão de sessões externas.

### 18.2 VIP manual

VIP externo reutiliza a semântica `exempt`.

Contrato:

- mesmo Plano Completo;
- R$ 0 enquanto a isenção estiver ativa;
- nenhuma redução funcional;
- sem cobrança/atraso/suspensão por inadimplência;
- concessão/remoção manual, explícita e auditada;
- histórico preservado.

Não criar status `vip` concorrente.

### 18.3 VIP legado

Coorte histórica materializada:

- `aprovisionamento-2-b-fv`;
- `aprovisionamento-3-gac-ap`;
- `aprovisionamento-teste`.

O código atual protege a isenção `legacy_vip` contra remoção pela operação genérica de isenção.

VIP não cria exceção de segurança, sessão, Legal Gate ou isolamento multi-tenant. Isenção é comercial, não autorização privilegiada.

## 19. Ordem oficial da reta final SaaS

Estado funcional SaaS: **ENCERRADO PARA NOVAS FEATURES**.

Sequência vigente:

```text
HARDEN-A1/A2/C/D PASS
+ HARDEN-B em acompanhamento temporal
→ composição do RC único SaaS+Mobile
→ CT-01 + Rules/package/CI
→ gates combinados
→ RC FROZEN
→ Preview HTTPS
→ certificação real SaaS+Mobile
→ eventual produção controlada autorizada
→ piloto real
→ correções finais
→ SAAS-J
→ GO explícito
→ abertura comercial ampla
```

Nenhuma nova wave funcional SaaS está autorizada sem regressão concreta ou nova decisão de produto.

## 20. HARDEN — estado vivo

| Frente | Estado vigente | Decisão |
| --- | --- | --- |
| HARDEN-A1 — jsPDF | **PASS / ENCERRADA** | jsPDF 4.2.1 + AutoTable 5.0.8; CRITICAL removido; 7/7 regressão PDF; acabamento visual fino = backlog não bloqueante |
| HARDEN-A2 — Firebase/Firestore/gRPC | **PASS — RISCO RESIDUAL ACEITO TECNICAMENTE** | sem alteração de dependência/runtime/Rules; vetores analisados não alcançáveis pelos usos atuais |
| HARDEN-B — Recovery | **PARCIAL / ESPERA CONTROLADA** | controles ativos; backup READY/verify/restore pendentes |
| HARDEN-C — Health/Rules/Release | **PASS / ENCERRADA** | health/release/rollback preparados |
| HARDEN-D — SaaS↔Mobile | **PASS / ENCERRADA** | sem conflito funcional material; CT-01 isolada para o RC |

### A1 — regra pós-fechamento

A inspeção visual fina de PDF não bloqueia RC/piloto/lançamento.

Só reabre gate se surgir defeito funcional real, como:

- PDF vazio;
- geração quebrada;
- conteúdo ausente;
- ilegibilidade operacional;
- paginação funcionalmente destruída.

Margem, espaçamento, alinhamento e refinamento estético ficam em backlog.

### A2 — risco residual

A cadeia Firebase → Firestore → `@grpc/grpc-js` permanece instalada.

Decisão aceita:

- não forçar override fora do range do Firestore;
- não fazer downgrade/major só para reduzir scanner;
- uso browser não carrega o transporte Node gRPC;
- uso Node atual é cliente Firestore, sem servidor gRPC próprio nem primitivas de servidor analisadas;
- não abrir nova frente Firebase/gRPC sem nova evidência técnica ou correção upstream suportada.

Snapshot técnico da A2:

- Firebase declarado: `^10.12.2`;
- Firebase resolvido: `10.14.1`;
- `@firebase/firestore`: `4.7.3`;
- `@grpc/grpc-js`: `1.9.16`;
- pin Firestore: `~1.9.0`.

A aceitação de risco não declara a biblioteca intrinsecamente segura; declara o risco específico como não alcançável pelo uso atual e sem correção suportada melhor no momento.

## 21. HARDEN-B — recovery

Estado:

**PARCIAL — dependência temporal legítima**

Proteções confirmadas nos dois bancos:

- PITR: ativo;
- delete protection: ativa;
- schedule diário de backup: ativo;
- retenção: **14 semanas**;
- tooling `recovery:status` e `recovery:verify` disponível.

Pendências:

1. primeiro backup nativo `READY` no banco principal;
2. primeiro backup nativo `READY` no `emprovex-warehouse`;
3. capturar resource/location/snapshot/expiration;
4. executar `recovery:verify`;
5. preparar restore plan isolado;
6. restore real em banco novo/isolado;
7. validar dados, IAM, Rules, TTL e isolamento.

Não repetir `recovery:apply` enquanto controles permanecerem ativos.

Restore real continua ação protegida e requer autorização explícita quando chegar o momento.

### Relação HARDEN-B ↔ RC

- composição do RC: **não bloqueada**;
- Preview HTTPS sem writes críticos: **não bloqueado por B parcial**;
- produção controlada com writes reais: preferir fortemente `backup READY` nos dois bancos + `recovery:verify`;
- se houver promoção antes disso, o Fundador deve aceitar explicitamente o risco residual;
- abertura comercial final exige prova de recuperação adequada, incluindo restore isolado real conforme plano SaaS.

## 22. Health, Rules, observabilidade e release

### 22.1 Health

Contrato:

- `/api/health` público;
- não expõe dados sensíveis;
- não depende de leitura operacional do Firestore para responder saúde básica.

### 22.2 Observabilidade

Fontes oficiais R1:

- Vercel — deploy/runtime;
- GitHub Actions — certificação/gates;
- Cloud Monitoring — métricas/uptime;
- telemetria Firebase/Firestore já existente;
- logs de sessão/Central quando aplicável.

No ambiente publicado, validar:

- domínio/SSL;
- `/api/health`;
- erros runtime/HTTP;
- erros Firestore/permissão;
- erros de sessão;
- erros da Central;
- crashes do scanner;
- consumo inesperado;
- uptime check/alerta/canal quando materializados.

Uptime/alerta externo não deve ser declarado PASS sem evidência real do ambiente publicado.

### 22.3 Rules candidatas

SaaS e Mobile possuem Rules candidatas reconciliadas entre si.

Blobs auditados:

- candidata `firestore.rules`: `57a1394c921b2ab2c15537fbfc4aaea17515b28a`;
- candidata `firestore.warehouse.rules`: `6e1f1050005314db4e17cb3136409abbddb0ee91`;
- produção atual `firestore.rules`: `0d990b7de0b2e85ed55fe14ec0d2ce29b3635299`;
- produção atual `firestore.warehouse.rules`: `b5325fe5a8cbe9b0ade8568d35a2cd678ce6e0f2`.

As candidatas diferem de `main`.

Portanto publicação exige:

1. registrar conteúdo/hash das Rules atuais;
2. registrar conteúdo/hash das Rules RC;
3. executar testes multi-tenant/workspace externo/legal/billing/Central;
4. preparar comando de republicação das Rules anteriores;
5. não confundir rollback Vercel com rollback de Rules.

### 22.4 RULES-AUDIT-01 — auditoria integral de compatibilidade das Firestore Rules

Decisão do Fundador em 2026-10-03:

**as Rules do SaaS R1 + Mobile R1 não serão publicadas em produção por tentativa e erro. Antes de qualquer publicação produtiva, o ruleset final do RC deve passar por uma auditoria integral de compatibilidade.**

Classificação:

**GATE TRANSVERSAL OBRIGATÓRIO PRÉ-RC / PRÉ-PUBLICAÇÃO DE RULES**

Owner:

**Program Control + Coordenação do RC**

#### 22.4.1 Objetivo

Garantir, antes da publicação, que as Rules finais:

1. preservem tudo o que já funciona corretamente na Performance R3;
2. incorporem apenas os novos contratos necessários de SaaS R1, Mobile R1 e SESSION-CAP-01;
3. não introduzam regressões de autorização;
4. não abram acesso indevido;
5. não criem bloqueios sistêmicos de usuários legítimos;
6. mantenham isolamento multi-tenant;
7. mantenham a Central de Depósitos funcional;
8. tenham rollback conhecido e testável;
9. sejam compatíveis com a ordem real de rollout entre aplicação e Rules;
10. possam ser publicadas sem depender de correções improvisadas em produção.

#### 22.4.2 Estado atual das Rules antes da SESSION-CAP-01

Banco principal:

- produção / `main`: `firestore.rules@0d990b7de0b2e85ed55fe14ec0d2ce29b3635299`;
- candidata SaaS: `firestore.rules@57a1394c921b2ab2c15537fbfc4aaea17515b28a`;
- candidata Mobile: **idêntica à candidata SaaS**;
- tamanho aproximado produção: **87,49 KiB / 2.380 linhas**;
- tamanho aproximado candidata: **92,11 KiB / 2.500 linhas**;
- delta observado: aproximadamente **+124 / -4 linhas**.

Banco `emprovex-warehouse`:

- produção / `main`: `firestore.warehouse.rules@b5325fe5a8cbe9b0ade8568d35a2cd678ce6e0f2`;
- candidata SaaS: `firestore.warehouse.rules@6e1f1050005314db4e17cb3136409abbddb0ee91`;
- candidata Mobile: **idêntica à candidata SaaS**;
- tamanho aproximado produção: **151,55 KiB / 3.307 linhas**;
- tamanho aproximado candidata: **152,38 KiB / 3.330 linhas**;
- delta observado: aproximadamente **+24 / -1 linha**.

Conclusão atual:

**não existe conflito SaaS versus Mobile nas Rules candidatas conhecidas. O conflito a auditar é produção R3 versus ruleset final do novo release.**

Os hashes acima são baseline histórica desta auditoria. O PASS final deve usar os hashes do **ruleset pós-SESSION-CAP-01**, que podem ser diferentes.

#### 22.4.3 Dependência obrigatória da SESSION-CAP-01

A auditoria final só pode congelar PASS **depois** da SESSION-CAP-01.

Motivo:

- o runtime atual usa `sessionSlots/slot-1` e `slot-2`;
- as Rules atuais validam esse contrato fixo;
- SESSION-CAP-01 deverá permitir sessões dinâmicas ou mecanismo equivalente;
- portanto o ruleset final ainda sofrerá alteração estrutural.

Regra:

```text
SESSION-CAP-01
→ ruleset final estrutural
→ RULES-AUDIT-01
→ PASS RULES
→ composição/finalização do RC
```

Uma auditoria executada antes da SESSION-CAP-01 pode servir como **baseline**, mas não substitui a auditoria final.

#### 22.4.4 Princípio de compatibilidade

A auditoria não deve perguntar apenas:

> “o App RC funciona com Rules RC?”

Ela deve responder também:

> “as Rules RC preservam o comportamento legítimo já existente na Performance R3?”

Contrato:

**Rules finais = capacidades legítimas já existentes + novos contratos SaaS/Mobile + nenhum acesso indevido novo.**

Não é aceitável resolver uma necessidade nova apagando silenciosamente uma permissão legítima antiga.

#### 22.4.5 Fase A — captura da baseline realmente publicada

Antes de comparar arquivos do Git:

1. consultar o ruleset efetivamente ativo no banco principal;
2. consultar o ruleset efetivamente ativo no `emprovex-warehouse`;
3. registrar Ruleset ID/versão quando disponível;
4. guardar conteúdo/fingerprint/hash;
5. comparar com os blobs esperados de `main`;
6. registrar data/hora da captura;
7. registrar projeto/database alvo.

Se o ruleset realmente publicado divergir do `main` conhecido:

**STOP / DRIFT DE PRODUÇÃO**

Nenhuma publicação nova deve ocorrer antes de explicar e reconciliar a divergência.

#### 22.4.6 Fase B — diff estrutural e semântico

Não limitar a revisão a contagem de linhas.

Para cada arquivo:

- mapear helpers adicionados/removidos/alterados;
- mapear cada `match` adicionado/removido/alterado;
- mapear cada `allow read/get/list/create/update/delete/write`;
- identificar mudanças de provider;
- identificar mudanças de UID/e-mail/workspace/UG;
- identificar mudanças de lifecycle;
- identificar mudanças de billing/legal;
- identificar mudanças de sessão;
- identificar mudanças de `warehouseAccess`;
- identificar mudanças em validação de shape/tamanho/status;
- identificar mudança permissiva;
- identificar mudança restritiva;
- identificar mudança neutra/estrutural.

Cada delta deve possuir:

- origem;
- requisito que o justifica;
- superfície afetada;
- risco de falso ALLOW;
- risco de falso DENY;
- teste correspondente.

#### 22.4.7 Fase C — matriz ALLOW / DENY

Todo domínio modificado deve ter testes positivos e negativos.

Exemplo canônico:

```text
operação legítima do próprio workspace → ALLOW
mesma operação em outro workspace → DENY
sessão sem provider correto → DENY
sessão sem claim/identidade exigida → DENY
usuário não autenticado → DENY
admin onde não existe bypass operacional → DENY
payload válido → ALLOW
payload adulterado → DENY
```

A matriz deve cobrir no mínimo:

**Identidade / multi-tenant**
- founder Google;
- externo password;
- UID correto/incorreto;
- e-mail verificado;
- workspace próprio;
- workspace alheio;
- UG própria;
- UG divergente;
- sessão suspensa/desabilitada.

**Sessões**
- sessão dinâmica válida;
- renovação do próprio lease;
- tentativa de renovar lease de outra sessão;
- sessão revogada;
- tombstone;
- sessão expirada;
- múltiplas sessões legítimas;
- suspensão global do workspace;
- painel administrativo/encerramento remoto.

**Billing**
- configuração administrativa;
- preço R$ 70;
- VIP/`exempt`;
- VIP legado;
- competência;
- usuário externo sem permissão de alteração administrativa.

**Legal**
- GET do próprio aceite esperado;
- criação do próprio aceite vigente;
- versão errada;
- UID errado;
- workspace errado;
- listagem;
- update;
- delete.

**Central de Depósitos**
- founder;
- setor externo autorizado;
- setor externo sem claims;
- setor suspenso;
- `warehouseAccess active`;
- `warehouseAccess disabled`;
- workspace alheio;
- UG divergente.

**Operações logísticas**
- materiais;
- depósitos;
- posições/subposições;
- lotes;
- barcode;
- intake;
- allocation;
- transfer;
- inventory;
- outbound;
- ledger;
- saldos;
- configurações/layouts/destinos aplicáveis.

#### 22.4.8 Fase D — regressão do EMPROVEX legado

O ruleset novo deve rodar também contra as suítes de funcionalidades antigas.

Cobertura mínima:

- Empenhos;
- Itens;
- Notas Fiscais;
- Comissão;
- Liquidação/Tesouraria;
- Cronogramas;
- Fornecedores;
- Alertas;
- Relatórios/SAG;
- Auditoria;
- backup/status quando aplicável;
- Central Desktop;
- operações logísticas já certificadas.

Não é necessário criar teste manual novo para cada linha não alterada se já existir suíte automatizada confiável. Porém **todas as suítes relevantes devem ser executadas com o ruleset final**.

#### 22.4.9 Fase E — Emulator e suíte automatizada

Usar Firestore Emulator/Local Emulator Suite quando aplicável.

Suítes já existentes que devem ser reaproveitadas e ampliadas, entre outras:

- `scripts/firestore-multitenancy-security.test.mjs`;
- `scripts/warehouse-external-access-security.test.mjs`;
- `scripts/legal-acceptance-security.test.mjs`;
- `scripts/verify-saas-r1-security-enforcement.mjs`;
- `scripts/verify-sector-lifecycle.mjs`;
- `scripts/verify-saas-r1-integration.mjs`;
- guards Block 16.0/16.1/16.2;
- guards Block 17.1/17.2;
- testes da Central de Depósitos;
- segurança externa da Central.

Criar, quando a frente for executada, um orquestrador único ou comando equivalente:

`npm run verify:rc-rules-audit`

Objetivo:

**um comando deve reproduzir o gate das Rules do RC sem depender de uma sequência manual esquecível.**

#### 22.4.10 Fase F — matriz de compatibilidade de rollout

Avaliar explicitamente:

| Aplicação | Rules | Objetivo |
| --- | --- | --- |
| Performance R3 | Rules R3 | baseline conhecida |
| Performance R3 | Rules RC | provar compatibilidade durante publicação/rollback |
| App RC | Rules RC | produto final esperado |
| App RC | Rules R3 | identificar operações novas que exigem Rules novas e definir ordem segura de rollout |

A quarta combinação não precisa ser totalmente funcional; ela deve ser **conhecida**.

Se App RC depender obrigatoriamente de uma permissão inexistente nas Rules R3, documentar:

- qual fluxo falha;
- tipo de falha;
- ordem correta de rollout;
- impacto de rollback;
- janela aceitável.

Nenhuma ordem de deploy deve ser escolhida por suposição.

#### 22.4.11 Fase G — compatibilidade da migração de sessões

SESSION-CAP-01 merece análise explícita.

Se tecnicamente viável e seguro, preferir uma janela transitória em que as Rules reconheçam:

- slots legados `slot-1`/`slot-2`;
- IDs dinâmicos novos.

Objetivo:

- permitir rollout/rollback sem quebrar imediatamente clientes/versões anteriores;
- não obrigar migração destrutiva;
- manter segurança durante coexistência.

A compatibilidade legada só permanece enquanto necessária.

Não manter código/Rules legados indefinidamente sem motivo.

Se coexistência segura não for possível, documentar claramente:

- por que não;
- ordem obrigatória de rollout;
- procedimento de rollback;
- efeito sobre sessões já abertas.

#### 22.4.12 Fase H — análise de performance e custo das Rules

A auditoria deve verificar também:

- número de `get()`/`exists()` por avaliação;
- risco de exceder limites de document access calls;
- impacto de `warehouseLifecycleAllowsAccess`;
- impacto de sessões dinâmicas;
- tamanho do ruleset fonte;
- tamanho compilado quando disponível;
- tempo do Emulator;
- crescimento desnecessário de helpers duplicados.

Não resolver segurança aumentando de forma cega o número de leituras das Rules.

#### 22.4.13 Fase I — rollback de Rules

Antes da publicação, manter disponíveis:

**Banco principal**
- hash/blob da Rule anterior;
- arquivo exato anterior;
- comando/procedimento de republicação.

**Warehouse**
- hash/blob da Rule anterior;
- arquivo exato anterior;
- comando/procedimento de republicação.

Rollback de Rules deve ser independente do rollback da aplicação.

Regra:

```text
rollback Vercel != rollback Rules != rollback dados
```

Se uma Rule permissiva indevida tiver permitido escrita/leitura inadequada, republicar a Rule anterior **não desfaz dados já gravados**.

Nesse caso:

1. fechar acesso;
2. identificar janela;
3. auditar documentos/movimentos;
4. reconciliar dados;
5. só depois encerrar incidente.

#### 22.4.14 Fase J — evidência obrigatória

O handoff da RULES-AUDIT-01 deve entregar:

- RULES_MAIN_HASH;
- RULES_RC_HASH;
- WAREHOUSE_RULES_MAIN_HASH;
- WAREHOUSE_RULES_RC_HASH;
- ruleset IDs ativos quando capturáveis;
- diff estrutural;
- diff semântico;
- matriz ALLOW/DENY;
- testes executados;
- contagem PASS/FAIL;
- regressão do legado;
- regressão SaaS;
- regressão Mobile;
- regressão SESSION-CAP-01;
- compatibilidade de rollout;
- tamanho fonte/compilado quando disponível;
- rollback principal;
- rollback warehouse;
- riscos residuais;
- recomendação final.

Classificações permitidas:

- **PASS — RULES APTAS PARA RC**;
- **PARCIAL — CORREÇÃO NECESSÁRIA**;
- **FAIL — BLOQUEAR RC**.

Não existe “PASS por inferência”.

#### 22.4.15 Critérios mínimos de PASS

RULES-AUDIT-01 só pode ser PASS se:

1. Rules ativas atuais forem conhecidas e reconciliadas;
2. não existir drift produtivo inexplicado;
3. SESSION-CAP-01 já estiver refletida no ruleset final;
4. SaaS e Mobile apontarem para o mesmo ruleset final;
5. ALLOW legítimos críticos passarem;
6. DENY de segurança críticos passarem;
7. cross-workspace continuar DENY;
8. founder continuar funcional;
9. externos legítimos continuarem funcionais;
10. Legal Gate funcionar;
11. billing administrativo funcionar sem virar autorização operacional;
12. lifecycle/suspensão/reativação funcionar;
13. Central Desktop funcionar;
14. Central Mobile funcionar;
15. sessões dinâmicas funcionarem;
16. regressão R3 relevante passar;
17. nenhum acesso permissivo novo inexplicado existir;
18. nenhum bloqueio sistêmico novo existir;
19. rollback de ambos os bancos estiver preparado;
20. ordem de rollout estiver definida;
21. tamanho/complexidade do ruleset estiver dentro dos limites aplicáveis;
22. gates automatizados estiverem reproduzíveis.

#### 22.4.16 Regra de publicação

**Nenhuma Firestore Rule produtiva nova do SaaS R1/Mobile R1 poderá ser publicada sem RULES-AUDIT-01 = PASS.**

Exceção:

somente correção emergencial de segurança/incidente real, com autorização explícita do Fundador e Program Control, evidência mínima, rollback pronto e auditoria retrospectiva obrigatória.

CI verde isolado não substitui RULES-AUDIT-01.

PR mergeable não substitui RULES-AUDIT-01.

Preview aprovado não substitui RULES-AUDIT-01.

#### 22.4.17 Relação com o RC

A sequência oficial passa a ser:

```text
SESSION-CAP-01
→ ruleset final
→ RULES-AUDIT-01
→ PASS RULES
→ composição/finalização RC
→ CT-01/package/CI
→ gates combinados
→ RC CANDIDATE
→ RC FROZEN
→ Preview HTTPS
```

Se qualquer mudança posterior ao PASS alterar:

- `firestore.rules`;
- `firestore.warehouse.rules`;
- Auth/provider;
- UID/workspace/UG;
- lifecycle;
- Legal;
- billing enforcement;
- sessão;
- `warehouseAccess`;

o PASS de Rules deve ser considerado **afetado** e os blocos correspondentes da auditoria precisam ser repetidos antes do freeze.

### 22.5 Runbook de incidente

Sequência mínima:

1. confirmar domínio/deployment;
2. verificar health/runtime;
3. verificar Firestore/Monitoring;
4. classificar impacto;
5. interromper writes se houver dúvida de integridade;
6. corrigir ou rollback;
7. reconciliar dados antes de qualquer correção manual;
8. registrar incidente material.

Problema visual isolado não é automaticamente incidente de rollback.

## 23. CT-01 — contrato transversal obrigatório do RC

Estado atual:

- SaaS/main: `camera=(), microphone=(), geolocation=()`;
- Mobile: `camera=(self), microphone=(), geolocation=()`.

Contrato global do RC:

`camera=(self), microphone=(), geolocation=()`

Interpretação:

- câmera same-origin permitida;
- microfone continua bloqueado;
- geolocalização continua bloqueada;
- `getUserMedia` ainda depende de HTTPS/contexto seguro e permissão do navegador.

Ownership:

**Coordenação do RC.**

MOBILE-J não altera globalmente `next.config.ts` por conta própria.

Antes do PASS final:

- materializar CT-01 na branch RC;
- executar gates afetados;
- publicar Preview HTTPS;
- validar o header HTTP realmente servido;
- provar câmera real em dispositivo físico.

# PARTE VII — MOBILE R1

## 24. Objetivo e contrato Mobile R1

Levar operações físicas da Central de Depósitos ao navegador móvel sem criar segunda fonte da verdade.

Contrato:

- web mobile;
- online-first;
- mesma Auth/workspace/UG;
- mesmo Legal Gate/lifecycle/sessão;
- scanner compartilhado;
- EPX1 apenas como identidade física;
- resolver sempre contra entidades canônicas;
- repositories/ledger/saldo/lote/posição oficiais;
- fallback manual;
- sem banco Mobile paralelo;
- sem operação offline integral na R1.

## 25. Estado funcional consolidado

Concluído e integrado:

- MOBILE-A — plataforma/scanner;
- MOBILE-B — etiquetas/resolver;
- Integração 1;
- MOBILE-C — alocação;
- MOBILE-D — transferência;
- MOBILE-E — consulta;
- Integração 2;
- MOBILE-F — inventário;
- MOBILE-G — saída;
- MOBILE-H — conferência;
- Integração 3;
- MOBILE-I — integração controlada A–H.

MOBILE-I:

- worker certificado: `ea5ad10054e2aea608e270a970fde723cde41d93`;
- PR #245: merged;
- squash: `3a5689e0e613adfb7dbf48ef8d44085ec6c951b3`;
- gates principais: PASS;
- novo delta funcional SaaS↔Mobile: nenhum.

Não reabrir F/G/H/I sem regressão concreta.

## 26. MOBILE-J — certificação final

Branch:

`mobile-r1-j-final-certification@90d646372aae3e92318a78b90d71f72c5eb6b00e`

PR #246:

**OPEN / DRAFT / MERGEABLE**

Classificação:

**PARCIAL TECNICAMENTE SAUDÁVEL / CERTIFICAÇÃO EM EXECUÇÃO**

Escopo permitido:

- certificação;
- evidência;
- regressão concreta mínima;
- nenhuma feature nova.

Próximo marco real:

**RC em Preview HTTPS → testes físicos → reconciliação SaaS final → avaliação de PASS FINAL.**

Runbook especializado:

`mobile-r1-j-final-certification:docs/CENTRAL_MOBILE_R1_MOBILE_J_PHYSICAL_TEST_RUNBOOK.md`

## 27. Certificação física obrigatória

### Android / Chrome

Validar:

- Home Mobile;
- câmera permitida;
- câmera negada;
- câmera indisponível;
- fallback manual;
- abrir/fechar câmera;
- troca/retorno de rota;
- scan válido;
- double scan;
- cooldown;
- scans consecutivos;
- luz baixa/reflexo;
- perda/retorno de rede.

### iPhone / Safari

Executar os mesmos cenários quando houver aparelho disponível.

Se não houver aparelho:

**PENDENTE — APARELHO NÃO DISPONÍVEL**

Não inferir PASS de iPhone a partir de Android.

### Code128 físico

Imprimir e testar:

- COMPACT;
- MEDIUM;
- LARGE.

Validar no mínimo:

- LOCAL;
- SUBPOSITION;
- material/produto;
- distância/enquadramento/contraste;
- repetição;
- ausência de confusão entre etiquetas próximas.

Geração digital isolada não é certificação física.

### Feedback físico

Validar:

- som de sucesso;
- som de erro;
- vibração;
- feedback visual;
- ausência de duplo feedback enganoso;
- erro de persistência sem falso sucesso.

### UX real

Validar:

- uso com uma mão;
- legibilidade;
- botões;
- orientação/scroll;
- loading/empty states;
- foco/teclado;
- Enter quando aplicável;
- scanner ↔ formulário;
- recuperação após erro;
- mensagens de confirmação.

Classificar defeitos:

- BLOQUEANTE;
- IMPORTANTE;
- COSMÉTICO;
- BACKLOG.

Só regressão funcional concreta reabre desenvolvimento.

## 28. Jornada física, invariantes, performance e PASS final

Jornada mínima:

```text
LOGIN
→ CENTRAL MOBILE
→ LER MATERIAL/POSIÇÃO
→ ALLOCATE
→ CONSULTAR
→ TRANSFERIR
→ CONFERIR
→ INVENTARIAR
→ OUTBOUND
→ CONSULTAR ESTADO FINAL
→ CENTRAL DESKTOP
→ CONFIRMAR COERÊNCIA
```

Registrar IDs relevantes: workspace/UG/material/barcode/depósito/posições/lote/movementIds/inventoryId/outboundId.

Invariantes:

- ALLOCATE usa posição/barcode/material canônicos;
- TRANSFER preserva total agregado e não gera saldo negativo;
- inventário salvo não altera saldo antes da revisão/confirm;
- OUTBOUND respeita posição/lote/FEFO/idempotência;
- conferência é read-only e usa transferência como correção oficial;
- Desktop e Mobile mostram o mesmo material/saldo/posição/lote/histórico/ledger.

Rede:

- perda antes de operação crítica deve falhar fechada;
- nenhum falso sucesso;
- retorno permite retomada/reconciliação segura;
- idempotência deve impedir duplicação.

Performance de referência pós-Integração 3/MOBILE-I:

- `/central-mobile`: 257 kB;
- `/central-mobile/alocar`: 275 kB;
- `/central-mobile/transferir`: 261 kB;
- `/central-mobile/inventario`: 271 kB;
- `/central-mobile/saida`: 265 kB;
- `/central-mobile/conferir`: 260 kB;
- Shared First Load: 104 kB.

PASS FINAL Mobile exige:

- testes físicos reais;
- CT-01 observada no Preview;
- jornada ponta a ponta;
- coerência Desktop↔Mobile;
- gates técnicos verdes;
- reconciliação final contra o HEAD/RC SaaS;
- nenhum conflito transversal aberto.

O Coordenador Mobile recomenda; Program Control decide a barreira global.

# PARTE VIII — TESTES, CI E RELEASE

## 29. Política de testes e evidência

Browser E2E não é gate universal.

Prioridade:

- instalação reproduzível;
- TypeScript;
- production build;
- testes de domínio;
- guards estruturais;
- multi-tenant;
- Firestore Emulator quando aplicável;
- Core Protection;
- Recovery;
- Legal Validation;
- diff hygiene;
- testes específicos do RC.

Validação manual é legítima e obrigatória para câmera/scanner/barcode/UX física.

**Não inferir PASS sem execução real quando o requisito depende de hardware/navegador/ambiente publicado.**

## 30. Vercel e Preview HTTPS

Durante desenvolvimento, `build-rate-limit` isolado não é regressão de código.

Para RC:

- Preview HTTPS deve apontar para o **mesmo SHA congelado** que poderá ser promovido;
- não testar um build e reconstruir outro para produção;
- validar header CT-01 no HTTP efetivo;
- usar Preview para fechar MOBILE-J e smoke SaaS antes de tocar domínio produtivo.

## 31. Produção, main e autorizações

`main` é baseline conhecida/recuperável, não branch de experimentação.

Problema encontrado em teste:

```text
bug
→ branch curta/hotfix rastreável
→ teste
→ integração no RC
→ gates afetados
→ novo freeze quando necessário
```

Não “corrigir direto na main”.

Ações protegidas dependem de autorização explícita do Fundador:

- merge/release final para `main`;
- Vercel production/promotion;
- Rules produtivas;
- restore real quando aplicável;
- migração destrutiva;
- ação disruptiva em usuário/workspace real;
- GO/NO-GO de produção e lançamento.

### 31.1 Três planos de rollback

Rollback de aplicação não é rollback total do sistema.

Separar:

1. **Aplicação/Vercel** — voltar ao deployment conhecido;
2. **Rules** — republicar Rules anteriores;
3. **Dados** — reconciliar movimentos/writes; não existe “desfazer automático” por rollback Vercel.

Rollback de Vercel não apaga:

- movimentos;
- ledger;
- billing/legal/lifecycle persistido;
- documentos criados;
- alterações de estoque já gravadas.

### 31.2 Estratégia de teste com menor risco

Na certificação publicada:

- usar workspace/material controlado;
- evitar estoque institucional crítico;
- evitar deletes;
- evitar migração destrutiva;
- registrar IDs das operações;
- interromper writes diante de dúvida de integridade;
- auditar ledger/saldos antes de correção manual.

### 31.3 Gatilhos de NO-GO/rollback

Escalar imediatamente se houver:

- falha sistêmica de login;
- founder ou usuário legítimo bloqueado de forma generalizada;
- cross-workspace;
- Rules permitindo acesso indevido;
- Rules negando operação essencial de forma sistêmica;
- saldo negativo/divergente;
- ledger duplicado;
- idempotência quebrada;
- perda de material/lote/posição;
- billing/lifecycle incorreto;
- Legal Gate impedindo uso legítimo de forma sistêmica;
- scanner indisponível por CT-01;
- erro runtime grave;
- regressão grave do Desktop.

Problema exclusivamente visual não exige rollback automático.

# PARTE IX — RISCOS E GATES ABERTOS

## 32. Gates técnicos ainda abertos

### 32.1 Antes do RC CANDIDATE

Já concluído nesta barreira:

- SESSION-CAP-01: **PASS TÉCNICO COMPLETO / INTEGRADA**;
- RULES-AUDIT-01: **PASS — RULES APTAS PARA RC**;
- Rules produtivas principal e Warehouse capturadas: **SEM DRIFT**;
- TTL `sessionSlots.expiresAt` e `sessionRevocations.expiresAt`: **ACTIVE**;
- compatibilidade de rollout/rollback de Rules documentada;
- guards de sessão/Rules/lifecycle/telemetria e Browser E2E: PASS.

Ainda obrigatório antes de declarar RC CANDIDATE:

- criar/fixar branch única de composição;
- fixar fontes SaaS e Mobile;
- incorporar semanticamente os deltas;
- aplicar CT-01;
- reconciliar Auth/workspace/UG/sessão/Legal/billing/lifecycle;
- reconciliar Rules principal e Warehouse;
- reconciliar package/lockfile/Application CI;
- reconciliar repositories/shell/scanner/Central;
- registrar hashes do candidato;
- executar gates combinados no SHA exato;
- obter todos os gates obrigatórios verdes.

A validação física com múltiplos operadores Desktop/Mobile pertence à etapa de Preview HTTPS/MOBILE-J após o candidato congelado.

### 32.2 Antes do RC FROZEN

- nenhum conflito material;
- SHA único;
- manifesto de release;
- rollback de aplicação preparado;
- rollback de Rules preparado;
- baseline Performance R3 registrada;
- nenhuma mudança oportunista aberta.

### 32.3 Antes de produção controlada

- RULES-AUDIT-01 permanece válida para os hashes exatos do RC;
- nenhuma alteração de Rules posterior ao PASS ficou sem reauditoria;
- Preview aprovado;
- smoke crítico SaaS+Mobile;
- CT-01 comprovada;
- Rules comprovadas;
- integridade de dados sem dúvida;
- rollback pronto;
- risco HARDEN-B avaliado;
- autorização explícita do Fundador.

Preferência: backup READY nos dois bancos + `recovery:verify`.

### 32.4 Antes de PASS FINAL Mobile

- runbook físico executado;
- Android;
- iPhone ou pendência explicitamente classificada;
- Code128;
- som/vibração;
- rede;
- jornada ponta a ponta;
- Desktop↔Mobile;
- reconciliação final SaaS.

### 32.5 Antes da abertura comercial ampla

- piloto real;
- cliente pago real;
- trial→regularização;
- suspensão→bloqueio→reativação controlada;
- recovery/restore comprovado;
- uptime/alerta;
- custo/capacidade;
- SAAS-J;
- pendências classificadas;
- GO explícito.

## 33. Riscos que não podem ser esquecidos

- confundir billing comercial com autorização operacional;
- assumir que “pago” reativa automaticamente lifecycle desabilitado;
- apagar dados por inadimplência/cancelamento;
- deixar usuário suspenso sem regularização/recuperação acessível;
- duplicar Auth/sessão/legal na Mobile;
- confundir a remoção autorizada do teto de sessões com remoção do controle de sessão;
- manter por engano os IDs fixos `slot-1`/`slot-2` após declarar sessões sem teto;
- remover revogação/lease/telemetria junto com o limite;
- usar números históricos de lease/heartbeat em vez do runtime atual 30/15;
- sobrescrever CT-01;
- publicar Rules sem RULES-AUDIT-01 PASS;
- presumir que Rules do Git são idênticas às realmente ativas em produção;
- testar apenas ALLOW e esquecer DENY;
- validar apenas App RC + Rules RC e ignorar a janela de rollout/rollback;
- alterar Rules após auditoria sem invalidar/repetir o gate;
- publicar Rules sem rollback;
- confundir rollback Vercel com rollback de dados;
- merge/rebase cego entre SaaS e Mobile;
- criar fonte paralela logística;
- reabrir A1/A2 sem nova evidência;
- declarar uptime/backup/restore sem evidência real;
- declarar iPhone PASS por inferência;
- corrigir diretamente em `main`;
- tratar acabamento visual de PDF como blocker sem defeito funcional;
- considerar CI verde como autorização produtiva.

# PARTE X — CRONOLOGIA CANÔNICA

## 34. Marcos históricos principais

### 2026-09 — Central de Depósitos

Consolidados materiais, depósitos/posições, lotes/FEFO, intake, saída, consumo imediato, barcode, ledger, segurança externa e telemetria.

### 2026-10-01 — Performance R3

Rodada encerrada e publicada.

Baseline produtiva atual:

`main@e90f92acae1514ee5cbc6ce95fed354bc1454330`

### 2026-10-01 a 2026-10-02 — SaaS R1 funcional

Integrados billing, onboarding, legal, recovery tooling, lifecycle/security e integração SaaS.

Contrato comercial consolidado em R$ 70 / Plano Completo.

### 2026-10-02 — Program Control

Instituída governança global acima dos programas, com barreiras transversais e autoridade global de RC.

### 2026-10-02 a 2026-10-03 — Mobile R1 funcional

A–H, Integrações 1–3 e MOBILE-I concluídas/integradas.

Desenvolvimento funcional Mobile encerrado.

### 2026-10-03 — Hardening final

- HARDEN-A1: PASS;
- HARDEN-A2: PASS com risco residual aceito;
- HARDEN-C/D: PASS;
- HARDEN-B: parcial/temporal;
- MOBILE-J: certificação final;
- RC conjunto: composição liberada;
- produção: inalterada.

### 2026-10-03 — Remoção do teto fixo de sessões autorizada

Decisão do Fundador:

- remover o limite fixo de 2 sessões externas por workspace/UG;
- motivação principal: permitir múltiplos operadores simultâneos na Central Móvel;
- preservar lease, heartbeat, revogação, painel administrativo, auditoria, lifecycle e telemetria;
- implementar em frente transversal controlada `SESSION-CAP-01`;
- executar antes do RC CANDIDATE/RC FROZEN;
- até a execução, o runtime permanece em 2 sessões externas.

### 2026-10-03 — Auditoria integral de Rules torna-se gate obrigatório

Decisão do Fundador:

- não publicar as novas Firestore Rules por tentativa e erro;
- instituir `RULES-AUDIT-01`;
- auditar banco principal e `emprovex-warehouse`;
- comparar produção real versus ruleset final;
- exigir matriz ALLOW/DENY;
- exigir regressão das funcionalidades antigas e novas;
- exigir compatibilidade de rollout/rollback;
- executar auditoria final depois da SESSION-CAP-01;
- bloquear publicação produtiva de Rules sem PASS formal.

### 2026-10-03 — SESSION-CAP-01 + RULES-AUDIT-01 ativadas

Program Control criou a frente transversal única:

- branch: `rc-session-cap-rules-audit`;
- base congelada: `c6c164c70a1be3e2e7e4e57b0bbf4866d61a71ce`;
- fase 1: SESSION-CAP-01 — remover o teto fixo de 2 sessões preservando segurança, revogação, lifecycle, painel, auditoria e telemetria;
- fase 2: RULES-AUDIT-01 — auditar o ruleset final pós-SESSION-CAP-01 contra a produção/R3, SaaS, Mobile e rollback;
- integração cruzada/merge/rebase da integradora durante a execução: proibidos;
- publicação de Rules, deploy produtivo, merge em `main` e restore: não autorizados;
- handoff final obrigatório ao Program Control.

A frente deve permanecer sequencial: RULES-AUDIT-01 só pode declarar PASS final depois que SESSION-CAP-01 estabilizar o ruleset estrutural.

### 2026-10-04 — SESSION-CAP-01 concluída tecnicamente

Worker `rc-session-cap-rules-audit` encerrou desenvolvimento técnico em:

`a97c1a94799cbbc240994d76fefc6f85925bffe1`

PR:

**#248 — DRAFT / MERGEABLE / NÃO INTEGRADO**

Resultado aceito pelo Program Control:

- SESSION-CAP-01: **PASS TÉCNICO COMPLETO**;
- teto fixo de 2 sessões removido no candidato;
- lease dinâmico por `browserInstanceId`;
- lease 30 min / heartbeat 15 min / revogação 24 h preservados;
- `slot-1` e `slot-2` preservados somente para compatibilidade transitória;
- 3ª e 4ª sessões legítimas: ALLOW;
- pseudo-slot `slot-3`, ID dinâmico adulterado e takeover de lease ativo: DENY;
- painel administrativo, lifecycle, provisioning, revogação, auditoria e telemetria reconciliados;
- suspensão do workspace permanece fail-closed para N sessões;
- multi-tenant preservado.

Gates confirmados no fechamento:

- Application CI #959 — SUCCESS;
- Core Protection #246 — SUCCESS;
- Recovery #637 — SUCCESS;
- Legal Validation #61 — SUCCESS;
- Production Build — PASS;
- TypeScript final — PASS;
- Diff Hygiene — PASS;
- Browser E2E #49 / run 37171327188 — SUCCESS no SHA certificado `44372599fe0526313d3650a55c649615a1ff14d4`;
- Bloco 16.8 — 8/8 PASS;
- quatro sessões independentes + multitab compartilhado — 1/1 PASS.

Vercel permaneceu vermelho apenas por `build-rate-limit`, sem evidência de regressão funcional.

Produção, `main`, Vercel Production e Rules produtivas permaneceram inalterados.

### 2026-10-04 — Baseline produtiva das Rules confirmada sem drift

Leitura somente de produção concluída nos dois bancos.

Ruleset ativo — banco principal:

- release: `cloud.firestore/ai-studio-logsticahospital-3eeee498-faa1-4326-8f4f-95d34b382ec1`;
- ruleset ID: `06094fa5-0b5b-4dc0-a0b5-7ca032864860`;
- fingerprint Git normalizado: `0d990b7de0b2e85ed55fe14ec0d2ce29b3635299`;
- baseline esperada de `main`: `0d990b7de0b2e85ed55fe14ec0d2ce29b3635299`;
- drift: **NENHUM**.

Ruleset ativo — Warehouse:

- release: `cloud.firestore/emprovex-warehouse`;
- ruleset ID: `d246184a-350f-40a0-8241-f2b0fa631768`;
- fingerprint Git normalizado: `b5325fe5a8cbe9b0ade8568d35a2cd678ce6e0f2`;
- baseline esperada de `main`: `b5325fe5a8cbe9b0ade8568d35a2cd678ce6e0f2`;
- drift: **NENHUM**.

Primeiro gate externo da RULES-AUDIT-01: **PASS**.

### 2026-10-04 — RULES-AUDIT-01 encerrada em PASS

Verificação final confirmou:

- `sessionSlots.expiresAt`: `ACTIVE`;
- `sessionRevocations.expiresAt`: `ACTIVE`.

Com as Rules vivas previamente confirmadas sem drift e o inventário pré-TTL validado, o Program Control declara:

**RULES-AUDIT-01 = PASS — RULES APTAS PARA RC**

SESSION-CAP-01 permanece:

**PASS TÉCNICO COMPLETO**

Integração:

- PR #248 marcado ready;
- PR #248 squash-merged na integradora SaaS/RC;
- commit de integração: `54aba792cb9e7bb195e21401fb50a21ed50add19`;
- `main`: inalterado;
- aplicação RC: não publicada;
- Rules RC: não publicadas.

Próxima barreira global:

**composição do RC único SaaS R1 + Mobile R1**, seguida de CT-01, reconciliação package/lockfile/CI e gates no SHA exato.

### 2026-10-04 — TTL produtivo autorizado e em criação

Após autorização explícita do Fundador, foram iniciadas exclusivamente as políticas TTL em:

- `sessionSlots.expiresAt`;
- `sessionRevocations.expiresAt`;

no banco principal:

`ai-studio-logsticahospital-3eeee498-faa1-4326-8f4f-95d34b382ec1`.

Operações retornadas:

- sessionSlots: `AyBjNGNiYzA2Zjk5ZWQtOTU0YS01ZjY0LTQ3OGEtODg4OTM2ZGMkGnNlbmlsZXBpcAkKMxI`;
- sessionRevocations: `AyBiZjE1ZWYwMTMxMjgtMGU3OC03Yjc0LWQxZjUtZWYxNTNjY2EkGnNlbmlsZXBpcAkKMxI`.

Leitura imediata pós-ativação:

- sessionSlots.expiresAt → `ttlConfig.state = CREATING`;
- sessionRevocations.expiresAt → `ttlConfig.state = CREATING`.

Conclusão:

- comando de ativação aceito nos dois campos;
- nenhuma outra configuração produtiva foi alterada;
- RULES-AUDIT-01 permanece aberta somente até os dois TTLs atingirem `ACTIVE`;
- nenhuma nova escrita/configuração deve ser feita durante essa espera.

### 2026-10-04 — Inventário pré-TTL validado

Leitura somente de produção executada antes de qualquer ativação de TTL.

`sessionSlots`:

- total: **5**;
- sem `expiresAt`: **0**;
- expirados: **5**;
- não expirados: **0**.

`sessionRevocations`:

- total: **0**;
- sem `expiresAt`: **0**;
- expirados: **0**;
- não expirados: **0**.

Conclusão operacional:

- não existe sessão ativa que seria atingida imediatamente pela ativação de TTL;
- os 5 documentos existentes em `sessionSlots` já estão expirados e são resíduos de lease;
- não existem tombstones de revogação pendentes;
- ativar TTL nos dois collection groups é tecnicamente coerente com o contrato da SESSION-CAP-01;
- a ativação continua sendo mudança produtiva de retenção e exige autorização explícita do Fundador.

### 2026-10-04 — TTL produtivo ausente

Consulta somente leitura de:

- `sessionSlots.expiresAt`;
- `sessionRevocations.expiresAt`;

retornou somente `indexConfig`, sem `ttlConfig`.

Conclusão:

**TTL NÃO CONFIGURADO** nos dois collection groups.

Impacto:

- RULES-AUDIT-01 ainda não recebe PASS FINAL;
- SESSION-CAP-01 continua PASS técnico;
- ativar TTL é mudança produtiva de retenção e pode excluir documentos já expirados;
- ativação exige decisão/autorização explícita do Fundador;
- antes da ativação, Program Control deve preferencialmente inspecionar os documentos existentes e confirmar que `expiresAt` está coerente.

### 2026-10-04 — RULES-AUDIT-01 em fechamento externo

Classificação:

**PRONTA PARA FECHAMENTO EXTERNO / AINDA NÃO PASS FINAL**

Rules candidatas pós-SESSION-CAP:

- principal RC: `bc91185f34bcdcb4437a4de1078d1089a09292ba`;
- Warehouse RC: `6e1f1050005314db4e17cb3136409abbddb0ee91`.

Faltam apenas dois gates vivos:

1. capturar em modo somente leitura os rulesets realmente ativos nos dois bancos e comparar drift;
2. confirmar TTL realmente configurado para:
   - `sessionSlots.expiresAt`;
   - `sessionRevocations.expiresAt`.

Se houver drift inexplicado:

**STOP PRODUCTION RULES DRIFT — NÃO PUBLICAR.**

Se baseline vivo e TTL forem coerentes, Program Control poderá fechar RULES-AUDIT-01 e seguir para integração/RC conforme governança.

Ordem de rollout candidata, se mantida após os gates vivos:

```text
Rules RC
→ aplicação RC
```

Compatibilidade comprovada:

- app antiga + Rules RC: compatível via `slot-1`/`slot-2`;
- app RC + Rules RC: alvo;
- app RC + Rules antigas: incompatível.

Rollback:

- aplicação pode voltar primeiro mantendo Rules RC;
- rollback das Rules exige rollback prévio da aplicação.

### 2026-10-03 — Transição para Release Engineering

Por decisão do Fundador:

- Coordenador Geral assume também Coordenação do RC;
- Coordenadores SaaS/Mobile entram em modo consulta/evidência;
- nenhuma nova wave funcional autorizada;
- próximo produto a ser construído é um único SHA de RC SaaS+Mobile.

### 2026-10-15 — Regularização controlada do Suco (Warehouse)

Após retirada dos estoques de teste e remoção das NFs da fila pelo Fundador, permaneceu um saldo legado de 5 unidades do Suco sem localização. A ocorrência `POSITIVE_UNASSIGNED=5` já constava do memorial de integridade e fora excluída expressamente do reparo anterior dos lotes.

A manutenção pontual foi preparada no [PR #310](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/310) e executada pelo Fundador no PowerShell com autenticação gcloud. Dry-run PASS, backup local pré-write e correção atômica PASS: `balances` 5→0, `locationBalances.UNASSIGNED` 5→0, movimento `INVENTORY_ADJUSTMENT` -5 preservando ledger/histórico. Nenhum deploy, merge, alteração de Rules ou exclusão de NFs. Outros materiais não foram abrangidos por essa conferência.

---

# PARTE XI — DECISÕES PERMANENTES

## 35. Decisões que só podem mudar por decisão explícita

### Produto

- experiência operacional prevalece sobre otimização marginal;
- SaaS e Mobile são interfaces do mesmo produto;
- Central Mobile não cria backend/fonte de verdade paralelos;
- uma única autoridade por material/saldo/lote/posição/ledger.

### Comercial

- Plano Completo R$ 70/mês por workspace;
- trial padrão 30 dias;
- vencimento 5º dia útil;
- tolerância 10 dias;
- cobrança externa;
- confirmação manual;
- modo observe;
- sem suspensão automática;
- sem delete por inadimplência;
- API/webhook fora da R1;
- founder/VIP usam `exempt`;
- VIP não perde funcionalidades.

### Billing versus lifecycle

- `billingAccounts` é fonte comercial;
- `workspaces.status` + `platformAccounts.status` + `warehouseAccess` governam acesso;
- status comercial sozinho não deve virar autorização;
- suspensão/reativação real é ação administrativa explícita;
- pagamento confirmado não reativa automaticamente lifecycle desabilitado.

### Identidade e sessão

- founder Google-only;
- externo password-only;
- workspace/UG/UID/e-mail precisam ser coerentes;
- founder isento de capacidade;
- runtime atual dos externos: 2 sessões, **com remoção do teto fixo já autorizada pelo Fundador**;
- estado alvo: sessões externas sem limite fixo por workspace, preservando identidade/lease/revogação/auditoria/telemetria;
- a migração deve ocorrer antes do RC freeze;
- lease atual permanece 30 min;
- heartbeat atual permanece 15 min;
- revogação administrativa encerra sessões conhecidas;
- fail-closed em inconsistência.

### Legal

- pacote legal versionado;
- versão atual `saas-r1-2026-10-01`;
- aceite por UID + bundle;
- nenhum aceite é presumido em erro;
- VIP não possui exceção legal;
- regularização/Termos/Privacidade/recuperação não devem ser bloqueadas indevidamente.

### Dados

- cancelamento comercial não apaga dados;
- suspensão não altera estoque/documentos;
- exportação/retenção/exclusão são processos separados;
- nenhum rollback improvisado de estoque/ledger.

### Segurança e dependências

- RULES-AUDIT-01 é gate obrigatório antes de publicar Rules do novo release;
- Rules realmente ativas devem ser capturadas e comparadas ao Git antes de rollout;
- todo delta de Rule precisa de justificativa + teste ALLOW/DENY;
- regressão da Performance R3 é obrigatória com o ruleset final;
- rollback de Rules é separado de rollback Vercel;
- alteração de Rules após PASS invalida os blocos afetados da auditoria;
- Rules não são afrouxadas para facilitar teste;
- CT-01 permite somente câmera same-origin;
- microfone/geolocalização permanecem bloqueados;
- A2 não reabre sem nova evidência/upstream relevante;
- não usar `npm audit fix --force` como estratégia.

### PDFs

- jsPDF 4.2.1 / AutoTable 5.0.8;
- defeito funcional em PDF bloqueia;
- acabamento visual fino isolado não bloqueia e pode ir para backlog.

### Release

- `main` não é branch de experimentação;
- Preview testa o SHA que poderá ser promovido;
- aplicação, Rules e dados possuem rollback/reconciliação distintos;
- CI verde não autoriza produção;
- Fundador mantém GO/NO-GO produtivo final.

### Desenvolvimento

- novas features SaaS/Mobile estão congeladas durante a composição/certificação do RC;
- corrigir apenas regressão concreta;
- conflitos são resolvidos semanticamente;
- workers/frentes especializadas não integram cruzado por conveniência.

# PARTE XII — ÍNDICE OPERACIONAL

## 36. Documentos globais

- `docs/EMPROVEX_MEMORIAL_OFICIAL.md` — estado/contratos/governança;
- `docs/EMPROVEX_PROGRAM_CONTROL.md` — protocolo do Coordenador Geral;
- `docs/EMPROVEX_MEMORIAL_HISTORICO_ATE_2026-10-03.md` — histórico integral preservado.

## 37. SaaS R1

Documentos canônicos:

- `docs/SAAS_R1_PLANO_MESTRE.md`;
- `docs/SAAS_R1_EXECUCAO_PARALELA.md`;
- `docs/SAAS_R1_INTEGRATION_STATUS.md`;
- `docs/SAAS_R1_COORDENADOR_HANDOFF.md`;
- `docs/SAAS_R1_PRE_PILOTO_HARDENING.md`;
- `docs/SAAS_R1_HARDEN_A2_FIREBASE_FIRESTORE_GRPC.md`;
- documentação HARDEN-B/recovery.

Para contrato comercial/operacional vigente, este Memorial tem precedência sobre checkpoints históricos antigos.

## 38. Mobile R1

Documentos canônicos:

- `docs/CENTRAL_MOBILE_R1_PLANO_MESTRE.md`;
- `docs/CENTRAL_MOBILE_R1_EXECUCAO_PARALELA.md`;
- `docs/CENTRAL_MOBILE_R1_INTEGRATION_STATUS.md`;
- `docs/CENTRAL_MOBILE_R1_COORDENADOR_HANDOFF.md`;
- `docs/CENTRAL_MOBILE_R1_FINAL_CERTIFICATION.md` — MOBILE-J;
- `docs/CENTRAL_MOBILE_R1_MOBILE_J_PHYSICAL_TEST_RUNBOOK.md` — atualmente na branch `mobile-r1-j-final-certification`.

O runbook físico é procedural. Este Memorial registra os critérios canônicos; o runbook registra casos/evidências.

## 39. Central de Depósitos

- `docs/adm-deposito/README.md`;
- `docs/adm-deposito/STATUS.md`;
- `docs/adm-deposito/DECISIONS.md`;
- `docs/adm-deposito/ROADMAP.md`.
- `docs/WAREHOUSE_INTEGRITY_RECONCILE_01.md` — auditoria que identificou `POSITIVE_UNASSIGNED=5`.
- `docs/WAREHOUSE_DATA_REPAIR_EXECUTION_01.md` — reparo anterior dos lotes, sem baixa das cinco unidades.
- [PR #310](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/310) — executor de correção pontual e evidência pós-commit do Suco (2026-10-15).

## 40. Performance R3

- `docs/PERFORMANCE_R3_COMERCIALIZACAO.md`;
- `docs/PERFORMANCE_R3_EXECUCAO_PARALELA.md`;
- `docs/PERFORMANCE_R3_INTEGRATION_STATUS.md`;
- `docs/PERFORMANCE_R3_COORDENADOR_HANDOFF.md`.

## 41. Testes e CI

- `docs/TESTING_POLICY.md`;
- `docs/DEVELOPMENT_CI_WORKFLOW.md`.

---

# PARTE XIII — PROTOCOLO DE ATUALIZAÇÃO DO MEMORIAL

## 42. O que deve ser atualizado imediatamente

Atualizar o Memorial quando houver:

- mudança de `main`;
- nova integradora relevante;
- conclusão de wave;
- mudança de semáforo global;
- conflito transversal;
- decisão arquitetural;
- mudança de contrato comercial;
- mudança de política de segurança;
- freeze de RC;
- produção/release;
- novo blocker global.

## 43. O que não deve inflar novamente o Memorial

Detalhes como:

- todos os runs;
- logs de terminal;
- cada tentativa de CI;
- cada commit intermediário;
- cada comentário de PR;
- cada prompt de worker;

devem continuar preservados nos documentos especializados/Git, mas não duplicados integralmente no corpo principal.

## 44. Regra de preservação histórica

Nenhuma reorganização documental pode apagar evidência histórica.

Quando uma seção crescer a ponto de prejudicar leitura:

1. consolidar o estado vigente neste Memorial;
2. preservar a versão detalhada em documento histórico/especializado;
3. registrar link explícito;
4. manter Git como trilha definitiva.

O arquivo:

`docs/EMPROVEX_MEMORIAL_HISTORICO_ATE_2026-10-03.md`

é a primeira aplicação formal dessa regra e contém o Memorial legado integral.

---

# 45. Estado para retomada imediata

```text
PRODUÇÃO
main@e90f92acae1514ee5cbc6ce95fed354bc1454330
Performance R3
aplicação RC: NÃO PUBLICADA
Rules RC: NÃO PUBLICADAS

GOVERNANÇA
Program Control + Coordenação do RC: ATIVO
Coordenadores SaaS/Mobile: consulta/evidência sob demanda
Fundador: autoridade final de produção/GO

SAAS R1
funcional: ENCERRADO
integrador com SESSION-CAP: feat/saas-r1-commercializacao
commit de integração runtime SESSION-CAP/RULES-AUDIT: 54aba792cb9e7bb195e21401fb50a21ed50add19
HARDEN-A1: PASS
HARDEN-A2: PASS — risco residual aceito
HARDEN-B: PARCIAL / temporal
HARDEN-C: PASS
HARDEN-D: PASS
nova feature SaaS: NÃO AUTORIZADA

BILLING R1
Plano Completo: R$ 70/mês
trial: 30 dias
vencimento: 5º dia útil
tolerância: 10 dias
modo: observe
requirePayment: false
automaticSuspension: false
pagamento: externo via Link HTTPS/Pix
confirmação: manual/auditada
suspensão operacional: manual via lifecycle
delete por inadimplência: NÃO

IDENTIDADE / SESSÕES
founder: Google-only / capacidade isenta
externo: e-mail+senha / e-mail verificado
workspace↔UG↔conta primária: obrigatório
produção R3 atual: teto histórico de 2 sessões externas
candidato SaaS/RC: múltiplas sessões externas sem teto fixo, com controle individual
SESSION-CAP-01: PASS TÉCNICO COMPLETO / INTEGRADA
lease: 30 min
heartbeat: 15 min
TTL sessionSlots.expiresAt: ACTIVE
TTL sessionRevocations.expiresAt: ACTIVE
fail-closed: SIM

LEGAL
bundle: saas-r1-2026-10-01
terms: terms-2026-10-01-r1
privacy: privacy-2026-10-01-r1
aceite: versionado por UID/workspace
erro de verificação: fail-closed

MOBILE R1
integrador: feat/central-mobile-r1@7b7717b6eebabf911310d2b8ac56ed13c9cb9238
funcional A–I: ENCERRADO
MOBILE-J: CERTIFICAÇÃO FINAL EM EXECUÇÃO
HEAD J: 90d646372aae3e92318a78b90d71f72c5eb6b00e
blocker funcional: NENHUM
próximo trabalho: RC Preview HTTPS + runbook físico

RULES
PR #248: MERGED
squash SESSION-CAP/RULES-AUDIT: 54aba792cb9e7bb195e21401fb50a21ed50add19
RULES-AUDIT-01: PASS — RULES APTAS PARA RC
produção principal viva: 0d990b7de0b2e85ed55fe14ec0d2ce29b3635299
produção warehouse viva: b5325fe5a8cbe9b0ade8568d35a2cd678ce6e0f2
drift produtivo: NENHUM
principal RC: bc91185f34bcdcb4437a4de1078d1089a09292ba
warehouse RC: 6e1f1050005314db4e17cb3136409abbddb0ee91
ordem futura autorizável de rollout: Rules RC → aplicação RC
publicação produtiva RC: NÃO AUTORIZADA
rollback Rules: obrigatório e independente do Vercel

RECOVERY
PITR: ATIVO em ambos
delete protection: ATIVA
backup diário: ATIVO
retenção: 14 semanas
backup READY: PENDENTE
recovery:verify: PENDENTE
restore isolado real: PENDENTE / protegido

RELEASE
RC único SaaS+Mobile: PRONTO PARA COMPOSIÇÃO
RC Candidate: AINDA NÃO DECLARADO
RC Frozen: NÃO
CT-01: PENDENTE NO RC
Preview HTTPS: AINDA NÃO PUBLICADO
produção controlada: NÃO AUTORIZADA
piloto real: NÃO INICIADO
abertura comercial: NÃO AUTORIZADA

PRÓXIMA SEQUÊNCIA
criar/fixar branch única do RC
→ compor SaaS + Mobile semanticamente
→ aplicar CT-01
→ reconciliar Rules/package/lockfile/CI/contratos
→ executar gates no SHA exato
→ declarar RC CANDIDATE se PASS
→ RC FROZEN
→ Preview HTTPS
→ testes SaaS + MOBILE-J físicos
→ corrigir somente regressões/blockers reais
→ nova reconciliação/freeze se necessário
→ GO/NO-GO explícito para produção controlada
```

## Regra final de continuidade

Antes de qualquer decisão futura:

1. ler este bloco;
2. conferir HEADs vivos;
3. conferir se o evento é funcional, transversal ou produtivo;
4. nunca promover estado histórico a estado vigente;
5. nunca considerar uma pendência “resolvida” sem evidência;
6. nunca tratar PASS técnico como autorização de produção.

## COST-FIRESTORE-R1 — estimativa financeira global do Firestore em BRL (19/10/2026)

Solicitação do Fundador executada **somente na branch feat/admin-visual-organizacao-base-emprovex / PR #341 (DRAFT)**. Não houve merge, deploy, alteração de regras ativas, escrita de dados produtivos ou mudança na cobrança.

### O que foi entregue
- Aba **Consumo & Cotas → Estimativa de custos · R$** na Administração original, sem substituir as demais abas.
- Motor puro \`lib/firestoreCostEstimate.mjs\`, com contrato \`.d.mts\`, calcula separadamente **Read Units, Write Units, Realtime Read Units** a partir dos snapshots do Cloud Monitoring e do histórico diário existente; preço em USD por milhão e câmbio USD/BRL fornecidos pelo fundador.
- Cartões: **Hoje (parcial), últimos 7 dias, mês até agora, projeção do mês**. Períodos sem medição são explicitamente incompletos, não tratados como zero. Projeção requer pelo menos três dias passados observados, cobertura histórica de 80% e informação do dia atual; dia atual não é extrapolado como completo.
- Preços editáveis e referenciados à tabela pública **Enterprise, Iowa/us-central1, preços padrão em USD**, consulta em 19/10/2026: Read Units USD 0,05/milhão; Write Units USD 0,26/milhão; atualizações em tempo real USD 0,30/milhão. **Valores são referência, não regionais/contratuais confirmados**. Fonte: https://cloud.google.com/firestore/enterprise/pricing.
- Câmbio é **obrigatoriamente manual** para apresentar números em reais; sem câmbio confirmado a interface mostra “R$ —” e custo parcial em USD. Não há dependência de API de câmbio externa, cotação fictícia ou valor escondido.
- Franquia grátis **desligada por padrão**; usuário opta manualmente só após confirmar elegibilidade do banco. Quando ligada, descontos por limite diário específico de RU, WU e realtime, **não por mês**. Para dia sem limite confiável, custo fica indisponível.
- Somente reutiliza \`loadGlobalUsageHistory\` via consulta limitada aos registros diários entre o início do mês e os últimos sete dias. A aba executa a consulta **apenas ao entrar** e ao clicar em Atualizar; **não** cria listeners, polling, gravações, endpoints nem leitura por UG. O snapshot ao vivo reutiliza as props do painel. Campo opcional \`metricsComplete\` marca o histórico legado sem unidade faturável completa como não calculável.
- **Não é fatura Google Cloud.** Exclusões gerenciadas, eventos, storage, PITR, backup, restauração, rede, impostos, descontos, créditos e serviços externos não entram no valor. Cobrança oficial: https://console.cloud.google.com/billing. Não atribuir valor financeiro a UGs (somente métricas/proxy R3).
- Testes de unidade: \`scripts/firestore-cost-estimate.test.mjs\` integrado ao Application CI para cobrar cálculo por dia, lacunas, tarifas, franquia e condição de projeção.

### Gates, segurança e estado
Application CI, TypeScript/build, Core Protection, Firestore Rules/Emulator e aceite humano precisam ser verificados sobre o **HEAD final**. O código de custo **não depende da migração de Firestore Rules**. Não anunciar PASS de checks até constarem concluídos na GitHub Actions. Não publicar sem comando separado do Fundador. Para QA local: \`http://localhost:3001/admin?tab=consumo\`; usar conta fundadora e modo somente leitura.

### Handoff
**Onde estamos:** PR #341 aberto em DRAFT, módulo de custo R1 implementado no código, sem produção. **O que fazemos:** certificação de testes e conferência visual/financeira. **Quem faz:** executor GitHub/CI. **Próximos passos:** confirmar região, edição, elegibilidade do free tier, taxa cambial aplicada e SKUs efetivos em Cloud Billing; se necessário evoluir integração server-side somente sob autorização adicional. **Quem fará:** Fundador valida parâmetros e aparência; executor corrige problemas apontados e mantém memorial.


## ADMIN-WORLD-HOME-R1 — Bairro digital 3D (19/10/2026)

**Solicitação expressa do Fundador:** criar nova aba **Início** na Administração original, com um bairro digital em perspectiva isométrica 3D: cada conta = uma casa; janelas quentes iluminadas para sessões válidas; ruas, lotes, árvores, jardins, postes de iluminação, telhados e caixas de correio; grande caixa d'água transparente ao fundo representando a ocupação da referência diária de consumo Firestore.

**Implementado exclusivamente no PR #341 (branch \`feat/admin-visual-organizacao-base-emprovex\`; DRAFT; sem merge e sem deploy):**
- \`components/admin/AdminWorldHomePanel.tsx\` e \`.module.css\`: HUD noturno com indicadores, cena responsiva, controles de rotação limitada, zoom, seleção de conta e navegação por quarteirões de 9 residências. Em telas pequenas a maquete admite rolagem horizontal em vez de distorcer ou suprimir casas.
- \`components/admin/AdminWorldScene.tsx\`: composição programática de geometria com coordenadas x/z/altura projetadas em SVG isométrico; casas 3D estilizadas com variação discreta de paleta e iluminação, ruas/faixas, vegetação, postes, caixas de correio, caminhos, reservatório translúcido com nível proporcional. Não usa dependência adicional de Three/WebGL e não carrega assets remotos.
- \`lib/adminNeighborhoodModel.mjs\` + \`.d.mts\`: mapeamento determinístico de uma casa por **conta real única** de \`adminDirectory.directory.accounts\`, incluindo administrador e usuários de setor, sem criar usuários demonstrativos. Para registrar **presença**, cruza sessões existentes por UID vinculado (email apenas como alternativa quando UID da conta não está disponível), exige \`expiresAt > now\`, deduplica múltiplas sessões e deixa contas suspensas sem luz. Falha/ausência dos dados de sessões = \`unknown\`, **não falso offline**. A luz significa **sessão válida**, e não atividade humana em tempo real.
- Caixa d'água: \`billableReadUnits / billingReference.readUnitsDailyLimit\` no snapshot global já carregado; indicador textual preserva valor >100% e altura da água fica limitada ao reservatório. Sem métrica válida, aparece “Sem dados”. Trata-se de referência diária, não limite de interrupção, custo por UG ou fatura.
- Integração: \`app/admin/page.tsx\` transmite \`adminDirectory.directory.accounts\` como prop à \`PlatformAdminView\`; \`PlatformAdminView\` insere \`inicio\` como aba inicial. As oito abas originais (inclusive \`overview\`/Visão Geral) permanecem acessíveis e os handlers operacionais não foram alterados. \`/admin\` abre a nova Início; \`/admin?tab=overview\` mantém a Visão Geral.
- Eficiência: **nenhuma consulta/leitura nova, nenhuma gravação, nenhum listener adicional, nenhum polling de Firestore, nenhuma nova Rules ou endpoint**. Clock local de 60 s apenas revalida a expiração de leases visualmente; renderiza no máximo nove casas por quarteirão.
- Acessibilidade: seleção por teclado, legenda textual, status desconhecido distinto de offline, CSS prefers-reduced-motion e texto acessível para dados do reservatório.
- Testes: \`scripts/admin-world-neighborhood.test.mjs\` (uniqueness, identidade, expiração, fail-closed, paginação, referência sem dados, proibição de consultas), \`scripts/admin-visual-only.test.mjs\` atualizado para preservar as oito abas. Comando \`npm run test:admin-world-neighborhood\` registrado no Application CI.

**Gates:** verificar conclusão **do último HEAD de código**, TypeScript, testes de unidade, build, Core Protection, Recovery, Legal e Application CI. Nunca afirmar PASS de CI ainda em progresso. Não houve QA visual humano, nem merge/deploy/publicação. A validação local não pode acionar botões mutacionais. Sem ajuste de Firestore Rules ativas.

**Como inspecionar sem deploy:** no PowerShell Windows, no checkout da branch do PR #341, \`git pull --ff-only\`, \`npm.cmd ci\` (quando preciso), \`npm.cmd run dev -- --port 3001\` e abrir \`http://localhost:3001/admin\` com a conta fundadora. Para o painel prévio, \`http://localhost:3001/admin?tab=overview\`. Se \`localhost:3001\` já estiver executando uma versão antiga, reiniciar o servidor no checkout atualizado.

**Handoff:** onde estamos — 3D bairro integrado no PR #341 DRAFT; o que fazemos — certificar o HEAD e validar estética no navegador; quem faz — executor GitHub (código e CI), Fundador (aceite visual); a seguir — inspeção visual local, refinamento de detalhes de maquete e confirmação de leitura de sessões/cota; quem fará — Fundador no navegador e executor nas correções, SEM alterar produção.


## ADMIN-WORLD-R1.1 — Nova maquete isométrica fiel à referência (19/10/2026)

**Solicitação:** substituir a aparência esparsa do bairro anterior pela composição da referência visual enviada pelo Fundador: malha de ruas convergente, grande edifício central, vários prédios de fachada branca/vidro azul, coberturas verdes, jardins e árvores densas, passagem de pedestres, postes e caixa-d'água translúcida à esquerda com leitura do consumo Firestore. Tema escuro EMPROVEX permanece no restante da UI.

**Executado apenas na branch do PR #341, sem merge ou deploy:**
- Novo \`components/admin/AdminWorldArchitecture.tsx\` contém geometria projetada 3D de edifícios, fachadas com janelas por pavimento, telhados verdes, hall simbólico da plataforma, árvores detalhadas, luminárias, caixas de correio e reservatório cilíndrico com água interna recortada por clipPath. Sem novas dependências, imagens externas nem WebGL.
- \`AdminWorldScene.tsx\` redesenhado: maquete simétrica de 15 lotes cenográficos, 4 braços viários principais até a praça central, vias secundárias, faixas, calçadas, jardineiras e pedestal com espessura. O edifício central é **marco simbólico EMPROVEX**, não representa conta adicional nem sessão falsa.
- Atribuição a usuários: apenas **até nove prédios identificados** por quarteirão representam contas reais. O restante é cenário urbano **não clicável** e não entra nas contagens; não há nomes/usuários fictícios. Fachadas dos usuários só recebem janelas amarelas iluminadas quando a sessão existente foi validada. Sem sessão ou sem telemetria de presença, respeitar os estados originais.
- Caixa d'água recebe as props existentes \`waterKnown/waterLevel/waterExceeded\`: líquido visível proporcional à referência diária de billableReadUnits, status sem medição e indicação de extrapolação sem cortar a porcentagem textual.
- Textos da nova Início explicam explicitamente a diferença entre prédio identificado e construção de cenário; mantêm legenda, painel de conta, navegação por quarteirões, zoom, rotação suave e acessibilidade por teclado.
- Testes do bairro atualizados para separar a geometria \`AdminWorldArchitecture.tsx\` da cena e garantir continuação da ausência de consultas/alterações Firestore. O CI e guardrails devem ser certificados sobre o último HEAD.
- Edição estética foi feita exclusivamente na nova Início (sem alterar as oito abas originais, stores, Rules, billing, workspaces ou produção).

**Aceite pendente:** abrir \`http://localhost:3001/admin\` com a conta fundadora depois de atualizar o checkout do PR #341; validar estética/densidade, leitura das janelas por conta, proporção do reservatório, zoom e navegação. Não anunciar inspeção de navegador realizada sem evidência do Fundador. Evitar merge/deploy até solicitação expressa.

**Handoff:** onde estamos — R1.1 implementada no PR #341 DRAFT; o que fazemos — certificação de CI e validação estética humana; quem faz — executor GitHub (código, checks, memorial), Fundador (navegador); a seguir — revisar screenshot real da nova Início e ajustar a geometria conforme feedback; responsável — executor somente após aceite/correções solicitadas.


## ADMIN-WORLD-R1.2 — Lotes vazios, conta fundadora central e legendas nos telhados (19/10/2026)

**Pedido do Fundador:** manter os lotes urbanos visualmente vazios enquanto não houver conta associada; reservar o prédio central exclusivamente à conta fundadora APROV HGeSM; mover as etiquetas das contas para **acima dos edifícios**.

**Alterações implementadas no PR #341, branch \`feat/admin-visual-organizacao-base-emprovex\`, ainda em DRAFT:**
- Identidade fundadora comprovada no contrato existente: \`HGESM_SECTOR_EMAIL = aprov1hgesm@gmail.com\`, workspace \`hgesm-aprov\`. O cadastro fundador usa \`accountType='sector'\` com privilégio administrativo resolvido em seu contexto, **não cria segunda conta de administrador**. \`partitionNeighborhoodResidents\` usa esse e-mail normalizado, retira a conta dos lotes laterais e a associa exclusivamente à construção central.
- \`components/admin/AdminWorldHomePanel.tsx\`: a contagem mantém todas as contas reais (incluindo fundadora), mas a paginação de nove casas é restrita às demais contas. O edifício central é selecionável como os demais e usa presença baseada exclusivamente na sessão de identidade real. Se a conta ainda não estiver carregada, o prédio central mantém identificação de lugar reservado, sem acender nem criar sessão fictícia.
- \`AdminWorldScene.tsx\`: edifícios laterais só são instanciados **quando existe usuário real correspondente**. Lotes sem usuário mostram somente piso e marca de parcela disponível, sem prédio nem caixa de correio. Os slots se preenchem automaticamente quando o diretório existente enviar novas contas, respeitando os quarteirões. Nenhuma conta é representada duas vezes.
- \`AdminWorldArchitecture.tsx\`: \`CityBuildingLabel\` renderiza as legendas **no último passe SVG, sobre os telhados**, evitando sua ocultação por fachadas, jardins e construções. Prédio fundador rotulado **APROV HGeSM** acima do edifício. Indicadores de status respeitam online, offline, suspenso e desconhecido. A porta/identidade do edifício central continua refletindo a conta fundadora, não apenas um marco cenográfico.
- UI atualizada para falar em prédios ocupados, prédio selecionado e lotes vazios. Os oito módulos históricos continuam preservados.
- \`scripts/admin-world-neighborhood.test.mjs\`: acrescentados testes de identidade fundadora, não duplicação, paginação lateral e guards estáticos contra prédios cenográficos, com verificação de etiquetas e slots.
- **Sem Firestore reads/writes adicionais, sem novos listeners, sem deploy, sem merge e sem modificação em produção.** Tests/CI/Legal/Recovery/Core devem ser certificados **no HEAD final**, e a aparência permanece sujeita a aceite humano.

**Handoff:** Onde estamos — R1.2 com slots vazios, torre fundadora e legendas acima das construções no PR #341 DRAFT. O que estamos fazendo — certificação de CI e atualização da prévia local. Quem faz — executor no GitHub; Fundador na inspeção visual. Próximo passo — usar \`git pull --ff-only\` na branch do PR #341, reiniciar \`npm.cmd run dev -- --port 3001\` e abrir \`http://localhost:3001/admin\`. Quem fará — Fundador valida; executor corrige refinamentos apontados.


## ADM DEPÓSITO — COLD-3D-R1 · Geladeira e freezer em 3D premium (19/10/2026)

PR #342 em DRAFT · \`feat/warehouse-cold-appliances-3d-premium\` · base \`main@30f292c8\`. Alterações exclusivas na prévia isométrica de depósitos:
- Geladeira industrial com portas duplas inox escovado, profundidade real, juntas térmicas, puxadores, painel técnico, acabamento lateral e painel traseiro do compressor.
- Frente física da geladeira definida sempre pelo **lado maior horizontal** do equipamento e preservada sob as quatro câmeras: Frente, Direita, Trás e Esquerda. Detalhes frontais só na face fisicamente correta; nas vistas traseira/laterais existem acabamentos próprios.
- Freezer baú com tampas superiores duplas translúcidas, moldura isolante, puxador real, dobradiças e ventilação; geometria criada em coordenadas físicas antes da projeção, sem desenhar acessórios no ar.
- Novo \`lib/warehouse/applianceOrientation.ts\`, novo \`features/warehouse/components/WarehouseColdAppliance3D.tsx\`, integração em \`WarehouseIsometricPreview.tsx\`. Testes físicos e guards adicionais em \`scripts/warehouse-isometric-camera.test.mjs\`.
- Não altera layout persistido, schema, dados, Firestore, Rules, autorização, movimentações, saldo ou interfaces operacionais. Nenhuma dependência 3D nem leitura extra. Sem merge ou deploy.
- Documento detalhado: \`docs/adm-deposito/COLD_3D_R1_20261019.md\`. CI e validação gráfica pendentes de conclusão e aceite humano no navegador.

Handoff: onde estamos — PR #342 DRAFT; o que fazemos — aguardar CI e validar estética multi-perspectiva; quem faz — executor de GitHub e Fundador; o que fazer a seguir — abrir a prévia 3D na branch e comparar as quatro vistas; quem o fará — Fundador confirma e executor aplica ajustes.


## NAV-R1 — Barra lateral organizada e Central de Depósitos para setores externos (19/10/2026)

**Situação:** branch \`feat/sidebar-navigation-external-warehouse-r1\`, derivada do PR #342 com geladeira/freezer 3D previamente aprovados. Trabalho isolado de produção, sem merge.

- Barra lateral do EMPROVEX organizada por fluxo de trabalho: Visão geral (Início/Painel), Gestão de empenhos (Empenhos/Notas Fiscais/Consulta de Itens/Fornecedores), Acompanhamento (Cronogramas/Relatórios/Central de Avisos) e módulo destacado Gestão de depósitos.
- Atalho \`Central de Depósitos\` voltou a ser exibido para **setores externos operacionais autorizados**. Corrigido o bloqueio de interface por workspace \`HGESM_WORKSPACE_ID\` em \`app/page.tsx\`, mantendo \`canAccessWarehouseModule(workspaceContext)\`.
- **Segurança inalterada:** o gate \`WarehouseAccessBoundary\` e \`/api/central-depositos/status\` validam token, setor, workspace, UG, permissões e, para externos, vínculo de conta ativa; a correção não libera setor não autorizado.
- Mantidos botões, rotas, animação, acessibilidade, contador de avisos, responsividade e sem novas leituras Firestore; reforço de testes em \`scripts/visual-r1-w4-sidebar-border-beam.test.mjs\`.
- Memorial técnico e critérios de aceite: \`docs/NAV_R1_SIDEBAR_EXTERNAL_WAREHOUSE_20261019.md\`. CI/smoke humano necessários antes de publicar.

**Handoff:** onde — branch NAV-R1, baseada em 3D R1; fazendo — validar sidebar e botão externo; responsáveis — executor de código/CI, Fundador no navegador; próximo passo — checkout em \`localhost:3001\` e aceite dos dois perfis; executor/coordenação não deve publicar sem confirmação.

## WAREHOUSE-STOCK-3D-R1 — Ocupação física e validade de 14 dias (19/10/2026)

**Estado:** PR #344 DRAFT, branch `feat/warehouse-3d-occupancy-stacking-expiry-14d`; ainda sem merge e sem deploy de produção.

- Auditoria: as geladeiras/freezers tinham apenas `occupied` sem brilho dependente de conteúdo; caixas em paletes/mesas/estantes eram posicionadas de modo figurativo e a validade dos lotes não afetava o 3D.
- Implementados reflexos brancos discretos em geladeiras/freezers com saldo real, caixas projetadas em superfícies físicas e empilhadas em níveis, inclusive por subposição de estante, e indicação por caixa da validade (amarela quando vence em 14 dias inclusive; vermelha quando já venceu).
- Estados dependem de **lote ativo com quantidade positiva e saldo físico positivo na mesma posição e material**, respeitando depósito, local e subposição. Sem estoque ou sem lote identificado, não há alerta inventado.
- Aplicado nas **duas telas de visão 3D**: prévia do editor de croquis e vista operacional `Meus Depósitos`, em todas as quatro perspectivas.
- Economia de Firestore: nova leitura de lotes por intervalo indexado no `expiresOn` limitada a 500 e somente ao abrir a visão; sem listeners, sem novas escrituras. Consultas detalhadas/FEFO de material seguem intactas.
- Nenhuma alteração no schema de dados, Firestore Rules ou cadastros. A regra geral de 30 dias continua no domínio; o corte de 14 dias é **apenas visual**.
- Regressões e CI: `scripts/warehouse-3d-stock-visual.test.mjs` integrada ao Application CI. Documento técnico: `docs/adm-deposito/STOCK_3D_VISUAL_R1_20261019.md`.

**Handoff:** onde — PR #344 isolado; fazendo — validação CI e visual; responsáveis — executor de código e Fundador; próximo passo — smoke em localhost:3001 nas 4 câmeras, validar dia+14/+15 e posição; quem fará — Fundador aprova, executor ajusta; não há publicação automática.

## EMPROVEX R4 — Reconciliação Warehouse R2/R3 com 3D premium (19/10/2026)

**Registro histórico da fase DRAFT (hoje PR #345 MERGED e R4 publicada):** branch `feat/warehouse-r3-restoration-consolidated`, base `main@2c30a354`. Esta onda foi solicitada para **recuperar e publicar, numa única release**, o que foi aprovado na linha R2/R3 mas não foi integrado à `main`, além das melhorias 3D do PR #344.

- Causa: a R3 antiga foi publicada diretamente via CLI Vercel de uma branch `07cab044`/hotfix `eb1935a`, sem merge. A publicação posterior da `main` substituiu esses recursos. Código original preservado nos PRs #331–#338 e suas branches, recuperado seletivamente.
- Recuperado: inspeção por hover/teclado/clique, local sem saldo, painel ancorado abaixo da cena, modal e PDF por local, pesquisa global entre depósitos, botão para local/subposição em depósito existente, formulário de cadastro dimensional e guardas de inativação.
- Preservado: geladeira/freezer premium atual e sua frente física; caixa sobre palete/mesa/prateleira com empilhamento; branco quando frigorífico ocupado; caixa amarela entre 0–14 dias e vermelha se vencida, halo amarelo suave no local. Acesso externo autorizado e menu da `main` inalterados.
- Firestore: Regras/coleções/autenticação/dados intactos; leitura por índice de `expiresOn` para alertas, lote integral apenas ao inspecionar, sem listener por hover ou query por tecla. Limite de 500 exibe aviso de incompletude. Política FEFO geral preservada.
- NF: entrada de alocação detalhada restaurada como escolha dentro do painel de ações de NF, preservando as ações em lote atuais. Não trocar o sistema de empenhos atual por snapshot antigo.
- Testes históricos de busca, inspeção/PDF, cadastro e segurança reintegrados ao Application CI. Documento detalhado: `docs/releases/EMPROVEX_WAREHOUSE_R4_RECONCILIACAO_20261019.md`.
- **Release gate:** não mergear/publicar até Application CI, Core Protection, Recovery, Legal, QA Visual e smoke humano. Vercel administrativa requer execução PowerShell autenticada do Fundador; usar `git archive` sem .git, deploy --prod --skip-domain, saúde, promote, inspect. Evitar duas publicações.

**Handoff:** onde — PR #345; fazendo — certificação da união R2/R3 + premium; responsáveis — executor GitHub e Fundador; próximo — CI + smoke, squash único na `main` e publicação; quem fará — executor integra, Fundador promove pelo CLI da Vercel.


## WAREHOUSE-READ-R1 — Migração da consulta de Alocação de Material (21/10/2026)

**Estado ATUAL: PR #350 MERGED — CI 6/6 PASS; Warehouse Read R1 PUBLICADO em produção; usuário confirmou melhoria de velocidade.** Base `main@76d78f90`, deployment de produção `dpl_A1WA8xC478i5UNdAuRqaSumr1nFN`; GitHub branch `feat/warehouse-read-r1-server-queue`. Nenhuma alteração aplicada às Firestore Rules, banco produtivo ou deploy da Vercel.

**Causa técnica confirmada:** acompanhamento de NFs reutiliza dados da sessão e histórico sob demanda; alocação usa o caminho `loadWarehouseInvoiceIntakeQueue`, que sincroniza índice e cruza `invoices`, `intakes`, `queueExclusions`, `movements` e `empenhos` via SDK cliente, com consultas sequenciais. Um acesso visual pode escrever estado derivado do índice, mas nunca deve alterar saldo.

**Mudança no candidato R1:**
- `GET /api/central-depositos/queue`: uma chamada autenticada, usando `verifyWarehouseRequest`, com `workspaceId` e UG determinados no servidor, nunca escolhidos pelo navegador.
- `warehouseQueueReadStore.ts`: leituras server-only Firestore REST de bancos principal e `emprovex-warehouse`, com coleções permitidas, escopo exato, decodificação, lotes e teto de paginação; nunca expõe endpoint arbitrário.
- `warehouseQueueReadServer.ts`: sincroniza índice PERF-D com bootstrap inicial quando necessário, preserva o `intake` ausente como PENDING; busca apenas candidatos, NFs, empenhos, estados e movimentos relacionados; mantém reconciliação com projeções legadas e desativa candidatos tratados.
- `queueReadClient.ts`: transporte autenticado; `WarehouseItemRegistrationOperational` usa a API para fila operacional, preservando o histórico e a consulta pontual de intakes sob demanda no caminho anterior.
- Telemetria mínima por abertura registra duração, NFs descobertas, intakes, índice e linhas retornadas, sem dados fiscais nem tokens.
- Teste de contrato no Firestore Emulator com bootstrap, replay, alocação parcial, divergência canônica e isolamento entre workspaces, incluído no workflow Warehouse Server R2 Smoke.

**Certificação do código:** PR #350 squash-merged em `main@7e4697e483e73fb7910e61f9d71519fc8d2ddad1`, com Application CI, Fast CI, Core Protection, Warehouse Server R2 Smoke, Browser E2E e Visual QA PASS. O Emulator do Read R1 confirmou bootstrap/replay, quantidade parcial, divergência canônica e isolamento. Cenário de 1 NF: bootstrap 275 ms e repetição 103 ms, sem nova escrita de índice; esses números NÃO são benchmark de produção nem comparação com a versão anterior. Não presumir economia de Firestore. Histórico/reconciliação continuam no SDK cliente sob demanda; em caso de cobertura incompleta o servidor falha explicitamente. Após a publicação, o fundador confirmou que o carregamento da alocação ficou bem mais rápido; não há percentual auditado de redução.

**Governança GOV-SIMP-01:** PR separado, sem deploy automático, sem atualização de Rules produtivas. Somente integrar à `main` após CI e teste de equivalência. Após merge, publicação única com PowerShell proprietário, pré-validação e smoke humano; a publicação não faz parte desta missão.

**Handoff final:** onde — `main@7e4697e4` com READ-R1 certificado em CI, deploy oficial anterior R2 mantido; fazendo — aguardando apenas deploy de validação e smoke humano; quem fez — executor GitHub, PR #350; a seguir — publicação manual única pela sessão proprietária, conferir a fila e suas NFs antes do `promote`; quem fará — Fundador pelo PowerShell. Firestore Rules produtivas inalteradas.

### Fechamento de publicação — Warehouse Read R1 (21/10/2026)

- Código: PR #350 merged (7e4697e4); release fonte e693abe23b69597f4c2878f856f19008c3dd272f.
- Vercel: https://emprovex.com.br validado via inspect apontando para dpl_J5aHD6V1kCHDvmCGSJHDQYzftPD3; status Ready; /api/health retornou status ok. Repetir promote resultou 409 porque já era o deployment atual.
- Smoke humano relatado: a aba Alocação de Material ficou bem mais rápida. PASS qualitativo de velocidade percebida; não houve medição comparativa nem confirmação explícita dos detalhes de todas as NFs e quantidades. Não inferir ganho percentual ou redução de custo Firestore.
- Rules produtivas não foram alteradas pela publicação; não houve confirmação de teste real de operações de estoque após a publicação.
- Handoff: onde — Read R1 publicado no domínio oficial; fazendo — operação normal/observação de eventuais erros; quem fez — executor GitHub e Fundador pelo PowerShell/navegador; próxima ação — nenhuma publicação adicional necessária, medir objetivamente apenas quando houver demanda; responsável — equipe de desenvolvimento conforme necessário.


## WAREHOUSE BULK STOCK R1 — Carga inicial de depósito por planilha (21/10/2026)

**Estado final: PR #351 MERGED, CI 6/6 PASS e publicação Vercel confirmada em `emprovex.com.br` (21/10/2026).** Desenvolvimento originado da necessidade de lançar contagens físicas extensas por planilha em Entrada Avulsa, sem cadastro manual de cada item. Uma planilha de referência ODS com 121 linhas guiou as colunas e cenários, mas seus dados reais NÃO foram enviados ao repositório nem importados ao Firestore.

- Novo painel em `features/warehouse/components/WarehouseBulkManualEntryOperational.tsx`, integrado à Entrada Avulsa. Gera modelo Excel, seleciona depósito, faz upload autenticado e prévia sem gravação, apresenta locais não correspondentes, reconhece material existente pela descrição/unidade e agrupa materiais novos repetidos.
- Endpoint `GET/POST /api/central-depositos/bulk-stock`: gera `.xlsx` e analisa até 1500 linhas / 5 MB com parser ZIP/OpenXML limitado, bloqueio de fórmulas e limites anti-zip-bomb. Nenhum dado sensível do workspace integra o modelo; POST não grava estoque.
- Após conferência e anuência explícita, grava cada linha pela transação já existente `registerWarehouseManualEntryServer`, que deriva escopo da identidade e valida saldo, posição, lote, barcode e movimento. Não cria motor de estoque paralelo. Cada linha utiliza `operationId` estável ligado ao hash do arquivo + número da linha; progresso e ID de material novo ficam em checkpoint local para retomada no mesmo navegador/arquivo.
- Nova opção `lotCode` no contrato de entrada avulsa, persistida atomicamente como código do lote físico; compatibilidade retroativa quando ausente. O cadastro da estrutura física (depósito/local/subposição) deve preceder a importação; erros de localização bloqueiam a confirmação.
- **Proteção operacional:** IMPORTAÇÃO É ADITIVA (aumenta saldo); não executa ajuste de inventário, não sobrescreve estoque existente nem corrige o SISCOFIS. Importações parciais já confirmadas mantêm seus movimentos; operador deve retomar com o MESMO arquivo e confirmar situação antes de nova tentativa.
- **Limites explícitos:** até 1500 linhas por arquivo e 5 MB; leitura dos primeiros 500 materiais canônicos. Quando atinge o teto, bloqueia para não duplicar material pela falta de cobertura. Suporta upload `.xlsx`; a fonte `.ods` precisa ser convertida antes. Correspondência por nomes/códigos de locais não é automática se houver ambiguidade.
- **Certificação e governança:** PR #351 integrado por squash na `main` (`38a8f86fc2c07604d6a36bdb36cc98792994546a`); 6/6 workflows PASS: Application CI, Browser E2E, Fast CI, Core Protection, Visual QA, Warehouse Server R2 Smoke (incluindo XLSX/Emulator). A publicação manual ocorreu via PowerShell proprietário na equipe `aprov-hgesms-projects`; nenhuma Firestore Rule foi alterada.

**Handoff de publicação:** onde estamos — `emprovex.com.br` apontando para `dpl_AuJ4yHDLrjk8wDuihCZMgcp7j6r5` (status Ready, `/api/health` status ok); o que foi feito — modelo XLSX, prévia, motor de importação aditivo, CI 6/6, merge e deploy Vercel únicos; quem fez — executor GitHub e Fundador via PowerShell; o que fazer a seguir — smoke humano de baixar, subir e conferir prévia sem gravar saldos, mais primeira carga real apenas após conferência/autorizações cabíveis; quem fará — Fundador e operadores autorizados. **A validação de saúde não comprova, sozinha, a operação de upload ou a equivalência de todos os saldos em produção.**


## HOTFIX BULK STOCK XLSX R1 — Correção de células vazias (21/10/2026)

**Status: Publicado em produção no domínio oficial.** PR #352 squash-merged em `main@5c129bbb8416e85075162bfb62c0b940bf6fdc48`; Vercel deployment `dpl_8Xx2xrnss1Se6pDobYWr2GhJha3i` (`controles-de-empenhos-aprov-qiclgd4wp-aprov-hgesms-projects.vercel.app`), confirmado `Ready` em `emprovex.com.br` pelo PowerShell do Fundador; `/api/health` retornou status `ok` (2026-10-21T19:32:53.188Z).

- **Defeito real:** ao enviar planilha Excel com código de barras vazio na coluna E e Tipo de local na coluna F, o parser regex consumia incorretamente a célula seguinte após célula autoconclusiva `<c .../>`, retornando `STOCK_IMPORT_INVALID_ROW_2`, apesar de a linha estar preenchida.
- **Correção mínima:** `lib/server/warehouseBulkStockWorkbook.ts` distingue célula XML autoconclusiva, preservando colunas seguintes; teste de regressão no `scripts/warehouse-bulk-stock-r1.test.ts` confere E2 vazia, F2 Estante, G2 9, H2 1. Não alterou motor financeiro/estoque, movimentos, índices, Firestore Rules ou autenticação.
- **Evidências GitHub:** Application CI, Browser E2E, Core Protection, Fast CI e Warehouse Server R2 Smoke = **5/5 PASS**. `WAREHOUSE BULK STOCK XLSX R1 PASS` no Emulator.
- **Dados reais:** a planilha de 121 linhas foi examinada fora do repositório; não foi importada ao Firestore. A correção de parsing não garante que todas as posições estejam cadastradas corretamente, nem que não haja divergências no estoque.
- **Handoff:** onde — produção oficial no hotfix; o que falta — fundador reenviar a mesma planilha e conferir prévia, linhas e correspondência de depósitos/posições, sem confirmar gravação até validar; quem — fundador. Gravação inicial deve ser deliberada, auditada e respeitar que a carga é **aditiva**; não ajusta SISCOFIS.


## WAREHOUSE BULK STOCK — Correspondência com locais existentes (21/10/2026)

**Código integrado e CI 6/6 PASS; Vercel de produção publicada e verificada.** PR #353 (squash-merged na main, commit de código `b5de4c4b5f5bea5c3b2c2166d4b51ae861c1cf6b`). A análise da planilha de contagem e do screenshot do Controle de Depósitos revelou que o depósito DEP-001 já possui 20 locais e as subposições necessárias, mas o importador não reconhecia a diferença de formato entre `Estante 9 / 1` e `Estante 09 / Prateleira 01` (código `EST-09 / PRT-01`).

- Implementado `lib/warehouse/bulkStockLocationMatcher.ts` para correspondência **estrita** por tipo e número (sem zero à esquerda), depotId, parentLocationId e status ativo; tipos Estante/Freezer/Geladeira/Palete/Prateleira com equivalentes EST/FRZ/GEL/PAL/PRT/PRAT. Sem fuzzy matching, sem criar ou reativar estrutura e sem gravar saldo.
- Preservada a correspondência literal de nomes/códigos personalizados já suportados anteriormente (exemplo Armário 12 / A1), evitando regressão em outros depósitos. Correspondências duplicadas continuam ambíguas e bloqueadas.
- A prévia `WarehouseBulkManualEntryOperational` passa a mostrar a localização **efetivamente cadastrada** ao lado da referência informada na planilha. Teste de regressão novo confirma 20 locais representativos, EST-09/PRT-01, subposição pai, escopo de depósito, inativos, ambiguidades e códigos livres; Warehouse Smoke / Fast CI / Core Protection / Browser E2E / QA Visual / Application CI: **6/6 PASS**.
- Distribuição do arquivo examinado: 121 linhas (100 estantes 1–10, 18 paletes 1–7, 3 freezers 1–2). A correspondência efetiva depende do catálogo carregado e da validação humana em produção; não afirmar importação/saldo concluído.
- **Deploy concluído em 21/10/2026:** fundador executou `git pull --ff-only` para `main@005c3520686ad5343575ab9885751e6acfe64c8c`, seguido de `vercel.cmd deploy --prod --archive=tgz --scope aprov-hgesms-projects`. Vercel confirmou deployment `dpl_FVY5SXGvnbyYGEXtQms6mmaPURLw` (`controles-de-empenhos-aprov-djq8jbniw-aprov-hgesms-projects.vercel.app`), status Ready e alias `https://emprovex.com.br`; `/api/health` retornou `status=ok` em 2026-10-21T19:59:59.551Z. Não ocorreu atualização de Firestore Rules ou alteração direta do estoque.
- **Handoff:** onde — hotfix PR #353 efetivamente publicado no domínio oficial; fazendo — validação humana da prévia; quem fez — executor GitHub (código) e Fundador (PowerShell); próximo — recarregar a página, reenviar a mesma planilha de 121 linhas e conferir que os destinos correspondem aos locais cadastrados antes de clicar em Confirmar carga; quem fará — Fundador. O health PASS não confirma, por si só, que todas as posições reais estejam corretamente resolvidas. A importação é aditiva e não altera SISCOFIS.


## R356–R359 — Consulta de locais, foco 3D e leitura móvel de códigos de barras (21/10/2026)

- **R356:** PR #356 integrado por squash em `main@2234b41ba9431922e641929bcadf901b30c42af6`, promovido manualmente na Vercel (`dpl_CP6umLRd5iPfoFxHfK1KmhSfpwdP`); a janela de inspeção de locais passa a apresentar descrição, saldo físico, validades e código de barras, edição controlada de cadastro/validade e PDF organizado. Quantidade não é editável; alterações de descrição, código e lote usam comandos de servidor existentes.
- **R357:** PR #357 integrado em `main@1ca65e96c300df44e2ad875c96c86403b5fd5b46`, promoção manual do deployment `dpl_EEVA8rBpZ3MnhQHcpubTtNM2CdrV` confirmada por `vercel inspect https://emprovex.com.br` e health ok. Retirou consultas de lotes em hover: diálogo aparece primeiro, dados são buscados ao abrir, com redução de reads.
- **R358:** PR #358 integrado em `main@97eb9908d7dd0e1fcd8908c111d8067ad5d55a93`. Correção direcionada do retângulo preto de foco nativo no SVG 3D por mouse-down, preservando Tab/Enter/Espaço e focus-visible. Staged `dpl_ENTzZUzRcboGH4ca5aShAQtkL8uZ` confirmado Ready pelo fundador; **não afirmar promoção ao domínio sem o inspect correspondente**.
- **R359 — desenvolvimento mobile em branch `feat/warehouse-mobile-barcode-locations-r359`, PR #359 DRAFT.** `Meus Depósitos` ganha abaixo de 1024 px lista de locais com busca por código, nome e descrição do material, acesso direto ao diálogo do local e ação **Ler código** por material; visão 3D desktop permanece intacta. Editor reutiliza `WarehouseMobileScanner` + decoder ZXing existente, com câmera traseira ativada somente sob ação do usuário, entrada manual e encerramento após uma captura. Código lido apenas preenche o formulário: **nenhuma gravação automática**. O operador confere a identidade do item/local e toca **Salvar alterações**. Rejeitar códigos de localização válidos, preservar barcodes de apresentações convertidas, editar apenas o código da unidade-base por `BARCODE_SAVE`/`BARCODE_REPLACE` no servidor. Sem writes diretos no Firestore, alterações em Rules, saldos, lotes, históricos ou nova dependência de scanner.
- **Economia Firestore:** pesquisa/lista mobile computada sobre materiais, localizações e saldos físicos previamente consultados em `WarehouseHomeOperational`; lote consultado apenas na abertura de local, barcode consultado apenas para materiais daquele local. Scanner processa vídeo localmente e não o envia/guarda. Limites de leitura incompleta bloqueiam edição e PDF, evitando substituições com dados parciais.
- **QA/segurança:** tipos, auditoria de writes, scanner móvel, contrato de inspeção e proteção Core são gates do PR. Teste real no celular, com permissão de câmera (HTTPS), scanner EAN/UPC/Code128, ação de salvar, bloqueio de código repetido e permissão de operador deve ser realizado no staged **somente com workspace QA** antes de promover em produção. Não digitar `PUBLICAR` sem esse GO humano.
- **Entrega:** GitHub gera branch/PR, revisão e CI; fundador continua responsável pelo fluxo manual PowerShell `vercel.cmd pull/build --prod/deploy --prebuilt --prod --skip-domain` e promoção do MESMO deployment, após smoke em dispositivo real. Evitar deploy automático e não alterar Firestore Rules.
