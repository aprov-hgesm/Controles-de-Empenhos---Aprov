# EMPROVEX — Bootstrap administrativo (Bloco 2)

## Objetivo

O Bloco 2 registra formalmente a conta administrativa inicial da plataforma:

`codex.martis.dev@gmail.com`

Tipo de conta:

`platformAdmin`

A finalidade desta conta é administrar a plataforma EMPROVEX. Ela não representa um setor operacional e não deve receber acesso automático aos empenhos, notas fiscais, comissões, cronogramas, TRs ou PDFs dos workspaces.

## Implementação

O contrato de bootstrap está em:

`lib/platformBootstrap.ts`

Ele define:

- `BOOTSTRAP_PLATFORM_ADMIN_EMAIL`;
- `BOOTSTRAP_PLATFORM_ADMIN_SOURCE`;
- `isBootstrapPlatformAdminEmail()`;
- `createBootstrapPlatformAdminAccount()`.

O objeto gerado segue o contrato `PlatformAdminAccount` criado no Bloco 1.

## Segurança e compatibilidade

Este bloco é deliberadamente aditivo e não altera o runtime atual do HGeSM.

Permanece verdadeiro após o Bloco 2:

1. `aprov1hgesm@gmail.com` continua sendo a única conta autorizada pelas regras atuais do Firestore para as coleções operacionais globais.
2. `codex.martis.dev@gmail.com` ainda não foi adicionada às regras atuais do Firestore.
3. A conta administrativa ainda não inicializa uma interface própria no runtime.
4. Nenhuma collection operacional foi movida.
5. Nenhum documento do Vercel Blob foi movido ou teve autorização ampliada.
6. Nenhum contador de TR foi alterado.
7. GitHub, Vercel e o projeto Firebase continuam os mesmos.

## Por que a conta não é adicionada agora às regras existentes

As regras atuais protegem coleções globais do HGeSM. Adicionar o novo administrador diretamente à função de autorização atual ampliaria o acesso dele aos dados operacionais antes da existência do isolamento por workspace.

A sequência segura é:

```text
Bloco 2 — registrar identidade bootstrap
        ↓
Bloco 3 — registrar HGeSM como setor fundador
        ↓
Bloco 4 — resolver contexto da conta antes de subscriptions
        ↓
Blocos seguintes — materializar persistência e regras multi-tenant
        ↓
só então ativar o acesso administrativo completo
```

## Estado do firebaseUid

O bootstrap não exige cadastro manual antecipado no Firebase Authentication.

O campo `firebaseUid` do `PlatformAdminAccount` permanece ausente até que a conta faça autenticação Google em uma etapa futura em que o runtime já consiga resolver `platformAdmin` sem abrir subscriptions operacionais.

## Próximo bloco

O Bloco 3 registra o HGeSM como workspace fundador, associado à conta operacional `aprov1hgesm@gmail.com`, ainda sem migrar os dados das coleções atuais.
