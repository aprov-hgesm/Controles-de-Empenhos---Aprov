# SAAS-P — Runbook do Piloto Real

Data de consolidação: 2026-10-02

Branch coordenadora: `feat/saas-r1-commercializacao`

Estado: **RUNBOOK PREPARADO / NÃO EXECUTAR PILOTO REAL ANTES DO RELEASE CANDIDATE**


## 0. Gate de entrada obrigatório

Este runbook somente entra em execução depois que o Coordenador declarar **PRE-PILOTO CONCLUÍDO / RELEASE CANDIDATE CONGELADO** conforme `docs/SAAS_R1_PRE_PILOTO_HARDENING.md`.

Até lá:
- não iniciar P-03;
- não executar J15–J20 como evidência final do SaaS R1;
- não usar produção Performance R3 para certificar funcionalidades do candidato;
- preservar o T0 já coletado;
- usar este documento apenas para preparação.

## 1. Princípios de execução

1. P-01 e P-02 são usuários reais protegidos.
2. Nenhuma evidência vale mais do que a continuidade operacional desses setores.
3. `aprovisionamento-teste` é o workspace preferencial para cenários disruptivos.
4. P-03 precisa ser participante real, novo, pós-corte e não isento.
5. Não fabricar PASS, pagamento, trial, aceite, suspensão ou custo.
6. Não publicar SaaS R1, Rules ou PR #223 sem autorização explícita.
7. Não repetir `recovery apply`.
8. Não criar listeners apenas para medir consumo.
9. Toda ação transversal deve ser reconciliada com MOBILE-R1.
10. Manter desenvolvimento SaaS e Mobile isolados em worktrees/branches distintas.

## 2. Participantes

| Slot | Workspace | Papel | Política |
|---|---|---|---|
| P-01 | `aprovisionamento-3-gac-ap` | VIP legado / usuário real ativo | não disruptivo |
| P-02 | `aprovisionamento-2-b-fv` | VIP legado / usuário real em adoção | não disruptivo |
| TESTE | `aprovisionamento-teste` | VIP legado / perfil funcional controlado | preferencial para J15–J20 |
| P-03 | a definir | novo não-VIP | jornada comercial real |

## 3. Preparação local sem interferir na MOBILE-R1

Usar um worktree separado. Não trocar a branch do diretório usado pelo desenvolvimento Mobile.

PowerShell:

```powershell
cd C:\Users\marco\Projetos\emprovex
git fetch origin
git worktree add C:\Users\marco\Projetos\emprovex-saas-pilot origin/feat/saas-r1-commercializacao
cd C:\Users\marco\Projetos\emprovex-saas-pilot
git status
```

Se o worktree já existir, apenas entrar nele e atualizar com `git fetch origin` seguido de fast-forward seguro, sem tocar no clone Mobile.

## 4. Fase T0 — baseline antes das jornadas

### 4.1 Guards de arquitetura

Executar no worktree SaaS:

```powershell
npm run verify:block-16-3-workspace-telemetry
npm run verify:block-16-4-global-monitoring
npm run verify:block-16-5-consolidated-usage
npm run verify:block-17-6-telemetry-fidelity
npm run verify:block-17-8-consumption-regression
npm run verify:ug-telemetry-v2
```

Esses guards validam arquitetura. Não substituem números reais.

### 4.2 Captura numérica T0

Registrar uma única fotografia, sem refresh repetitivo, das seguintes fontes:

- Cloud Monitoring — banco principal;
- Cloud Monitoring / Console — `emprovex-warehouse`;
- Painel de Consumo EMPROVEX — estimativa por UG;
- Google Cloud Billing — custo monetário do projeto.

Campos:

- timestamp local;
- billing day;
- fonte;
- database;
- métrica;
- unidade;
- valor T0;
- observação de latência/flush.

Não transformar estimativa por UG em cobrança monetária oficial.

## 5. P-01 — jornada não disruptiva

Workspace: `aprovisionamento-3-gac-ap`.

Executar somente durante uso normal ou janela combinada com o operador.

Coletar, sem pedir senha nem interromper serviço:

1. login normal já utilizado pelo operador;
2. workspace/UG corretos;
3. estado natural do aceite legal;
4. Home/shell operacional;
5. uma superfície operacional normal;
6. acesso à Central;
7. condição VIP/R$0;
8. ausência de dados de outro workspace.

Não executar:

- reset forçado;
- troca forçada de senha;
- remoção/recriação de aceite;
- suspensão;
- revogação;
- bloqueio;
- mudança de billing/status.

Status possíveis:
- observado e comprovado -> atualizar Jxx;
- não ocorreu naturalmente -> manter PREPARADO;
- problema real -> abrir incidente PILOT-* e parar qualquer correção transversal.

## 6. P-02 — jornada não disruptiva

Workspace: `aprovisionamento-2-b-fv`.

Mesmas regras de P-01.

Como o usuário está iniciando a adoção, registrar especialmente:
- primeiro acesso natural, se ocorrer;
- clareza do onboarding/checklist;
- acesso ao shell;
- Central;
- dificuldades reais relatadas;
- qualquer erro de permissão.

Não alterar o ambiente apenas para produzir cenários.

## 7. `aprovisionamento-teste` — jornada disruptiva controlada

Esse workspace é o preferencial para J15–J20.

Antes de iniciar:
1. confirmar que não há operador real dependendo dele naquele momento;
2. registrar estado inicial;
3. registrar amostra de dados que deverá existir após reativação;
4. garantir que a ação de suspensão seja reversível;
5. obter autorização explícita para executar suspensão real.

Sequência:

- J15 — suspensão manual;
- J16 — confirmar revogação da sessão;
- J17 — confirmar bloqueio das áreas privadas;
- J18 — confirmar Termos/Privacidade/regularização públicos;
- J19 — reativação;
- J20 — novo login e confirmação dos mesmos dados/tenant.

Parar imediatamente em:
- `RECOVERY_REQUIRED`;
- estado divergente entre bancos;
- perda de dados;
- acesso residual indevido;
- impossibilidade de reativação.

## 8. P-03 — piloto comercial real

Não iniciar até existir participante real.

Pré-condições:
- workspace posterior a 2026-10-02;
- não VIP;
- dados reais do participante;
- aplicação + Rules compatíveis publicadas em janela controlada;
- cobrança Link/Pix configurada;
- baseline T0 já capturado.

Sequência:
- J01 onboarding;
- primeiro acesso/aceite;
- J10 trial de 30 dias;
- J11 estado comercial;
- J12 pagamento externo real;
- J13 confirmação administrativa somente depois do pagamento;
- J14 regularização.

J15–J20 podem continuar sendo exercitados preferencialmente no `aprovisionamento-teste`; não é obrigatório colocar o cliente real em indisponibilidade para provar um mecanismo que pode ser testado com segurança em ambiente controlado, salvo decisão posterior explícita do Coordenador.

## 9. Recovery — J24

Estado conhecido:
- PITR: ativo nos dois bancos;
- delete protection: ativa;
- schedule diário: ativo;
- retenção: 14 semanas;
- último estado conhecido: 0 backups READY.

Não repetir `apply`.

Próxima leitura única quando houver possibilidade de o schedule ter produzido backup:

```powershell
cd C:\Users\marco\Projetos\emprovex-saas-pilot
npm run recovery:status
npm run recovery:verify
```

Se ambos os bancos tiverem backup READY:
1. registrar resource name, location, snapshotTime e expireTime;
2. escolher backup para teste;
3. gerar `restore-plan`;
4. usar database novo e isolado;
5. apresentar comando e target antes da execução real;
6. só executar restore com autorização explícita;
7. validar amostras;
8. conferir IAM/Rules/TTL antes de qualquer uso.

## 10. Health/Uptime — J23

PR #223 permanece estacionado.

Não publicar isoladamente durante desenvolvimento.

Na futura janela controlada de publicação:
1. incluir `/api/health`;
2. smoke HTTP 200;
3. confirmar `status=ok`;
4. validar SSL;
5. criar uptime check;
6. criar alert policy;
7. associar notification channel;
8. testar notificação;
9. registrar J23.

## 11. T1 e T2

T1:
- registrar consumo durante as jornadas;
- não ficar atualizando painéis para buscar granularidade.

T2:
- capturar as mesmas fontes/unidades após consolidação;
- respeitar latência de flush;
- calcular T2 - T0 somente na mesma fonte.

Google Cloud Billing é a fonte monetária oficial.

## 12. Regra de incidentes

Classificar antes de corrigir:

- PILOT-UX
- PILOT-AUTH
- PILOT-LEGAL
- PILOT-LIFECYCLE
- PILOT-BILLING
- PILOT-CENTRAL
- PILOT-RULES
- PILOT-OPS

Se tocar Auth, Rules, lifecycle, sessão, billing compartilhado, workspace/UG, shell ou Central:
- não corrigir diretamente;
- criar branch curta coordenada;
- registrar Impacto MOBILE-R1;
- integrar semanticamente.

## 13. Gate de encerramento SAAS-P

Somente encerrar quando:
- matriz J01–J24 estiver atualizada;
- pelo menos 3 onboardings reais estiverem comprovados;
- houver pelo menos 1 cliente real pago não legado;
- trial/pagamento/regularização estiverem comprovados;
- lifecycle disruptivo tiver evidência segura em ambiente controlado;
- T0/T1/T2 e custo monetário estiverem registrados;
- backup READY nos dois bancos;
- restore isolado comprovado;
- health/uptime/alert/channel comprovados;
- isolamento sem regressão;
- MOBILE-R1 reconciliada novamente;
- pendências remanescentes resolvidas ou aceitas explicitamente.

Só então abrir SAAS-J.

## 14. Modo de execução quando P-01/P-02 não estiverem disponíveis

A ausência momentânea dos operadores reais não interrompe a SAAS-P.

Usar `aprovisionamento-teste` para executar o máximo possível das jornadas funcionais e de lifecycle.

Classificação:
- resultado no workspace de teste = evidência funcional/controlada;
- resultado em P-01/P-02 = evidência humana operacional real;
- resultado em P-03 = evidência comercial real.

Essas três classes não devem ser confundidas.

Ordem recomendada enquanto P-01/P-02 estiverem indisponíveis:
1. login normal no `aprovisionamento-teste`;
2. shell/Home;
3. Central;
4. sessão;
5. reset/troca de senha se necessário para testar;
6. registrar estado atual de aceite legal sem manipular;
7. snapshot de dados antes do lifecycle;
8. J15–J20, mediante autorização específica para suspensão;
9. T1/T2;
10. posteriormente observar P-01/P-02 quando os operadores estiverem disponíveis.

## 15. Encerramento do piloto e transição pós-piloto

Quando a janela real de piloto terminar:
- congelar evidências T1/T2;
- congelar lista de incidentes/ajustes;
- não continuar pilotando indefinidamente enquanto código muda;
- abrir correções finais coordenadas;
- repetir somente os testes afetados;
- entregar o candidato corrigido para SAAS-J.

O piloto não é a certificação final e não é o lançamento completo.
