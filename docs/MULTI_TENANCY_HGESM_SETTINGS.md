# EMPROVEX — Bloco 11: settings operacionais por workspace

## Objetivo

Separar a migração dos settings operacionais da migração das coleções principais.

Até o Bloco 10, `legacyDataMode` controlava tanto:

- `empenhos`, `alerts`, `invoices`, `comissoes` e `cronogramas`; quanto
- `settings/termoRecebimentoCounter`.

No Bloco 11 passam a existir dois eixos independentes:

- `legacyDataMode`: controla as coleções operacionais principais;
- `legacySettingsMode`: controla settings operacionais como `termoRecebimentoCounter`.

Isso permite mover o contador de TR para `/workspaces/{workspaceId}/settings/...` antes do Bloco 12, sem redirecionar ainda empenhos, NFs, alertas, comissões ou cronogramas.

`settings/global` continua global e não pertence aos settings operacionais do setor.

## Fase A — preparação sem mudança de runtime

O HGeSM permanece inicialmente com:

```text
legacyDataMode=true
legacySettingsMode=true
```

Portanto essa fase é uma refatoração estrutural sem mudança de comportamento do sistema em produção.

## Gate obrigatório antes do cutover

Execute no Google Cloud Shell:

```bash
npm run verify:hgesm:settings-cutover
```

A ferramenta é somente leitura e valida:

- workspace `hgesm-aprov` ativo;
- conta operacional `aprov1hgesm@gmail.com` ativa e vinculada ao workspace;
- existência do contador legado;
- existência do contador do workspace;
- igualdade de `currentNumber` entre os dois contadores;
- maior `termoNumero` existente nas NFs legadas e do workspace;
- contador não inferior ao maior TR já emitido;
- mesma quantidade de NFs nos dois lados.

O cutover só pode prosseguir com:

```text
SETTINGS CUTOVER: READY
```

Qualquer divergência mantém `legacySettingsMode=true`.

## Fase B — settings do HGeSM no workspace

Após o gate READY, o contexto do HGeSM pode mudar para:

```text
legacyDataMode=true
legacySettingsMode=false
```

Nesse estado:

- empenhos/NFs/alertas/comissões/cronogramas continuam nas coleções legadas;
- o contador de TR passa a usar `workspaces/hgesm-aprov/settings/termoRecebimentoCounter`;
- `settings/global` continua global;
- outros workspaces usam seus próprios settings e não compartilham sequência de TR.

## Segurança Firestore

As Rules já protegem:

```text
/workspaces/{workspaceId}/settings/{id}
```

com `canAccessWorkspace(workspaceId)`. Não existe bypass administrativo para dados operacionais de outros setores.

## Rollback

Antes do primeiro novo TR após o cutover, reverter `legacySettingsMode=true` é simples porque os contadores ainda são iguais.

Depois que o contador do workspace avançar, não se deve voltar cegamente ao contador legado, pois ele poderá estar defasado. Nesse caso deve-se comparar os dois contadores e o maior `termoNumero` das NFs antes de qualquer reversão.

O snapshot do Bloco 9 permanece preservado como referência histórica, mas o rollback de settings após novas operações deve considerar dados criados depois do snapshot.

## Critério de encerramento do Bloco 11

O bloco é encerrado somente depois de:

1. `verify:hgesm:settings-cutover` retornar `READY`;
2. `legacySettingsMode=false` ser aplicado ao HGeSM;
3. typecheck/build passarem;
4. produção continuar com `legacyDataMode=true`;
5. um smoke test confirmar navegação e geração/consulta de TR sem regressão.

A troca das coleções operacionais principais para `/workspaces/hgesm-aprov/...` permanece reservada ao Bloco 12.
