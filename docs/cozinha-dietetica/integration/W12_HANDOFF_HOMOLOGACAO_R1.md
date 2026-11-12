# W12 — Homologação E2E, contingência e decisão de piloto controlado — Handoff R1

**Data:** 12/11/2026. **Branch:** `feat/cozinha-dietetica-w12-homologacao-piloto`. **PR-base W11:** [#552](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/552), HEAD consultado imediatamente antes da criação da branch: `de770c4d15dba0f4d105f2f70aa1785f8e84aecd`. **Destino exclusivo:** `feat/cozinha-dietetica-w11-infra-hospitalar-isolada`. **SHA do código W12 validado em CI:** `56d192f49e597f95b724eb71fbc8985452f58b20` ([workflow SUCCESS #43153633788](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/runs/43153633788)). Commit posterior apenas documental; consultar o HEAD final da PR #553.

> **Distinção obrigatória:** as evidências reais W11 de Cloud Run privado, IAM, Firestore HTTP 200, Auth HTTP 200 e Workflows OIDC SUCCEEDED/PASS são aceitas **sem reprovisionar ou refazer**. Elas comprovam infraestrutura, **não** E2E clínico. O código W12 não foi implantado no Cloud Run: este worker não tem sessão GCP/autorização para deploy e a missão proíbe deploy. Nenhum paciente, usuário ou prontuário real foi utilizado.

## 1. Delta efetivamente implementado

- `middleware.ts`: permite somente os assets de ícone instalável `/api/install-icon/*` **dentro do Cloud Run hospitalar já privado por IAM**. Antes, o `manifest.webmanifest` indicava ícones de instalação que o middleware hospitalar recusava com 404. A API clínica e os endpoints comerciais/financeiros continuam separados; a correção não autoriza acesso público.
- `lib/server/hospital/reporting/firestore-service.mjs`: origem de relatório agora reflete o transporte real: `W12_FIRESTORE_GCP_HOSPITAL_QA` para GCP e `W10_FIRESTORE_QA_EMULATOR` para emulador. Antes, até um relatório no GCP seria rotulado incorretamente como emulador.
- `tests/hospital/firebase/w12-homologation-e2e.test.mjs`: testes transacionais reais no Firestore Emulator com dados unicamente sintéticos, UTI/UPI/PAM/Oncologia/Bloco, Cozinha, Nutrição, Administração e usuário comercial negado. Inclui segunda OM, token revogado sintético, mesma requisição repetida, disputa concorrente de envio, versões imutáveis, registro médico posterior com jejum e produção bloqueada, evidência de não entrega, relatórios, janela 06/10/16 e indisponibilidade HTTP sem fallback.
- `tests/hospital/firebase/w12-pwa-boundary.test.mjs`: proteção dos assets PWA e verificação de metadados corretos de origem/escopo em relatórios, sem conexão externa.
- `lib/server/hospital/contingency/**` e `app/api/hospital/contingency/route.ts`: registro de formulários de indisponibilidade em incidente **pendente**, com horário declarado separado do horário registrado; não cria evento físico de entrega, não altera `meal.status`, exige token Firebase hospitalar e membership da unidade, idempotência pelo número opaco do formulário e rejeição de IDs entre OMs.
- `tests/hospital/firebase/w12-contingency-recovery.test.mjs`: ensaio de indisponibilidade após commit, replay sem duplicação, role/OM negados, trilha e P95 local. `tests/hospital/firebase/w12-backup-restore.mjs`: exportação real do Emulator, reinicialização/importação e comparação de paciente/mapa/snapshot/auditoria/idempotência. `tests/hospital/browser/w12-closed-qa.spec.mjs`: Chromium real com viewport Android/desktop, navegação por teclado, tela clínica fechada, PWA/ícones e screenshots estritamente anônimos.
- `.github/workflows/hospital-w12-homologation-qa.yml`: suíte exclusiva da branch/PR W12, sem segredos, IAM, aplicação de Rules, deploy ou escrita no GCP. Regressões do núcleo EMPROVEX executadas na mesma matriz.

**O ciclo operacional completo** (cadastro → internação → prescrição fictícia → 3 mapas → cozinha → lote → montagem → expedição → recebimento → entrega positiva → nutrição → relatórios → transferência/revogação) segue adicionalmente coberto pelo E2E W10 no emulador, **reexecutado no gate W12**. Isso é QA de código, não teste hospitalar presencial.

## 2. Evidências e resultados por ambiente

| Ambiente / gate | Resultado | Evidência e limite |
|---|---|---|
| W11 Cloud Run privado, IAM, Firestore e Auth | **PASS herdado do W11** | [Handoff W11](W11_HANDOFF_GCP_R1.md), seções 12–13; não repetido |
| W12 Firestore/Auth Emulator W10–W12, contingência e falha após commit | **PASS (17/17)** | [Workflow W12 #43153633788](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/runs/43153633788); transações, perfis, idempotência e falhas reais simuladas |
| W12 PWA, isolamento do middleware, fonte de relatório, identidade | **PASS (10/10)** | [Workflow W12 #43153633788](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/runs/43153633788) |
| Typecheck, build, PWA histórico, W0–W9 e regressões EMPROVEX | **PASS** | Typecheck e build; PWA **12/12**, W0–W9 **111/111**, financeiro/logística **29/29**, Core Protection **PASS**, [workflow](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/runs/43153633788) |
| Browser Chromium desktop e viewport Android, navegação por teclado, PWA fechado | **PASS (3/3)** | Chromium real headless, screenshots anônimos no artefato `hospital-w12-synthetic-visual`, [run #43153633788](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/runs/43153633788). **Dispositivo físico, login clínico e auditoria WCAG completa NÃO EXECUTADOS** |
| W12 E2E via Cloud Run privado + Firebase Auth/Firestore GCP com 8 perfis sintéticos | **NÃO EXECUTADO** | Branch W12 ainda não presente no Cloud Run; nenhuma sessão de invocador interno/credenciais de QA disponível; deploy não autorizado |
| Teste de carga controlada no emulador (40 amostras, concorrência 5, duas leituras/amostra) | **PASS** | **P95 = 20,83 ms; 0 falhas**, medido na suíte W12. Não representa pico no Cloud Run nem quota/custo GCP |
| Firestore Emulator — exportação real, reinicialização e importação | **PASS** | Arquivo exportado no `RUNNER_TEMP`, restaurado em novo processo; paciente sintético, mapa, snapshot imutável e replay idempotente conciliados no [CI #43153633788](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/runs/43153633788). **Backup/restauração GCP REAL NÃO EXECUTADOS** |
| Registro retrospectivo seguro de contingência via API | **PASS no emulador** | Grava incidente pendente, evento append-only, autor/horário do servidor vs horário efetivo informado; replay após falha pós-commit sem duplicação. **Ensaio institucional presencial NÃO EXECUTADO** |

**PASS anterior não é PASS W12:** a tabela distingue os testes rodados no GitHub, a comprovação histórica da infraestrutura e o que permanece sem execução. **SKIP significa não executado, nunca aprovado.** Atualizar somente com resultado objetivo de workflow/execução identificada.

## 3. Matriz concisa de risco e contenções

| Risco | Proteção verificada no código / exigência |
|---|---|
| Acesso cruzado entre OMs, unidades ou por papel comercial | Escopo montado no servidor via token + membership, unidade/UG e objeto; testes negativos W12; IAM/Rules do W11 permanecem fechados |
| Paciente em jejum, alergia, transferência, mudança de prescrição | Rechecagem antes de preparar/expedir/entregar; W10 cobre transferência/entrega, W12 bloqueia novo jejum e preserva snapshot. Identificação positiva com dois identificadores continua obrigatória |
| Requisição duplicada após timeout, dupla aba/cozinheiros | Transação Firestore, ETag, idempotencyKey, versão create-only e reservas únicas; asserts W10/W12 contra duplicidade |
| Pedido tardio após 06/10/16 | Motor diferencia horário do mapa de tolerância de entrega +30 minutos; não libera automaticamente principal após tolerância; exceção clínica é ocorrência/contato, não aprovação nutricional de rotina |
| PWA privado com asset ausente | Rota de ícones permitida apenas no serviço QA IAM; sem introduzir Service Worker que armazene dados clínicos |
| Perda de rede, indisponibilidade GCP ou restart | Operação falha fechada sem cache clínico local e sem SQLite de fallback; protocolo externo institucional necessário para continuidade |
| Backup/restore, retenção e LGPD | Export/import real no emulador **PASS**; backup/restauração do Firestore GCP, retenção e aprovação institucional **pendentes/bloqueadores clínicos** |
| Carga de pico e instância única W11 | P95 local 20,83 ms em 40 amostras/5 concorrentes **PASS no emulador**. Pico real 06/10/16, custo e limites de instância GCP permanecem **não executados** |
| Regressoes do EMPROVEX principal | Mudanças concentradas em fronteira QA + reporting hospitalar; gates Core Protection, financeiro, NF, warehouse e billing no CI W12 |

**Não conclusões:** prints de acesso móvel, orçamento de consultas, Cloud Run Ready e relatório de código não substituem latência real, restauração de backup ou observação presencial.

## 4. Procedimento de contingência institucional a ENSAIAR (não homologado pelo hospital)

1. Responsável assistencial confirma prescrição, identificação positiva, jejum e alergias no fluxo institucional externo. Cozinha e unidades adotam o **formulário/papel oficialmente autorizado**, caso o sistema falhe na janela 06/10/16; sistema não é fonte substitutiva da prescrição.
2. Registrar no controle externo mínimo: OM/unidade, data/ciclo, identificação restrita do paciente nos meios aprovados, dieta conforme prescrição, horários **efetivos** de solicitação/preparo/expedição/entrega, responsáveis, ocorrências/recusas e conferência de dois identificadores. Guardar sob custódia definida pela instituição, nunca em navegadores/WhatsApp/planilhas abertas.
3. Quando o serviço retornar, reavaliar paciente ativo, transferência, prescrição, jejum e mapa; reconciliar cada evento físico **sem presumir que expedição equivale a entrega**. Registrar data/hora efetiva como informação retrospectiva e data/hora de lançamento do servidor de forma distinta. Nunca criar timestamp falso ou apagar evento anterior. Duplicatas precisam de idempotencyKey e revisão.
4. **Atualização W12:** existe endpoint QA `POST /api/hospital/contingency` com operação `downtime.record`, para registrar **relato retrospectivo pendente de revisão institucional**; possui horário efetivo declarado e horário real de gravação, referência opaca `QA_*`, motivo codificado, dupla identificação declarada para relato de entrega, escopo validado e deduplicação transacional. **Ele não confirma `meal.deliver`, não cria `delivery_event` nem dispensa o formulário externo ou a conferência presencial**. Não usar como prova de entrega definitiva sem política formal.
5. Responsáveis da Cozinha, unidade assistencial, Nutrição e TI confrontam contagens dos mapas, lotes, ocorrências e entregas; registram divergências e aprovação do retorno controlado. Sem essa aprovação, permanecer em contingência.

**Exercícios necessários antes de qualquer paciente real:** falha de internet, Firestore 503, troca de turno, mapa duplicado durante recuperação, backup-restauração com dataset sintético, revisão de autorização e carga com 1 instância.

## 5. Pacote de piloto reversível — proposta, não autorização

- **Fase A — laboratório/sintético:** serviço separado `cozinha-dietetica-qa` no projeto `cozinha-dietetica`, 1 instância máxima já declarada pelo W11; organização e usuários `qa_*`; sem paciente real. Testar as cinco unidades assistenciais + Cozinha/Nutrição/Admin; nenhum acesso comercial.
- **Gates de liberação técnica remota:** executar, em nova autorização específica de ambiente privado, o E2E W12 autenticado com contas Firebase sintéticas, perfil revogado, om concorrente, rastro do Firestore real, exportações, carga controlada e captura Android/desktop; não relaxar ingress/IAM. Resolver todos os defeitos P0/P1.
- **Desativação (sem apagar dados):** `HOSPITAL_QA_APP_READY=0` e/ou `HOSPITAL_GCP_QA_ENABLED=0` na configuração de revisão hospitalar, **mediante operação explícita autorizada**, mantendo Cloud Run `internal` e IAM. Não operar flags no serviço financeiro principal. Configurar novos parâmetros em revisão controlada, não fingir que alterar variável no papel é kill switch instantâneo.
- **Rollback:** voltar para a revisão anterior do **serviço hospitalar** sob aprovação do operador; preservar Firestore clínico, eventos append-only, snapshots e trilha de auditoria. Não fazer rollback de dados por exclusão nem migrar para projeto EMPROVEX.
- **Público clínico real:** **não autorizado**. Antes da fase com pacientes, requer aprovação documentada de Direção HGeSM, TI/segurança e governança LGPD, responsáveis das unidades assistenciais, Cozinha Dietética e Nutrição, além de protocolo de contingência, backup/restauração e identificação positiva. Não assumir assinatura ou delegação.
- **Observabilidade/custos:** definir alertas de 401/403, 5xx, latência p95, leituras/gravações e taxa de retries sem dados de pacientes no log. O limite de instância W11 não elimina risco de saturação. Contas/cotas só devem ser medidas no projeto hospitalar, nunca no financeiro.

## 6. Parecer independente por fronteira

| Fronteira | Parecer | Razão |
|---|---|---|
| (a) QA/emulador | **GO para revisão técnica sintética** | CI W12 [SUCCESS](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/runs/43153633788): **17/17 E2E e contingência**, 10/10 segurança/PWA, 12/12 PWA, 111/111 hospital, 29/29 regressões, backup+restore real em emulador, navegador 3/3 e typecheck/build PASS |
| (b) Cloud Run QA hospitalar com contas sintéticas | **NO-GO para declarar W12 homologado remotamente** | W11 infra PASS, mas nenhum fluxo W12 ponta a ponta no serviço privado foi executado |
| (c) Preparação de produção | **NO-GO** | Backup/restauração, observabilidade, latência de pico, contingência e aceite institucional ainda não evidenciados |
| (d) Piloto clínico com pacientes reais | **NO-GO** | Falta autorização institucional e validação clínica/privacidade; esta missão proíbe dados reais |

**Limites W12 pós-homologação local:** login remoto com 8 perfis sintéticos no Cloud Run GCP real, backup+restore GCP independente, prova de pico e custo/latência GCP, dispositivo Android físico, auditoria formal de acessibilidade, operação em papel e autorização institucional permanecem **não executados**. Não converter P95 do emulador em SLA, ou visual headless em dispositivo físico.

**Gates externos no SHA de código testado anterior (referência histórica):** [Core Protection SUCCESS](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/runs/43149776738); [Fast CI SUCCESS](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/runs/43149776791); [Hospital W08 QA SUCCESS](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/runs/43149776729); [W4 Evidence SUCCESS](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/runs/43149776694). Application CI e Domain CI R2: **SKIPPED** na branch. Visual-R2 real, QA remoto GCP, sessão Android e backup/restore: **NÃO EXECUTADO**, não equivalem a PASS.

**Mudanças externas realizadas pelo W12: nenhuma.** Sem IAM, deploy, Rules, faturamento, alteração da main, dados clínicos ou sistemas do EMPROVEX. Evidência e próxima decisão permanecem nesta PR Draft, sem criar W13.

## 7. Autorização de revisão QA privada — 12/11/2026

O titular autorizou explicitamente a **implantação de uma revisão W12 exclusivamente no serviço privado Cloud Run `cozinha-dietetica-qa`**, no projeto `cozinha-dietetica`, e a execução posterior de testes com **organizações, contas e pacientes integralmente sintéticos**. Isso **não** autoriza merge, deploy público, alterações no serviço EMPROVEX principal, uso clínico real ou acesso a prontuários.

Preparação versionada na própria PR W12:
- `ops/hospital-w12-cloudbuild-qa.yaml`: Dockerfile hospitalar já testado no W11, imagem `hospital-web:w12-$BUILD_ID` no Artifact Registry exclusivo e argumentos de Firebase Web público no momento do build.
- `ops/hospital-w12-private-qa.ps1`: confere branch/HEAD remoto, working tree limpo, serviço/IAM de ingresso `internal`, identidade `hospital-qa-runtime`, maxScale=1 e nenhum invocador público; usa Cloud Build com digest imutável; faz `gcloud run deploy --no-traffic --tag=w12qa`, preserva 100% do tráfego W11, restringe a uma instância, configura somente `HOSPITAL_QA_ORGANIZATION_ID=qa_hgesm_w12_20261112` e `HOSPITAL_QA_APP_READY=1` para login de teste **sem cadastros automáticos**; confere o tráfego após a operação. O serviço segue interno por IAM; `--no-traffic` evita promover a revisão para o URL principal.

**Situação factual neste commit: PREPARADO, NÃO IMPLANTADO.** Sem credenciais Google Cloud disponíveis diretamente ao agente, o arquivo PowerShell requer execução pelo operador no terminal Google Cloud já autenticado. O script não cria contas Firebase ou documentos de pacientes. A etapa seguinte exige comprovar o novo digest/revisão/URL tagged e então preparar usuários sintéticos, invocador temporário e E2E remoto real de forma controlada. Não converter GO local em GO remoto antes da evidência.

## 8. Prévia interativa local de interface — 12/11/2026

A captura do operador confirmou que a rota `http://localhost:3000/cozinha-dietetica` carrega, mas exibe corretamente `Acesso hospitalar não habilitado` por ausência de configuração de QA local. Foi preparado na **branch W12** um inicializador independente do Cloud Run:

- `scripts/hospital-w12-preview-local.mjs`: inicia Firebase Auth e Firestore Emulator **somente em loopback**, projeto `demo-cozinha-dietetica`, confere Java/portas/ambiente e inicia Next dev no `127.0.0.1:3100` com flags exclusivas de QA. Nenhuma credencial JSON, produção hospitalar, projeto financeiro ou GCP é utilizada.
- `scripts/hospital-w12-preview-seed.mjs`: cria oito **usuários inteiramente fictícios** (UTI, UPI, PAM, Oncologia, Bloco, Cozinha, Nutrição e Administração), uma organização demonstrativa `qa_hgesm_preview`, cinco unidades e um cenário ficcional de paciente + internação + dieta + mapa 10h de D+2. Rejeita execução se flags de emulação/ambiente local não forem exatas.
- `.github/workflows/hospital-w12-homologation-qa.yml`: valida a sintaxe dos dois scripts junto à suíte do W12.

**Modo de uso no Windows**, dentro do clone na branch W12 atualizada, com `npm.cmd ci` já realizado:

```powershell
node .\scripts\hospital-w12-preview-local.mjs
```

Abrir `http://127.0.0.1:3100/cozinha-dietetica`, usar contas `qa-<perfil>@example.test` e senha local exibida no terminal, depois acessar `/cozinha-dietetica/app` pelo link autenticado. **Preview local não é aprovação do Cloud Run QA**, não promove a revisão privada, não substitui W12 GCP E2E, não faz merge nem utiliza dados reais.

## 9. Cloud Run privado W12 — revisão implantada sem tráfego

**Evidência operacional fornecida pelo operador, 12/11/2026:** o PowerShell `ops/hospital-w12-private-qa.ps1` concluiu o Cloud Build e a implantação privada com:

```text
Source HEAD: 44ecc7f0075fc6be8082d916ca565331b04d679b
Current active traffic: cozinha-dietetica-qa-00001-j42:100
Build ID: 5fbb2d0b-bc5d-4619-ac0b-ffbb2a24bf88
revision: cozinha-dietetica-qa-00003-tot
deployed and is serving 0 percent of traffic
PASS: W12 private tagged revision deployed; live W11 traffic unchanged
Image: southamerica-east1-docker.pkg.dev/cozinha-dietetica/hospital-qa/hospital-web@sha256:c06d9b1e6f34d2ff2c06006f9caf5c7185bb728c21b70ea43e756128fc0bbfda
Private tag URL: https://w12qa---cozinha-dietetica-qa-kvxk7z2meq-rj.a.run.app
Synthetic org: qa_hgesm_w12_20261112
Synthetic accounts/Firestore clinical flows NOT YET TESTED
```

**Estado:** GO restrito a **build + implantação da revisão privada sem tráfego**. O script verificou previamente e posteriormente ingress `internal`, ausência de `allUsers`/`allAuthenticatedUsers`, service account hospitalar e tráfego padrão inalterado. **Nenhum teste funcional E2E de conta Firebase, vínculo sintético, API clínica, leitura/escrita Firestore nem teste de backup/restauração GCP foi executado nesta etapa.** URL com tag continua sujeita a ingress interno e IAM; não é prévia pública para navegador doméstico. A implementação implantada corresponde ao SHA **44ecc7f0**, anterior aos commits posteriores de **prévia local** na PR W12; não declarar que esses últimos commits estão na imagem implantada.

**Próxima prova:** verificar a revisão e variáveis QA obrigatórias sem expor credenciais, provisionar exclusivamente identidades/organização sintéticas no projeto `cozinha-dietetica` sob escopo autorizado, executar E2E internamente por invocador temporário mínimo e registrar resultados e limpeza. Preservar 0% de tráfego por padrão e não liberar uso clínico real.
