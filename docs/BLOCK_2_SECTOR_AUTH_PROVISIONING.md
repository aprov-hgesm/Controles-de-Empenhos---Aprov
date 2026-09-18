# Bloco 2 — Provisionamento seguro de autenticação de setores

Status-alvo: `SECTOR AUTH PROVISIONING: READY`.

## Objetivo

O cadastro administrativo passa a criar a identidade Firebase e o diretório multi-tenant como uma única operação lógica controlada pelo servidor. O navegador não grava mais diretamente um novo `workspace`, `platformAccount` ou contador de TR.

## Fluxo

1. O fundador continua autenticado pelo Google.
2. O cliente obtém o Firebase ID token da sessão e chama `POST /api/admin/provision-sector`.
3. O servidor valida que a sessão pertence a `aprov1hgesm@gmail.com`, está verificada e foi iniciada por `google.com`.
4. O servidor adquire locks temporários por e-mail e workspace.
5. O usuário Firebase é localizado por e-mail. Se não existir, é criado com e-mail + senha. Se já existir, seu UID é reutilizado; a senha inicial é aplicada pelo fluxo administrativo.
6. O servidor cria atomicamente:
   - `workspaces/{workspaceId}`;
   - `platformAccounts/{email}` com `authProvider: password` e `firebaseUid`;
   - `workspaces/{workspaceId}/settings/termoRecebimentoCounter` com zero.
7. Locks são removidos após a conclusão.

A senha existe apenas no request e nas chamadas de administração do Firebase Auth. Ela nunca é incluída em documentos Firestore, logs de sucesso ou respostas da API.

## Rollback e recuperação

Se a identidade Firebase recém-criada não puder ser acompanhada pela criação do diretório, o servidor remove o usuário criado. Se o diretório já tiver sido criado e a etapa posterior falhar, os três documentos são removidos. Caso um rollback não possa ser concluído, os locks ficam marcados como `recovery-required`, com operationId, e-mail, workspace e UID — nunca com a senha.

## Credencial do servidor

A rota requer `FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON` somente no ambiente server-side. O valor deve ser o JSON de uma conta de serviço do mesmo projeto Firebase, com permissões necessárias para administrar Firebase Authentication e Firestore.

Esta credencial nunca deve receber prefixo `NEXT_PUBLIC_`, ser gravada no repositório ou enviada ao navegador.

## Compatibilidade

A criação server-side não altera os dados do workspace fundador, as coleções operacionais, o Google Drive ou a tela principal de login. Contas legadas sem UID continuam suportadas pelo bootstrap existente; novos setores já nascem pré-vinculados ao UID.
