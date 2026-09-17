# EMPROVEX — Modelo de identidade multi-setor

## Status atual

O EMPROVEX continua trabalhando com dois contextos formais de conta:

- `platformAdmin` — administração da plataforma;
- `sector` — operação vinculada a um workspace.

A exceção controlada é a identidade fundadora `aprov1hgesm@gmail.com`, que pode assumir os dois contextos de interface na mesma sessão Firebase.

## Identidade fundadora

```text
aprov1hgesm@gmail.com
├── sector → workspace hgesm-aprov
└── platformAdmin → administração da plataforma
```

O perfil operacional é o padrão. A capacidade administrativa somente é ativada explicitamente pelo seletor de perfil.

Essa solução evita uma segunda conta administrativa e preserva a continuidade operacional do HGeSM.

## Novos setores

Novos setores continuam usando uma conta Google operacional única vinculada a exatamente um `workspaceId`.

O fluxo previsto é:

```text
Administração EMPROVEX cria setor
        ↓
EMPROVEX grava e-mail autorizado + workspaceId
        ↓
conta do setor faz primeiro login Google
        ↓
Firebase Auth valida a identidade
        ↓
EMPROVEX resolve o workspace autorizado
```

Novos setores não recebem capacidade administrativa por padrão.

## Workspace

O workspace representa um setor operacional isolado e contém, entre outros:

- `id`;
- `name`;
- `status`;
- `authorizedEmail`;
- `legacyWorkspace` durante a migração;
- `institutionalProfile`;
- metadados de criação e atualização.

## Persistência administrativa

Os diretórios administrativos usam:

```text
/platformAccounts/{emailNormalizado}
/workspaces/{workspaceId}
```

Para o HGeSM fundador, o documento de `platformAccounts` permanece do tipo `sector`. A capacidade de administração da mesma identidade é determinada pelo contexto de perfil e pelas Firestore Rules, não por um segundo documento administrativo.

## Isolamento

Enquanto o perfil `platformAdmin` estiver ativo, o cliente não deve carregar subscriptions operacionais. Enquanto o perfil `sector` estiver ativo, somente o workspace resolvido pode inicializar sua camada operacional.

O isolamento definitivo entre novos setores será reforçado nos blocos de paths por workspace e regras multi-tenant.

## Código associado

- `lib/platformIdentity.ts`
- `lib/hgesmWorkspace.ts`
- `lib/profileMode.ts`
- `lib/workspaceContext.ts`
- `lib/platformAdminStore.ts`
