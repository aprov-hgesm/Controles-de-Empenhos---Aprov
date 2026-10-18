# EMPROVEX Command — Admin 2.0 / Prévia local da barra lateral

> **ATUALIZAÇÃO V3 — 2026-10-18:** por decisão do Fundador, a sidebar agora é **fixa à esquerda**, largura 288px, **não recolhível** no desktop. Menu móvel preservado. Scrollbar com thumb fino/arredondado, trilho transparente e hover. A área principal agora é **clara**, com gradientes institucionais e cards com acentos azul/teal/verde/âmbar. As descrições de modo compacto das versões anteriores abaixo são históricas e **não mais se aplicam**. Para atualizar localhost: pare o servidor (Ctrl+C), entre em `cd "$HOME\emprovex-admin2-preview"`, execute `git pull --ff-only origin feat/admin2-w01-sidebar-local-preview`, `node --test scripts/admin2-sidebar-preview.test.mjs`, depois `npm.cmd run dev -- --port 3001` e abra `http://localhost:3001/admin2-preview`.


**Status:** laboratório de design W01; implementação funcional da navegação DEMONSTRATIVA. Sem login, Firebase, Firestore, cobrança, Google Drive ou acesso a workspace de terceiros. Não é a nova Administração integrada nem prova de todas as capacidades CORE V2.

**Branch isolada:** \`feat/admin2-w01-sidebar-local-preview\`

**URL local:** http://localhost:3001/admin2-preview

**Ambiente:** \`next dev\` (NODE_ENV=development). Fora do modo development a rota chama \`notFound()\`; mesmo que a branch seja implantada em Preview/produção por engano, a tela de laboratório não deve ficar publicamente disponível.

## Windows PowerShell — clone isolado (preferencial)

Abra PowerShell no seu computador Windows:

\`\`\`powershell
cd $HOME
git clone --branch feat/admin2-w01-sidebar-local-preview --single-branch https://github.com/aprov-hgesm/Controles-de-Empenhos---Aprov.git emprovex-admin2-preview
cd "$HOME\emprovex-admin2-preview"
npm.cmd ci
node --test scripts/admin2-sidebar-preview.test.mjs
npm.cmd run dev -- --port 3001
\`\`\`

Acesse **http://localhost:3001/admin2-preview** pelo navegador do próprio Windows.

Se a pasta \`emprovex-admin2-preview\` já existir, não refaça o clone. Execute:

\`\`\`powershell
cd "$HOME\emprovex-admin2-preview"
git fetch origin feat/admin2-w01-sidebar-local-preview
git switch feat/admin2-w01-sidebar-local-preview
git pull --ff-only origin feat/admin2-w01-sidebar-local-preview
npm.cmd ci
npm.cmd run dev -- --port 3001
\`\`\`

**Sem tocar no worktree de produção:** o clone é uma pasta independente, não modifica seu repositório de outras releases ou o domínio \`emprovex.com.br\`.

**Atenção:** não use \`vercel deploy\`, \`firebase deploy\`, \`git merge\` ou \`git push origin main\` para visualizar este protótipo.

Se você quiser usar uma cópia local já existente, pode empregar \`git worktree add\` a partir de uma pasta que seja realmente um repositório Git, após \`git fetch origin\`. Evite executar \`git switch\` em seu worktree principal quando houver trabalho não commitado.

## Ajuste visual V2 — sidebar fiel à estrutura do EMPROVEX (18/10/2026)

Após comparação das capturas fornecidas pelo Fundador, a arquitetura da prévia foi ajustada:

- **Sidebar realmente à esquerda:** inicia na borda do viewport (sem margens, sem \`max-width\` centralizado, sem aparência de card flutuante no desktop).
- **Cabeçalho global full-width:** identidade EMPROVEX Command alinhada à esquerda com destaque visual, como no shell operacional.
- **Sidebar abaixo do cabeçalho:** alinhamento vertical \`top: 72px\`, altura \`100dvh - 72px\`, largura expandida \`288px\` ou compacta \`80px\`; conteúdo ocupa toda a largura restante com padding próprio.
- **Sem perda de funcionalidade:** navegação, estado ativo, histórico, preferência de compactação e mobile drawer permanecem.
- No mobile, o drawer agora inicia exatamente na borda esquerda, mantendo máscara e botão de fechar.

### Atualizar a pasta local existente

Se você já está com a versão anterior aberta, **não precisa clonar novamente**. Pare o processo \`next dev\` com Ctrl+C, execute:

\`\`\`powershell
cd "$HOME\emprovex-admin2-preview"
git switch feat/admin2-w01-sidebar-local-preview
git pull --ff-only origin feat/admin2-w01-sidebar-local-preview
node --test scripts/admin2-sidebar-preview.test.mjs
npm.cmd run dev -- --port 3001
\`\`\`

Abra/atualize **http://localhost:3001/admin2-preview**. Recarregue com Ctrl+F5 se estiver vendo a página anterior. Não há mudança de dependências neste ajuste; \`npm ci\` não precisa ser executado de novo.

## O que testar

1. Desktop expandido: grupos Central, Negócio, Operação, Inteligência e Governança.
2. Botão **Recolher menu**: sidebar reduzida somente a ícones; passar o mouse exibe o título; o botão se torna “Expandir barra lateral”.
3. Atualizar a página: escolha compacta fica salva no \`localStorage\`; o Firestore não é consultado.
4. Navegar entre **Visão geral, Clientes, Financeiro, Atendimento** etc. O endereço atualiza \`?area=...\`; voltar/avançar do navegador deve restaurar a seção.
5. Em tela estreita (DevTools modo mobile), usar menu hambúrguer: drawer com backdrop, botão fechar, Escape, foco de teclado e fechamento após seleção.
6. Na área **Clientes**, testar a pesquisa textual sobre quatro **registros fictícios**; os demais módulos exibem superfícies demonstrativas, não ferramentas produtivas.
7. Acessibilidade: verifique foco visível, estado ativo \`aria-current\`, nomes de botões e \`prefers-reduced-motion\`.

## Testes e limites

\`\`\`powershell
node --test scripts/admin2-sidebar-preview.test.mjs
npm.cmd run typecheck
\`\`\`

A verificação \`scripts/admin2-sidebar-preview.test.mjs\` inspeciona estruturalmente o protótipo, não substitui browser E2E nem inspeção visual. A compilação completa deve ser validada na branch/PR, com eventuais ajustes.

**O que NÃO foi implementado:** nenhum módulo real do Admin 2.0, assinatura, CRUD de clientes, acesso aos dados operacionais de outros workspaces, alteração de sessões, dados do Drive ou conexão Firebase. O protótipo **somente** permite validar visual, sidebar e navegação local. O W00/W01 integrará o componente ao Admin real apenas em trabalho posterior e com QA/GO específicos.

## Handoff

- **Onde estamos:** protótipo W01 em branch isolada, sem merge.
- **O que estamos fazendo:** prévia navegável da barra lateral Admin 2.0 para validação do Fundador.
- **Quem está fazendo:** W01 design/shell; futuro W00 integrará ao roteamento real; W11 testará.
- **O que fazer a seguir:** conferir visual e UX em localhost, aprovar/corrigir a sidebar, então integrar de modo controlado ao Admin CORE.
- **Quem o fará:** Fundador valida; W01 refina; W00 coordena integração e W11 certifica.
