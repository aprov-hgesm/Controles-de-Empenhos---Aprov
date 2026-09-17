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

O Bloco 11 já moveu os settings operacionais. O estado de entrada do Bloco 12 era:

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

## Verificação e sincronização executadas

O primeiro gate detectou três NFs divergentes entre legado e workspace:

```text
90710003
20887
71975
```

Foi criado um snapshot local atualizado e validado contra a origem ao vivo. Em seguida, o sincronizador dedicado atualizou somente essas três NFs no workspace. Empenhos, alertas, comissões e cronogramas permaneceram inalterados e os settings do workspace não foram tocados.

Após a sincronização, a paridade ficou:

```text
empenhos     59/59   faltando=0 diferentes=0 extras=0
alerts      157/157  faltando=0 diferentes=0 extras=0
invoices    138/138  faltando=0 diferentes=0 extras=0
comissoes      2/2   faltando=0 diferentes=0 extras=0
cronogramas    6/6   faltando=0 diferentes=0 extras=0
```

## Gate final executado

O gate final `npm run verify:hgesm:data-cutover` foi executado após a ressincronização e retornou:

```text
PARIDADE DE DADOS: READY
INTEGRIDADE SEMÂNTICA: READY
SETTINGS CUTOVER: READY
Estado de código esperado: OK
DATA CUTOVER: READY
```

A auditoria semântica terminou com zero erros bloqueantes. Os 34 avisos existentes são históricos e referem-se a termos numerados sem `termoEmissaoDate`; não são divergências produzidas pela migração.

No momento do gate:

```text
contador legado: 62
contador workspace: 62
maior TR nas NFs: 62
NFs legado/workspace: 138/138
```

## Fase B — troca do runtime executada

Após `DATA CUTOVER: READY`, o contexto do HGeSM foi alterado para:

```text
legacyDataMode=false
legacySettingsMode=false
```

Estado atual:

- empenhos usam `/workspaces/hgesm-aprov/empenhos/...`;
- alertas usam `/workspaces/hgesm-aprov/alerts/...`;
- NFs usam `/workspaces/hgesm-aprov/invoices/...`;
- comissões usam `/workspaces/hgesm-aprov/comissoes/...`;
- cronogramas usam `/workspaces/hgesm-aprov/cronogramas/...`;
- settings operacionais usam `/workspaces/hgesm-aprov/settings/...`;
- `settings/global` continua global.

## Compatibilidade legada

As coleções legadas não foram apagadas. Elas permanecem preservadas para rollback e para os blocos posteriores de compatibilidade/desativação controlada.

Nenhuma regra Firestore foi removida neste bloco.

## Rollback

Se o runtime apresentar regressão imediatamente após o cutover e nenhum dado novo tiver sido gravado no workspace, `legacyDataMode=true` pode ser restaurado.

Se houver qualquer operação nova após o cutover, não se deve reverter cegamente: será necessário reconciliar workspace e legado antes de mudar o modo, para evitar perda de dados recentes.

## Critério de encerramento

O Bloco 12 só é encerrado depois de:

1. `DATA CUTOVER: READY` — concluído;
2. `legacyDataMode=false` aplicado — concluído;
3. `legacySettingsMode=false` preservado — concluído;
4. typecheck e build aprovados — pendente após o commit de cutover;
5. deploy de produção confirmado — pendente;
6. smoke test operacional completo — pendente;
7. nova verificação pós-cutover sem regressão estrutural — pendente.
