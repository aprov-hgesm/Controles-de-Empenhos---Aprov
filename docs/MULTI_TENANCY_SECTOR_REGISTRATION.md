# EMPROVEX — Cadastro administrativo de setores

## Objetivo

O painel administrativo permite cadastrar novos setores sem editar o código para cada unidade.

## Conta administrativa atual

A administração é exercida pela identidade fundadora:

```text
aprov1hgesm@gmail.com
```

Essa mesma sessão pode alternar entre o perfil operacional HGeSM e o perfil Administração EMPROVEX.

## Diretórios administrativos

No modo Administração, a identidade fundadora pode consultar e criar registros em:

```text
/workspaces/{workspaceId}
/platformAccounts/{emailNormalizado}
```

O cadastro de setor cria metadados administrativos e a relação de autorização. Ele não copia dados do HGeSM nem concede acesso a qualquer outro workspace.

## Cadastro de setor

O formulário coleta:

- nome do setor;
- `workspaceId`;
- conta Google autorizada;
- nome institucional;
- sigla opcional;
- nome da seção;
- local padrão de entrega opcional;
- cargo/função padrão opcional.

A criação usa uma transação Firestore única. `Workspace`, `SectorAccount` e o contador inicial de Termos de Recebimento são persistidos juntos ou nenhum deles é criado. O contador nasce em `currentNumber = 0`.

Duplicidades bloqueadas:

- `workspaceId` já existente;
- conta Google já vinculada;
- reutilização da conta institucional fundadora como novo setor.

A conta Google deve ser cadastrada usando o e-mail principal que efetivamente será devolvido pelo login Google/Firebase. A normalização preserva o nome local da conta e altera apenas caixa/espaços e o domínio histórico `googlemail.com` para `gmail.com`.

## Materialização dos registros fundadores

O workspace fundador permanece materializado em:

```text
platformAccounts/aprov1hgesm@gmail.com
  accountType: sector
  workspaceId: hgesm-aprov

workspaces/hgesm-aprov
  legacyWorkspace: true
```

A capacidade administrativa da conta fundadora é resolvida pelo contexto de perfil e pelas Firestore Rules, sem um segundo documento `platformAdmin`.

O HGeSM já opera nos paths de workspace com `legacyDataMode=false` e `legacySettingsMode=false`. O marcador `legacyWorkspace` identifica apenas a origem histórica do tenant fundador; ele não redireciona o runtime para coleções raiz.

## Regras de segurança

`firestore.rules` mantém a conta fundadora como administradora dos diretórios `workspaces` e `platformAccounts` e mantém os dados operacionais isolados por workspace.

Novos setores não recebem permissão administrativa e não existe bypass do administrador nas subcoleções operacionais de setores externos.

## Login de setores externos — Bloco 15

O login de setores previamente cadastrados está implementado.

Após o Google Sign-In, o EMPROVEX exige:

```text
platformAccounts/{email} existente e active
  -> accountType = sector
  -> workspaceId cadastrado
  -> workspaces/{workspaceId} existente e active
  -> authorizedEmail coerente
  -> contexto operacional associado à sessão
```

Somente depois dessa resolução são abertas as subscriptions do workspace.

O Bloco 16 complementa este fluxo: no primeiro acesso autorizado, o EMPROVEX grava o `firebaseUid` da sessão. Depois do vínculo, a conta precisa corresponder simultaneamente ao e-mail cadastrado e ao UID persistido.

## Provisionamento automático — Bloco 17

Novos setores já nascem com o estado operacional mínimo:

```text
workspace
+ platformAccount
+ settings/termoRecebimentoCounter (currentNumber = 0)
```

As coleções operacionais começam vazias e são materializadas conforme o uso. `settings/documentStorage` não é criado no cadastro.

## Onboarding Google Drive — Bloco 18

No primeiro acesso operacional, o próprio setor pode ativar seu Google Drive usando a mesma Conta Google autorizada. O EMPROVEX cria ou reutiliza `EMPROVEX / Notas de Empenho / Notas Fiscais` e grava os IDs das pastas em `settings/documentStorage` do próprio workspace.

Tokens não são persistidos; após recarregar a aplicação, o setor apenas reconecta a autorização temporária.

## Ciclo de vida administrativo — Bloco 19

Setores externos podem ter seus dados institucionais editados e podem ser suspensos ou reativados pela Administração EMPROVEX. Workspace ID, conta Google e UID permanecem imutáveis.

Suspensão e reativação alteram workspace e conta operacional na mesma transação. Um setor suspenso perde acesso imediatamente pelas Rules e uma sessão externa já aberta é encerrada pelo observador de ciclo de vida.

O workspace fundador HGeSM é protegido contra essas alterações.

## Testes automatizados de isolamento — Bloco 20

O repositório possui uma suíte baseada no Firebase Emulator Suite que valida isolamento A ↔ B, UID divergente, bootstrap sem UID, suspensão, workspace adulterado, ausência de bypass operacional do administrador e isolamento de `settings/documentStorage`.

A suíte usa apenas dados descartáveis do projeto local `demo-emprovex-security` e é executada pelo CI antes do build de produção.

## Homologação real — Bloco 21

A preparação técnica da homologação está implementada. O repositório possui um gate de prontidão de produção e um runbook específico para cadastrar, autenticar, conectar o Google Drive, testar operação, suspender e reativar um segundo setor real.

O Bloco 21 permanece **em homologação** até que uma segunda Conta Google real conclua todas as fases em produção.

Gate:

```bash
npm run verify:production-multitenant-readiness
```

Resultado esperado:

```text
PRODUCTION MULTI-TENANT READINESS: READY
```

