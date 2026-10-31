# EMPROVEX — Login visual por e-mail e senha; Google Firebase preservado

## Decisão definitiva — 30/10/2026
- Publicação parcial: apresentar e-mail/senha para todos, mantendo o botão Google visível para o fundador.
- **Manter Email/Password e Google habilitados em Firebase Authentication.** Não executar a etapa de desabilitar Google.
- Para a identidade fundadora existente, permitir sessões Firebase previamente vinculadas com `sign_in_provider=password` **ou** `google.com`; os endpoints e Firestore Rules verificam o provider real. Manter o botão Google visível nesta publicação parcial.
- Setores externos permanecem vinculados exclusivamente ao provider `password`; nenhuma abertura de login social para contas externas.
- O fluxo de Google Drive/GIS continua independente, com validação do e-mail esperado, sem reautenticar a sessão Firebase.
- Os dois métodos permanecem disponíveis visualmente para a conta fundadora; Google continua habilitado no Firebase.

## Identidade fundadora — evidência operacional confirmada pelo administrador
- E-mail: `aprov1hgesm@gmail.com`
- Projeto: `gen-lang-client-0982077967`
- UID atual: `r1wkq9WSbGRj0A9Xhwxhp35UaPn2` (não é segredo; não usar como substituto de verificação de token).
- Senha foi configurada no mesmo usuário pelo endpoint administrativo do Firebase; o teste REST de `accounts:signInWithPassword` retornou `password`, UID original, e-mail verificado e projeto correto. Nunca versionar ou registrar senha/tokens.

## Homologação e publicação
1. Não modificar Firebase Auth providers no console: preservar Google e Email/Password.
2. Antes do merge/deploy, comparar regras atualmente PUBLICADAS com as regras do repositório (há histórico de divergências), executar testes no Auth/Firestore Emulator, CI e build.
3. Exigir PASS nos cenários: login de fundador por senha e navegação admin/HGeSM, login de setor externo por senha, founder Google legado autorizado no servidor/Rules (sem botão), setor externo Google negado, isolamento por UID/tenant, depósito, cobrança, Drive.
4. Planejar corte coordenado de código e Firestore Rules para permitir founder password sem impedir acesso aos clientes. Não publicar UI nova com Rules ainda Google-only, nem Rules novas sem servidor compatível.
5. Na produção, verificar acesso fundador por senha, acesso administrativo e operacional, Drive independente, cliente externo e ausência do botão Google. Se falhar, reverter código/Rules em conjunto sem desativar nenhum provider Firebase.

## NÃO executar
- Não desabilitar Google no Firebase Authentication.
- Não desvincular Google da conta fundadora.
- Não excluir/recriar a conta, nem migrar UID ou dados.
- Não revogar tokens de forma generalizada por causa dessa alteração.
- Não ocultar o botão Google nesta publicação parcial.
