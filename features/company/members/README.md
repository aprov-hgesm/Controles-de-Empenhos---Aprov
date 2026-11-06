# EMPROVEX Empresas — W3 / equipe, convites e RBAC (handoff)

**Base exata:** W0 PR #511 @ `16b763e929342b6ea1f5858470cc670c9ea5a3f4`.  
**Ownership:** `features/company/members/**`, `lib/company/roles/**`, `lib/server/companyMembership/**`, `app/api/company/members/**`. Nenhum arquivo W0, login, Admin militar, Rules, package-lock ou CI global foi modificado. **Sem merge, deploy ou acesso a dados reais.**

## Estado funcional no branch W3

- O titular canônico, autenticado pelo **W0**, é administrador imutável do bootstrap. Ele não é duplicado como documento editável na coleção `members`. Logo, não existe operação que remova o último administrador titular.
- Papéis componíveis por união: `admin`, `operations`, `stock`, `logistics`, `driver`, `finance`. A tabela executável está em `lib/company/roles/index.ts`. Somente o titular verificado pode conceder `admin` nesta primeira versão.
- Convites por e-mail normalizado; ID determinístico SHA-256 do e-mail **dentro da raiz da empresa**; token aleatório de 256 bits, hash SHA-256 persistido, validade de 7 dias e retorno **uma única vez** ao titular. Sem envio de e-mail/WhatsApp simulado. Reenvio de convite válido gera 409; expirado/revogado pode ser recriado com CAS.
- Aceite exige Firebase Auth de **e-mail verificado**, senha, usuário ainda habilitado, e-mail idêntico, empresa ativa, token e prazo válidos. Conta setorial, fundadora ou vinculada a outro diretório é recusada; token é consumido atomicamente.
- Alterar papéis e revogar são atualizações por precondição `updateTime`, com evento imutável de auditoria no **mesmo commit Firestore**. Duas gravações sobre a mesma revisão não vencem juntas. Revogação limpa hash do convite e bloqueia capacidade no próximo lookup live.
- Todos os registros residem apenas em `supplierCompanyWorkspaces/{companyId}/members/{sha256(email)}`, eventos em `.../auditEvents/{uuid}`. `companyId`/`workspaceId` persistidos são conferidos ao ler e alterar. Nenhuma permissão militar é herdada.

## API (pilot OFF retorna 503)

| Método | Rota | Contrato |
|---|---|---|
| GET | `/api/company/members?limit=25&cursor=` | Lista paginada só do workspace W0, sem hash de convite |
| POST | `/api/company/members` | `{ "email": "...", "roles": ["stock", "logistics"] }` → 201 membro + `invitationToken` exibido uma vez |
| PATCH | `/api/company/members/{memberId}` | `{ "roles": ["finance"] }` → revisão+auditoria, somente titular |
| DELETE | `/api/company/members/{memberId}` | Revogação lógica e auditada, sem excluir registros |
| POST | `/api/company/members/accept` | `{ "companyId": "...", "invitationToken": "..." }`, JWT Firebase verificado → membro ativo |

Cabeçalho `Authorization: Bearer <Firebase ID token>` em todas as rotas. Respostas `Cache-Control: private, no-store`. Alterações retornam `409` por disputa/duplicidade, `400` por input inválido; `401/403` falham fechadas para identidade/autorização, `503` por disponibilidade/flag. Nenhum endpoint aceita `uid`, `role` ou `workspaceId` do cliente como prova de autorização.

**Exceção mínima:** `POST /accept` precisa reconhecer identidade de convidado *antes* de existir sessão W0; tem somente autenticação Firebase + desafio criptográfico de convite, não oferece leitura de dados operacionais nem acesso ao shell. Todos os demais handlers chamam `requireCompanyContext` W0. O aceite devolve `accessPendingIntegration: true` de propósito.

## Handoff obrigatório ao integrador W0/W10 — NÃO alterar em paralelo

**Bloqueio real:** o W0 verifica apenas o UID/e-mail do titular em `platformAccounts`, `platformAuthUidIndex` e `workspaces.authorizedEmail`; portanto, **um membro aceito ainda NÃO tem sessão empresarial operacional**. O W3 fornece `checkLiveMemberCapability(companyId, principalVerificado, action)` para o integrador; não é substituto autônomo do guard. Integrador deve:

1. Permitir identidade de membro após validar JWT Auth, e-mail verificado, UID, estado da empresa, inexistência de vínculo setorial e membership persistida no tenant escolhido. Definir vínculo/seleção de workspace seguro, sem auto-fallback para setor e sem inferir permissão por parâmetro de rota.
2. Alterar **somente no integrador** `verifyCompanySession`/`requireCompanyContext`: verificar membership ativa e `permitsCompanyAction` em **cada request**, nunca cachear concessões antigas; manter o owner canônico. Não usar claims/roles enviados pelo navegador.
3. Homologar com Firebase Auth/Firestore Emulator de projeto `demo-*` em loopback: convidado A não lê B, token inválido/expirado, concorrência de aceite e alterações, revogação imediata, administração indevida, fundador/setor preservados, falha 503. Só após esses testes considerar GO de integração.

**Futuro fornecedor externo por pedido:** contrato semântico `CompanyOrderShareFutureContract` restringe `order:read/order:reply` a pedido específico. Não há convite público, papel amplo nem implementação de delegação nessa fase.

## Verificações reproduzíveis

- `node --experimental-strip-types --test features/company/members/*.test.mjs`
- `npm run typecheck` e `npm run build`, na branch W3.
- CI Core Protection, identidade W0, Visual-R2 e E2E Auth/Firestore antes da integração.

**Parecer W3:** código de domínio pronto para revisão isolada; **NO-GO para liberar acesso de funcionários, merge ou deploy** sem handoff do guard W0, emulator E2E e CI verde. O titular pode administrar convites somente no ambiente de desenvolvimento com a flag piloto habilitada.
