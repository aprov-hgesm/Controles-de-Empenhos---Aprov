# Bloco 3 — Ciclo de vida da NF e locks de NS

## Objetivo

Resolver os gaps de alta severidade:

- **GAP-002:** exclusão de NF podia deixar lock de NS órfão;
- **GAP-003:** mudança de `recordKey` podia deixar o lock apontando para a identidade antiga.

O bloco também corrige uma borda relacionada: edição de NF com o mesmo `recordKey`, mas metadados de vínculo atualizados, agora revalida e sincroniza o lock.

## Arquitetura

Os fluxos abaixo passam por `lib/nsIntegrityService.ts`.

### Edição / recebimento

`commitInvoiceReceiptLifecycle()`

Quando a NF é nova, o serviço confirma que o `recordKey` está livre e grava empenho, NF e alerta na mesma transação.

Quando a NF já existe, o serviço relê a identidade anterior, confirma que a NS não mudou por outro caminho, relê e valida o lock, grava a NF editada e migra ou atualiza o lock no mesmo commit.

A NS não pode ser alterada pelo formulário geral de edição da NF. Mudanças de NS continuam passando pelo campo específico protegido pelo Bloco 2.

## Migração de recordKey

Exemplo: `nf_CNPJ_1234` com `2026NS000123` pode migrar para `nf_CNPJ_5678` preservando a mesma NS.

A transação cria/atualiza a nova NF, apaga a NF antiga e atualiza `sagNsLock_2026NS000123` para apontar ao novo `invoiceRecordKey` e `invoiceId`. Nenhum estado intermediário é confirmado.

## Edição com mesmo recordKey

Mesmo sem trocar o `recordKey`, metadados como `invoiceId` ou `empenhoId` podem mudar em algumas edições.

Quando a NF possui NS, o lock é relido e regravado com os metadados coerentes com a NF final. As Rules só permitem isso quando o estado final da NF confirma exatamente `recordKey`, `invoiceId`, `empenhoId`, `supplierCnpj` e `numeroNS`.

## Exclusão individual

`commitInvoiceDeletionLifecycle()` relê a NF, valida o empenho, relê o lock quando houver NS, confirma o proprietário e remove NF + lock na mesma transação.

NF histórica com NS sem lock continua podendo ser excluída; não é criado um lock apenas para removê-lo.

## Exclusão em lote

`commitAllInvoicesDeletionLifecycle()` relê todas as NFs, identifica os locks associados e valida seus proprietários antes de qualquer escrita.

O limite considera empenhos atualizados + NFs excluídas + locks excluídos e não pode ultrapassar **450 writes** por transação.

Se uma NF tiver mudado/desaparecido ou um lock pertencer a outra NF, toda a exclusão é cancelada.

## Firestore Rules

O Bloco 3 adiciona três controles específicos.

### Owner migration

O proprietário do lock só pode trocar de `recordKey` quando a NF antiga deixa de existir após a transação, a nova existe e confirma o mesmo número de NS e os mesmos metadados finais.

### Metadata refresh

Quando o `recordKey` permanece igual, alterações de metadados do lock só são permitidas quando o estado final da NF confirma os mesmos valores.

### Delete do lock

Um lock ativo não pode mais ser apagado isoladamente enquanto sua NF ainda mantém aquela mesma NS.

O delete é permitido se, no estado final da operação, a NF proprietária foi excluída ou deixou de possuir aquela NS. Isso torna também funcionais e protegidos os fluxos de troca/remoção manual introduzidos no Bloco 2.

## Emulator

A suíte multi-tenant cobre delete isolado bloqueado, migração NF + lock, exclusão NF + lock, remoção manual de NS + liberação de lock, refresh coerente de metadados, bloqueio de troca arbitrária de proprietário e isolamento cross-tenant.

## Fora do escopo

O Bloco 3 não implementa a migração em cascata de todas as NFs quando o CNPJ do empenho é alterado. Isso permanece no **Bloco 4**.

A identidade física com UG, trilha histórica e endurecimento completo do contrato NF↔lock continuam nos blocos posteriores.
