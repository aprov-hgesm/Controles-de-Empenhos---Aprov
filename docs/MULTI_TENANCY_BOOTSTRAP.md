# EMPROVEX — Bootstrap administrativo

## Status atual

O desenho original do Bloco 2 foi substituído pelo **Bloco 6.1 — conta fundadora multiperfil**.

A identidade fundadora atual é:

```text
aprov1hgesm@gmail.com
```

A mesma sessão Firebase pode operar em dois contextos de interface:

```text
Perfil operacional HGeSM → sector / workspace hgesm-aprov
Perfil Administração EMPROVEX → platformAdmin / sem subscriptions operacionais
```

O perfil operacional é o padrão. O modo administrativo somente é ativado explicitamente pelo seletor de perfil.

## Implementação atual

A arquitetura não utiliza mais um arquivo ou uma conta bootstrap administrativa separada.

Os contratos relevantes estão em:

- `lib/hgesmWorkspace.ts` — identidade e workspace fundador;
- `lib/profileMode.ts` — alternância de perfil;
- `lib/workspaceContext.ts` — resolução segura do contexto;
- `lib/platformAdminStore.ts` — metadados administrativos;
- `firestore.rules` — autorização do diretório administrativo e das coleções legadas.

## Segurança e compatibilidade

A troca de perfil não cria uma segunda autenticação. O Firebase continua vendo a mesma identidade institucional, enquanto o EMPROVEX controla qual contexto de interface está ativo.

No modo Administração:

- não são abertas subscriptions de empenhos, notas fiscais, comissões, cronogramas ou alertas;
- o painel trabalha somente com os diretórios administrativos;
- os dados operacionais legados do HGeSM não são migrados ou alterados.

No modo HGeSM:

- o workspace `hgesm-aprov` continua usando temporariamente as coleções globais legadas;
- os fluxos atuais permanecem preservados até a migração multi-tenant controlada.

## Persistência fundadora

O sistema materializa somente:

```text
platformAccounts/aprov1hgesm@gmail.com
  accountType: sector
  workspaceId: hgesm-aprov

workspaces/hgesm-aprov
  legacyWorkspace: true
```

A capacidade administrativa da identidade fundadora é resolvida pelo contexto de perfil e pelas Firestore Rules, sem necessidade de um segundo documento de conta administrativa.
