# EMPROVEX — Corte controlado para autenticação por e-mail e senha

## Decisão
Todas as contas usam Firebase Authentication com sign_in_provider=password. Endereços `@gmail.com` continuam sendo e-mails válidos. O login social Google deixa de existir na tela e nas barreiras administrativas. A integração documental Google Drive permanece OAuth independente e não troca a sessão Firebase.

## Estado de produção
NÃO fazer merge, publicar Rules ou desabilitar o provedor Google do Firebase antes do corte controlado. A alteração deste PR é somente código-fonte e testes, não uma migração de identidade executada.

## Procedimento obrigatório (ambiente administrativo seguro)
1. Obter a identidade Firebase Authentication atual de `aprov1hgesm@gmail.com`, registrar o UID existente e confirmar que o e-mail está verificado. Não criar uma nova conta e nunca excluir a conta fundadora.
2. Verificar backup recente de Auth/Firestore e as permissões existentes do workspace `hgesm-aprov`. Salvar o UID de referência em um registro operacional privado (nunca em Git).
3. Habilitar `Email/Password` no Firebase Authentication. **Não desabilitar Google ainda.**
4. Via Firebase Admin SDK em ambiente confiável, definir uma senha forte na identidade EXISTENTE usando `getUserByEmail` e `updateUser(existing.uid, { password: senhaInformadaForaDoRepositorio })`. Não imprimir, versionar nem registrar a senha no shell/history/logs. Exigir confirmação de UID inalterado. Se o UID divergir, abortar.
5. Validar a autenticação por senha no Auth Emulator e, no projeto real, com uma solicitação controlada ao Firebase Authentication, confirmando UID, email_verified e `sign_in_provider=password`. A produção antiga ainda rejeitará essa sessão até o corte completo.
6. Inspecionar `platformAccounts/aprov1hgesm@gmail.com` e migrar, via IAM/serviço administrativo, `authProvider` para `password` e `firebaseUid` para o UID já existente, se aplicável, preservando os outros campos e dados. Registrar auditoria administrativa.
7. Homologar simultaneamente as novas Firestore Rules, o código/rotas do servidor e a interface em ambiente de teste, inclusive alternância fundador (Operacional/Admin), acesso ao HGeSM, gerenciamento de setores, cobrança e OAuth independente do Drive. Não fazer deploy do cliente sem Rules compatíveis nem de Rules novas sem uma senha de fundador funcional.
8. Efetuar o corte coordenado de produção, validar login real de fundador por senha, acesso administrativo, acesso a depósitos, dados e Drive e login por senha de uma conta externa.
9. Somente após PASS dos cenários acima, desabilitar o provedor Google **no Firebase Authentication** (configuração global), mantendo habilitadas as credenciais OAuth Google Cloud necessárias ao Drive. Revogar sessões antigas no Firebase Admin e renovar login; validar falha de acesso pelo Google e êxito do acesso por senha.
10. Caso qualquer verificação falhe, reverter código e Rules para conjunto COMPATÍVEL com método de acesso ainda operacional; nunca remover a última via de autenticação válida.

## Cuidados
- O mesmo UID e o mesmo e-mail são invariantes da migração; dados e workspaces não são recriados.
- Firebase login e OAuth do Drive são serviços independentes; não remover OAuth Consent Screen nem credenciais Drive.
- O corte depende de validação manual/operacional; este PR não executa mudanças no Firebase Authentication nem publica Rules.
- Verificar a compatibilidade das Rules atualmente publicadas antes de qualquer deploy; sua versão pode diferir da do repositório.
