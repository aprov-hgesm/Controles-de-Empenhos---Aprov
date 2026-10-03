# EMPROVEX SaaS R1 — HARDEN-B — Recovery e Restore Isolado

Data: **2026-10-03**

Branch worker: `saas-harden-b-recovery-restore`  
Base congelada: `f8d2a53bfadf2548a59f49cdfc3cdb3d420f0b11`  
Branch integradora: `feat/saas-r1-commercializacao`

## 1. Estado da branch

A branch foi auditada contra a base congelada e permanece **idêntica ao freeze**:

- ahead: 0;
- behind: 0;
- commits próprios antes deste documento: 0;
- merge/rebase/cherry-pick da integradora: **não executado**.

A integradora avançou documentalmente após o freeze. Esses avanços foram consultados somente em leitura.

## 2. Escopo HARDEN-B

Esta frente existe para comprovar recuperabilidade real antes do piloto:

1. proteções Firestore;
2. backup nativo dos dois bancos;
3. evidência de backup `READY`;
4. seleção de backup real;
5. restore em banco novo e isolado;
6. validação de dados, IAM, Rules, TTL e isolamento;
7. evidência reproduzível.

## 3. Baseline canônico confirmado no repositório

Projeto Google Cloud:

`gen-lang-client-0982077967`

Bancos protegidos pela política:

- `ai-studio-logsticahospital-3eeee498-faa1-4326-8f4f-95d34b382ec1` — operacional principal;
- `emprovex-warehouse` — logística/Central de Depósitos.

Política `ops/firestore-recovery.json`:

- backup diário;
- retenção: 14 semanas;
- PITR obrigatório;
- delete protection obrigatório;
- RPO interno alvo: 24 h;
- RTO interno alvo: 4 h.

O estado canônico mais recente consultado na integradora registra que, em 2026-10-02, PITR, delete protection e schedules diários haviam sido ativados nos dois bancos, permanecendo pendentes:

- pelo menos um backup nativo `READY` por banco;
- restore real isolado;
- validação pós-restore.

Este documento **não promove esse registro histórico a evidência atual** sem nova consulta ao Google Cloud.

## 4. Auditoria do tooling

### 4.1 `scripts/firestore-recovery.mjs`

O tooling atual:

- resolve os dois bancos a partir da política;
- consulta `locationId` real antes de listar backups;
- exige banco explícito para escrita;
- bloqueia `--database=all` em escrita;
- exige confirmação literal do resource name para `apply`;
- considera `READY` somente backup nativo cujo `backup.database` corresponde ao banco protegido;
- exige exatamente um schedule diário com retenção configurada;
- marca `ready=true` somente quando controles + backup `READY` estão presentes;
- bloqueia restore-plan para os dois IDs produtivos;
- imprime apenas plano/comando para destino novo e isolado;
- não executa restore no modo `restore-plan`.

### 4.2 Windows / gcloud

`scripts/lib/gcloud-command.mjs` preserva o suporte Windows:

- usa `gcloud` diretamente fora do Windows;
- no Windows roteia `gcloud.cmd` por `cmd.exe`;
- mantém fallback para `cmd.exe` quando `ComSpec` não está disponível.

Nenhum refactor desse suporte foi realizado.

## 5. Verificação ao vivo executada em 2026-10-03

A verificação foi executada em PowerShell autenticado no projeto `gen-lang-client-0982077967`, com a conta ativa confirmada e a branch limpa no HEAD documental da HARDEN-B.

Comandos executados:

```powershell
npm run recovery:status
npm run recovery:verify
```

Resultado live:

- projeto: `gen-lang-client-0982077967`;
- ambos os bancos: `us-east1`;
- PITR: ativo nos dois bancos;
- delete protection: ativa nos dois bancos;
- schedule diário: válido nos dois bancos;
- retenção: `8467200s` = 14 semanas;
- backups READY: **0 nos dois bancos**;
- `recovery:status`: `ready=false`;
- `recovery:verify`: `ready=false`.

A listagem direta de backups em `us-east1` retornou `[]`.

Classificação: **dependência temporal legítima**, não falha de configuração. Os schedules foram criados pouco antes desta verificação e ainda não produziram o primeiro backup nativo READY.

Não foi executado `apply`, não foi forçado backup e não foi iniciado restore.

## 6. Estado dos bancos

### 6.1 Banco operacional

Database:

`ai-studio-logsticahospital-3eeee498-faa1-4326-8f4f-95d34b382ec1`

- PITR: **ATIVO — comprovado live**;
- delete protection: **ATIVA — comprovada live**;
- schedule diário: **ATIVO — comprovado live**;
- schedule resource: `projects/gen-lang-client-0982077967/databases/ai-studio-logsticahospital-3eeee498-faa1-4326-8f4f-95d34b382ec1/backupSchedules/665b144d-7291-4672-bae1-1a0a01375c53`;
- schedule create time: `2026-10-03T00:01:18.394935Z`;
- retenção: `8467200s` (14 semanas);
- backup READY: **NÃO — 0 backups READY**;
- resource name de backup: **ainda inexistente**;
- location: `us-east1`;
- snapshot time: **ainda inexistente**;
- expiration time: **ainda inexistente**.

### 6.2 Warehouse

Database:

`emprovex-warehouse`

- PITR: **ATIVO — comprovado live**;
- delete protection: **ATIVA — comprovada live**;
- schedule diário: **ATIVO — comprovado live**;
- schedule resource: `projects/gen-lang-client-0982077967/databases/emprovex-warehouse/backupSchedules/8cf84722-3e98-4f82-a77d-184901063f68`;
- schedule create time: `2026-10-03T00:02:16.403466Z`;
- retenção: `8467200s` (14 semanas);
- backup READY: **NÃO — 0 backups READY**;
- resource name de backup: **ainda inexistente**;
- location: `us-east1`;
- snapshot time: **ainda inexistente**;
- expiration time: **ainda inexistente**.

## 7. Resultado dos comandos canônicos

`npm run recovery:status`:

- banco operacional: controles prontos, `backupReady=false`, `completedBackupCount=0`;
- warehouse: controles prontos, `backupReady=false`, `completedBackupCount=0`;
- resultado global: `ready=false`.

`npm run recovery:verify`:

- reproduziu o mesmo estado;
- corretamente não certificou recovery;
- causa: ausência do primeiro backup nativo READY.

A política vigente proíbe repetir `apply` automaticamente. Não criar polling em loop e não forçar o evento. Existe monitoramento externo já preparado para detectar a disponibilidade dos backups.

## 8. Evidência necessária quando houver backup READY

Para cada banco, registrar obrigatoriamente:

- database;
- backup resource name;
- state;
- location;
- snapshot time;
- expiration time;
- retenção;
- observações.

Nenhum identificador de backup foi inventado neste documento.

## 9. Restore plan

O restore continua restrito a **BANCO NOVO E ISOLADO**.

Destino produtivo é bloqueado pelo tooling.

Quando existir backup real selecionado, gerar o plano com:

```bash
node scripts/firestore-recovery.mjs restore-plan \
  --database=<BANCO_ORIGEM> \
  --backup=<RESOURCE_NAME_REAL_DO_BACKUP_READY> \
  --target=emprovex-restore-2026-10-03
```

O comando produzido deverá ter o formato:

```bash
gcloud firestore databases restore   --project=gen-lang-client-0982077967   --source-backup=<RESOURCE_NAME_REAL_DO_BACKUP_READY>   --destination-database=emprovex-restore-2026-10-03
```

Este documento **não autoriza executar o restore**.

## 10. Autorização para restore real

Status: **PENDENTE DE AUTORIZAÇÃO EXPLÍCITA DO FUNDADOR**.

Antes de qualquer execução real, o Coordenador SaaS deve receber:

- banco fonte;
- backup selecionado;
- resource name;
- snapshot;
- destino proposto;
- comando exato;
- risco;
- custo/efeito esperado;
- cleanup;
- validações pós-restore.

Até esse gate, a ação deve permanecer somente leitura/planejamento.

## 11. Validação pós-restore requerida

Somente depois de restore real autorizado:

### Dados
- collections esperadas;
- documentos esperados;
- campos críticos;
- coerência com o snapshot.

### IAM
- confirmar acesso do banco restaurado;
- confirmar ausência de exposição indevida.

### Rules
- verificar estado aplicável;
- documentar o que precisa ser reproduzido com segurança;
- não publicar Rules produtivas a partir desta frente.

### TTL
- verificar políticas TTL relevantes no target.

### Isolamento
- confirmar banco distinto dos IDs produtivos;
- confirmar ausência de conexão acidental com produção;
- confirmar que testes não escrevem nos bancos produtivos.

## 12. Proteções preservadas

Nesta frente não foi executado:

- desativação de delete protection;
- desativação de PITR;
- redução de retenção;
- exclusão de backup;
- restore sobre produção;
- alteração de banco produtivo para teste;
- relaxamento de segurança;
- publicação de Rules;
- deploy;
- merge em main.

## 13. Impacto MOBILE-R1

Classificação: **SEM DELTA**.

Justificativa:

- nenhuma alteração de schema;
- nenhuma alteração de Auth;
- nenhuma alteração de sessão/lease;
- nenhuma alteração de Rules;
- nenhuma alteração de contratos da Central;
- nenhuma alteração de código Mobile;
- nenhuma alteração de `next.config.ts`.

CT-01 — Permissions-Policy da câmera — permanece fora do escopo da HARDEN-B.

## 14. Status

**PARCIAL**

Motivo:

- baseline e tooling de segurança estão confirmados;
- PITR, delete protection e schedules diários estão **comprovados live** nos dois bancos;
- ambos os schedules têm retenção de 14 semanas e estão em `us-east1`;
- ainda existem **0 backups READY** nos dois bancos;
- falta seleção de backup real;
- falta autorização para restore real;
- falta restore real isolado;
- faltam validações pós-restore.

Não existe base factual para PASS neste momento.

## 15. Próximo gate

1. aguardar o evento legítimo do primeiro backup diário; não forçar e não criar polling em loop;
2. quando o monitoramento externo indicar disponibilidade, repetir uma leitura com `npm run recovery:status` e `npm run recovery:verify`;
3. capturar resource name, location, snapshot time e expiration time dos backups `READY` reais dos dois bancos;
4. selecionar backup fonte;
5. gerar restore-plan real;
6. retornar ao Coordenador SaaS para autorização explícita;
7. somente após autorização, executar restore em banco isolado;
8. validar dados, IAM, Rules, TTL e isolamento;
9. atualizar este documento e o handoff com evidência real.

## 16. Conclusão

Backup configurado não é prova de recuperabilidade.

Nesta execução foi preservado o princípio de não transformar ausência de evidência em PASS. A HARDEN-B permanece **PARCIAL** até que a recuperação seja comprovada com backup nativo real, restore isolado autorizado e validação pós-restore reproduzível.
