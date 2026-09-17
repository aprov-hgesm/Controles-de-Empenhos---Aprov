# EMPROVEX — Bloco 12: cutover dos dados operacionais do HGeSM

## Objetivo

Mover o runtime das cinco coleções operacionais do HGeSM das coleções legadas para o workspace:

- `empenhos`;
- `alerts`;
- `invoices`;
- `comissoes`;
- `cronogramas`.

Destino:

```text
/workspaces/hgesm-aprov/<colecao>/...
```

O Bloco 11 já moveu os settings operacionais. Portanto o estado de entrada do Bloco 12 é:

```text
legacyDataMode=true
legacySettingsMode=false
```

`settings/global` continua global.

## Regra crítica do Bloco 12

O script histórico `migrate-hgesm-workspace.mjs copy` migra coleções e settings juntos. Depois do Bloco 11 ele não deve ser usado para ressincronizar o HGeSM, pois poderia sobrescrever o contador já ativo no workspace com o contador legado.

Para o Bloco 12 existe um sincronizador dedicado:

```text
scripts/sync-hgesm-workspace-data.mjs
```

Ele toca somente nas cinco coleções operacionais e nunca escreve em `/workspaces/hgesm-aprov/settings/...`.

## Verificação somente leitura

```bash
npm run data:hgesm:verify
```

O comando compara legado e workspace documento a documento nas cinco coleções e exige:

- mesma quantidade de documentos;
- nenhum documento faltante;
- nenhum documento diferente;
- nenhum documento extra;
- igualdade exata dos campos tipados do Firestore.

Resultado esperado:

```text
PARIDADE DE DADOS: READY
Settings do workspace: NÃO TOCADOS por este script.
```

## Gate final antes do cutover

```bash
npm run verify:hgesm:data-cutover
```

O gate é somente leitura e executa, em sequência:

1. paridade exata das cinco coleções;
2. auditoria estrutural e semântica do Bloco 10;
3. gate de settings/contador do Bloco 11;
4. validação de que o código ainda está em `legacyDataMode=true` e `legacySettingsMode=false`.

O cutover só pode ocorrer com:

```text
DATA CUTOVER: READY
```

## Se a cópia sombra estiver desatualizada

Como o HGeSM continua operando no legado até o cutover, podem existir alterações posteriores ao Bloco 9.

Primeiro crie um snapshot atual:

```bash
npm run snapshot:hgesm:create -- \
  --project=gen-lang-client-0982077967 \
  --database=ai-studio-logsticahospital-3eeee498-faa1-4326-8f4f-95d34b382ec1 \
  --workspace=hgesm-aprov
```

Depois use o sincronizador de dados com o manifesto recém-criado:

```bash
node scripts/sync-hgesm-workspace-data.mjs sync \
  --project=gen-lang-client-0982077967 \
  --database=ai-studio-logsticahospital-3eeee498-faa1-4326-8f4f-95d34b382ec1 \
  --workspace=hgesm-aprov \
  --snapshot="$HOME/emprovex-snapshots/hgesm-.../manifest.json" \
  --confirm=SYNC_DATA:gen-lang-client-0982077967:ai-studio-logsticahospital-3eeee498-faa1-4326-8f4f-95d34b382ec1:hgesm-aprov
```

Garantias dessa sincronização:

- não apaga documentos legados;
- bloqueia se houver documentos extras no destino;
- usa precondição `updateTime`/`exists=false` para evitar overwrite cego;
- exige recuperação nativa READY ou snapshot local íntegro e revalidado contra a origem ao vivo;
- não lê settings como fonte de cópia;
- não escreve settings do workspace;
- não muda `legacyDataMode`.

Depois da sincronização, execute novamente `npm run verify:hgesm:data-cutover`.

## Fase B — troca do runtime

Somente após `DATA CUTOVER: READY`, o contexto do HGeSM será alterado para:

```text
legacyDataMode=false
legacySettingsMode=false
```

A partir daí as cinco coleções e os settings operacionais serão workspace-scoped.

## Compatibilidade legada

As coleções legadas não serão apagadas no Bloco 12. Elas permanecem preservadas para rollback e para os blocos posteriores de compatibilidade/desativação controlada.

Nenhuma regra Firestore deve ser removida neste bloco.

## Rollback

Se o runtime apresentar regressão imediatamente após o cutover e nenhum dado novo tiver sido gravado no workspace, `legacyDataMode=true` pode ser restaurado.

Se houver qualquer operação nova após o cutover, não se deve reverter cegamente: será necessário reconciliar workspace e legado antes de mudar o modo, para evitar perda de dados recentes.

## Critério de encerramento

O Bloco 12 só é encerrado depois de:

1. `DATA CUTOVER: READY`;
2. `legacyDataMode=false` aplicado;
3. `legacySettingsMode=false` preservado;
4. typecheck e build aprovados;
5. deploy de produção confirmado;
6. smoke test operacional completo;
7. uma nova verificação do workspace após o cutover sem divergências estruturais.
