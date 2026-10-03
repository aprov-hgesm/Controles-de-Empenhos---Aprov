# EMPROVEX SaaS R1 — SAAS-P — Piloto Comercial Controlado

Data de abertura: **2026-10-02**

Branch coordenadora: `feat/saas-r1-commercializacao`

Estado: **EM EXECUÇÃO REAL / P2 CONCLUÍDA / PILOT-A+B+C+D RECEBIDAS / P-01+P-02 CONFIRMADOS / T0 TÉCNICO PASS / T0 NUMÉRICO PENDENTE / SAAS-J AGUARDANDO**

Este documento é a matriz operacional da SAAS-P. Ele complementa, sem substituir, o Memorial Oficial, o Plano Mestre, o Integration Status e o Handoff do Coordenador.

## 1. Snapshot auditado de partida

### SaaS

- integradora SaaS: `f8fc2b60ef67f882c3f2c36099b372f16792ee11`;
- commit atual: `docs: track SaaS-Mobile parallel development`;
- produção / `main`: `e90f92acae1514ee5cbc6ce95fed354bc1454330`;
- PR SAAS-I #219: **MERGED**;
- HEAD final SAAS-I: `78d3e9afeeb4176a8d6423cdd8e65d32435ba0a9`;
- squash SAAS-I na integradora: `25dda4876fedabb498ad30139262b11943412273`;
- Application CI no HEAD SAAS-I: **SUCCESS**;
- EMPROVEX Core Protection: **SUCCESS**;
- Recovery guardrails: **SUCCESS**;
- SAAS-DL Legal Validation: **SUCCESS**;
- SAAS-C Browser Validation: **SKIPPED por escopo**, conforme política oficial;
- Vercel no HEAD SAAS-I: **SUCCESS**.

Permanece não executado em produção:
- merge SaaS R1 em `main`;
- deploy/promote da aplicação SaaS R1 em produção;
- publicação das Rules novas da R1;
- migração VIP legado;
- configuração externa completa de backup/restore/uptime.

### MOBILE-R1

Snapshot apenas para coordenação cruzada; o programa Mobile continua sob seu próprio Coordenador.

- integradora Mobile: `feat/central-mobile-r1@2d3d82d0fc1b0686f326de355fe842dbcc6bd714`;
- baseline funcional Mobile: SAAS-I `78d3e9afe...`;
- freeze da Onda 1: `53e28b81874ee1b7ce0bd484cc7a97537aa99473`;
- integradora Mobile ainda contém apenas deltas documentais desde o baseline funcional;
- MOBILE-A: branch `mobile-r1-a-platform-scanner@86aa9962...`, PR #221 draft;
- MOBILE-B: branch `mobile-r1-b-location-labels@7e6e6750...`, PR #220 draft;
- Core Protection e Recovery estavam verdes nos dois PRs no snapshot;
- Application CI e Legal Validation estavam em andamento no snapshot;
- nenhum dos dois workers foi integrado à integradora Mobile no momento desta auditoria.

Conclusão de sincronização inicial:
- **não existe conflito funcional integrado SaaS ↔ Mobile neste momento**;
- a história Git é deliberadamente divergente;
- qualquer correção SaaS transversal futura deve consultar o estado vivo do Mobile e declarar **Impacto MOBILE-R1**;
- não fazer merge/rebase bruto entre as integradoras.

## 2. Objetivo da SAAS-P

Provar, com evidência real e auditável, que o EMPROVEX funciona como SaaS comercial assistido e reversível antes da SAAS-J.

Critérios mínimos:
- 3 a 5 workspaces externos assistidos;
- pelo menos 3 onboardings reais completos;
- pelo menos 1 cliente efetivamente pago;
- pelo menos 1 workspace novo, posterior ao corte de 2026-10-02 e não isento, para validar trial/preço/pagamento;
- registro de dúvidas, falhas, custos, incidentes e correções;
- operação/backup/restore/uptime com evidência suficiente para a certificação final.

VIP legado pode validar fluxo funcional, legal, lifecycle, Central e operação, mas **não comprova cobrança**.

## 3. Participantes — slots do piloto

Não inventar nomes ou workspaces. Preencher somente com participantes reais.

| Slot | Workspace | Classificação | Objetivo principal | Estado |
|---|---|---|---|---|
| P-01 | `aprovisionamento-3-gac-ap` | VIP legado / usuário externo real ativo | acesso/legal/Central em modo não disruptivo | **CONFIRMADO** |
| P-02 | `aprovisionamento-2-b-fv` | VIP legado / usuário externo real em adoção | jornada operacional não disruptiva | **CONFIRMADO** |
| P-03 | A definir | novo não isento | trial → pagamento/regularização | NÃO SELECIONADO |
| P-04 | A definir | opcional | ampliar amostra | NÃO SELECIONADO |
| P-05 | A definir | opcional | ampliar amostra | NÃO SELECIONADO |

Classificações permitidas:
- **VIP legado**: coorte existente em 2026-10-02, `exempt/legacy_vip`;
- **VIP manual**: isenção administrativa explícita, `exempt/manual`;
- **pagante/trial**: novo workspace comercial não isento.

## 3.1 Decisão operacional — P-01/P-02 protegidos e ambiente disruptivo separado

Participantes reais confirmados:

### P-01
- workspace: `aprovisionamento-3-gac-ap`;
- classificação: VIP legado;
- perfil: **usuário externo real, ativo e necessário às operações do setor**.

### P-02
- workspace: `aprovisionamento-2-b-fv`;
- classificação: VIP legado;
- perfil: **usuário externo real que está iniciando o uso operacional do EMPROVEX**.

Regra obrigatória para todo o restante da SAAS-P:

- P-01 e P-02 **não podem ficar sem acesso por consequência de teste**;
- não usar P-01/P-02 para suspensão, revogação de sessão, bloqueio operacional ou qualquer exercício J15–J20;
- não forçar reset/troca de senha apenas para gerar evidência;
- não apagar/recriar aceite legal;
- não alterar billing, status, workspace, UG, UID, Rules ou permissões para fabricar cenário;
- validações em P-01/P-02 devem priorizar observação do uso normal, shell, Central, isolamento, condição VIP e fluxos naturalmente utilizados pelos operadores;
- qualquer teste com risco de indisponibilidade deve ser deslocado para `aprovisionamento-teste` ou, quando aplicável, P-03 em cenário controlado e autorizado.

### Ambiente oficial para testes disruptivos

`aprovisionamento-teste` é o workspace oficial preferencial para testes de:
- suspensão;
- revogação de sessão;
- bloqueio operacional;
- reativação;
- retorno aos dados;
- reset/troca de senha quando o objetivo for apenas testar o fluxo;
- cenários de lifecycle que possam causar indisponibilidade temporária.

Mesmo nesse workspace, qualquer operação produtiva destrutiva ou irreversível continua exigindo autorização aplicável.

Se surgir qualquer risco real de interrupção em P-01/P-02, a jornada deve ser interrompida e devolvida ao Coordenador.

## 4. P0 — Auditoria de partida

Estado: **CONCLUÍDA em 2026-10-02**, com ressalva de que estados de branches/CI Mobile são vivos e devem ser reconsultados antes de qualquer integração transversal.

Confirmado:
- HEAD real da integradora SaaS;
- HEAD real de `main`;
- PR #219 mergeado;
- gates finais da SAAS-I;
- documentos canônicos SaaS;
- estado atual da integradora Mobile;
- existência e andamento de MOBILE-A/MOBILE-B;
- ausência de delta funcional já integrado no Mobile após o baseline SAAS-I.

Inconsistência observada:
- o Integration Status Mobile ainda registrava A/B como “aguardando worker”, apesar de os dois workers já possuírem branches avançadas e PRs draft.
- O Coordenador SAAS-P **não altera a documentação Mobile** para evitar interferência entre programas; o estado real foi registrado aqui e deve ser reconciliado pelo Coordenador Mobile.

## 5. P1 — Plano operacional do piloto

### 5.1 Pré-piloto

1. selecionar 3–5 workspaces reais;
2. classificar cada um;
3. obter inventário autenticado da coorte VIP legado;
4. revisar e congelar a allowlist VIP;
5. auditar backup/recovery/uptime;
6. decidir a janela controlada de publicação necessária para o piloto;
7. somente com autorização explícita, executar alterações produtivas indispensáveis;
8. registrar baseline de custos e leituras antes do primeiro participante.

### 5.2 Jornada assistida por participante

Para cada workspace:
1. registrar condição inicial;
2. registrar responsável/operador;
3. executar onboarding aplicável;
4. primeiro login;
5. credenciais/reset/troca de senha quando aplicável;
6. aceite vigente de Termos/Privacidade;
7. acesso ao EMPROVEX;
8. acesso à Central;
9. executar jornada comercial compatível com a classificação;
10. registrar leituras/custos/erros relevantes;
11. registrar dúvidas e atritos de UX;
12. classificar qualquer falha;
13. abrir correção curta se necessária;
14. revalidar após correção.

### 5.3 Pagante/trial

O participante P-03 deve ser workspace real novo e não isento.

Validar:
- preço comercial R$ 70/mês;
- trial de 30 dias;
- ausência de suspensão automática por simples término do trial;
- pagamento externo simples;
- confirmação administrativa;
- regularização;
- suspensão manual apenas em teste seguro/autorizado;
- revogação de sessão;
- reativação sem recriar tenant/dados.

Não adulterar datas de trial/billing em produção para acelerar o piloto.

## 6. P2 — Coorte VIP legado

Fluxo obrigatório:

1. `status`;
2. inventário autenticado;
3. revisão humana;
4. congelamento da allowlist;
5. `dry-run`;
6. plano de execução;
7. somente com autorização explícita: `apply`;
8. `verify`.

Comandos previstos pelo handoff SAAS-I:

```bash
npm run saas:r1:legacy-vip -- plan
npm run saas:r1:legacy-vip -- status
npm run saas:r1:legacy-vip -- dry-run --workspaces=<COORTE_CONGELADA>
```

O comando `apply` permanece **PROIBIDO nesta etapa sem autorização explícita do usuário**.

A quantidade de workspaces VIP legado deve vir do Firestore autenticado. Não inferir quantidade do repositório.

## 7. P3 — Operação, backup e recuperação

### Código já pronto no repositório

- `/api/health` sem leitura de Firestore;
- tooling de recovery dos dois bancos;
- proteção contra restore em banco produtivo;
- suporte a PITR/delete protection;
- schedule de backup diário;
- verificação de backup `READY`;
- restore-plan para banco isolado;
- runbook de uptime Cloud Monitoring;
- testes de arquitetura/health/recovery.

### Configuração externa ainda pendente

- PITR nos dois bancos;
- delete protection nos dois bancos;
- backup diário no banco principal;
- backup diário no `emprovex-warehouse`;
- pelo menos um backup `READY` por banco;
- restore real em banco isolado;
- publicação autorizada de `/api/health`;
- uptime HTTPS real;
- alert policy;
- notification channel funcional.

### Evidência mínima

Executar, em ambiente autenticado quando autorizado:

```bash
npm run recovery:plan
npm run recovery:status
npm run recovery:verify
```

Para comandos `gcloud` de ativação/restore, seguir literalmente:
- `docs/RECUPERACAO_FIRESTORE.md`;
- `docs/SAAS_R1_UPTIME_MONITORING.md`.

Nenhum restore deve apontar para banco produtivo.

## 8. P4 — Matriz viva de evidências

### 8.1 Regra de integridade da matriz

A matriz registra **estado observado**, não expectativa. Evidência técnica pode deixar uma jornada `PREPARADO` ou sustentar pré-requisitos, mas **não transforma automaticamente jornada humana/comercial em `PASS`**.

Status permitidos: `NÃO INICIADO`, `PREPARADO`, `EM EXECUÇÃO`, `PASS`, `FAIL`, `BLOQUEADO`, `N/A`.

Responsabilidade:
- PILOT-A/B/C produzem seus próprios handoffs e evidências;
- PILOT-D consolida estrutura, proveniência, custo, incidentes e lacunas;
- o Coordenador integra semanticamente os resultados;
- nenhum `PASS` é inferido apenas porque código, CI ou infraestrutura está verde.

### 8.2 Matriz auditável J01–J24 — baseline PILOT-D de 2026-10-02

| ID | Jornada | Owner | Participante/workspace | Condição inicial | Pré-requisitos | Esperado | Observado | Evidência | Data | Status | Correção | Impacto MOBILE-R1 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| J01 | onboarding novo workspace | PILOT-B | P-03 — a selecionar | workspace novo | P-03 real; publicação controlada; provisionamento autorizado | provisionado corretamente | roteiro e rollback auditados pela PILOT-B; participante real ainda não selecionado/executado | handoff PILOT-B integrado semanticamente + SAAS-C | 2026-10-02 | PREPARADO | — | Auth/workspace/UG |
| J02 | primeiro login | PILOT-A/B | P-01=`aprovisionamento-3-gac-ap`; P-02=`aprovisionamento-2-b-fv`; P-03 pendente | credencial válida | participante real; ambiente autorizado e app/Rules compatíveis | acesso controlado | P-01/P-02 confirmados como usuários externos reais; validação deve ocorrer sem interromper a operação | handoff PILOT-A + decisão coordenadora + SAAS-I/SAAS-C | 2026-10-02 | PREPARADO | — | Auth/sessão/workspace/shell |
| J03 | reset de senha | PILOT-A/B | externo aplicável | conta existente | conta real e e-mail válido | reset funcional | fluxo certificado; **não forçar reset em P-01/P-02**; executar somente por necessidade real do usuário ou em `aprovisionamento-teste`/cenário controlado | SAAS-C integrada + decisão coordenadora | 2026-10-02 | PREPARADO | — | Auth |
| J04 | troca de senha | PILOT-A/B | externo aplicável | sessão válida | login real; reautenticação | troca funcional | capacidade certificada; **não exigir troca de senha de P-01/P-02 apenas para gerar evidência**; usar `aprovisionamento-teste` se a finalidade for testar o fluxo | SAAS-C integrada + decisão coordenadora | 2026-10-02 | PREPARADO | — | Auth/sessão |
| J05 | aceite legal | PILOT-A/B | participante aplicável | versão vigente não aceita | LegalAcceptanceGate + ambiente autorizado | gate exige aceite | em P-01/P-02, observar apenas o estado natural; **não apagar/recriar aceite para fabricar cenário** | handoff PILOT-A + SAAS-DL/SAAS-I + decisão coordenadora | 2026-10-02 | PREPARADO | — | legal gate/shell/Auth |
| J06 | acesso normal EMPROVEX | PILOT-A/B | participante aplicável | aceite vigente | candidato SaaS em ambiente autorizado | shell operacional | candidato integrado verde; jornada humana ainda não executada; produção segue Performance R3 | handoff PILOT-A + `main` confirmado na Performance R3 | 2026-10-02 | PREPARADO | — | shell/sessão/workspace |
| J07 | acesso à Central | PILOT-A/B | participante com permissão | autorização válida | workspace/UG + `warehouseAccess` válidos | Central disponível | contratos certificados; sem execução de piloto anexada | SAAS-DS/SAAS-I + segurança; Mobile separada | 2026-10-02 | PREPARADO | — | Central/Rules/workspace |
| J08 | VIP legado | PILOT-A | P-01=`aprovisionamento-3-gac-ap`; P-02=`aprovisionamento-2-b-fv`; `aprovisionamento-teste` | `legacy_vip` | materialização produtiva da isenção | VIP legado/R$0 materializado | 3/3 READY com `exempt/legacy_vip`, R$0; P-01/P-02 formalmente vinculados; este PASS não substitui J02/J05/J06/J07 humanos | handoff PILOT-A + P2 apply/verify + decisão coordenadora | 2026-10-02 | PASS | — | Auth/workspace; sem delta Mobile |
| J09 | VIP manual | PILOT-A | não selecionado | `exempt/manual` | participante real isento, se houver | acesso completo/R$0 | não pertence à coorte desta frente e não há participante manual no piloto atual | handoff PILOT-A | 2026-10-02 | N/A | — | Auth/workspace |
| J10 | novo workspace com trial | PILOT-B | P-03 | novo não isento | P-03 real; onboarding; release autorizada | trial 30 dias | contrato R$70/30 dias auditado e roteiro P-03 preparado; nenhum P-03 real criado | handoff PILOT-B + SAAS-B/C/I | 2026-10-02 | PREPARADO | — | workspace/Auth |
| J11 | estado comercial do trial | PILOT-B | P-03 | trial válido/expirado | J10 + estado legítimo | sem suspensão automática | regra implementada e roteiro preparado; nenhuma observação real de participante | handoff PILOT-B + SAAS-B | 2026-10-02 | PREPARADO | — | lifecycle |
| J12 | pagamento externo | PILOT-B | P-03 | cobrança pendente | cliente real; cobrança externa real | pagamento real | nenhum pagamento real do piloto registrado | contrato R$70/mês; evidência humana pendente | 2026-10-02 | BLOQUEADO | — | não Mobile |
| J13 | confirmação administrativa | PILOT-B | P-03 | pagamento realizado | J12 comprovada; founder/admin | status confirmado | nenhuma confirmação do piloto | SAAS-B | 2026-10-02 | BLOQUEADO | — | não Mobile |
| J14 | regularização | PILOT-B | P-03 | atenção comercial | J12/J13; superfície pública | regularizado | nenhum caso real do piloto | SAAS-B/DS | 2026-10-02 | BLOQUEADO | — | lifecycle |
| J15 | suspensão manual | PILOT-B/Coord. | `aprovisionamento-teste` ou P-03/cenário seguro; **P-01/P-02 proibidos** | workspace ativo/pending | autorização explícita | suspenso sem apagar dados | enforcement certificado; P-01/P-02 não podem ser suspensos porque são usuários reais operacionais | SAAS-DS + decisão coordenadora | 2026-10-02 | BLOQUEADO | — | lifecycle/Rules/warehouseAccess |
| J16 | revogação de sessão | PILOT-A/B/Coord. | preferencialmente `aprovisionamento-teste`; **excluir P-01/P-02** | sessão ativa | sessão real; autorização de cenário | sessão/leases invalidados | contratos certificados; P-01/P-02 não podem ser usados porque dependem do acesso contínuo para operação real | handoff PILOT-A + PILOT-B + SAAS-DS + decisão coordenadora | 2026-10-02 | PREPARADO | — | sessão/lease |
| J17 | bloqueio operacional | PILOT-B | `aprovisionamento-teste` ou mesmo cenário seguro de J15 | suspenso | J15/J16; app/Rules da release | áreas privadas bloqueadas | não executado; P-01/P-02 excluídos | SAAS-DS/I | 2026-10-02 | BLOQUEADO | — | Auth/Rules/Central |
| J18 | páginas públicas durante suspensão | PILOT-B | mesmo de J15 | suspenso | J15; rotas públicas preservadas | páginas públicas acessíveis | contrato e roteiro estruturalmente preparados; evidência live durante suspensão ainda pendente | handoff PILOT-B + SAAS-B/DL/I | 2026-10-02 | PREPARADO | — | shell/roteamento |
| J19 | reativação | PILOT-B/Coord. | `aprovisionamento-teste` ou mesmo cenário seguro de J15 | suspenso | exercício de suspensão concluído | acesso restaurado | não executado; P-01/P-02 excluídos | SAAS-DS | 2026-10-02 | BLOQUEADO | — | lifecycle/workspace |
| J20 | retorno aos dados | PILOT-B | `aprovisionamento-teste` ou mesmo cenário seguro de J15 | reativado | J19; dados preservados | tenant/dados intactos | não executado; P-01/P-02 excluídos | contrato proíbe deleção; evidência humana pendente | 2026-10-02 | BLOQUEADO | — | Central/contrato de dados |
| J21 | isolamento entre workspaces | Coord. + A/B | dois tenants nos testes certificados | dois tenants | identidades/workspaces distintos | zero vazamento cross-tenant | evidência automatizada específica aceita: Browser SAAS-C 3/3 + Emulator multi-tenant + Central external security | handoff PILOT-A aceito pelo Coordenador | 2026-10-02 | PASS | — | Rules/workspace/Central; spot-check real ainda desejável |
| J22 | custos/leituras | PILOT-D | plataforma + cada participante | baseline conhecido | T0 + T1/T2 por jornada | custo/consumo registrado | gate técnico T0 6/6 READY; T0 global e por UG capturados; custo monetário Google Cloud Billing ainda pendente | execução local + snapshots Painel de Consumo 2026-10-02 + Monitoring/UG telemetry | 2026-10-02 | PREPARADO | — | warehouse medido separadamente |
| J23 | health/uptime | PILOT-C | plataforma | release autorizada | deploy health + uptime + alerta + canal | health/alerta funcionais | PILOT-C confirmou PR #223 draft/mergeable com CI/Core/Recovery verdes; endpoint ainda não está em produção; uptime/alert/channel não criados | handoff PILOT-C + PR #223 + runbook uptime | 2026-10-02 | PREPARADO | — | infra comum |
| J24 | backup/recuperação | PILOT-C | plataforma | proteções/schedules ativos | backup READY em ambos + restore isolado | restore validado | PILOT-C confirmou PITR/delete protection/backup diário 14 semanas ativos; último estado conhecido segue 0 backups READY; restore não executado | handoff PILOT-C + P3 + recovery runbook | 2026-10-02 | EM EXECUÇÃO | — | warehouse compartilhado, sem delta funcional |

### 8.2.1 Reconciliação coordenadora após recebimento de PILOT-A e PILOT-B

O baseline original da PILOT-D foi produzido antes do fechamento coordenado da PILOT-B. Após integrar as evidências aceitas de A e B, a fotografia corrente da matriz passa a ser:

- **PASS: 2** — J08 e J21;
- **PREPARADO: 13** — J01, J02, J03, J04, J05, J06, J07, J10, J11, J16, J18, J22 e J23;
- **BLOQUEADO: 7** — J12, J13, J14, J15, J17, J19 e J20;
- **EM EXECUÇÃO: 1** — J24;
- **N/A: 1** — J09;
- **FAIL: 0**.

Essa reconciliação não promove nenhuma jornada para PASS sem evidência real. Ela apenas diferencia corretamente o que já possui roteiro/contrato/evidência estrutural suficiente para estar PREPARADO do que continua materialmente BLOQUEADO por pagamento, suspensão ou reativação reais.

### 8.3 Auditoria de dependências

- **Exigem participante/humano:** J01–J20. J12 exige pagamento real; J13 confirmação administrativa real; J15 exige autorização explícita para exercício seguro. J16 está preparado, mas sua execução real depende de sessão/cenário autorizado.
- **Exigem publicação produtiva/coerente para o PASS produtivo/comercial:** J01, J10–J20 e J23. J02/J05/J06/J07 estão preparados por evidência técnica/roteiro, mas a jornada humana ainda exige ambiente autorizado e participante real.
- **Dependem diretamente de P-03 não isento:** J10–J20 e, para comprovar onboarding comercial completo, J01–J07 quando executados sobre P-03.
- **Dependem de backup/restore:** J24 e o gate de SAAS-J. Configuração não equivale a backup `READY`; backup `READY` não equivale a restore comprovado.
- **Dependem da publicação de health:** J23. PR verde/draft não é evidência de uptime produtivo.
- **Evidência técnica aceita com escopo explícito:** J08 = PASS apenas para materialização VIP legado/R$0; J21 = PASS por isolamento automatizado específico. J03/J04/J07/J23/J24 continuam sem promoção automática.
- **Risco de sincronização Mobile:** J02, J05–J07 e J15–J21 por tocarem Auth, sessão, workspace/UG, legal gate, lifecycle, Rules, shell ou Central.

### 8.4 Baseline reproduzível de custos, leituras e observabilidade

PILOT-D não cria listener novo para medir consumo. O baseline usa fontes já certificadas e leituras administrativas sob demanda.

| Fonte | Natureza | Escopo | Uso no piloto | Limitação |
|---|---|---|---|---|
| Cloud Monitoring / `google-cloud-monitoring` | real operacional | banco Firestore configurado no painel global | snapshot T0/T1/T2 de Read Units, realtime Read Units, writes, reads, deletes, conexões/listeners | não é fatura monetária; painel interno não agrega automaticamente os dois bancos |
| `emprovex-workspace-estimate` | estimativa EMPROVEX | workspace/UG | atualização pontual no painel founder; comparar evolução da própria estimativa | não é cobrança oficial; flush de baixa frequência pode atrasar o último intervalo |
| Google Cloud Billing | cobrança oficial | projeto/serviços | custo diário/serviço antes, durante e após o piloto | não atribui oficialmente custo monetário por UG |
| Firestore/Monitoring do `emprovex-warehouse` | real operacional | Central | acompanhar separadamente no Console/Monitoring/Billing | sem agregação multi-database certificada no painel interno |
| Billing de backup/PITR/restore | cobrança oficial | recovery | registrar armazenamento/restore observados | custo depende do volume real e preços vigentes |

Contratos já certificados para a coleta:
- telemetria por UG usa buffer local, flush inicial de 60 s e periódico de 15 min;
- a telemetria por UG não abre listener próprio e não lê previamente o próprio contador;
- o painel por UG usa GET pontual, sem listener global;
- a fonte global real é Cloud Monitoring server-side;
- valores por UG e globais não são tratados como equivalentes;
- o dia de faturamento Firestore usado pelo código segue `America/Los_Angeles`; o registro manual mantém também a data/hora local;
- o `emprovex-warehouse` deve ser observado separadamente até existir agregação certificada.

Janela mínima de captura:
1. **T0 — antes:** timestamp, workspace/UG, fonte, banco, métrica e valor sem abrir superfícies desnecessárias.
2. **T1 — durante:** início/fim e operações relevantes; não atualizar painel repetidamente apenas para obter granularidade.
3. **T2 — depois:** capturar pelas mesmas fontes quando o dado já estiver consolidado; se ainda estiver na janela de flush, registrar a limitação em vez de forçar escritas.
4. Comparar T2 − T0 apenas dentro da mesma fonte/unidade.
5. Para custo monetário, usar Billing; não converter estimativa por UG em fatura por cliente.

Campos mínimos: timestamp local; billing day; Jxx; workspace/UG; fonte; banco; métrica/unidade; T0; T2; delta; limitação de flush/latência; incidente associado.

Guards de arquitetura que podem ser reexecutados sem criar telemetria nova:

```bash
npm run verify:block-16-3-workspace-telemetry
npm run verify:block-16-4-global-monitoring
npm run verify:block-16-5-consolidated-usage
npm run verify:block-16-6-usage-alerts
npm run verify:block-17-6-telemetry-fidelity
npm run verify:block-17-8-consumption-regression
```

Esses guards validam a arquitetura; **não substituem os números reais do piloto**.

### 8.5 Modelo mínimo de evidência por execução

Não registrar senha, token, chave, cookie, segredo ou dado pessoal desnecessário.

```text
ID: Jxx
Data/hora local:
Workspace/UG:
Operador: [quando apropriado; mínimo necessário]
Owner:
Estado inicial:
Pré-requisitos confirmados:
Passos executados:
Resultado esperado:
Resultado observado:
Evidência técnica: [commit/PR/run/test/log sanitizado]
Evidência manual: [sim/não + descrição objetiva]
Consumo relevante: [fonte, banco, T0/T2/delta ou não aplicável]
Incidente: [ID ou nenhum]
Impacto MOBILE-R1: [nenhum / domínio compartilhado + detalhe]
Status final: [NÃO INICIADO|PREPARADO|EM EXECUÇÃO|PASS|FAIL|BLOQUEADO|N/A]
Correção/reteste:
```

Regras: uma execução = um registro; não duplicar teste para aumentar evidência; evidência antiga preserva data; `PASS` exige observado compatível com esperado; ausência de evidência permanece ausência; CI verde prova somente o contrato coberto.

### 8.6 Incidentes e lacunas PILOT-D

| ID | Classe | Origem/reprodução | Impacto | Severidade | Bloqueia? | Owner recomendado | Impacto MOBILE-R1 | Estado |
|---|---|---|---|---|---|---|---|---|
| INC-D-001 | PILOT-OPS | `gcloud.cmd` incompatível com tooling Node no Windows durante P3 | atrapalhava recovery no Windows | média | não, após correção | PILOT-C/Coordenador | nenhum funcional | RESOLVIDO via PR #222 / squash `ea2d389f...` |
| INC-D-002 | PILOT-OPS | Vercel `build-rate-limit` em previews | impede preview novo, sem demonstrar regressão de código | baixa | não para PILOT-D | Coordenador/infra | capacidade de preview compartilhada | ABERTO / externo |
| INC-D-003 | PILOT-OPS | snapshot Mobile inicial ficou desatualizado enquanto MOBILE-R1 avançou | risco de decisão com status antigo/delta compartilhado perdido | média | sim para SAAS-J se não reconciliado | Coordenadores SaaS + Mobile | alto em governança | ABERTO até reconciliação final |

Lacunas, não incidentes: P-03 real ainda sem evidência; handoffs PILOT-A e PILOT-B já foram recebidos, mas as execuções humanas/comerciais J01–J20 continuam pendentes; backup `READY` e restore isolado pendentes no último estado; health/uptime/alert/channel pendentes; baseline numérico T0/T1/T2 ainda não capturado.

### 8.7 Reconciliação com MOBILE-R1 — estado vivo consultado em 2026-10-02

O snapshot conhecido no início desta frente foi superado durante a onda.

- MOBILE-B: PR #220 **MERGED**, squash `5edb19812...`;
- MOBILE-A: PR #221 **MERGED**, squash `19fc6be4...`, com pendência de validação runtime/física;
- Integração 1 A+B: PR #224 **MERGED**, squash `7c987676...`, gate scanner → EPX1 → resolver → posição certificado;
- MOBILE-C/D/E: liberadas para Onda 2;
- nenhuma alteração MOBILE-R1 chegou à `main`;
- produção `main` continua exatamente em `e90f92acae1514ee5cbc6ce95fed354bc1454330`.

Deltas compartilhados relevantes observados na integradora Mobile incluem `next.config.ts`, `features/warehouse/components/WarehouseProtectedSurface.tsx`, contratos fail-closed de workspace/UG, metadata de dependências do scanner e novas superfícies/resolver móveis.

PILOT-D **não declara conflito funcional** apenas por esses deltas. Antes de SAAS-J, o Coordenador deve comparar semanticamente as integradoras nos pontos compartilhados.

### 8.8 Checklist objetivo de gate para SAAS-J

A checklist está **preparada**; a liberação de SAAS-J **não é concedida por PILOT-D**.

- [ ] matriz J01–J24 aplicável preenchida com proveniência e data;
- [ ] no mínimo 3 onboardings reais completos;
- [ ] pelo menos 1 cliente real pago, novo e não legado;
- [ ] trial → pagamento → confirmação → regularização comprovados;
- [ ] suspensão → revogação/bloqueio → reativação → retorno aos dados exercitados com segurança/autorização;
- [ ] incidentes classificados, com owner e decisão explícita de bloqueio;
- [ ] correções necessárias integradas e revalidadas;
- [ ] baseline T0/T1/T2 de custo/leituras registrado;
- [ ] custo monetário real consultado no Google Cloud Billing, sem atribuição fictícia por UG;
- [ ] uso/custo do `emprovex-warehouse` observado separadamente;
- [ ] backup `READY` nos dois bancos;
- [ ] restore real em banco isolado comprovado;
- [ ] `/api/health` publicado na release autorizada;
- [ ] uptime check HTTPS + alert policy + notification channel testados;
- [ ] isolamento multi-tenant revalidado e sem evidência cross-tenant no piloto;
- [ ] estado vivo MOBILE-R1 reconsultado e deltas compartilhados reconciliados;
- [ ] pendências remanescentes resolvidas ou aceitas explicitamente.

**Estado neste baseline PILOT-D:** checklist estruturada; evidências ainda incompletas; **SAAS-J não deve ser declarada liberada por esta worker**.

## 9. P5 — Correções durante o piloto

Qualquer regressão deve ser classificada antes de editar.

Classes:
- `PILOT-UX`;
- `PILOT-AUTH`;
- `PILOT-LEGAL`;
- `PILOT-LIFECYCLE`;
- `PILOT-BILLING`;
- `PILOT-CENTRAL`;
- `PILOT-RULES`;
- `PILOT-OPS`.

Regra:
1. não corrigir improvisadamente na integradora;
2. abrir branch curta a partir do HEAD vigente;
3. gerar prompt especializado;
4. worker entrega handoff;
5. validar gates proporcionais;
6. registrar **Impacto MOBILE-R1** se transversal;
7. integrar semanticamente;
8. atualizar esta matriz.

Formato recomendado de branch:
`saas-p-fix-<dominio>-<slug>`.

## 10. Paralelismo permitido agora

Podem avançar em paralelo, sem publicação produtiva:
- P2: inventário/status VIP legado em modo leitura;
- P3: auditoria de configuração externa e preparação de evidências;
- seleção/recrutamento dos participantes;
- baseline de custos;
- preparação dos roteiros de teste e fichas de evidência;
- acompanhamento MOBILE-A/MOBILE-B para detectar eventual upstream transversal.

Não paralelizar de forma independente:
- alterações em Auth/legal/lifecycle/Rules/shell/Central;
- mudança de schema ou fonte de verdade compartilhada;
- qualquer publicação produtiva.

## 11. Ações que exigem usuário / Cloud Shell / produção

Exigem participação humana ou autorização explícita:
- inventário autenticado de Firestore se credencial não estiver disponível ao agente;
- aprovação da allowlist VIP legado;
- qualquer `apply` da migração;
- habilitar/alterar PITR/delete protection/backups;
- restore real isolado;
- criar notification channel;
- publicar Rules;
- promover/deployar aplicação em produção;
- selecionar cliente real e confirmar pagamento;
- executar suspensão em cliente real;
- decisão de janela controlada do piloto.

## 12. Gate para iniciar o piloto real

O repositório está tecnicamente apto para preparar o piloto, mas a jornada real completa ainda depende de ambiente compatível.

Como a SaaS R1 não está em `main`, as Rules novas não foram publicadas e a migração VIP não foi executada, não se deve apontar clientes reais para uma combinação parcial de app/Rules.

Antes do primeiro piloto real:
1. concluir P2/P3 em modo seguro;
2. selecionar participantes;
3. definir a janela controlada de publicação necessária;
4. obter autorização explícita para as mudanças produtivas indispensáveis;
5. executar smoke pós-publicação;
6. iniciar participantes de forma assistida.

## 13. Critério de encerramento

SAAS-P somente pode ser marcada **CONCLUÍDA** quando houver:
- matriz J01–J24 preenchida com evidências aplicáveis;
- no mínimo 3 onboardings reais;
- pelo menos 1 cliente real pago não legado;
- problemas classificados;
- correções necessárias integradas e validadas;
- custos registrados;
- backup/restore/uptime comprovados;
- sincronização SaaS ↔ Mobile verificada;
- pendências explicitamente aceitas ou resolvidas.

Somente então liberar **SAAS-J — Certificação Final**.

## 14. Evidência operacional P2/P3 — 2026-10-02

### 14.1 P2 — inventário VIP legado e allowlist congelada

Execução real em Windows/PowerShell, autenticada no projeto `gen-lang-client-0982077967`:

- `npm run saas:r1:legacy-vip -- status`: **PASS**;
- candidatos automáticos: **3**;
- não resolvidos automaticamente: **0**;
- fundador excluído: `hgesm-aprov`.

Allowlist VIP legado aprovada humanamente e congelada para a próxima etapa:

- `aprovisionamento-2-b-fv`;
- `aprovisionamento-3-gac-ap`;
- `aprovisionamento-teste`.

Decisão explícita sobre `aprovisionamento-teste`:

- permanece **VIP legado permanente**;
- continuará sendo o perfil real de teste funcional de um usuário externo;
- um futuro perfil de teste **não-VIP** poderá ser criado posteriormente para validar trial, cobrança, pagamento, suspensão e regularização;
- esse novo perfil não-VIP **não será criado agora** e não altera a coorte legada congelada.

`apply` da migração VIP **NÃO EXECUTADO**. Próximo passo seguro de P2: `dry-run` com a allowlist acima.

### 14.2 P3 — estado real de recovery

Execução real:

- `npm run recovery:status`: **executado com sucesso**;
- certificação global: **ready = false**.

Banco operacional principal:

- PITR: **false**;
- delete protection: **false**;
- agenda diária de backup: **false**;
- backup READY: **false**;
- backups concluídos: **0**.

Banco `emprovex-warehouse`:

- PITR: **false**;
- delete protection: **true**;
- agenda diária de backup: **false**;
- backup READY: **false**;
- backups concluídos: **0**.

Nenhum controle produtivo foi alterado nesta auditoria.

### 14.3 Correção PILOT-OPS — Windows gcloud

Foi corrigida a incompatibilidade do launcher `gcloud.cmd` com os scripts Node no Windows:

- worker: `saas-p-fix-ops-windows-gcloud`;
- PR: **#222**;
- CI, Core Protection, Recovery e Legal: **SUCCESS**;
- Browser: **skipped por escopo**;
- validação Windows: **PASS**;
- squash integrado em `feat/saas-r1-commercializacao`: `ea2d389f726ae989ae88f7fc7359c690b23dfb13`;
- impacto MOBILE-R1: **nenhum delta funcional**.

O Vercel associado ao PR permaneceu limitado por build-rate-limit, sem evidência de regressão funcional dessa correção.

### 14.4 P2 — dry-run da allowlist congelada

Execução real em 2026-10-02:

`npm run saas:r1:legacy-vip -- dry-run --workspaces=aprovisionamento-2-b-fv,aprovisionamento-3-gac-ap,aprovisionamento-teste`

Resultado:

- candidatos automáticos: **3**;
- não resolvidos: **0**;
- founder `hgesm-aprov`: excluído;
- seleção DRY-RUN: **3/3 workspaces**;
- nenhuma escrita executada;
- coorte validada para eventual `apply` produtivo.

O `apply` permanece **BLOQUEADO** até autorização explícita do fundador.

### 14.5 P2 — aplicação produtiva e verificação final da coorte VIP legado

Execução autorizada em 2026-10-02 sobre a allowlist congelada:

- `aprovisionamento-2-b-fv`;
- `aprovisionamento-3-gac-ap`;
- `aprovisionamento-teste`.

Resultado do `apply`:

- `APPLIED aprovisionamento-2-b-fv: exempt / R$ 0,00 / legacy_vip`;
- `APPLIED aprovisionamento-3-gac-ap: exempt / R$ 0,00 / legacy_vip`;
- `APPLIED aprovisionamento-teste: exempt / R$ 0,00 / legacy_vip`.

Resultado do `verify`:

- `READY aprovisionamento-2-b-fv`;
- `READY aprovisionamento-3-gac-ap`;
- `READY aprovisionamento-teste`.

Conclusão P2:

- coorte VIP legado materializada com sucesso;
- 3/3 workspaces verificados;
- founder continua fora da coorte;
- P2 **CONCLUÍDA**;
- qualquer reexecução futura deve respeitar o comportamento idempotente já implementado.

### 14.6 P3 — controles produtivos de recovery aplicados

Em 2026-10-02, após autorização explícita, os controles nativos de recovery foram aplicados separadamente nos dois bancos.

Banco operacional principal:
- PITR: **true**;
- delete protection: **true**;
- agenda diária de backup: **true**;
- retenção: **14 semanas**;
- backup READY: **false**;
- backups concluídos: **0**.

Banco `emprovex-warehouse`:
- PITR: **true**;
- delete protection: **true**;
- agenda diária de backup: **true**;
- retenção: **14 semanas**;
- backup READY: **false**;
- backups concluídos: **0**.

Conclusão desta subetapa:
- configuração produtiva de proteção e agendamento: **CONCLUÍDA**;
- certificação final de recovery: **PENDENTE** somente de pelo menos um backup READY por banco e do restore real isolado;
- não repetir `apply` enquanto o estado permanecer coerente.

## 10.1 Topologia recomendada de chats para a próxima fase
Para a fase operacional do piloto, adotar no máximo **4 workers simultâneos + 1 Coordenador**:

| Frente | Propriedade | Pode avançar agora | Bloqueios principais |
|---|---|---|---|
| PILOT-A | participantes VIP + jornadas funcionais | sim | correção transversal volta ao Coordenador |
| PILOT-B | P-03 não-VIP + jornada comercial | preparação sim; execução produtiva depende de participante/autorização | não criar cliente fictício |
| PILOT-C | recovery + health + uptime | sim nas partes não bloqueadas | backup READY / publicação health / ações externas autorizadas |
| PILOT-D | custos + observabilidade + J01–J24 | sim | não alterar produto para fabricar evidência |
| Coordenador | integração, conflitos, Memorial, Mobile, gates | sempre ativo | não competir com workers |

### PILOT-A — Participantes e Jornadas VIP

Escopo:
- P-01/P-02 já formalizados; conduzir apenas jornadas não disruptivas e coletar evidências reais;
- conduzir jornadas VIP;
- produzir evidências de login, legal, shell, Central, sessão/permissões e condição isenta;
- atualizar o Coordenador via handoff.

### PILOT-B — Piloto Comercial Não-VIP

Escopo:
- preparar P-03;
- validar onboarding → trial → R$70 → pagamento externo → confirmação → regularização;
- validar suspensão/reativação apenas em cenário autorizado;
- preservar tenant e dados.

### PILOT-C — Operação/Recovery/Uptime

Escopo:
- backups READY;
- `recovery:verify`;
- restore isolado;
- PR #223/health;
- uptime/alerta/canal quando publicação for autorizada.

### PILOT-D — Custos/Evidências

Escopo:
- baseline de custos e leituras;
- consolidação J01–J24;
- incidentes/dúvidas;
- completude documental para SAAS-J.

### Regra de colisão

Auth, legal, lifecycle, billing compartilhado, Rules, shell, sessão, workspace/UG, `warehouseAccess` e contratos comuns com MOBILE-R1 **não são áreas de correção paralela livre**. Qualquer necessidade de alteração nessas áreas retorna ao Coordenador, que cria correção curta com proprietário único e reconciliação Mobile.

Estado atual: **topologia planejada; workers ainda não ativados**.
