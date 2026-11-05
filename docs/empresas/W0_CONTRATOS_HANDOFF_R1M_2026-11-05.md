# W0 R1-M — contratos congelados e handoff (Empresas)
**Data:** 05/11/2026. **Origem:** PR #510 @ `a8c684bcb09e977e38b3b0964b91c53c964a2588`. **Branch:** `feat/empresas-w0-r1m-foundation-20261105`. **Destino:** PR Draft #511 contra a branch da #510. **Status:** homologação em curso, sem merge/deploy.

## Contratos v1 (fixados pelo W0)

Fonte normativa de tipos, erros e caminhos: `lib/company/contracts/index.ts`, versão `company-r1-v1`. Guard único: `lib/server/companyAuthz/index.ts`. O corpo/request não concede papel, workspace, UID, CNPJ ou acesso a recurso. Todo handler de W1–W9 deverá chamar `requireCompanyContext(request, { action, companyId?, resource? })` **antes** de ler ou gravar; a leitura do documento deve ser restrita ao `rootPath` retornado e seu `resource.companyId` persistido deve ser checado **antes de devolver dados**. Eventos de domínio exigem idempotencyKey + requestHash calculados/validados no servidor; `idempotencyKeys` deve ser gravada na mesma transação da mutação, com replay do mesmo resultado e conflito em hash diferente. Auditoria de mutações preserva `actorUid`, `companyId`, revisions, `correlationId`, timestamps, sem payloads sensíveis nos logs.

### Identidade e coleções

| Classe | Caminho | Ownership e finalidade |
|---|---|---|
| Diretório canônico compartilhado | `workspaces/{workspaceId}`, `platformAccounts/{normalizedEmail}` | Somente fundação/admin; `workspaceType: company` é discriminador estrito |
| Índices de unicidade | `platformAuthUidIndex/{uid}`, `platformCnpjIndex/{cnpj}`, `platformProvisioningLocks/{kind-key}` | Provisionamento server-side com pré-condições transacionais; UID, email, workspace e CNPJ únicos |
| Auditoria fundadora | `platformAuditEvents/{eventId}` | Evento `company.create`, operador fundador, `correlationId` |
| Dados privados de empresa | `supplierCompanyWorkspaces/{companyId}` | `companyId = workspaceId` **verificado pelo servidor**, nunca UG, CNPJ ou slug |
| Clientes públicos | `.../publicCustomers/{id}` | OM/órgão comprador é **cliente da empresa**, não workspace militar |
| NE e pedidos | `.../commitments/{id}`, `.../customerOrders/{id}` | NE da OM distinta de solicitação/pedido |
| Origem/catálogo | `.../sourceSuppliers/{id}`, `.../catalogItems/{id}` | Fornecedor de origem, nunca conta institucional |
| Pessoas e documentos | `.../members/{id}`, `.../documents/{id}` | W3 e W5; permissão somente após guard e membership |
| Compra/estoque/transporte | `.../purchaseOrders/{id}`, `.../stockEvents/{id}`, `.../allocations/{id}`, `.../inboundShipments/{id}`, `.../deliveries/{id}` | Um ledger empresarial, separado do Warehouse |
| Financeiro | `.../accountsPayable/{id}`, `.../accountsReceivable/{id}` | BRL centavos, não herdar billing militar |
| Auditoria e idempotência | `.../auditEvents/{id}`, `.../idempotencyKeys/{id}` | Append-only por evento e gravação transacional |

**Schema:** `CompanyOwnedRecord` exige `schemaVersion, id, companyId, workspaceId, status, createdByUid, createdAt, updatedAt, revision`. Datas são ISO 8601 UTC com proveniência `requested/promised/estimated/confirmed/actual`. `CompanyMoney` usa **centavos inteiros** e moeda BRL. `CompanyQuantity` usa decimal string e unidade explícita (`UN, KG, G, L, ML, CX, FD, M`); conversão racional numerador/denominador. Cancelamento e estorno geram eventos auditados; não apagam fatos. Os caminhos rejeitam segmentos fora do alfabeto permitido.

### Matriz de acesso W0

| Identidade | `/login` | `/empresa` e API | Setor/depósitos |
|---|---|---|---|
| Fundador, senha ou Google | Reconhecido pelo resolvedor institucional | **403**; não vira empresa | Inalterado, conforme perfil autorizado |
| Setor legado válido | Resolvido pelo próprio diretório/UID do setor | **403** | Permitido pelas Rules vigentes |
| Empresa A ativa | Sessão autoriza `/empresa` | Somente `companyId A`, W0 role `owner` | **Negado**, sem fallback |
| Empresa B ativa | Sessão autoriza `/empresa` | Somente `companyId B`, W0 role `owner` | **Negado**, sem fallback |
| Empresa suspensa/disabled | Não se torna setor | **403**, ou **401** se Auth desativado | Negado |
| Token ausente/inválido | Não autoriza | **401** | Negado |
| UID/email/índice/workspace divergente | Não autoriza | **403** | Negado |
| Serviço empresarial indisponível | Só setor/fundador **revalidados independentemente** podem abrir shell | **503**, sem dados | Sem fallback para empresa |
| Piloto OFF ou kill switch ON | Setores/fundador preservados | Novas operações **503**; provisionamento **503** | Inalterado |

**Papéis W0:** apenas `owner`, sempre derivado do UID primário verificado por Auth+índices+workspace. O W3 deverá implementar memberships e revogação no servidor; jamais adicionar papéis em payload/claims não confrontadas com diretório. Nenhum endpoint empresarial operacional está autorizado a pular o guard.

### API de autorização e erros

```ts
const context = await requireCompanyContext(request, {
  action: 'customerOrders:write',
  companyId: params.companyId,
  resource: { companyId: existingOrder.companyId, workspaceId: existingOrder.workspaceId },
});
// A partir daqui, e SOMENTE após validar o recurso, acessar
// context.rootPath + '/customerOrders/...' com serviço gerenciado.
```

- `401 COMPANY_AUTH_INVALID`: token ausente/inválido/expirado ou usuário Auth inválido.
- `403 COMPANY_ACCOUNT_FORBIDDEN` / `COMPANY_WORKSPACE_FORBIDDEN`: conta, UID, provedor, status ou vínculo divergente.
- `403 COMPANY_SCOPE_FORBIDDEN` / `COMPANY_OPERATION_FORBIDDEN`: empresa, recurso, criador (quando requerido) ou ação sem autorização.
- `503 COMPANY_DIRECTORY_UNAVAILABLE` / `COMPANY_SESSION_UNAVAILABLE`: backend ou timeout, sem permissões parciais.
- `503 COMPANY_PILOT_DISABLED`: operações operacionais desabilitadas (flag OFF por padrão).
- `503 PILOT_DISABLED`: cadastro empresarial indisponível; `EMPROVEX_DISABLE_COMPANY_PROVISIONING=1` e `EMPROVEX_DISABLE_ADMIN_MUTATIONS=1` prevalecem mesmo com piloto ON.
- `409 CONFLICT`: reserva duplicada por CNPJ/e-mail/workspace ou índice presente.
- `503 RECOVERY_REQUIRED`: falha parcial que requer ação administrativa; nunca entregar Auth com diretório incoerente.

### Rotas e ownership de desenvolvimento

- W0: `/login`, `/api/company/session` (já existente), `/api/admin/provision-company`, `/api/admin/companies`; módulos `companySession`, `companyProvisioningAdmin`, `companyAuthz`, `company/contracts`.
- W1: `/api/company/customers/**`, `commitments/**`, `customer-orders/**`; paths de dados `publicCustomers`, `commitments`, `customerOrders`.
- W2: `/api/company/suppliers/**`, `catalog/**`; `sourceSuppliers`, `catalogItems`.
- W3: `/api/company/members/**`; `members`; evolução do guard **somente via integrador**.
- W4: `app/empresa/**`, `components/company/**` (sem alteração de login).
- W5: `/api/company/documents/**`; `documents`; parser PDF puro, sem API militar.
- W6/W7/W8: `purchaseOrders`/`stockEvents`/`allocations`/`accountsPayable`/`accountsReceivable`, sempre sob raiz da empresa.

**Condição de abertura W1–W5:** P0 E2E e regressões completos, CI verde e aprovação do integrador. Este documento não autoriza deploy, merge, alteração de Rules ou dados de produção.
