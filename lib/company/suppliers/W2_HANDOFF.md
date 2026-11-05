# EMPROVEX Empresas — W2 fornecedores de origem e catálogo (R1-M)

Base W0: `16b763e929342b6ea1f5858470cc670c9ea5a3f4` (PR #511). Nenhuma alteração em fluxos militares, contratos W0, Rules, IAM ou deploy.

## Dados privados e contratos

- `supplierCompanyWorkspaces/{companyId}/sourceSuppliers/{supplierId}`: `SourceSupplier` tem `status` de `CompanyOwnedRecord` (`active`, `suspended`, `archived`) e `lifecycle` (`active`, `suspended`, `inactive`), CNPJ opcional validado, até 12 contatos, canais, condições, prazo estimado, timestamps/revision/UID. `id` determinístico `tax_{cnpj}` ou `name_{hashNome}`; duplicidade desses identificadores limitada ao tenant.
- `.../catalogItems/{id}`: `CatalogItem` tem SKU canônico por empresa; cada produto permite diversas `SupplierSourceOption` com referência a `sourceSupplierId`, SKU de origem, unidade de compra, pacote, conversão racional para `canonicalUnit`, histórico de preços datados (`quotedAt`, `validFrom`, `validUntil`, `basis`) e lead time.
- Preço é sempre `amountCents` inteiro BRL **por unidade de compra**, e registro histórico, nunca cotação atual implícita. Histórico é append-only; conversão/unidade antiga não pode ser reescrita. Nenhum preço de venda de OM é convertido em custo.
- `convertQuantityExact` recebe decimal string e fatores racionais, usa BigInt internamente, rejeita resultados não representáveis exatamente em até 9 casas. Não infere conversões por unidade.
- `purchaseSelectionContract` e `resolveSourceOptionForPurchase` oferecem contrato para W6/W7: item e fornecedor pertencem à mesma empresa, fornecedor exige `status === active` e `lifecycle === active`; a seleção devolve somente `historicalReferencePrice`, não preço atual autorizado. **W6 deve reler o fornecedor na transação de criação da compra, com nova checagem do status**, para impedir corrida com suspensão. Exceções para suspensos exigem contrato de autorização futuro W3/integrador; W2 não as concede.

## APIs e regras

| Rota | Operações | Ação W0 |
|---|---|---|
| `/api/company/suppliers` | GET lista/paginação/busca; POST cria | `sourceSuppliers:read/write` |
| `/api/company/suppliers/{id}` | GET por ID; PATCH substituição com `expectedRevision` | `sourceSuppliers:read/write` |
| `/api/company/catalog` | GET lista/paginação/busca; POST cria | `catalogItems:read/write` |
| `/api/company/catalog/{id}` | GET por ID; PATCH com `expectedRevision` | `catalogItems:read/write` |

Chamadas mutáveis exigem cabeçalho `Idempotency-Key` (12–128 caracteres seguros). Firestore REST executa em **commit atômico** registro + `auditEvents` + `idempotencyKeys`. Repetição de chave com mesmo hash devolve snapshot original; com hash diferente = `409`. Atualização usa precondição `updateTime` e `expectedRevision` para conflito `409`; nunca apagamos histórico. Toda rota chama `requireCompanyContext` ANTES do acesso a documentos e valida ownership persistido no retorno. Erros 401/403/503 seguem W0, sem log de tokens/dados.

Paginação: GET `?limit=20&cursor=...&q=...`, no máximo 50 documentos por página, cursor Firestore opaco. **Limite conhecido**: o filtro textual é aplicado apenas aos documentos varridos na página atual, não uma busca global indexada. O cursor avança mesmo com 0 correspondências; W10 pode integrar busca indexada após medir carga.

Superfícies apresentacionais prontas (sem acoplamento ao shell W4): `SourceSuppliersWorkspace` e `CatalogWorkspace`, ambos recebem `getIdToken()` do shell W0/W4. O integrador pode colocá-los nas rotas empresariais depois de harmonizar navegação.

## Testes e limites

`node --test lib/company/suppliers/w2.test.mjs`: valida CNPJ/contatos, conversões exatas, fontes múltiplas, preço histórico, suspensão, isolamento A/B, idempotência, duplicidade, revisão concorrente, paginação, imutabilidade e guard 401/403 por mock. Trata-se de suíte local com **mock transacional** de Firestore, e **não** é substituto de E2E Auth/Firestore Emulator do W0.

Ainda necessário para GO do integrador: workflow CI typecheck/build no head W2, E2E com Auth/Firestore Emulator para operações W2 e verificação da integração com W3/W4/W6. Nenhum dado de empresa real, merge, deploy ou alteração de Rules.
