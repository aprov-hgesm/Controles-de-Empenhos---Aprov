# EMPROVEX — Recuperação nativa do Firestore — SaaS R1

Última revisão operacional: **2026-10-27, estática — sem execução no Google Cloud**.

Este runbook cobre exclusivamente a camada nativa do Firestore. O backup lógico por workspace no Google Drive continua existindo e não é substituído.

## 1. Bancos protegidos

Projeto Google Cloud:

`gen-lang-client-0982077967`

Bancos congelados para a R1:

1. `ai-studio-logsticahospital-3eeee498-faa1-4326-8f4f-95d34b382ec1` — banco operacional principal.
2. `emprovex-warehouse` — Central de Depósitos.

Não criar terceiro banco para backup.

A política versionada está em `ops/firestore-recovery.json`.

## 2. Política inicial

Para **cada banco**:

- backup nativo: diário;
- retenção: 14 semanas;
- PITR: habilitado;
- proteção contra exclusão: habilitada;
- RPO operacional alvo: até 24 horas para desastre coberto por backup diário;
- RTO operacional alvo: até 4 horas como objetivo interno inicial, sem SLA comercial.

A retenção de 14 semanas preserva a política histórica já adotada pelo projeto e permanece dentro do limite documentado pelo Firestore.

## 3. Segurança do tooling

Os comandos de leitura podem selecionar os dois bancos.

Os comandos que alteram configuração exigem sempre:

- `--project` exato;
- um único `--database` explícito;
- `--confirm` com o resource name completo.

`--database=all` é bloqueado no modo de escrita.

## 4. Plano somente leitura

```bash
npm run recovery:plan
```

O comando apenas imprime o plano para os dois bancos.

## 5. Verificar estado real

No Cloud Shell:

```bash
npm run recovery:status
npm run recovery:verify
```

`verify` somente fica verde quando **cada banco** tiver:

- PITR habilitado;
- proteção contra exclusão habilitada;
- exatamente um agendamento diário com retenção esperada;
- pelo menos um backup no estado `READY`.

A localização é obtida do próprio `gcloud firestore databases describe`; não é presumida pelo script.

## 6. Aplicar configuração — passo manual externo

### Banco operacional principal

```bash
node scripts/firestore-recovery.mjs apply \
  --project=gen-lang-client-0982077967 \
  --database=ai-studio-logsticahospital-3eeee498-faa1-4326-8f4f-95d34b382ec1 \
  --confirm=projects/gen-lang-client-0982077967/databases/ai-studio-logsticahospital-3eeee498-faa1-4326-8f4f-95d34b382ec1
```

### Banco logístico

```bash
node scripts/firestore-recovery.mjs apply \
  --project=gen-lang-client-0982077967 \
  --database=emprovex-warehouse \
  --confirm=projects/gen-lang-client-0982077967/databases/emprovex-warehouse
```

Esses comandos **não foram executados por esta branch**. Só considerar a camada nativa ativa depois de evidência do Cloud Shell/Console e de pelo menos um backup `READY` por banco.

## 7. Listar backups

Primeiro descubra a localização real:

```bash
gcloud firestore databases describe \
  --project=gen-lang-client-0982077967 \
  --database=emprovex-warehouse \
  --format="value(locationId)"
```

Depois:

```bash
gcloud firestore backups list \
  --project=gen-lang-client-0982077967 \
  --location=LOCALIZACAO_REAL \
  --format="table(name,database,state,snapshotTime,expireTime)"
```

Repita a checagem para o banco principal quando necessário.

## 8. Recuperação real: procedimento preparado, NÃO EXECUTADO

A implementação W2 mantém a recuperação nativa dos **dois bancos** separada. O script de recuperação não executa restore; prepara plano e inspeção read-only. O Coordenador executará os comandos abaixo apenas após autorização específica.

### 8.1 Localizar e selecionar o backup certo

Em **uma futura sessão Cloud Shell autorizada**, conferir os controles com npm run recovery:status e npm run recovery:verify uma vez; essas leituras não são prova de recuperação. Para cada database, consultar sua região quando o original existir:

~~~bash
gcloud firestore databases describe --project=gen-lang-client-0982077967 --database=emprovex-warehouse --format=json
gcloud firestore backups list --project=gen-lang-client-0982077967 --location=REGIAO --format="table(name,database,state,snapshotTime,expireTime)"
~~~

Se o banco original tiver sido perdido, obter a região do inventário do Google Cloud e dos recursos de backup; não depender da existência da origem. Selecionar o resource name completo, conferindo database exato, READY, snapshotTime, expireTime futuro e projeto correto. O backup nativo inclui todos os workspaces contidos no banco, portanto não é um pacote a entregar integralmente a uma UG.

### 8.2 Plano offline, sem acesso à nuvem

~~~bash
node scripts/firestore-recovery.mjs restore-plan \
  --project=gen-lang-client-0982077967 \
  --database=emprovex-warehouse \
  --backup=projects/gen-lang-client-0982077967/locations/REGIAO/backups/BACKUP_REAL \
  --target=emprovex-restore-warehouse-20261027
~~~

O restore-plan valida apenas a sintaxe e a escolha do destino: **não comprova origem real, estado READY ou expiração**. O comando de restore impresso nesse modo é APENAS REFERÊNCIA, não autorização.

Para o principal, substituir o ID de origem por ai-studio-logsticahospital-3eeee498-faa1-4326-8f4f-95d34b382ec1 e escolher outro destino novo, por exemplo emprovex-restore-main-20261027.

### 8.3 Inspeção autenticada somente leitura — para o Coordenador

~~~bash
node scripts/firestore-recovery.mjs restore-inspect \
  --project=gen-lang-client-0982077967 \
  --database=emprovex-warehouse \
  --backup=projects/gen-lang-client-0982077967/locations/REGIAO/backups/BACKUP_REAL \
  --target=emprovex-restore-warehouse-20261027
~~~

O novo modo executa somente gcloud firestore backups describe (verificando origem exata, resource name, READY, snapshot e expiração) e gcloud firestore databases list --show-deleted (bloqueando nomes ativos e anteriormente excluídos). IDs produtivos e (default) são sempre vetados; o destino precisa começar com emprovex-restore-. A ausência de credencial/retorno incompleto provoca bloqueio, sem solicitar mais permissões. Mesmo a inspeção positiva representa apenas elegibilidade técnica, **não** restore realizado, dado conferido ou RPO/RTO alcançados.

### 8.4 Aprovação humana e restauração — somente em etapa futura

Antes de qualquer custo, anotar projeto, origem, backup READY verificado, snapshot, expiração, destino novo, região, custo potencial, permissões e aprovação específica. Preservar o original; o destino não deve ser usado pela aplicação ou clientes. Só após autorização explícita, executar manualmente no Cloud Shell o comando real impresso pelo restore-inspect:

~~~bash
gcloud firestore databases restore \
  --project=gen-lang-client-0982077967 \
  --source-backup=projects/gen-lang-client-0982077967/locations/REGIAO/backups/BACKUP_REAL \
  --destination-database=emprovex-restore-warehouse-20261027
~~~

Nunca excluir ou renomear o banco produtivo para reutilizar seu ID. O restore nativo cria database novo na região do backup. O comando acima é exemplo; NÃO foi executado.

### 8.5 Operação, integridade e evidências

Após eventual autorização e conclusão:

~~~bash
gcloud firestore operations list --project=gen-lang-client-0982077967 --database=emprovex-restore-warehouse-20261027 --format=json
gcloud firestore databases describe --project=gen-lang-client-0982077967 --database=emprovex-restore-warehouse-20261027 --format=json
~~~

Status concluído de operação NÃO basta para certificar recuperação. Validar com acesso controlado, usando contagens, IDs técnicos saneados e amostras sem documentos completos. No principal: workspaces, platformAccounts, platformUgIndex e settings/global quando existentes; dentro dos workspaces, empenhos, invoices, comissoes, cronogramas, alerts, configurações e integridade de referências. Firebase Authentication não integra o backup nativo e requer procedimento próprio.

No Warehouse, sob warehouse/{workspaceId}, conferir os domínios reais de lib/warehouse/namespace.ts: materials, depots, locations, settings, lots, barcodes, layouts, inventories, siscofisSnapshots, alerts, intakes, intakeQueueIndex, queueExclusions, destinations, movements, balances, locationBalances, withdrawals, consumptions e outboundReturns. Conferir materiais/depósitos, saldos por posição, movimentos, entradas, retiradas, devoluções, consumos, layouts 2D/3D persistidos e validade; não presumir subcoleções não encontradas. Comparar referências e invariantes do estoque antes de decidir recuperação operacional. Não reaplicar movimentações no banco de produção durante a auditoria.

Registrar no modelo docs/saas-maturity/W2_RECOVERY_EVIDENCE_TEMPLATE.md; medir RPO e RTO reais somente após um desastre simulado com início, fim e dado recuperado. Metas internas de 24h / 4h não constituem SLA comercial.

### 8.6 Barreiras que permanecem

Backup nativo inclui dados e índices; NÃO inclui Firebase Security Rules e políticas TTL. Conferir/reaplicar IAM, Rules e TTL para qualquer nova operação antes de habilitar clientes. Autenticação, senhas, segredos de integração, documentos em Google Drive e configurações externas possuem procedimentos próprios; nunca constam integralmente do backup de Firestore. Não conceder IAM público, nem copiar conteúdos de outras OMs para o Drive fundador. A UG deve recuperar seus próprios registros por seu responsável autenticado, inclusive com assinatura vencida, sem liberar dados de outras UGs.

## 9. O que o backup nativo contém e o que exige reaplicação

O backup nativo do Firestore contém dados e configurações de índices do ponto de backup.

Ele **não** contém:

- Firebase Security Rules;
- políticas TTL.

Após um restore, valide/reaplique Rules, IAM e TTL antes de permitir acesso de cliente ao banco restaurado.

## 10. Custos e observabilidade

Backup nativo e restore são cobrados pelo Google Cloud:

- armazenamento de cada backup durante sua retenção;
- operação de restore conforme o tamanho do backup;
- PITR possui armazenamento cobrado separadamente.

Não há estimativa fixa em R$ no código. O custo depende do tamanho real dos bancos, retenção e preços vigentes.

Para a R1:

- observar custos no Billing/Firestore do Google Cloud;
- usar Cloud Monitoring já existente para operação;
- não criar uma telemetria paralela só para backup;
- revisar retenção apenas com evidência de custo, sem reduzir proteção silenciosamente.

## 11. Fontes oficiais verificadas em 2026-10-01

- Firestore Native mode — Back up and restore data: https://cloud.google.com/firestore/native/docs/backups
- Firestore Native mode — PITR: https://cloud.google.com/firestore/native/docs/use-pitr
- Firestore pricing: https://cloud.google.com/firestore/pricing
