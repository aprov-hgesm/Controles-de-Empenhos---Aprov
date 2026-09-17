# EMPROVEX — Firestore Rules por workspace (Bloco 8)

## Objetivo

O Bloco 8 cria o isolamento de segurança no Firestore para a arquitetura multi-setor preparada no Bloco 7.

A mudança preserva integralmente a operação legada do HGeSM enquanto adiciona regras para futuros dados em `/workspaces/{workspaceId}/...`.

## Princípio de autorização

O acesso operacional de um workspace exige simultaneamente:

1. sessão Firebase autenticada e e-mail verificado;
2. workspace existente e com `status = active`;
3. documento `platformAccounts/{authorizedEmail}` existente;
4. conta com `accountType = sector` e `status = active`;
5. `account.workspaceId` igual ao workspace solicitado;
6. `account.email` igual ao `authorizedEmail` do workspace;
7. identidade Firebase compatível com a conta, por e-mail ou `firebaseUid` vinculado.

Dessa forma, conhecer ou manipular um `workspaceId` no cliente não concede acesso ao conteúdo de outro setor.

## Administrador da plataforma

A identidade fundadora `aprov1hgesm@gmail.com` continua sendo o administrador da plataforma.

O administrador pode listar, criar e atualizar metadados de:

- `/workspaces/{workspaceId}`;
- `/platformAccounts/{accountId}`.

Não existe bypass administrativo nas subcoleções operacionais. Portanto, ser administrador não concede acesso automático aos dados operacionais dos futuros setores.

Como o HGeSM usa a mesma identidade Firebase para os modos `sector` e `platformAdmin`, as Rules não distinguem o seletor de perfil da interface. Essa separação continua sendo de contexto de UI; a autorização Firestore é baseada na identidade autenticada.

## Integridade do diretório administrativo

Criações e atualizações de workspaces e contas precisam permanecer consistentes.

Um workspace somente pode ser escrito pelo administrador quando existe, após a transação, uma conta de setor correspondente ao seu `authorizedEmail` e apontando para o mesmo `workspaceId`.

Uma conta de setor somente pode ser escrita quando existe, após a transação, um workspace correspondente cujo `authorizedEmail` seja o ID/e-mail da conta.

Exclusões diretas de workspaces e contas estão bloqueadas neste bloco. A desativação deve ser feita por `status = disabled`, preservando rastreabilidade e evitando órfãos.

## Paths operacionais protegidos

Os seguintes paths possuem `read/write` somente para a conta operacional autorizada daquele workspace:

```text
/workspaces/{workspaceId}/empenhos/{id}
/workspaces/{workspaceId}/alerts/{id}
/workspaces/{workspaceId}/invoices/{id}
/workspaces/{workspaceId}/comissoes/{id}
/workspaces/{workspaceId}/cronogramas/{id}
/workspaces/{workspaceId}/settings/{id}
```

Esses paths correspondem à camada `lib/operationalPaths.ts` introduzida no Bloco 7.

## Compatibilidade do HGeSM

O HGeSM ainda usa `legacyDataMode=true`; portanto, seus dados permanecem temporariamente nas coleções raiz:

```text
/empenhos
/alerts
/invoices
/comissoes
/cronogramas
/settings/termoRecebimentoCounter
```

Essas coleções continuam restritas exclusivamente a `aprov1hgesm@gmail.com`.

Nenhum documento operacional é migrado neste bloco.

## Settings globais

Antes deste bloco, todo `/settings/{id}` possuía leitura pública.

Agora somente:

```text
/settings/global
```

continua com leitura pública, pois contém identidade visual/configuração necessária antes do login.

Os demais documentos de `/settings` exigem a identidade fundadora enquanto estiverem no modelo legado. Para futuros workspaces, configurações operacionais ficam em `/workspaces/{workspaceId}/settings/{id}` e seguem o isolamento do próprio workspace.

## Preparação para o primeiro login de novos setores

As Rules já aceitam correspondência por `firebaseUid` quando esse campo estiver associado à conta. O fluxo seguro de primeiro login e vinculação de UID será implementado em bloco posterior antes da ativação de setores externos.

O Bloco 8, por si só, não autoriza um novo setor a entrar na aplicação.

## Fora de escopo

Este bloco não:

- ativa login para setores externos;
- migra o HGeSM para subcoleções de workspace;
- altera paths de PDFs no Vercel Blob;
- altera APIs server-side de documentos;
- altera numeração ou histórico de Termos de Recebimento.

## Validação necessária

Antes de considerar o bloco ativo em produção, a nova versão de `firestore.rules` precisa ser compilada e publicada explicitamente no banco EMPROVEX:

```text
ai-studio-logsticahospital-3eeee498-faa1-4326-8f4f-95d34b382ec1
```

Após o deploy das Rules, deve ser repetido o smoke test do HGeSM para confirmar leitura, escrita operacional e acesso ao painel administrativo.
