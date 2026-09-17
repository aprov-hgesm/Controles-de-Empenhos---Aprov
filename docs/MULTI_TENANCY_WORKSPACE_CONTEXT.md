# EMPROVEX — Workspace Context

## Objetivo

A camada de contexto resolve a identidade autenticada antes de qualquer subscription operacional do Firestore.

## Resolução atual

A identidade fundadora `aprov1hgesm@gmail.com` possui dois perfis na mesma sessão:

```text
Perfil HGeSM → sector / workspace hgesm-aprov
Perfil Administração → platformAdmin / sem workspace operacional
```

Qualquer outra conta ainda não cadastrada é classificada como `unauthorized`.

A implementação central está em `lib/workspaceContext.ts`, com o modo ativo controlado por `lib/profileMode.ts`.

## Estados do contexto

```text
anonymous
platformAdmin
sector
unauthorized
```

Somente `sector` com `canLoadOperationalData=true` pode inicializar a camada operacional.

## Compatibilidade do HGeSM

Os dados do HGeSM ainda permanecem temporariamente nas coleções globais legadas:

```text
/empenhos
/alerts
/invoices
/comissoes
/cronogramas
```

Por isso, o workspace fundador utiliza `legacyDataMode=true` até a migração controlada para paths por workspace.

## Trava de subscriptions

```text
Firebase Auth
    ↓
resolveWorkspaceContext(email + perfil ativo)
    ↓
sector + legacyDataMode
    ↓
subscriptions operacionais legadas do HGeSM

platformAdmin / unauthorized / anonymous
    ↓
nenhuma subscription operacional
```

## Alternância de perfil

O perfil padrão da conta fundadora é o HGeSM. Ao selecionar Administração, o modo ativo é alterado e o usuário é encaminhado para `/admin` sem novo login. Ao escolher `Voltar ao HGeSM`, o modo retorna a `sector` e a interface operacional é restaurada.

## Contas não autorizadas

Depois do popup Google, contas que não correspondem a uma identidade reconhecida são desconectadas antes de poderem abrir subscriptions operacionais.

## Próximos passos

A resolução estática do workspace fundador será gradualmente substituída por resolução persistente dos setores cadastrados, mantendo o mesmo contrato de segurança para impedir leitura cruzada entre workspaces.
