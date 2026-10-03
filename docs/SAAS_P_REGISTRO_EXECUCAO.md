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
