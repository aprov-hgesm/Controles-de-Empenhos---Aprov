# EMPROVEX Command — Admin 2.0 / Prévia local da barra lateral

> **ATUALIZAÇÃO V3 — 2026-10-18:** por decisão do Fundador, a sidebar agora é **fixa à esquerda**, largura 288px, **não recolhível** no desktop. Menu móvel preservado. Scrollbar com thumb fino/arredondado, trilho transparente e hover. A área principal agora é **clara**, com gradientes institucionais e cards com acentos azul/teal/verde/âmbar. As descrições de modo compacto das versões anteriores abaixo são históricas e **não mais se aplicam**. Para atualizar localhost: pare o servidor (Ctrl+C), entre em `cd "$HOME\emprovex-admin2-preview"`, execute `git pull --ff-only origin feat/admin2-w01-sidebar-local-preview`, `node --test scripts/admin2-sidebar-preview.test.mjs`, depois `npm.cmd run dev -- --port 3001` e abra `http://localhost:3001/admin2-preview`.


**Status:** laboratório de design W01; implementação funcional da navegação DEMONSTRATIVA. Sem login, Firebase, Firestore, cobrança, Google Drive ou acesso a workspace de terceiros. Não é a nova Administração integrada nem prova de todas as capacidades CORE V2.

**Branch isolada:** \`feat/admin2-w01-sidebar-local-preview\`

**URL local:** http://localhost:3001/admin2-preview

**Ambiente:** \`next dev\` (NODE_ENV=development). Fora do modo development a rota chama \`notFound()\`; mesmo que a branch seja implantada em Preview/produção por engano, a tela de laboratório não deve ficar publicamente disponível.

## CADASTRO COMERCIAL — MODELO 1:1 ATUALIZADO (18/10/2026)

**Novo requisito aprovado:** cada workspace é um cliente comercial independente. Qualquer referência abaixo a "oito workspaces" ou múltiplos vínculos é **histórica e está superada**. O contrato atual exige **um workspace por cadastro**, com ID imutável e assinatura independente.

**Validar no localhost:** abra `http://localhost:3001/admin2-preview?area=customers`, autentique a conta fundadora, escolha **Cadastro de clientes comerciais**, clique **Novo cliente**, selecione **um único workspace existente**, preencha contatos fictícios e salve o rascunho. Tente criar outro cadastro para o mesmo workspace (deve bloquear), depois edite o contato (workspace deve permanecer fixo). Volte ao Diretório de Workspaces e abra a Ficha 360 daquele ID: a aba **Vínculos e contato** deverá mostrar apenas o cadastro daquele workspace.

**Modo seguro:** dados de contato de teste somente **em memória React** no localhost padrão, perdidos ao atualizar. A persistência só é habilitada em Auth/Firestore Emulator com `NEXT_PUBLIC_EMPROVEX_E2E_PROJECT_ID=demo-...`, e as Rules ainda não foram publicadas em produção. Não utilize dados pessoais reais.

```powershell
cd "$HOME\emprovex-admin2-preview"
git pull --ff-only origin feat/admin2-w01-sidebar-local-preview
node --test scripts/admin2-sidebar-preview.test.mjs scripts/admin2-customer-contract.test.mjs scripts/admin2-customer-360-v2.test.mjs scripts/admin2-commercial-contract.test.mjs
npm.cmd run dev -- --port 3001
```

---

## CLIENTES COMERCIAIS V1 — cadastro independente e vínculos 1:N (18/10/2026)

**Nova entrega para aprovação no localhost**, preservando o Diretório de Workspaces e a Ficha 360° V2:

1. Em \`http://localhost:3001/admin2-preview?area=customers\`, entre com a conta Google fundadora e clique em **Cadastro de clientes comerciais**.
2. Clique em **Novo cliente**. Preencha nome, pessoa de contato, e-mail, telefone, situação (prospecto, negociação, ativo, inativo) e observações **somente fictícias**.
3. Em **Workspaces vinculados**, digite o identificador de um workspace real já existente (copie do Diretório) e clique em **Vincular**. O sistema verifica a existência e a autorização de leitura desse ID, sem modificar o workspace. O limite atual é **oito por cliente**.
4. Clique em **Salvar rascunho local**. Edite o cadastro e teste adicionar/remover vínculo. O mesmo workspace não pode pertencer a dois rascunhos da sessão.
5. Volte a **Workspaces existentes**, abra a Ficha 360° do workspace vinculado, acesse **Vínculos e contato**: o contato e a relação comercial do rascunho serão mostrados ali.
6. **Atenção:** o modo localhost comum mantém rascunhos **exclusivamente na memória da página**. Recarregar/fechar a aba apaga esses rascunhos. **Não use dados pessoais reais** para testes. A produção NÃO recebe nenhuma gravação.

O motor persistente de Firestore já foi implementado, mas só habilita gravação com \`NEXT_PUBLIC_EMPROVEX_E2E_EMULATORS=1\` em desenvolvimento e Auth/Firestore Emulators em execução. A nova Firestore Rules só existe nesta branch; não foi publicada. A suíte CI testa CRUD/bloqueios no Emulator, sem dados reais. Consulte \`docs/admin2/CLIENTES_COMERCIAIS_CADASTRO_V1.md\` para contrato, riscos e gates.

**Atualizar a prévia sem deploy:**

\`\`\`powershell
cd "$HOME\emprovex-admin2-preview"
git pull --ff-only origin feat/admin2-w01-sidebar-local-preview
node --test scripts/admin2-sidebar-preview.test.mjs scripts/admin2-customer-contract.test.mjs scripts/admin2-customer-360-v2.test.mjs scripts/admin2-commercial-contract.test.mjs
npm.cmd run dev -- --port 3001
\`\`\`

Acesse **http://localhost:3001/admin2-preview?area=customers**.

---

## CLIENTES 360° V2 — ficha com acompanhamento (18/10/2026)

**Nova entrega a validar:** após **Clientes → Ver ficha**, a ficha passa a ter as seções **Visão geral**, **Financeiro**, **Atividades** e **Vínculos e contato**, mantendo a sidebar fixa escura e o corpo claro aprovados.

- **Visão geral:** dados institucionais reais, UG, contato operacional, assinatura e período de teste.
- **Financeiro:** competências reais e paginadas em grupos de 6; vencimento, status e confirmação (quando existentes). A consulta é iniciada somente ao abrir a aba.
- **Atividades:** amostra de até 12 eventos administrativos reais filtrados por workspace, consultada somente ao abrir a aba. **Não é histórico completo nem necessariamente os eventos mais recentes**; IDs de auditoria não são cronológicos.
- **Vínculos e contato:** identidade comercial preparada conceitualmente para um Cliente 1:N, **sem criar coleção ou gravar vínculos**; dados não existentes aparecem como "não cadastrado".
- Sem operações nos workspaces externos, sem acesso ao Drive dos clientes e **sem writes**.

Atualizar a pasta isolada, interrompendo o servidor antes se estiver aberto:

\`\`\`powershell
cd "$HOME\emprovex-admin2-preview"
git pull --ff-only origin feat/admin2-w01-sidebar-local-preview
node --test scripts/admin2-sidebar-preview.test.mjs scripts/admin2-customer-contract.test.mjs scripts/admin2-customer-360-v2.test.mjs
npm.cmd run dev -- --port 3001
\`\`\`

Acesse **http://localhost:3001/admin2-preview?area=customers** com a conta Google fundadora e valide um cliente que possua histórico financeiro. Depois abra **Atividades** e **Vínculos e contato**, volte ao diretório e abra outro workspace para verificar isolamento. **Se faltar dado, a tela mostrará o estado vazio; não executará migração nem criará cobrança.**

Documentação: [CLIENTES_360_V2_CONTRATO.md](./CLIENTES_360_V2_CONTRATO.md).

---

## CLIENTES 360° — Fase funcional read-only (18/10/2026)

A aba **Clientes** deixou de usar a lista fictícia: ela agora se conecta aos metadados reais de \`workspaces\` via Firebase/Firestore, com autenticação Google fundadora e regras de segurança existentes, **sem alterar qualquer documento**. Dashboard e outros módulos da prévia continuam ilustrativos.

**Para testar:**

1. Atualize a branch pelo PowerShell e inicie o servidor (comandos abaixo). Abra \`http://localhost:3001/admin2-preview?area=customers\`.
2. Se não houver sessão válida, selecione **Entrar com Google** e use a mesma conta fundadora da área administrativa atual. A conta de setor externo **não** tem permissão de listar os demais workspaces.
3. Depois da verificação, serão exibidos até **10 registros por página**, ordenados por nome, com **Anterior / Próxima**, botão **Atualizar** e pesquisa por prefixo do nome (sensível a maiúsculas), UG exata ou ID do workspace.
4. Use **Ver ficha** para abrir o Cliente 360° administrativo: OM/UG, seção, workspace, e-mail operacional e situação; **somente então** ocorre a consulta ao resumo de assinatura \`billingAccounts/{workspaceId}\`. Não são carregados ciclos históricos/Drive/empenhos.
5. Confira erros, listagem vazia e identificação dos dados reais; os KPIs da Visão Geral continuam **fictícios**.
6. Se o OAuth bloquear \`localhost\`, verifique o domínio autorizado no Firebase e informe o erro. Não altere credenciais nem políticas do projeto sem revisão.

**Segurança e custo:** o código novo não escreve no Firestore; cada busca/página usa um query limitado a 11 documentos (10 visíveis + 1 lookahead). O Firestore real pode contabilizar leituras; não é necessário nem recomendado clicar repetidamente em Atualizar. A navegação e a mudança de áreas não instalam listeners.

**Testes locais:**

\`\`\`powershell
cd "$HOME\emprovex-admin2-preview"
git pull --ff-only origin feat/admin2-w01-sidebar-local-preview
node --test scripts/admin2-sidebar-preview.test.mjs scripts/admin2-customer-contract.test.mjs
npm.cmd run dev -- --port 3001
\`\`\`

**Escopo:** a ficha atual é uma **projeção read-only de workspaces**, não o cadastro comercial definitivo do cliente. Nenhuma ação de entrar no workspace, operar depósito externo ou ler Google Drive alheio foi implementada.

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
