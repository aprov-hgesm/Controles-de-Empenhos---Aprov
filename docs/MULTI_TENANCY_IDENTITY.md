# EMPROVEX — Modelo de identidade multi-setor (Bloco 1)

## Status

Este documento define o modelo de identidade que será utilizado na evolução multi-setor do EMPROVEX.

**Importante:** o Bloco 1 é apenas fundacional. Ele não altera o login atual, as regras do Firestore, as subscriptions operacionais nem os dados do HGeSM.

## Tipos de conta

O EMPROVEX trabalhará inicialmente com apenas dois tipos de identidade:

### `platformAdmin`

Conta responsável pela administração da plataforma.

Responsabilidades previstas:

- criar novos setores;
- vincular a conta Google operacional de cada setor;
- ativar/desativar setores;
- acompanhar status técnico e armazenamento;
- administrar configurações globais da plataforma.

Por desenho, `platformAdmin` **não pertence a workspace operacional** e não deve receber acesso automático aos empenhos, notas fiscais, comissões, cronogramas ou PDFs dos setores.

### `sector`

Conta Google operacional compartilhada pelo setor.

Cada conta `sector` pertence a exatamente um `workspaceId` e deve acessar apenas os dados desse workspace.

A conta pode ser utilizada simultaneamente em vários dispositivos do mesmo setor. A auditoria registra a conta/setor responsável pela ação, não a pessoa física que estava usando um dispositivo específico.

## Pré-autorização por e-mail

Novos setores precisam poder ser cadastrados pelo administrador antes do primeiro login da conta Google.

Por isso, o registro de acesso será criado inicialmente com o e-mail normalizado. O campo `firebaseUid` é opcional e poderá ser preenchido no primeiro login bem-sucedido.

Fluxo futuro:

```text
platformAdmin cria setor
        ↓
EMPROVEX grava e-mail autorizado + workspaceId
        ↓
conta do setor faz primeiro login Google
        ↓
Firebase Auth valida a identidade
        ↓
EMPROVEX localiza autorização pelo e-mail
        ↓
associa firebaseUid ao registro existente
```

## Workspace

O workspace representa um setor operacional isolado.

Campos-base definidos no Bloco 1:

- `id` — identificador estável do workspace;
- `name` — nome de exibição;
- `status` — `active` ou `disabled`;
- `authorizedEmail` — conta Google operacional única do setor;
- `legacyWorkspace` — marcador temporário para o workspace fundador durante a migração;
- `institutionalProfile` — identidade institucional usada em documentos;
- metadados de criação/atualização.

## Identidade institucional

Como documentos atuais possuem textos específicos do HGeSM, o workspace terá um perfil institucional próprio, incluindo:

- nome da organização;
- sigla/nome curto;
- nome do setor;
- linhas de cabeçalho documental;
- local padrão de entrega;
- função/cargo padrão do responsável.

Isso permitirá preservar exatamente a aparência documental do HGeSM e, ao mesmo tempo, gerar documentos adequados para futuros setores.

## Persistência planejada — ainda não ativa

Os próximos blocos poderão materializar o modelo em coleções administrativas semelhantes a:

```text
/platformAccounts/{emailNormalizado}
/workspaces/{workspaceId}
```

Essa estrutura **ainda não é utilizada pelo runtime no Bloco 1**.

## Regras de compatibilidade do Bloco 1

1. `aprov1hgesm@gmail.com` continua sendo o único usuário efetivamente autorizado pelas regras atuais.
2. Nenhum dado operacional é movido.
3. Nenhuma collection existente muda de caminho.
4. Nenhum PDF é movido ou renomeado.
5. O contador de TR permanece global por enquanto.
6. `codex.martis.dev@gmail.com` ainda não recebe autorização de runtime neste bloco.
7. O GitHub, Vercel e o projeto Firebase permanecem inalterados.

## Código associado

O contrato TypeScript desta arquitetura está em:

`lib/platformIdentity.ts`

Ele define:

- `PlatformAdminAccount`;
- `SectorAccount`;
- `PlatformAccount`;
- `Workspace`;
- `WorkspaceInstitutionalProfile`;
- normalização/validação de e-mails;
- normalização/validação de `workspaceId`;
- type guards para `platformAdmin` e `sector`.

## Próximo bloco

O Bloco 2 fará o bootstrap controlado do administrador da plataforma, mantendo o HGeSM operacional e sem ampliar prematuramente o acesso às coleções globais.
