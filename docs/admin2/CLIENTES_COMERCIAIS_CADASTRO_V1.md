# EMPROVEX Command — Cadastro Comercial Independente V1

**Data:** 2026-10-18 · Branch \`feat/admin2-w01-sidebar-local-preview\`, PR #339 DRAFT.
**Status:** implementação de contrato persistente + Rules + UI de prévia local. **Nenhum deploy, migração ou cadastro real de clientes foi realizado**. Para aceitar a V1, executar testes Emulator e validação humana; publicação posterior exige GO explícito.

## 1. Domínio comercial e isolamento

A estrutura \`platformCustomers/{customerId}\` é uma **entidade comercial independente**, não representa uma OM, UG, workspace operacional, usuário Firebase ou faturamento. Campos persistidos:
- \`version\` (\`emprovex_commercial_customer_v1\`), \`id\`, \`displayName\`;
- \`contactName\`, \`contactEmail\`, \`contactPhone\` (todos opcionais, vazios por padrão);
- \`relationshipStatus\` (\`prospect\`, \`negotiation\`, \`active\`, \`inactive\`);
- \`relationshipNotes\` (até 1000 caracteres; não usar para armazenar informações sensíveis ou operacionais);
- \`workspaceIds\` (até oito por cliente nesta etapa);
- \`createdAt\`, \`createdBy\`, \`updatedAt\`, \`updatedBy\`.

\`platformCustomerWorkspaceLinks/{workspaceId}\` é **índice de unicidade** com \`workspaceId\` e \`customerId\`: uma OM pode ter diferentes setores/workspaces e um Cliente comercial pode cobrir vários workspaces; um mesmo workspace não pode pertencer simultaneamente a dois clientes comerciais, salvo futura política explícita de relacionamentos. Nenhum documento \`workspaces/{id}\` é regravado para criar o vínculo. Conta operacional e billing por workspace permanecem intocados.

## 2. Transação e integridade

\`lib/admin2/customers/commercialCustomerRepository.ts\` implementa:
- Consulta paginada \`platformCustomers\` com \`limit(11)\` e cursor, 10 clientes por página;
- \`runTransaction\` atômico para cadastro/edição do Cliente + índices dos vínculos;
- Validação de formato, campos/limites, existência de cada workspace via \`tx.get\`;
- Verificação de índice já ocupado (conflito => falha sem write);
- Atualização otimista por \`updatedAt\`, evitando sobrescrever alterações concorrentes;
- Índices mantidos em operações de adição e remoção de vínculos; links inalterados não são regravados.

A V1 **não** migra dados legados, não copia dados de workspaces para a coleção comercial, não altera cobranças, não efetua exclusão de clientes nem faz backfill por leitura de todos os workspaces. Rascunhos em branco são válidos sem vínculo até que o responsável seja identificado.

## 3. Segurança e publicação controlada

- Firestore Rules da **branch** concedem GET/LIST/CREATE/UPDATE exclusivamente a \`isPlatformAdmin()\` (fundador Google verificado).
- Campos proibidos pela lista \`hasOnly\`; limites/status validados; \`createdBy\` e \`createdAt\` imutáveis na atualização.
- Índice do vínculo só pode ser criado pelo fundador se o workspace existir e o Cliente atualizado referenciar seu ID via \`existsAfter\` e \`getAfter\`. Update de índice negado; remoção somente pelo fundador.
- Nenhuma Rule concede acesso global a empenhos, depósitos ou Google Drive.
- **IMPORTANTE:** as Rules de produção **NÃO** são modificadas por commits GitHub. Não publicar antes de PASS no Emulator e autorização expressa. Quando os Rules estiverem oficialmente publicados, uma interface produtiva poderá usar o repositório, mediante novo gate/GO.
- A função de escrita do repositório é bloqueada fora de \`NODE_ENV=development\` **e** \`NEXT_PUBLIC_EMPROVEX_E2E_EMULATORS=1\`. Ela nunca escreve diretamente em Firebase real a partir do laboratório.

## 4. O que o Fundador verá no localhost

Em **Clientes → Cadastro de clientes comerciais**:
- Lista separada dos workspaces reais existentes; pesquisa por nome comercial ou contato entre os itens carregados;
- Botão **Novo cliente**; formulário nome comercial, contato, e-mail, telefone, status, observações;
- Vincular workspaces reais digitando o ID, com validação de existência/Rules (consulta pequena);
- Editar cadastro e remover/adicionar vínculo;
- Mensagem explícita **Modo prévia segura**: rascunhos são guardados **somente no estado React desta página**, sem armazenamento permanente; recarregar a página apaga rascunhos; **não usar contatos pessoais reais**;
- A seção **Workspaces existentes** e a Ficha 360 V2 continuam funcionais e protegidas pelo login fundador.

O modo de rascunho serve apenas para aprovar visual e comportamento. Em homologação com **Auth + Firestore Emulator** configurados, os mesmos componentes ativam gravação e consulta no banco emulado (sem produção).

## 5. Testes

\`\`\`powershell
node --test scripts/admin2-sidebar-preview.test.mjs scripts/admin2-customer-contract.test.mjs scripts/admin2-customer-360-v2.test.mjs scripts/admin2-commercial-contract.test.mjs
\`\`\`

Testes de Rules (exigem Java, Node e Firebase CLI; jamais apontar para projeto real):

\`\`\`powershell
npx.cmd --yes firebase-tools emulators:exec --config firebase.security-test.json --project demo-emprovex-commercial --only auth,firestore "node scripts/admin2-commercial-security.test.mjs"
\`\`\`

A suite do Emulator prova: fundador Google permitido, anônimo negado, leitura de contatos protegida, workspace inexistente negado, index único, remoção segura de vínculo, exclusão do cadastro negada e campos inesperados negados. Integrada à etapa **Application CI**.

**Custo:** o formulário consulta apenas IDs explicitamente solicitados; listagem comercial até 11 documentos por página; transação pode ler o Cliente, cada workspace e cada índice de vínculo (máximo oito vínculos novos + oito removidos em uma edição). Sem listeners. Não há consultas periódicas em repouso.

## 6. Critérios de aceite

- [ ] Application CI do HEAD vigente PASS, inclusive testes Rules Emulator.
- [ ] Core Protection PASS.
- [ ] Fundador aprova visual e CRUD de rascunhos no localhost, garantindo que fechar/recarregar não grava dados reais.
- [ ] Negativas de segurança verificadas no Emulator.
- [ ] Homologação autenticada persistente no Emulator, se requerida, sem dados reais.
- [ ] GO explícito separado antes de migrar, publicar Rules ou habilitar persistência na infraestrutura real.

**Próximo incremento:** CRM/atendimento e relação comercial 360° persistente após aprovação; não confundir aprovação do preview de rascunhos com autorização de deploy.

## Handoff

**ONDE ESTAMOS:** Admin V3 e Clientes V1/V2 read-only funcionais; contrato e UI de Clientes comerciais disponíveis na branch isolada.
**O QUE ESTAMOS FAZENDO:** cadastro de relacionamento comercial com vínculos 1:N sem afetar cadastro operacional.
**QUEM ESTÁ FAZENDO:** chat executor sequencial via GitHub; Fundador valida no localhost.
**O QUE FAZER A SEGUIR:** corrigir CI/Rules Emulator, validar rascunhos no navegador, então decidir gate de publicação em ambiente de homologação.
**QUEM O FARÁ:** executor corrige; Fundador aprova.
