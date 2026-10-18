# EMPROVEX Admin 2.0 — CONTRATO COMERCIAL V2: 1 Workspace = 1 Cliente

**Decisão do Fundador (18/10/2026): opção B — cada workspace é um cliente comercial independente.**

**Status:** contrato atualizado na branch isolada `feat/admin2-w01-sidebar-local-preview`, PR #339 DRAFT. Sem migração, deploy ou gravação em produção. Este documento substitui a premissa 1:N originalmente descrita neste mesmo arquivo (nome histórico V1).

## Modelo aprovado

- **Cliente comercial:** unidade de contratação e acompanhamento equivalente a **um workspace**; identificado pelo `workspaceId`.
- **Workspace:** ambiente operacional preexistente do setor, com sua UG/OM/conta e permissões próprias. O cadastro comercial não modifica nem dá acesso a esse ambiente.
- **Responsável/contato comercial:** pessoa registrada em `contactName`, `contactEmail`, `contactPhone`; não é o cliente contratante como entidade independente e não adquire permissão Firebase por constar no cadastro.
- **Assinatura:** continua individual por `billingAccounts/{workspaceId}` e `billingCycles/{workspaceId}__YYYY-MM`; VIP/trial/valor ficam nas fontes existentes e não são sobrescritos.
- **OM:** dados institucionais do workspace, não entidade comercial proprietária dos vários workspaces.

### Identificador determinístico e ausência de vínculo auxiliar

`platformCustomers/{workspaceId}` é o único documento comercial daquele workspace:
```text
workspaces/sector-a                       (metadados operacionais preexistentes)
platformCustomers/sector-a                 (dados comerciais próprios do sector-a)
billingAccounts/sector-a                  (contratação já existente)
workspaces/sector-b
platformCustomers/sector-b                 (outro cliente comercial independente)
billingAccounts/sector-b
```

**Não existe `platformCustomerWorkspaceLinks` e não existe `workspaceIds[]`** no contrato vigente. O ID do documento comercial deve ser idêntico a `workspaceId`. Não há limite arbitrário de oito; há **exatamente um workspace por cadastro**. Um workspace só tem um cadastro comercial de mesmo ID, e os contatos de dois clientes podem coincidir sem fundir as assinaturas.

## Contrato de campos (versão `emprovex_commercial_customer_v2`)

`id` = `workspaceId` (ambos imutáveis), `version`, `displayName`, `contactName`, `contactEmail`, `contactPhone`, `relationshipStatus` (prospect/negotiation/active/inactive), `relationshipNotes`, `createdAt`, `updatedAt`, `createdBy`, `updatedBy`.

- `workspaceId` obrigatório; é verificado na coleção `workspaces` antes da gravação.
- `displayName` obrigatório (até 120); contato até 100, e-mail até 160, telefone até 30, notas até 1000 caracteres.
- Um cadastro comercial pode ser criado para um workspace já existente, **não cria um novo workspace nem o usuário Firebase**.
- Não se transfere um cadastro para outro workspace: alterações permitidas apenas nos campos de contato/relacionamento.
- A propriedade de autoria é preservada em atualizações; tentativa de mudar ID, origem ou autor é negada.

## Persistência e Rules (ainda não aplicadas em produção)

`lib/admin2/customers/commercialCustomerRepository.ts`:
- ID de gravação é **o workspaceId**, sem gerar ID aleatório.
- `runTransaction` lê **um workspace e seu único cadastro comercial** e aplica um `tx.set` ao documento comercial, após verificar existência de workspace, ausência de cadastro na criação ou `updatedAt` consistente na edição.
- Lookup da Ficha 360 usa diretamente `getDoc(platformCustomers/{workspaceId})` — **uma leitura**, sem índice auxiliar.
- A lista comercial usa no máximo 11 documentos para mostrar 10 por página e cursor; nenhuma assinatura em tempo real.

As Rules versionadas apenas nesta branch exigem administrador Google conforme `isPlatformAdmin()`, ID do documento igual ao workspace, documento workspace existente, campos permitidos e imutabilidade do vínculo/autoria. Exclusão de cadastro continua proibida; **não há exceção de exclusão** nos guards de ciclo de vida.

**Fail-closed:** persistência habilitada somente em `NODE_ENV=development` com `NEXT_PUBLIC_EMPROVEX_E2E_EMULATORS=1` e `NEXT_PUBLIC_EMPROVEX_E2E_PROJECT_ID` iniciado por `demo-`; `lib/firebase.ts` então conecta Auth/Firestore aos Emulators locais. O localhost comum usa rascunhos em memória React, apagados no refresh. **Nenhum contato pessoal real deve ser inserido durante esta prévia.**

## Fluxo localhost e aceite

1. Abrir `http://localhost:3001/admin2-preview?area=customers` após autenticação administrativa.
2. Selecionar **Cadastro de clientes comerciais** → **Novo cliente**.
3. Selecionar **um** ID de workspace real existente; a UI consulta somente seu ID. É obrigatório.
4. Preencher dados fictícios de contato/relacionamento → **Salvar rascunho local**.
5. Ver o registro separado dos outros workspaces, editar contato e confirmar que não é possível trocar o workspace do cadastro.
6. Voltar a Workspaces existentes → Ver ficha → Vínculos e contato para ver os dados comerciais do mesmo workspace.
7. Tentar registrar o mesmo workspace duas vezes: a UI bloqueia e a transação/ID determinístico também bloqueiam no Emulator.

Testes:
```powershell
node --test scripts/admin2-commercial-contract.test.mjs scripts/admin2-customer-360-v2.test.mjs
npx.cmd --yes firebase-tools emulators:exec --config firebase.security-test.json --project demo-emprovex-commercial --only auth,firestore "node scripts/admin2-commercial-security.test.mjs"
```
Application CI inclui esses testes; aguardar PASS no HEAD vigente e smoke humano do Fundador.

## Estado e próximo passo

- Nenhuma Rule foi publicada, nenhum cadastro comercial real ou workspace de produção foi alterado.
- Eventuais documentos antigos do protótipo 1:N em **Emulator** não fazem parte do contrato V2 e devem ser descartados/recriados em ambiente descartável; não aplicar migração automática em produção.
- A ficha comercial independe do status da cobrança e não pode conceder acesso operacional.
- **Próxima validação:** Fundador confirma fluxo 1:1 no localhost; só depois será considerada homologação persistente/política de release.

**Handoff:** ONDE ESTAMOS — decisão 1:1 codificada, QA pendente; O QUE ESTAMOS FAZENDO — adequar modelo/Rules/UI/testes e memoriais; QUEM — chat executor sequencial; A SEGUIR — concluir CI e validar local; QUEM — executor valida CI, Fundador testa.
