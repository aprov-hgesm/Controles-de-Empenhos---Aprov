# EMPROVEX — Cadastro administrativo de setores (Bloco 6)

## Objetivo

O Bloco 6 habilita o administrador da plataforma a cadastrar perfis de novos setores sem alterar o código para cada nova unidade.

## Conta administrativa

A conta bootstrap permanece:

`codex.martis.dev@gmail.com`

Ela pode consultar e criar somente os diretórios administrativos:

```text
/workspaces/{workspaceId}
/platformAccounts/{emailNormalizado}
```

O Bloco 6 **não concede** ao administrador acesso às coleções operacionais legadas do HGeSM.

## Cadastro de setor

O formulário administrativo coleta:

- nome do setor;
- identificador estável (`workspaceId`);
- conta Google autorizada;
- nome institucional;
- sigla opcional;
- nome da seção;
- local padrão de entrega opcional;
- cargo/função padrão opcional.

A criação usa uma transação Firestore única. O `Workspace` e a `SectorAccount` são criados juntos; se uma das validações falhar, nenhum dos dois registros é persistido.

Duplicidades bloqueadas:

- `workspaceId` já existente;
- conta Google já vinculada a qualquer perfil EMPROVEX;
- tentativa de reutilizar a conta administrativa como conta operacional.

## Materialização dos registros fundadores

No primeiro acesso administrativo com regras compatíveis, o sistema materializa de forma idempotente:

```text
platformAccounts/codex.martis.dev@gmail.com
  accountType: platformAdmin

platformAccounts/aprov1hgesm@gmail.com
  accountType: sector
  workspaceId: hgesm-aprov

workspaces/hgesm-aprov
  legacyWorkspace: true
```

Isso não move, copia ou altera empenhos, notas fiscais, comissões, cronogramas ou PDFs do HGeSM.

## Regras de segurança deste bloco

A versão do repositório de `firestore.rules` passa a distinguir:

- `isAuthorizedUser()` — conta operacional histórica do HGeSM;
- `isPlatformAdmin()` — conta administrativa da plataforma.

O `platformAdmin` recebe apenas `read` e `create` em `workspaces` e `platformAccounts`.

Não há permissão de `update` ou `delete` nesses diretórios neste bloco.

As coleções operacionais legadas permanecem restritas a `aprov1hgesm@gmail.com`.

## Dependência de implantação

O repositório não possui, neste momento, `firebase.json` nem workflow de GitHub Actions que publique `firestore.rules` automaticamente.

Portanto, fazer merge/commit de `firestore.rules` no GitHub **não altera as regras ativas do Firebase por si só**.

Enquanto a nova regra não estiver publicada no banco real, o painel administrativo exibirá um aviso de persistência bloqueada e manterá o botão de cadastro desabilitado. O HGeSM continua operando normalmente porque suas regras legadas não foram removidas da versão proposta.

## Arquivos principais

- `lib/platformAdminStore.ts`
- `hooks/usePlatformAdminDirectory.ts`
- `components/admin/CreateSectorModal.tsx`
- `components/admin/PlatformAdminView.tsx`
- `app/admin/page.tsx`
- `firestore.rules`

## Limite intencional do Bloco 6

Cadastrar um setor cria apenas seu perfil administrativo. A conta recém-cadastrada ainda não deve operar empenhos/NFs até que os blocos seguintes criem a estrutura operacional multi-tenant, regras por workspace e resolução persistente de identidade.
