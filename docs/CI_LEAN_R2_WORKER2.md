# EMPROVEX — CI LEAN R2 / Worker 2 (DRAFT)

> Estado: transição conservadora. Nenhum status check requerido foi excluído e nenhum workflow publica produção.

## Escopo e evidência original

- `main` auditada em 24/10/2026: HEAD `afe163139089a1af8ffc81804464429d4d0f9528` no início da execução do Worker 2.
- Run de falha: [40118652191](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/runs/40118652191), `validate-application` interrompido em `verify:mobile-r1-integration-3`: guard exigia referência a `finalizeWarehouseMaterialWithdrawal`, retirada móvel agora usa `WITHDRAWAL_FINALIZE_MOBILE`.
- Run de referência *concluído com sucesso*, antes da mudança: [40063891651](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/runs/40063891651), ciclo ~6min29s. Início/fim de comandos extraídos do log: `npm ci` ~81,7s, `npm run build` ~63,8s, primeiro `typecheck` ~19,1s, segurança multitenant ~23,9s e um ciclo Warehouse emulator ~20,3s. **São intervalos entre inícios de comandos; não são tempos isolados de consumo ou benchmark novo.**
- Inventário dos nove workflows obrigatórios e `package.json` revisados. Repetições explícitas entre workflows: `typecheck` (3), Chromium install (3), guard de escrita direta Warehouse (2), core protection (2), recovery test (2), backup guard (2), OAuth legal guard (2), build (2).
- Consulta à proteção de `main`: HTTP 403 (`Resource not accessible by integration`). A API de rulesets não listou regras acessíveis. **Não pressupor** que os seis gates de compatibilidade possam ser removidos.

## Implementação efetiva

1. **Correção móvel prioritária.** `verify-mobile-r1-integration-3.mjs` agora confere encadeamento de cliente, comando autenticado, rota server-side, finalizador canônico, responsável derivado de `access.email`, idempotência por ID e ausência de writes Firebase diretos. Verificadores antigos `verify-mobile-r1-integration-final`, `verify-mobile-k-canonical-ops` e `verify-adm-deposito-modular-r1` foram alinhados aos contratos atuais de retirada e validade (sem FEFO).
2. **Fast CI.** `scripts/ci-lean-plan.mjs` retorna seleção por risco, com fallbacks para alterações não reconhecidas. `scripts/ci-fast-tests.mjs` preserva os seletores específicos antigos e adiciona a seleção conservadora. Alterações em módulos compartilhados propagam para importadores relativos; renames consideram os dois caminhos. Diff vazio/inválido falha fechado. `scripts/ci-lean-syntax.mjs` faz `node --check` dos executáveis JS alterados; TypeScript continua verificado por `tsc`; a auditoria estrita de writes permanece.
3. **Domain CI (estágio).** Workflow `emprovex-domain-ci-r2.yml`, um planner e matriz limitada a 3 runners simultâneos para Warehouse, Financeiro, Auth, Legal, Visual e Recovery em PRs prontos para revisão. Suites profundas já existentes são acionadas via `scripts/ci-lean-domain.mjs`; em PR DRAFT o Domain CI fica corretamente skipped. A execução Domain ainda duplica parte do Application: remover sobreposição só depois de certificar a transferência de cobertura e a vinculação dos checks requeridos.
4. **Release CI.** `Application CI` mantém o nome de `validate-application` e seis aliases finais até auditoria de branch protection. Mantém build, Emulator, regressões e guardas, mas consolida 100 verificadores `verify:*` em 10 blocos de execução sequencial. O manifesto `ops/ci-lean-r2-guards.json` enumera os 134 verificadores antes da consolidação; `scripts/ci-lean-guards.test.mjs` prova equivalência de **ordem e cobertura**, mapeamento de rótulos legados, existência dos comandos npm e FAIL do executor ao falhar uma etapa. Esses rótulos legados ficam documentados no YAML e devem ter vínculo exato com o manifesto. A segunda verificação idêntica de TypeScript após o build foi removida, preservando o orçamento zero de erros e o build de produção.
5. **Nenhuma mudança** em `package-lock.json`, motores de domínio Warehouse/Financeiro, regras Firestore ou produção. Actions e Node não sofreram upgrade sem teste de compatibilidade.

## Quantitativo estrutural (não confundir com benchmark)

| Indicador | Antes | Neste PR |
|---|---:|---:|
| `application-ci.yml` | 746 linhas | 522 linhas |
| Etapas nomeadas no Application | 208 | 119 |
| Verificadores legados inventariados | 134 | 134 |
| Verificadores em lotes | 0 | 100 em 10 grupos |
| Gates finais históricos | 6 | 6, preservados |
| Typecheck no Application | 2 | 1 explícito + build |

A redução de 89 etapas nomeadas (**aprox. 42,8%**) diminui overhead de steps e manutenção, **não assegura** redução proporcional do tempo: comandos guardados continuam sendo executados. O principal custo observado foi instalação/build/emuladores. Fast/Domain introduzem trabalho adicional durante a transição.

## Casos negativos protegidos

`node --test scripts/ci-lean-plan.test.mjs scripts/ci-lean-syntax.test.mjs scripts/ci-lean-domain.test.mjs scripts/ci-lean-guards.test.mjs`

- Arquivo desconhecido, alteração global ou script de teste desconhecido => todos os domínios de proteção.
- Diff vazio, status inválido, rename sem segunda referência => erro; renomear arquivo crítico para documentação ainda preserva proteção.
- Alteração em operação móvel => suíte de retirada e verificadores de integração.
- Firestore Rules/autorizações => cobertura multitenant/isolamento.
- Importador transitivo => expansão de domínio.
- JS `.mjs` com erro sintático => FAIL.
- Falha de uma etapa dentro de um lote => FAIL no grupo (e aborta imediatamente); grupo não declarado => FAIL.
- Ausência, duplicação, renomeação não acompanhada ou reordenação de um verificador histórico => FAIL no teste de cobertura.

## Transição de checks e critérios para merge

1. Manter PR **DRAFT** enquanto Fast CI e Core Protection forem avaliados. Nada é publicado automaticamente.
2. Certificar o `Application CI` completo no commit final antes de merge. O check é skipped para PR DRAFT, portanto ausência de FAIL não significa PASS do release. Executar em contexto de PR pronto para revisão somente com autorização do Coordenador, preservando o PR isolado até então.
3. Obter leitura administrativa de proteção da branch e inventariar as seis exigências históricas antes de substituí-las por **uma decisão de release**. Manter aliases até migração do status check em duas etapas verificadas.
4. Medir no mesmo HEAD e com alterações representativas: documentação, visual, financeiro, Warehouse, autorização, scripts/workflows, contratos globais. Comparar tempos de jobs, instalação e comandos (e não espera na fila) e runner minutes. Não atribuir ganho de desempenho sem execução.
5. Worker 4 permanece responsável por novas provas funcionais, concorrência, regressão e mutações de domínio. Integrá-las por script de domínio/release sem editar motores para satisfazer guardas de texto.
6. Worker 2 cuida da seleção, workflows e compatibilidade; Coordenador autoriza unificação/merge/release após evidências.

## Certificação executada no GitHub Actions — 24/10/2026

- **CI Fast PASS**: [run 40136335428](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/runs/40136335428), SHA `2d6b9be9`.
- **Application CI integral PASS**: [run 40136332916](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/runs/40136332916), SHA `2d6b9be9`, incluindo `validate-application`, produção build, testes de emulator, regressões, 100 guards em 10 lotes e **seis aliases finais PASS**.
- **Core Protection PASS**, **Recovery guardrails PASS**, **SAAS-DL Legal Validation PASS** e **Fast CI PASS** no SHA `aad72b6f025ccdcef808c7df2ab5bfb6aea42136`.
- **Domain CI integral PASS**: [run 40137282359](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/runs/40137282359), mesmo SHA `aad72b6f0`: planner, Warehouse (Rules server-only, entrada avulsa atômica, saída móvel), Financeiro, Autorização, Legal, Visual e Recuperação — sete jobs SUCCESS. O plano de seleção executou seis domínios.
- **Falha real encontrada na primeira matriz**: teste legado `test:adm-deposito-modular-r1-security` exigia escrita direta do cliente autorizada; essa expectativa contradiz as Rules server-only. Foi substituído no Domain Warehouse por dois testes reais de Emulator server-only e transação atômica, sem flexibilização de Rules.
- Para certificar o release no PR DRAFT, foi habilitado temporariamente push do branch no Application; exceção **já retirada**. Para certificar Domain, o planner foi temporariamente liberado no PR DRAFT; exceção **já retirada**. Os dois workflows voltaram aos gatilhos conservadores usuais; nenhum ambiente foi promovido.

### Comparação quantitativa de duas execuções bem-sucedidas

| Métrica | Main anterior, run 40063891651 | Worker 2, run 40136332916 |
|---|---:|---:|
| Job principal: primeiro ao último evento timestamp do log | 377,8 s | 313,9 s |
| Variação observada do job principal | referência | **−63,9 s (−16,9%)** |
| Inícios de comandos GitHub Actions (log) | 202 | 113 |
| Etapas nomeadas no YAML | 208 | 119 |
| Intervalo estimado `npm ci` até próximo comando | 81,7 s | 75,0 s |
| Jornada completa (run created → updated) | ~6 min 29 s | ~6 min 57 s |

O novo run entrou na execução do runner por volta de 21:57:01 UTC após ter sido criado às 21:55:27 UTC (**~94s de espera**). Portanto o ganho do job **não** equivale ao tempo total de conclusão do run para o usuário. Distintos horários de execução, variações do cache/runner e diferenças da suíte tornam esta comparação uma observação inicial, não uma garantia estatística. Os 100 guards agrupados continuam executando, exatamente uma vez, através do manifesto.

### Descobertas de compatibilidade corrigidas pelos próprios testes

1. Guarda original da MOBILE-G dependia de nome de finalizador antigo. Passou a exigir o comando autenticado server-side atual.
2. `verify-mobile-r1-integration-final` usava texto antigo sobre lotes; agora exige alerta efetivo de referência de validade excessiva comparada ao saldo físico.
3. `verify-production-multitenant-readiness` reconhecia apenas `npm run` no YAML; agora deriva o conjunto exigido de comandos executáveis diretamente ou via grupos certificados, em vez de comentário arbitrário.
4. Guards legados dos Blocos 15/16 exigiam o nome da segunda etapa de TypeScript. Agora exigem a verificação real de TS com orçamento e build, sem restaurar a etapa redundante.
5. Rótulos históricos esperados por outros guards são mantidos no YAML com confronto um-para-um e ordem verificada pelo teste `ci-lean-guards.test.mjs`, e não substituem comandos executáveis.

### Limites remanescentes da certificação

- Sem permissão para ler os required checks de proteção de `main` (API 403), os seis aliases finais continuam. A decisão única de release fica pendente de migração administrativamente certificada.
- Domain CI R2 já executou toda a matriz uma vez com PASS no SHA `aad72b6f0`. O último commit removeu exclusivamente sua exceção temporária de PR DRAFT; esse último commit, por si só, não é um novo PASS integral do Application CI. O fluxo normal mantém Domain e Application *skipped* em DRAFT; antes do merge, conferir a certificação completa no SHA de integração conforme política do Coordenador.
- É necessário comparar conjuntos de mudanças representativos por domínio em múltiplos runs para uma distribuição de tempo, runner minutes e cobertura; os casos negativos do seletor já estão implementados.
- Nenhum deploy, merge na `main`, nem alteração de Firestore Rules foi realizado.

## Handoff

- **Onde estamos:** branch `feat/core-lean-r2-w2-ci`, PR DRAFT #372.
- **O que foi executado:** restaurado o guard móvel, corrigidos verificadores de contratos históricos, Fast CI fail-closed, Domain CI de seis domínios e Application CI com 100 guardas agrupados em dez blocos, preservados seis checks legados e build.
- **Quem faz:** Worker 2 (CI), Worker 4 (testes de integridade independentes), Coordenador (integração e aprovação).
- **A seguir (Coordenador):** integrar auditoria independente do Worker 4, verificar que `main` não avançou ou rebasear de forma controlada, revisar status checks obrigatórios com credencial administrativa (consulta inicial 403), obter PASS no commit de integração e autorizar merge somente após revisão. Manter os seis aliases legados até prova de substituição. Não fazer deploy nem alterar Rules a partir deste PR sem autorização.
- **Worker 2:** concluir a revisão de PR DRAFT e responder a regressões de integração. Nenhuma alteração direta na `main` realizada.


## Retomada — novas suites de identidade e certificação adversarial (25/10/2026)

**Snapshot original coordenado**: Worker 3 PR #373, HEAD 939b8cb5 (contrato financeiro V2 e suíte); Worker 4 PR #374, HEAD a16bab62 (contrato v2 e Emulator adversarial); Worker 1 PR #375 segue evoluindo. Os quatro arquivos de teste/contrato novos foram copiados fielmente desses HEADs para permitir execução concreta no PR #372 enquanto a composição não existe; remover duplicação lógica de PR por resolução de conteúdo idêntico durante integração. Se seus autores evoluírem os contratos, o Coordenador deve adotar as versões mais recentes e executar novamente as mesmas suites.

**Fast**: domínios financeiros (incluindo mudança no próprio teste) selecionam `test:financial-identity-v2`; Warehouse, API, transações e autorização selecionam `test:core-lean-r2-w4-contract`. Arquivos desconhecidos, workflows, importadores transitivos e renomeações mantêm expansão conservadora. `scripts/ci-lean-mutations.test.mjs` exerce dez controles negativos reversíveis (injeção de sintaxe em temporário e respostas simuladas de FAIL no runner; não são provas de segurança end-to-end).

**Domain Warehouse**: adiciona testes reais `test:core-lean-r2-w4-contract` e `test:core-lean-r2-w4-assurance` com Auth/Firestore Emulator isolados; Domain Finance: `test:financial-identity-v2`. **Application/Release** executa todos os três. O teste adversarial de cabeçalho `FINALIZED` falsificado no replay v2 foi mantido integralmente; resultado FAIL deve continuar bloqueando integração até o Worker 1 corrigir e a mesma suíte aprovar sobre o HEAD composto. Não usar `continue-on-error`, fake mocks para aprovar o motor nem relaxar testes.

**Benchmarks Worker 5**: scripts ainda não publicados neste snapshot; arquivos desconhecidos acionam seleção conservadora. Testes de compatibilidade/invariantes determinísticos devem ser adicionados ao Domain/Release quando houver comandos reais. Benchmarks não determinísticos devem ser medidos no ambiente isolado em modo manual/controlado, com dados/limiares descritos, sem threshold flutuante de performance no Fast.

**Execução solicitada**: `node --test scripts/ci-lean-plan.test.mjs scripts/ci-lean-domain.test.mjs scripts/ci-lean-mutations.test.mjs`; `npm run test:financial-identity-v2`; `npm run test:core-lean-r2-w4-contract`; `$env:NEXT_PUBLIC_EMPROVEX_E2E_PROJECT_ID='demo-emprovex-security'; npm run test:core-lean-r2-w4-assurance` (PowerShell). Integração/Release: `gh workflow run application-ci.yml --ref <BRANCH_CONSOLIDADA>`, `gh workflow run emprovex-domain-ci-r2.yml --ref <BRANCH_CONSOLIDADA>` depois que esses workflows estiverem disponíveis na branch padrão, ou Ready for review controlado se não estiverem (jamais tomar SKIPPED por PASS). Confirmar explicitamente os seis aliases legados, Recovery, Legal, Core Protection e Full Application no mesmo SHA. Nenhum deploy nem merge por este Worker.


### Execução de certificação com branch DRAFT (snapshot fe7a82f3)

Ativação transitória, **restrita ao PR W2**, das condições de execução em DRAFT para produzir evidência; restaurar condições canônicas imediatamente após a rodada atualizada. Application 40157502119: **FAIL confirmado** no último `assert.rejects` da suíte W4, linha 346, porque um cabeçalho `FINALIZED` falsificado sem movimento/consumo foi aceito na v2. Os 15 cenários anteriores de atomicidade, rollback, auditoria, concorrência, validade e escopo tiveram PASS. Domain 40157502115: Domain Finance/Auth/Legal/Visual PASS, Domain Warehouse FAIL pela mesma vulnerabilidade (Recovery também executado). Se o Worker 1 corrigir, reexecutar sem modificar a assertion.

**Worker 5 incorporado (PR #377, snapshot em 25/10):** `scripts/core-lean-r2-w5-profile.mjs`, `...profile.test.mjs`, `...historical.test.ts`. Fast executa perfil com invariantes determinísticos (SEM threshold de tempo); Warehouse Domain e Application incluem compatibilidade histórica e perfil; benchmark CPU e Firestore REST com JSON ficam exclusivamente no workflow isolado do Worker 5, controlado e auditável. A identidade v3 do W5 é `skip` quando v3 ainda não foi composta; verificar que NÃO está skipped no SHA do Coordenador. Leituras/RPCs de Emulator não são billed reads nem prova de ganho E2E.

**Worker 3 atualizado:** teste financeiro revisto do PR #373 (cobertura negativa adicional de NS/PDF), com execução automática sempre que contratos ou o teste financeiro são alterados. Atributo `@/*` do tsconfig e imports side-effect agora percorrem os importadores transitivos; teste negativo demonstra propagação.

### Fechamento da execução transitória sobre SHA eda0c651

**Evidência real (sem interpretação de skipped como PASS):** Fast 40157862322 PASS (inclui testes negativos/seleção/TypeScript/SDK); Core Protection 40157862328 PASS; Recovery guardrails 40157862236 PASS; Domain 40157862231: `finance`, `auth`, `legal`, `visual`, `recovery` PASS, `warehouse` FAIL; Application 40157862250 FAIL na mesma asserção de integridade da suíte W4. Warehouse Domain registrou W4 contrato 4/4 PASS, W5 perfil 7/7 PASS e histórico 5/5 PASS, mas também falha em `test:core-lean-r2-w4-assurance` pelo replay `FINALIZED` forjado. Teste NÃO foi alterado. Release gates 16–21 sinalizaram FAIL (comportamento correto). **NO-GO** para integração.

A exceção transitória de `pull_request.draft` foi removida dos workflows Application e Domain nesta revisão final. O PR volta a permanecer DRAFT, com Fast/Core/Legal/Recovery acionados normalmente e Application/Domain skipped nesse contexto; o Coordinator precisa executar ambos integralmente em PR Ready / `workflow_dispatch` sobre o SHA de integração final. A atualização sincronizou também a correção de parser REST JSON e teste correspondente do Worker 5, sem limiares frágeis de benchmark.
