# Recuperação do Firestore — EMPROVEX

Este procedimento protege o banco que o EMPROVEX usa em produção.

## Alvo confirmado

- Projeto: `gen-lang-client-0982077967`
- Banco: `ai-studio-logsticahospital-3eeee498-faa1-4326-8f4f-95d34b382ec1`
- Região: `us-east1`
- RPO inicial: 24 horas
- RTO inicial: 4 horas

O projeto `controle-de-empenhos---aprov` não é o banco de produção e não deve receber estes comandos.

## Proteções previstas

1. proteção contra exclusão do banco;
2. recuperação pontual (PITR);
3. backup diário com retenção de 14 semanas;
4. validação de que existe pelo menos um backup no estado `READY`;
5. restauração de teste somente em um banco novo e isolado.

Backups programados e PITR exigem faturamento ativo no projeto. Nunca coloque chave de conta de serviço, token ou arquivo de credenciais neste repositório.

## Uso seguro

Exibir o plano sem acessar o Google Cloud:

```bash
npm run recovery:plan
```

Consultar o estado atual, sem alterar configurações:

```bash
npm run recovery:status
```

Aplicar as proteções exige Google Cloud CLI autenticado, permissão administrativa, faturamento ativo e confirmação literal dos dois identificadores:

```bash
node scripts/firestore-recovery.mjs apply \
  --project=gen-lang-client-0982077967 \
  --database=ai-studio-logsticahospital-3eeee498-faa1-4326-8f4f-95d34b382ec1 \
  --confirm=projects/gen-lang-client-0982077967/databases/ai-studio-logsticahospital-3eeee498-faa1-4326-8f4f-95d34b382ec1
```

O comando é idempotente: mantém controles já corretos, cria o agendamento diário ausente ou ajusta sua retenção. Ele não lê, grava ou exclui documentos das coleções.

## Verificação do primeiro backup

Após a criação do agendamento, aguarde a execução do primeiro backup e rode:

```bash
npm run recovery:verify
```

O Bloco 0 só está concluído quando o resultado contém:

```json
{
  "pitrEnabled": true,
  "deleteProtectionEnabled": true,
  "dailyScheduleReady": true,
  "backupReady": true,
  "ready": true
}
```

## Ensaio de restauração

Liste os backups e copie o nome completo de um backup no estado `READY`:

```bash
gcloud firestore backups list \
  --project=gen-lang-client-0982077967 \
  --location=us-east1 \
  --format="table(name,database,state,snapshotTime)"
```

Gere o comando de restauração. O script apenas imprime o plano; ele não cria o banco:

```bash
node scripts/firestore-recovery.mjs restore-plan \
  --backup=projects/gen-lang-client-0982077967/locations/us-east1/backups/ID_DO_BACKUP \
  --target=emprovex-restore-AAAA-MM-DD
```

Execute o comando impresso somente em uma janela controlada. Nunca use o ID do banco de produção como destino.

Depois da restauração:

1. aguarde a operação terminar;
2. confirme que o banco restaurado está isolado da aplicação pública;
3. confira as coleções `alerts`, `comissoes`, `cronogramas`, `empenhos`, `invoices` e `settings`;
4. compare a quantidade de documentos com o banco de origem;
5. valide regras, índices e IAM;
6. registre data, backup utilizado, duração e resultado do teste;
7. não exclua o banco restaurado sem aprovação explícita.

## Condições que bloqueiam a conclusão

O Bloco 0 permanece incompleto se qualquer item abaixo ocorrer:

- projeto no plano Spark ou sem faturamento;
- ausência de permissão administrativa no Google Cloud;
- PITR desabilitado;
- proteção contra exclusão desabilitada;
- backup diário ausente ou com retenção inferior a 14 semanas;
- nenhum backup no estado `READY`;
- restauração ainda não testada.

