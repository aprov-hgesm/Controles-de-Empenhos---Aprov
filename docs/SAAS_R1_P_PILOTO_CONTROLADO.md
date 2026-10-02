# EMPROVEX SaaS R1 — SAAS-P — Piloto Comercial Controlado

Data de abertura: **2026-10-02**

Branch coordenadora: `feat/saas-r1-commercializacao`

Estado: **EM PREPARAÇÃO / AUDITORIA P0 CONCLUÍDA / EVIDÊNCIAS REAIS AINDA PENDENTES**

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
| P-01 | A definir | VIP legado ou existente | onboarding/acesso/legal/Central | NÃO SELECIONADO |
| P-02 | A definir | VIP legado ou existente | jornada operacional e suporte | NÃO SELECIONADO |
| P-03 | A definir | novo não isento | trial → pagamento/regularização | NÃO SELECIONADO |
| P-04 | A definir | opcional | ampliar amostra | NÃO SELECIONADO |
| P-05 | A definir | opcional | ampliar amostra | NÃO SELECIONADO |

Classificações permitidas:
- **VIP legado**: coorte existente em 2026-10-02, `exempt/legacy_vip`;
- **VIP manual**: isenção administrativa explícita, `exempt/manual`;
- **pagante/trial**: novo workspace comercial não isento.

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

Status possíveis:
- `NÃO INICIADO`;
- `PREPARADO`;
- `EM EXECUÇÃO`;
- `PASS`;
- `FAIL`;
- `BLOQUEADO`;
- `N/A`.

| ID | Jornada | Workspace | Condição inicial | Resultado esperado | Observado | Evidência | Status | Correção | Impacto MOBILE-R1 |
|---|---|---|---|---|---|---|---|---|---|
| J01 | onboarding novo workspace | — | novo | provisionado corretamente | — | — | NÃO INICIADO | — | avaliar se transversal |
| J02 | primeiro login | — | credencial válida | acesso controlado | — | — | NÃO INICIADO | — | avaliar |
| J03 | reset de senha | — | conta existente | reset funcional | — | — | NÃO INICIADO | — | Auth se houver correção |
| J04 | troca de senha | — | sessão válida | troca funcional | — | — | NÃO INICIADO | — | Auth se houver correção |
| J05 | aceite legal | — | versão não aceita | gate exige aceite | — | — | NÃO INICIADO | — | Legal/shell se houver correção |
| J06 | acesso normal EMPROVEX | — | aceite vigente | shell operacional | — | — | NÃO INICIADO | — | shell se houver correção |
| J07 | acesso à Central | — | permissão válida | Central disponível | — | — | NÃO INICIADO | — | obrigatório se corrigir |
| J08 | VIP legado | — | legacy_vip | acesso completo/R$0 | — | — | NÃO INICIADO | — | avaliar |
| J09 | VIP manual | — | exempt/manual | acesso completo/R$0 | — | — | NÃO INICIADO | — | avaliar |
| J10 | novo workspace com trial | — | novo não isento | trial 30 dias | — | — | NÃO INICIADO | — | avaliar |
| J11 | estado comercial do trial | — | trial válido/expirado | sem suspensão automática | — | — | NÃO INICIADO | — | avaliar |
| J12 | pagamento externo | — | cobrança pendente | pagamento real externo | — | — | NÃO INICIADO | — | não Mobile |
| J13 | confirmação administrativa | — | pagamento realizado | status confirmado | — | — | NÃO INICIADO | — | não Mobile |
| J14 | regularização | — | atenção comercial | regularizado | — | — | NÃO INICIADO | — | lifecycle se corrigir |
| J15 | suspensão manual | — | cenário autorizado | conta/workspace suspensos | — | — | NÃO INICIADO | — | lifecycle/Rules |
| J16 | revogação de sessão | — | sessão ativa | sessão inválida | — | — | NÃO INICIADO | — | sessão/lease |
| J17 | bloqueio operacional | — | suspenso | áreas protegidas bloqueadas | — | — | NÃO INICIADO | — | obrigatório se corrigir |
| J18 | páginas públicas durante suspensão | — | suspenso | páginas públicas acessíveis | — | — | NÃO INICIADO | — | shell |
| J19 | reativação | — | suspenso | acesso restaurado | — | — | NÃO INICIADO | — | lifecycle |
| J20 | retorno aos dados | — | reativado | tenant/dados preservados | — | — | NÃO INICIADO | — | Central se afetar |
| J21 | isolamento entre workspaces | — | dois tenants | zero vazamento cross-tenant | — | — | NÃO INICIADO | — | obrigatório |
| J22 | custos/leituras | — | baseline conhecido | custo registrado | — | — | NÃO INICIADO | — | não necessariamente |
| J23 | health/uptime | plataforma | release autorizada | health e alerta funcionais | — | — | NÃO INICIADO | — | não Mobile, salvo infra comum |
| J24 | backup/recuperação | plataforma | backups READY | restore isolado validado | — | — | NÃO INICIADO | — | não Mobile |

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

