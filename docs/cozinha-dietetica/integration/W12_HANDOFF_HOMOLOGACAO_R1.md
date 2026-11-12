# W12 — Homologação E2E, contingência e decisão de piloto controlado — Handoff R1

**Data:** 12/11/2026. **Branch:** `feat/cozinha-dietetica-w12-homologacao-piloto`. **PR-base W11:** [#552](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/pull/552), HEAD consultado imediatamente antes da criação da branch: `de770c4d15dba0f4d105f2f70aa1785f8e84aecd`. **Destino exclusivo:** `feat/cozinha-dietetica-w11-infra-hospitalar-isolada`. **SHA de entrega:** consultar HEAD da PR W12 após o último commit documental; não copiar o SHA da base como se fosse o resultado.

> **Distinção obrigatória:** as evidências reais W11 de Cloud Run privado, IAM, Firestore HTTP 200, Auth HTTP 200 e Workflows OIDC SUCCEEDED/PASS são aceitas **sem reprovisionar ou refazer**. Elas comprovam infraestrutura, **não** E2E clínico. O código W12 não foi implantado no Cloud Run: este worker não tem sessão GCP/autorização para deploy e a missão proíbe deploy. Nenhum paciente, usuário ou prontuário real foi utilizado.

## 1. Delta efetivamente implementado

- `middleware.ts`: permite somente os assets de ícone instalável `/api/install-icon/*` **dentro do Cloud Run hospitalar já privado por IAM**. Antes, o `manifest.webmanifest` indicava ícones de instalação que o middleware hospitalar recusava com 404. A API clínica e os endpoints comerciais/financeiros continuam separados; a correção não autoriza acesso público.
- `lib/server/hospital/reporting/firestore-service.mjs`: origem de relatório agora reflete o transporte real: `W12_FIRESTORE_GCP_HOSPITAL_QA` para GCP e `W10_FIRESTORE_QA_EMULATOR` para emulador. Antes, até um relatório no GCP seria rotulado incorretamente como emulador.
- `tests/hospital/firebase/w12-homologation-e2e.test.mjs`: testes transacionais reais no Firestore Emulator com dados unicamente sintéticos, UTI/UPI/PAM/Oncologia/Bloco, Cozinha, Nutrição, Administração e usuário comercial negado. Inclui segunda OM, token revogado sintético, mesma requisição repetida, disputa concorrente de envio, versões imutáveis, registro médico posterior com jejum e produção bloqueada, evidência de não entrega, relatórios, janela 06/10/16 e indisponibilidade HTTP sem fallback.
- `tests/hospital/firebase/w12-pwa-boundary.test.mjs`: proteção dos assets PWA e verificação de metadados corretos de origem/escopo em relatórios, sem conexão externa.
- `.github/workflows/hospital-w12-homologation-qa.yml`: suíte exclusiva da branch/PR W12, sem segredos, IAM, aplicação de Rules, deploy ou escrita no GCP. Regressões do núcleo EMPROVEX executadas na mesma matriz.

**O ciclo operacional completo** (cadastro → internação → prescrição fictícia → 3 mapas → cozinha → lote → montagem → expedição → recebimento → entrega positiva → nutrição → relatórios → transferência/revogação) segue adicionalmente coberto pelo E2E W10 no emulador, **reexecutado no gate W12**. Isso é QA de código, não teste hospitalar presencial.

## 2. Evidências e resultados por ambiente

| Ambiente / gate | Resultado | Evidência e limite |
|---|---|---|
| W11 Cloud Run privado, IAM, Firestore e Auth | **PASS herdado do W11** | [Handoff W11](W11_HANDOFF_GCP_R1.md), seções 12–13; não repetido |
| W12 Firestore/Auth Emulator E2E + W10/W11 | **EM EXECUÇÃO** | [Workflow W12 #43148731085](https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov/actions/runs/43148731085); atualizar conclusão conforme CI |
| W12 PWA, isolamento do middleware, fonte de relatório | **EM EXECUÇÃO** | Workflow W12 |
| Typecheck, build, PWA histórico, W0–W9 e regressões EMPROVEX | **EM EXECUÇÃO** | Workflow W12 |
| Browser visual real Android/desktop, acessibilidade com dispositivo | **NÃO EXECUTADO** | Sem browser/cliente QA remoto autorizado nesta sessão; asserts PWA não substituem teste visual |
| W12 E2E via Cloud Run privado + Firebase Auth/Firestore GCP com 8 perfis sintéticos | **NÃO EXECUTADO** | Branch W12 ainda não presente no Cloud Run; nenhuma sessão de invocador interno/credenciais de QA disponível; deploy não autorizado |
| Teste de pico 06/10/16, latência/cota/firestore GCP e recuperação após reinício | **NÃO EXECUTADO** | Exige execução no ambiente hospitalar privado com instrumentação, sem dados reais |
| Backup real + restauração controlada em destino isolado | **NÃO EXECUTADO** | Não existe evidência W12 de restauração no projeto hospitalar; não executar export/restore sem controle de acesso/retenção |
| Reentrada após contingência institucional e simulado presencial | **NÃO EXECUTADO** | Procedimento clínico ainda exige desenho, autorização e responsáveis institucionais |

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
| Falha de backup/restore, retenção e LGPD | **Bloqueador clínico** até prova de restauração, retenção, autorização e auditoria de proteção de dados de saúde |
| Carga de pico e instância única W11 | **Bloqueador de desempenho remoto** até teste de 06/10/16, orçamento de latência/leitura e confirmação da estratégia de contingência |
| Regressoes do EMPROVEX principal | Mudanças concentradas em fronteira QA + reporting hospitalar; gates Core Protection, financeiro, NF, warehouse e billing no CI W12 |

**Não conclusões:** prints de acesso móvel, orçamento de consultas, Cloud Run Ready e relatório de código não substituem latência real, restauração de backup ou observação presencial.

## 4. Procedimento de contingência institucional a ENSAIAR (não homologado pelo hospital)

1. Responsável assistencial confirma prescrição, identificação positiva, jejum e alergias no fluxo institucional externo. Cozinha e unidades adotam o **formulário/papel oficialmente autorizado**, caso o sistema falhe na janela 06/10/16; sistema não é fonte substitutiva da prescrição.
2. Registrar no controle externo mínimo: OM/unidade, data/ciclo, identificação restrita do paciente nos meios aprovados, dieta conforme prescrição, horários **efetivos** de solicitação/preparo/expedição/entrega, responsáveis, ocorrências/recusas e conferência de dois identificadores. Guardar sob custódia definida pela instituição, nunca em navegadores/WhatsApp/planilhas abertas.
3. Quando o serviço retornar, reavaliar paciente ativo, transferência, prescrição, jejum e mapa; reconciliar cada evento físico **sem presumir que expedição equivale a entrega**. Registrar data/hora efetiva como informação retrospectiva e data/hora de lançamento do servidor de forma distinta. Nunca criar timestamp falso ou apagar evento anterior. Duplicatas precisam de idempotencyKey e revisão.
4. **Atenção:** o lançamento retrospectivo de **entrega física** ainda não foi homologado como fluxo específico. Até definição/implementação validada, manter o registro externo institucional e marcar incidente/pendência; não transformar retroativamente entrega em registro automático de sucesso.
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
| (a) QA/emulador | **PENDENTE CI W12** | Há implementação funcional e cobertura W10/W11 comprovada; aguarda resultado atualizado da execução W12 |
| (b) Cloud Run QA hospitalar com contas sintéticas | **NO-GO para declarar W12 homologado remotamente** | W11 infra PASS, mas nenhum fluxo W12 ponta a ponta no serviço privado foi executado |
| (c) Preparação de produção | **NO-GO** | Backup/restauração, observabilidade, latência de pico, contingência e aceite institucional ainda não evidenciados |
| (d) Piloto clínico com pacientes reais | **NO-GO** | Falta autorização institucional e validação clínica/privacidade; esta missão proíbe dados reais |

**Mudanças externas realizadas pelo W12: nenhuma.** Sem IAM, deploy, Rules, faturamento, alteração da main, dados clínicos ou sistemas do EMPROVEX. Evidência e próxima decisão permanecem nesta PR Draft, sem criar W13.
