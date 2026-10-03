# SAAS-P — Registro de Execução do Piloto

Este arquivo é um template de evidência operacional. Não registrar senha, token, cookie, chave, link de reset ou segredo.

## T0

Data/hora:
Billing day:

| Fonte | Database/escopo | Métrica | Unidade | Valor T0 | Observação |
|---|---|---|---|---:|---|
| Cloud Monitoring | principal | | | | |
| Cloud Monitoring | emprovex-warehouse | | | | |
| EMPROVEX | UG P-01 | estimativa | | | |
| EMPROVEX | UG P-02 | estimativa | | | |
| Google Cloud Billing | projeto | custo | moeda | | |

## P-01 — aprovisionamento-3-gac-ap

- Data/hora:
- Operador: usuário real / não registrar credencial
- Login natural observado:
- Workspace/UG:
- Aceite legal natural:
- Shell:
- Central:
- VIP/R$0:
- Isolamento:
- Incidente:
- Jxx atualizadas:
- Observação operacional:

## P-02 — aprovisionamento-2-b-fv

- Data/hora:
- Operador: usuário real / não registrar credencial
- Primeiro acesso natural:
- Workspace/UG:
- Aceite legal natural:
- Shell:
- Central:
- VIP/R$0:
- Isolamento:
- Dúvida/atrito:
- Incidente:
- Jxx atualizadas:

## Teste disruptivo — aprovisionamento-teste

- Autorização:
- Estado inicial:
- Amostra de dados antes:
- J15:
- J16:
- J17:
- J18:
- J19:
- J20:
- Amostra de dados depois:
- Resultado:
- Incidente:

## P-03 — não-VIP

- Participante:
- Workspace:
- UG:
- Data de criação:
- J01:
- J10:
- J11:
- J12 pagamento real:
- J13 confirmação:
- J14 regularização:
- Observações:

## Recovery

- Data/hora:
- Principal backup READY:
- Warehouse backup READY:
- recovery:verify:
- Backup escolhido:
- Restore target:
- Autorização:
- Restore:
- Validação:
- IAM/Rules/TTL:

## Health/Uptime

- Release:
- /api/health HTTP 200:
- status=ok:
- SSL:
- Uptime check:
- Alert policy:
- Notification channel:
- Teste do alerta:

## T1/T2

| Fonte | Database/escopo | T0 | T1 | T2 | Delta T2-T0 | Observação |
|---|---|---:|---:|---:|---:|---|
| | | | | | | |

## Fechamento

- Incidentes abertos:
- Incidentes resolvidos:
- Reconciliação MOBILE-R1:
- Matriz J01–J24:
- Gate SAAS-J:

## Evidência T0 — gate técnico de arquitetura — 2026-10-02

Worktree utilizado:
- `C:\Users\marco\Projetos\emprovex-saas-pilot`;
- snapshot: `f25089b8`;
- estado local: detached HEAD limpo;
- dependências instaladas via `npm ci`.

Resultado dos guards:

- `verify:block-16-3-workspace-telemetry`: **READY**;
- `verify:block-16-4-global-monitoring`: **READY**;
- `verify:block-16-5-consolidated-usage`: **READY**;
- `verify:block-17-6-telemetry-fidelity`: **READY**;
- `verify:block-17-8-consumption-regression`: **READY**;
- `verify:ug-telemetry-v2`: **READY**.

Contratos confirmados:
- consumo por UG = estimativa EMPROVEX;
- flush por leitura desativado;
- consolidação = buffer local + baixa frequência;
- painel fundador = GET pontual / sem listener global;
- métrica global real = Google Cloud Monitoring server-side;
- credenciais sensíveis no cliente = proibidas;
- estimativa por UG preservada e separada da medição global;
- nenhum Firestore adicional no painel consolidado;
- billing day = `America/Los_Angeles`;
- parcela não atribuída preservada;
- Read Units por UG = proxy / não faturamento oficial;
- listeners realtime administrativos adicionais = nenhum.

Classificação:
- **T0 técnico: PASS**;
- **T0 numérico: PENDENTE**;
- J22 permanece **PREPARADO**, pois os valores reais de Monitoring/Billing ainda não foram capturados.

Observação de instalação:
- `npm ci` reportou 22 advisories de dependência (4 moderate, 17 high, 1 critical);
- nenhum `npm audit fix` ou `--force` foi executado durante o piloto;
- esses advisories não foram investigados nesta etapa e não são convertidos automaticamente em falha funcional do T0.

## T0 numérico — estimativa por UG capturada — 2026-10-02

Fonte: **emprovex-workspace-estimate**  
Ação: uma única atualização manual do painel.

Totais atribuídos exibidos:
- reads atribuídos hoje: **111**;
- writes atribuídos hoje: **3**.

### P-01 — `aprovisionamento-3-gac-ap`
- UG exibida: **160409**;
- reads: **111**;
- writes: **3**;
- deletes: **0**;
- snapshots: **7**;
- carga pico listeners: **4**;
- flushes: **2**;
- última consolidação exibida: **02/10, 13:01**.

### P-02 — `aprovisionamento-2-b-fv`
- UG exibida: **160106**;
- reads: **0**;
- writes: **0**;
- deletes: **0**;
- snapshots: **0**;
- carga pico listeners: **0**;
- flushes: **0**;
- última consolidação: **sem consolidação**.

### `aprovisionamento-teste`
- UG exibida: **000000**;
- reads: **0**;
- writes: **0**;
- deletes: **0**;
- snapshots: **0**;
- carga pico listeners: **0**;
- flushes: **0**;
- última consolidação: **sem consolidação**.

Interpretação:
- a estimativa por UG é atribuição interna do EMPROVEX e não faturamento oficial;
- P-01 possui atividade atribuída no snapshot;
- P-02 e `aprovisionamento-teste` não possuíam consolidação atribuída no momento;
- nenhum refresh adicional é necessário para o T0.

Classificação:
- **T0 global numérico: CAPTURADO**;
- **T0 por UG: CAPTURADO**;
- Google Cloud Billing monetário: PENDENTE;
- J22 permanece PREPARADO até completar T0 monetário e posteriormente T1/T2.

## T0 monetário — Google Cloud Billing — 2026-10-02

Fonte: **Google Cloud Billing / Relatórios**.

Snapshot fornecido pelo fundador:
- custo atual exibido: **R$ 0,16**;
- economia exibida: **R$ 0,00**;
- custo total exibido: **R$ 0,16**;
- previsão mensal exibida: **R$ 2,30**;
- serviço listado com custo atual: **App Engine — R$ 0,16**;
- subtotal/total filtrado exibido: **R$ 0,16**.

Observação:
- o resumo da tela menciona Cloud Firestore Read Ops no comparativo de variação, mas a tabela corrente não apresenta cobrança positiva separada de Cloud Firestore;
- registrar somente o que a fonte oficial exibe, sem inferir tarifa não mostrada.

Classificação:
- **T0 monetário: CAPTURADO**;
- **T0 inicial: COMPLETO** (técnico + global + por UG + monetário);
- J22 permanece PREPARADO porque ainda faltam T1/T2 após as jornadas do piloto.

## Evidência funcional controlada — `aprovisionamento-teste` — login/shell

Captura humana recebida em 2026-10-02.

Observado:
- operador exibido: **Aprovisionamento Teste**;
- estado visual: **ACESSO AUTORIZADO**;
- Home carregada;
- shell/navegação principal disponível;
- menus visíveis: Início, Painel, Empenhos, Fornecedores, Consulta de Itens, Notas Fiscais, Central de Avisos, Relatórios, Cronogramas e Central de Depósitos;
- estado inferior: **Operacional / Ambiente seguro**;
- nenhuma tela de bloqueio legal/regularização interceptando esta sessão no momento.

Classificação:
- evidência funcional/controlada do workspace de teste: **PASS para login + shell**;
- não substitui evidência humana de P-01/P-02;
- não promove J05 (aceite legal) a PASS, pois não houve criação/renovação de aceite;
- próximo passo: validar acesso à Central de Depósitos.

## Correção de classificação — produção atual versus candidato SaaS R1

Conferência GitHub em 2026-10-02:
- `main`: `e90f92acae1514ee5cbc6ce95fed354bc1454330`;
- `feat/saas-r1-commercializacao`: `46fba355227e715c553484b2d65b7c52fcf30d39`;
- integradora SaaS: **117 commits à frente / 0 atrás da main**.

Consequência:
- o site produtivo atualmente utilizado deve ser tratado como **baseline pré-SaaS R1 / Performance R3**, salvo evidência de deploy manual de outra revisão;
- nenhum deploy do candidato SaaS R1 foi executado nesta rodada;
- as capturas T0 continuam válidas e passam a ser explicitamente o **baseline pré-release**;
- o smoke de `aprovisionamento-teste` comprova login/shell da produção atual, **não** o candidato SaaS R1 ainda não publicado;
- esse smoke não pode promover jornadas SaaS específicas a PASS.

Mudanças externas já aplicadas independentemente da Vercel, como materialização VIP e controles nativos de recovery, permanecem válidas em seus respectivos sistemas.
