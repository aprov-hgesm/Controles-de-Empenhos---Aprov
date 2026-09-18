# EMPROVEX — Bloco 17 — Provisionamento automático de workspaces

## Objetivo

Garantir que um setor novo seja criado já com o estado mínimo necessário para iniciar a operação, sem intervenção manual no Firestore.

## Provisionamento atômico

O cadastro administrativo cria, na mesma transação:

```text
/workspaces/{workspaceId}
/platformAccounts/{authorizedEmail}
/workspaces/{workspaceId}/settings/termoRecebimentoCounter
```

O contador inicial é:

```json
{
  "currentNumber": 0
}
```

Assim, o primeiro Termo de Recebimento do setor parte de uma base própria e independente dos demais workspaces.

## Estado inicial

Após o cadastro:

- workspace: ativo;
- conta Google: ativa e ainda sem UID até o primeiro login;
- contador TR: provisionado em zero;
- empenhos: coleção vazia até o primeiro cadastro;
- alertas: coleção vazia até o primeiro uso;
- notas fiscais: coleção vazia até o primeiro uso;
- comissões: coleção vazia até o primeiro uso;
- cronogramas: coleção vazia até o primeiro uso;
- Google Drive: ainda não configurado.

O Firestore não precisa criar coleções vazias fisicamente. Elas passam a existir quando o primeiro documento operacional for gravado.

## Google Drive

O Bloco 17 não cria `settings/documentStorage`.

Isso é intencional: o Google Drive precisa ser autorizado pela própria conta do setor, e a criação das pastas depende do token temporário obtido nesse onboarding. Essa etapa pertence ao Bloco 18.

## Segurança

O administrador da plataforma recebe permissão apenas para criar o contador inicial durante o provisionamento.

As Rules exigem:

- workspace ativo e consistente;
- conta de setor ativa e correspondente;
- `currentNumber = 0` na criação;
- nenhuma exclusão do contador;
- atualizações operacionais sem regressão do número;
- regra genérica de settings sem bypass para `termoRecebimentoCounter`.

O administrador continua sem acesso aos empenhos, notas fiscais, comissões, cronogramas e demais dados operacionais de setores externos.

## Integridade

Antes de criar um setor, a transação verifica a ausência de:

- workspace com o mesmo ID;
- conta Google já cadastrada;
- contador residual sob o mesmo workspaceId.

Se qualquer um desses itens existir, a criação é bloqueada e nenhum dos três documentos é persistido parcialmente.

## Validação

Gate local:

```bash
npm run verify:workspace-provisioning
```

Resultado esperado:

```text
WORKSPACE PROVISIONING: READY
```

Como o Bloco 17 altera `firestore.rules`, sua ativação em produção depende da publicação explícita das Rules no banco EMPROVEX correto antes do deploy do frontend.
