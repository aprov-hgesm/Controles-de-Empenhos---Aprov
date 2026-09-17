# EMPROVEX — Workspace Context (Bloco 4)

## Objetivo

O Bloco 4 introduz a primeira barreira de runtime da evolução multi-setor: a identidade autenticada precisa ser resolvida antes de qualquer subscription operacional do Firestore.

## Resolução atual

Nesta fase de transição existem apenas dois registros conhecidos:

- `codex.martis.dev@gmail.com` → `platformAdmin`;
- `aprov1hgesm@gmail.com` → `sector`, workspace `hgesm-aprov`.

Qualquer outro e-mail é classificado como `unauthorized`.

A implementação central está em `lib/workspaceContext.ts`.

## Estados do contexto

```text
anonymous
platformAdmin
sector
unauthorized
```

Somente o estado `sector` com `canLoadOperationalData=true` pode inicializar a camada operacional.

## Compatibilidade do HGeSM

Os dados do HGeSM ainda estão nas coleções globais legadas:

```text
/empenhos
/alerts
/invoices
/comissoes
/cronogramas
```

Por isso, o contexto do workspace fundador possui temporariamente `legacyDataMode=true`.

Esse marcador permite que `useOperationalData()` continue usando os paths atuais somente para `hgesm-aprov`, preservando o funcionamento existente até a migração controlada das coleções.

Nenhum futuro setor deverá receber `legacyDataMode=true`.

## Trava de subscriptions

Antes do Bloco 4, bastava existir um usuário Firebase autenticado para o navegador assinar as cinco coleções globais.

Agora o fluxo é:

```text
Firebase Auth
    ↓
resolveWorkspaceContext(email)
    ↓
sector autorizado + legacyDataMode?
    ↓ sim
subscriptions globais temporárias do HGeSM

platformAdmin / unauthorized / anonymous
    ↓
nenhuma subscription operacional
```

## Login de contas não autorizadas

Depois do popup Google, `signInUser()` resolve imediatamente o contexto. Contas desconhecidas são desconectadas e a operação é rejeitada antes de poderem abrir subscriptions operacionais.

## Platform Admin

A conta `codex.martis.dev@gmail.com` já é reconhecida em runtime como `platformAdmin`, mas deliberadamente recebe:

```text
canLoadOperationalData = false
workspaceId = null
```

Portanto ela não consulta empenhos, NFs, comissões, cronogramas ou alertas do HGeSM.

A interface administrativa própria será implementada no próximo bloco. Até lá, o Bloco 4 trata exclusivamente da separação de contexto e da proteção contra leitura operacional indevida.

## O que não mudou

- regras atuais do Firestore;
- paths das coleções;
- dados do HGeSM;
- PDFs existentes;
- contador de TR;
- projeto Firebase;
- Vercel;
- GitHub;
- fluxos operacionais do workspace fundador.

## Próximo bloco

O Bloco 5 criará a interface administrativa separada para `platformAdmin`, utilizando o contexto já resolvido para impedir que o administrador seja encaminhado ao dashboard operacional.
