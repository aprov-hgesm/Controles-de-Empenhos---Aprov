# SAAS-E — Handoff — Operação, Backup, Uptime e Recuperação

Data: **2026-10-01**  
Frente: **SAAS-E — Operação, Backup, Uptime, Monitoramento e Recuperação do EMPROVEX SaaS R1**

## 1. Identificação

- Repositório: `aprov-hgesm/Controles-de-Empenhos---Aprov`
- Branch integradora: `feat/saas-r1-commercializacao`
- Base comum: `32872d3fc6a781ff129eb4e41ae9b0d45658024a`
- Branch worker: `saas-r1-e-ops-recovery`
- HEAD funcional certificado antes deste handoff documental: `e650191a52656347b45c2769f1d93be9d21b2eac`
- PR técnico: **#215 — draft, sem merge**
- Estado da worker frente à base no HEAD funcional: **3 commits à frente / 0 atrás**

Nenhum merge em `main`, nenhum merge na integradora e nenhum deploy de produção foi executado pela SAAS-E.

## 2. Commits da frente

1. `9e384bf8a2637f716b35227e6b44cf3ddef1fe78` — `feat: prepare SaaS R1 operations and recovery`
2. `20905ab23e98666da8212037e9421ee3618c06c4` — `test: align SAAS-E recovery guard`
3. `e650191a52656347b45c2769f1d93be9d21b2eac` — `docs: fix backup recovery diff hygiene`

Este arquivo de handoff é um fechamento documental posterior ao HEAD funcional certificado acima.

## 3. IMPLEMENTADO NO REPOSITÓRIO

### 3.1 Health endpoint

Criado:

`GET /api/health`

Arquivo:

`app/api/health/route.ts`

Contrato:

- público;
- resposta HTTP 200 pequena;
- `status: "ok"`;
- timestamp UTC gerado no servidor;
- `Cache-Control: no-store`;
- sem Firestore;
- sem leitura de dados operacionais;
- sem secrets/env;
- sem versão interna, commit ou identificador de infraestrutura.

O endpoint é deliberadamente superficial. Ele testa disponibilidade HTTP do runtime, não diagnóstico profundo do Firestore.

### 3.2 Recovery nativo dos dois bancos

A política `ops/firestore-recovery.json` foi ampliada para os **dois bancos existentes e congelados**:

1. `ai-studio-logsticahospital-3eeee498-faa1-4326-8f4f-95d34b382ec1` — banco operacional principal;
2. `emprovex-warehouse` — banco logístico da Central de Depósitos.

Não foi criado terceiro banco.

Política preparada para ambos:

- backup diário;
- retenção inicial de 14 semanas;
- PITR;
- proteção contra exclusão;
- RPO operacional alvo de até 24 horas;
- RTO operacional alvo de até 4 horas, como objetivo interno e não SLA comercial.

O script `scripts/firestore-recovery.mjs` agora:

- planeja os dois bancos em modo somente leitura;
- consulta a localização real de cada banco em vez de fixá-la no código;
- exige banco explícito em operações de escrita;
- bloqueia `--database=all` em modo de alteração;
- exige confirmação literal do resource name;
- bloqueia restore para qualquer um dos dois bancos de produção;
- gera restore plan somente para database novo/isolado;
- permite verificar se cada banco possui proteção, schedule diário e backup `READY`.

### 3.3 Backup lógico existente

O mecanismo existente foi preservado sem mudança de contrato.

Cobertura lógica atual por workspace no banco principal:

- `empenhos`;
- `invoices`;
- `comissoes`;
- `cronogramas`;
- `alerts`;
- settings restauráveis já documentados.

Características preservadas:

- Google Drive;
- checksum SHA-256;
- retenção de até 30 backups;
- restauração `missing-only`;
- validação antes de restaurar;
- sem bytes de PDF;
- sem password hash;
- sem token OAuth persistido.

### 3.4 Auditoria da Central de Depósitos

Conclusão objetiva:

**o backup lógico por workspace não cobre o database dedicado `emprovex-warehouse`.**

Portanto, na R1, os seguintes domínios logísticos dependem da camada nativa para recuperação de desastre global:

- materiais;
- depósitos;
- localizações/subposições;
- movimentos/ledger;
- balances;
- locationBalances;
- settings logísticos;
- lotes/validade;
- barcodes;
- layouts/croquis;
- inventários e itens;
- snapshots SISCOFIS;
- alertas logísticos;
- intakes/fila;
- destinos;
- withdrawals;
- consumptions;
- devoluções.

Decisão da SAAS-E:

**não ampliar automaticamente o backup lógico da Central na R1.**

Motivo: copiar toda a árvore logística para Drive aumentaria leituras, volume, custo e complexidade de restauração de dados fortemente relacionados.

Candidatos a exportação lógica futura, apenas se o piloto demonstrar necessidade:

- `materials`;
- `depots`;
- `locations`;
- `layouts`;
- `settings`.

Ledger, saldos, consumo, inventários e intakes permanecem preferencialmente sob recuperação nativa por consistência.

### 3.5 Runbook operacional

Criado:

`docs/SAAS_R1_OPERACAO_RECUPERACAO.md`

Cobre:

1. site fora do ar;
2. deploy Vercel com problema;
3. Firestore indisponível;
4. Rules incorretas;
5. autenticação indisponível;
6. problema na Central de Depósitos;
7. perda/acidente de dados;
8. custo/quota anormal;
9. rollback;
10. restauração;
11. registro mínimo de incidente;
12. suporte inicial simples.

Não foi criado helpdesk, Zendesk, CRM ou sistema próprio de tickets.

### 3.6 Uptime e monitoramento

Criado:

`docs/SAAS_R1_UPTIME_MONITORING.md`

A estratégia da R1 reutiliza:

- Google Cloud Monitoring;
- telemetria por UG/workspace;
- métricas globais existentes;
- alertas de quota;
- histórico diário;
- Vercel;
- GitHub Actions.

Não foi criada telemetria paralela e não foi adicionado listener Firestore.

O runbook documenta criação de HTTPS uptime check para:

`https://emprovex.com.br/api/health`

com validação SSL e política de alerta simples.

### 3.7 Guards e testes novos/atualizados

Arquivos relevantes:

- `.github/workflows/recovery-guardrails.yml`;
- `scripts/firestore-recovery.test.mjs`;
- `scripts/health-endpoint.test.mjs`;
- `scripts/verify-saas-r1-ops-recovery.mjs`;
- `ops/backup-recovery-baseline.json`;
- `package.json`.

Novos comandos:

- `npm run test:health`;
- `npm run verify:saas-r1-ops-recovery`.

## 4. Arquivos alterados pela frente

No HEAD funcional certificado, o diff contra a base contém:

- `.github/workflows/recovery-guardrails.yml`
- `app/api/health/route.ts`
- `docs/BACKUP_RECOVERY.md`
- `docs/RECUPERACAO_FIRESTORE.md`
- `docs/SAAS_R1_OPERACAO_RECUPERACAO.md`
- `docs/SAAS_R1_UPTIME_MONITORING.md`
- `ops/backup-recovery-baseline.json`
- `ops/firestore-recovery.json`
- `package.json`
- `scripts/firestore-recovery.mjs`
- `scripts/firestore-recovery.test.mjs`
- `scripts/health-endpoint.test.mjs`
- `scripts/verify-saas-r1-ops-recovery.mjs`

Mais este fechamento documental:

- `docs/SAAS_R1_E_HANDOFF.md`

Nenhum arquivo de billing, onboarding, legal, Auth comercial ou enforcement foi alterado intencionalmente.

## 5. VALIDAÇÃO AUTOMATIZADA REAL

HEAD funcional certificado:

`e650191a52656347b45c2769f1d93be9d21b2eac`

Resultados no GitHub Actions:

- **Application CI #888 — SUCCESS**
- **Recovery guardrails #575 — SUCCESS**
- **EMPROVEX Core Protection #175 — SUCCESS**
- Production Build — **PASS**
- Final TypeScript validation — **PASS**
- Diff Hygiene — **PASS**
- Recovery tests — **PASS**
- Backup and recovery architecture guard — **PASS**
- Backup disaster recovery emulator test — **PASS**
- Health endpoint safety tests — **PASS**
- SAAS R1 operation/recovery guard — **PASS**
- multi-tenant/security e guards da Central executados pelo Application CI — **PASS**

O disaster test validado é de **emulador**. Ele não equivale a restore real de backup nativo no Google Cloud.

## 6. EXIGE CONFIGURAÇÃO EXTERNA

As ações abaixo **não foram executadas pela SAAS-E** e não devem ser declaradas prontas sem evidência externa.

### 6.1 Banco operacional principal

Executar no Cloud Shell, conforme `docs/RECUPERACAO_FIRESTORE.md`:

- verificar billing;
- verificar/ativar PITR;
- verificar/ativar proteção contra exclusão;
- criar/ajustar schedule diário;
- confirmar pelo menos um backup `READY`.

### 6.2 Banco `emprovex-warehouse`

Executar os mesmos controles:

- PITR;
- proteção contra exclusão;
- backup diário;
- retenção de 14 semanas;
- confirmar backup `READY`.

### 6.3 Restore real

Antes do SaaS aberto:

1. escolher backup `READY`;
2. gerar `restore-plan`;
3. restaurar em **database novo/isolado**;
4. acompanhar operação;
5. validar amostras;
6. validar/reaplicar IAM, Rules e TTL;
7. registrar evidência e duração.

Nenhum restore real de Cloud Firestore foi executado pela SAAS-E.

### 6.4 Uptime

Criar no Google Cloud Monitoring:

- HTTPS uptime check;
- host `emprovex.com.br`;
- path `/api/health`;
- SSL validado;
- matcher de resposta;
- alert policy;
- notification channel do fundador.

A SAAS-E preparou o comando/runbook, mas **não ativou o uptime check**.

## 7. VALIDADO EM AMBIENTE REAL

### Validado

- GitHub Actions real;
- build real do projeto em CI;
- TypeScript real em CI;
- Core Protection real;
- Recovery guardrails real;
- disaster test em Firebase Emulator dentro do CI.

### Não validado

- backup nativo ativo no banco principal;
- backup nativo ativo no `emprovex-warehouse`;
- primeiro backup `READY` de cada banco;
- restore real para database isolado;
- `/api/health` publicado em produção;
- uptime check ativo;
- alert policy ativa;
- notification channel funcional.

Até essas evidências existirem, a infraestrutura externa deve ser tratada como **PENDENTE**, mesmo que o código esteja pronto para integração.

## 8. RPO / RTO

Objetivos iniciais registrados:

- **RPO:** até 24 horas para desastre coberto por backup nativo diário;
- **RTO:** até 4 horas como objetivo operacional inicial.

Limitações:

- não são SLA comercial;
- RTO depende de disponibilidade do Google Cloud, tamanho dos bancos, tempo de restore, reaplicação/validação de Rules/IAM/TTL e decisão humana;
- perda ocorrida depois do snapshot mais recente pode não estar no backup diário.

## 9. Custos e limitações

Custos potenciais:

- armazenamento dos backups durante retenção;
- PITR;
- operação de restore;
- eventual armazenamento temporário do database de teste.

Não foi fixado valor em R$ no código porque o custo depende do volume real e dos preços vigentes.

Limitações conhecidas:

1. backup lógico depende de sessão + Google Drive conectado;
2. backup lógico não cobre a Central dedicada;
3. health endpoint não testa Firestore profundamente por decisão de custo/simplicidade;
4. painel global existente filtra o banco operacional configurado; custo/uso do `emprovex-warehouse` deve continuar observável via Console/Billing enquanto não houver agregação multi-database certificada;
5. backup nativo não substitui versionamento de código, Rules e runbook;
6. restore nativo exige conferência posterior de IAM, Rules e TTL.

## 10. Ordem recomendada ao Coordenador

1. revisar semanticamente o diff da SAAS-E;
2. integrar na branch `feat/saas-r1-commercializacao` se não houver conflito com outras workers;
3. não marcar configuração cloud como concluída apenas pelo merge;
4. executar configuração externa dos dois bancos em janela controlada;
5. aguardar e confirmar pelo menos um backup `READY` de cada banco;
6. executar restore real em database isolado;
7. publicar o health junto da release consolidada autorizada;
8. criar uptime check + alerta;
9. executar smoke;
10. registrar evidências no Memorial/Integration Status.

## 11. Proibição de interpretação

Este handoff **não** autoriza:

- merge em `main`;
- deploy de produção;
- criação de terceiro banco;
- restore sobre banco de produção;
- relaxamento de Rules;
- expansão do backup lógico da Central sem nova decisão;
- alteração de billing/onboarding/legal;
- declaração de SaaS aberto.

## 12. Estado final da worker

**IMPLEMENTADO NO REPOSITÓRIO:** concluído.

**VALIDAÇÃO AUTOMATIZADA:** concluída e verde no HEAD funcional `e650191a52656347b45c2769f1d93be9d21b2eac`.

**CONFIGURAÇÃO EXTERNA:** pendente de execução/evidência.

**VALIDAÇÃO REAL DE BACKUP/RESTORE/UPTIME:** pendente.

A SAAS-E está tecnicamente apta para o Coordenador integrar o código e, depois, conduzir os passos externos obrigatórios.

# SAAS-E — PRONTA PARA INTEGRAÇÃO
