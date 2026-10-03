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

## 5. Tentativa de verificação ao vivo nesta execução

Os comandos canônicos da frente são:

```powershell
npm run recovery:status
npm run recovery:verify
```

A consulta ao Google Cloud **não pôde ser executada neste ambiente de worker**, porque o ambiente disponível não possui `gcloud` instalado/autenticado nem acesso às credenciais do projeto.

Resultado correto desta limitação:

- não inferir estado live;
- não marcar backup como `READY`;
- não inventar location/resource name/snapshot/expiration;
- não executar `apply`;
- não executar restore;
- manter a frente em **PARCIAL** até evidência externa real.

## 6. Estado dos bancos

### 6.1 Banco operacional

Database:

`ai-studio-logsticahospital-3eeee498-faa1-4326-8f4f-95d34b382ec1`

- PITR: **registrado como ativo no baseline de 2026-10-02; não revalidado live nesta execução**;
- delete protection: **registrado como ativo no baseline de 2026-10-02; não revalidado live nesta execução**;
- schedule diário: **registrado como ativo no baseline de 2026-10-02; não revalidado live nesta execução**;
- backup READY: **NÃO COMPROVADO nesta execução**;
- resource name: **não disponível sem evidência live**;
- location: **não disponível sem evidência live**;
- snapshot time: **não disponível sem evidência live**;
- expiration time: **não disponível sem evidência live**.

### 6.2 Warehouse

Database:

`emprovex-warehouse`

- PITR: **registrado como ativo no baseline de 2026-10-02; não revalidado live nesta execução**;
- delete protection: **registrado como ativo no baseline de 2026-10-02; não revalidado live nesta execução**;
- schedule diário: **registrado como ativo no baseline de 2026-10-02; não revalidado live nesta execução**;
- backup READY: **NÃO COMPROVADO nesta execução**;
- resource name: **não disponível sem evidência live**;
- location: **não disponível sem evidência live**;
- snapshot time: **não disponível sem evidência live**;
- expiration time: **não disponível sem evidência live**.

## 7. Comandos de verificação externa

Executar em ambiente autenticado no projeto, preferencialmente Cloud Shell:

```bash
npm run recovery:status
npm run recovery:verify
```

Se `recovery:verify` permanecer não verde, registrar a saída real e classificar a causa sem aplicar alterações automaticamente.

A política vigente proíbe repetir `apply` automaticamente.

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
- proteções foram registradas anteriormente como ativas;
- faltam evidência live de backup `READY` dos dois bancos;
- falta seleção de backup real;
- falta autorização para restore real;
- falta restore real isolado;
- faltam validações pós-restore.

Não existe base factual para PASS neste momento.

## 15. Próximo gate

1. rodar `npm run recovery:status` em ambiente autenticado;
2. rodar `npm run recovery:verify`;
3. capturar os backups `READY` reais dos dois bancos;
4. selecionar backup fonte;
5. gerar restore-plan real;
6. retornar ao Coordenador SaaS para autorização explícita;
7. somente após autorização, executar restore em banco isolado;
8. validar dados, IAM, Rules, TTL e isolamento;
9. atualizar este documento e o handoff com evidência real.

## 16. Conclusão

Backup configurado não é prova de recuperabilidade.

Nesta execução foi preservado o princípio de não transformar ausência de evidência em PASS. A HARDEN-B permanece **PARCIAL** até que a recuperação seja comprovada com backup nativo real, restore isolado autorizado e validação pós-restore reproduzível.
