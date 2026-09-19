# Bloco 2 — Edição manual de NS com integridade transacional

## Objetivo

Eliminar o `GAP-001` do contrato `emprovex_ns_integrity_v1`.

Antes deste bloco, a edição manual executava:

```text
campo NS → saveInvoice() → numeroNS
```

Esse caminho não conhecia locks e podia concorrer com o importador SAG.

Depois deste bloco:

```text
campo NS
  → validação local
  → NsIntegrityMutation(source = manual)
  → commitNsIntegrityMutations()
  → transação NF + lock
  → atualização da interface
```

## Regras da edição manual

A gravação manual exige:

- sessão Firebase autenticada;
- NF existente no estado atual;
- empenho vinculado existente;
- CNPJ disponível na NF ou no empenho;
- NS vazia para remoção ou NS válida no formato `AAAANSNNNNNN`;
- identidade da NF ainda igual no Firestore;
- NS atual ainda igual àquela apresentada ao operador;
- novo lock livre ou já pertencente à mesma NF.

## Normalização

Entradas como:

```text
2026 ns 000123
```

são normalizadas para:

```text
2026NS000123
```

Entradas que não resultem no padrão `AAAANSNNNNNN` são rejeitadas antes da transação.

## Atribuição

```text
NF sem NS
→ 2026NS000123
```

A transação:

1. relê NF e NE;
2. relê o lock proposto;
3. bloqueia se o lock pertencer a outra NF;
4. grava `numeroNS`;
5. cria o lock;
6. conclui atomicamente.

## Reaplicação idempotente

```text
2026NS000123
→ 2026NS000123
```

Não há nova escrita material na NF.

Se o registro histórico ainda não possuir lock, a transação pode reconstruir o lock da mesma NS para a mesma NF. Isso permite curar registros manuais anteriores sem alterar o número existente.

## Troca

```text
2026NS000123
→ 2026NS000456
```

Na mesma transação:

- o lock atual, quando existente, precisa pertencer à NF;
- o novo lock precisa estar livre ou pertencer à mesma NF;
- o lock antigo é liberado;
- a NF recebe a nova NS;
- o novo lock é adquirido.

Se qualquer verificação falhar, nada é aplicado.

## Remoção

Campo vazio representa:

```text
2026NS000123
→ sem NS
```

Na mesma transação:

- o valor `numeroNS` é removido da NF;
- o lock atual é removido quando existe e pertence à NF.

Uma NF histórica com NS mas sem lock também pode ter sua NS removida com segurança.

## Concorrência manual × SAG

SAG e edição manual agora convergem para:

```text
commitNsIntegrityMutations()
```

Portanto, duas operações que tentem reservar a mesma NS passam pela mesma coleção de locks e pela mesma transação Firestore.

O segundo concorrente deve reler o lock e falhar fechado quando a NS já tiver sido adquirida por outra NF.

A cobertura end-to-end no Firebase Emulator executando o serviço real continua planejada para o Bloco 9; este bloco não antecipa essa etapa.

## Estado local

A interface não faz alteração otimista de `numeroNS`.

`setInvoices()` só ocorre depois do retorno bem-sucedido do serviço transacional. Em erro:

- o editor permanece aberto;
- o valor local não é confirmado;
- a NF exibida permanece no estado anterior;
- o operador recebe a mensagem da validação/transação.

## Compatibilidade

Não foram alterados neste bloco:

- ID físico do lock `sagNsLock_{NS}`;
- Firestore Rules;
- exclusão de NF;
- migração de `recordKey`;
- alteração de CNPJ do empenho;
- identidade futura `workspace + UG + NS`.

Esses pontos permanecem nos blocos seguintes.

## Status

`GAP-001` — **resolvido no Bloco 2**.

O snapshot original de gaps permanece congelado em `ops/ns-integrity-contract.json`. O estado de resolução evolutivo fica em `ops/ns-integrity-resolution-status.json`.
