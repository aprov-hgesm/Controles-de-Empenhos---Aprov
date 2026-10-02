# EMPROVEX SaaS R1 — SAAS-I — Handoff de Integração Controlada

Última atualização: **2026-10-02**

## 1. Identidade da etapa

- Etapa: **SAAS-I — Integração Controlada, Glue Final e Validação Combinada**
- Branch técnica: `saas-r1-i-integration`
- Branch integradora alvo: `feat/saas-r1-commercializacao`
- Base/HEAD oficial de ativação: `71ed87932f17b8acd9fab9c30006970b59079c42`
- PR técnico: **#219**, draft, apontando somente para a integradora
- HEAD funcional pré-fechamento documental: `f840af0bffbd24dbe56c4de9f3a05334e68a2b7f`
- Produção preservada: `main@e90f92acae1514ee5cbc6ce95fed354bc1454330`
- Merge em `main`: **NÃO EXECUTADO**
- Deploy Vercel produção: **NÃO EXECUTADO**
- Publicação de Firestore Rules: **NÃO EXECUTADA**
- Migração VIP em produção: **NÃO EXECUTADA**

A SAAS-I partiu exatamente do HEAD consolidado que já continha SAAS-A, B, C, DL, E e DS. Nenhuma worker foi reincorporada.

## 2. IMPLEMENTADO

### 2.1 LegalAcceptanceGate integrado

O `LegalAcceptanceGate` foi conectado ao fluxo real do EMPROVEX depois de:
1. Firebase Auth resolvido;
2. platform account resolvida;
3. workspace resolvido;
4. UG resolvida;
5. autorização básica do tenant resolvida.

O gate não foi colocado no root layout. Portanto continuam fora do bloqueio:
- `/terms`;
- `/privacy`;
- tela de login;
- recuperação/reset de senha iniciados no login;
- `/regularizacao`;
- superfícies públicas independentes do shell operacional.

No shell principal, as subscriptions operacionais e o snapshot econômico do Início ficam desabilitados até a identidade resolvida ter aceite vigente. A liberação é vinculada a uma chave de identidade composta por UID + e-mail + workspace + UG, evitando reaproveitamento acidental de um aceite liberado após troca de conta/workspace.

### 2.2 Central de Depósitos

A rota direta `/adm-deposito` também passa pelo `LegalAcceptanceGate` somente depois de:
- Auth;
- workspace/UG;
- autorização da Central;
- validação de claims/status.

O controle de sessão/lifecycle pode continuar observando a autorização básica antes do aceite, mas o shell operacional da Central não é montado enquanto o aceite vigente estiver pendente.

### 2.3 Billing continua separado do enforcement

A SAAS-I não adicionou `billingAccounts` a `platformAccess`, lifecycle, Rules operacionais ou Rules da Central.

Permanece:
- billing = situação comercial;
- `workspace.status` + `platformAccount.status` = autorização operacional;
- atraso/trial vencido não suspendem sozinhos;
- suspensão exige ação administrativa explícita;
- reativação exige ação administrativa explícita;
- dados não são deletados;
- `/regularizacao` permanece pública.

### 2.4 Coorte VIP legado

Foi incorporada metadata mínima ao `BillingAccount`:
- `exemptionSource?: 'founder' | 'manual' | 'legacy_vip'`;
- `legacyVipCutoff?: '2026-10-02'`.

A semântica continua usando **somente** `status = exempt`; não foi criado estado concorrente `vip`.

Proteções:
- founder = `exempt` + `exemptionSource = founder`;
- VIP manual = `exempt` + `exemptionSource = manual`;
- VIP legado = `exempt` + `exemptionSource = legacy_vip` + corte `2026-10-02`;
- remover VIP legado pelo domínio lança erro;
- a Administração não oferece botão “Remover VIP” para legado;
- as Rules impedem que um documento já marcado `legacy_vip` seja convertido por update administrativo em conta cobrável;
- preço do VIP legado = R$ 0,00;
- Plano Completo preservado;
- billing histórico/competências não são reprecificados.

### 2.5 Migração VIP legado

Novos arquivos:
- `ops/saas-r1-legacy-vip.json`;
- `scripts/saas-r1-legacy-vip.mjs`.

Comandos:
- `npm run saas:r1:legacy-vip -- plan`;
- `npm run saas:r1:legacy-vip -- status`;
- `npm run saas:r1:legacy-vip -- dry-run --workspaces=<ids>`;
- `npm run saas:r1:legacy-vip -- apply --workspaces=<ids> --actor=<email> --confirm=VIP-LEGACY:2026-10-02:<N>`;
- `npm run saas:r1:legacy-vip -- verify --workspaces=<ids>`.

Garantias:
- founder excluído;
- seleção opera por workspace;
- `createdAt` posterior ao corte é recusado;
- timestamp ausente/inválido nunca gera inclusão automática;
- execução real exige allowlist explícita;
- identidade externa e UG são validadas;
- billing existente é preservado e apenas normalizado para isenção;
- billing ausente é materializado sem trial;
- `billingCycles` não são tocados;
- Auth/UID/e-mail/UG/lifecycle/dados operacionais não são alterados;
- write de billing + auditoria ocorre em commit Firestore atômico por workspace;
- auditoria possui ID determinístico por migração + workspace;
- reexecução detecta estado já aplicado e auditado e faz SKIP.

A quantidade real de workspaces candidatos **não foi inventada nem inferida do repositório**. Ela exige leitura autenticada do Firestore de produção via `status`/dry-run. A allowlist final deve ser congelada antes do `apply`.

## 3. VALIDADO E GUARDS

Foi criado:
- `scripts/verify-saas-r1-integration.mjs`;
- script npm `verify:saas-r1-integration`;
- etapa **SAAS R1 integrated contract guard** no `Application CI`.

O guard combinado protege:
- LegalAcceptanceGate no shell principal;
- bloqueio de listeners antes do aceite;
- gate na Central por acesso direto;
- root layout e `/regularizacao` sem gate;
- recuperação de senha preservada;
- billing ausente de platformAccess/lifecycle;
- metadata/proteção Rules de VIP legado;
- allowlist explícita da migração;
- founder excluído;
- domínio de VIP legado imutável;
- VIP manual ainda removível;
- preço comercial R$ 70 após remoção de VIP manual.

PR #219 foi aberto para disparar os gates canônicos. O resultado final de CI deve ser registrado no fechamento deste documento, sem chamar workflow cancelado/falho de verde.

## 4. RULES

Tamanho medido no candidato SAAS-I:
- banco principal `firestore.rules`: **94.318 bytes / 92,11 KiB**;
- Central `firestore.warehouse.rules`: **156.038 bytes / 152,38 KiB**.

A SAAS-I aumentou apenas o banco principal para permitir/proteger metadata mínima de VIP legado. A Central não recebeu delta de Rules na SAAS-I.

Nenhum terceiro banco foi criado.

## 5. JORNADAS INTEGRADAS — CONTRATO ESPERADO

### A — cliente novo
Provisionamento administrativo → billing/trial → login → LegalAcceptanceGate → onboarding → uso operacional.

### B — VIP legado
Workspace existente no corte → seleção/dry-run explícito → migração `exempt/legacy_vip` → login → aceite legal normal → Plano Completo → sem cobrança.

### C — VIP manual novo
Novo cliente → admin concede `exempt/manual` → aceite legal normal → acesso integral → sem cobrança.

### D — trial
Novo workspace → trial → acesso integral → fim do trial/atenção comercial → `/regularizacao` → nenhuma suspensão automática.

### E — pagante
Billing regular/pagamento confirmado → lifecycle permanece independente → operação normal.

### F — suspensão
Admin suspende → workspace/account disabled → sessões revogadas → EMPROVEX/Central bloqueados → dados preservados → `/regularizacao` pública.

### G — reativação
Admin reativa → workspace/account/Central active → novo login quando necessário → aceite legal vigente continua aplicável → dados intactos.

### H — reset de senha suspenso
Reset Firebase continua disponível no login; redefinir credencial não altera lifecycle. Após reativação, o usuário volta a autenticar normalmente.

### I — nova versão legal
Nova versão do bundle → gate reaparece para o usuário autenticado → Termos/Privacidade continuam públicas → novo aceite imutável, sem alterar o anterior.

## 6. EXIGE CONFIGURAÇÃO EXTERNA

Continuam fora do repositório e não foram marcados como executados:
- PITR nos dois bancos;
- delete protection nos dois bancos;
- schedule de backup diário;
- pelo menos um backup READY por banco;
- restore real em banco isolado;
- uptime check;
- alert policy;
- notification channel;
- validação do `/api/health` após publicação autorizada.

São gates para certificação operacional/SAAS-J.

## 7. Browser E2E e validação manual

Browser E2E da SAAS-I é sob demanda e deve ser registrado separando asserts funcionais de teardown/infra.

Cenários prioritários:
1. externo sem aceite → gate → ler Termos/Privacidade → aceitar → app;
2. Central direta sem aceite → gate → aceitar → Central;
3. reset de senha antes de autenticação;
4. VIP legado após migração dry-run/controlada;
5. suspensão → bloqueio EMPROVEX/Central + regularização pública;
6. reativação → novo login + dados preservados;
7. nova versão legal → novo aceite sem mutar histórico.

Checklist manual do operador:
- login externo;
- VIP manual e legado;
- aceite legal;
- Minha conta;
- troca/reset de senha;
- Central;
- suspensão;
- regularização;
- reativação.

## 8. Plano exato de release — NÃO EXECUTAR NA SAAS-I

### 8.1 Qual código vai para main

**Agora: nenhum commit.** SAAS-I não está autorizada a publicar `main`.

Fluxo futuro:
1. PR #219 entra somente em `feat/saas-r1-commercializacao` após aprovação;
2. SAAS-P executa piloto e correções na linha SaaS R1;
3. SAAS-J certifica operação;
4. somente com autorização explícita, criar PR da integradora final para `main`;
5. preferir **Squash and Merge**, produzindo um único commit de release SaaS R1 em `main`.

Não cherry-pickar individualmente B/C/DL/E/DS/I para `main`.

### 8.2 Preflight obrigatório da release futura

No commit exato aprovado:
```powershell
git fetch origin
git checkout feat/saas-r1-commercializacao
git pull --ff-only
git rev-parse HEAD
npm ci
npm run verify:saas-r1-integration
npm run verify:saas-r1-legal-acceptance
npm run verify:saas-r1-onboarding
npm run verify:saas-r1-security-enforcement
npm run verify:sector-lifecycle
npm run verify:block-22-billing
npm run verify:multitenant-security
npm run test:security:multitenant
npm run test:central-depositos-external-security
npm run verify:backup-recovery
npm run test:backup-recovery
npm run typecheck
npm run build
git diff --check
```

### 8.3 Backup e congelamento da coorte

Antes de qualquer mudança produtiva:
```powershell
npm run recovery:verify
npm run saas:r1:legacy-vip -- status
npm run saas:r1:legacy-vip -- dry-run --workspaces=<COORTE_CONGELADA>
```

Não prosseguir sem:
- proteção/backup operacional aprovado;
- allowlist final da coorte;
- revisão de candidatos não resolvidos;
- prova de que nenhum workspace pós-corte foi incluído.

### 8.4 Ordem segura de publicação

A ordem segura determinada pelos contratos atuais é:

1. backup/estado pré-release;
2. publicar **Rules do banco principal**;
3. publicar **Rules da Central**;
4. executar a migração VIP legado com allowlist congelada;
5. verificar a migração;
6. promover/deployar a aplicação SaaS R1;
7. smoke das jornadas críticas;
8. observabilidade.

Razão:
- o app SAAS-I exige Rules legais para ler/criar `legalAcceptances`;
- as novas Rules principais são compatíveis com o app anterior;
- as Rules novas da Central preservam fallback quando `warehouseAccess` ainda não existe;
- migrar a coorte antes da nova UI comercial impede que usuário legado apareça momentaneamente como cobrável.

Comandos de Rules, conforme `firebase.json`:
```powershell
firebase deploy --only firestore:ai-studio-logsticahospital-3eeee498-faa1-4326-8f4f-95d34b382ec1 --project gen-lang-client-0982077967
firebase deploy --only firestore:emprovex-warehouse --project gen-lang-client-0982077967
```

Migração:
```powershell
npm run saas:r1:legacy-vip -- apply --workspaces=<COORTE_CONGELADA> --actor=<EMAIL_ADMIN> --confirm=VIP-LEGACY:2026-10-02:<N>
npm run saas:r1:legacy-vip -- verify --workspaces=<COORTE_CONGELADA>
```

Vercel, somente no commit `main` autorizado:
```powershell
vercel pull --yes --environment=production
vercel build --prod
vercel deploy --prebuilt --prod
```

Se já houver preview imutável certificado, a promoção pode usar `vercel promote <deployment>` em vez de rebuild.

### 8.5 Smoke pós-deploy

Confirmar imediatamente:
- `/api/health`;
- `/terms` e `/privacy` sem login;
- `/regularizacao` sem login;
- login externo;
- reset de senha;
- aceite legal;
- VIP legado exibido como “VIP legado / Isento”;
- novo cliente mantém R$ 70 / trial quando aplicável;
- Central abre para ativo;
- Central bloqueia suspenso;
- reativação;
- ausência de erros de permissão inesperados;
- `warehouseAccess` ausente não suspende tenant legado;
- primeira ação lifecycle materializa `warehouseAccess`.

## 9. Rollback

### Aplicação
Preferência:
```powershell
vercel rollback <DEPLOYMENT_ANTERIOR>
```
ou promover explicitamente o deployment anterior conhecido.

### Rules
Manter tag/SHA pré-release. Em falha de Rules:
1. checkout do SHA anterior;
2. redeploy do arquivo correspondente ao banco afetado com o seletor `firestore:<databaseId>`;
3. repetir smoke de isolamento e autorização.

### Dados
- rollback de aplicação/Rules **não deve remover a isenção VIP legado**;
- documentos de aceite já criados são imutáveis e podem permanecer;
- `warehouseAccess` já materializado pode permanecer;
- não apagar tenant, Auth, billing histórico ou dados operacionais;
- se a allowlist da migração tiver sido incorretamente aprovada, interromper cobrança e tratar a correção como ação administrativa explícita/auditada; não executar “rollback em massa” automático.

## 10. Pendências para SAAS-P

- piloto funcional com VIP legado pode provar fluxo, mas não pagamento;
- incluir pelo menos um workspace novo não legado;
- exercitar trial;
- pagamento real externo;
- confirmação administrativa;
- suspensão/reativação controlada;
- registrar feedback de UX do LegalAcceptanceGate e regularização.

## 11. Pendências para SAAS-J

- configuração externa real de backup/recovery;
- backup READY nos dois bancos;
- restore real isolado;
- uptime/alerta/canal;
- evidência pós-release/piloto;
- decisão final de promoção para `main` e abertura comercial.

## 12. Status de fechamento

Este documento deve ser atualizado com os resultados finais do PR #219 antes da declaração final da SAAS-I.

**NÃO PUBLICADO.**
