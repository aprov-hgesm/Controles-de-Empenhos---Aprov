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

## Handoff

- **Onde estamos:** branch `feat/core-lean-r2-w2-ci`, PR DRAFT #372.
- **O que estamos fazendo:** corrigir o guard móvel obsoleto e iniciar CI por risco sem perder certificação histórica.
- **Quem faz:** Worker 2 (CI), Worker 4 (testes de integridade independentes), Coordenador (integração e aprovação).
- **A seguir:** verificar runs finais GitHub, resolver falhas reais sem `continue-on-error`; executar Release completo após autorização de mudança de estágio; obter branch protection administrativa; decidir retirada dos aliases e duplicações restantes baseada em provas.
