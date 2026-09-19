# Bloco 4 — Migração segura do CNPJ do fornecedor

## Objetivo

Resolver o GAP-004 e aplicar o invariante NS-008 do contrato de integridade:

- alterar o CNPJ do empenho não pode deixar NFs com CNPJ antigo;
- os `recordKeys` das NFs devem acompanhar a nova identidade;
- locks de NS devem continuar apontando para a NF correta;
- colisões devem bloquear toda a operação antes do commit.

## Fluxo

A alteração de CNPJ agora usa `commitEmpenhoSupplierCnpjMigration()`.

O serviço primeiro consulta as NFs vinculadas ao empenho e limita a migração a 100 NFs por transação. Após o hardening global das Rules, uma mesma migração pode conter no máximo **5 NFs com NS**, preservando o orçamento de leituras cruzadas do Firestore. Depois, dentro de `runTransaction()`:

1. relê o empenho;
2. relê todas as NFs descobertas;
3. monta o plano de migração;
4. calcula os novos `recordKeys`;
5. relê todos os documentos de destino para detectar colisões;
6. relê todos os locks de NS;
7. valida proprietário e metadados dos locks;
8. atualiza o CNPJ do empenho;
9. cria as NFs na nova identidade;
10. remove as identidades antigas;
11. migra ou reconstrói os locks;
12. confirma tudo atomicamente.

## Planner puro

`lib/supplierCnpjMigration.ts` concentra a lógica determinística de planejamento.

Ele bloqueia:

- CNPJ alvo inválido;
- remoção do CNPJ quando existem NFs;
- NF com CNPJ divergente do empenho;
- duas NFs que resultariam no mesmo `recordKey`.

Também corrige identidades legadas: mesmo que o CNPJ não mude, uma NF com `recordKey` antigo pode ser migrada para a chave canônica.

## Colisão

Antes de qualquer escrita, o serviço relê cada novo `recordKey`.

Se qualquer destino já existir, a operação inteira é cancelada. Nenhuma NF antiga é removida e o empenho permanece inalterado.

## Locks de NS

Cada NF com `numeroNS` participa da migração.

Se o lock existir, ele precisa pertencer à NF de origem e seus metadados devem ser coerentes com `invoiceId`, `empenhoId` e CNPJ.

Se a NF histórica possuir NS mas não possuir lock, o Bloco 4 reconstrói o lock durante a migração, desde que não exista conflito.

Se duas NFs vinculadas ao mesmo empenho compartilharem a mesma NS, a migração falha fechada.

## Firestore Rules

O Bloco 4 acrescenta vínculo explícito entre lock e empenho.

Em migrações de proprietário ou refresh de metadados, as Rules exigem que o estado final contenha:

- NF com `recordKey`, `invoiceId`, `empenhoId`, `supplierCnpj` e `numeroNS` coerentes;
- empenho com o mesmo `empenhoId`;
- empenho com o mesmo `supplierCnpj` do lock.

Assim, alterar NF + lock sem atualizar o CNPJ do empenho na mesma transação é rejeitado.

## Concorrência com recebimento de NF

O fluxo de recebimento/edição de NF agora relê o empenho dentro da própria transação e compara o CNPJ armazenado com o CNPJ esperado pela NF.

Se uma migração de CNPJ ocorrer em paralelo, o Firestore força reexecução da transação; na nova leitura, a divergência gera `supplier_scope_changed` e o recebimento é cancelado até que o usuário reabra a NF com o novo fornecedor.

A migração também rejeita documentos cujo campo `recordKey` diverge do ID físico do documento Firestore ou cuja NF tenha mudado de empenho durante a preparação.

## Interface

`handleUpdateEmpenhoSupplierCnpj()` não usa mais `saveEmpenho()`.

Quando existem NFs vinculadas, a interface informa o impacto e exige confirmação antes de iniciar a migração.

O estado React de empenhos e NFs só é atualizado depois do commit bem-sucedido.

Remover o CNPJ continua permitido quando o empenho não possui NFs. Se existem NFs, a remoção é bloqueada porque destruiria a identidade determinística `CNPJ + NF`.

## Emulator e testes

A suíte cobre:

- planejamento de migração de múltiplas NFs;
- registros legados sem CNPJ;
- CNPJ divergente;
- remoção de CNPJ com/sem NFs;
- colisão de identidade;
- migração completa NE + NFs + lock;
- rejeição de alteração NF/lock quando o empenho não confirma o novo CNPJ.

## Fora do escopo

A validação matemática dos dígitos verificadores foi implementada no Bloco 6 e agora protege o CNPJ alvo da migração, inclusive no formato alfanumérico.

O endurecimento global das Firestore Rules para toda escrita de `numeroNS` continua no Bloco 5.
