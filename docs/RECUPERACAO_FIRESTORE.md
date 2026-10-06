# EMPROVEX — Recuperação nativa do Firestore — SaaS R1

Última revisão de sintaxe: **2026-10-01**.

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

## 8. Restauração real para banco isolado

O Firestore restaura backup nativo em um **novo database**. Nunca use um dos dois IDs de produção como destino do teste.

Exemplo de plano seguro:

```bash
node scripts/firestore-recovery.mjs restore-plan \
  --database=emprovex-warehouse \
  --backup=projects/gen-lang-client-0982077967/locations/LOCALIZACAO/backups/BACKUP_ID \
  --target=emprovex-restore-2026-10-01
```

O comando acima só imprime o restore e verificações posteriores. Para executar de verdade, copie o comando `gcloud firestore databases restore` resultante no Cloud Shell.

Depois da operação:

```bash
gcloud firestore operations list \
  --project=gen-lang-client-0982077967 \
  --database=emprovex-restore-2026-10-01

gcloud firestore databases describe \
  --project=gen-lang-client-0982077967 \
  --database=emprovex-restore-2026-10-01
```

Valide amostras de dados no Firestore Studio/Console e registre:

- banco de origem;
- backup usado;
- snapshot time;
- banco isolado de destino;
- início/fim;
- resultado;
- coleções verificadas;
- qualquer diferença.

### Banco principal — amostras mínimas

- `workspaces`;
- `platformAccounts`;
- um workspace com `empenhos`;
- `invoices`;
- `comissoes`;
- `cronogramas`;
- `alerts`.

### Banco logístico — amostras mínimas

Em `warehouse/{workspaceId}`:

- `materials`;
- `depots`;
- `locations`;
- `movements`;
- `balances`;
- `locationBalances`;
- `layouts`;
- `intakes`;
- `inventories`;
- `consumptions`.

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
