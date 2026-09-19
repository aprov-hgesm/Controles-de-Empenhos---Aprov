# EMPROVEX — Bloco 4: Logotipo institucional permanente

## Objetivo

Transformar o logotipo definitivo do EMPROVEX em identidade institucional **somente leitura no runtime**.

A aplicação continua exibindo a marca em:

- login;
- transição de acesso;
- cabeçalho operacional;
- Administração;
- tela de validação administrativa;
- favicon.

O usuário não recebe mais qualquer controle para enviar, trocar, restaurar ou remover a imagem.

## Fonte de verdade

A fonte oficial permanece:

`settings/global.logo`

O documento continua com leitura pública porque o login precisa resolver a marca antes da autenticação.

A escrita, porém, foi alterada para:

`allow write: if false;`

Isso significa que nenhuma sessão cliente — inclusive a conta fundadora — pode alterar o logo pelo runtime.

## Mudanças de código

### `usePlatformBranding`

O hook passou a ser exclusivamente de leitura:

- observa `settings/global`;
- resolve o logo oficial;
- aplica o favicon;
- não recebe e-mail do usuário;
- não recebe callback de notificação;
- não lê um logo arbitrário do `localStorage`;
- não expõe upload;
- não expõe remoção.

O Firestore é a única fonte de verdade da marca.

### `AppShellLogo`

O componente é agora puramente apresentacional.

Foram removidos:

- `<input type="file">`;
- ícone de câmera;
- botão de remoção;
- handlers `onLogoUpload`;
- handler `onRemoveLogo`;
- títulos que sugeriam edição;
- affordances CSS de clique/hover associadas à troca da marca.

### `AppHeader`

O contrato do header não transporta mais callbacks de mutação do logo.

### `firebaseSync.ts`

Foram removidos do runtime:

- `savePlatformLogo`;
- `getPlatformLogo`.

A leitura oficial já é feita diretamente pelo hook dedicado e nenhuma API cliente de escrita da marca permanece disponível.

## Cache local

O logo não é mais carregado de `localStorage`.

Isso evita que uma imagem antiga, manipulada ou pertencente a uma configuração anterior seja tratada temporariamente como identidade válida.

Enquanto o Firestore resolve a marca, a interface pode utilizar o fallback visual `EMP`. Assim que `settings/global.logo` é recebido, o logo oficial ocupa seu lugar.

## Segurança

O bloqueio possui duas camadas:

1. **camada de interface/runtime** — não existem controles nem helpers de escrita;
2. **camada Firestore Rules** — `settings/global` rejeita toda escrita cliente.

O Firestore document existente **não é apagado nem regravado por este bloco**. A regra apenas congela o valor já persistido.

## Alteração futura da marca

Uma troca futura de identidade deve ser tratada como manutenção deliberada, fora do fluxo normal do usuário.

Ela exige uma operação administrativa controlada — por exemplo, ferramenta privilegiada/Admin SDK ou alteração explícita e revisada da regra — seguida do restabelecimento do bloqueio.

Não deve existir um botão de troca de logo dentro do produto.

## Teste de segurança

O teste `brand-logo-lock.test.mjs` inicia o Firestore Emulator e valida que:

- `settings/global` pode ser lido sem login;
- o logo persistido é retornado;
- tentativa cliente de substituição recebe `permission-denied`;
- tentativa cliente de exclusão recebe `permission-denied`;
- o valor original permanece intacto depois das tentativas.

## Invariantes atendidos

- **BRAND-002** — fonte única do logotipo;
- **BRAND-003** — logo não editável no runtime;
- **BRAND-010** — troca da marca exige manutenção deliberada;
- **GAP-BRAND-003** — controles de upload/remoção eliminados;
- **GAP-BRAND-004** — handlers e permissão de escrita eliminados.

## Fora de escopo

Este bloco não altera:

- imagem atualmente persistida;
- autenticação;
- workspaces;
- dados operacionais;
- Google Drive;
- classes de empenho;
- relatórios;
- Administração de setores;
- permissões multi-tenant.
