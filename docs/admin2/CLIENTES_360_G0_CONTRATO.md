# EMPROVEX Admin 2.0 — G0 Clientes 360° (primeira fatia funcional)
**Data:** 2026-10-18
**Branch:** feat/admin2-w01-sidebar-local-preview
**Ambiente:** localhost, \`/admin2-preview?area=customers\`, somente em \`next dev\`.
**Estado:** contrato inicial read-only implementado. NÃO é cadastro comercial definitivo, nem feature publicada.

## 1. Fonte de verdade, entidades e o que NÃO foi criado

- **Workspace:** documentos existentes \`workspaces/{workspaceId}\`, do tipo \`Workspace\` em \`lib/platformIdentity.ts\`. São a fonte de verdade para nome do setor, OM, sigla, UG, e-mail autorizado, status, atualização.
- **Cliente 360° V0:** \`CustomerWorkspaceRecord\` (projeção em memória) de um Workspace por registro listado, com \`customerKey="workspace:"+workspaceId\`. **Não significa** que a OM seja cliente pagante, nem que \`Customer\`/conta comercial formal tenha sido cadastrada.
- **Assinatura:** \`billingAccounts/{workspaceId}\`, fonte de verdade existente, lida sob demanda com \`getDoc\` **somente quando a ficha é aberta**. \`billingCycles\` não são consultados nesta etapa. Ausência do documento não cria um novo billingAccount.
- **Não criar** Customer persistido, duplicação de UG, conta Firebase, UID, preço/situação comercial, anexos Google Drive ou documento operacional. **Nenhuma escrita Firestore.**

## 2. Acesso e segurança

- \`app/admin2-preview/page.tsx\` continua retornando \`notFound()\` fora de NODE_ENV=development.
- \`AdminCustomersDirectory\` somente dispara leitura após \`onAuthStateChanged\` e validação do e-mail fundadora \`HGESM_SECTOR_EMAIL\`, \`emailVerified\`, \`sign_in_provider="google.com"\`.
- A autenticidade/autoridade NÃO depende só da UI: \`getDocs(workspaces)\` é autorizado pelas **Security Rules existentes** \`allow list: if isPlatformAdmin()\`; \`getDoc(billingAccounts/...)\` também passa por \`isPlatformAdmin()\`.
- Login pelo Firebase Google somente quando necessário. Nada de tokens copiados para URLs, cookies particulares ou \`localStorage\`; o Firebase Auth gerencia a própria sessão. Conta de setor normal deve ser negada pelas Rules, mesmo manipulando componente no DevTools.
- O laboratório **não** lê \`workspaces/{id}/empenhos\`, warehouse, NF, saldo, Drive, documentos pessoais, nem permite alterações.
- No localhost com configuração Firebase real, o navegador lê **metadados reais autorizados** diretamente do Firestore real; nunca usar dados de clientes sem permissão. A consulta é somente leitura, mas contabiliza leituras no Firestore. Se o login OAuth não reconhecer localhost, checar domínios autorizados antes de alterar configurações.

## 3. Busca e paginação

- \`lib/admin2/customers/customerWorkspaceDirectory.ts\` gera consultas de Firestore com \`limit(11)\` para exibir 10 itens por página e determinar se existe próxima página (um documento extra de lookahead).
- \`startAfter(QueryDocumentSnapshot)\` preserva o cursor correto, usando o último documento **visível** de cada página; navegação anterior usa cursores mantidos na memória da sessão UI.
- Geral: \`orderBy('name')\`, que exige que os workspaces tenham \`name\` (contrato atual).
- Por nome: prefixo **sensível a maiúsculas/minúsculas** (não uma busca “contém”), \`startAt(nome)\` e \`endAt(nome + '\\uf8ff')\`.
- Por UG: \`where('ug','==',NNNNNN)\`, exatamente seis dígitos.
- Por ID: \`where(documentId(),'==',id)\` para workspace específico.
- Botão Pesquisar aplica a consulta (não dispara nova leitura por digitação), Atualizar recarrega; nenhuma subscription global \`onSnapshot\`.
- Um usuário que navegue para a segunda página realiza uma nova leitura limitada; as leituras não são gratuitas. Conexão sem resultados pode ter cobrança mínima da query.
- Não existe ainda pesquisa sem acentos/case-insensitive, classificação avançada, filtros por status globais, contador total ou exportação. Essas capacidades precisam de índice/contrato de pesquisa próprio no futuro, sem varrer toda a base.

## 4. UI e estados implementados

- Login Google / conta incorreta / autenticando / erro.
- Diretório real de workspaces, pesquisa por nome/UG/ID, páginas anterior/próxima, atualizar, lista vazia/erro/loading.
- Ficha 360 com organização, UG, setor, e-mail do setor, status workspace, atualização, status billing, mensalidade cadastral, isenção, fim de trial (quando presentes).
- Distinção clara entre **dados reais de Clientes** e **dashboard/indicadores ainda ilustrativos**.
- A ficha **não** dá entrada operacional nos dados dos workspaces externos.
- A trilha de suporte e as entidades comerciais reais ainda serão próximas etapas. Não esconder campos inexistentes com dados fictícios.

## 5. QA requerido e aceite do Fundador

- [ ] GitHub Application CI PASS para o commit final.
- [ ] EMPROVEX Core Protection PASS para o commit final.
- [ ] \`node --test scripts/admin2-sidebar-preview.test.mjs\` PASS (contrato estrutural).
- [ ] Smoke em localhost: fundador autenticado com Google lista os workspaces que deveria, abre ficha, consulta assinatura, pesquisa, pagina e atualiza.
- [ ] Smoke negativo: usuário externo não visualiza diretório, Firestore retorna permissão negada em tentativa de leitura direta por usuário normal.
- [ ] Sem mutações: confirmar ausência de writes/changes em Firestore, Rules, IAM e deploy.
- [ ] Medição de consulta com 0, 1, 10, 11+ registros: validar limite, cursor e latência; confirmar ausência de leitura de ciclos financeiros por default.

**A aprovação desse primeiro diretório não significa que o Cliente comercial 1:N, CRM, suporte, timeline, exportação e filtros avançados estejam concluídos.** Esses passos seguem no desenvolvimento sequencial.
