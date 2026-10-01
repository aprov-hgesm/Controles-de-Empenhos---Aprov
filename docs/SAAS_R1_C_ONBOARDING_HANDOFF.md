# SAAS-C — Onboarding Assistido e Credenciais — Handoff da Worker

Data: 2026-10-01
Branch: `saas-r1-c-onboarding`
Base imutável: `32872d3fc6a781ff129eb4e41ae9b0d45658024a`
Integradora de destino: `feat/saas-r1-commercializacao`
Estado deste documento: **CANDIDATA AOS GATES FINAIS**

## 1. Escopo executado

A SAAS-C preserva o onboarding assistido pelo administrador e a arquitetura de identidade existente.

Foram implementados:

- recuperação self-service de senha para usuário externo com Firebase Authentication;
- resposta neutra na recuperação, sem confirmar existência de conta;
- troca da própria senha com reautenticação do Firebase;
- caminho permanente **Minha conta** para usuário externo;
- mensagens humanas para falhas de primeiro acesso, mantendo códigos técnicos fora da UI;
- tratamento explícito de e-mail não verificado quando aplicável;
- checklist curto de primeiro acesso, persistido apenas em `localStorage`;
- orientação de credencial inicial por canal seguro;
- Google Drive explicitamente opcional e não bloqueante;
- guard específico `verify:saas-r1-onboarding`, registrado no Application CI.

## 2. Contratos preservados

Não foram alterados:

- fundador: Google-only;
- externo: e-mail/senha;
- UID pré-vinculado;
- normalização de e-mail;
- 1 workspace por conta externa;
- 1 UG por workspace;
- resolução fail-closed;
- limite e revogação atuais de sessões;
- locks, rollback e recovery do provisionamento;
- criação/reuso de Firebase Auth existente;
- criação coordenada de workspace, conta, UG index, billing e auditoria;
- contratos de billing da SAAS-B;
- enforcement transversal reservado à SAAS-DS.

Nenhum signup público, organização pública, seleção livre de workspace/UG ou multi-seat foi criado.

## 3. Fluxo final de criação e entrega inicial

1. O fundador continua criando o setor pelo fluxo administrativo existente.
2. O servidor continua criando/reutilizando Firebase Auth e materializando o diretório de workspace/conta com os controles existentes.
3. A senha inicial continua transitando somente no fluxo de Auth e não é persistida no Firestore.
4. A UI administrativa orienta entregar a credencial inicial ao operador por canal seguro.
5. O primeiro login continua validando provider, UID, e-mail, workspace, UG, status e limite de sessões antes de abrir dados operacionais.
6. O checklist local aparece para o primeiro acesso ainda não concluído.
7. Drive pode ser conectado depois e não bloqueia o núcleo.

## 4. Esqueci minha senha

- UI: `components/auth/EmprovexLogin.tsx`;
- runtime: `hooks/useOperationalData.ts`;
- Firebase: `sendPasswordResetEmail`;
- a resposta não diferencia conta existente de inexistente;
- a conta fundadora recebe a mesma resposta neutra, mas não entra no fluxo de senha;
- nenhum token de reset é persistido;
- nenhuma senha é registrada no Firestore;
- o reset administrativo existente permanece como recuperação excepcional.

## 5. Troca de senha

- UI: `components/auth/SectorCredentialModal.tsx`;
- acesso: botão **Minha conta** no header para setor externo;
- reautenticação: `EmailAuthProvider.credential` + `reauthenticateWithCredential`;
- alteração: `updatePassword`;
- somente sessão cujo provider real é `password`;
- fundador Google-only é recusado por este fluxo;
- mensagens tratam senha atual incorreta, senha fraca, excesso de tentativas, rede e sessão que requer novo login.

## 6. Primeiro acesso e checklist

Arquivo: `components/auth/SectorFirstAccessChecklist.tsx`.

Itens:

- acesso realizado;
- conferir workspace/UG;
- conhecer navegação principal;
- Drive opcional;
- começar a usar;
- atalho para alterar a própria senha.

Persistência: somente `localStorage`, por UID. Falha de storage não bloqueia operação.

## 7. Mensagens de identidade

Os códigos técnicos continuam sendo produzidos por `lib/platformAccess.ts` para diagnóstico seguro.

A SAAS-C não alterou esse arquivo.

`hooks/useOperationalData.ts` traduz os códigos em categorias humanas, incluindo:

- conta não autorizada;
- workspace temporariamente indisponível;
- identidade/cadastro inconsistente;
- falha temporária de validação;
- e-mail não verificado;
- limite/revogação de sessão.

A UI não apresenta `ACCOUNT_NOT_FOUND`, `UID_MISMATCH`, `WORKSPACE_*`, `UG_MISMATCH` ou equivalentes.

## 8. Arquivos alterados

Código/UI:

- `app/page.tsx`;
- `components/admin/CreateSectorModal.tsx`;
- `components/auth/EmprovexLogin.tsx`;
- `components/auth/SectorCredentialModal.tsx` — novo;
- `components/auth/SectorFirstAccessChecklist.tsx` — novo;
- `components/layout/AppHeader.tsx`;
- `hooks/useOperationalData.ts`.

Gates:

- `scripts/verify-external-sector-login.mjs`;
- `scripts/verify-saas-r1-onboarding.mjs` — novo;
- `package.json`;
- `.github/workflows/application-ci.yml`.

## 9. Auth / Rules / env / banco

Firebase Auth:

- usa somente APIs oficiais do SDK cliente para reset e troca da própria senha;
- nenhuma nova credencial administrativa;
- nenhum novo provider.

Firestore Rules: **sem alteração**.
Indexes: **sem alteração**.
Variáveis de ambiente: **sem alteração**.
Banco: **sem novo banco, coleção ou documento**.
`lib/platformAccess.ts`: **sem alteração**.

## 10. Dependências para outras frentes

### SAAS-DL

A SAAS-C não implementou aceite legal. O Coordenador/SAAS-DL deve integrar o gate de aceite no ponto correto do primeiro acesso sem transformar reset de senha em dependência do aceite.

### SAAS-DS

A SAAS-DS pode reutilizar os contratos existentes de `workspace.status`, `platformAccount.status` e sessão. A SAAS-C não implementou suspensão comercial/enforcement.

Ao integrar, preservar:

- mensagens humanas desta frente;
- rota pública de recuperação de senha;
- reset de senha independente do status comercial quando a política de segurança permitir;
- provider Google-only do fundador e password-only do externo.

### Coordenador

Possíveis conflitos semânticos esperados:

- `app/page.tsx` caso SAAS-DL introduza gate de aceite;
- `components/layout/AppHeader.tsx` se outra frente adicionar controles globais;
- `components/admin/CreateSectorModal.tsx` se SAAS-B alterar apresentação do trial/billing.

Resolver por composição, não por `ours/theirs` global.

## 11. Riscos residuais

- envio real do e-mail de reset depende da configuração/template/domínio autorizado do Firebase Authentication no ambiente;
- a proteção contra enumeração é aplicada na mensagem do EMPROVEX; recomenda-se também manter habilitada a proteção de enumeração de e-mail do projeto Firebase;
- o checklist é propositalmente local ao navegador e pode reaparecer em outro dispositivo;
- a troca de senha pode exigir nova autenticação conforme política do Firebase; a UX já orienta sair/entrar quando necessário;
- integração com o aceite legal ainda pertence à SAAS-DL/Coordenador.

## 12. Validação

Guard específico:

`npm run verify:saas-r1-onboarding`

Também devem permanecer verdes no candidato:

- `npm run verify:external-sector-login`;
- `npm run verify:sector-auth-provisioning`;
- `npm run verify:sector-password-reset`;
- `npm run verify:hybrid-auth-model`;
- `npm run verify:firestore-provider-enforcement`;
- `npm run verify:emprovex-core-protection`;
- TypeScript;
- production build;
- diff hygiene;
- segurança multi-tenant/Firebase Emulator quando acionada pelo pipeline;
- Browser smoke/E2E dirigido para autenticação, conforme workflow sob demanda.

O resultado final dos gates será registrado no fechamento desta worker.

## 13. Proibições respeitadas

A SAAS-C não:

- alterou preço, trial, VIP ou cobrança;
- implementou pagamento ou suspensão comercial;
- implementou aceite legal;
- implementou backup/uptime;
- implementou SAAS-DS;
- incorporou commits de SAAS-B, SAAS-DL ou SAAS-E;
- fez merge em `main`;
- fez deploy de produção;
- publicou Rules.
