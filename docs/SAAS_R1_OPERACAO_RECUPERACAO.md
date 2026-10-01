# SAAS R1 — Operação, Incidentes, Backup e Recuperação

## 1. Escopo e objetivos

Runbook simples para a operação inicial do EMPROVEX pelo fundador.

Objetivos internos iniciais:

- **RPO:** até 24 horas para perda coberta pelo backup nativo diário;
- **RTO:** até 4 horas como objetivo operacional, não como SLA comercial;
- prioridade de recuperação: disponibilidade do site → autenticação → banco principal → Central de Depósitos → integrações/documentos → telemetria.

A restauração real de backup deve sempre começar em banco novo/isolado.

## 2. Estado das camadas de backup

### Camada 1 — lógico por workspace

Preservada.

Cobre no banco principal:

- \`empenhos\`;
- \`invoices\`;
- \`comissoes\`;
- \`cronogramas\`;
- \`alerts\`;
- settings restauráveis de TR/classes.

Características:

- Google Drive do workspace;
- checksum SHA-256;
- retenção de até 30 arquivos;
- restauração \`missing-only\`;
- não inclui bytes de PDF;
- depende de sessão e Drive conectado.

### Camada 2 — nativo Firestore

Política preparada para os dois bancos:

- operacional principal;
- \`emprovex-warehouse\`.

O estado externo precisa ser confirmado com \`npm run recovery:verify\`.

## 3. Auditoria da Central de Depósitos

O backup lógico histórico foi criado antes do database dedicado da Central e **não exporta a árvore \`warehouse/*\` do banco \`emprovex-warehouse\`**.

Na R1, os dados logísticos abaixo dependem do backup nativo para recuperação global:

- materiais;
- depósitos;
- locais/subposições;
- movimentos/ledger;
- saldos agregados e por posição;
- settings logísticos;
- lotes/validade;
- barcodes;
- layouts/croquis;
- inventários e itens;
- snapshots SISCOFIS;
- alertas;
- intakes/fila;
- destinos;
- withdrawals;
- consumptions;
- devoluções.

Decisão R1: **não** duplicar automaticamente esses domínios no Google Drive. Isso aumentaria leituras, volume, custo e complexidade de restauração de dados fortemente relacionados.

Candidatos a uma exportação lógica futura, somente se houver necessidade comprovada: \`materials\`, \`depots\`, \`locations\`, \`layouts\` e \`settings\`, por serem dados mais humanos/configuracionais. Ledger, saldos, intakes, inventários e consumo permanecem preferencialmente na recuperação nativa por consistência.

## 4. Health endpoint

Endpoint público:

\`GET /api/health\`

Resposta intencionalmente mínima:

\`\`\`json
{"status":"ok","timestamp":"2026-10-01T22:00:00.000Z"}
\`\`\`

Não consulta Firestore, não acessa workspace, não lê secrets e não expõe versão/commit.

## 5. Incidentes

### 5.1 Site fora do ar

Verificar:

1. \`https://emprovex.com.br/api/health\`;
2. Vercel — último deployment e status;
3. Cloud Monitoring — uptime e alertas;
4. status público da Vercel/Google Cloud se houver evidência de incidente amplo.

Seguro:

- identificar o último deployment saudável;
- usar rollback da Vercel quando o incidente começou após deploy.

Parar e investigar antes de mexer em banco quando o health falha por deploy/runtime.

### 5.2 Deploy Vercel com problema

Verificar:

- deployment ativo;
- logs do build/runtime;
- commit publicado;
- variáveis de ambiente relevantes sem expor valores.

Seguro:

- rollback para deployment anterior comprovadamente saudável;
- corrigir em branch e republicar pelo fluxo normal.

Não alterar Firestore para compensar falha de frontend/deploy.

### 5.3 Firestore indisponível

Verificar:

- health do site;
- Google Cloud status;
- console do Firestore;
- erros de API;
- quota/custo.

Se o serviço Google estiver indisponível, evitar migração ou restore precipitado. Registrar horário e aguardar evidência de recuperação do provedor.

### 5.4 Rules incorretas

Sintoma típico: \`Missing or insufficient permissions\`.

Verificar:

- qual database foi atingido;
- ruleset esperado no \`firebase.json\`;
- diff do ruleset;
- último deploy de Rules.

Seguro:

- restaurar/publicar o ruleset conhecido e validado do GitHub para o database correto.

Não relaxar Rules globalmente para “testar”.

### 5.5 Autenticação indisponível

Verificar:

- Firebase Auth;
- status do provedor;
- configuração de domínio/autorização;
- erro específico do cliente.

Não criar bypass de autenticação.

O backup administrativo de Auth/diretório continua sendo metadata-only; usuários de senha podem precisar resetar credencial após desastre total de Auth.

### 5.6 Problema na Central de Depósitos

Primeiro separar:

- erro de UI/deploy;
- erro de permissão/Rules;
- problema no database \`emprovex-warehouse\`;
- inconsistência de domínio.

Não escrever manualmente em \`balances\`, \`locationBalances\` ou \`movements\` para “corrigir” saldo.

Se houver perda real de dados, seguir restore nativo em banco isolado antes de qualquer medida destrutiva.

### 5.7 Perda/acidente de dados

1. interromper a ação causadora;
2. registrar banco, workspace, horário e escopo;
3. preservar evidências/logs;
4. para perda isolada do banco principal, avaliar primeiro backup lógico \`missing-only\`;
5. para perda global ou Central, localizar backup nativo \`READY\`;
6. gerar \`restore-plan\`;
7. restaurar para banco novo;
8. validar amostras;
9. decidir recuperação final somente após comparação.

### 5.8 Custo/quota anormal

Verificar:

- Painel de Consumo do EMPROVEX;
- Cloud Monitoring global;
- alertas de quota existentes;
- Billing do Google Cloud;
- Vercel usage.

Não criar listener adicional para investigar custo.

Registrar o intervalo, métrica dominante, database afetado e mudança de código/deploy próxima ao início do pico.

### 5.9 Rollback

Preferir rollback quando o problema coincide com mudança de aplicação e os dados permanecem íntegros.

Rollback de código não desfaz escrita de dados já realizada. Se houve corrupção de dados, tratar como incidente de recuperação.

### 5.10 Restore

Nunca restaurar teste diretamente em um dos bancos de produção.

Usar \`docs/RECUPERACAO_FIRESTORE.md\`.

Após restore nativo, revisar Rules, IAM e TTL antes de permitir acesso.

## 6. Registro de incidente

Formato mínimo:

- data/hora início;
- quem identificou;
- sintoma;
- impacto;
- banco/superfície;
- último deploy relacionado;
- ações executadas;
- decisão de rollback/restore;
- data/hora normalização;
- causa conhecida ou “em investigação”;
- follow-up curto.

Pode ser registrado em Markdown no repositório privado ou em nota operacional controlada pelo fundador.

## 7. Suporte inicial

R1 não exige helpdesk.

Fluxo mínimo:

- **acesso/senha:** validar conta, workspace e fluxo oficial de redefinição;
- **pagamento:** encaminhar ao fluxo administrativo da SAAS-B, sem resolver aqui;
- **indisponibilidade:** confirmar health/Vercel/Monitoring e registrar incidente;
- **recuperação:** coletar workspace, período e escopo; nunca pedir ao usuário para editar Firestore;
- **Central:** registrar operação, material/NF quando aplicável e horário.

Canal simples controlado pelo fundador é suficiente na R1. Evitar dados sensíveis desnecessários em mensagens de suporte.

## 8. Critério operacional antes do SaaS aberto

Exigir evidência de:

- um backup \`READY\` em cada banco;
- um restore real concluído em database isolado;
- health público respondendo em produção;
- uptime HTTPS ativo;
- alerta de uptime associado a canal válido;
- runbook acessível;
- custo/quota observáveis.

Até essa evidência existir, a implementação pode ser integrada ao código, mas a frente não deve ser declarada “validada em ambiente real”.
