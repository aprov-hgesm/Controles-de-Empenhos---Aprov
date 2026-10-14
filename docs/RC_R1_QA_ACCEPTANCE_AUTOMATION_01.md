# RC R1 QA ACCEPTANCE AUTOMATION 01
Data 2026-10-14 | Branch rc-r1-qa-acceptance-automation-01 | Base congelada 61e372225834ed6060cd2b36dbdd55d1e1979c2c
Executor: Worker QA. Sem merge, deploy, publicação de Rules ou operação de dados reais.

## Auditoria prévia
O script Browser E2E existente cria identidades sintéticas no Auth Emulator 9099 e Firestore principal 8080. O Warehouse usa banco em instância Emulator separada 8081. Há testes Playwright anteriores para login/logout, isolamento setorial, estoque, barcode, croqui e inventário, além de F05/F06/F09 e MOBILE-K. Não confundir os gates históricos do freeze com PASS novo neste HEAD.
A matriz de referência P01–P24 encontra-se no PR #281 (branch rc-r1-preview-acceptance-01).

## Artefatos
- Guard fail-closed e 6 testes de isolamento negativos/positivo.
- Novo arquivo Playwright com 7 jornadas locais, P01/P02/P03/P05/P06/P07/P08/P15/P21. P07 só observa o aceite se exigido; P15/P21 verificam acesso/viewport, não scanner ou latência real.
- Workflow GitHub Actions restrito ao worker, com hash das Rules e repositórios produtivos, regressões e Chromium. Os resultados devem ser associados ao SHA do run, sem projeções.

## Matriz P01–P24 inicial, ANTES da execução do workflow
| Casos | Estado | Comentário |
|---|---|---|
| P01–P03 | PENDENTE AUTOMÁTICO | Novos testes locais, não Preview protegido |
| P04 | PASS HUMANO PARCIAL | Fundador autenticou; logout Preview não testado |
| P05–P07 | PENDENTE AUTOMÁTICO | Login/isolamento/aceite sob Emulator; versão legal remota não validada |
| P08 | PASS HUMANO PARCIAL | Pesquisa, localização e perspectiva vistos no Preview; Firestore autoritativo ainda não provado |
| P09–P10 | PENDENTE / BLOCKED REMOTO | F05 histórico, replay legado 409 fail-closed |
| P11–P12 | PENDENTE / BLOCKED REMOTO | F06 histórico 9/9, sem corrida nova |
| P13–P14 | PENDENTE / BLOCKED REMOTO | F09/inventário com infraestrutura de regressão anterior, sem prova no novo SHA |
| P15 | PENDENTE | Portal mobile apenas, consulta/conferência ainda pendentes |
| P16–P18 | PENDENTE FÍSICO | Etiqueta Code128, câmera e double scan no dispositivo real |
| P19–P20 | PENDENTE FÍSICO | Rede e coerência simultânea com ledger em ambiente autorizado |
| P21 | PENDENTE | Chromium local não representa Android/PC reais |
| P22 | PENDENTE FÍSICO | Safari iPhone |
| P23–P24 | PENDENTE | Saúde Preview, rollback e instrumentação/custos reais |

## Segurança e bloqueios
- Preview x Production sem isolamento comprovado: zero testes remotos mutáveis autorizados.
- HTTP automático Preview 401/302 não é bug nem PASS; não burlar autenticação.
- F05 legado nota sem intent apresenta 409 fail-closed; exige decisão de produto.
- UNASSIGNED na fixture histórica é legado, não posição operacional.
- Sem PIN/password/tokens reais em artefatos; traces somente de falhas com dados sintéticos.
- Após execução, preencher status real por job/run e tratar cada FAIL/BLOCKED sem falsear PASS.

## Handoff obrigatório
**ONDE ESTAMOS:** Macroação 3/4; branch isolada no freeze.
**O QUE ESTAMOS FAZENDO:** validação QA automatizada local, com gate de isolamento.
**QUEM ESTÁ FAZENDO:** Worker QA.
**O QUE FAZER A SEGUIR:** verificar run deste HEAD e reconciliar matriz; continuar testes não cobertos.
**QUEM FARÁ:** Worker registra CI e bugs; Coordenador concilia Memorial; Fundador realiza testes físicos e Preview autorizado.
**Classificação enquanto sem execução:** BLOCKED (nenhum PASS novo).
