# EMPROVEX CORE LEAN R2 — Worker 3 | Identidades financeiras

Status: contrato **aditivo / opt-in**, isolado da autorização server-side e da persistência. Base: main afe163139 (24/10/2026). Não há migração de dados, deploy ou alteração de Rules. PR #370 segue DRAFT/NO-GO (HEAD bc4b6592): leitura/gravação financeira parcialmente migrada; NF/NS e exclusão de NE ainda usam transações SDK.

## Inventário verificado no código

| Domínio | Persistência / referência / operação | Garantia e risco |
| --- | --- | --- |
| Empenho | Empenho.id é chave interna e número da NE exibido; revision é controle otimista; updatedBy autoria | Igualdade não ultrapassa workspace; não fundir por nome/descrição; trava de exclusão separada em empenhoDeletionService |
| Item NE | Item.id identifica linha dentro de Empenho.items; itemCompraNumber é referência de compra | warehouseMaterialId é ponte opcional ao material canônico, NÃO substitui Item.id |
| NF | Invoice.id é número exibido; Invoice.recordKey ou id legado é chave física | buildInvoiceRecordKey(cnpj,numero) não considera série/modelo; colisão entre séries é **possibilidade**, não ocorrência demonstrada |
| NF fiscal | supplierCnpj, número, série/modelo e eventual chave 44-dígitos | Na base atual Invoice não tem série/modelo/chave explícitos; a V2 define referência separada e **não habilita gravações** |
| NS | nsUg + numeroNS; lock sagNsLock_UG_NS; legado sagNsLock_NS | Transação + verificação de proprietário/revisão; scope de workspace está no caminho, UG no lock |
| Fornecedor | supplierCnpj e SupplierContact.id; diretório de fornecedores possui cnpj | CNPJ alfanumérico válido é suportado pelo normalizador existente; razão social não é chave |
| PDFs | Pdf.id e pathname lógicos; storage.objectKey físico; storage.folderKey; storage.workspaceId; status | Versões notaEmpenhoPdfVersions, notaFiscalPdfVersions, espelhoNotaFiscalPdfVersions; agendamento deletedAt/deletedBy não é alterado |
| Operações | auditoria correlationId, atualização revisão, locks e UID autenticado | IDs de correlação são rastreio, nunca identidade fiscal; UID/workspace/UG devem vir da autorização do servidor |
| Warehouse | InvoiceItem.itemId → Empenho.items.id; warehouseMaterialId / warehouseMovementIds | Links preservam histórico logístico; não resolver material por descrição |
| Organização | workspaces/{workspaceId}/coleções; UG validada | Escopo não deriva de parâmetro escolhido pelo cliente; administrador e operador possuem perfis distintos |

Referências: lib/types.ts, lib/invoiceIdentity.ts, lib/nsIntegrity.ts, lib/nsIntegrityService.ts, lib/empenhoDeletionService.ts, lib/empenhoConcurrency.ts, lib/operationalPaths.ts, lib/platformIdentity.ts, lib/supplierCnpjMigration.ts, docs/NS_UG_IDENTITY_BLOCK_7.md.

## Contrato aditivo implementado

lib/financialIdentityV2.ts:
- normaliza série numérica (001 = 1), modelo (2 dígitos) e chave eletrônica de 44 dígitos;
- valida dígito da chave, identidade do emitente e campos incorporados;
- propõe índice nfv2_CNPJ_MODELO_SERIE_NUMERO somente quando dimensões obrigatórias estão completas e CNPJ é válido;
- retorna **ambiguous** para conflitos não resolvidos, incluindo documentos legados, campos incompletos ou inválidos;
- separa identidade física histórica (recordKey) da identidade fiscal candidata;
- valida vínculos NF → item NE → warehouse e PDF → NF/NE → workspace, sem alterar os documentos;
- classifica anexos legados sem storage.workspaceId como legacy-unverified, nunca como autorizados implicitamente.

scripts/financial-identity-v2.test.mjs: provas executáveis de domínio com VM TypeScript usando dados fictícios. Os contratos existentes de NS/revisão são carregados e exercitados sem replicar seus algoritmos. Não substitui Emulator para verificações de transação/autorização.

## Condições para futura ativação — NÃO EXECUTADAS

1. Inventariar, por workspace e sob autorização específica, todos os formatos de NF e colisões potenciais; não alegar colisões reais sem leitura certificada. Levantar se série, modelo e chave chegam das fontes SAG/XML e como são armazenados.
2. Com PR #370 reconciliado, desenhar writer server-only com token validado, lock/índice versionado reservado **na mesma transação** da NF e dos lançamentos/revisões; checar formatos legados na mesma decisão; negar identidades ambíguas.
3. Adicionar campos opcionais de referência fiscal ao modelo Invoice somente após confirmar fontes e UX; não trocar recordKey nem migrar PDFs/locks por renomeação.
4. Migrar NS, exclusão de NE, NF e listeners em trabalhos coordenados; usar o Emulator Auth/Firestore para concorrência, replay, idempotência, revisões obsoletas, UID/UG/workspace forjados e rollback integral.
5. Plano e ensaio de migração aditiva, backup/rollback, auditoria e autorização explícita antes de qualquer backfill; nunca reescrever histórico automaticamente.

## Handoff ao Coordenador e PR #370

Este Worker não edita firebaseSync, nsIntegrityService, empenhoDeletionService, Warehouse, CI workflows, Rules ou rotas de autorização. Os helpers V2 estão disponíveis para integração futura, **não são ainda enforcement**. O bloqueio conservador vigente de findInvoiceIdentityConflict continuará recusando mesmo número/CNPJ independentemente da série. Para permitir séries distintas no futuro, integrar reserva server-side com migração controlada e revisão da política de conflito, sem enfraquecer a segurança anterior. Testes autenticados e de persistência dependem do motor server-side a concluir no PR #370.

## Endurecimento do contrato documental e certificação R2

- O resultado `verified` de `assertInvoicePdfReferences` passa a exigir também `expected.documentId` e `expected.objectKey`, **obtidos independentemente de fonte confiável**, além da coincidência de workspace, NF e NE. Comparar apenas campos fornecidos pelo cliente é `unattested`, e não prova de autorização. Documento sem metadata de armazenamento histórica é `legacy-unverified`. Ambos requerem saneamento/validação antes de operações privilegiadas.
- Provider do storage e ID físico vazios são rejeitados; divergência entre o ID lógico ou a chave física observada e a referência autoritativa produz erro. O fluxo existente de exclusão/Drive NÃO é chamado nem modificado por este contrato; nenhum PDF histórico é regravado.
- Guard de domínio: `npm run typecheck` invoca `pretypecheck` → `node --experimental-vm-modules --test scripts/financial-identity-v2.test.mjs` antes de `tsc --noEmit`. Este gatilho é **provisório e explícito** até o Worker 2 incorporar a suíte diretamente aos domínios financeiros de CI (solicitação registrada no PR #372). Não foi editado workflow do Worker 2.
- Prova no commit 772a64ee: GitHub Actions Fast CI run 40157614720, **13/13 PASS, 0 FAIL**, e TypeScript PASS, Core Protection PASS. O endurecimento documental posterior adiciona caso específico; a evidência do commit final deve ser a do run do HEAD final, não este.
- Limite de prova: testes desta suíte usam contratos reais transpilados na VM do Node, com dados sintéticos. Não executam Firestore Emulator nem validam o writer NF/NS server-side. O segundo resultado (ativação transacional) permanece **NO-GO** sem o PR #370 e suite Emulator autenticada.
